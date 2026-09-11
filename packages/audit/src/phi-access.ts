import { sql, type TenantTx } from '@grove/db';

/**
 * Request-scoped collector for PHI reads.
 *
 * The query layer calls `touch()` as it returns patient-bearing rows; the transport
 * (Fastify hook / Next server-action wrapper) calls `flush()` once at the end of the
 * request. One row per request with the array of patients — never one row per patient
 * — keeps a 500-row worklist at one row and keeps the log complete without sampling.
 */
export type FieldClass = 'demographics' | 'financial' | 'clinical' | 'ssn' | 'contact';

export class PhiAccessCollector {
  private readonly patientIds = new Set<string>();
  private readonly fieldClasses = new Set<FieldClass>();
  private recordCount = 0;
  private export = false;

  constructor(
    private readonly ctx: {
      orgId: string;
      actorUserId: string | null;
      actorType: 'user' | 'system' | 'api_client';
      sessionId: string | null;
      requestId: string;
      elevationId?: string | null;
      route: string;
      purpose?: 'treatment' | 'payment' | 'operations' | 'patient_request';
      ipAddress?: string | null;
    },
  ) {}

  touch(patientIds: Iterable<string>, fields: FieldClass[] = ['demographics'], count = 1): void {
    for (const id of patientIds) this.patientIds.add(id);
    for (const f of fields) this.fieldClasses.add(f);
    this.recordCount += count;
  }

  markExport(): void {
    this.export = true;
  }

  get isEmpty(): boolean {
    return this.patientIds.size === 0;
  }

  async flush(tx: TenantTx, resourceType: string): Promise<void> {
    if (this.isEmpty) return;
    // drizzle's `sql` template expands a plain JS array into a parenthesised parameter
    // list (`($1, $2, ...)`), meant for `IN (...)` — casting that to `uuid[]`/`text[]`
    // fails with "cannot cast type record to uuid[]". Passing a Postgres array-literal
    // string instead (`{a,b,c}`) keeps it a single bind parameter that casts cleanly.
    // Safe here because patient IDs are UUIDs and field classes are a fixed enum — no
    // value can contain a comma, brace, or quote.
    const patientIdsLiteral = `{${[...this.patientIds].join(',')}}`;
    const fieldClassesLiteral = `{${[...this.fieldClasses].join(',')}}`;
    await tx.execute(sql`
      insert into phi_access_events (
        org_id, actor_user_id, actor_type, session_id, request_id, elevation_id, route, purpose,
        resource_type, patient_ids, record_count, field_classes, is_export, ip_address
      ) values (
        ${this.ctx.orgId}, ${this.ctx.actorUserId}, ${this.ctx.actorType}, ${this.ctx.sessionId},
        ${this.ctx.requestId}, ${this.ctx.elevationId ?? null}, ${this.ctx.route}, ${this.ctx.purpose ?? 'payment'},
        ${resourceType}, ${patientIdsLiteral}::uuid[], ${this.recordCount},
        ${fieldClassesLiteral}::text[], ${this.export}, ${this.ctx.ipAddress ?? null}
      )
    `);
  }
}
