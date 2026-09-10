'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { pageContext } from '@/lib/session';
import { addMockFeeSchedule, addMockCptCode, addMockDxCode } from '@/lib/mock-data';

export async function createFeeScheduleAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const scheduleType = String(formData.get('scheduleType') ?? 'allowed');
  const payerName = String(formData.get('payerName') ?? '').trim();
  const effectiveDate = String(formData.get('effectiveDate') ?? new Date().toISOString().split('T')[0]);
  const notes = String(formData.get('notes') ?? '');

  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'fee_schedule',
      resourceId: `fs-${Date.now()}`,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { name, scheduleType, payerName, effectiveDate },
    });
  });

  addMockFeeSchedule({ name, scheduleType, payerName, effectiveDate, notes });
  revalidatePath('/settings/fee-schedules');
}

export async function createCptCodeAction(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const codeSystem = String(formData.get('codeSystem') ?? 'CPT');
  const description = String(formData.get('description') ?? '').trim();
  const category = String(formData.get('category') ?? 'Evaluation & Management');
  const globalDays = String(formData.get('globalDays') ?? '0');
  const isAddOn = formData.get('isAddOn') === 'on' || formData.get('isAddOn') === 'true';
  const workRvu = Number(formData.get('workRvu') ?? 1.0);
  const totalRvu = Number(formData.get('totalRvu') ?? 2.5);
  const charge = Number(formData.get('charge') ?? 150);

  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'procedure_code',
      resourceId: code,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { code, description, charge, workRvu },
    });
  });

  addMockCptCode({ code, codeSystem, description, category, globalDays, isAddOn, workRvu, totalRvu, charge });
  revalidatePath('/settings/fee-schedules');
}

export async function createDxCodeAction(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const description = String(formData.get('description') ?? '').trim();
  const category = String(formData.get('category') ?? 'General Medicine');
  const validAsPrincipal = formData.get('validAsPrincipal') === 'on' || formData.get('validAsPrincipal') === 'true';
  const favorite = formData.get('favorite') === 'on' || formData.get('favorite') === 'true';
  const dualCodingNote = String(formData.get('dualCodingNote') ?? '');

  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'diagnosis_code',
      resourceId: code,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { code, description, category, favorite },
    });
  });

  addMockDxCode({ code, description, category, validAsPrincipal, favorite, dualCodingNote });
  revalidatePath('/settings/fee-schedules');
}

export async function setDefaultFeeScheduleAction(id: string) {
  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'fee_schedule',
      resourceId: id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { isDefault: true },
    });
  });

  const { setDefaultFeeSchedule } = await import('@/lib/mock-data');
  setDefaultFeeSchedule(id);
  revalidatePath('/settings/fee-schedules');
}

export async function updateFeeScheduleTenureAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const payerName = String(formData.get('payerName') ?? '').trim();
  const scheduleType = String(formData.get('scheduleType') ?? 'allowed');
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const terminationDate = String(formData.get('terminationDate') ?? '') || null;
  const isDefault = formData.get('isDefault') === 'on' || formData.get('isDefault') === 'true';
  const notes = String(formData.get('notes') ?? '');

  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'fee_schedule',
      resourceId: id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { effectiveDate, terminationDate, isDefault, name, payerName },
    });
  });

  const { updateFeeScheduleTenure } = await import('@/lib/mock-data');
  updateFeeScheduleTenure(id, {
    name,
    payerName,
    scheduleType,
    effectiveDate,
    terminationDate,
    isDefault,
    notes,
  });
  revalidatePath('/settings/fee-schedules');
}

export async function cloneFeeScheduleAction(id: string) {
  const { run, session } = await pageContext();

  await run('/settings/fee-schedules', async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'fee_schedule',
      resourceId: `fs-clone-${Date.now()}`,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { clonedFrom: id },
    });
  });

  const { cloneMockFeeSchedule } = await import('@/lib/mock-data');
  const cloned = cloneMockFeeSchedule(id);
  revalidatePath('/settings/fee-schedules');
  return cloned?.id;
}


