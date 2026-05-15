-- NOVA GAMING NETWORK — Supabase Schema Migration
-- Run this ONCE in Supabase SQL Editor

-- 1. user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  email TEXT,
  role TEXT CHECK (role IN ('owner','admin','mod')) NOT NULL,
  assigned_by UUID REFERENCES auth.users,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. scrims_sessions
CREATE TABLE IF NOT EXISTS scrims_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  date DATE NOT NULL,
  lobby_count INT NOT NULL DEFAULT 1 CHECK (lobby_count BETWEEN 1 AND 10),
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. match_results
CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scrims_sessions ON DELETE CASCADE NOT NULL,
  lobby_number INT NOT NULL CHECK (lobby_number BETWEEN 1 AND 10),
  team_name TEXT NOT NULL,
  placement INT NOT NULL,
  kills INT NOT NULL DEFAULT 0,
  damage INT DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. player_stats
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scrims_sessions ON DELETE CASCADE NOT NULL,
  lobby_number INT NOT NULL,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  kills INT NOT NULL DEFAULT 0,
  damage INT DEFAULT 0,
  placement INT,
  cpr_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. upload_sessions
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  session_id UUID REFERENCES scrims_sessions ON DELETE SET NULL,
  file_urls TEXT[],
  ocr_results JSONB,
  status TEXT CHECK (status IN ('pending','processing','complete','failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. gfx_exports
CREATE TABLE IF NOT EXISTS gfx_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  template_id TEXT NOT NULL,
  session_id UUID REFERENCES scrims_sessions,
  config_json JSONB,
  exported_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrims_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gfx_exports ENABLE ROW LEVEL SECURITY;

-- user_roles policies
CREATE POLICY "read_own_role" ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner_read_all" ON user_roles FOR SELECT USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));
CREATE POLICY "owner_insert" ON user_roles FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner') OR NOT EXISTS(SELECT 1 FROM user_roles WHERE role='owner'));
CREATE POLICY "owner_update" ON user_roles FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));
CREATE POLICY "owner_delete" ON user_roles FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- scrims_sessions policies
CREATE POLICY "public_read_sessions" ON scrims_sessions FOR SELECT USING (true);
CREATE POLICY "admin_insert_sessions" ON scrims_sessions FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_update_sessions" ON scrims_sessions FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "owner_delete_sessions" ON scrims_sessions FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- match_results policies
CREATE POLICY "public_read_results" ON match_results FOR SELECT USING (true);
CREATE POLICY "admin_insert_results" ON match_results FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_update_results" ON match_results FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "owner_delete_results" ON match_results FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- player_stats policies
CREATE POLICY "public_read_stats" ON player_stats FOR SELECT USING (true);
CREATE POLICY "admin_insert_stats" ON player_stats FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_update_stats" ON player_stats FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "owner_delete_stats" ON player_stats FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- upload_sessions policies
CREATE POLICY "admin_read_uploads" ON upload_sessions FOR SELECT USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_insert_uploads" ON upload_sessions FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_update_uploads" ON upload_sessions FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

-- gfx_exports policies
CREATE POLICY "admin_read_gfx" ON gfx_exports FOR SELECT USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_insert_gfx" ON gfx_exports FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_uid ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON scrims_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_results_session ON match_results(session_id);
CREATE INDEX IF NOT EXISTS idx_stats_session ON player_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_name);

-- 7. point_system
CREATE TABLE IF NOT EXISTS point_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default point system
INSERT INTO point_system (config) VALUES ('{
  "placement_points": {
    "1": 50,
    "2": 40,
    "3": 30,
    "4-9": 20,
    "10-25": 10
  },
  "kill_points": 2
}'::jsonb);

-- 8. session_teams (daily slots)
CREATE TABLE IF NOT EXISTS session_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scrims_sessions ON DELETE CASCADE,
  slot_number INT NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, slot_number)
);

ALTER TABLE point_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_teams ENABLE ROW LEVEL SECURITY;

-- point_system policies
CREATE POLICY "admin_read_points" ON point_system FOR SELECT USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_insert_points" ON point_system FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

-- session_teams policies
CREATE POLICY "admin_read_session_teams" ON session_teams FOR SELECT USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner', 'mod')));
CREATE POLICY "admin_insert_session_teams" ON session_teams FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_delete_session_teams" ON session_teams FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
