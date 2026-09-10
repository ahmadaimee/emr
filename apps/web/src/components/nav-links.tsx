'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: Array<{ href: string; label: string; key: string; badge?: 'tasks' }> = [
  { href: '/dashboard', label: 'Dashboard', key: 'D' },
  { href: '/queues', label: 'Work queues', key: 'Q', badge: 'tasks' },
  { href: '/claims', label: 'Claims', key: 'C' },
  { href: '/remittances', label: 'Remittances', key: 'R' },
  { href: '/payments', label: 'Payments', key: 'Y' },
  { href: '/eligibility', label: 'Eligibility', key: 'E' },
  { href: '/patients', label: 'Patients & EHR', key: 'P' },
  { href: '/reports', label: 'Reports', key: '' },
];

const SETTINGS = [
  { href: '/settings/automation', label: 'Automation' },
  { href: '/settings/rules', label: 'Rules' },
  { href: '/settings/audit', label: 'Audit log' },
  { href: '/settings/users', label: 'Users & roles' },
];

export function NavLinks({ openTasks }: { openTasks: number }) {
  const path = usePathname();
  const item = (href: string, label: string, extra?: React.ReactNode) => {
    const active = path === href || (href !== '/dashboard' && path.startsWith(href));
    return (
      <Link key={href} href={href} className={`group flex h-8 items-center justify-between rounded-md px-2.5 text-sm ${active ? 'bg-grove-soft font-medium text-grove-strong' : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'}`}>
        <span>{label}</span>
        {extra}
      </Link>
    );
  };
  return (
    <>
      <div className="space-y-0.5">
        {NAV.map((n) =>
          item(
            n.href,
            n.label,
            n.badge === 'tasks' && openTasks > 0 ? (
              <span className="rounded-sm bg-clay-soft px-1.5 text-[11px] font-semibold text-clay">{openTasks}</span>
            ) : n.key ? (
              <span className="g-kbd opacity-0 transition-opacity group-hover:opacity-100">G {n.key}</span>
            ) : null,
          ),
        )}
      </div>
      <div className="mt-5 px-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-4">Settings</div>
      <div className="mt-1 space-y-0.5">{SETTINGS.map((s) => item(s.href, s.label))}</div>
    </>
  );
}
