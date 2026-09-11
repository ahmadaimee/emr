'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ICONS } from './nav-icons';

export interface SubItem {
  href: string;
  label: string;
  badge?: string;
}

export interface NavItem {
  href: string;
  label: string;
  key: string;
  badge?: 'tasks';
  children?: SubItem[];
}

// Remittances is nested as a sub-category under Payments.
// By default, Claim Status and Eligibility are placed at the bottom per user preference.
const DEFAULT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', key: 'D' },
  { href: '/queues', label: 'Work queues', key: 'Q', badge: 'tasks' },
  { href: '/claims', label: 'Claims', key: 'C' },
  {
    href: '/payments',
    label: 'Payments',
    key: 'Y',
    children: [
      { href: '/payments', label: 'All Payments' },
      { href: '/remittances', label: 'Remittances' },
      { href: '/statements', label: 'Patient Statements' },
    ],
  },
  { href: '/authorizations', label: 'Auth & Referrals', key: 'A' },
  {
    href: '/schedule',
    label: 'Scheduling',
    key: 'H',
    children: [
      { href: '/schedule', label: "Today's Book" },
      { href: '/schedule?view=providers', label: 'Provider Availability' },
    ],
  },
  { href: '/patients', label: 'Patients & EHR', key: 'P' },
  { href: '/batches', label: 'Batch Management', key: 'B' },
  { href: '/reports', label: 'Reports', key: '' },
  { href: '/claim-status', label: 'Claim Status (276/277)', key: 'S' },
  { href: '/eligibility', label: 'Eligibility', key: 'E' },
];

const SETTINGS = [
  { href: '/settings/setup', label: 'Practice Setup', icon: 'setup' },
  { href: '/settings/automation', label: 'Automation', icon: 'automation' },
  { href: '/settings/claim-statuses', label: 'Claim Statuses', icon: 'claim-statuses' },
  { href: '/settings/rules', label: 'Rules & Denial Engine', icon: 'rules' },
  { href: '/settings/fee-schedules', label: 'Fee Schedules & Coding', icon: 'fee-schedules' },
  { href: '/settings/providers', label: 'Providers', icon: 'providers' },
  { href: '/settings/organization', label: 'Organization & Practices', icon: 'organization' },
  { href: '/settings/edi', label: 'Billing & EDI Setups', icon: 'edi' },
  { href: '/settings/audit', label: 'Audit log', icon: 'audit' },
  { href: '/settings/users', label: 'Users & roles', icon: 'users' },
];

const STORAGE_KEY = 'grove_nav_order_v4';

export function NavLinks({ openTasks, collapsed = false }: { openTasks: number; collapsed?: boolean }) {
  const path = usePathname();
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '/payments': true,
  });

  // Automatically keep parent expanded if currently on child route
  useEffect(() => {
    if (path === '/payments' || path.startsWith('/payments') || path.startsWith('/remittances')) {
      setExpandedGroups((prev) => ({ ...prev, '/payments': true }));
    }
  }, [path]);

  // Load user saved order from localStorage and clean up any old top-level remittances entry
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('grove_nav_order_v3') ||
        localStorage.getItem('grove_nav_order');
      if (saved) {
        const order: string[] = JSON.parse(saved).filter((h: string) => h !== '/remittances');
        const map = new Map(DEFAULT_NAV.map((item) => [item.href, item]));
        const sorted: NavItem[] = [];
        for (const href of order) {
          const item = map.get(href);
          if (item) {
            sorted.push(item);
            map.delete(href);
          }
        }
        // Append any newly added default items
        for (const remaining of map.values()) {
          sorted.push(remaining);
        }
        setNavItems(sorted);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.map((i) => i.href)));
        } catch {}
      }
    } catch {}
  }, []);

  const toggleGroup = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedGroups((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...navItems];
    const [moved] = updated.splice(draggedIndex, 1);
    if (moved) {
      updated.splice(targetIndex, 0, moved);
      setNavItems(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.map((i) => i.href)));
      } catch {}
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const item = (
    n: NavItem,
    index: number,
    extra?: React.ReactNode
  ) => {
    const isParentActive =
      path === n.href ||
      (n.href !== '/dashboard' && path.startsWith(n.href)) ||
      Boolean(n.children?.some((c) => path === c.href || path.startsWith(c.href)));
    const isDirectActive =
      path === n.href || (n.href !== '/dashboard' && !n.children && path.startsWith(n.href));
    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index;
    const hasChildren = Boolean(n.children && n.children.length > 0);
    const isExpanded = expandedGroups[n.href] ?? true;

    return (
      <div
        key={n.href}
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        className={`relative transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${
          isDragOver ? 'border-t-2 border-grove' : ''
        }`}
      >
        <div className="flex items-center">
          <Link
            href={n.href}
            className={`group flex h-8 flex-1 items-center rounded-md text-sm cursor-grab active:cursor-grabbing transition-colors ${
              collapsed ? 'justify-center px-0' : 'justify-between px-2'
            } ${
              isDirectActive
                ? 'bg-grove-soft font-medium text-grove-strong'
                : isParentActive
                ? 'font-medium text-ink bg-surface-sunken/60'
                : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'
            }`}
            title={collapsed ? n.label : 'Drag to reorder tabs'}
          >
            <div className={`flex items-center gap-1.5 truncate ${collapsed ? 'justify-center' : ''}`}>
              {NAV_ICONS[n.href]}
              {!collapsed && (
                <>
                  {/* Grip handle */}
                  <span className="text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity text-xs select-none">
                    ⋮⋮
                  </span>
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </div>
            {!collapsed && <div className="flex items-center gap-1 shrink-0">{extra}</div>}
          </Link>
          {hasChildren && !collapsed ? (
            <button
              type="button"
              onClick={(e) => toggleGroup(n.href, e)}
              className="ml-0.5 flex h-7 w-6 items-center justify-center rounded text-ink-4 hover:bg-surface-sunken hover:text-ink transition-colors"
              title={isExpanded ? 'Collapse sub-menu' : 'Expand sub-menu'}
              aria-label={isExpanded ? 'Collapse sub-menu' : 'Expand sub-menu'}
            >
              <svg
                className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
        </div>

        {hasChildren && isExpanded && n.children && !collapsed ? (
          <div
            className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-2 py-0.5"
            draggable={false}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {n.children.map((sub) => {
              const isSubActive =
                sub.href === '/payments'
                  ? path === '/payments'
                  : path === sub.href || path.startsWith(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`flex h-7 items-center justify-between rounded-md px-2 text-xs transition-colors ${
                    isSubActive
                      ? 'bg-grove-soft font-semibold text-grove-strong'
                      : 'text-ink-3 hover:bg-surface-sunken hover:text-ink'
                  }`}
                >
                  <span className="truncate">{sub.label}</span>
                  {sub.badge ? (
                    <span className="rounded bg-surface-sunken px-1.5 py-0.2 text-[9px] font-mono text-ink-3">
                      {sub.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const settingsItem = (href: string, label: string, icon: string) => {
    const active = path === href || path.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={`group flex h-8 items-center rounded-md text-sm ${collapsed ? 'justify-center px-0' : 'justify-between px-2.5'} ${
          active
            ? 'bg-grove-soft font-medium text-grove-strong'
            : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'
        }`}
      >
        <span className={`flex items-center gap-1.5 truncate ${collapsed ? 'justify-center' : ''}`}>
          {NAV_ICONS[icon]}
          {!collapsed && label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <div className="space-y-0.5">
        {navItems.map((n, index) =>
          item(
            n,
            index,
            n.badge === 'tasks' && openTasks > 0 ? (
              <span className="rounded-sm bg-clay-soft px-1.5 text-[11px] font-semibold text-clay">
                {openTasks}
              </span>
            ) : null
          )
        )}
      </div>

      {!collapsed && (
        <div className="mt-5 px-2.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-ink-4">
          <span>Settings</span>
        </div>
      )}
      <div className={`space-y-0.5 ${collapsed ? 'mt-3 border-t border-line pt-3' : 'mt-1'}`}>
        {SETTINGS.map((s) => settingsItem(s.href, s.label, s.icon))}
      </div>
    </>
  );
}
