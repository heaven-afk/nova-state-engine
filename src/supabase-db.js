/**
 * supabase-db.js
 * Nova Stat Engine — Supabase Database Layer
 * Replaces the old IndexedDB db.js entirely.
 * All operations are automatically scoped to the current user's org via RLS.
 */

import { supabase } from './auth.js';

// ─── WEEKS ────────────────────────────────────────────────────────────────────

export async function createWeek(orgId, name, totalDays = 7) {
    // 1. Create week
    const { data: week, error: weekErr } = await supabase
        .from('weeks')
        .insert({ org_id: orgId, name, total_days: totalDays })
        .select()
        .single();
    if (weekErr) throw weekErr;

    // 2. Scaffold days and lobbies
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
        days.push({ org_id: orgId, week_id: week.id, day_number: d });
    }
    const { data: createdDays, error: dayErr } = await supabase.from('days').insert(days).select();
    if (dayErr) throw dayErr;

    const lobbies = [];
    for (const day of createdDays) {
        for (let l = 1; l <= 3; l++) {
            lobbies.push({ org_id: orgId, day_id: day.id, lobby_number: l });
        }
    }
    const { error: lobbyErr } = await supabase.from('lobbies').insert(lobbies);
    if (lobbyErr) throw lobbyErr;

    return week;
}

export async function getAllWeeks() {
    const { data, error } = await supabase
        .from('weeks')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
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

// ─── DAYS ─────────────────────────────────────────────────────────────────────

export async function getDaysByWeek(weekId) {
    const { data, error } = await supabase
        .from('days')
        .select('*')
        .eq('week_id', weekId)
        .order('day_number');
    if (error) throw error;
    return data;
}

// ─── LOBBIES ──────────────────────────────────────────────────────────────────

export async function getLobby(lobbyId) {
    const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();
    if (error) throw error;
    return data;
}

export async function getLobbiesByDay(dayId) {
    const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('day_id', dayId)
        .order('lobby_number');
    if (error) throw error;
    return data;
}

export async function updateLobbyImages(lobbyId, imagesBase64) {
    const { error } = await supabase
        .from('lobbies')
        .update({ images: imagesBase64 })
        .eq('id', lobbyId);
    if (error) throw error;
}

export async function updateLobbyStatus(lobbyId, status) {
    const { error } = await supabase.from('lobbies').update({ status }).eq('id', lobbyId);
    if (error) throw error;
}

// ─── OCR RECORDS ──────────────────────────────────────────────────────────────

export async function saveRawOCRRecords(orgId, lobbyId, records) {
    // Delete old records for this lobby
    await supabase.from('ocr_records').delete().eq('lobby_id', lobbyId);

    // Insert new records
    const rows = records.map(r => ({
        org_id:          orgId,
        lobby_id:        lobbyId,
        source_image:    r.sourceImage,
        raw_player_name: r.rawPlayerName,
        normalized_name: r.normalizedName,
        raw_kills:       r.rawKills,
        normalized_kills: r.normalizedKills,
        team_slot:       r.teamSlot,
        confidence_level: r.confidenceLevel,
        is_duplicate:    r.isDuplicate || false
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('ocr_records').insert(rows);
        if (error) throw error;
    }

    // Mark lobby as reviewing
    await updateLobbyStatus(lobbyId, 'reviewing');
}

export async function getOCRRecordsByLobby(lobbyId) {
    const { data, error } = await supabase
        .from('ocr_records')
        .select('*')
        .eq('lobby_id', lobbyId);
    if (error) throw error;
    // Map back to camelCase for frontend compatibility
    return (data || []).map(r => ({
        id:              r.id,
        lobbyId:         r.lobby_id,
        sourceImage:     r.source_image,
        rawPlayerName:   r.raw_player_name,
        normalizedName:  r.normalized_name,
        rawKills:        r.raw_kills,
        normalizedKills: r.normalized_kills,
        teamSlot:        r.team_slot,
        confidenceLevel: r.confidence_level,
        isDuplicate:     r.is_duplicate
    }));
}

export async function updateOCRRecord(recordId, updates) {
    const dbUpdates = {};
    if (updates.normalizedName  !== undefined) dbUpdates.normalized_name  = updates.normalizedName;
    if (updates.normalizedKills !== undefined) dbUpdates.normalized_kills = updates.normalizedKills;
    if (updates.confidenceLevel !== undefined) dbUpdates.confidence_level = updates.confidenceLevel;
    const { error } = await supabase.from('ocr_records').update(dbUpdates).eq('id', recordId);
    if (error) throw error;
}

// ─── PLAYER STATS (Post-approval) ─────────────────────────────────────────────

export async function approveLobbyStats(orgId, weekId, dayId, lobbyId, finalPlayerStats) {
    // Delete old stats for this lobby
    await supabase.from('player_stats').delete().eq('lobby_id', lobbyId);

    // Insert new stats
    const rows = finalPlayerStats.map(s => ({
        org_id:     orgId,
        week_id:    weekId,
        day_id:     dayId,
        lobby_id:   lobbyId,
        player_ign: s.normalizedName || s.playerIgn,
        kills:      s.normalizedKills || s.kills
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('player_stats').insert(rows);
        if (error) throw error;
    }

    // Mark lobby approved
    await updateLobbyStatus(lobbyId, 'approved');

    // Check if all lobbies in day are approved
    const allLobbies = await getLobbiesByDay(dayId);
    const allApproved = allLobbies.every(l => l.status === 'approved' || l.id === lobbyId);
    if (allApproved) {
        await supabase.from('days').update({ status: 'completed' }).eq('id', dayId);
    }
}

export async function getWeeklyStats(weekId) {
    const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('week_id', weekId);
    if (error) throw error;
    return data;
}

export async function getDailyStats(dayId) {
    const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('day_id', dayId);
    if (error) throw error;
    return data;
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export async function getDashboardStats() {
    const [weeks, days, players, lobbies] = await Promise.all([
        supabase.from('weeks').select('id, name, status').order('created_at', { ascending: false }),
        supabase.from('days').select('id, status'),
        supabase.from('player_stats').select('player_ign'),
        supabase.from('lobbies').select('id, status')
    ]);

    const activeWeek = weeks.data?.find(w => w.status === 'active');
    const uniquePlayers = new Set((players.data || []).map(p => p.player_ign));

    return {
        activeWeek:       activeWeek || null,
        totalWeeks:       (weeks.data || []).length,
        totalDays:        (days.data || []).filter(d => d.status === 'completed').length,
        totalPlayers:     uniquePlayers.size,
        totalLobbies:     (lobbies.data || []).filter(l => l.status === 'approved').length
    };
}

// ─── USERS & ORG MANAGEMENT ──────────────────────────────────────────────────

export async function getOrgMembers(orgId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at');
    if (error) throw error;
    return data;
}

export async function updateMemberRole(userId, role) {
    const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', userId);
    if (error) throw error;
}

export async function updateOrgSettings(orgId, settings) {
    const { error } = await supabase
        .from('organizations')
        .update(settings)
        .eq('id', orgId);
    if (error) throw error;
}

export async function inviteUser(orgId, email, role) {
    // Create invitation record — user will claim it on signup
    const { data, error } = await supabase
        .from('invitations')
        .insert({ org_id: orgId, email, role })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getPendingInvitations(orgId) {
    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('org_id', orgId)
        .eq('accepted', false)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}
