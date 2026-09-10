'use client';

import { useState } from 'react';

export function NewDenialRuleModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [triggerCarc, setTriggerCarc] = useState('CO-4');
  const [triggerRarc, setTriggerRarc] = useState('N56');
  const [strategy, setStrategy] = useState('append_modifier_and_resubmit_type_7');
  const [targetCpt, setTargetCpt] = useState('99212, 99213, 99214, 99215');
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [autoAttachIcn, setAutoAttachIcn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 900);
    }, 600);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>⚡</span>
        <span>New Auto-Denial Fixation Rule</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">New Autonomous Denial Fixation Rule</h3>
                <p className="text-xs text-ink-3">Configure automatic correction, ICN attachment, and EDI resubmission triggers</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {success && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Auto-fixation rule compiled and deployed to active 835 ingestion pipeline!
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telehealth Modifier 95 Auto-Append & Resubmit Type 7"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Trigger CARC Code *</label>
                  <select
                    value={triggerCarc}
                    onChange={(e) => setTriggerCarc(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    <option value="CO-4">CO-4: Procedure inconsistent with modifier or missing modifier</option>
                    <option value="CO-16">CO-16: Claim lacks information / missing prior claim control #</option>
                    <option value="CO-18">CO-18: Duplicate claim/service</option>
                    <option value="CO-97">CO-97: Benefit included in primary service (Bundling)</option>
                    <option value="PR-1">PR-1: Deductible amount</option>
                    <option value="PR-2">PR-2: Coinsurance amount</option>
                    <option value="PR-3">PR-3: Co-payment amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Trigger RARC Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. N56, M20, MA112"
                    value={triggerRarc}
                    onChange={(e) => setTriggerRarc(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Autonomous Fixation Strategy *</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  <option value="append_modifier_and_resubmit_type_7">
                    Append Required Modifier & Resubmit as Frequency 7 Replacement Claim
                  </option>
                  <option value="auto_attach_icn_and_set_frequency_7">
                    Auto-Attach Original ICN (Loop 2300 REF*F8) & Convert to Frequency 7
                  </option>
                  <option value="attach_individual_rendering_npi">
                    Re-attach Individual Clinician Rendering NPI (Box 24J / Loop 2420A)
                  </option>
                  <option value="transfer_to_patient_responsibility">
                    Auto-Adjust Contractual Write-off (CO-45) & Transfer Balance to Patient Ledger
                  </option>
                  <option value="rebill_secondary_insurance">
                    Generate & Submit Secondary Insurance Claim (COB) with Primary 835 Remit Attached
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Target CPT / HCPCS Filter</label>
                <input
                  type="text"
                  placeholder="e.g. 99212, 99213, 99214 or ALL"
                  value={targetCpt}
                  onChange={(e) => setTargetCpt(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                />
              </div>

              {/* Autopilot Toggles */}
              <div className="rounded-lg border border-line bg-surface-sunken/40 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs text-ink font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAttachIcn}
                    onChange={(e) => setAutoAttachIcn(e.target.checked)}
                    className="accent-grove h-4 w-4"
                  />
                  <span>Automatically attach Original Payer ICN Number from 835 Remittance</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-ink font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                    className="accent-grove h-4 w-4"
                  />
                  <span>Automatically transmit corrected claim to clearinghouse immediately upon auto-fix</span>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {loading ? 'Compiling Rule…' : 'Deploy Fixation Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
