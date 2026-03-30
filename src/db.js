/**
 * db.js — Nova Stat Engine
 * Supabase Database Layer (Clean Rebuild)
 */

import { supabase } from './auth.js';

/* ── WEEKS ──────────────────────────────────────────── */

export async function createWeek(name, totalDays = 7) {
    const { data: week, error } = await supabase
        .from('weeks').insert({ name, total_days: totalDays }).select().single();
    if (error) throw error;

    const days = Array.from({ length: totalDays }, (_, i) => ({
        week_id: week.id, day_number: i + 1
    }));
    const { data: createdDays, error: dayErr } = await supabase
        .from('days').insert(days).select();
    if (dayErr) throw dayErr;

    const lobbies = createdDays.flatMap(d =>
        [1, 2, 3].map(n => ({ day_id: d.id, lobby_number: n }))
    );
    await supabase.from('lobbies').insert(lobbies);
    return week;
}

export async function getAllWeeks() {
    const { data, error } = await supabase
        .from('weeks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getWeek(weekId) {
    const { data, error } = await supabase
        .from('weeks').select('*').eq('id', weekId).single();
    if (error) throw error;
    return data;
}

export async function deleteWeek(weekId) {
    const { error } = await supabase.from('weeks').delete().eq('id', weekId);
    if (error) throw error;
}

export async function updateWeekStatus(weekId, status) {
    const { error } = await supabase.from('weeks').update({ status }).eq('id', weekId);
    if (error) throw error;
}

/* ── DAYS ───────────────────────────────────────────── */

export async function getDaysByWeek(weekId) {
    const { data, error } = await supabase
        .from('days').select('*').eq('week_id', weekId).order('day_number');
    if (error) throw error;
    return data || [];
}

export async function updateDayStatus(dayId, status) {
    const { error } = await supabase.from('days').update({ status }).eq('id', dayId);
    if (error) throw error;
}

/* ── LOBBIES ────────────────────────────────────────── */

export async function getLobby(lobbyId) {
    const { data, error } = await supabase
        .from('lobbies').select('*').eq('id', lobbyId).single();
    if (error) throw error;
    return data;
}

export async function getLobbiesByDay(dayId) {
    const { data, error } = await supabase
        .from('lobbies').select('*').eq('day_id', dayId).order('lobby_number');
    if (error) throw error;
    return data || [];
}

export async function updateLobbyImages(lobbyId, imagesBase64) {
    const { error } = await supabase
        .from('lobbies').update({ images: imagesBase64, status: 'uploaded' }).eq('id', lobbyId);
    if (error) throw error;
}

export async function updateLobbyStatus(lobbyId, status) {
    const { error } = await supabase.from('lobbies').update({ status }).eq('id', lobbyId);
    if (error) throw error;
}

/* ── OCR RECORDS ────────────────────────────────────── */

export async function saveOCRRecords(lobbyId, records) {
    await supabase.from('ocr_records').delete().eq('lobby_id', lobbyId);
    const rows = records.map(r => ({
        lobby_id: lobbyId,
        source_image: r.sourceImage,
        raw_player_name: r.rawPlayerName,
        normalized_name: r.normalizedName,
        raw_kills: String(r.rawKills || '0'),
        normalized_kills: parseInt(r.normalizedKills) || 0,
        team_slot: r.teamSlot === 'Unknown' ? null : parseInt(r.teamSlot) || null,
        confidence: r.confidence ?? 0.95,
        is_duplicate: r.isDuplicate || false
    }));
    if (rows.length > 0) {
        const { error } = await supabase.from('ocr_records').insert(rows);
        if (error) throw error;
    }
    await updateLobbyStatus(lobbyId, 'reviewing');
}

export async function getOCRRecordsByLobby(lobbyId) {
    const { data, error } = await supabase
        .from('ocr_records').select('*').eq('lobby_id', lobbyId);
    if (error) throw error;
    return (data || []).map(r => ({
        id: r.id, lobbyId: r.lobby_id, sourceImage: r.source_image,
        rawPlayerName: r.raw_player_name, normalizedName: r.normalized_name,
        rawKills: r.raw_kills, normalizedKills: r.normalized_kills,
        teamSlot: r.team_slot, confidence: r.confidence,
        isDuplicate: r.is_duplicate
    }));
}

export async function updateOCRRecord(recordId, updates) {
    const { error } = await supabase.from('ocr_records')
        .update({ normalized_name: updates.normalizedName, normalized_kills: updates.normalizedKills })
        .eq('id', recordId);
    if (error) throw error;
}

export async function deleteOCRRecord(recordId) {
    const { error } = await supabase.from('ocr_records').delete().eq('id', recordId);
    if (error) throw error;
}

/* ── PLAYER STATS ───────────────────────────────────── */

export async function approveLobbyStats(weekId, dayId, lobbyId, players) {
    await supabase.from('player_stats').delete().eq('lobby_id', lobbyId);
    const rows = players.map(p => ({
        week_id: weekId, day_id: dayId, lobby_id: lobbyId,
        player_ign: p.normalizedName || p.playerIgn,
        kills: p.normalizedKills ?? p.kills ?? 0
    }));
    if (rows.length > 0) {
        const { error } = await supabase.from('player_stats').insert(rows);
        if (error) throw error;
    }
    await updateLobbyStatus(lobbyId, 'approved');
    const allLobbies = await getLobbiesByDay(dayId);
    if (allLobbies.every(l => l.status === 'approved')) {
        await updateDayStatus(dayId, 'completed');
    }
}

export async function getWeeklyStats(weekId) {
    const { data, error } = await supabase
        .from('player_stats').select('*').eq('week_id', weekId);
    if (error) throw error;
    return data || [];
}

export async function getDailyStats(dayId) {
    const { data, error } = await supabase
        .from('player_stats').select('*').eq('day_id', dayId);
    if (error) throw error;
    return data || [];
}

/* ── DASHBOARD ──────────────────────────────────────── */

export async function getDashboardStats() {
    const [weeks, days, players, lobbies] = await Promise.all([
        supabase.from('weeks').select('id, name, status').order('created_at', { ascending: false }),
        supabase.from('days').select('id, status'),
        supabase.from('player_stats').select('player_ign'),
        supabase.from('lobbies').select('id, status')
    ]);
    const activeWeek = (weeks.data || []).find(w => w.status === 'active');
    const uniquePlayers = new Set((players.data || []).map(p => p.player_ign));
    return {
        activeWeek,
        totalWeeks: (weeks.data || []).length,
        totalDays: (days.data || []).filter(d => d.status === 'completed').length,
        totalPlayers: uniquePlayers.size,
        totalLobbies: (lobbies.data || []).filter(l => l.status === 'approved').length
    };
}
