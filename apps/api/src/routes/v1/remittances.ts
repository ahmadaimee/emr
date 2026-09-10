import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertCan } from '@grove/auth';
import { desc, eq, schema } from '@grove/db';
import { postRemittanceCommand } from '@grove/domain';
import { parse835, splitTransactionSets, tokenize } from '@grove/x12';

const uuid = z.string().uuid();

export async function remittanceRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/v1/remittances/import', {
    schema: {
      tags: ['Remittances'], summary: 'Import and post an 835 file received outside the clearinghouse feed',
      body: z.object({ x12: z.string().min(106), file_name: z.string().max(200).optional(), practice_id: uuid.optional() }),
      response: { 200: z.object({ results: z.array(z.object({ remittance_id: uuid, trace_number: z.string(), status: z.string(), claims_matched: z.number(), claims_unmatched: z.number(), denials: z.number(), underpayments: z.number(), secondary_ready: z.number(), out_of_balance: z.number() })) }) },
    },
  }, async (req) => {
    assertCan(req.actor, 'remittance:import', { practiceId: req.body.practice_id });
    const sets = splitTransactionSets(tokenize(req.body.x12));
    const results = [];
    for (const ts of sets) {
      const remit = parse835(ts);
      const res = await req.command((ctx) => postRemittanceCommand(ctx, remit, { connector: 'manual', fileName: req.body.file_name, practiceId: req.body.practice_id }));
      results.push({ remittance_id: res.remittanceId, trace_number: remit.traceNumber, status: res.status, claims_matched: res.claimsMatched, claims_unmatched: res.claimsUnmatched, denials: res.denials, underpayments: res.underpayments, secondary_ready: res.secondaryReady, out_of_balance: res.outOfBalance });
    }
    return { results };
  });

  r.get('/v1/remittances', {
    schema: {
      tags: ['Remittances'], summary: 'List remittances',
      querystring: z.object({ status: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }),
      response: { 200: z.object({ data: z.array(z.object({ id: uuid, status: z.string(), payer_name: z.string().nullable(), trace_number: z.string().nullable(), payment_date: z.string().nullable(), total_paid_cents: z.number(), balance_variance_cents: z.number(), received_at: z.string() })) }) },
    },
  }, async (req) => {
    const rows = await req.command((ctx) => ctx.tx.select().from(schema.remittances).where(req.query.status ? eq(schema.remittances.status, req.query.status as typeof schema.remittances.$inferSelect.status) : undefined).orderBy(desc(schema.remittances.receivedAt)).limit(req.query.limit));
    return { data: rows.map((x) => ({ id: x.id, status: x.status, payer_name: x.payerName, trace_number: x.traceNumber, payment_date: x.paymentDate, total_paid_cents: x.totalPaidCents, balance_variance_cents: x.balanceVarianceCents, received_at: x.receivedAt.toISOString() })) };
  });
}
