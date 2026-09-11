'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';
import { APPOINTMENT_TYPES } from '@/lib/schedule';

export interface BookAppointmentInput {
  providerId: string;
  patientId: string;
  type: string;
  reason: string;
  start: string;
  date: string;
  copayCents: number;
}

export async function bookAppointmentAction(input: BookAppointmentInput) {
  const { run, session } = await pageContext();

  const result = await run('/schedule', async (ctx) => {
    const [patient] = await ctx.tx.select({ practiceId: schema.patients.practiceId }).from(schema.patients).where(eq(schema.patients.id, input.patientId));
    if (!patient) throw new Error('Patient not found');
    const [provider] = await ctx.tx.select({ id: schema.providers.id }).from(schema.providers).where(eq(schema.providers.id, input.providerId));
    if (!provider) throw new Error('Provider not found');

    const t = APPOINTMENT_TYPES.find((x) => x.code === input.type) ?? APPOINTMENT_TYPES[1]!;
    const [h, m] = input.start.split(':').map(Number);
    const startMinutes = (h ?? 9) * 60 + (m ?? 0);

    const [appt] = await ctx.tx
      .insert(schema.appointments)
      .values({
        orgId: ctx.tenant.orgId,
        practiceId: patient.practiceId,
        providerId: input.providerId,
        patientId: input.patientId,
        appointmentDate: input.date,
        startMinutes,
        durationMinutes: t.minutes,
        type: input.type as any,
        reason: input.reason || null,
        expectedCopayCents: input.copayCents || null,
        createdBy: session.actor.userId,
      })
      .returning({ id: schema.appointments.id });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'appointment',
      resourceId: appt!.id,
      patientId: input.patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { providerId: input.providerId, date: input.date, start: input.start, type: input.type },
    });

    return { id: appt!.id };
  });

  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  return result;
}

export async function setAppointmentStatusAction(id: string, status: string) {
  const { run, session } = await pageContext();

  await run('/schedule', async (ctx) => {
    await ctx.tx.update(schema.appointments).set({ status: status as any, updatedAt: new Date() }).where(eq(schema.appointments.id, id));

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'appointment',
      resourceId: id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { status },
    });
  });

  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}
