import { notFound } from 'next/navigation';
import { appendAuditEvent } from '@grove/audit';
import { compileReport, STANDARD_REPORTS } from '@grove/reporting';
import { pageContext } from '@/lib/session';

/** Same csv escaping rule as RFC 4180: quote a field if it contains a comma, quote, or newline. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('report') ?? '';
  const queryDef = STANDARD_REPORTS[key];
  if (!queryDef) notFound();

  const { run, session } = await pageContext();

  const csv = await run('/reports/export', async (ctx, phi) => {
    const compiled = compileReport(queryDef);
    const rows = await ctx.tx.execute<Record<string, any>>(compiled.query);

    if (compiled.containsPhi) phi.markExport();

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'export',
      resourceType: 'report',
      resourceId: key,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { report: key, rowCount: rows.length },
    });

    const header = compiled.columns.map((c) => csvField(c.label)).join(',');
    const lines = rows.map((row) =>
      compiled.columns
        .map((c) => {
          const val = row[c.key];
          if (c.format === 'currency' && val != null) return csvField((Number(val) / 100).toFixed(2));
          if (c.format === 'percent' && val != null) return csvField((Number(val) / 100).toFixed(2) + '%');
          return csvField(val);
        })
        .join(','),
    );
    return [header, ...lines].join('\r\n');
  });

  const body = typeof csv === 'string' ? csv : 'note\r\n"Export is unavailable in demo mode — the database is not connected."';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${key}.csv"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
