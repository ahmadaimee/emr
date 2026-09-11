import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { demoLoginAction, loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await getSession();
  if (s?.mfaSatisfied) redirect('/dashboard');
  const { error } = await searchParams;
  const message =
    error === 'invalid_credentials'
      ? 'That email and password combination is not recognised.'
      : error === 'locked'
        ? 'Too many attempts. Try again in 15 minutes.'
        : error === 'inactive'
          ? 'This account is not active. Contact your administrator.'
          : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 26 26" aria-hidden>
            <rect x="1" y="1" width="24" height="24" rx="6" fill="var(--g-grove-700)" />
            <path
              d="M13 5.5c-3.6 0-6.5 2.7-6.5 6.2 0 2.9 2 5.2 4.9 5.9v3.4h3.2v-3.4c2.9-.7 4.9-3 4.9-5.9 0-3.5-2.9-6.2-6.5-6.2zm0 2.6c2.1 0 3.8 1.6 3.8 3.6S15.1 15.3 13 15.3s-3.8-1.6-3.8-3.6S10.9 8.1 13 8.1z"
              fill="var(--g-surface)"
            />
          </svg>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">PracticeOS</div>
            <div className="text-xs text-ink-3">Practice management & autonomous RCM</div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-line bg-surface-raised p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Interactive Operator Preview</div>
          <p className="mt-1 text-xs text-ink-2">
            Explore work queues, claims scrubbing, 835 balancing, real-time 270/271 eligibility, and audit logs.
          </p>
          <form action={demoLoginAction} className="mt-3">
            <button className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-grove text-sm font-medium text-ink-inverse shadow hover:bg-grove-strong transition-colors">
              <span>Enter Live Demo Experience</span>
            </button>
          </form>
        </div>

        <form action={loginAction} className="space-y-4 rounded-lg border border-line bg-surface-raised p-6 shadow-sm">
          <div className="text-xs font-medium text-ink-3">Or sign in with practice credentials</div>
          {message ? <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{message}</div> : null}
          <label className="block">
            <span className="text-xs font-medium text-ink-3">Organisation</span>
            <input
              name="org"
              defaultValue={process.env.NEXT_PUBLIC_DEFAULT_ORG ?? 'orchard'}
              required
              className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              autoComplete="organization"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-3">Email</span>
            <input
              name="email"
              type="email"
              defaultValue="admin@grove.internal"
              required
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-3">Password</span>
            <input
              name="password"
              type="password"
              defaultValue="password123"
              required
              className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              autoComplete="current-password"
            />
          </label>
          <button className="h-9 w-full rounded-md border border-line-strong bg-surface-sunken text-sm font-medium text-ink hover:bg-line transition-colors">
            Sign In
          </button>
          <p className="text-center text-[11px] text-ink-4">Sessions end after 15 minutes of inactivity. Access is logged.</p>
        </form>
      </div>
    </div>
  );
}
