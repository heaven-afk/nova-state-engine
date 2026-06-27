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
    const record = await getPointSystemRecord();
    return record.config;
}

export async function getPointSystemRecord() {
    const { data, error } = await supabase.from('point_system')
        .select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    // Default fallback in case table is empty.
    if (!data) return {
        config: {
            placement_points: { "1": 50, "2": 40, "3": 30, "4-9": 20, "10-25": 10 },
            kill_points: 2
        },
        updated_by: null,
        updated_at: null
    };
    return data;
}

export async function savePointSystem(config, userId) {
    const { data, error } = await supabase.from('point_system').insert({
        config, updated_by: userId
    }).select().single();
    if (error) throw error;
    return data;
}

export function calculatePoints(placement, kills, pointSystem) {
    const placementPoints = pointSystem?.placement_points || {};
    const killPoints = Number(pointSystem?.kill_points ?? 2);

    let placementPts = 0;
    const placementStr = String(placement);

    if (placementStr in placementPoints) {
        placementPts = Number(placementPoints[placementStr]);
    } else {
        // Fallback for legacy format: check if placement falls within range keys like "4-9" or "10-25"
        let found = false;
        for (const key of Object.keys(placementPoints)) {
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end) && placement >= start && placement <= end) {
                    placementPts = Number(placementPoints[key]);
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            // Fallback: use the points value of the highest defined placement position
            const numericKeys = Object.keys(placementPoints)
                .flatMap(key => key.includes('-') ? key.split('-').map(Number) : [Number(key)])
                .filter(n => !isNaN(n));
            if (numericKeys.length > 0) {
                const maxKey = Math.max(...numericKeys);
                let fallbackVal = 0;
                for (const key of Object.keys(placementPoints)) {
                    if (key.includes('-')) {
                        const [start, end] = key.split('-').map(Number);
                        if (!isNaN(start) && !isNaN(end) && maxKey >= start && maxKey <= end) {
                            fallbackVal = Number(placementPoints[key]);
                            break;
                        }
                    } else if (Number(key) === maxKey) {
                        fallbackVal = Number(placementPoints[key]);
                        break;
                    }
                }
                placementPts = fallbackVal;
            }
        }
    }

    return placementPts + ((Number(kills) || 0) * killPoints);
}

export async function recalculateMatchResultsForPointSystem(config) {
    const { data: results, error } = await supabase.from('match_results').select('*');
    if (error) throw error;
    if (!results || results.length === 0) return [];

    const updates = results.map(result => ({
        ...result,
        points: calculatePoints(result.placement, result.kills, config)
    }));
    const { data, error: upsertError } = await supabase.from('match_results').upsert(updates).select();
    if (upsertError) throw upsertError;
    return data || [];
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
        .select('*, teams(team_logo)').eq('session_id', sessionId).order('lobby_number').order('placement');
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
        .select('*, teams(team_logo)').eq('session_id', sessionId);
    if (error) throw error;
    if (!data) return [];

    const playerMap = {};
    data.forEach(p => {
        const name = p.professional_name || p.player_name;
        if (!playerMap[name]) {
            playerMap[name] = { 
                player_name: name, 
                professional_name: p.professional_name || p.player_name,
                ign: p.player_name,
                team_name: p.team_name, 
                kills: 0,
                team_logo: p.teams?.team_logo || null
            };
        }
        playerMap[name].kills += p.kills;
    });

    return Object.values(playerMap).sort((a, b) => b.kills - a.kills);
}

export async function getTopFraggers(sessionId, limit = 10) {
    const { data, error } = await supabase.from('player_stats')
        .select('player_name, professional_name, team_name, kills, teams(team_logo)').eq('session_id', sessionId);
    if (error) throw error;
    if (!data) return [];

    const playerMap = {};
    data.forEach(p => {
        const name = p.professional_name || p.player_name;
        if (!playerMap[name]) {
            playerMap[name] = { 
                player_name: name, 
                team_name: p.team_name, 
                kills: 0,
                team_logo: p.teams?.team_logo || null
            };
        }
        playerMap[name].kills += p.kills;
    });

    return Object.values(playerMap)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, limit);
}

export async function getGlobalPlayerStats() {
    const { data, error } = await supabase.from('player_stats')
        .select('player_name, professional_name, team_name, kills, session_id');
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
        supabase.from('player_stats').select('player_name, professional_name')
    ]);

    const sessions = sessionsRes.data || [];
    const totalKills = (resultsRes.data || []).reduce((sum, r) => sum + (r.kills || 0), 0);
    const uniquePlayers = new Set((playersRes.data || []).map(p => p.professional_name || p.player_name));
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

export async function getLatestSessionStats(sessionId = null) {
    let session;
    if (sessionId) {
        const { data, error } = await supabase.from('scrims_sessions')
            .select('*').eq('id', sessionId).maybeSingle();
        if (error) throw error;
        session = data;
    } else {
        const { data: sessions } = await supabase.from('scrims_sessions')
            .select('*').order('date', { ascending: false }).limit(1);
        if (!sessions || sessions.length === 0) return null;
        session = sessions[0];
    }

    const [resultsRes, playersRes] = await Promise.all([
        supabase.from('match_results').select('*, teams(team_logo)').eq('session_id', session.id).order('points', { ascending: false }),
        supabase.from('player_stats').select('*, teams(team_logo)').eq('session_id', session.id)
    ]);

    // Aggregate team standings
    const teamMap = {};
    (resultsRes.data || []).forEach(r => {
        if (!teamMap[r.team_name]) {
            teamMap[r.team_name] = { 
                team_name: r.team_name, 
                total_kills: 0, 
                total_points: 0,
                team_logo: r.teams?.team_logo || null
            };
        }
        teamMap[r.team_name].total_kills += r.kills;
        teamMap[r.team_name].total_points += r.points;
    });
    const teams = Object.values(teamMap).sort((a, b) => b.total_points - a.total_points);

    // Aggregate player stats
    const playerMap = {};
    (playersRes.data || []).forEach(p => {
        const name = p.professional_name || p.player_name;
        if (!playerMap[name]) {
            playerMap[name] = { 
                player_name: name, 
                team_name: p.team_name, 
                kills: 0,
                team_logo: p.teams?.team_logo || null
            };
        }
        playerMap[name].kills += p.kills;
    });
    const topFraggers = Object.values(playerMap)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 10);

    return {
        session,
        teams,
        topFraggers,
        matchResults: resultsRes.data || []
    };
}

/* ── REGISTRY & IDENTITY SYSTEM ──────────────── */

export async function getAllTeams() {
    const { data, error } = await supabase.from('teams').select('*').order('team_name');
    if (error) throw error;
    return data || [];
}

export async function getTeam(teamId) {
    const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
    if (error) throw error;
    return data;
}

export async function getAllPlayers() {
    const { data, error } = await supabase.from('players')
        .select('*, teams(team_name)')
        .order('professional_name');
    if (error) throw error;
    return data || [];
}

export async function getPlayer(playerId) {
    const { data, error } = await supabase.from('players')
        .select('*, teams(team_name)')
        .eq('id', playerId)
        .single();
    if (error) throw error;
    return data;
}

export async function getPlayerAliases(playerId) {
    const { data, error } = await supabase.from('player_aliases')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function getAllAliases() {
    const { data, error } = await supabase.from('player_aliases').select('*');
    if (error) throw error;
    return data || [];
}

/**
 * Find a player by their Professional Name or any registered Alias (case-insensitive)
 */
export async function findPlayerByIGN(ign) {
    const cleanIgn = String(ign).trim().toLowerCase();
    if (!cleanIgn) return null;

    // 1. Try to find exact match in players table (professional name)
    const { data: players, error: pError } = await supabase.from('players')
        .select('*, teams(id, team_name)')
        .ilike('professional_name', cleanIgn);
    
    if (pError) throw pError;
    if (players && players.length > 0) return players[0];

    // 2. Try to find match in aliases
    const { data: aliases, error: aError } = await supabase.from('player_aliases')
        .select('*, players(*, teams(id, team_name))')
        .ilike('alias_ign', cleanIgn);

    if (aError) throw aError;
    if (aliases && aliases.length > 0 && aliases[0].players) {
        return aliases[0].players;
    }

    return null;
}

/**
 * Save / import roster data
 */
export async function saveRegistryData(teamsToUpsert, playersToUpsert, aliasesToUpsert) {
    // 1. Fetch all existing teams to do case-insensitive resolution in memory
    const { data: existingTeams, error: fetchTeamsErr } = await supabase.from('teams').select('*');
    if (fetchTeamsErr) throw fetchTeamsErr;

    const existingTeamsMap = {};
    (existingTeams || []).forEach(t => {
        existingTeamsMap[t.team_name.toLowerCase()] = t;
    });

    const preparedTeams = [];
    teamsToUpsert.forEach(t => {
        const key = t.team_name.toLowerCase();
        if (existingTeamsMap[key]) {
            preparedTeams.push({
                id: existingTeamsMap[key].id,
                team_name: existingTeamsMap[key].team_name, // Retain database casing
                team_manager: t.team_manager || existingTeamsMap[key].team_manager,
                team_logo: t.team_logo || existingTeamsMap[key].team_logo
            });
        } else {
            preparedTeams.push({
                team_name: t.team_name,
                team_manager: t.team_manager || null,
                team_logo: t.team_logo || null
            });
        }
    });

    if (preparedTeams.length > 0) {
        const { error: tErr } = await supabase.from('teams').upsert(preparedTeams, { onConflict: 'id' });
        if (tErr) throw tErr;
    }

    // 2. Query team names to resolve IDs for players
    const { data: allTeams, error: teamsFetchErr } = await supabase.from('teams').select('id, team_name');
    if (teamsFetchErr) throw teamsFetchErr;
    const teamMap = {};
    allTeams.forEach(t => { teamMap[t.team_name.toLowerCase()] = t.id; });

    // Map team names to team IDs in player upsert list
    const preparedPlayers = playersToUpsert.map(p => {
        const teamNameKey = p.team_name ? p.team_name.toLowerCase() : null;
        return {
            professional_name: p.professional_name,
            current_ign: p.current_ign,
            status: p.status || 'active',
            team_id: teamNameKey ? teamMap[teamNameKey] : null
        };
    });

    // 3. Upsert players
    if (preparedPlayers.length > 0) {
        const { error: pErr } = await supabase.from('players').upsert(preparedPlayers, { onConflict: 'professional_name' });
        if (pErr) throw pErr;
    }

    // 4. Query players to resolve IDs for aliases
    const { data: allPlayers, error: playersFetchErr } = await supabase.from('players').select('id, professional_name');
    if (playersFetchErr) throw playersFetchErr;
    const playerMap = {};
    allPlayers.forEach(p => { playerMap[p.professional_name.toLowerCase()] = p.id; });

    // Map professional names to player IDs in aliases list
    const preparedAliases = [];
    const seenAliasKeys = new Set();
    
    aliasesToUpsert.forEach(a => {
        const pId = playerMap[a.professional_name.toLowerCase()];
        const key = `${pId}::${a.alias_ign.toLowerCase()}`;
        if (pId && !seenAliasKeys.has(key)) {
            seenAliasKeys.add(key);
            preparedAliases.push({
                player_id: pId,
                alias_ign: a.alias_ign
            });
        }
    });

    // 5. Upsert aliases
    if (preparedAliases.length > 0) {
        const { error: aErr } = await supabase.from('player_aliases').upsert(preparedAliases, { onConflict: 'alias_ign' });
        if (aErr) throw aErr;
    }
}

/**
 * Get dynamic career statistics for a player
 */
export async function getPlayerCareerStats(playerId) {
    const { data: stats, error } = await supabase.from('player_stats')
        .select('*, scrims_sessions(date, session_name)')
        .eq('player_id', playerId);
        
    if (error) throw error;
    
    const matches = stats ? stats.length : 0;
    let kills = 0;
    let damage = 0;
    let placementSum = 0;
    let wins = 0;

    if (stats && stats.length > 0) {
        stats.forEach(s => {
            kills += s.kills || 0;
            damage += s.damage || 0;
            placementSum += s.placement || 0;
            if (s.placement === 1) wins++;
        });
    }

    const averagePlacement = matches > 0 ? (placementSum / matches).toFixed(1) : '0.0';
    const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0.0';
    const kdRatio = matches > 0 ? (kills / Math.max(1, matches - wins)).toFixed(2) : '0.00';

    return {
        matches,
        kills,
        damage,
        averagePlacement,
        wins,
        winRate,
        kdRatio,
        history: stats || []
    };
}

/**
 * Get dynamic statistics for a team
 */
export async function getTeamStats(teamId, teamName) {
    // 1. Fetch team matches results
    const { data: results, error: rErr } = await supabase.from('match_results')
        .select('*')
        .eq('team_id', teamId);
    if (rErr) throw rErr;

    const matches = results ? results.length : 0;
    let kills = 0;
    let damage = 0;
    let wins = 0;
    let top5 = 0;
    let top10 = 0;
    let placementSum = 0;

    if (results && results.length > 0) {
        results.forEach(r => {
            kills += r.kills || 0;
            damage += r.damage || 0;
            placementSum += r.placement || 0;
            if (r.placement === 1) wins++;
            if (r.placement <= 5) top5++;
            if (r.placement <= 10) top10++;
        });
    }

    const averagePlacement = matches > 0 ? (placementSum / matches).toFixed(1) : '0.0';
    const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0.0';
    const killsPerMatch = matches > 0 ? (kills / matches).toFixed(1) : '0.0';
    const damagePerMatch = matches > 0 ? (damage / matches).toFixed(1) : '0.0';

    return {
        matches,
        kills,
        damage,
        averagePlacement,
        wins,
        top5,
        top10,
        winRate,
        killsPerMatch,
        damagePerMatch
    };
}

/**
 * Search registry for global search bar
 */
export async function searchRegistry(searchQuery) {
    const clean = String(searchQuery).trim().toLowerCase();
    if (!clean) return { players: [], teams: [] };

    // Search teams
    const { data: teams, error: tErr } = await supabase.from('teams')
        .select('*')
        .or(`team_name.ilike.%${clean}%,team_manager.ilike.%${clean}%`)
        .limit(10);
    if (tErr) throw tErr;

    // Search players directly
    const { data: players, error: pErr } = await supabase.from('players')
        .select('*, teams(team_name)')
        .or(`professional_name.ilike.%${clean}%,current_ign.ilike.%${clean}%`)
        .limit(10);
    if (pErr) throw pErr;

    // Search aliases
    const { data: aliases, error: aErr } = await supabase.from('player_aliases')
        .select('*, players(*, teams(team_name))')
        .ilike('alias_ign', `%${clean}%`)
        .limit(10);
    if (aErr) throw aErr;

    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });
    (aliases || []).forEach(a => {
        if (a.players && !playerMap[a.players.id]) {
            playerMap[a.players.id] = {
                ...a.players,
                teams: a.players.teams // preserve team information
            };
        }
    });

    return {
        teams: teams || [],
        players: Object.values(playerMap)
    };
}

/**
 * Manually create a new team record
 */
export async function createTeam(team) {
    const cleanName = String(team.team_name || '').trim();
    if (!cleanName) throw new Error("Team name cannot be empty");

    // Check if team already exists case-insensitively
    const { data: existing, error: findErr } = await supabase.from('teams')
        .select('*')
        .ilike('team_name', cleanName)
        .maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
        // If it exists, update it instead of creating a new one (to prevent duplicates)
        const updates = {};
        if (team.team_manager !== undefined) updates.team_manager = team.team_manager;
        if (team.team_logo !== undefined) updates.team_logo = team.team_logo;
        
        if (Object.keys(updates).length > 0) {
            const { data, error } = await supabase.from('teams')
                .update(updates)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
        return existing;
    }

    const { data, error } = await supabase.from('teams').insert({
        team_name: cleanName,
        team_manager: team.team_manager || null,
        team_logo: team.team_logo || null
    }).select().single();
    if (error) throw error;
    return data;
}

/**
 * Manually create a new player record, registering aliases
 */
export async function createPlayer(player) {
    // 1. Insert player
    const { data: newPlayer, error: pErr } = await supabase.from('players').insert({
        professional_name: player.professional_name,
        current_ign: player.current_ign || player.professional_name,
        team_id: player.team_id || null,
        status: player.status || 'active'
    }).select().single();
    if (pErr) throw pErr;

    // 2. Insert primary alias (professional name)
    const { error: aErr1 } = await supabase.from('player_aliases').insert({
        player_id: newPlayer.id,
        alias_ign: player.professional_name
    });
    if (aErr1) throw aErr1;

    // 3. Insert secondary alias (current IGN) if different
    if (player.current_ign && player.current_ign.toLowerCase() !== player.professional_name.toLowerCase()) {
        const { error: aErr2 } = await supabase.from('player_aliases').insert({
            player_id: newPlayer.id,
            alias_ign: player.current_ign
        });
        if (aErr2) throw aErr2;
    }

    return newPlayer;
}

/**
 * Update team details with case-insensitive uniqueness check
 */
export async function updateTeam(teamId, updates) {
    const preparedUpdates = {};
    
    if (updates.team_name !== undefined) {
        const cleanName = String(updates.team_name || '').trim();
        if (!cleanName) throw new Error("Team name cannot be empty");

        // Check if team name is already taken case-insensitively by another team
        const { data: existing, error: findErr } = await supabase.from('teams')
            .select('id')
            .ilike('team_name', cleanName)
            .maybeSingle();
        if (findErr) throw findErr;
        
        if (existing && existing.id !== teamId) {
            throw new Error(`Team name "${cleanName}" is already taken by another team.`);
        }
        preparedUpdates.team_name = cleanName;
    }

    if (updates.team_manager !== undefined) preparedUpdates.team_manager = updates.team_manager || null;
    if (updates.team_logo !== undefined) preparedUpdates.team_logo = updates.team_logo || null;

    const { data, error } = await supabase.from('teams')
        .update(preparedUpdates)
        .eq('id', teamId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * Update player identity details, registering new aliases if the IGN changes
 */
export async function updatePlayer(playerId, updates) {
    const { data: oldPlayer, error: fetchErr } = await supabase
        .from('players')
        .select('current_ign')
        .eq('id', playerId)
        .single();
    if (fetchErr) throw fetchErr;

    const preparedUpdates = {};
    if (updates.current_ign !== undefined) preparedUpdates.current_ign = String(updates.current_ign || '').trim() || null;
    if (updates.team_id !== undefined) preparedUpdates.team_id = updates.team_id || null;
    if (updates.status !== undefined) preparedUpdates.status = updates.status;

    const { data: newPlayer, error } = await supabase
        .from('players')
        .update(preparedUpdates)
        .eq('id', playerId)
        .select()
        .single();
    if (error) throw error;

    // Add new alias if the IGN changed
    if (preparedUpdates.current_ign && preparedUpdates.current_ign.toLowerCase() !== (oldPlayer.current_ign || '').toLowerCase()) {
        const { data: existingAlias } = await supabase
            .from('player_aliases')
            .select('id')
            .eq('player_id', playerId)
            .ilike('alias_ign', preparedUpdates.current_ign)
            .maybeSingle();

        if (!existingAlias) {
            await supabase.from('player_aliases').insert({
                player_id: playerId,
                alias_ign: preparedUpdates.current_ign
            });
        }
    }

    return newPlayer;
}
