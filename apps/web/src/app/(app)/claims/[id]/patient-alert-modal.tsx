'use client';

import { useState } from 'react';
import { dismissPatientAlertAction } from '../actions';

export interface PatientAlertData {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  text: string;
  severity: 'warning' | 'danger' | 'info';
  setBy?: string;
  setDate?: string;
  dismissed?: boolean;
}

export function PatientAlertModal({
  alert,
  patientId,
}: {
  alert: PatientAlertData | null;
  patientId: string;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(alert && !alert.dismissed));
  const [isBannerVisible, setIsBannerVisible] = useState(Boolean(alert));

  if (!alert) return null;

  const handleCloseModal = async () => {
    setIsOpen(false);
    try {
      await dismissPatientAlertAction(patientId);
    } catch {}
  };

  return (
    <>
      {/* 1. INITIAL POPUP MODAL (Appears on mount when any claim of this patient is opened) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-line-strong bg-surface-raised p-5 shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn-soft text-warn border border-warn/30 text-base font-bold shrink-0">
                  !
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <span>Patient-Level Alert Notice</span>
                    <span className="rounded-full bg-warn-soft text-warn border border-warn/30 px-2 py-0.5 text-[10px] font-mono font-semibold">
                      HIGH PRIORITY
                    </span>
                  </h3>
                  <p className="text-xs text-ink-3">
                    Patient: <strong className="text-ink">{alert.patientName}</strong> · MRN: <span className="g-mono">{alert.mrn}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-ink-3 hover:text-ink text-sm font-semibold p-1"
                title="Close Alert"
              >
                ✕
              </button>
            </div>

            {/* Alert Message Box */}
            <div className="my-4 rounded-lg border border-line bg-surface-sunken border-l-4 border-l-warn p-3.5 text-xs text-ink">
              <div className="font-semibold text-ink mb-1">
                Notice regarding {alert.patientName}:
              </div>
              <p className="text-xs leading-relaxed text-ink-2 font-medium">
                {alert.text}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-ink-3 pt-2 border-t border-line">
                <span>Set by: <strong className="text-ink-2">{alert.setBy || 'Billing Department'}</strong></span>
                <span>Date: <strong className="text-ink-2">{alert.setDate || 'Recent'}</strong></span>
              </div>
            </div>

            <div className="text-[11px] text-ink-3 mb-4 flex items-center gap-1.5">
              <span className="text-info font-bold">ℹ</span>
              <em>This alert automatically displays on every claim, billing record, and encounter opened for this patient across the organization.</em>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex items-center gap-1.5 rounded-md bg-grove hover:bg-grove-strong px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                <span>✓</span>
                <span>Acknowledge &amp; Continue to Claim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PERSISTENT PATIENT ALERT BANNER AT TOP OF PAGE */}
      {isBannerVisible && (
        <div className="mb-3 rounded-lg border border-line bg-surface-raised border-l-4 border-l-warn p-2.5 sm:p-3 flex items-start justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warn-soft text-warn text-xs font-bold shrink-0">!</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink text-xs uppercase tracking-wide">
                  PATIENT ALERT ({alert.patientName})
                </span>
                <span className="text-[10px] text-ink-3">
                  Set by {alert.setBy || 'Billing Dept'} · {alert.setDate || '2026-03-02'}
                </span>
              </div>
              <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">
                {alert.text}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-xs font-medium text-grove-strong hover:underline px-1 py-0.5"
            >
              Re-open Notice
            </button>
            <button
              type="button"
              onClick={() => setIsBannerVisible(false)}
              className="text-ink-3 hover:text-ink text-xs p-1"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

