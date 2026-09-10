import { notFound } from 'next/navigation';
import { pageContext } from '@/lib/session';
import { getMockProviderDetail } from '@/lib/mock-data';
import { ProviderEditForm } from './provider-edit-form';

export const metadata = { title: 'Provider Record' };

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await pageContext();

  const data: any = await run(`/settings/providers/${id}`, async () => getMockProviderDetail(id) ?? {});
  const detail = data?.provider ? data : getMockProviderDetail(id);
  if (!detail?.provider) notFound();

  return (
    <ProviderEditForm
      provider={detail.provider}
      references={detail.references}
      warnings={detail.warnings ?? []}
      practices={detail.practices ?? []}
      colleagues={detail.colleagues ?? []}
      reference={detail.reference}
    />
  );
}
