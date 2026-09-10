import { recordActivity } from '@grove/audit';
import { and, eq, inArray, schema, sql } from '@grove/db';
import type { Remittance835, RemittanceClaim as X12Claim } from '@grove/x12';
import { checkBalance } from '@grove/x12';
import { transitionClaim } from '../claims/lifecycle';
import { DomainError, type CommandContext } from '../context';
import { classifyAdjustment, isAutoPostable } from '../denials/classify';
import { postLedger, type LedgerPost } from '../ledger/post';
import { emit } from '../outbox';
import { createTask } from '../tasks/create';

export interface PostRemittanceResult {
  remittanceId: string;
  status: string;
  claimsMatched: number;
  claimsUnmatched: number;
  outOfBalance: number;
  denials: number;
  underpayments: number;
  secondaryReady: number;
  crossoversExpected: number;
}

/**
 * Ingest and post one 835 transaction set.
 *
 * Safety rules baked in, not configurable:
 *   - CO adjustments post as contractual write-offs.
 *   - PR adjustments transfer responsibility to the patient.
 *   - OA / PI / CR are NEVER auto-posted; they become work.
 *   - PLB provider-level adjustments never touch a claim.
 *   - An out-of-balance claim posts what balances and flags the variance.
 *   - Nothing is ever forced to balance.
 */
export async function postRemittanceCommand(
  ctx: CommandContext,
  r: Remittance835,
  source: { connector: string; fileId?: string; fileName?: string; rawFileKey?: string; practiceId?: string },
): Promise<PostRemittanceResult> {
  const orgId = ctx.tenant.orgId;
  const today = ctx.now().toISOString().slice(0, 10);

  // Idempotent on the payer's trace number: re-fetching a file must not double-post.
  const existing = await ctx.tx
    .select({ id: schema.remittances.id, status: schema.remittances.status })
    .from(schema.remittances)
    .where(and(eq(schema.remittances.traceNumber, r.traceNumber), eq(schema.remittances.payerIdentifier, r.payerIdentifier)));
  if (existing[0]) throw new DomainError(`Remittance ${r.traceNumber} already ${existing[0].status}`, 'remittance_duplicate', 409, { remittanceId: existing[0].id });

  // Resolve the payer from the connector ID map, then fall back to the payee NPI's practice.
  const payer = await resolvePayer(ctx, r);
  const practiceId = source.practiceId ?? (await resolvePractice(ctx, r.payee.npi ?? undefined));

  const computedClaimTotal = r.claims.reduce((s, c) => s + c.totalPaidCents, 0);
  const plbTotal = r.providerAdjustments.reduce((s, p) => s + p.adjustments.reduce((x, a) => x + a.amountCents, 0), 0);
  // BPR02 = Σ CLP04 − Σ PLB (PLB amounts are subtracted from the payment).
  const variance = r.totalPaidCents - (computedClaimTotal - plbTotal);

  const [rem] = await ctx.tx
    .insert(schema.remittances)
    .values({
      orgId, practiceId, payerId: payer?.id ?? null,
      status: 'parsed',
      paymentMethod: r.paymentMethod, totalPaidCents: r.totalPaidCents, paymentDate: r.paymentDate || null,
      traceNumber: r.traceNumber, payerIdentifier: r.payerIdentifier, checkNumber: r.paymentMethod === 'CHK' ? r.traceNumber : null,
      payerName: r.payer.name, payeeName: r.payee.name, payeeNpi: r.payee.npi ?? null,
      computedClaimTotalCents: computedClaimTotal, providerAdjustmentTotalCents: plbTotal, balanceVarianceCents: variance,
      connector: source.connector, connectorFileId: source.fileId ?? null, rawFileKey: source.rawFileKey ?? null, fileName: source.fileName ?? null,
    })
    .returning({ id: schema.remittances.id });
  const remittanceId = rem!.id;

  const [batch] = await ctx.tx
    .insert(schema.paymentBatches)
    .values({ orgId, practiceId: practiceId ?? '00000000-0000-4000-8000-000000000000', batchType: 'era', depositDate: r.paymentDate || today, expectedTotalCents: r.totalPaidCents, remittanceId, bankReference: r.traceNumber, status: 'posting' })
    .returning({ id: schema.paymentBatches.id });
  const batchId = batch!.id;

  // PLB rows first: they are provider-level and independent of claims.
  for (const p of r.providerAdjustments) {
    for (const a of p.adjustments) {
      await ctx.tx.insert(schema.providerLevelAdjustments).values({
        orgId, remittanceId, providerIdentifier: p.providerIdentifier, fiscalPeriodDate: p.fiscalPeriodDate || null,
        adjustmentReasonCode: a.reasonCode, referenceIdentifier: a.referenceId ?? null, amountCents: a.amountCents,
      });
    }
  }
  if (r.providerAdjustments.length) {
    await createTask(ctx, {
      queueKey: 'out-of-balance', practiceId, subjectType: 'remittance', subjectId: remittanceId,
      title: `Provider-level adjustments on ${r.payer.name} remittance ${r.traceNumber}`,
      detail: { plbTotalCents: plbTotal, count: r.providerAdjustments.length }, priority: 'normal',
      dedupeKey: `plb:${remittanceId}`,
    });
  }

  const lineBalanceIssues = new Map(checkBalance(r).map((b) => [b.patientControlNumber, b.varianceCents]));
  const counters = { matched: 0, unmatched: 0, outOfBalance: 0, denials: 0, underpayments: 0, secondaryReady: 0, crossovers: 0 };

  for (const rc of r.claims) {
    const outcome = await postClaim(ctx, rc, { remittanceId, batchId, practiceId, payerId: payer?.id ?? null, payerName: r.payer.name, today, lineVariance: lineBalanceIssues.get(rc.patientControlNumber) ?? 0 });
    counters.matched += outcome.matched ? 1 : 0;
    counters.unmatched += outcome.matched ? 0 : 1;
    counters.outOfBalance += outcome.outOfBalance ? 1 : 0;
    counters.denials += outcome.denials;
    counters.underpayments += outcome.underpayments;
    counters.secondaryReady += outcome.secondaryReady ? 1 : 0;
    counters.crossovers += outcome.crossoverExpected ? 1 : 0;
  }

  const status = counters.unmatched > 0 || counters.outOfBalance > 0 || variance !== 0 ? 'partially_posted' : 'posted';
  await ctx.tx.update(schema.remittances).set({ status, postedAt: ctx.now(), postedBy: ctx.actor?.userId ?? null, updatedAt: ctx.now() }).where(eq(schema.remittances.id, remittanceId));
  await ctx.tx.update(schema.paymentBatches).set({ status: variance === 0 && counters.unmatched === 0 ? 'balanced' : 'out_of_balance', postedTotalCents: computedClaimTotal - plbTotal, updatedAt: ctx.now() }).where(eq(schema.paymentBatches.id, batchId));

  if (variance !== 0) {
    await createTask(ctx, {
      queueKey: 'out-of-balance', practiceId, subjectType: 'remittance', subjectId: remittanceId,
      title: `Remittance ${r.traceNumber} is out of balance by ${(variance / 100).toFixed(2)}`,
      detail: { bprCents: r.totalPaidCents, claimTotalCents: computedClaimTotal, plbCents: plbTotal, varianceCents: variance }, priority: 'high',
      dedupeKey: `remit-oob:${remittanceId}`,
    });
    await emit(ctx, 'remittance.out_of_balance', 'remittance', remittanceId, { traceNumber: r.traceNumber, varianceCents: variance });
  }

  await emit(ctx, 'remittance.posted', 'remittance', remittanceId, { traceNumber: r.traceNumber, totalPaidCents: r.totalPaidCents, ...counters });
  await recordActivity(ctx.tx, {
    orgId, practiceId, subjectType: 'remittance', subjectId: remittanceId, verb: 'remittance.posted',
    summary: `posted ${r.payer.name} remittance ${r.traceNumber}: ${counters.matched} claims, ${counters.denials} denials${counters.underpayments ? `, ${counters.underpayments} underpayments` : ''}`,
    detail: counters, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  return { remittanceId, status, claimsMatched: counters.matched, claimsUnmatched: counters.unmatched, outOfBalance: counters.outOfBalance, denials: counters.denials, underpayments: counters.underpayments, secondaryReady: counters.secondaryReady, crossoversExpected: counters.crossovers };
}

// ---------------------------------------------------------------------------

interface PostClaimEnv {
  remittanceId: string;
  batchId: string;
  practiceId: string | null;
  payerId: string | null;
  payerName: string;
  today: string;
  lineVariance: number;
}

async function postClaim(ctx: CommandContext, rc: X12Claim, env: PostClaimEnv) {
  const orgId = ctx.tenant.orgId;
  const out = { matched: false, outOfBalance: false, denials: 0, underpayments: 0, secondaryReady: false, crossoverExpected: false };

  // Match on CLP01 — we send claim_number as CLM01, so the payer echoes it back.
  const [claim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.claimNumber, rc.patientControlNumber));

  const [rcRow] = await ctx.tx
    .insert(schema.remittanceClaims)
    .values({
      orgId, remittanceId: env.remittanceId, claimId: claim?.id ?? null,
      patientControlNumber: rc.patientControlNumber, claimStatusCode: rc.claimStatusCode,
      totalChargeCents: rc.totalChargeCents, totalPaidCents: rc.totalPaidCents, patientResponsibilityCents: rc.patientResponsibilityCents,
      payerClaimControlNumber: rc.payerClaimControlNumber || null, claimFilingIndicator: rc.claimFilingIndicator || null,
      crossoverCarrierName: rc.crossoverCarrier?.name ?? null, crossoverCarrierId: rc.crossoverCarrier?.id ?? null,
      remarkCodes: rc.remarkCodes, outOfBalance: env.lineVariance !== 0, varianceCents: env.lineVariance,
    })
    .returning({ id: schema.remittanceClaims.id });
  const remittanceClaimId = rcRow!.id;

  for (const a of rc.adjustments) {
    const c = classifyAdjustment(a.group, a.reasonCode);
    await ctx.tx.insert(schema.remittanceAdjustments).values({ orgId, remittanceClaimId, groupCode: a.group, reasonCode: a.reasonCode, reasonDescription: c.description, amountCents: a.amountCents, quantity: a.quantity ?? null, isDenial: c.isDenial });
  }

  if (!claim) {
    await createTask(ctx, {
      queueKey: 'out-of-balance', practiceId: env.practiceId, subjectType: 'remittance', subjectId: env.remittanceId,
      title: `Unmatched claim ${rc.patientControlNumber} on ${env.payerName} remittance`,
      detail: { patientControlNumber: rc.patientControlNumber, paidCents: rc.totalPaidCents, patient: rc.patient?.person }, priority: 'high',
      dedupeKey: `unmatched:${remittanceClaimId}`,
    });
    return out;
  }
  out.matched = true;
  out.outOfBalance = env.lineVariance !== 0;

  // Carry the payer's control number forward: corrected claims and appeals need it.
  if (rc.payerClaimControlNumber && !claim.payerClaimControlNumber) {
    await ctx.tx.update(schema.claims).set({ payerClaimControlNumber: rc.payerClaimControlNumber, firstRemittanceAt: claim.firstRemittanceAt ?? ctx.now() }).where(eq(schema.claims.id, claim.id));
  }

  const lines = await ctx.tx.select().from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, claim.encounterId));
  const contract = await loadContract(ctx, claim.practiceId, claim.payerId, claim.serviceDateFrom);

  const ledger: LedgerPost[] = [];
  const pendingReview: Array<{ lineId: string | null; group: string; reason: string; cents: number; description: string }> = [];

  for (const [i, rl] of rc.lines.entries()) {
    // Match by our line control number (REF*6R "L<n>"), then by procedure + date.
    const byControl = rl.lineControlNumber ? lines.find((l) => `L${l.lineNumber}` === rl.lineControlNumber) : undefined;
    const line = byControl ?? lines.find((l) => l.procedureCode === rl.procedureCode && (!rl.serviceDate || l.serviceDate === rl.serviceDate)) ?? lines[i];

    const allowedFromCas = rl.chargeCents - rl.adjustments.filter((a) => a.group === 'CO').reduce((s, a) => s + a.amountCents, 0);
    const allowed = rl.allowedCents ?? allowedFromCas;
    const expected = line?.expectedAllowedCents ?? (line && contract ? contractRate(contract, line.procedureCode, line.placeOfService ?? '11') : null);
    const underpayment = expected !== null && expected !== undefined && allowed < expected - (contract?.toleranceCents ?? 0) ? expected - allowed : null;

    const [rlRow] = await ctx.tx
      .insert(schema.remittanceLines)
      .values({
        orgId, remittanceClaimId, serviceLineId: line?.id ?? null, lineNumber: line?.lineNumber ?? i + 1,
        procedureCode: rl.procedureCode, modifier1: rl.modifiers[0] ?? null, modifier2: rl.modifiers[1] ?? null, modifier3: rl.modifiers[2] ?? null, modifier4: rl.modifiers[3] ?? null,
        adjudicatedProcedureCode: rl.adjudicatedProcedureCode ?? null,
        chargeCents: rl.chargeCents, paidCents: rl.paidCents, allowedCents: allowed,
        unitsBilled: rl.unitsBilled ?? null, unitsPaid: rl.unitsPaid ?? null, serviceDate: rl.serviceDate ?? null, remarkCodes: rl.remarkCodes,
        expectedAllowedCents: expected ?? null, underpaymentCents: underpayment,
      })
      .returning({ id: schema.remittanceLines.id });
    const remittanceLineId = rlRow!.id;

    for (const a of rl.adjustments) {
      const c = classifyAdjustment(a.group, a.reasonCode);
      await ctx.tx.insert(schema.remittanceAdjustments).values({ orgId, remittanceLineId, groupCode: a.group, reasonCode: a.reasonCode, reasonDescription: c.description, amountCents: a.amountCents, quantity: a.quantity ?? null, isDenial: c.isDenial });

      if (!line) continue;
      const base = { practiceId: claim.practiceId, patientId: claim.patientId, encounterId: claim.encounterId, claimId: claim.id, serviceLineId: line.id, payerId: claim.payerId, postingDate: env.today, serviceDate: line.serviceDate, sourceType: 'remittance_line', sourceId: remittanceLineId, paymentBatchId: env.batchId };

      if (a.group === 'CO' && isAutoPostable(a.group, a.reasonCode)) {
        ledger.push({ ...base, entryType: 'contractual_adjustment', amountCents: -a.amountCents, responsibility: 'insurance', note: `CO-${a.reasonCode} ${c.description}` });
      } else if (a.group === 'PR') {
        // Move responsibility: insurance balance goes down, patient balance goes up.
        ledger.push({ ...base, entryType: 'transfer_to_patient', amountCents: -a.amountCents, responsibility: 'insurance', note: `PR-${a.reasonCode} ${c.description}` });
        ledger.push({ ...base, entryType: 'transfer_to_patient', amountCents: a.amountCents, responsibility: 'patient', note: `PR-${a.reasonCode} ${c.description}` });
      } else {
        pendingReview.push({ lineId: line.id, group: a.group, reason: a.reasonCode, cents: a.amountCents, description: c.description });
      }

      if (c.isDenial && a.amountCents > 0) {
        out.denials++;
        await recordDenial(ctx, { claim, remittanceClaimId, remittanceLineId, reasonCode: a.reasonCode, group: a.group, cents: a.amountCents, remarkCodes: rl.remarkCodes, classification: c, practiceId: claim.practiceId });
      }
    }

    if (line && rl.paidCents !== 0) {
      ledger.push({ practiceId: claim.practiceId, patientId: claim.patientId, encounterId: claim.encounterId, claimId: claim.id, serviceLineId: line.id, entryType: 'payment_insurance', amountCents: -rl.paidCents, responsibility: 'insurance', payerId: claim.payerId, postingDate: env.today, serviceDate: line.serviceDate, sourceType: 'remittance_line', sourceId: remittanceLineId, paymentBatchId: env.batchId });
      await ctx.tx.update(schema.serviceLines).set({ allowedCents: allowed }).where(eq(schema.serviceLines.id, line.id));
    }

    if (line && underpayment && underpayment > 0) {
      out.underpayments++;
      await createTask(ctx, {
        queueKey: 'underpayments', practiceId: claim.practiceId, subjectType: 'claim', subjectId: claim.id, patientId: claim.patientId,
        title: `${line.procedureCode} underpaid by ${(underpayment / 100).toFixed(2)} on ${claim.claimNumber}`,
        detail: { serviceLineId: line.id, expectedAllowedCents: expected, allowedCents: allowed, underpaymentCents: underpayment, remittanceLineId },
        priority: underpayment >= 10000 ? 'high' : 'normal', suggestedAction: 'appeal', dedupeKey: `underpay:${remittanceLineId}`,
      });
      await emit(ctx, 'underpayment.detected', 'claim', claim.id, { claimNumber: claim.claimNumber, serviceLineId: line.id, underpaymentCents: underpayment });
    }

    // Record what this payer did to the line, for the secondary claim's Loop 2430.
    if (line) {
      await ctx.tx
        .insert(schema.claimLinePriorAdjudications)
        .values({
          orgId, claimId: claim.id, serviceLineId: line.id, priorPayerId: claim.payerId, priorRemittanceLineId: remittanceLineId,
          priorPayerClaimControlNumber: rc.payerClaimControlNumber || null, procedureCode: rl.procedureCode, modifiers: rl.modifiers,
          paidAmountCents: rl.paidCents, paidUnits: rl.unitsPaid ?? null, adjudicationDate: env.today,
          adjustments: rl.adjustments.map((a) => ({ group: a.group, reasonCode: a.reasonCode, amountCents: a.amountCents, quantity: a.quantity })),
        })
        .onConflictDoUpdate({
          target: [schema.claimLinePriorAdjudications.serviceLineId, schema.claimLinePriorAdjudications.priorPayerId],
          set: { priorRemittanceLineId: remittanceLineId, paidAmountCents: rl.paidCents, adjudicationDate: env.today, adjustments: rl.adjustments.map((a) => ({ group: a.group, reasonCode: a.reasonCode, amountCents: a.amountCents, quantity: a.quantity })), updatedAt: ctx.now() },
        });
    }
  }

  // Claim-level adjustments with no line: treat like line-level for review purposes.
  for (const a of rc.adjustments) {
    if (a.group === 'PR' || (a.group === 'CO' && isAutoPostable(a.group, a.reasonCode))) {
      const first = lines[0];
      if (!first) continue;
      const base = { practiceId: claim.practiceId, patientId: claim.patientId, encounterId: claim.encounterId, claimId: claim.id, serviceLineId: first.id, payerId: claim.payerId, postingDate: env.today, serviceDate: first.serviceDate, sourceType: 'remittance_claim', sourceId: remittanceClaimId, paymentBatchId: env.batchId };
      if (a.group === 'PR') {
        ledger.push({ ...base, entryType: 'transfer_to_patient', amountCents: -a.amountCents, responsibility: 'insurance' });
        ledger.push({ ...base, entryType: 'transfer_to_patient', amountCents: a.amountCents, responsibility: 'patient' });
      } else {
        ledger.push({ ...base, entryType: 'contractual_adjustment', amountCents: -a.amountCents, responsibility: 'insurance' });
      }
    } else {
      pendingReview.push({ lineId: null, group: a.group, reason: a.reasonCode, cents: a.amountCents, description: classifyAdjustment(a.group, a.reasonCode).description });
    }
  }

  await postLedger(ctx, ledger);
  await ctx.tx.update(schema.remittanceClaims).set({ postedAt: ctx.now() }).where(eq(schema.remittanceClaims.id, remittanceClaimId));

  if (pendingReview.length) {
    await createTask(ctx, {
      queueKey: 'denials', practiceId: claim.practiceId, subjectType: 'claim', subjectId: claim.id, patientId: claim.patientId,
      title: `${pendingReview.length} adjustment${pendingReview.length === 1 ? '' : 's'} on ${claim.claimNumber} need review (${[...new Set(pendingReview.map((p) => `${p.group}-${p.reason}`))].join(', ')})`,
      detail: { adjustments: pendingReview, remittanceClaimId }, priority: 'normal', dedupeKey: `review:${remittanceClaimId}`,
    });
  }
  if (out.outOfBalance) {
    await createTask(ctx, {
      queueKey: 'out-of-balance', practiceId: claim.practiceId, subjectType: 'claim', subjectId: claim.id, patientId: claim.patientId,
      title: `${claim.claimNumber}: CLP paid differs from service lines by ${(env.lineVariance / 100).toFixed(2)}`,
      detail: { remittanceClaimId, varianceCents: env.lineVariance }, priority: 'high', dedupeKey: `oob:${remittanceClaimId}`,
    });
  }

  // Lifecycle
  const [fresh] = await ctx.tx.select({ balanceCents: schema.claims.balanceCents, patientResponsibilityCents: schema.claims.patientResponsibilityCents, coverageRank: schema.claims.coverageRank, status: schema.claims.status }).from(schema.claims).where(eq(schema.claims.id, claim.id));
  const insuranceBalance = (fresh?.balanceCents ?? 0) - (fresh?.patientResponsibilityCents ?? 0);

  if (rc.claimStatusCode === '4' || (rc.totalPaidCents === 0 && out.denials > 0)) {
    await safeTransition(ctx, claim.id, 'denied', `${env.payerName} denied`);
    await emit(ctx, 'claim.denied', 'claim', claim.id, { claimNumber: claim.claimNumber, remittanceClaimId });
  } else if (rc.claimStatusCode === '22') {
    await safeTransition(ctx, claim.id, 'in_process', 'payer reversed a prior payment');
  } else {
    const fullyResolved = insuranceBalance <= 0 && pendingReview.length === 0;
    await safeTransition(ctx, claim.id, fullyResolved ? 'paid' : 'partially_paid', `${env.payerName} paid ${(rc.totalPaidCents / 100).toFixed(2)}`);
    await emit(ctx, 'claim.paid', 'claim', claim.id, { claimNumber: claim.claimNumber, paidCents: rc.totalPaidCents, remittanceClaimId, fullyResolved });

    // Coordination of benefits.
    if (fresh?.coverageRank === 'primary') {
      const secondary = await ctx.tx.select().from(schema.coverages).where(and(eq(schema.coverages.patientId, claim.patientId), eq(schema.coverages.rank, 'secondary'), eq(schema.coverages.active, true)));
      const remaining = (fresh.balanceCents ?? 0);
      if (secondary[0] && remaining > 0) {
        if (rc.crossoverCarrier) {
          // The primary forwarded the claim. Submitting our own secondary now would
          // produce a duplicate denial. Wait for the secondary 835 instead.
          out.crossoverExpected = true;
          await emit(ctx, 'claim.crossover_expected', 'claim', claim.id, { claimNumber: claim.claimNumber, carrier: rc.crossoverCarrier, secondaryCoverageId: secondary[0].id, waitDays: 30 });
        } else {
          out.secondaryReady = true;
          await safeTransition(ctx, claim.id, 'secondary_ready', 'primary adjudicated; secondary coverage on file');
          await emit(ctx, 'claim.secondary_ready', 'claim', claim.id, { claimNumber: claim.claimNumber, remittanceClaimId, secondaryCoverageId: secondary[0].id, remainingCents: remaining }, `secondary:${remittanceClaimId}`);
        }
      } else if (remaining > 0 && (fresh.patientResponsibilityCents ?? 0) > 0 && insuranceBalance <= 0) {
        await safeTransition(ctx, claim.id, 'patient_responsibility', 'balance transferred to patient');
      }
    }
  }

  return out;
}

async function safeTransition(ctx: CommandContext, claimId: string, to: Parameters<typeof transitionClaim>[2], reason: string) {
  try {
    await transitionClaim(ctx, claimId, to, 'era', reason);
  } catch (err) {
    if (!(err instanceof DomainError && err.code === 'invalid_transition')) throw err;
    // A late 835 for an already-closed claim is informational; do not fail the post.
  }
}

async function recordDenial(ctx: CommandContext, d: { claim: typeof schema.claims.$inferSelect; remittanceClaimId: string; remittanceLineId: string | null; reasonCode: string; group: string; cents: number; remarkCodes: string[]; classification: ReturnType<typeof classifyAdjustment>; practiceId: string }) {
  const plan = d.claim.coverageId ? (await ctx.tx.select({ appealDays: schema.payerPlans.appealFilingDays }).from(schema.coverages).innerJoin(schema.payerPlans, eq(schema.payerPlans.id, schema.coverages.planId)).where(eq(schema.coverages.id, d.claim.coverageId)))[0] : undefined;
  const appealDeadline = plan?.appealDays ? addDays(ctx.now().toISOString().slice(0, 10), plan.appealDays) : null;

  const queue = await ctx.tx.select({ id: schema.workQueues.id }).from(schema.workQueues).where(and(eq(schema.workQueues.orgId, ctx.tenant.orgId), eq(schema.workQueues.key, 'denials')));
  const [denial] = await ctx.tx
    .insert(schema.denials)
    .values({
      orgId: ctx.tenant.orgId, practiceId: d.practiceId, claimId: d.claim.id, remittanceClaimId: d.remittanceClaimId, remittanceLineId: d.remittanceLineId,
      payerId: d.claim.payerId, groupCode: d.group, reasonCode: d.reasonCode, remarkCodes: d.remarkCodes, deniedAmountCents: d.cents,
      category: d.classification.category, preventable: d.classification.preventable, suggestedAction: d.classification.suggestedAction,
      suggestedActionDetail: { description: d.classification.description }, autoResolvable: d.classification.autoResolvable,
      status: d.classification.suggestedAction === 'close_duplicate' ? 'resolved' : 'open', workQueueId: queue[0]?.id ?? null, appealDeadline,
      resolutionNote: d.classification.suggestedAction === 'close_duplicate' ? 'Auto-closed: exact duplicate of a claim already on file' : null,
      resolvedAt: d.classification.suggestedAction === 'close_duplicate' ? ctx.now() : null,
    })
    .returning({ id: schema.denials.id });

  await emit(ctx, 'denial.created', 'denial', denial!.id, { claimId: d.claim.id, claimNumber: d.claim.claimNumber, reasonCode: d.reasonCode, category: d.classification.category, deniedCents: d.cents });
  if (d.classification.suggestedAction !== 'close_duplicate') {
    await createTask(ctx, {
      queueKey: 'denials', practiceId: d.practiceId, subjectType: 'denial', subjectId: denial!.id, patientId: d.claim.patientId,
      title: `${d.group}-${d.reasonCode} ${d.classification.description} — ${d.claim.claimNumber}`,
      detail: { deniedCents: d.cents, category: d.classification.category, remarkCodes: d.remarkCodes, appealDeadline },
      priority: d.classification.category === 'timely_filing' || d.cents >= 50000 ? 'high' : 'normal',
      suggestedAction: d.classification.suggestedAction, dueAt: appealDeadline ? new Date(appealDeadline + 'T00:00:00Z') : null,
      dedupeKey: `denial:${denial!.id}`,
    });
  }
}

async function resolvePayer(ctx: CommandContext, r: Remittance835) {
  const ids = r.payer.identifiers.map((i) => i.value).concat(r.payerIdentifier);
  if (ids.length) {
    const map = await ctx.tx.select({ payerId: schema.payerConnectorIds.payerId }).from(schema.payerConnectorIds).where(inArray(schema.payerConnectorIds.connectorPayerId, ids));
    if (map[0]) return (await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, map[0].payerId)))[0];
    const direct = await ctx.tx.select().from(schema.payers).where(inArray(schema.payers.payerIdCode, ids));
    if (direct[0]) return direct[0];
  }
  const byName = await ctx.tx.select().from(schema.payers).where(sql`upper(name) = ${r.payer.name.toUpperCase()}`);
  return byName[0];
}

async function resolvePractice(ctx: CommandContext, npi?: string): Promise<string | null> {
  if (!npi) return null;
  const [p] = await ctx.tx.select({ id: schema.practices.id }).from(schema.practices).where(eq(schema.practices.npi, npi));
  return p?.id ?? null;
}

interface ContractRates {
  toleranceCents: number;
  lines: Map<string, { nonFacility: number | null; facility: number | null }>;
}

async function loadContract(ctx: CommandContext, practiceId: string, payerId: string, dos: string): Promise<ContractRates | null> {
  const [contract] = await ctx.tx
    .select()
    .from(schema.payerContracts)
    .where(and(eq(schema.payerContracts.practiceId, practiceId), eq(schema.payerContracts.payerId, payerId), eq(schema.payerContracts.active, true), sql`effective_date <= ${dos}`, sql`(termination_date is null or termination_date >= ${dos})`));
  if (!contract) return null;
  const schedules = await ctx.tx.select({ id: schema.feeSchedules.id }).from(schema.feeSchedules).where(eq(schema.feeSchedules.contractId, contract.id));
  if (!schedules.length) return null;
  const lines = await ctx.tx.select().from(schema.feeScheduleLines).where(inArray(schema.feeScheduleLines.feeScheduleId, schedules.map((s) => s.id)));
  const map = new Map<string, { nonFacility: number | null; facility: number | null }>();
  for (const l of lines) map.set(l.procedureCode, { nonFacility: l.nonFacilityRateCents, facility: l.facilityRateCents });
  return { toleranceCents: contract.underpaymentToleranceCents, lines: map };
}

const FACILITY_POS = new Set(['02', '19', '21', '22', '23', '24', '31', '32', '34', '41', '42', '51', '52', '53', '56', '61']);
function contractRate(c: ContractRates, code: string, pos: string): number | null {
  const r = c.lines.get(code);
  if (!r) return null;
  return FACILITY_POS.has(pos) ? (r.facility ?? r.nonFacility) : (r.nonFacility ?? r.facility);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
