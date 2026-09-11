'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { and, eq, schema, sql } from '@grove/db';
import { postLedger } from '@grove/domain';
import { getSignedDownloadUrl, putObject } from '@grove/storage';
import { pageContext } from '@/lib/session';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function createPatient(formData: FormData) {
  const firstName = (formData.get('firstName') as string)?.trim();
  const lastName = (formData.get('lastName') as string)?.trim();
  const dateOfBirth = formData.get('dateOfBirth') as string;
  const sex = (formData.get('sex') as 'M' | 'F' | 'U') || 'U';
  const email = (formData.get('email') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const practiceId = formData.get('practiceId') as string;

  if (!firstName || !lastName || !dateOfBirth) {
    throw new Error('First name, last name, and date of birth are required');
  }

  const { run, session } = await pageContext();
  const patientId = await run('/patients', async (ctx, phi) => {
    // 1. Check for duplicates in practice
    const duplicates = await ctx.tx
      .select({ id: schema.patients.id, mrn: schema.patients.mrn })
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.practiceId, practiceId),
          sql`lower(${schema.patients.firstName}) = lower(${firstName})`,
          sql`lower(${schema.patients.lastName}) = lower(${lastName})`,
          eq(schema.patients.dateOfBirth, dateOfBirth)
        )
      );

    if (duplicates.length > 0) {
      throw new Error(`Potential duplicate patient detected with MRN ${duplicates[0]!.mrn}.`);
    }

    // 2. Generate MRN
    const mrn = `MRN${Math.floor(100000 + Math.random() * 900000)}`;
    const id = randomUUID();

    await ctx.tx.insert(schema.patients).values({
      id,
      orgId: ctx.tenant.orgId,
      practiceId,
      mrn,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      email,
      phoneMobile: phone,
    });

    phi.touch([id], ['demographics']);

    // 3. Audit
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'patient',
      resourceId: id,
      patientId: id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { mrn, name: `${lastName}, ${firstName}` },
    });

    return id;
  });

  revalidatePath('/patients');
  return { success: true, patientId };
}

export async function addCoverage(formData: FormData) {
  const patientId = formData.get('patientId') as string;
  const payerId = formData.get('payerId') as string;
  const memberId = (formData.get('memberId') as string)?.trim();
  const groupNumber = (formData.get('groupNumber') as string)?.trim() || null;
  const rank = (formData.get('rank') as 'primary' | 'secondary' | 'tertiary') || 'primary';
  const relationshipCode = (formData.get('relationshipCode') as string) || '18';

  if (!patientId || !payerId || !memberId) {
    throw new Error('Patient, payer, and member ID are required');
  }

  const { run, session } = await pageContext();
  await run(`/patients/${patientId}/coverage`, async (ctx, phi) => {
    phi.touch([patientId], ['financial']);
    const id = randomUUID();

    await ctx.tx.insert(schema.coverages).values({
      id,
      orgId: ctx.tenant.orgId,
      patientId,
      payerId,
      rank,
      memberId,
      groupNumber,
      relationshipCode,
      assignmentOfBenefits: true,
      releaseOfInformation: 'Y',
    });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'coverage',
      resourceId: id,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { rank, memberId },
    });
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function createSoapNote(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const patientId = String(formData.get('patientId') ?? '');
  const serviceDate = String(formData.get('serviceDate') ?? '') || new Date().toISOString().slice(0, 10);
  const bp = String(formData.get('bp') ?? '');
  const [bpSystolic, bpDiastolic] = bp.split('/').map((v) => parseInt(v.trim(), 10));
  const toInt = (v: FormDataEntryValue | null) => {
    const n = parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  const toFloat = (v: FormDataEntryValue | null) => {
    const n = parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : null;
  };
  const subjective = String(formData.get('subjective') ?? '').trim();
  const objective = String(formData.get('objective') ?? '').trim();
  const primaryDiagnosisCode = String(formData.get('primaryIcd10') ?? '').trim().toUpperCase();
  const primaryDiagnosisDescription = String(formData.get('primaryDiagnosis') ?? '').trim();
  const plan = String(formData.get('plan') ?? '').trim();
  const signed = Boolean(formData.get('signed'));

  if (!subjective || !objective || !primaryDiagnosisCode || !primaryDiagnosisDescription || !plan) {
    return { ok: false, error: 'Subjective, objective, primary diagnosis, and plan are all required.' };
  }

  const { run, session } = await pageContext();
  const result = await run(`/patients/${patientId}`, async (ctx, phi) => {
    phi.touch([patientId], ['clinical']);

    const [patient] = await ctx.tx.select({ practiceId: schema.patients.practiceId }).from(schema.patients).where(eq(schema.patients.id, patientId));
    if (!patient) return { ok: false as const, error: 'Patient not found.' };

    const [note] = await ctx.tx
      .insert(schema.clinicalNotes)
      .values({
        orgId: ctx.tenant.orgId,
        practiceId: patient.practiceId,
        patientId,
        authorUserId: session.actor.userId,
        serviceDate,
        status: signed ? 'signed' : 'draft',
        bloodPressureSystolic: Number.isFinite(bpSystolic) ? bpSystolic : null,
        bloodPressureDiastolic: Number.isFinite(bpDiastolic) ? bpDiastolic : null,
        heartRate: toInt(formData.get('hr')),
        temperatureF: toFloat(formData.get('temp')),
        respiratoryRate: toInt(formData.get('rr')),
        spo2: toInt(formData.get('spo2')),
        weightLbs: toFloat(formData.get('weight')),
        heightInches: toFloat(formData.get('height')),
        subjective,
        objective,
        primaryDiagnosisCode,
        primaryDiagnosisDescription,
        plan,
        signedAt: signed ? new Date() : null,
      })
      .returning({ id: schema.clinicalNotes.id });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'clinical_note',
      resourceId: note!.id,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { primaryDiagnosisCode, signed },
    });

    return { ok: true as const };
  });

  try {
    const { addMockSoapNote } = await import('@/lib/mock-data');
    addMockSoapNote(patientId, {
      id: `soap-${Date.now()}`,
      serviceDate,
      authorName: 'Attending Clinician (Live Session)',
      status: signed ? 'signed' : 'draft',
      signedAt: signed ? new Date() : null,
      vitals: {
        bloodPressure: Number.isFinite(bpSystolic) && Number.isFinite(bpDiastolic) ? `${bpSystolic}/${bpDiastolic} mmHg` : '—',
        heartRate: toInt(formData.get('hr')) ? `${toInt(formData.get('hr'))} bpm` : '—',
        temperature: toFloat(formData.get('temp')) ? `${toFloat(formData.get('temp'))} °F` : '—',
        respiratoryRate: toInt(formData.get('rr')) ? `${toInt(formData.get('rr'))} /min` : '—',
        spo2: toInt(formData.get('spo2')) ? `${toInt(formData.get('spo2'))}%` : '—',
        weightLbs: toFloat(formData.get('weight')) ? `${toFloat(formData.get('weight'))} lbs` : '—',
        heightInches: toFloat(formData.get('height')) ? `${toFloat(formData.get('height'))} in` : '—',
      },
      subjective,
      objective,
      primaryDiagnosisCode,
      primaryDiagnosisDescription,
      plan,
    });
  } catch {}

  revalidatePath(`/patients/${patientId}`);
  return result && typeof result === 'object' && 'ok' in result ? result : { ok: true };
}

const DOCUMENT_KIND_BY_CATEGORY: Record<string, string> = {
  'Lab Report': 'lab_report',
  'Diagnostic Imaging': 'diagnostic_imaging',
  'Clinical Note': 'medical_record',
  'Consent & Legal': 'consent_form',
  'Insurance Card': 'insurance_card',
  'Intake Questionnaire': 'intake_form',
};

export async function uploadPatientDocument(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const patientId = String(formData.get('patientId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? 'General PHI');
  const file = formData.get('file');

  if (!title) return { ok: false, error: 'A document title is required.' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a file to upload.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'File is larger than the 25MB limit.' };

  const { run, session } = await pageContext();
  const result = await run(`/patients/${patientId}`, async (ctx, phi) => {
    phi.touch([patientId], ['clinical', 'demographics']);

    const [patient] = await ctx.tx.select({ practiceId: schema.patients.practiceId }).from(schema.patients).where(eq(schema.patients.id, patientId));
    if (!patient) return { ok: false as const, error: 'Patient not found.' };

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const docId = randomUUID();
    const storageKey = `org/${ctx.tenant.orgId}/patients/${patientId}/documents/${docId}`;
    const contentType = file.type || 'application/octet-stream';

    const { bucket } = await putObject({ key: storageKey, body: bytes, contentType });

    await ctx.tx.insert(schema.documents).values({
      id: docId,
      orgId: ctx.tenant.orgId,
      practiceId: patient.practiceId,
      storageKey,
      bucket,
      displayName: title,
      contentType,
      byteSize: bytes.byteLength,
      sha256,
      kind: DOCUMENT_KIND_BY_CATEGORY[category] ?? 'medical_record',
      uploadedBy: session.actor.userId,
    });

    await ctx.tx.insert(schema.documentLinks).values({ orgId: ctx.tenant.orgId, documentId: docId, patientId });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'document',
      resourceId: docId,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { title, category, byteSize: bytes.byteLength, sha256 },
    });

    return { ok: true as const };
  });

  try {
    const { addMockDocument } = await import('@/lib/mock-data');
    addMockDocument(patientId, {
      id: `doc-${Date.now()}`,
      title,
      category,
      mimeType: file.type || 'application/octet-stream',
      fileSizeKb: Math.ceil(file.size / 1024),
      storageKey: `patients/${patientId}/${category.toLowerCase().replace(/\s+/g, '_')}/${Date.now()}`,
      uploadedAt: new Date(),
      uploadedBy: 'Attending Clinician (Live Session)',
      confidentiality: 'standard_phi',
    });
  } catch {}

  revalidatePath(`/patients/${patientId}`);
  return result && typeof result === 'object' && 'ok' in result ? result : { ok: true };
}

/** A short-lived signed URL to view/download a document — never a public link. */
export async function getDocumentDownloadUrlAction(documentId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { run } = await pageContext();
  const result = await run(`/documents/${documentId}/download`, async (ctx, phi) => {
    const [doc] = await ctx.tx.select().from(schema.documents).where(eq(schema.documents.id, documentId));
    if (!doc) return { ok: false as const, error: 'Document not found.' };

    const [link] = await ctx.tx.select({ patientId: schema.documentLinks.patientId }).from(schema.documentLinks).where(eq(schema.documentLinks.documentId, documentId));
    if (link?.patientId) phi.touch([link.patientId], ['clinical']);

    try {
      const url = await getSignedDownloadUrl({ key: doc.storageKey, bucket: doc.bucket, downloadFilename: doc.displayName });
      return { ok: true as const, url };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'Object storage is unavailable.' };
    }
  });

  return result && typeof result === 'object' && 'ok' in result ? result : { ok: false, error: 'Unavailable in demo mode.' };
}

export async function mergePatientsAction(primaryPatientId: string, duplicatePatientId: string, notes?: string) {
  if (!primaryPatientId || !duplicatePatientId) {
    throw new Error('Both Primary and Duplicate patient records are required.');
  }
  if (primaryPatientId === duplicatePatientId) {
    throw new Error('Cannot merge a patient record into itself.');
  }

  const { run, session } = await pageContext();
  await run('/patients', async (ctx, phi) => {
    phi.touch([primaryPatientId, duplicatePatientId], ['demographics', 'clinical', 'financial']);

    // Re-link claims to primary patient
    await ctx.tx
      .update(schema.claims)
      .set({ patientId: primaryPatientId })
      .where(eq(schema.claims.patientId, duplicatePatientId));

    // Re-link coverages to primary patient
    await ctx.tx
      .update(schema.coverages)
      .set({ patientId: primaryPatientId })
      .where(eq(schema.coverages.patientId, duplicatePatientId));

    // Re-link payments to primary patient
    await ctx.tx
      .update(schema.payments)
      .set({ patientId: primaryPatientId })
      .where(eq(schema.payments.patientId, duplicatePatientId));

    // Re-link ledger entries to primary patient
    await ctx.tx
      .update(schema.ledgerEntries)
      .set({ patientId: primaryPatientId })
      .where(eq(schema.ledgerEntries.patientId, duplicatePatientId));

    // Mark duplicate patient as merged
    await ctx.tx
      .update(schema.patients)
      .set({
        mergedIntoPatientId: primaryPatientId,
        mergedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.patients.id, duplicatePatientId));

    // Audit log
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'patient',
      resourceId: primaryPatientId,
      patientId: primaryPatientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: {
        action: 'merge',
        survivorPatientId: primaryPatientId,
        subsumedPatientId: duplicatePatientId,
        notes: notes ?? 'Merged duplicate patient record',
      },
    });
  });

  try {
    const { mergeMockPatients } = await import('@/lib/mock-data');
    mergeMockPatients(primaryPatientId, duplicatePatientId);
  } catch {}

  revalidatePath('/patients');
  revalidatePath(`/patients/${primaryPatientId}`);
  revalidatePath(`/patients/${duplicatePatientId}`);
}

export interface ImportRowError { row: number; reason: string }
export interface ImportPatientsResult {
  ok: true;
  created: number;
  skippedDuplicates: number;
  errors: ImportRowError[];
}

const IMPORT_COLUMNS = ['firstname', 'lastname', 'dateofbirth', 'sex', 'email', 'phone', 'mrn', 'payername', 'memberid', 'openingbalance'] as const;

/**
 * Migrate patients from another practice-management system via CSV. Deliberately
 * pragmatic rather than exhaustive: demographics, an optional primary coverage (payer
 * matched by name), and an optional opening balance posted as a single ledger entry —
 * carrying forward existing AR without re-keying every historical claim, which is the
 * part of a legacy-system migration nobody has time to do by hand.
 */
export async function importPatientsCsvAction(csvText: string, practiceId: string): Promise<ImportPatientsResult | { ok: false; error: string }> {
  if (!practiceId) return { ok: false, error: 'Select a practice.' };
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { ok: false, error: 'The file needs a header row and at least one data row.' };

  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
  const col = (name: (typeof IMPORT_COLUMNS)[number]) => header.indexOf(name);
  const idx = { first: col('firstname'), last: col('lastname'), dob: col('dateofbirth'), sex: col('sex'), email: col('email'), phone: col('phone'), mrn: col('mrn'), payer: col('payername'), member: col('memberid'), balance: col('openingbalance') };
  if (idx.first < 0 || idx.last < 0 || idx.dob < 0) {
    return { ok: false, error: 'The header row must include at least firstName, lastName, and dateOfBirth columns.' };
  }

  const { run, session } = await pageContext();
  const result = await run('/patients/import', async (ctx, phi) => {
    let created = 0;
    let skippedDuplicates = 0;
    const errors: ImportRowError[] = [];
    const payerCache = new Map<string, { id: string } | null>();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!;
      const rowNum = i + 1; // 1-based, header is row 1
      const firstName = r[idx.first]?.trim();
      const lastName = r[idx.last]?.trim();
      const dob = r[idx.dob]?.trim();
      if (!firstName || !lastName || !dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        errors.push({ row: rowNum, reason: 'Missing or malformed firstName/lastName/dateOfBirth (expected YYYY-MM-DD).' });
        continue;
      }

      try {
        const duplicates = await ctx.tx
          .select({ id: schema.patients.id })
          .from(schema.patients)
          .where(and(eq(schema.patients.practiceId, practiceId), sql`lower(${schema.patients.firstName}) = lower(${firstName})`, sql`lower(${schema.patients.lastName}) = lower(${lastName})`, eq(schema.patients.dateOfBirth, dob)));
        if (duplicates.length > 0) {
          skippedDuplicates++;
          continue;
        }

        const sexRaw = (idx.sex >= 0 ? r[idx.sex]?.trim().toUpperCase() : '') || 'U';
        const sex = (['M', 'F', 'U'].includes(sexRaw) ? sexRaw : 'U') as 'M' | 'F' | 'U';
        const email = idx.email >= 0 ? r[idx.email]?.trim() || null : null;
        const phone = idx.phone >= 0 ? r[idx.phone]?.trim() || null : null;
        const requestedMrn = idx.mrn >= 0 ? r[idx.mrn]?.trim() : '';
        const mrn = requestedMrn || `MRN${Math.floor(100000 + Math.random() * 900000)}`;
        const patientId = randomUUID();

        await ctx.tx.insert(schema.patients).values({ id: patientId, orgId: ctx.tenant.orgId, practiceId, mrn, firstName, lastName, dateOfBirth: dob, sex, email, phoneMobile: phone });
        phi.touch([patientId], ['demographics']);

        // Optional primary coverage, matched by payer name.
        const payerName = idx.payer >= 0 ? r[idx.payer]?.trim() : '';
        const memberId = idx.member >= 0 ? r[idx.member]?.trim() : '';
        if (payerName && memberId) {
          const key = payerName.toLowerCase();
          if (!payerCache.has(key)) {
            const [match] = await ctx.tx.select({ id: schema.payers.id }).from(schema.payers).where(sql`lower(${schema.payers.name}) = ${key}`);
            payerCache.set(key, match ?? null);
          }
          const payer = payerCache.get(key);
          if (payer) {
            await ctx.tx.insert(schema.coverages).values({ orgId: ctx.tenant.orgId, patientId, payerId: payer.id, rank: 'primary', memberId, relationshipCode: '18', active: true });
          } else {
            errors.push({ row: rowNum, reason: `Patient created, but payer "${payerName}" was not found — no coverage added.` });
          }
        }

        // Optional opening balance — carries forward existing AR as one ledger entry.
        const balanceRaw = idx.balance >= 0 ? r[idx.balance]?.trim() : '';
        const openingBalanceCents = balanceRaw ? Math.round((Number(balanceRaw) || 0) * 100) : 0;
        if (openingBalanceCents > 0) {
          const today = ctx.now().toISOString().slice(0, 10);
          await postLedger(ctx, [{ practiceId, patientId, entryType: 'transfer_to_patient', amountCents: openingBalanceCents, responsibility: 'patient', postingDate: today, serviceDate: today, sourceType: 'migration_import', sourceId: patientId, note: 'Opening balance carried forward from prior system' }]);
        }

        created++;
      } catch (err) {
        errors.push({ row: rowNum, reason: (err as Error).message.slice(0, 200) });
      }
    }

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId, action: 'create', resourceType: 'patient', resourceId: practiceId,
      actorUserId: session.actor.userId, sessionId: session.sessionId, requestId: ctx.tenant.requestId,
      context: { bulkImport: true, created, skippedDuplicates, errorCount: errors.length },
    });

    return { ok: true as const, created, skippedDuplicates, errors: errors.slice(0, 50) };
  });

  revalidatePath('/patients');
  return result ?? { ok: false, error: 'Database unavailable — the import could not run.' };
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, and CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

