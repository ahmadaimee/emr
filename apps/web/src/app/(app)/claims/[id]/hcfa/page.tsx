import { notFound } from 'next/navigation';
import { pageContext } from '@/lib/session';
import { getMockClaimDetail } from '@/lib/mock-data';
import { HcfaFormViewer } from './hcfa-form-viewer';

export const metadata = { title: 'CMS-1500 Claim Form (HCFA-1500 02/12)' };

export default async function HcfaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/claims/${id}`, async (ctx, phi) => {
    try {
      const { loadClaimAssembly } = await import('@grove/domain');
      const a = await loadClaimAssembly(ctx, id);
      phi.touch([a.patient.id], ['demographics', 'financial']);
      return { a };
    } catch {
      return getMockClaimDetail(id);
    }
  });

  const finalData = data?.a ? data : getMockClaimDetail(id);
  if (!finalData || !finalData.a) notFound();

  const c = finalData.a.claim || {};

  return (
    <HcfaFormViewer
      claimId={id}
      claimNumber={c.claimNumber || 'CLM-2026-0101'}
      claimType={c.claimType || '837P'}
      claimFrequencyCode={c.claimFrequencyCode || '1'}
      data={finalData}
    />
  );
}
