'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CommandPalette } from './command-palette';
import { NavLinks } from './nav-links';
import { ThemeToggle } from './theme-toggle';

const COLLAPSE_KEY = 'grove_sidebar_collapsed';

export function Shell({ children, user, org, openTasks }: { children: ReactNode; user: { name: string; email: string }; org: { name: string }; openTasks: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
    } catch {}
    setReady(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface-raised transition-[width] duration-150 ${
          collapsed ? 'w-14' : 'w-56'
        } ${ready ? '' : 'invisible'}`}
      >
        <div className={`flex h-14 items-center gap-2 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          <Logo />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-[15px] font-semibold tracking-tight">PracticeOS</div>
              <div className="truncate text-[11px] text-ink-3">{org.name}</div>
            </div>
          )}
        </div>
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          <NavLinks openTasks={openTasks} collapsed={collapsed} />
        </nav>
        <div className={`border-t border-line py-3 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mb-2 flex h-8 w-full items-center rounded-md border border-line text-ink-3 hover:bg-surface-sunken hover:text-ink ${collapsed ? 'justify-center' : 'justify-between px-2.5'}`}
          >
            {!collapsed && <span className="text-xs">Collapse</span>}
            <CollapseIcon collapsed={collapsed} />
          </button>
          {!collapsed && (
            <button className="flex w-full items-center justify-between rounded-md border border-line px-2.5 py-1.5 text-left text-xs text-ink-3 hover:bg-surface-sunken" data-open-palette>
              <span>Search or jump…</span>
              <span className="g-kbd">⌘K</span>
            </button>
          )}
          <div className={`mt-3 flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-[11px] text-ink-3">{user.email}</div>
              </div>
            )}
            <div className={`flex items-center gap-1 shrink-0 ${collapsed ? 'flex-col' : ''}`}>
              <ThemeToggle />
              <form action="/logout" method="post">
                <button className="rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-surface-sunken hover:text-ink" title="Sign out">
                  {collapsed ? '⏻' : 'Sign out'}
                </button>
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

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.8" />
      <path d="M9.5 4.5v15" />
      {collapsed ? <path d="M6.5 9.5l1.7 2.5-1.7 2.5" /> : <path d="M8 9.5l-1.7 2.5L8 14.5" />}
    </svg>
  );
}

export { Link };
