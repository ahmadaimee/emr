'use client';

import { useTransition } from 'react';
import { toggleGlobalPause, updateAutomation } from './actions';
import { Button } from '@/components/ui';

interface AutomationControlsProps {
  settings: {
    globalPaused: boolean;
    pausedReason: string | null;
    dryRun: boolean;
    autoEligibilityPreVisit: boolean;
    autoSecondaryClaims: boolean;
    autoSubmitSecondary: boolean;
    autoTransferPatientResponsibility: boolean;
    autoCorrectedClaims: boolean;
  };
}

export function AutomationControls({ settings }: AutomationControlsProps) {
  const [pending, startTransition] = useTransition();

  const handlePauseToggle = () => {
    startTransition(async () => {
      await toggleGlobalPause(!settings.globalPaused, 'Toggled from web controls');
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateAutomation(formData);
    });
  };

  return (
    <div className="space-y-6">
      {/* Circuit breaker banner */}
      <div
        className={`rounded-xl border p-5 ${
          settings.globalPaused
            ? 'border-danger/40 bg-danger-soft'
            : 'border-ok/30 bg-ok-soft/30'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  settings.globalPaused ? 'bg-danger animate-pulse' : 'bg-ok'
                }`}
              />
              <span className="font-semibold text-sm">
                {settings.globalPaused
                  ? 'Global Automation Paused (Circuit Breaker)'
                  : 'Automated Revenue Cycle Active'}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {settings.globalPaused
                ? `Paused: ${settings.pausedReason ?? 'Operator manual stop'}. All outbound EDI background workers and clearinghouse calls halted.`
                : 'Eligibility polling, status inquiries, auto-secondary generation, and posting relays are operating normally.'}
            </p>
          </div>

          <Button
            variant={settings.globalPaused ? 'primary' : 'danger'}
            disabled={pending}
            onClick={handlePauseToggle}
          >
            {pending
              ? 'Updating...'
              : settings.globalPaused
              ? 'Resume Automation'
              : 'Emergency Pause All'}
          </Button>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleFormSubmit} className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-raised p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Automation Safeguards & Mode</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="dryRun"
              defaultChecked={settings.dryRun}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Dry-Run Mode</div>
              <div className="text-xs text-ink-3">
                Evaluate all rules and generate draft transactions, but do not transmit to clearinghouses or charge cards.
              </div>
            </div>
          </label>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Autonomous RCM Capabilities</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="autoEligibilityPreVisit"
              defaultChecked={settings.autoEligibilityPreVisit}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Auto-Verify Eligibility 3 Days Before Appointment</div>
              <div className="text-xs text-ink-3">
                Dispatches 270 inquiries for upcoming appointments and surfaces changes (deductible resets, plan termination) into the work queue.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="autoSecondaryClaims"
              defaultChecked={settings.autoSecondaryClaims}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Autonomous Secondary Claim Generation (COB)</div>
              <div className="text-xs text-ink-3">
                When a primary 835 remittance posts, automatically generate the secondary 837 claim with 2320/2330 loops, CAS adjustments, and prior payments.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="autoSubmitSecondary"
              defaultChecked={settings.autoSubmitSecondary}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Auto-Submit Clean Secondaries</div>
              <div className="text-xs text-ink-3">
                Directly transmit auto-generated secondaries if they pass all scrubbing rules with zero warnings or errors.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="autoTransferPatientResponsibility"
              defaultChecked={settings.autoTransferPatientResponsibility}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Auto-Transfer Patient Responsibility (PR Group Codes)</div>
              <div className="text-xs text-ink-3">
                On final adjudication, transfer CARC PR amounts to the patient ledger and queue for statement generation.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="autoCorrectedClaims"
              defaultChecked={settings.autoCorrectedClaims}
              className="mt-0.5 rounded border-line-strong text-grove focus:ring-grove"
            />
            <div>
              <div className="text-xs font-medium text-ink">Auto-Generate Frequency-7 Corrected Claims</div>
              <div className="text-xs text-ink-3">
                Automatically draft corrected claims carrying the payer CCN for allowlisted demographic and coding denials.
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? 'Saving Changes...' : 'Save Automation Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}

