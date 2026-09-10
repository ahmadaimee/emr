import { notFound } from 'next/navigation';
import { appendAuditEvent } from '@grove/audit';
import { assembleProfessionalClaim, loadClaimAssembly } from '@grove/domain';
import { claimToCms1500, renderCms1500 } from '@grove/forms';
import { pageContext } from '@/lib/session';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { run, session } = await pageContext();

  const pdfBytes = await run(`/claims/${id}/cms1500`, async (ctx, phi) => {
    let a;
    try {
      a = await loadClaimAssembly(ctx, id);
    } catch {
      return null;
    }

    phi.touch([a.patient.id], ['demographics', 'financial', 'medical']);
    phi.markExport();

    const pClaim = assembleProfessionalClaim(a);
    const fields = claimToCms1500(pClaim);
    const { pdf } = await renderCms1500(fields);

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'print',
      resourceType: 'claim',
      resourceId: id,
      patientId: a.patient.id,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { format: 'cms1500_pdf', claimNumber: a.claim.claimNumber },
    });

    return pdf;
  });

  if (!pdfBytes) notFound();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cms1500-${id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
