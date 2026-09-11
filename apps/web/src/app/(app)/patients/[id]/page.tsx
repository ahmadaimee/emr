import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq, schema } from '@grove/db';
import { Card, Code, Empty, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { AddCoverageModal } from './add-coverage-modal';
import { NewSoapModal } from './new-soap-modal';
import { UploadDocumentModal } from './upload-document-modal';
import { DocumentViewButton } from './document-view-button';
import { MergePatientsModal } from '../merge-patients-modal';
import { getMockPatientsData } from '@/lib/mock-data';

export const metadata = { title: 'Patient Chart & EHR' };

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const currentTab = sp.tab ?? 'chart';
  const { run } = await pageContext();

  const data = await run(`/patients/${id}`, async (ctx, phi) => {
    // In live DB mode, fetch patient, coverages, claims, ledger, and clinical records
    const [patient] = await ctx.tx
      .select({
        p: schema.patients,
        practiceName: schema.practices.name,
      })
      .from(schema.patients)
      .innerJoin(schema.practices, eq(schema.practices.id, schema.patients.practiceId))
      .where(eq(schema.patients.id, id));

    if (!patient) return null;
    phi.touch([id], ['demographics', 'financial', 'clinical']);

    const signerUserId = ctx.actor?.userId;

    // Independent reads once we know the patient exists — run in parallel rather than
    // paying a network round-trip to the database for each one in sequence.
    const [coverages, claims, ledger, payers, statements, noteRows, docRows, signerRows] = await Promise.all([
      ctx.tx
        .select({
          c: schema.coverages,
          payerName: schema.payers.name,
        })
        .from(schema.coverages)
        .innerJoin(schema.payers, eq(schema.payers.id, schema.coverages.payerId))
        .where(eq(schema.coverages.patientId, id))
        .orderBy(schema.coverages.rank),

      ctx.tx
        .select({
          c: schema.claims,
          payerName: schema.payers.name,
        })
        .from(schema.claims)
        .innerJoin(schema.payers, eq(schema.payers.id, schema.claims.payerId))
        .where(eq(schema.claims.patientId, id))
        .orderBy(desc(schema.claims.createdAt))
        .limit(20),

      ctx.tx
        .select()
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.patientId, id))
        .orderBy(desc(schema.ledgerEntries.createdAt))
        .limit(30),

      ctx.tx.select({ id: schema.payers.id, name: schema.payers.name }).from(schema.payers),

      ctx.tx
        .select()
        .from(schema.patientStatements)
        .where(eq(schema.patientStatements.patientId, id))
        .orderBy(desc(schema.patientStatements.statementDate))
        .limit(20),

      ctx.tx
        .select({ n: schema.clinicalNotes, authorFirstName: schema.users.firstName, authorLastName: schema.users.lastName })
        .from(schema.clinicalNotes)
        .innerJoin(schema.users, eq(schema.users.id, schema.clinicalNotes.authorUserId))
        .where(eq(schema.clinicalNotes.patientId, id))
        .orderBy(desc(schema.clinicalNotes.serviceDate), desc(schema.clinicalNotes.createdAt)),

      ctx.tx
        .select({ d: schema.documents, uploaderFirstName: schema.users.firstName, uploaderLastName: schema.users.lastName })
        .from(schema.documentLinks)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLinks.documentId))
        .leftJoin(schema.users, eq(schema.users.id, schema.documents.uploadedBy))
        .where(eq(schema.documentLinks.patientId, id))
        .orderBy(desc(schema.documents.createdAt)),

      signerUserId
        ? ctx.tx
            .select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
            .from(schema.users)
            .where(eq(schema.users.id, signerUserId))
        : Promise.resolve([]),
    ]);
    const [signer] = signerRows;

    return {
      signerName: signer ? `${signer.firstName} ${signer.lastName}` : 'the signed-in clinician',
      patient,
      coverages,
      claims,
      ledger,
      payers,
      statements,
      soapNotes: noteRows.map((r) => ({
        id: r.n.id,
        serviceDate: r.n.serviceDate,
        status: r.n.status,
        authorName: `${r.authorFirstName} ${r.authorLastName}`,
        signedAt: r.n.signedAt,
        vitals: {
          bloodPressure: r.n.bloodPressureSystolic && r.n.bloodPressureDiastolic ? `${r.n.bloodPressureSystolic}/${r.n.bloodPressureDiastolic} mmHg` : '—',
          heartRate: r.n.heartRate ? `${r.n.heartRate} bpm` : '—',
          temperature: r.n.temperatureF ? `${r.n.temperatureF} °F` : '—',
          respiratoryRate: r.n.respiratoryRate ? `${r.n.respiratoryRate} /min` : '—',
          spo2: r.n.spo2 ? `${r.n.spo2}%` : '—',
          weightLbs: r.n.weightLbs ? `${r.n.weightLbs} lbs` : '—',
          heightInches: r.n.heightInches ? `${r.n.heightInches} in` : '—',
        },
        subjective: r.n.subjective,
        objective: r.n.objective,
        primaryDiagnosisCode: r.n.primaryDiagnosisCode,
        primaryDiagnosisDescription: r.n.primaryDiagnosisDescription,
        plan: r.n.plan,
      })),
      medicalHistory: { conditions: [] as any[], surgeries: [] as any[], family: [] as any[], social: {} as { tobacco?: string; alcohol?: string; occupation?: string; exercise?: string } },
      allergies: [],
      medications: [],
      documents: docRows.map((r) => ({
        id: r.d.id,
        title: r.d.displayName,
        category: r.d.kind,
        mimeType: r.d.contentType,
        fileSizeKb: Math.ceil(r.d.byteSize / 1024),
        uploadedAt: r.d.createdAt,
        uploadedBy: r.uploaderFirstName ? `${r.uploaderFirstName} ${r.uploaderLastName}` : 'Unknown',
      })),
    };
  });

  if (!data) notFound();
  const { patient, coverages, claims, ledger, payers, statements = [], soapNotes = [], medicalHistory = { conditions: [], surgeries: [], family: [], social: {} }, allergies = [], medications = [], documents = [], signerName } = data;
  const p = patient.p as any;

  // The ledger is append-only and stores only the signed amount of each entry, not a
  // running balance — derive one for display by accumulating oldest-first, then
  // restoring the fetched (most-recent-first) order.
  const ledgerWithBalance = [...ledger]
    .reverse()
    .reduce<{ entry: (typeof ledger)[number]; balanceAfterCents: number }[]>((acc, entry) => {
      const prior = acc.length ? acc[acc.length - 1]!.balanceAfterCents : 0;
      acc.push({ entry, balanceAfterCents: prior + entry.amountCents });
      return acc;
    }, [])
    .reverse();

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
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-grove-strong bg-grove-soft px-1.5 py-0.5 rounded">
              {p.mrn}
            </span>
            <span>·</span>
            <span>DOB {p.dateOfBirth ?? p.dob ?? '—'}</span>
            <span>·</span>
            <span>Sex: {p.sex ?? p.gender ?? '—'}</span>
            <span>·</span>
            <span>Practice: {patient.practiceName}</span>
            <span>·</span>
            <StatusPill status={p.status ?? 'active'} />
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MergePatientsModal
              patients={getMockPatientsData().rows.map((r) => ({
                id: r.p.id,
                name: `${r.p.lastName}, ${r.p.firstName}`,
                mrn: r.p.mrn,
                dob: (r.p.dateOfBirth ?? r.p.dob) as string,
              }))}
              initialPrimaryId={id}
            />
            <NewSoapModal patientId={id} signerName={signerName} />
            <UploadDocumentModal patientId={id} />
            <AddCoverageModal patientId={id} payers={payers} />
          </div>
        }
      />

      {/* Patient Demographic Summary Card */}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-raised p-4 sm:grid-cols-4 text-xs">
        <div>
          <span className="text-ink-4 block font-medium">Contact Phone</span>
          <span className="text-ink font-semibold">{p.phoneMobile ?? p.phone ?? 'None on file'}</span>
        </div>
        <div>
          <span className="text-ink-4 block font-medium">Email Address</span>
          <span className="text-ink font-semibold truncate block">{p.email ?? 'None on file'}</span>
        </div>
        <div>
          <span className="text-ink-4 block font-medium">Residential Address</span>
          <span className="text-ink font-semibold">
            {p.addressLine1 ? `${p.addressLine1}, ${p.city}, ${p.state} ${p.postalCode}` : 'None on file'}
          </span>
        </div>
        <div>
          <span className="text-ink-4 block font-medium">Primary Insurance</span>
          <span className="text-ink font-semibold">
            {coverages[0]?.payerName ? `${coverages[0].payerName} (${coverages[0].c.memberId})` : 'Self-Pay / None'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-4 flex flex-wrap border-b border-line gap-1">
        {[
          { key: 'chart', label: 'Clinical Chart & SOAP Notes', count: soapNotes.length },
          { key: 'history', label: 'Medical History & Rx', count: (medicalHistory.conditions?.length ?? 0) + medications.length },
          { key: 'documents', label: 'EHR PHI Documents & Storage', count: documents.length },
          { key: 'billing', label: 'Insurance & Ledger', count: coverages.length + claims.length },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/patients/${id}?tab=${tab.key}`}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              currentTab === tab.key
                ? 'border-grove text-grove-strong'
                : 'border-transparent text-ink-3 hover:border-line-strong hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="rounded-full bg-surface-sunken px-1.5 py-0.2 text-[10px] text-ink-2 font-mono">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* TAB 1: CLINICAL CHART & SOAP NOTES */}
      {currentTab === 'chart' && (
        <div className="space-y-4">
          {soapNotes.length === 0 ? (
            <Card>
              <Empty
                title="No clinical encounter notes"
                body="Click 'New SOAP Note' above to document clinical findings, vital signs, and ICD-10 assessments."
              />
            </Card>
          ) : (
            soapNotes.map((note: any) => (
              <Card
                key={note.id}
                title={
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-ink">
                      Clinical Encounter — {date(note.serviceDate)}
                    </span>
                    {note.status === 'signed' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                        <span>✓ Signed</span>
                        <span className="opacity-70">by {note.authorName}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                        <span>Draft</span>
                        <span className="opacity-70">by {note.authorName}</span>
                      </span>
                    )}
                  </div>
                }
              >
                {/* Vitals Ribbon */}
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-sunken/40 p-3 sm:grid-cols-4 lg:grid-cols-7 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">BP</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.bloodPressure}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">Heart Rate</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.heartRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">Temp</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.temperature}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">SpO2</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.spo2}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">Resp Rate</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.respiratoryRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">Weight</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.weightLbs}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-ink-4 block font-semibold">Height</span>
                    <span className="font-mono font-medium text-ink">{note.vitals.heightInches}</span>
                  </div>
                </div>

                {/* S / O / A / P Blocks */}
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="rounded-md border border-line p-3 bg-surface">
                    <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                      <span className="rounded bg-grove-soft px-1.5 py-0.5 text-grove-strong font-mono font-bold">S</span>
                      <span>Subjective</span>
                    </div>
                    <p className="text-ink-2">{note.subjective}</p>
                  </div>

                  <div className="rounded-md border border-line p-3 bg-surface">
                    <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                      <span className="rounded bg-grove-soft px-1.5 py-0.5 text-grove-strong font-mono font-bold">O</span>
                      <span>Objective</span>
                    </div>
                    <p className="text-ink-2">{note.objective}</p>
                  </div>

                  <div className="rounded-md border border-line p-3 bg-surface">
                    <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                      <span className="rounded bg-grove-soft px-1.5 py-0.5 text-grove-strong font-mono font-bold">A</span>
                      <span>Assessment</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-sunken px-2 py-1 font-sans">
                      <span className="font-mono font-bold text-grove-strong">{note.primaryDiagnosisCode}</span>
                      <span className="text-ink">{note.primaryDiagnosisDescription}</span>
                    </span>
                  </div>

                  <div className="rounded-md border border-line p-3 bg-surface">
                    <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                      <span className="rounded bg-grove-soft px-1.5 py-0.5 text-grove-strong font-mono font-bold">P</span>
                      <span>Plan</span>
                    </div>
                    <p className="text-ink-2">{note.plan}</p>
                  </div>
                </div>

                {note.signedAt && (
                  <div className="mt-3 flex items-center justify-end border-t border-line pt-2 text-[11px] text-ink-4">
                    <span>Signed {relative(note.signedAt)}</span>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: MEDICAL HISTORY & MEDICATIONS */}
      {currentTab === 'history' && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Allergies Card */}
          <Card title="Allergies & Adverse Reactions">
            {allergies.length === 0 ? (
              <p className="p-3 text-xs text-ink-3">No known drug allergies (NKDA).</p>
            ) : (
              <div className="divide-y divide-line">
                {allergies.map((alg: any) => (
                  <div key={alg.id} className="p-3 text-xs flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-ink">
                        <span>{alg.allergen}</span>
                      </div>
                      <div className="text-ink-3 mt-0.5">Reaction: {alg.reaction}</div>
                    </div>
                    <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-danger">
                      {alg.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Current Medications */}
          <Card title="Current Medications">
            {medications.length === 0 ? (
              <p className="p-3 text-xs text-ink-3">No active medications documented.</p>
            ) : (
              <div className="divide-y divide-line">
                {medications.map((m: any) => (
                  <div key={m.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{m.name} {m.dosage}</span>
                      <span className="rounded bg-ok-soft px-1.5 py-0.2 text-[10px] font-bold text-ok uppercase">
                        {m.status}
                      </span>
                    </div>
                    <div className="text-ink-3 mt-0.5">{m.frequency} ({m.route}) · {m.indication}</div>
                    <div className="text-[10px] text-ink-4 mt-0.5">Rx by: {m.prescriber} · Started: {m.startDate}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Chronic Conditions */}
          <Card title="Past Medical History (PMH)">
            {medicalHistory.conditions?.length === 0 ? (
              <p className="p-3 text-xs text-ink-3">No past medical conditions recorded.</p>
            ) : (
              <div className="divide-y divide-line">
                {medicalHistory.conditions.map((c: any) => (
                  <div key={c.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-ink">{c.condition}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-ink-3">[{c.icd10}]</span>
                      <div className="text-ink-3 text-[11px]">{c.notes}</div>
                    </div>
                    <span className="text-[11px] text-ink-4">Onset: {c.onsetYear}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Surgical History */}
          <Card title="Past Surgical History (PSH)">
            {medicalHistory.surgeries?.length === 0 ? (
              <p className="p-3 text-xs text-ink-3">No past surgeries recorded.</p>
            ) : (
              <div className="divide-y divide-line">
                {medicalHistory.surgeries.map((s: any) => (
                  <div key={s.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-ink">{s.procedure}</span>
                      <div className="text-ink-3 text-[11px]">{s.facility} · {s.indication}</div>
                    </div>
                    <span className="text-[11px] text-ink-4 font-mono">{s.year}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Family & Social History */}
          <Card title="Family & Social History" className="md:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 p-3 text-xs">
              <div>
                <h4 className="font-semibold text-ink mb-2">Family History</h4>
                <ul className="space-y-1 text-ink-2">
                  {medicalHistory.family?.map((f: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium text-ink">{f.relationship}:</span> {f.condition} ({f.status})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-ink mb-2">Social History</h4>
                <ul className="space-y-1 text-ink-2">
                  <li><span className="font-medium text-ink">Tobacco:</span> {medicalHistory.social?.tobacco ?? 'None'}</li>
                  <li><span className="font-medium text-ink">Alcohol:</span> {medicalHistory.social?.alcohol ?? 'None'}</li>
                  <li><span className="font-medium text-ink">Occupation:</span> {medicalHistory.social?.occupation ?? 'Unspecified'}</li>
                  <li><span className="font-medium text-ink">Exercise:</span> {medicalHistory.social?.exercise ?? 'Sedentary'}</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: EHR PHI DOCUMENT REPOSITORY */}
      {currentTab === 'documents' && (
        <Card title={`Clinical Attachments & Stored Files (${documents.length})`}>
          {documents.length === 0 ? (
            <Empty
              title="No documents uploaded"
              body="Click 'Upload PHI Document' to attach lab reports, diagnostic imaging, or signed HIPAA forms."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Document Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Format / Size</th>
                    <th className="px-3 py-2">Uploaded At</th>
                    <th className="px-3 py-2">Uploaded By</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {documents.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-surface-sunken/40">
                      <td className="px-3 py-2.5 font-medium text-ink">
                        <span>{doc.title}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2 border border-line">
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-3 font-mono text-[11px]">
                        {doc.mimeType?.split('/')[1]?.toUpperCase()} · {doc.fileSizeKb} KB
                      </td>
                      <td className="px-3 py-2.5 text-ink-3 text-[11px]">
                        {date(doc.uploadedAt)} <span className="opacity-60 font-mono">({relative(doc.uploadedAt)})</span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-3 text-[11px]">
                        {doc.uploadedBy}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <DocumentViewButton documentId={doc.id} title={doc.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: BILLING, COVERAGES & LEDGER */}
      {currentTab === 'billing' && (
        <div className="space-y-4">
          {/* Coverages */}
          <Card title={`Active Coverages & COB Ranks (${coverages.length})`}>
            {coverages.length === 0 ? (
              <Empty
                title="No insurance policies on file"
                body="Click 'Add Insurance Coverage' to add primary or secondary coverage."
              />
            ) : (
              <div className="divide-y divide-line">
                {coverages.map(({ c, payerName }) => (
                  <div key={c.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            c.rank === 'primary'
                              ? 'bg-grove-soft text-grove-strong'
                              : 'bg-surface-sunken text-ink-2'
                          }`}
                        >
                          {c.rank}
                        </span>
                        <span className="font-semibold text-ink">{payerName}</span>
                      </div>
                      <div className="text-ink-3">
                        Member ID: <Code>{c.memberId}</Code>
                        {c.groupNumber && (
                          <span className="ml-3">
                            Group: <Code>{c.groupNumber}</Code>
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusPill status={c.active ? 'active' : 'inactive'} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Claims History */}
          <Card title={`Claims History (${claims.length})`}>
            {claims.length === 0 ? (
              <Empty title="No claims created yet for this patient" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Claim #</th>
                      <th className="px-3 py-2">Service Date</th>
                      <th className="px-3 py-2">Payer</th>
                      <th className="px-3 py-2 text-right">Total Charge</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs font-mono">
                    {claims.map(({ c, payerName }) => (
                      <tr key={c.id} className="hover:bg-surface-sunken/40 font-sans">
                        <td className="px-3 py-2.5 font-mono font-medium">
                          <Link href={`/claims/${c.id}`} className="text-grove-strong hover:underline">
                            {c.claimNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-ink-3">{date(c.serviceDateFrom)}</td>
                        <td className="px-3 py-2.5">{payerName}</td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          <Money cents={c.totalChargeCents} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          <Money cents={c.balanceCents ?? c.totalChargeCents} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Financial Ledger */}
          <Card title={`Append-Only Patient Ledger (${ledger.length})`}>
            {ledger.length === 0 ? (
              <Empty title="No ledger entries recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs font-mono">
                    {ledgerWithBalance.map(({ entry, balanceAfterCents }) => (
                      <tr key={entry.id} className="hover:bg-surface-sunken/40 font-sans">
                        <td className="px-3 py-2 text-xs text-ink-3">{date(entry.createdAt)}</td>
                        <td className="px-3 py-2 uppercase text-[11px] font-semibold text-ink-2">
                          {entry.entryType.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 text-ink-2">{entry.note ?? '—'}</td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            entry.amountCents < 0 ? 'text-ok' : 'text-ink'
                          }`}
                        >
                          <Money cents={entry.amountCents} />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">
                          <Money cents={balanceAfterCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Statements sent */}
          <Card title={`Patient Statements (${statements.length})`}>
            {statements.length === 0 ? (
              <Empty title="No statements sent" body="Statements generated from Payments → Patient Statements will appear here once one is sent to this patient." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Statement #</th>
                      <th className="px-3 py-2 text-center">Cycle</th>
                      <th className="px-3 py-2">Date / Due</th>
                      <th className="px-3 py-2 text-right">Balance Due</th>
                      <th className="px-3 py-2">Sent</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {statements.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-sunken/40">
                        <td className="px-3 py-2 font-mono font-medium text-grove-strong">{s.statementNumber}</td>
                        <td className="px-3 py-2 text-center g-num">{s.cycleNumber}</td>
                        <td className="px-3 py-2 text-ink-3">{date(s.statementDate)} → {date(s.dueDate)}</td>
                        <td className="px-3 py-2 text-right font-medium"><Money cents={s.balanceDueCents} /></td>
                        <td className="px-3 py-2 text-ink-3">{s.sentAt ? relative(s.sentAt) : '—'}</td>
                        <td className="px-3 py-2"><StatusPill status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
