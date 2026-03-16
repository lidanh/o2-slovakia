-- ============================================================
-- Functions & Triggers for Multi-Tenant
-- ============================================================

-- ============================================================
-- Auto-create public.users row when auth user is created
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- Sync membership to auth metadata (current_tenant_id + role)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_membership_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if this is the user's current tenant
  IF (
    SELECT raw_app_meta_data->>'current_tenant_id'
    FROM auth.users WHERE id = NEW.user_id
  ) = NEW.tenant_id::text THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', NEW.role::text,
        'current_tenant_id', NEW.tenant_id::text
      )
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_membership_metadata
  AFTER INSERT OR UPDATE OF role, team_id, is_active ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION sync_membership_to_auth_metadata();

-- ============================================================
-- Switch tenant RPC
-- ============================================================
CREATE OR REPLACE FUNCTION switch_tenant(target_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  membership RECORD;
BEGIN
  -- Validate active membership
  SELECT tm.role, tm.team_id INTO membership
  FROM tenant_memberships tm
  JOIN tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = target_tenant_id
    AND tm.is_active = true
    AND t.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active membership in target tenant';
  END IF;

  -- Update auth metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'current_tenant_id', target_tenant_id::text,
      'role', membership.role::text
    )
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'tenant_id', target_tenant_id,
    'role', membership.role,
    'team_id', membership.team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get my tenants RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_tenants()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  role user_role,
  team_id UUID,
  is_current BOOLEAN
) AS $$
DECLARE
  current_tid UUID;
BEGIN
  current_tid := (
    SELECT (raw_app_meta_data->>'current_tenant_id')::UUID
    FROM auth.users WHERE auth.users.id = auth.uid()
  );

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    tm.role,
    tm.team_id,
    (t.id = current_tid) AS is_current
  FROM tenant_memberships tm
  JOIN tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = auth.uid()
    AND tm.is_active = true
    AND t.is_active = true
  ORDER BY (t.id = current_tid) DESC, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Recursive: get all descendant team IDs (inclusive)
-- ============================================================
CREATE OR REPLACE FUNCTION get_descendant_team_ids(root_id UUID)
RETURNS UUID[] AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM teams WHERE id = root_id
    UNION ALL
    SELECT t.id FROM teams t JOIN tree ON t.parent_team_id = tree.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) FROM tree;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Validate membership team belongs to same tenant
-- ============================================================
CREATE OR REPLACE FUNCTION validate_membership_team()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM teams WHERE id = NEW.team_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Team does not belong to the same tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_membership_team
  BEFORE INSERT OR UPDATE OF team_id ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION validate_membership_team();

-- ============================================================
-- Validate assignment tenant consistency
-- ============================================================
CREATE OR REPLACE FUNCTION validate_assignment_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify user has membership in this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = NEW.user_id AND tenant_id = NEW.tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User does not have an active membership in this tenant';
  END IF;

  -- Verify scenario belongs to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM scenarios WHERE id = NEW.scenario_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Scenario does not belong to this tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_assignment_tenant
  BEFORE INSERT ON assignments
  FOR EACH ROW EXECUTE FUNCTION validate_assignment_tenant();

-- ============================================================
-- Validate session tenant consistency
-- ============================================================
CREATE OR REPLACE FUNCTION validate_session_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify user has membership in this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = NEW.user_id AND tenant_id = NEW.tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User does not have an active membership in this tenant';
  END IF;

  -- Verify scenario belongs to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM scenarios WHERE id = NEW.scenario_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Scenario does not belong to this tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_session_tenant
  BEFORE INSERT ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_session_tenant();
