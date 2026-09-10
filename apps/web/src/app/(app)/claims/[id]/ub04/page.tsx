import { notFound } from 'next/navigation';
import { pageContext } from '@/lib/session';
import { getMockUb04Detail } from '@/lib/mock-data';
import { Ub04FormViewer } from './ub04-form-viewer';

export const metadata = { title: 'UB-04 Claim Form (CMS-1450)' };

export default async function Ub04Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/claims/${id}/ub04`, async (ctx, phi) => {
    try {
      const { loadClaimAssembly } = await import('@grove/domain');
      const a = await loadClaimAssembly(ctx, id);
      phi.touch([a.patient.id], ['demographics', 'financial']);
      return { a };
    } catch {
      return getMockUb04Detail(id);
    }
  });

  const finalData = data?.a ? data : getMockUb04Detail(id);
  if (!finalData?.a) notFound();

  return <Ub04FormViewer claimId={id} data={finalData} />;
}
