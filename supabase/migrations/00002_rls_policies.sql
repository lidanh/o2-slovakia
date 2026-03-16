-- ============================================================
-- Row Level Security Policies (defense-in-depth)
-- Primary isolation is at application level (service role bypasses RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE difficulty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Helper: get current tenant from JWT
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt()->'app_metadata'->>'current_tenant_id')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Tenants: users can see tenants they belong to
-- ============================================================
CREATE POLICY tenants_select ON tenants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_memberships.tenant_id = tenants.id
      AND tenant_memberships.user_id = auth.uid()
      AND tenant_memberships.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_superadmin = true
  )
);

-- ============================================================
-- Users: can see self + users in shared tenants
-- ============================================================
CREATE POLICY users_select ON users FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM tenant_memberships m1
    JOIN tenant_memberships m2 ON m1.tenant_id = m2.tenant_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = users.id
      AND m1.is_active = true AND m2.is_active = true
  )
);

CREATE POLICY users_update_self ON users FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- Tenant Memberships: can see memberships in own tenants
-- ============================================================
CREATE POLICY memberships_select ON tenant_memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships my
    WHERE my.user_id = auth.uid()
      AND my.tenant_id = tenant_memberships.tenant_id
      AND my.is_active = true
  )
);

-- ============================================================
-- Teams: scoped to current tenant
-- ============================================================
CREATE POLICY teams_select ON teams FOR SELECT USING (
  tenant_id = public.current_tenant_id()
);

-- ============================================================
-- Scenarios: scoped to current tenant
-- ============================================================
CREATE POLICY scenarios_select ON scenarios FOR SELECT USING (
  tenant_id = public.current_tenant_id()
);

-- ============================================================
-- Difficulty Levels: via scenario tenant
-- ============================================================
CREATE POLICY difficulty_levels_select ON difficulty_levels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM scenarios
    WHERE scenarios.id = difficulty_levels.scenario_id
      AND scenarios.tenant_id = public.current_tenant_id()
  )
);

-- ============================================================
-- Assignments: scoped to current tenant
-- ============================================================
CREATE POLICY assignments_select ON assignments FOR SELECT USING (
  tenant_id = public.current_tenant_id()
);

-- ============================================================
-- Training Sessions: scoped to current tenant
-- ============================================================
CREATE POLICY sessions_select ON training_sessions FOR SELECT USING (
  tenant_id = public.current_tenant_id()
);

-- ============================================================
-- Invitations: scoped to current tenant
-- ============================================================
CREATE POLICY invitations_select ON invitations FOR SELECT USING (
  tenant_id = public.current_tenant_id()
);
