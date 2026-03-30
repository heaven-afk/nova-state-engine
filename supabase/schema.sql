-- Nova Stat Engine — Phase 1 Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ───────────────────────────────────────────────
-- USER PROFILES
-- ───────────────────────────────────────────────
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ───────────────────────────────────────────────
-- WEEKS
-- ───────────────────────────────────────────────
CREATE TABLE weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    total_days INT NOT NULL DEFAULT 7,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read weeks" ON weeks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert weeks" ON weeks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update weeks" ON weeks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete weeks" ON weeks FOR DELETE USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────
-- DAYS
-- ───────────────────────────────────────────────
CREATE TABLE days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read days" ON days FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert days" ON days FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update days" ON days FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete days" ON days FOR DELETE USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────
-- LOBBIES
-- ───────────────────────────────────────────────
CREATE TABLE lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    lobby_number INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'reviewing', 'approved')),
    images JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read lobbies" ON lobbies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert lobbies" ON lobbies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update lobbies" ON lobbies FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete lobbies" ON lobbies FOR DELETE USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────
-- OCR RECORDS (pre-approval staging)
-- ───────────────────────────────────────────────
CREATE TABLE ocr_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    source_image TEXT,
    raw_player_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    raw_kills TEXT DEFAULT '0',
    normalized_kills INT DEFAULT 0,
    team_slot INT,
    confidence REAL DEFAULT 0.95,
    is_duplicate BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ocr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read ocr_records" ON ocr_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert ocr_records" ON ocr_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update ocr_records" ON ocr_records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete ocr_records" ON ocr_records FOR DELETE USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────
-- PLAYER STATS (approved final stats)
-- ───────────────────────────────────────────────
CREATE TABLE player_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    player_ign TEXT NOT NULL,
    kills INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read player_stats" ON player_stats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert player_stats" ON player_stats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update player_stats" ON player_stats FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete player_stats" ON player_stats FOR DELETE USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────
-- INDEXES for performance
-- ───────────────────────────────────────────────
CREATE INDEX idx_days_week ON days(week_id);
CREATE INDEX idx_lobbies_day ON lobbies(day_id);
CREATE INDEX idx_ocr_lobby ON ocr_records(lobby_id);
CREATE INDEX idx_stats_week ON player_stats(week_id);
CREATE INDEX idx_stats_day ON player_stats(day_id);
CREATE INDEX idx_stats_lobby ON player_stats(lobby_id);
CREATE INDEX idx_stats_player ON player_stats(player_ign);
