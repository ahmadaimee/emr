-- Extensions Grove depends on. Runs once at cluster initialisation.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), digest() for the audit hash chain
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email / member-id comparison
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy patient search and duplicate detection
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- exclusion constraints on coverage date ranges

-- Application role. Deliberately NOT the owner and NOT superuser: row-level security
-- is bypassed by table owners and superusers, so the app must connect as neither.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grove_app') THEN
    CREATE ROLE grove_app LOGIN PASSWORD 'grove_local_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE grove TO grove_app;
GRANT USAGE ON SCHEMA public TO grove_app;

-- pg-boss keeps its queue tables in their own schema, owned by the app role so it can
-- manage them without any privilege on public. Queue payloads carry only IDs.
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION grove_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grove_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO grove_app;
