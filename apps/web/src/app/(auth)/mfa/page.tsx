import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { mfaAction } from '../login/actions';
import { enrolTotpAction, confirmTotpAction } from './actions';
import { withTenant, schema, eq, and } from '@grove/db';

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ error?: string; enrol?: string }> }) {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.mfaSatisfied) redirect('/dashboard');
  const { error, enrol } = await searchParams;

  const enrolled = await withTenant(s.tenant, async (tx) => {
    const rows = await tx.select({ id: schema.mfaMethods.id }).from(schema.mfaMethods).where(and(eq(schema.mfaMethods.userId, s.actor.userId), eq(schema.mfaMethods.type, 'totp')));
    return rows.length > 0;
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface-raised p-6 shadow-sm">
        {enrolled ? (
          <form action={mfaAction} className="space-y-4">
            <div>
              <h1 className="font-display text-lg font-semibold">Verification code</h1>
              <p className="mt-1 text-sm text-ink-3">Enter the six-digit code from your authenticator app, or a recovery code.</p>
            </div>
            {error ? <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">That code was not accepted.</div> : null}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-center font-mono text-xl tracking-[0.3em]" />
            <button className="h-9 w-full rounded-md bg-grove text-sm font-medium text-ink-inverse hover:bg-grove-strong">Verify</button>
          </form>
        ) : enrol ? (
          <EnrolStep uri={decodeURIComponent(enrol)} />
        ) : (
          <form action={enrolTotpAction} className="space-y-4">
            <div>
              <h1 className="font-display text-lg font-semibold">Set up multi-factor authentication</h1>
              <p className="mt-1 text-sm text-ink-3">PracticeOS requires an authenticator app for every account. This takes about a minute.</p>
            </div>
            <button className="h-9 w-full rounded-md bg-grove text-sm font-medium text-ink-inverse hover:bg-grove-strong">Begin setup</button>
          </form>
        )}
      </div>
    </div>
  );
}

function EnrolStep({ uri }: { uri: string }) {
  const secret = new URL(uri).searchParams.get('secret') ?? '';
  return (
    <form action={confirmTotpAction} className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-semibold">Add PracticeOS to your authenticator</h1>
        <p className="mt-1 text-sm text-ink-3">Open your authenticator app and add an account with this key, then enter the code it shows.</p>
      </div>
      <div className="rounded-md border border-line bg-surface p-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-3">Setup key</div>
        <div className="mt-1 break-all font-mono text-sm">{secret.match(/.{1,4}/g)?.join(' ')}</div>
        <a href={uri} className="mt-2 inline-block text-xs text-grove underline">Open in authenticator app</a>
      </div>
      <input type="hidden" name="uri" value={uri} />
      <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required placeholder="123 456" className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-center font-mono text-xl tracking-[0.3em]" />
      <button className="h-9 w-full rounded-md bg-grove text-sm font-medium text-ink-inverse hover:bg-grove-strong">Confirm and continue</button>
    </form>
  );
}
