/**
 * db.js — Nova Gaming Network
 * Supabase Database Layer
 */
import { supabase } from './supabase.js';

/* ── SCRIMS SESSIONS ───────────────────────────── */

export async function createSession(sessionName, date, lobbyCount, userId) {
    const { data, error } = await supabase.from('scrims_sessions').insert({
        session_name: sessionName, date, lobby_count: lobbyCount, created_by: userId
    }).select().single();
    if (error) throw error;
    return data;
}

export async function getSessionTeams(sessionId) {
    const { data, error } = await supabase.from('session_teams')
        .select('*').eq('session_id', sessionId).order('slot_number');
    if (error) throw error;
    return data || [];
}

export async function saveSessionTeams(teams) {
    if (!teams || teams.length === 0) return;
    const { error } = await supabase.from('session_teams').insert(teams);
    if (error) throw error;
}

export async function getPointSystem() {
    const { data, error } = await supabase.from('point_system')
        .select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    // Default fallback in case table is empty
    if (!data) return {
        placement_points: { "1": 50, "2": 40, "3": 30, "4-9": 20, "10-25": 10 },
        kill_points: 2
    };
    return data.config;
}

export async function savePointSystem(config, userId) {
    const { error } = await supabase.from('point_system').insert({
        config, updated_by: userId
    });
    if (error) throw error;
}


export async function getAllSessions() {
    const { data, error } = await supabase.from('scrims_sessions')
        .select('*').order('date', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getSession(id) {
    const { data, error } = await supabase.from('scrims_sessions')
        .select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export async function deleteSession(id) {
    const { error } = await supabase.from('scrims_sessions').delete().eq('id', id);
    if (error) throw error;
}

/* ── MATCH RESULTS ─────────────────────────────── */

export async function insertMatchResults(results) {
    const { data, error } = await supabase.from('match_results').insert(results).select();
    if (error) throw error;
    return data;
}

export async function getMatchResults(sessionId) {
    const { data, error } = await supabase.from('match_results')
        .select('*').eq('session_id', sessionId).order('lobby_number').order('placement');
    if (error) throw error;
    return data || [];
}

export async function getMatchResultsByLobby(sessionId, lobbyNumber) {
    const { data, error } = await supabase.from('match_results')
        .select('*').eq('session_id', sessionId).eq('lobby_number', lobbyNumber).order('placement');
    if (error) throw error;
    return data || [];
}

/* ── PLAYER STATS ──────────────────────────────── */

export async function insertPlayerStats(stats) {
    const { data, error } = await supabase.from('player_stats').insert(stats).select();
    if (error) throw error;
    return data;
}

export async function getPlayerStats(sessionId) {
    const { data, error } = await supabase.from('player_stats')
        .select('*').eq('session_id', sessionId).order('kills', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getTopFraggers(sessionId, limit = 10) {
    const { data, error } = await supabase.from('player_stats')
        .select('player_name, team_name, kills').eq('session_id', sessionId)
        .order('kills', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
}

export async function getGlobalPlayerStats() {
    const { data, error } = await supabase.from('player_stats')
        .select('player_name, team_name, kills, session_id');
    if (error) throw error;
    return data || [];
}

/* ── UPLOAD SESSIONS ───────────────────────────── */

export async function createUploadSession(userId, sessionId) {
    const { data, error } = await supabase.from('upload_sessions').insert({
        user_id: userId, session_id: sessionId, status: 'pending'
    }).select().single();
    if (error) throw error;
    return data;
}

export async function updateUploadSession(id, updates) {
    const { error } = await supabase.from('upload_sessions').update(updates).eq('id', id);
    if (error) throw error;
}

/* ── GFX EXPORTS ───────────────────────────────── */

export async function logGfxExport(userId, templateId, sessionId, configJson) {
    const { error } = await supabase.from('gfx_exports').insert({
        user_id: userId, template_id: templateId, session_id: sessionId, config_json: configJson
    });
    if (error) console.error('[DB] GFX export log failed:', error);
}

/* ── DASHBOARD AGGREGATES ──────────────────────── */

export async function getDashboardStats() {
    const [sessionsRes, resultsRes, playersRes] = await Promise.all([
        supabase.from('scrims_sessions').select('id, session_name, date, lobby_count', { count: 'exact' }),
        supabase.from('match_results').select('kills', { count: 'exact' }),
        supabase.from('player_stats').select('player_name')
    ]);

    const sessions = sessionsRes.data || [];
    const totalKills = (resultsRes.data || []).reduce((sum, r) => sum + (r.kills || 0), 0);
    const uniquePlayers = new Set((playersRes.data || []).map(p => p.player_name));
    const latestSession = sessions.length > 0 ? sessions[0] : null;

    return {
        totalSessions: sessions.length,
        totalKills,
        activePlayers: uniquePlayers.size,
        latestSession,
        recentSessions: sessions.slice(0, 5)
    };
}

/* ── PUBLIC STATS ──────────────────────────────── */

export async function getLatestSessionStats() {
    const { data: sessions } = await supabase.from('scrims_sessions')
        .select('*').order('date', { ascending: false }).limit(1);

    if (!sessions || sessions.length === 0) return null;
    const session = sessions[0];

    const [resultsRes, playersRes] = await Promise.all([
        supabase.from('match_results').select('*').eq('session_id', session.id).order('points', { ascending: false }),
        supabase.from('player_stats').select('*').eq('session_id', session.id).order('kills', { ascending: false })
    ]);

    // Aggregate team standings
    const teamMap = {};
    (resultsRes.data || []).forEach(r => {
        if (!teamMap[r.team_name]) teamMap[r.team_name] = { team_name: r.team_name, total_kills: 0, total_points: 0 };
        teamMap[r.team_name].total_kills += r.kills;
        teamMap[r.team_name].total_points += r.points;
    });
    const teams = Object.values(teamMap).sort((a, b) => b.total_points - a.total_points);

    return {
        session,
        teams,
        topFraggers: (playersRes.data || []).slice(0, 10),
        matchResults: resultsRes.data || []
    };
}
