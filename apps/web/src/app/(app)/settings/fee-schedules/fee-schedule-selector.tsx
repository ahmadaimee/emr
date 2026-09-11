'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditTenureModal, type FeeSchedule } from './edit-tenure-modal';
import { setDefaultFeeScheduleAction, cloneFeeScheduleAction } from './actions';

export function FeeScheduleSelector({
  feeSchedules,
  activeScheduleId,
  linesCount,
}: {
  feeSchedules: FeeSchedule[];
  activeScheduleId: string;
  linesCount: number;
}) {
  const router = useRouter();
  const activeSchedule = feeSchedules.find((s) => s.id === activeScheduleId) ?? feeSchedules[0];

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    schedule: FeeSchedule;
  } | null>(null);

  // Edit Tenure Modal state
  const [tenureModalSchedule, setTenureModalSchedule] = useState<FeeSchedule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, schedule: FeeSchedule) => {
    e.preventDefault();
    e.stopPropagation();
    // Clamp to viewport
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    setContextMenu({ x, y, schedule });
  };

  const handleSetDefault = async (schedule: FeeSchedule) => {
    setContextMenu(null);
    setActionLoading(true);
    try {
      await setDefaultFeeScheduleAction(schedule.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleClone = async (schedule: FeeSchedule) => {
    setContextMenu(null);
    setActionLoading(true);
    try {
      const newId = await cloneFeeScheduleAction(schedule.id);
      if (newId) {
        router.push(`/settings/fee-schedules?tab=fee_schedules&scheduleId=${newId}`);
      }
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = (schedule: FeeSchedule) => {
    setContextMenu(null);
    alert(`Exporting fee schedule "${schedule.name}" lines to CSV...`);
  };

  return (
    <div className="space-y-4">
      {/* Fee Schedule Selector Pill Bar with Right-Click Context Menu */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-ink-3">
            Select Fee Schedule <span className="text-ink-4 font-normal">(Right-click any schedule for options)</span>:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {feeSchedules.map((fs) => {
            const isSelected = fs.id === activeSchedule?.id;
            return (
              <div
                key={fs.id}
                onContextMenu={(e) => handleContextMenu(e, fs)}
                className="relative group"
              >
                <Link
                  href={`/settings/fee-schedules?tab=fee_schedules&scheduleId=${fs.id}`}
                  className={`rounded-md px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-ink text-ink-inverse font-semibold shadow-xs'
                      : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken hover:border-line-strong'
                  }`}
                  title="Click to select · Right-click for options"
                >
                  {fs.isDefault && (
                    <span
                      className={`text-[11px] ${
                        isSelected ? 'text-amber-300' : 'text-amber-500'
                      }`}
                      title="Default Fee Schedule"
                    >
                      ★
                    </span>
                  )}
                  <span>{fs.name}</span>
                  <span
                    className={`text-[9px] uppercase px-1 rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-sunken text-ink-3 border border-line'
                    }`}
                  >
                    {fs.scheduleType}
                  </span>
                </Link>

                {/* 3-dots accessibility button on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      x: rect.left,
                      y: rect.bottom + 4,
                      schedule: fs,
                    });
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20 text-ink-inverse text-[10px]"
                  title="Fee schedule options"
                  aria-label="Options"
                >
                  ⋮
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Schedule Details & Tenure Window Card */}
      {activeSchedule && (
        <div className="rounded-xl border border-line bg-surface-raised p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-base text-ink">
                  {activeSchedule.name}
                </h3>
                <span className="rounded bg-grove-soft px-2 py-0.5 text-[10px] font-semibold text-grove-strong uppercase">
                  {activeSchedule.scheduleType} schedule
                </span>
                {activeSchedule.isDefault && (
                  <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                    <span>★</span>
                    <span>Default Chargemaster</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3">{activeSchedule.notes}</p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTenureModalSchedule(activeSchedule)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
                title="Edit DOS effective tenure"
              >
                <span>Edit Tenure (DOS Range)</span>
              </button>

              {!activeSchedule.isDefault && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSetDefault(activeSchedule)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                  title="Set this fee schedule as default chargemaster"
                >
                  <span>★</span>
                  <span>Set as Default</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({
                    x: rect.left - 80,
                    y: rect.bottom + 4,
                    schedule: activeSchedule,
                  });
                }}
                className="flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink-3 hover:text-ink hover:bg-surface-sunken"
              >
                <span>•••</span>
              </button>
            </div>
          </div>

          {/* Date of Service (DOS) Effective Tenure Banner */}
          <div className="rounded-lg border border-grove/30 bg-grove-soft/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-grove text-white font-bold text-xs shrink-0">
                DOS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Effective Date of Service (DOS) Tenure:</span>
                  <span className="font-mono font-bold text-xs bg-surface-raised px-2 py-0.5 rounded border border-line text-grove-strong">
                    {activeSchedule.effectiveDate} → {activeSchedule.terminationDate || 'Ongoing (Active)'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  Claims with Date of Service (DOS) between{' '}
                  <strong className="text-ink">{activeSchedule.effectiveDate}</strong> and{' '}
                  <strong className="text-ink">{activeSchedule.terminationDate || 'Current / Ongoing'}</strong> will
                  automatically price using this contract rate sheet.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-ink-3 shrink-0">
              <div>Payer: <strong className="text-ink">{activeSchedule.payerName}</strong></div>
              <div>Priced Lines: <strong className="text-ink">{linesCount}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Right-Click Floating Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[210px] rounded-lg border border-line-strong bg-surface-raised py-1 shadow-xl text-xs text-ink animate-in fade-in zoom-in-95"
        >
          <div className="px-3 py-1.5 border-b border-line text-[11px] text-ink-3 font-semibold truncate max-w-[220px]">
            {contextMenu.schedule.name}
          </div>

          {!contextMenu.schedule.isDefault && (
            <button
              type="button"
              onClick={() => handleSetDefault(contextMenu.schedule)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken hover:text-grove-strong transition-colors"
            >
              <span className="text-amber-500 font-bold">★</span>
              <span>Set as Default Fee Schedule</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const sched = contextMenu.schedule;
              setContextMenu(null);
              setTenureModalSchedule(sched);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken hover:text-grove-strong transition-colors"
          >
            <span>Edit Effective Tenure (DOS Range)</span>
          </button>

          <button
            type="button"
            onClick={() => handleClone(contextMenu.schedule)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken hover:text-grove-strong transition-colors"
          >
            <span>Duplicate / Clone Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCsv(contextMenu.schedule)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken transition-colors"
          >
            <span>Export Rates to CSV</span>
          </button>

          <div className="border-t border-line my-1"></div>

          <button
            type="button"
            onClick={() => setContextMenu(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-ink-4 hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            <span>✕</span>
            <span>Close Menu</span>
          </button>
        </div>
      )}

      {/* Edit Tenure Modal */}
      {tenureModalSchedule && (
        <EditTenureModal
          schedule={tenureModalSchedule}
          isOpen={Boolean(tenureModalSchedule)}
          onClose={() => setTenureModalSchedule(null)}
        />
      )}
    </div>
  );
}
