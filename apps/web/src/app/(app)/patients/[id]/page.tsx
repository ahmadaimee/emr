import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq, schema, sql } from '@grove/db';
import { Card, Code, Empty, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { AddCoverageModal } from './add-coverage-modal';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/patients/${id}`, async (ctx, phi) => {
    // 1. Fetch patient
    const [patient] = await ctx.tx
      .select({
        p: schema.patients,
        practiceName: schema.practices.name,
      })
      .from(schema.patients)
      .innerJoin(schema.practices, eq(schema.practices.id, schema.patients.practiceId))
      .where(eq(schema.patients.id, id));

    if (!patient) return null;
    phi.touch([id], ['demographics', 'financial', 'insurance']);

    // 2. Fetch coverages
    const coverages = await ctx.tx
      .select({
        c: schema.coverages,
        payerName: schema.payers.name,
      })
      .from(schema.coverages)
      .innerJoin(schema.payers, eq(schema.payers.id, schema.coverages.payerId))
      .where(eq(schema.coverages.patientId, id))
      .orderBy(schema.coverages.rank);

    // 3. Fetch claims
    const claims = await ctx.tx
      .select({
        c: schema.claims,
        payerName: schema.payers.name,
      })
      .from(schema.claims)
      .innerJoin(schema.payers, eq(schema.payers.id, schema.claims.payerId))
      .where(eq(schema.claims.patientId, id))
      .orderBy(desc(schema.claims.createdAt))
      .limit(20);

    // 4. Fetch ledger entries
    const ledger = await ctx.tx
      .select()
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.patientId, id))
      .orderBy(desc(schema.ledgerEntries.createdAt))
      .limit(30);

    // 5. Payers for modal
    const payers = await ctx.tx
      .select({ id: schema.payers.id, name: schema.payers.name })
      .from(schema.payers);

    return { patient, coverages, claims, ledger, payers };
  });

  if (!data) notFound();
  const { patient, coverages, claims, ledger, payers } = data;
  const p = patient.p;

  return (
    <>
      <div className="mb-2 text-xs text-ink-3">
        <Link href="/patients" className="hover:underline">
          Patients
        </Link>{' '}
        / {p.lastName}, {p.firstName}
      </div>

      <PageHeader
        title={`${p.lastName}, ${p.firstName}`}
        subtitle={`MRN: ${p.mrn} · DOB: ${date(p.dateOfBirth)} (${p.sex}) · ${patient.practiceName}`}
        actions={<AddCoverageModal patientId={p.id} payers={payers} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Demographics & Coverages */}
        <div className="space-y-6">
          <Card title="Demographics & Contact">
            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-ink-3">Mobile Phone</dt>
                <dd className="font-medium text-ink">{p.phoneMobile || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Email</dt>
                <dd className="font-medium text-ink">{p.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Address</dt>
                <dd className="font-medium text-ink">
                  {p.addressLine1 ? (
                    <>
                      {p.addressLine1}
                      <br />
                      {p.city}, {p.state} {p.zip}
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">SSN Last 4</dt>
                <dd className="font-mono text-ink">***-**-{p.ssnLast4 || '****'}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Insurance Coverages (COB Order)">
            {coverages.length === 0 ? (
              <Empty
                title="No insurance on file"
                body="Patient is currently Self-Pay. Click '+ Add Insurance Coverage' to add insurance."
              />
            ) : (
              <div className="space-y-3">
                {coverages.map(({ c, payerName }) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-line bg-surface p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{payerName}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          c.rank === 'primary'
                            ? 'bg-grove-soft text-grove-strong'
                            : 'bg-surface-sunken text-ink-2'
                        }`}
                      >
                        {c.rank}
                      </span>
                    </div>
                    <div className="mt-2 text-ink-3">
                      Member ID: <span className="font-mono font-medium text-ink">{c.memberId}</span>
                    </div>
                    {c.groupNumber ? (
                      <div className="text-ink-3">
                        Group #: <span className="font-mono">{c.groupNumber}</span>
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-ink-4">
                      Relationship: {c.relationshipCode === '18' ? 'Self' : c.relationshipCode}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Claims & Ledger */}
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Recent Claims (${claims.length})`}>
            {claims.length === 0 ? (
              <Empty title="No claims recorded for this patient" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Claim #</th>
                      <th className="px-3 py-2">Payer</th>
                      <th className="px-3 py-2 text-right">Charges</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {claims.map(({ c, payerName }) => (
                      <tr key={c.id} className="hover:bg-surface-sunken/40">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/claims/${c.id}`}
                            className="font-medium text-grove-strong hover:underline"
                          >
                            {c.claimNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">{payerName}</td>
                        <td className="px-3 py-2 text-right g-num text-xs">
                          <Money cents={c.totalChargeCents} />
                        </td>
                        <td className="px-3 py-2 text-right g-num text-xs font-medium">
                          <Money cents={c.balanceCents} />
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={c.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-3">{date(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Financial Ledger (Append-Only)">
            {ledger.length === 0 ? (
              <Empty
                title="No financial ledger entries"
                body="Transactions post automatically on charge creation, payments, and 835 remittance posting."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Entry Type</th>
                      <th className="px-3 py-2">Party</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Recorded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 text-xs font-medium capitalize">
                          {entry.entryType.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-3 capitalize">
                          {entry.responsibilityParty}
                        </td>
                        <td className="px-3 py-2 text-right g-num text-xs font-semibold">
                          <Money cents={entry.amountCents} variance={entry.amountCents < 0} />
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-3">{relative(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
