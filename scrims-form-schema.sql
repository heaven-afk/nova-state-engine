-- NOVA GAMING NETWORK — Scrims Form System Schema
-- Run this in Supabase SQL Editor

-- 1. Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create scoring_rules table
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  placement_points JSONB NOT NULL,
  kill_point_value NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create scrims table
CREATE TABLE IF NOT EXISTS scrims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  lobby_number INT NOT NULL,
  map TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create team_results table
CREATE TABLE IF NOT EXISTS team_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrim_id UUID REFERENCES scrims(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  placement INT NOT NULL,
  kills INT NOT NULL DEFAULT 0,
  points NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create player_results table
CREATE TABLE IF NOT EXISTS player_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrim_id UUID REFERENCES scrims(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL, -- snapshot of team
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  kills INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create form_history table
CREATE TABLE IF NOT EXISTS form_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('team','player')) NOT NULL,
  entity_id UUID NOT NULL,
  raw_form NUMERIC,
  decayed_form NUMERIC,
  confidence TEXT CHECK (confidence IN ('unranked','provisional','full')) NOT NULL,
  trend TEXT CHECK (trend IN ('up','down','flat','new')) NOT NULL,
  matches_used JSONB NOT NULL,
  last_played_date DATE,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create team_season_stats table
CREATE TABLE IF NOT EXISTS team_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  avg_placement NUMERIC NOT NULL DEFAULT 0,
  avg_points NUMERIC NOT NULL DEFAULT 0,
  top5_rate NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(team_id, season_id)
);

-- 8. Create player_season_stats table
CREATE TABLE IF NOT EXISTS player_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  matches_played INT NOT NULL DEFAULT 0,
  avg_kills NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(player_id, season_id)
);

-- Enable RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrims ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;

-- Establish RLS policies for SELECT (public)
CREATE POLICY "public_read_seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "public_read_scoring_rules" ON scoring_rules FOR SELECT USING (true);
CREATE POLICY "public_read_scrims" ON scrims FOR SELECT USING (true);
CREATE POLICY "public_read_team_results" ON team_results FOR SELECT USING (true);
CREATE POLICY "public_read_player_results" ON player_results FOR SELECT USING (true);
CREATE POLICY "public_read_form_history" ON form_history FOR SELECT USING (true);
CREATE POLICY "public_read_team_season_stats" ON team_season_stats FOR SELECT USING (true);
CREATE POLICY "public_read_player_season_stats" ON player_season_stats FOR SELECT USING (true);

-- Establish RLS policies for ALL/Insert/Update/Delete (Admins & Owners)
-- Note: Vercel serverless function uses service key which bypasses RLS, but we define these policies for integrity
CREATE POLICY "admin_all_seasons" ON seasons FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_scoring_rules" ON scoring_rules FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_scrims" ON scrims FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_team_results" ON team_results FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_player_results" ON player_results FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_form_history" ON form_history FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_team_season_stats" ON team_season_stats FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));
CREATE POLICY "admin_all_player_season_stats" ON player_season_stats FOR ALL USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scrims_season ON scrims(season_id);
CREATE INDEX IF NOT EXISTS idx_scrims_date ON scrims(date DESC, lobby_number DESC);
CREATE INDEX IF NOT EXISTS idx_team_results_team ON team_results(team_id);
CREATE INDEX IF NOT EXISTS idx_team_results_scrim ON team_results(scrim_id);
CREATE INDEX IF NOT EXISTS idx_player_results_player ON player_results(player_id);
CREATE INDEX IF NOT EXISTS idx_player_results_scrim ON player_results(scrim_id);
CREATE INDEX IF NOT EXISTS idx_form_history_entity ON form_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_form_history_computed ON form_history(computed_at DESC);
