/**
 * supabase-db.js
 * Nova Stat Engine — Supabase Database Layer (User-Scoped)
 */

import { supabase, getUser } from './auth.js';

async function uid() {
    const u = await getUser();
    return u?.id;
}

// ─── WEEKS ───────────────────────────────────────────────────────────────────

export async function createWeek(name, totalDays = 7) {
    const userId = await uid();
    const { data: week, error } = await supabase
        .from('weeks')
        .insert({ user_id: userId, name, total_days: totalDays })
        .select().single();
    if (error) throw error;

    const days = Array.from({ length: totalDays }, (_, i) => ({
        user_id: userId, week_id: week.id, day_number: i + 1
    }));
    const { data: createdDays, error: dayErr } = await supabase.from('days').insert(days).select();
    if (dayErr) throw dayErr;

    const lobbies = createdDays.flatMap(d =>
        [1, 2, 3].map(l => ({ user_id: userId, day_id: d.id, lobby_number: l }))
    );
    await supabase.from('lobbies').insert(lobbies);
    return week;
}

export async function getAllWeeks() {
    const { data, error } = await supabase.from('weeks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getWeek(weekId) {
    const { data, error } = await supabase.from('weeks').select('*').eq('id', weekId).single();
    if (error) throw error;
    return data;
}

export async function deleteWeek(weekId) {
    const { error } = await supabase.from('weeks').delete().eq('id', weekId);
    if (error) throw error;
}

// ─── DAYS ────────────────────────────────────────────────────────────────────

export async function getDaysByWeek(weekId) {
    const { data, error } = await supabase.from('days').select('*').eq('week_id', weekId).order('day_number');
    if (error) throw error;
    return data || [];
}

// ─── LOBBIES ─────────────────────────────────────────────────────────────────

export async function getLobby(lobbyId) {
    const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();
    if (error) throw error;
    return data;
}

export async function getLobbiesByDay(dayId) {
    const { data, error } = await supabase.from('lobbies').select('*').eq('day_id', dayId).order('lobby_number');
    if (error) throw error;
    return data || [];
}

export async function updateLobbyImages(lobbyId, imagesBase64) {
    const { error } = await supabase.from('lobbies').update({ images: imagesBase64 }).eq('id', lobbyId);
    if (error) throw error;
}

export async function updateLobbyStatus(lobbyId, status) {
    const { error } = await supabase.from('lobbies').update({ status }).eq('id', lobbyId);
    if (error) throw error;
}

// ─── OCR RECORDS ─────────────────────────────────────────────────────────────

export async function saveRawOCRRecords(lobbyId, records) {
    const userId = await uid();
    await supabase.from('ocr_records').delete().eq('lobby_id', lobbyId);

    const rows = records.map(r => ({
        user_id: userId, lobby_id: lobbyId,
        source_image: r.sourceImage, raw_player_name: r.rawPlayerName,
        normalized_name: r.normalizedName, raw_kills: r.rawKills,
        normalized_kills: r.normalizedKills, team_slot: r.teamSlot,
        confidence_level: r.confidenceLevel, is_duplicate: r.isDuplicate || false
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('ocr_records').insert(rows);
        if (error) throw error;
    }
    await updateLobbyStatus(lobbyId, 'reviewing');
}

export async function getOCRRecordsByLobby(lobbyId) {
    const { data, error } = await supabase.from('ocr_records').select('*').eq('lobby_id', lobbyId);
    if (error) throw error;
    return (data || []).map(r => ({
        id: r.id, lobbyId: r.lobby_id, sourceImage: r.source_image,
        rawPlayerName: r.raw_player_name, normalizedName: r.normalized_name,
        rawKills: r.raw_kills, normalizedKills: r.normalized_kills,
        teamSlot: r.team_slot, confidenceLevel: r.confidence_level,
        isDuplicate: r.is_duplicate
    }));
}

// ─── PLAYER STATS ─────────────────────────────────────────────────────────────

export async function approveLobbyStats(weekId, dayId, lobbyId, finalPlayerStats) {
    const userId = await uid();
    await supabase.from('player_stats').delete().eq('lobby_id', lobbyId);

    const rows = finalPlayerStats.map(s => ({
        user_id: userId, week_id: weekId, day_id: dayId, lobby_id: lobbyId,
        player_ign: s.normalizedName || s.playerIgn,
        kills: s.normalizedKills ?? s.kills
    }));
    if (rows.length > 0) {
        const { error } = await supabase.from('player_stats').insert(rows);
        if (error) throw error;
    }

    await updateLobbyStatus(lobbyId, 'approved');

    const allLobbies = await getLobbiesByDay(dayId);
    const allApproved = allLobbies.every(l => l.status === 'approved' || l.id === lobbyId);
    if (allApproved) {
        await supabase.from('days').update({ status: 'completed' }).eq('id', dayId);
    }
}

export async function getWeeklyStats(weekId) {
    const { data, error } = await supabase.from('player_stats').select('*').eq('week_id', weekId);
    if (error) throw error;
    return data || [];
}

export async function getDailyStats(dayId) {
    const { data, error } = await supabase.from('player_stats').select('*').eq('day_id', dayId);
    if (error) throw error;
    return data || [];
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

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
        totalWeeks:   (weeks.data || []).length,
        totalDays:    (days.data  || []).filter(d => d.status === 'completed').length,
        totalPlayers: uniquePlayers.size,
        totalLobbies: (lobbies.data || []).filter(l => l.status === 'approved').length
    };
}
