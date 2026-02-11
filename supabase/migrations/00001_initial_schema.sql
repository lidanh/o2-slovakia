-- ============================================================
-- O2 Slovakia AI Voice Training Platform — Initial Schema
-- ============================================================


-- ============================================================
-- Teams
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Users (trainees)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,          -- E.164 format
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_team_id ON users(team_id);

-- ============================================================
-- Scenarios
-- ============================================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('frontline', 'leadership')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Difficulty Levels
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
-- Assignments (user <-> scenario <-> difficulty)
-- ============================================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  difficulty_level_id UUID NOT NULL REFERENCES difficulty_levels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_id, difficulty_level_id)
);

CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_assignments_scenario ON assignments(scenario_id);

-- ============================================================
-- Training Sessions
-- ============================================================
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  difficulty_level_id UUID REFERENCES difficulty_levels(id),
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  call_sid TEXT UNIQUE,
  call_duration INT,
  communication_id TEXT UNIQUE,
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

-- ============================================================
-- Agent Config (singleton)
-- ============================================================
CREATE TABLE agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scenarios_updated_at BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_difficulty_levels_updated_at BEFORE UPDATE ON difficulty_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_config_updated_at BEFORE UPDATE ON agent_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
