import Link from 'next/link';
import { desc, eq, schema, sql } from '@grove/db';
import { Empty, Money, PageHeader } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { NewPatientModal } from './new-patient-modal';

export const metadata = { title: 'Patients' };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; practice?: string }>;
}) {
  const sp = await searchParams;
  const { run } = await pageContext();

  const data = await run('/patients', async (ctx, phi) => {
    let whereClause = undefined;
    if (sp.q) {
      whereClause = sql`(${schema.patients.mrn} ilike ${'%' + sp.q + '%'} or ${schema.patients.firstName} ilike ${'%' + sp.q + '%'} or ${schema.patients.lastName} ilike ${'%' + sp.q + '%'} or ${schema.patients.phoneMobile} ilike ${'%' + sp.q + '%'})`;
    }

    const rows = await ctx.tx
      .select({
        p: schema.patients,
        practiceName: schema.practices.name,
        primaryPayer: sql<string | null>`(
          select py.name from coverages c
          inner join payers py on py.id = c.payer_id
          where c.patient_id = patients.id and c.rank = 'primary'
          limit 1
        )`,
        openClaims: sql<number>`(
          select count(*)::int from claims cl
          where cl.patient_id = patients.id and cl.status not in ('paid', 'closed', 'voided')
        )`,
      })
      .from(schema.patients)
      .innerJoin(schema.practices, eq(schema.practices.id, schema.patients.practiceId))
      .where(whereClause)
      .orderBy(desc(schema.patients.createdAt))
      .limit(100);

    phi.touch(
      rows.map((r) => r.p.id),
      ['demographics'],
      rows.length
    );

    const practices = await ctx.tx
      .select({ id: schema.practices.id, name: schema.practices.name })
      .from(schema.practices);

    return { rows, practices };
  });

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Master patient index (MPI), active coverage rankings, and patient accounting."
        actions={<NewPatientModal practices={data.practices} />}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search MRN, Name, Phone..."
            className="h-8 w-64 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm"
          />
          <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm hover:bg-surface-sunken">
            Search
          </button>
        </form>
      </div>

      {data.rows.length === 0 ? (
        <Empty
          title="No patients found"
          body="Use the search bar above or click 'Register New Patient' to add a patient."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
              <tr>
                <th className="px-3 py-2">MRN</th>
                <th className="px-3 py-2">Patient Name</th>
                <th className="px-3 py-2">DOB / Sex</th>
                <th className="px-3 py-2">Primary Payer</th>
                <th className="px-3 py-2">Practice</th>
                <th className="px-3 py-2 text-right">Open Claims</th>
                <th className="px-3 py-2">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map(({ p, practiceName, primaryPayer, openClaims }) => (
                <tr key={p.id} className="hover:bg-surface-sunken/40">
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link
                      href={`/patients/${p.id}`}
                      className="font-medium text-grove-strong hover:underline"
                    >
                      {p.mrn}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    <Link href={`/patients/${p.id}`} className="hover:underline">
                      {p.lastName}, {p.firstName}
                    </Link>
                    {p.phoneMobile ? (
                      <div className="text-[11px] text-ink-3">{p.phoneMobile}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">
                    {date(p.dateOfBirth)} ({p.sex})
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {primaryPayer ? (
                      <span className="font-medium text-ink">{primaryPayer}</span>
                    ) : (
                      <span className="text-warn">Self-Pay / None</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-3">{practiceName}</td>
                  <td className="px-3 py-2.5 text-right g-num text-xs">
                    {openClaims > 0 ? (
                      <span className="font-medium text-clay">{openClaims}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-3">{relative(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
