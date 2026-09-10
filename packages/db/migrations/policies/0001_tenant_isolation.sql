-- ---------------------------------------------------------------------------
-- Tenant isolation, audit capture, and append-only enforcement.
--
-- IDEMPOTENT. Runs after every schema migration so new tables are covered the moment
-- they exist. Driven by the presence of an `org_id` column, which is the contract:
-- if a table has org_id it is tenant data and gets a policy; if it does not, it must
-- be on the NON_TENANT_TABLES allowlist or CI fails (see tools/check-rls-coverage.ts).
-- ---------------------------------------------------------------------------

create schema if not exists app;

-- The application role must never be able to bypass RLS. Stated explicitly here
-- rather than assumed from the CREATE ROLE default.
alter role grove_app nobypassrls nosuperuser nocreaterole nocreatedb;

-- ---------------------------------------------------------------------------
-- Transaction-local context accessors. `withTenant` sets these with
-- set_config(..., true). Marked STABLE so the planner can inline them.
-- ---------------------------------------------------------------------------

create or replace function app.current_org() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.current_org', true), '')::uuid
$$;

create or replace function app.current_actor() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid
$$;

create or replace function app.current_session() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.session_id', true), '')::uuid
$$;

create or replace function app.current_request() returns text
language sql stable parallel safe as $$
  select nullif(current_setting('app.request_id', true), '')
$$;

create or replace function app.access_context() returns text
language sql stable parallel safe as $$
  select nullif(current_setting('app.access_context', true), '')
$$;

-- ---------------------------------------------------------------------------
-- Row-level security on every table with an org_id column.
-- FORCE is mandatory: without it the table owner bypasses the policy.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
       )
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('alter table public.%I force row level security', r.relname);
    execute format('drop policy if exists tenant_isolation on public.%I', r.relname);
    execute format(
      'create policy tenant_isolation on public.%I
         for all to grove_app
         using (org_id = app.current_org())
         with check (org_id = app.current_org())',
      r.relname
    );
  end loop;
end
$$;

-- The organizations table IS the tenant; its policy keys on id rather than org_id.
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
drop policy if exists tenant_isolation on public.organizations;
create policy tenant_isolation on public.organizations
  for all to grove_app
  using (id = app.current_org())
  with check (id = app.current_org());

-- ---------------------------------------------------------------------------
-- Append-only tables: INSERT and SELECT only, enforced twice — by privilege and by
-- trigger — so that neither a compromised application nor a well-meaning developer
-- can rewrite history.
-- ---------------------------------------------------------------------------

create or replace function app.raise_immutable() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end
$$;

do $$
declare
  t text;
  append_only text[] := array[
    'audit_events',
    'audit_row_changes',
    'phi_access_events',
    'ledger_entries',
    'claim_versions',
    'claim_state_transitions',
    'task_events',
    'outbox_events',
    'external_calls'
  ];
begin
  foreach t in array append_only loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('revoke update, delete, truncate on public.%I from grove_app', t);
    execute format('drop trigger if exists %I on public.%I', t || '_immutable', t);
    execute format(
      'create trigger %I before update or delete on public.%I
         for each row execute function app.raise_immutable()',
      t || '_immutable', t
    );
  end loop;
end
$$;

-- outbox_events is a special case: the relay must mark rows published.
-- Allow UPDATE of the bookkeeping columns only.
grant update (published_at, attempts, last_error) on public.outbox_events to grove_app;
drop trigger if exists outbox_events_immutable on public.outbox_events;
create or replace function app.outbox_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'outbox_events is append-only' using errcode = 'insufficient_privilege';
  end if;
  if new.payload is distinct from old.payload
     or new.event_type is distinct from old.event_type
     or new.aggregate_id is distinct from old.aggregate_id then
    raise exception 'outbox_events content is immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger outbox_events_immutable before update or delete on public.outbox_events
  for each row execute function app.outbox_guard();

-- ---------------------------------------------------------------------------
-- Automatic row-change capture on every tenant table.
--
-- Reads the actor/session/request from the transaction-local settings, so there is
-- no application plumbing to forget. SECURITY DEFINER so the insert into
-- audit_row_changes succeeds regardless of the caller's privileges on it.
-- ---------------------------------------------------------------------------

create or replace function app.capture_row_change() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_deny    text[] := coalesce(tg_argv[0]::text[], '{}');
  v_org     uuid;
  v_row     uuid;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - v_deny end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - v_deny end;

  if tg_op = 'UPDATE' then
    select array_agg(k) into v_changed
      from jsonb_object_keys(v_new) k
     where v_new -> k is distinct from v_old -> k
       and k not in ('updated_at', 'updated_by');
    if v_changed is null then
      return new;  -- no-op update; do not log noise
    end if;
  end if;

  v_org := coalesce((v_new ->> 'org_id')::uuid, (v_old ->> 'org_id')::uuid);
  v_row := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);

  insert into public.audit_row_changes (
    org_id, table_name, row_id, op, changed_columns, old_values, new_values,
    actor_user_id, session_id, request_id, access_context
  ) values (
    v_org, tg_table_name, v_row, tg_op, v_changed, v_old, v_new,
    app.current_actor(), app.current_session(), app.current_request(), app.access_context()
  );

  return coalesce(new, old);
end
$$;

do $$
declare
  r record;
  -- High-churn or non-PHI bookkeeping tables where capture is noise, not evidence.
  skip text[] := array[
    'audit_events', 'audit_row_changes', 'phi_access_events', 'compliance_alerts',
    'audit_chain_verifications', 'activity_events',
    'outbox_events', 'external_calls', 'idempotency_records', 'webhook_deliveries',
    'sessions', 'balance_snapshots', 'payer_behavior_stats', 'claim_status_checks',
    'task_events', 'report_runs', 'eligibility_checks'
  ];
  -- Columns that must never appear in the change log, per table.
  deny jsonb := '{
    "patients":            ["ssn_encrypted"],
    "mfa_methods":         ["secret_encrypted", "public_key"],
    "users":               ["password_hash"],
    "api_clients":         ["client_secret_hash"],
    "api_keys":            ["secret_hash"],
    "webhook_endpoints":   ["secret_encrypted", "previous_secret_encrypted"],
    "claim_versions":      ["x12"],
    "remittances":         []
  }';
  denylist text;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
       )
       and not (c.relname = any (skip))
  loop
    denylist := coalesce(
      (select string_agg(quote_literal(x), ',') from jsonb_array_elements_text(deny -> r.relname) x),
      ''
    );
    execute format('drop trigger if exists %I on public.%I', r.relname || '_audit', r.relname);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.capture_row_change(%L)',
      r.relname || '_audit', r.relname, '{' || denylist || '}'
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap resolvers.
--
-- Before a request has a tenant context there is nothing RLS will let it read — which
-- is correct, and also means login and API-key lookup need a narrow, audited door.
-- These SECURITY DEFINER functions are that door: each returns exactly the columns
-- needed to establish context and nothing else. They are the only cross-tenant reads
-- in the system.
-- ---------------------------------------------------------------------------

create or replace function app.list_organization_ids() returns setof uuid
language sql security definer stable set search_path = public as $$
  select id from organizations
$$;

create or replace function app.resolve_org_slug(p_slug text)
returns table (id uuid, name text, slug text)
language sql security definer stable set search_path = public as $$
  select id, name, slug from organizations where slug = p_slug
$$;

create or replace function app.resolve_user_for_login(p_slug text, p_email text)
returns table (org_id uuid, user_id uuid, password_hash text, status text, mfa_enrolled_at timestamptz,
               failed_login_count int, locked_until timestamptz)
language sql security definer stable set search_path = public as $$
  select u.org_id, u.id, u.password_hash, u.status::text, u.mfa_enrolled_at, u.failed_login_count, u.locked_until
    from users u join organizations o on o.id = u.org_id
   where o.slug = p_slug and u.email = p_email::citext
$$;

create or replace function app.resolve_session(p_token_hash text)
returns table (org_id uuid, session_id uuid, user_id uuid, idle_expires_at timestamptz,
               absolute_expires_at timestamptz, mfa_satisfied_at timestamptz, revoked_at timestamptz)
language sql security definer stable set search_path = public as $$
  select org_id, id, user_id, idle_expires_at, absolute_expires_at, mfa_satisfied_at, revoked_at
    from sessions where token_hash = p_token_hash
$$;

create or replace function app.resolve_api_key(p_public_id text)
returns table (org_id uuid, key_id uuid, secret_hash text, scopes text[], practice_ids uuid[],
               ip_allowlist inet[], expires_at timestamptz, revoked_at timestamptz)
language sql security definer stable set search_path = public as $$
  select org_id, id, secret_hash, scopes, practice_ids, ip_allowlist, expires_at, revoked_at
    from api_keys where public_id = p_public_id
$$;

-- Failed-login bookkeeping must work before context exists, too.
create or replace function app.record_login_failure(p_user_id uuid, p_lock_after int, p_lock_minutes int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update users
     set failed_login_count = failed_login_count + 1,
         locked_until = case when failed_login_count + 1 >= p_lock_after
                             then now() + make_interval(mins => p_lock_minutes) else locked_until end
   where id = p_user_id;
end $$;

grant execute on function app.list_organization_ids(), app.resolve_org_slug(text),
  app.resolve_user_for_login(text, text), app.resolve_session(text), app.resolve_api_key(text),
  app.record_login_failure(uuid, int, int) to grove_app;

-- ---------------------------------------------------------------------------
-- Document and control-number sequences. Global (not per-tenant) is fine: numbers
-- only need to be unique within an org, and a global sequence guarantees that.
-- X12 control numbers must be unique per trading partner over time, so they are
-- never reset.
-- ---------------------------------------------------------------------------

create sequence if not exists claim_number_seq start 10001;
create sequence if not exists encounter_number_seq start 50001;
create sequence if not exists statement_number_seq start 70001;
create sequence if not exists x12_isa_control_seq start 1 maxvalue 999999999 cycle;
create sequence if not exists x12_gs_control_seq start 1 maxvalue 999999999 cycle;
create sequence if not exists x12_st_control_seq start 1 maxvalue 9999 cycle;
grant usage, select on sequence claim_number_seq, encounter_number_seq, statement_number_seq,
  x12_isa_control_seq, x12_gs_control_seq, x12_st_control_seq to grove_app;

-- ---------------------------------------------------------------------------
-- Grants. Default privileges from init cover tables created by the owner, but be
-- explicit so a fresh database behaves identically.
-- ---------------------------------------------------------------------------

grant usage on schema app to grove_app;
grant execute on all functions in schema app to grove_app;
grant select, insert, update, delete on all tables in schema public to grove_app;
grant usage, select on all sequences in schema public to grove_app;

-- Re-apply the append-only revokes, since the blanket grant above would undo them.
do $$
declare
  t text;
begin
  foreach t in array array[
    'audit_events', 'audit_row_changes', 'phi_access_events', 'ledger_entries',
    'claim_versions', 'claim_state_transitions', 'task_events', 'external_calls'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke update, delete, truncate on public.%I from grove_app', t);
    end if;
  end loop;
  if to_regclass('public.outbox_events') is not null then
    revoke update, delete, truncate on public.outbox_events from grove_app;
    grant update (published_at, attempts, last_error) on public.outbox_events to grove_app;
  end if;
end
$$;
