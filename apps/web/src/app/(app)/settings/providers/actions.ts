'use server';

import { revalidatePath } from 'next/cache';
import { isValidNpi } from '@grove/rules';
import { appendAuditEvent } from '@grove/audit';
import { pageContext } from '@/lib/session';
import {
  deleteMockProvider,
  getMockProviderReferences,
  setMockProviderStatus,
  updateMockProvider,
} from '@/lib/mock-data';

export interface ProviderPatch {
  firstName: string;
  lastName: string;
  credentials: string;
  npi: string;
  taxonomyCode: string;
  taxonomyDescription: string;
  licenseNumber: string;
  licenseState: string;
  deaNumber: string;
  email: string;
  phone: string;
  billingRole: string;
  acceptingNewPatients: boolean;
  practiceNames: string[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

async function audit(
  route: string,
  action: 'update' | 'delete',
  resourceId: string,
  context: Record<string, unknown>,
) {
  const { run, session } = await pageContext();
  await run(route, async (ctx) => {
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action,
      resourceType: 'provider',
      resourceId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context,
    });
  });
}

export async function updateProviderAction(id: string, patch: ProviderPatch): Promise<ActionResult> {
  if (!patch.firstName.trim() || !patch.lastName.trim()) {
    return { ok: false, error: 'First and last name are required.' };
  }

  // The NPI carries a check digit (Luhn over the 80840-prefixed identifier). Rejecting a
  // malformed one here is far cheaper than a payer rejecting every claim that quotes it.
  const npi = patch.npi.trim();
  if (!isValidNpi(npi)) {
    return { ok: false, error: `${npi || 'NPI'} is not a valid NPI — the check digit does not match.` };
  }

  updateMockProvider(id, {
    firstName: patch.firstName.trim(),
    lastName: patch.lastName.trim(),
    credentials: patch.credentials.trim(),
    npi,
    taxonomyCode: patch.taxonomyCode.trim(),
    taxonomyDescription: patch.taxonomyDescription.trim(),
    licenseNumber: patch.licenseNumber.trim(),
    licenseState: patch.licenseState.trim().toUpperCase(),
    deaNumber: patch.deaNumber.trim(),
    email: patch.email.trim(),
    phone: patch.phone.trim(),
    billingRole: patch.billingRole,
    acceptingNewPatients: patch.acceptingNewPatients,
    practiceNames: patch.practiceNames,
  });

  // The NPI and billing role are what payers see, so they are named in the audit row.
  await audit('/settings/providers', 'update', id, {
    npi,
    billingRole: patch.billingRole,
    practices: patch.practiceNames.length,
  });

  revalidatePath('/settings/providers');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function setProviderStatusAction(id: string, status: string): Promise<ActionResult> {
  const provider = setMockProviderStatus(id, status);
  if (!provider) return { ok: false, error: 'Provider not found.' };

  await audit('/settings/providers', 'update', id, { status });

  revalidatePath('/settings/providers');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function deleteProviderAction(id: string): Promise<ActionResult> {
  const refs = getMockProviderReferences(id);
  const result = deleteMockProvider(id);

  if (!result.ok) {
    if (result.reason === 'referenced') {
      const parts = [
        refs.claims ? `${refs.claims} claim${refs.claims === 1 ? '' : 's'}` : null,
        refs.appointments ? `${refs.appointments} appointment${refs.appointments === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      return {
        ok: false,
        error: `Still referenced by ${parts.join(' and ')}. Those records must keep resolving for appeals and corrected claims — set the provider to Terminated instead.`,
      };
    }
    return { ok: false, error: 'Provider not found.' };
  }

  await audit('/settings/providers', 'delete', id, { hadReferences: false });

  revalidatePath('/settings/providers');
  revalidatePath('/schedule');
  return { ok: true };
}

/**
 * The full credentialing record, saved from the provider edit page. Unlike the quick
 * inline edit this accepts every field, so it validates the ones a payer will reject on
 * rather than trusting the form.
 */
export async function saveProviderAction(id: string, patch: Record<string, any>): Promise<ActionResult> {
  if (!String(patch.firstName ?? '').trim() || !String(patch.lastName ?? '').trim()) {
    return { ok: false, error: 'First and last name are required.' };
  }

  const npi = String(patch.npi ?? '').trim();
  if (!isValidNpi(npi)) {
    return { ok: false, error: `${npi || 'NPI'} is not a valid NPI — the check digit does not match.` };
  }
  // The group NPI goes in box 33 on every claim this provider bills, so it gets the
  // same check rather than being trusted because it is "just" a reference.
  const groupNpi = String(patch.groupNpi ?? '').trim();
  if (groupNpi && !isValidNpi(groupNpi)) {
    return { ok: false, error: `${groupNpi} is not a valid group NPI — the check digit does not match.` };
  }

  const taxId = String(patch.taxId ?? '').replace(/\D/g, '');
  if (taxId && taxId.length !== 9) {
    return { ok: false, error: 'A federal tax ID is nine digits.' };
  }

  // A DEA number is two letters then seven digits, and the last digit is a checksum.
  const dea = String(patch.deaNumber ?? '').trim().toUpperCase();
  if (dea && !isValidDea(dea)) {
    return { ok: false, error: `${dea} is not a valid DEA number — check the format and the last digit.` };
  }

  if (patch.employmentEndDate && patch.employmentStartDate && patch.employmentEndDate < patch.employmentStartDate) {
    return { ok: false, error: 'The employment end date cannot precede the start date.' };
  }

  updateMockProvider(id, { ...patch, npi, groupNpi, taxId, deaNumber: dea });

  await audit('/settings/providers', 'update', id, {
    npi,
    billingRole: patch.billingRole,
    licenseExpiresOn: patch.licenseExpiresOn,
    deaExpiresOn: patch.deaExpiresOn,
    fields: Object.keys(patch).length,
  });

  revalidatePath('/settings/providers');
  revalidatePath(`/settings/providers/${id}`);
  revalidatePath('/schedule');
  return { ok: true };
}

/**
 * DEA check digit: sum digits 1,3,5 plus twice the sum of digits 2,4,6; the last digit
 * of that total is the check digit. The first letter identifies the registrant type and
 * the second is the registrant's last initial, which is not verified here.
 */
function isValidDea(dea: string): boolean {
  if (!/^[A-Z]{2}\d{7}$/.test(dea)) return false;
  const d = dea.slice(2).split('').map(Number);
  const sum = d[0]! + d[2]! + d[4]! + 2 * (d[1]! + d[3]! + d[5]!);
  return sum % 10 === d[6]!;
}
