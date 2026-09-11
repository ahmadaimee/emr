import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommandPalette } from './command-palette';
import { NavLinks } from './nav-links';
import { ThemeToggle } from './theme-toggle';

export function Shell({ children, user, org, openTasks }: { children: ReactNode; user: { name: string; email: string }; org: { name: string }; openTasks: number }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface-raised">
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold tracking-tight">PracticeOS</div>
            <div className="truncate text-[11px] text-ink-3">{org.name}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <NavLinks openTasks={openTasks} />
        </nav>
        <div className="border-t border-line px-3 py-3">
          <button className="flex w-full items-center justify-between rounded-md border border-line px-2.5 py-1.5 text-left text-xs text-ink-3 hover:bg-surface-sunken" data-open-palette>
            <span>Search or jump…</span>
            <span className="g-kbd">⌘K</span>
          </button>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-ink-3">{user.email}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <form action="/logout" method="post">
                <button className="rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-surface-sunken hover:text-ink" title="Sign out">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1920px] px-6 py-5">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="24" height="24" rx="6" fill="var(--g-grove-700)" />
      <path d="M13 5.5c-3.6 0-6.5 2.7-6.5 6.2 0 2.9 2 5.2 4.9 5.9v3.4h3.2v-3.4c2.9-.7 4.9-3 4.9-5.9 0-3.5-2.9-6.2-6.5-6.2zm0 2.6c2.1 0 3.8 1.6 3.8 3.6S15.1 15.3 13 15.3s-3.8-1.6-3.8-3.6S10.9 8.1 13 8.1z" fill="var(--g-surface)" />
    </svg>
  );
}

export { Link };
