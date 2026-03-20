-- ============================================================
-- Nova Stat Engine — Simplified Schema (User-Scoped)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Step 1: Drop existing tables (clean slate)
DROP TABLE IF EXISTS player_stats  CASCADE;
DROP TABLE IF EXISTS ocr_records   CASCADE;
DROP TABLE IF EXISTS lobbies       CASCADE;
DROP TABLE IF EXISTS days          CASCADE;
DROP TABLE IF EXISTS weeks         CASCADE;
DROP TABLE IF EXISTS invitations   CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Step 2: User Profiles (no org, just display name + role)
CREATE TABLE user_profiles (
    id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT,
    role         TEXT CHECK (role IN ('admin','moderator')) DEFAULT 'admin',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Weeks
CREATE TABLE weeks (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name       TEXT NOT NULL,
    total_days INT DEFAULT 7,
    status     TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Days
CREATE TABLE days (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    week_id    UUID REFERENCES weeks(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Lobbies
CREATE TABLE lobbies (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    day_id       UUID REFERENCES days(id) ON DELETE CASCADE,
    lobby_number INT NOT NULL,
    status       TEXT DEFAULT 'pending',
    images       JSONB DEFAULT '[]'::JSONB
);

-- Step 6: OCR Records
CREATE TABLE ocr_records (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    lobby_id         UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    source_image     TEXT,
    raw_player_name  TEXT,
    normalized_name  TEXT,
    raw_kills        INT,
    normalized_kills INT,
    team_slot        TEXT,
    confidence_level TEXT,
    is_duplicate     BOOLEAN DEFAULT FALSE
);

-- Step 7: Player Stats
CREATE TABLE player_stats (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    week_id    UUID REFERENCES weeks(id) ON DELETE CASCADE,
    day_id     UUID REFERENCES days(id) ON DELETE CASCADE,
    lobby_id   UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    player_ign TEXT NOT NULL,
    kills      INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 8: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE days          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats  ENABLE ROW LEVEL SECURITY;

-- Step 9: RLS Policies (users only see their own data)
CREATE POLICY "profile_own" ON user_profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "weeks_own"   ON weeks         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "days_own"    ON days          FOR ALL USING (user_id = auth.uid());
CREATE POLICY "lobbies_own" ON lobbies       FOR ALL USING (user_id = auth.uid());
CREATE POLICY "ocr_own"     ON ocr_records   FOR ALL USING (user_id = auth.uid());
CREATE POLICY "stats_own"   ON player_stats  FOR ALL USING (user_id = auth.uid());
