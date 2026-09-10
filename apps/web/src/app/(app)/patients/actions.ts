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
