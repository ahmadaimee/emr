'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { and, eq, schema, sql } from '@grove/db';
import { pageContext } from '@/lib/session';

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
    phi.touch([patientId], ['insurance']);
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

export async function createSoapNote(formData: FormData) {
  const patientId = String(formData.get('patientId') ?? '');
  const bp = String(formData.get('bp') ?? '');
  const hr = String(formData.get('hr') ?? '');
  const temp = String(formData.get('temp') ?? '');
  const rr = String(formData.get('rr') ?? '');
  const spo2 = String(formData.get('spo2') ?? '');
  const weight = String(formData.get('weight') ?? '');
  const height = String(formData.get('height') ?? '');
  const subjective = String(formData.get('subjective') ?? '');
  const objective = String(formData.get('objective') ?? '');
  const primaryIcd10 = String(formData.get('primaryIcd10') ?? '');
  const primaryDiagnosis = String(formData.get('primaryDiagnosis') ?? '');
  const plan = String(formData.get('plan') ?? '');
  const signed = Boolean(formData.get('signed'));

  const { run, session } = await pageContext();
  await run(`/patients/${patientId}`, async (ctx, phi) => {
    phi.touch([patientId], ['clinical']);
    const noteId = randomUUID();

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'clinical_note',
      resourceId: noteId,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { primaryIcd10, signed },
    });
  });

  try {
    const { addMockSoapNote } = await import('@/lib/mock-data');
    addMockSoapNote(patientId, {
      id: `soap-${Date.now()}`,
      encounterDate: new Date().toISOString().split('T')[0],
      providerName: 'Dr. Marcus Vance, MD',
      providerNpi: '1487654321',
      status: signed ? 'signed_and_locked' : 'draft',
      signedAt: signed ? new Date() : null,
      vitals: {
        bloodPressure: bp || '120/80 mmHg',
        heartRate: hr ? `${hr} bpm` : '72 bpm',
        temperature: temp ? `${temp} °F` : '98.6 °F',
        respiratoryRate: rr ? `${rr} /min` : '16 /min',
        spo2: spo2 ? `${spo2}% on room air` : '99% on room air',
        weightLbs: weight ? `${weight} lbs` : '150 lbs',
        heightInches: height ? `${height} in` : '68 in',
        bmi: '22.8',
      },
      subjective: {
        chiefComplaint: subjective || 'Patient follow-up encounter.',
        hpi: subjective,
        ros: 'Constitutional: No fever, no acute distress.',
      },
      objective: {
        exam: objective || 'Physical examination unremarkable. Vital signs stable.',
      },
      assessment: [
        {
          icd10: primaryIcd10 || 'Z00.00',
          description: primaryDiagnosis || 'Encounter for general adult medical examination',
          status: 'primary',
        },
      ],
      plan: {
        medications: 'Continue prescribed maintenance medications.',
        orders: 'Routine clinical monitoring.',
        instructions: plan || 'Follow-up in 3 weeks or PRN worsening symptoms.',
      },
    });
  } catch {}

  revalidatePath(`/patients/${patientId}`);
}

export async function uploadPatientDocument(formData: FormData) {
  const patientId = String(formData.get('patientId') ?? '');
  const title = String(formData.get('title') ?? 'Untitled Document');
  const category = String(formData.get('category') ?? 'General PHI');

  const { run, session } = await pageContext();
  await run(`/patients/${patientId}`, async (ctx, phi) => {
    phi.touch([patientId], ['clinical', 'demographics']);
    const docId = randomUUID();

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'document',
      resourceId: docId,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { title, category },
    });
  });

  try {
    const { addMockDocument } = await import('@/lib/mock-data');
    addMockDocument(patientId, {
      id: `doc-${Date.now()}`,
      title,
      category,
      mimeType: 'application/pdf',
      fileSizeKb: Math.floor(100 + Math.random() * 400),
      storageKey: `patients/${patientId}/${category.toLowerCase().replace(/\s+/g, '_')}/${Date.now()}.pdf`,
      uploadedAt: new Date(),
      uploadedBy: 'Attending Clinician (Live Session)',
      confidentiality: 'standard_phi',
    });
  } catch {}

  revalidatePath(`/patients/${patientId}`);
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
        status: 'merged' as any,
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

