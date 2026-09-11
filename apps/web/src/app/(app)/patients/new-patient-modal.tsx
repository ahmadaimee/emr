'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPatient } from './actions';
import { Button } from '@/components/ui';

interface NewPatientModalProps {
  practices: Array<{ id: string; name: string }>;
  /**
   * When provided, creation does not navigate to the new chart — the caller decides
   * what happens next (e.g. select the patient inline in another form). When omitted,
   * the default flow navigates to /patients/[id].
   */
  onCreated?: (patient: { id: string; name: string }) => void;
  /** Custom trigger, e.g. a small inline "+ New Patient" link instead of the default button. */
  trigger?: (open: () => void) => React.ReactNode;
}

export function NewPatientModal({ practices, onCreated, trigger }: NewPatientModalProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createPatient(formData);
      if (res.success) {
        setOpen(false);
        if (onCreated) {
          const lastName = (formData.get('lastName') as string)?.trim();
          const firstName = (formData.get('firstName') as string)?.trim();
          onCreated({ id: res.patientId, name: `${lastName}, ${firstName}` });
        } else {
          router.push(`/patients/${res.patientId}`);
        }
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Register New Patient
        </Button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink">Register Patient (Master Index)</h2>
            <p className="mt-1 text-xs text-ink-3">
              Enforces MPI uniqueness check (DOB + First/Last Name) to prevent chart fragmentation.
            </p>

            {error ? (
              <div className="mt-3 rounded-md border border-danger/30 bg-danger-soft p-2.5 text-xs text-danger">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">First Name</label>
                  <input
                    name="firstName"
                    required
                    placeholder="Jane"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Last Name</label>
                  <input
                    name="lastName"
                    required
                    placeholder="Doe"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Date of Birth</label>
                  <input
                    name="dateOfBirth"
                    type="date"
                    required
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Administrative Sex</label>
                  <select
                    name="sex"
                    defaultValue="F"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    <option value="F">Female (F)</option>
                    <option value="M">Male (M)</option>
                    <option value="U">Unknown / Unspecified (U)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Practice</label>
                  <select
                    name="practiceId"
                    required
                    defaultValue={practices[0]?.id}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    {practices.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Mobile Phone</label>
                  <input
                    name="phone"
                    placeholder="555-0199"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Email Address</label>
                <input
                  name="email"
                  type="email"
                  placeholder="jane.doe@example.com"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
                <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Checking MPI & Registering...' : 'Register Patient'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

