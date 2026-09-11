import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABEL, money, statusTone } from '@/lib/format';

/** Money is ink. Always tabular. Only a non-zero variance gets a colour. */
export function Money({ cents, variance = false, className = '' }: { cents: number | null | undefined; variance?: boolean; className?: string }) {
  const tone = variance && cents ? (cents > 0 ? 'text-danger' : 'text-ok') : '';
  return <span className={`g-num ${tone} ${className}`}>{money(cents, { sign: variance })}</span>;
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="g-mono text-ink-2">{children}</span>;
}

const TONE: Record<ReturnType<typeof statusTone>, string> = {
  neutral: 'bg-surface-sunken text-ink-2 border-line',
  ok: 'bg-ok-soft text-ok border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-none ${TONE[statusTone(status)]}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Severity({ severity }: { severity: string }) {
  const cls = severity === 'error' ? 'bg-danger text-ink-inverse' : severity === 'warning' ? 'bg-warn text-ink-inverse' : 'bg-info-soft text-info';
  return <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{severity}</span>;
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  variant = 'secondary',
  className = '',
  badge,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'danger' | 'warn' | 'ok' | 'info';
  variant?: 'primary' | 'secondary';
  className?: string;
  badge?: string;
}) {
  const t =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warn'
      ? 'text-warn'
      : tone === 'ok'
      ? 'text-ok'
      : tone === 'info'
      ? 'text-info'
      : 'text-ink';

  const isPrimary = variant === 'primary';

  return (
    <div
      className={`flex flex-col justify-between rounded-xl border ${
        isPrimary
          ? 'border-grove/50 bg-surface-raised shadow-xs ring-1 ring-grove/20'
          : 'border-line bg-surface-raised/90 shadow-xs'
      } p-3 transition-all hover:border-line-strong hover:bg-surface-raised sm:p-3.5 ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-1">
          <span
            className={`text-[10px] font-medium uppercase tracking-wide ${
              isPrimary ? 'text-grove-strong font-semibold' : 'text-ink-3'
            }`}
          >
            {label}
          </span>
          {badge ? (
            <span
              className={`rounded px-1.5 py-0.2 text-[8px] font-medium ${
                isPrimary
                  ? 'bg-grove-soft text-grove-strong font-semibold'
                  : 'bg-surface-sunken text-ink-3'
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className={`mt-1 font-display text-lg font-semibold tracking-tight g-num sm:text-xl ${t}`}>
          {value}
        </div>
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-ink-3 truncate" title={typeof hint === 'string' ? hint : undefined}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({ children, variant = 'secondary', className = '', ...rest }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-[var(--g-dur-fast)] disabled:opacity-50 disabled:cursor-not-allowed';
  const v = {
    primary: 'bg-grove text-ink-inverse hover:bg-grove-strong',
    secondary: 'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken',
    danger: 'border border-danger/40 bg-surface-raised text-danger hover:bg-danger-soft',
    ghost: 'text-ink-2 hover:bg-surface-sunken',
  }[variant];
  return (
    <button className={`${base} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = 'secondary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const base = 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors';
  const v = { primary: 'bg-grove text-ink-inverse hover:bg-grove-strong', secondary: 'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken', ghost: 'text-ink-2 hover:bg-surface-sunken' }[variant];
  return (
    <Link href={href} className={`${base} ${v}`}>
      {children}
    </Link>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <div className="font-medium text-ink-2">{title}</div>
      {body ? <div className="mt-1 text-sm text-ink-3">{body}</div> : null}
    </div>
  );
}

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface-raised shadow-sm ${className}`}>
      {title ? (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div>{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export const inputCls = 'h-8 w-full rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-grove';
export const selectCls = inputCls;
