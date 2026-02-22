-- RLS Tenant Isolation Policies and Seat Limit Enforcement
--
-- This file contains Row Level Security policies for tenant data isolation
-- and a trigger to enforce subscription seat limits.
--
-- IMPORTANT: Apply this after running the main schema migration.
-- If using Drizzle migrations, run this manually via psql or pg client.

-- Enable RLS on all business data tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies (safety net)
-- These policies ensure that queries only access data for the tenant
-- specified in the session variable 'app.current_tenant_id'.
--
-- The 'true' parameter in current_setting means: return NULL instead of
-- raising an error if the setting doesn't exist. This prevents breaking
-- non-tenant-scoped queries like migrations and seeds.

CREATE POLICY tenant_isolation_organizations ON organizations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_deals ON deals
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_tickets ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_contacts ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_meetings ON meetings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Seat limit enforcement trigger
-- This function is called before inserting a new tenant member.
-- It checks the current number of active/invited members against the
-- subscription's seat_count and raises an exception if the limit is reached.

CREATE OR REPLACE FUNCTION enforce_seat_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  seat_limit integer;
BEGIN
  -- Count current active and invited members for this tenant
  SELECT count(*) INTO current_count
  FROM tenant_members
  WHERE tenant_id = NEW.tenant_id AND status IN ('active', 'invited');

  -- Get the seat limit from the active subscription
  SELECT ts.seat_count INTO seat_limit
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = NEW.tenant_id AND ts.status IN ('active', 'trialing');

  -- Enforce the limit (NULL seat_limit means unlimited)
  IF seat_limit IS NOT NULL AND current_count >= seat_limit THEN
    RAISE EXCEPTION 'Seat limit reached (% of %)', current_count, seat_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the enforcement function
CREATE TRIGGER check_seat_limit
  BEFORE INSERT ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION enforce_seat_limit();
