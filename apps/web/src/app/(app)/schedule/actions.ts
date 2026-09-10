'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { pageContext } from '@/lib/session';
import { addMockAppointment, setMockAppointmentStatus } from '@/lib/mock-data';

export interface BookAppointmentInput {
  providerId: string;
  type: string;
  patientName: string;
  reason: string;
  start: string;
  date: string;
  payer: string;
  copayCents: number;
}

export async function bookAppointmentAction(input: BookAppointmentInput) {
  const { run, session } = await pageContext();

  const appt = addMockAppointment(input);

  // Booking is a mutating action against a patient's record, so it is audited like any
  // other. The note deliberately carries no clinical detail — see the PHI rules.
  await run('/schedule', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'appointment',
      resourceId: appt.id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { providerId: input.providerId, date: input.date, start: input.start, type: input.type },
    });
  });

  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  return { id: appt.id };
}

export async function setAppointmentStatusAction(id: string, status: string) {
  const { run, session } = await pageContext();

  setMockAppointmentStatus(id, status);

  await run('/schedule', async (ctx) => {
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
