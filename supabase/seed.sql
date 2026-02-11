-- ============================================================
-- O2 Slovakia — Seed Data
-- ============================================================

-- Teams
INSERT INTO teams (id, name, description) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Sales Team Alpha', 'Primary sales team for internet products'),
  ('a1000000-0000-0000-0000-000000000002', 'Sales Team Beta', 'Secondary sales team');

-- Users
INSERT INTO users (id, name, email, phone, team_id) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Ján Novák', 'jan.novak@o2.sk', '+421901000001', 'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002', 'Mária Kováčová', 'maria.kovacova@o2.sk', '+421901000002', 'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000003', 'Peter Horváth', 'peter.horvath@o2.sk', '+421901000003', 'a1000000-0000-0000-0000-000000000002');

-- Scenario 1: Internet Upsell (frontline)
INSERT INTO scenarios (id, name, description, prompt, type, agent_id) VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'Internet Upsell',
   'Practice upselling higher-speed internet packages to existing customers.',
   'You are a customer of O2 Slovakia. You currently have a basic internet plan (100 Mbps for €15/month). The agent will try to upsell you to a higher-speed package. React naturally based on your difficulty settings.',
   'frontline',
   '6bab2049-52b3-4c1d-87e1-e4c05f471cd2');

-- Difficulty levels for Internet Upsell
INSERT INTO difficulty_levels (id, scenario_id, name, prompt, resistance_level, emotional_intensity, cooperation, sort_order) VALUES
  ('d1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Easy',
   'You are a friendly customer who is somewhat interested in upgrading. You ask basic questions about speed and price but are generally open to the idea. You might mention you''ve been streaming more lately.',
   2, 2, 8, 1),
  ('d1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Medium',
   'You are a price-conscious customer. You are not unhappy with your current plan but want to understand the value proposition clearly. Push back on price increases and ask about contract terms. You need convincing but can be won over with good arguments.',
   5, 4, 5, 2),
  ('d1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'Hard',
   'You are a frustrated customer who feels internet prices are too high. You recently saw a competitor''s ad with lower prices. You are defensive, interrupt occasionally, and need exceptional handling to consider any upgrade. Mention you might switch providers.',
   8, 7, 2, 3);

-- Scenario 2: 1-on-1 Feedback (leadership)
INSERT INTO scenarios (id, name, description, prompt, type, agent_id) VALUES
  ('c1000000-0000-0000-0000-000000000002',
   '1-on-1 Feedback Session',
   'Practice delivering constructive feedback to a team member about declining performance.',
   'You are a team member at O2 Slovakia. Your manager (the trainee) is conducting a 1-on-1 feedback session about your recent declining performance. React based on your difficulty settings.',
   'leadership',
   '6bab2049-52b3-4c1d-87e1-e4c05f471cd2');

-- Difficulty levels for 1-on-1 Feedback
INSERT INTO difficulty_levels (id, scenario_id, name, prompt, resistance_level, emotional_intensity, cooperation, sort_order) VALUES
  ('d2000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',
   'Easy',
   'You are a self-aware team member who acknowledges your recent performance dip. You are open to feedback and actively ask for suggestions on how to improve. You mention personal issues as a factor but remain professional.',
   2, 3, 9, 1),
  ('d2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   'Medium',
   'You are somewhat defensive about your performance. You partially acknowledge issues but also deflect blame to external factors (workload, unclear priorities). You need the manager to be specific and empathetic to get through to you.',
   5, 5, 5, 2),
  ('d2000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002',
   'Hard',
   'You are highly defensive and feel unfairly singled out. You compare yourself to colleagues, question the metrics being used, and become emotional. You might threaten to look for another job. The manager needs exceptional emotional intelligence to handle this.',
   9, 8, 2, 3);

-- Agent config (singleton)
INSERT INTO agent_config (id, config) VALUES
  ('e1000000-0000-0000-0000-000000000001', '{
    "wonderful": {
      "tenant_url": "",
      "api_key": "",
      "agent_id": "",
      "twiml_url": "https://app.wonderful.ai/agent/{agent_id}/twiml"
    },
    "twilio": {
      "account_sid": "",
      "auth_token": "",
      "status_callback_url": ""
    },
    "feedback": {
      "model": "gpt-4o",
      "max_tokens": 2000
    }
  }');
