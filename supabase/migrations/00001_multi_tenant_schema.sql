-- ============================================================
-- O2 Slovakia AI Voice Training Platform — Multi-Tenant Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Role enum
CREATE TYPE user_role AS ENUM ('admin', 'team_manager', 'user');

-- ============================================================
-- Tenants
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ============================================================
-- Users (linked to auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'sk', 'hu')),
  is_superadmin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Teams
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_teams_tenant ON teams(tenant_id);
CREATE INDEX idx_teams_parent ON teams(parent_team_id);

-- ============================================================
-- Tenant Memberships (user <-> tenant with role)
-- ============================================================
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_memberships_team ON tenant_memberships(team_id);

-- ============================================================
-- Scenarios
-- ============================================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('frontline', 'leadership')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_tenant ON scenarios(tenant_id);

-- ============================================================
-- Difficulty Levels (inherits tenant scope through scenario)
-- ============================================================
CREATE TABLE difficulty_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  resistance_level INT NOT NULL DEFAULT 5 CHECK (resistance_level BETWEEN 1 AND 10),
  emotional_intensity INT NOT NULL DEFAULT 5 CHECK (emotional_intensity BETWEEN 1 AND 10),
  cooperation INT NOT NULL DEFAULT 5 CHECK (cooperation BETWEEN 1 AND 10),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, name)
);

CREATE INDEX idx_difficulty_levels_scenario ON difficulty_levels(scenario_id);

-- ============================================================
-- Assignments
-- ============================================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  difficulty_level_id UUID NOT NULL REFERENCES difficulty_levels(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, scenario_id, difficulty_level_id)
);

CREATE INDEX idx_assignments_tenant ON assignments(tenant_id);
CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_assignments_scenario ON assignments(scenario_id);

-- ============================================================
-- Training Sessions
-- ============================================================
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
  feedback_translations JSONB DEFAULT NULL,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_tenant ON training_sessions(tenant_id);
CREATE INDEX idx_sessions_user ON training_sessions(user_id);
CREATE INDEX idx_sessions_scenario ON training_sessions(scenario_id);
CREATE INDEX idx_sessions_assignment ON training_sessions(assignment_id);
CREATE INDEX idx_sessions_call_sid ON training_sessions(call_sid);
CREATE INDEX idx_sessions_status ON training_sessions(status);
CREATE UNIQUE INDEX idx_sessions_otp ON training_sessions(otp) WHERE otp IS NOT NULL;

-- ============================================================
-- Invitations
-- ============================================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invitation_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One pending invitation per email per tenant
CREATE UNIQUE INDEX unique_pending_invitation_per_tenant_email
  ON invitations(tenant_id, email) WHERE status = 'pending';

CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_token ON invitations(invitation_token);

-- ============================================================
-- Updated-at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON tenant_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scenarios_updated_at BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_difficulty_levels_updated_at BEFORE UPDATE ON difficulty_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invitations_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
