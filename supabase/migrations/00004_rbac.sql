-- ============================================================
-- RBAC: roles, hierarchical teams, unified user model
-- Fresh start: drops & recreates users, assignments, training_sessions
-- ============================================================

-- 1. Drop dependent tables first (order matters for FKs)
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create role enum
CREATE TYPE user_role AS ENUM ('admin', 'team_manager', 'user');

-- 3. Add hierarchical teams support
ALTER TABLE teams ADD COLUMN parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX idx_teams_parent ON teams(parent_team_id);

-- 4. Recreate users table linked to auth.users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'user',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  avatar_url TEXT,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_role ON users(role);

-- 5. Recreate assignments with assigned_by
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  difficulty_level_id UUID NOT NULL REFERENCES difficulty_levels(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_id, difficulty_level_id)
);

CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_assignments_scenario ON assignments(scenario_id);

-- 6. Recreate training_sessions (includes call_type, otp from 00002)
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  difficulty_level_id UUID REFERENCES difficulty_levels(id),
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  call_sid TEXT UNIQUE,
  call_duration INT,
  communication_id TEXT UNIQUE,
  call_type TEXT NOT NULL DEFAULT 'phone' CHECK (call_type IN ('phone', 'browser')),
  otp TEXT,
  otp_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'in_progress', 'completed',
    'failed', 'no_answer', 'busy', 'canceled'
  )),
  score NUMERIC(5,2),
  star_rating INT CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5),
  feedback_summary TEXT,
  feedback_breakdown JSONB,
  suggestions JSONB,
  highlights JSONB,
  transcript JSONB,
  audio_url TEXT,
  twilio_metadata JSONB,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON training_sessions(user_id);
CREATE INDEX idx_sessions_scenario ON training_sessions(scenario_id);
CREATE INDEX idx_sessions_assignment ON training_sessions(assignment_id);
CREATE INDEX idx_sessions_call_sid ON training_sessions(call_sid);
CREATE INDEX idx_sessions_status ON training_sessions(status);
CREATE UNIQUE INDEX idx_sessions_otp ON training_sessions(otp) WHERE otp IS NOT NULL;

-- 7. Re-apply updated_at triggers for recreated tables
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Sync role into auth.users JWT metadata
CREATE OR REPLACE FUNCTION sync_role_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_user_role
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION sync_role_to_auth_metadata();

-- 9. Recursive function: get all descendant team IDs (inclusive)
CREATE OR REPLACE FUNCTION get_descendant_team_ids(root_id UUID)
RETURNS UUID[] AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM teams WHERE id = root_id
    UNION ALL
    SELECT t.id FROM teams t JOIN tree ON t.parent_team_id = tree.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) FROM tree;
$$ LANGUAGE sql STABLE;
