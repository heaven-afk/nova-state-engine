-- ============================================================
-- Nova Stat Engine — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name                TEXT NOT NULL,
    logo_url            TEXT,
    ocr_sensitivity     FLOAT DEFAULT 0.75,
    default_week_length INT DEFAULT 7,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    org_id       UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role         TEXT CHECK (role IN ('owner','admin','moderator')) DEFAULT 'moderator',
    display_name TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Invitations
CREATE TABLE IF NOT EXISTS invitations (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    role       TEXT CHECK (role IN ('admin','moderator')) DEFAULT 'moderator',
    token      TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
    accepted   BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Weeks
CREATE TABLE IF NOT EXISTS weeks (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name       TEXT NOT NULL,
    total_days INT DEFAULT 7,
    status     TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Days
CREATE TABLE IF NOT EXISTS days (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    week_id    UUID REFERENCES weeks(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Lobbies
CREATE TABLE IF NOT EXISTS lobbies (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    day_id       UUID REFERENCES days(id) ON DELETE CASCADE,
    lobby_number INT NOT NULL,
    status       TEXT DEFAULT 'pending',
    images       JSONB DEFAULT '[]'::JSONB
);

-- 7. OCR Records
CREATE TABLE IF NOT EXISTS ocr_records (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
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

-- 8. Player Stats (post-approval)
CREATE TABLE IF NOT EXISTS player_stats (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    week_id    UUID REFERENCES weeks(id) ON DELETE CASCADE,
    day_id     UUID REFERENCES days(id) ON DELETE CASCADE,
    lobby_id   UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    player_ign TEXT NOT NULL,
    kills      INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE days          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats  ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- organizations: read own org
CREATE POLICY "org_select" ON organizations FOR SELECT USING (id = get_user_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (id = get_user_org_id());

-- user_profiles: users see own profile
CREATE POLICY "profile_select_own" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profile_update_own" ON user_profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profile_insert"     ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());
-- admins/owners can see all profiles in their org
CREATE POLICY "profile_select_org" ON user_profiles FOR SELECT USING (org_id = get_user_org_id());

-- invitations
CREATE POLICY "invite_select" ON invitations FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "invite_insert" ON invitations FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "invite_update" ON invitations FOR UPDATE USING (org_id = get_user_org_id());

-- weeks
CREATE POLICY "weeks_all" ON weeks FOR ALL USING (org_id = get_user_org_id());

-- days
CREATE POLICY "days_all" ON days FOR ALL USING (org_id = get_user_org_id());

-- lobbies
CREATE POLICY "lobbies_all" ON lobbies FOR ALL USING (org_id = get_user_org_id());

-- ocr_records
CREATE POLICY "ocr_all" ON ocr_records FOR ALL USING (org_id = get_user_org_id());

-- player_stats
CREATE POLICY "stats_all" ON player_stats FOR ALL USING (org_id = get_user_org_id());
