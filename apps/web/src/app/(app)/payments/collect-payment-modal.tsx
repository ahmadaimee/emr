'use client';

import { useMemo, useState } from 'react';
import { recordPaymentAction } from './actions';

export interface PatientOption {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  mrn: string;
  dob?: string;
  gender?: string;
  subscriberId?: string;
  payerName?: string;
  ssnLast4?: string;
  phone?: string;
  balanceCents: number;
}

type LookupCriterion =
  | 'all'
  | 'first_name'
  | 'last_name'
  | 'first_last'
  | 'last_first'
  | 'dob'
  | 'subscriber_id'
  | 'ssn'
  | 'phone'
  | 'mrn';

const CRITERIA_OPTIONS: { id: LookupCriterion; label: string; placeholder: string }[] = [
  { id: 'all', label: 'All Fields (Smart Search)', placeholder: 'Search by name, MRN, DOB, Sub ID, SSN, phone...' },
  { id: 'first_name', label: 'First Name', placeholder: 'Enter first name (e.g. Eleanor, Robert)...' },
  { id: 'last_name', label: 'Last Name', placeholder: 'Enter last name (e.g. Miller, Johnson)...' },
  { id: 'first_last', label: 'First Last Name', placeholder: 'Enter full name (e.g. Eleanor Miller)...' },
  { id: 'last_first', label: 'Last, First Name', placeholder: 'Enter last, first (e.g. Miller, Eleanor)...' },
  { id: 'dob', label: 'DOB (Date of Birth)', placeholder: 'YYYY-MM-DD or MM/DD/YYYY (e.g. 1982-05-14)...' },
  { id: 'subscriber_id', label: 'Subscriber / Member ID', placeholder: 'Enter policy ID (e.g. BCBS-992140)...' },
  { id: 'ssn', label: 'SSN / Last 4', placeholder: 'Enter full SSN or last 4 (e.g. 4910)...' },
  { id: 'phone', label: 'Phone Number', placeholder: 'Enter phone digits (e.g. 555-234-8901)...' },
  { id: 'mrn', label: 'MRN (Medical Record #)', placeholder: 'Enter MRN (e.g. MRN-44910)...' },
];

export function CollectPaymentModal({ patients }: { patients: PatientOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? '');
  const [amount, setAmount] = useState(patients[0] ? (patients[0].balanceCents / 100).toFixed(2) : '50.00');
  const [source, setSource] = useState('patient_card');
  const [saving, setSaving] = useState(false);

  // Scalable patient lookup state (only searches on Enter or Search click)
  const [searchQuery, setSearchQuery] = useState('');
  const [criterion, setCriterion] = useState<LookupCriterion>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [executedResults, setExecutedResults] = useState<PatientOption[]>([]);
  const [totalFoundCount, setTotalFoundCount] = useState(0);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) ?? patients[0];

  const currentPlaceholder =
    CRITERIA_OPTIONS.find((c) => c.id === criterion)?.placeholder ?? 'Search patient...';

  // Explicit search execution triggered only on Enter or Search button
  const executeSearch = (overrideQuery?: string, overrideCriterion?: LookupCriterion) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim().toLowerCase();
    const activeCrit = overrideCriterion || criterion;

    if (!q) {
      setExecutedResults([]);
      setTotalFoundCount(0);
      setHasSearched(true);
      return;
    }

    const matched = patients.filter((p) => {
      const fName = (p.firstName ?? '').toLowerCase();
      const lName = (p.lastName ?? '').toLowerCase();
      const firstLast = `${fName} ${lName}`.trim();
      const lastFirst = `${lName}, ${fName}`.trim();
      const mrn = (p.mrn ?? '').toLowerCase();
      const dob = (p.dob ?? '').toLowerCase();
      const subId = (p.subscriberId ?? '').toLowerCase();
      const ssn = (p.ssnLast4 ?? '').toLowerCase();
      const phoneDigits = (p.phone ?? '').replace(/\D/g, '');
      const queryDigits = q.replace(/\D/g, '');

      switch (activeCrit) {
        case 'first_name':
          return fName.includes(q);
        case 'last_name':
          return lName.includes(q);
        case 'first_last':
          return firstLast.includes(q) || fName.includes(q) || lName.includes(q);
        case 'last_first':
          return lastFirst.includes(q) || `${lName} ${fName}`.includes(q);
        case 'dob':
          return dob.includes(q) || dob.replace(/-/g, '/').includes(q);
        case 'subscriber_id':
          return subId.includes(q);
        case 'ssn':
          return ssn.includes(q) || `***-**-${ssn}`.includes(q);
        case 'phone':
          return (
            (p.phone ?? '').toLowerCase().includes(q) ||
            (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
          );
        case 'mrn':
          return mrn.includes(q) || mrn.replace(/^mrn-?/i, '').includes(q);
        case 'all':
        default:
          return (
            fName.includes(q) ||
            lName.includes(q) ||
            firstLast.includes(q) ||
            lastFirst.includes(q) ||
            mrn.includes(q) ||
            dob.includes(q) ||
            subId.includes(q) ||
            ssn.includes(q) ||
            (p.phone ?? '').toLowerCase().includes(q) ||
            (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
          );
      }
    });

    setTotalFoundCount(matched.length);
    setExecutedResults(matched.slice(0, 25));
    setHasSearched(true);
  };

  const handleSelectPatient = (p: PatientOption) => {
    setSelectedPatientId(p.id);
    if (p.balanceCents > 0) {
      setAmount((p.balanceCents / 100).toFixed(2));
    }
    setIsSearching(false);
    setSearchQuery('');
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setIsSearching(false);
        }}
        className="flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Collect Payment</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-lg border border-line bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Collect Patient Payment</h2>
                <p className="text-xs text-ink-3">Search patient and record co-pay, coinsurance, or balance payment.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await recordPaymentAction(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-4"
            >
              {/* Patient Selection & Lookup Section */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-ink">Patient Lookup</label>
                  {!isSearching && selectedPatient && (
                    <button
                      type="button"
                      onClick={() => setIsSearching(true)}
                      className="text-xs font-medium text-grove hover:underline"
                    >
                      🔍 Search / Change Patient
                    </button>
                  )}
                </div>

                {/* Search Box & Criteria Selector */}
                {isSearching ? (
                  <div className="mt-2 rounded-lg border border-line bg-surface-sunken/40 p-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Criteria Dropdown */}
                      <select
                        value={criterion}
                        onChange={(e) => setCriterion(e.target.value as LookupCriterion)}
                        className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink shrink-0"
                      >
                        {CRITERIA_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>

                      {/* Search Input & Action Button */}
                      <div className="relative flex-1 flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                executeSearch();
                              }
                            }}
                            placeholder={currentPlaceholder}
                            autoFocus
                            className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-8 text-xs text-ink placeholder:text-ink-4 focus:border-grove"
                          />
                          <span className="absolute left-2.5 top-2.5 text-xs text-ink-4">🔍</span>
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setHasSearched(false);
                                setExecutedResults([]);
                              }}
                              className="absolute right-2.5 top-2 text-xs text-ink-4 hover:text-ink"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => executeSearch()}
                          className="h-9 px-3.5 rounded-md bg-grove text-white text-xs font-semibold hover:bg-grove-strong transition-colors shrink-0 flex items-center gap-1 shadow-xs"
                        >
                          <span>Search</span>
                          <span className="text-[10px] opacity-70">↵</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Filter Chips */}
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-ink-4 mr-1">Quick match:</span>
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'first_name', label: 'First Name' },
                        { id: 'last_name', label: 'Last Name' },
                        { id: 'first_last', label: 'First Last' },
                        { id: 'last_first', label: 'Last, First' },
                        { id: 'dob', label: 'DOB' },
                        { id: 'subscriber_id', label: 'Subscriber ID' },
                        { id: 'ssn', label: 'SSN' },
                        { id: 'phone', label: 'Phone' },
                        { id: 'mrn', label: 'MRN' },
                      ].map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setCriterion(chip.id as LookupCriterion);
                            if (searchQuery.trim()) {
                              executeSearch(searchQuery, chip.id as LookupCriterion);
                            }
                          }}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            criterion === chip.id
                              ? 'bg-grove text-white font-semibold'
                              : 'bg-surface-raised border border-line text-ink-3 hover:text-ink'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Matching Results List (Scalable 10k+) */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                      {!hasSearched ? (
                        <div className="p-3 text-center text-xs text-ink-3 border border-dashed border-line rounded bg-surface">
                          <div className="font-semibold text-ink text-xs mb-0.5">⚡ Fast 10k+ Patient Lookup</div>
                          <div>Type patient name, DOB, or MRN and click <strong className="text-ink">Search</strong> or press <strong className="text-ink">Enter</strong>.</div>
                        </div>
                      ) : totalFoundCount === 0 ? (
                        <div className="p-3 text-center text-xs text-ink-3 border border-dashed border-line rounded">
                          No patients matched &quot;{searchQuery}&quot; for {criterion.replace('_', ' ')}.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between px-1 text-[11px] text-ink-3 pb-0.5">
                            <span>Found <strong className="text-ink">{totalFoundCount}</strong> patient{totalFoundCount === 1 ? '' : 's'}</span>
                            {totalFoundCount > 25 && (
                              <span className="text-[10px] bg-grove-soft text-grove-strong px-1.5 py-0.2 rounded font-medium">
                                Showing top 25 matches
                              </span>
                            )}
                          </div>
                          {executedResults.map((p) => {
                            const isSelected = p.id === selectedPatientId;
                            return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectPatient(p)}
                              className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'border-grove bg-grove-soft/40'
                                  : 'border-line bg-surface-raised hover:bg-surface-sunken hover:border-line-strong'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-ink">
                                    {p.lastName ? `${p.lastName}, ${p.firstName}` : p.name}
                                  </span>
                                  <span className="font-mono text-[10px] bg-surface-sunken px-1.5 py-0.2 rounded border border-line text-ink-2">
                                    {p.mrn}
                                  </span>
                                  {p.gender ? (
                                    <span className="text-[10px] text-ink-4">({p.gender})</span>
                                  ) : null}
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                                  {p.dob ? <span>🎂 DOB: {p.dob}</span> : null}
                                  {p.subscriberId ? (
                                    <span className="font-mono">
                                      💳 Sub ID: {p.subscriberId} {p.payerName ? `(${p.payerName})` : ''}
                                    </span>
                                  ) : null}
                                  {p.ssnLast4 ? <span>🔒 SSN: ***-**-{p.ssnLast4}</span> : null}
                                  {p.phone ? <span>📞 {p.phone}</span> : null}
                                </div>
                              </div>

                              <div className="text-right shrink-0 ml-3">
                                <div className="text-xs font-semibold text-ink">
                                  ${(p.balanceCents / 100).toFixed(2)}
                                </div>
                                <span className="text-[10px] text-ink-4">Balance</span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    </div>
                  </div>
                ) : (
                  /* Selected Patient Card */
                  selectedPatient && (
                    <div className="mt-2 rounded-lg border border-grove/40 bg-grove-soft/20 p-3.5 flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-grove text-white text-xs">
                            ✓
                          </span>
                          <span className="font-display font-semibold text-sm text-ink">
                            {selectedPatient.lastName
                              ? `${selectedPatient.lastName}, ${selectedPatient.firstName}`
                              : selectedPatient.name}
                          </span>
                          <span className="font-mono text-[11px] bg-surface-raised px-1.5 py-0.2 rounded border border-line text-ink-2">
                            {selectedPatient.mrn}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-ink-3 pt-1">
                          {selectedPatient.dob ? <div>🎂 DOB: <strong className="text-ink">{selectedPatient.dob}</strong></div> : null}
                          {selectedPatient.phone ? <div>📞 <strong className="text-ink">{selectedPatient.phone}</strong></div> : null}
                          {selectedPatient.ssnLast4 ? <div>🔒 SSN: <strong className="text-ink">***-**-{selectedPatient.ssnLast4}</strong></div> : null}
                          {selectedPatient.subscriberId ? (
                            <div className="col-span-2">
                              💳 Sub ID: <strong className="font-mono text-ink">{selectedPatient.subscriberId}</strong>
                              {selectedPatient.payerName ? ` · ${selectedPatient.payerName}` : ''}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-grove-strong">
                          ${(selectedPatient.balanceCents / 100).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-ink-4">Due Balance</span>
                      </div>
                    </div>
                  )
                )}

                {/* Hidden input to pass selected patient ID to server action */}
                <input type="hidden" name="patientId" value={selectedPatientId} />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Payment Amount ($ USD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-sm text-ink-3">$</span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-line-strong bg-surface pl-7 pr-3 text-sm font-semibold text-ink"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Payment Method / Source</label>
                <select
                  name="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                >
                  <option value="patient_card">Credit / Debit Card (Swipe / Chip / Contactless)</option>
                  <option value="patient_cash">Cash (Front Desk Copay Receipt)</option>
                  <option value="patient_check">Paper Check</option>
                  <option value="patient_ach">ACH Direct Debit / Bank Transfer</option>
                </select>
              </div>

              {/* Reference / Auth # */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Reference / Auth / Check #</label>
                <input
                  name="referenceNumber"
                  placeholder={source === 'patient_card' ? 'AUTH_19820' : source === 'patient_check' ? 'Check #1042' : 'Receipt #'}
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Notes / Allocation</label>
                <input
                  name="notes"
                  defaultValue="Point-of-care copay payment"
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {saving ? 'Posting to Ledger...' : `Collect $${amount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
