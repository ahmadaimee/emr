'use client';

import { useState, useTransition } from 'react';
import { checkSingleEligibility, runBatchEligibility } from './actions';
import { Button } from '@/components/ui';

interface CheckModalProps {
  patients: Array<{ id: string; name: string }>;
  payers: Array<{ id: string; name: string }>;
}

export function CheckModal({ patients, payers }: CheckModalProps) {
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSingleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await checkSingleEligibility(formData);
      setOpen(false);
    });
  };

  const handleBatchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    startTransition(async () => {
      await runBatchEligibility(name);
      setBatchOpen(false);
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setBatchOpen(true)}>
          Run Batch Verification
        </Button>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Verify Patient (270)
        </Button>
      </div>

      {/* Single Patient 270 Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink">Real-time 270 Eligibility Inquiry</h2>
            <p className="mt-1 text-xs text-ink-3">
              Sends an electronic 270 transaction to the clearinghouse and parses structured 271 benefits.
            </p>

            <form onSubmit={handleSingleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Patient</label>
                <select
                  name="patientId"
                  required
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                >
                  <option value="">Select a patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Payer</label>
                <select
                  name="payerId"
                  required
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                >
                  <option value="">Select a payer...</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Service Type</label>
                <select
                  name="serviceTypeCode"
                  defaultValue="30"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                >
                  <option value="30">30 — Health Benefit Plan Coverage</option>
                  <option value="98">98 — Professional (Physician) Visit</option>
                  <option value="MH">MH — Mental Health</option>
                  <option value="UC">UC — Urgent Care</option>
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
                <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Transmitting 270...' : 'Send Inquiry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Batch Eligibility Modal */}
      {batchOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink">Run Batch Eligibility Verification</h2>
            <p className="mt-1 text-xs text-ink-3">
              Asynchronously runs 270 inquiries for tomorrow's schedule or the active patient panel.
            </p>

            <form onSubmit={handleBatchSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Batch Name</label>
                <input
                  name="name"
                  defaultValue={`Schedule Batch — ${new Date().toLocaleDateString()}`}
                  required
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Target Population</label>
                <select
                  name="sourceType"
                  defaultValue="schedule_day"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                >
                  <option value="schedule_day">Next 3 Days Scheduled Patients</option>
                  <option value="panel">All Active Practice Patients</option>
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
                <Button variant="ghost" type="button" onClick={() => setBatchOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Starting Batch...' : 'Start Batch Run'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

