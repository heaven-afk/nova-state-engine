-- NOVA GAMING NETWORK — Team Registry & Player Identity Schema
-- Run this ONCE in Supabase SQL Editor

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  team_logo TEXT, -- Holds Base64 string or URL
  team_manager TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enforce case-insensitive uniqueness for team names
CREATE UNIQUE INDEX IF NOT EXISTS teams_team_name_lower_idx ON teams (LOWER(team_name));

-- 2. Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_name TEXT UNIQUE NOT NULL,
  current_ign TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active'
);

-- 3. Create player_aliases table
CREATE TABLE IF NOT EXISTS player_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  alias_ign TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Alter player_stats table to add columns for registry tracking
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS professional_name TEXT;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- 5. Alter match_results table to add team link
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;

-- 7. Establish RLS policies

-- Teams policies
DROP POLICY IF EXISTS "public_read_teams" ON teams;
CREATE POLICY "public_read_teams" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_insert_teams" ON teams;
CREATE POLICY "admin_insert_teams" ON teams FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "admin_update_teams" ON teams;
CREATE POLICY "admin_update_teams" ON teams FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "owner_delete_teams" ON teams;
CREATE POLICY "owner_delete_teams" ON teams FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- Players policies
DROP POLICY IF EXISTS "public_read_players" ON players;
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_insert_players" ON players;
CREATE POLICY "admin_insert_players" ON players FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "admin_update_players" ON players;
CREATE POLICY "admin_update_players" ON players FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "owner_delete_players" ON players;
CREATE POLICY "owner_delete_players" ON players FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- Player Aliases policies
DROP POLICY IF EXISTS "public_read_player_aliases" ON player_aliases;
CREATE POLICY "public_read_player_aliases" ON player_aliases FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_insert_player_aliases" ON player_aliases;
CREATE POLICY "admin_insert_player_aliases" ON player_aliases FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "admin_update_player_aliases" ON player_aliases;
CREATE POLICY "admin_update_player_aliases" ON player_aliases FOR UPDATE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('admin','owner')));

DROP POLICY IF EXISTS "owner_delete_player_aliases" ON player_aliases;
CREATE POLICY "owner_delete_player_aliases" ON player_aliases FOR DELETE USING (EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='owner'));

-- 8. Create indexes for lookup optimization
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON player_aliases(player_id);
CREATE INDEX IF NOT EXISTS idx_player_aliases_ign ON player_aliases(alias_ign);
CREATE INDEX IF NOT EXISTS idx_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_team_id ON player_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_results_team_id ON match_results(team_id);
