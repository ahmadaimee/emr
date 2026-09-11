'use server';

import { revalidatePath } from 'next/cache';
import { DomainError, generateStatementRunCommand, sendStatementsCommand } from '@grove/domain';
import { pageContext } from '@/lib/session';

export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? {} : { data: T })) | { ok: false; error: string };

export async function generateStatementRunAction(input: { practiceId: string; minimumBalanceCents: number; dueInDays: number }): Promise<ActionResult<{ statementCount: number; totalBalanceCents: number }>> {
  if (!input.practiceId) return { ok: false, error: 'Select a practice.' };

  const { run } = await pageContext();
  const result = await run('/statements/generate', async (ctx) => {
    try {
      const res = await generateStatementRunCommand(ctx, input);
      return { ok: true as const, data: { statementCount: res.statementCount, totalBalanceCents: res.totalBalanceCents } };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to generate the statement run.' };
    }
  });

  if (result?.ok) {
    revalidatePath('/statements');
    return result;
  }
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function sendStatementsAction(statementIds: string[]): Promise<ActionResult<{ sent: number }>> {
  const { run } = await pageContext();
  const result = await run('/statements/send', async (ctx) => {
    try {
      const res = await sendStatementsCommand(ctx, statementIds);
      return { ok: true as const, data: { sent: res.sent } };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to send statements.' };
    }
  });

  if (result?.ok) {
    revalidatePath('/statements');
    revalidatePath('/patients');
    return result;
  }
  return result ?? { ok: false, error: 'Database unavailable.' };
}
