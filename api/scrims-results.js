/**
 * /api/scrims-results.js
 * Ingests results for a scrim lobby and triggers form recomputations for teams and players.
 */
import { createClient } from '@supabase/supabase-js';

const WINDOW_SIZE = 3;
const GRACE_PERIOD_DAYS = 2;
const DECAY_RATE = 0.08;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const scrimId = req.query.id;
    if (!scrimId) {
        return res.status(400).json({ error: 'Scrim ID query parameter is required' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Supabase server credentials are not configured' });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        // 1. Fetch scrim details to verify existence and get season_id
        const { data: scrim, error: scrimErr } = await supabase
            .from('scrims')
            .select('*')
            .eq('id', scrimId)
            .maybeSingle();

        if (scrimErr) throw scrimErr;
        if (!scrim) {
            return res.status(404).json({ error: `Scrim with ID ${scrimId} not found` });
        }

        const seasonId = scrim.season_id;

        // 2. Fetch active scoring rules for the season
        const { data: scoringRule, error: ruleErr } = await supabase
            .from('scoring_rules')
            .select('*')
            .eq('season_id', seasonId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (ruleErr) throw ruleErr;
        if (!scoringRule) {
            return res.status(400).json({ error: `No scoring rules found for season ${seasonId}` });
        }

        const placementPoints = scoringRule.placement_points || {};
        const killPointValue = Number(scoringRule.kill_point_value ?? 1);

        const { team_results = [], player_results = [] } = req.body;

        // 3. Clear existing results for this scrim to support idempotent uploads
        const { error: delTeamErr } = await supabase.from('team_results').delete().eq('scrim_id', scrimId);
        if (delTeamErr) throw delTeamErr;

        const { error: delPlayerErr } = await supabase.from('player_results').delete().eq('scrim_id', scrimId);
        if (delPlayerErr) throw delPlayerErr;

        // 4. Save new team results (calculating points on ingestion)
        const teamInserts = team_results.map(r => {
            const placePts = Number(placementPoints[String(r.placement)] ?? 0);
            const pts = placePts + (Number(r.kills || 0) * killPointValue);
            return {
                scrim_id: scrimId,
                team_id: r.team_id,
                placement: r.placement,
                kills: r.kills || 0,
                points: pts
            };
        });

        let insertedTeamResults = [];
        if (teamInserts.length > 0) {
            const { data, error: teamInsErr } = await supabase.from('team_results').insert(teamInserts).select();
            if (teamInsErr) throw teamInsErr;
            insertedTeamResults = data || [];
        }

        // 5. Save new player results
        const playerInserts = player_results.map(r => ({
            scrim_id: scrimId,
            team_id: r.team_id,
            player_id: r.player_id,
            kills: r.kills || 0
        }));

        if (playerInserts.length > 0) {
            const { error: playerInsErr } = await supabase.from('player_results').insert(playerInserts);
            if (playerInsErr) throw playerInsErr;
        }

        // 6. Gather all unique team IDs and player IDs involved to recompute their form
        const teamIdsToRecompute = [...new Set(teamInserts.map(r => r.team_id))];
        const playerIdsToRecompute = [...new Set(playerInserts.map(r => r.player_id))];

        // Recompute Team Forms
        for (const teamId of teamIdsToRecompute) {
            await recomputeTeamForm(supabase, teamId, seasonId);
        }

        // Recompute Player Forms
        for (const playerId of playerIdsToRecompute) {
            await recomputePlayerForm(supabase, playerId, seasonId);
        }

        return res.status(200).json({
            message: 'Scrim results ingested successfully and form index updated.',
            scrimId,
            teamsUpdated: teamIdsToRecompute.length,
            playersUpdated: playerIdsToRecompute.length
        });

    } catch (err) {
        console.error('[Scrims Ingestion] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}

// Utility to calculate days inactive
function getDaysInactive(lastPlayedDateStr) {
    const today = new Date();
    const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const pDate = new Date(lastPlayedDateStr);
    const lpDate = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
    const diffTime = tDate - lpDate;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// Recalculates team form and logs it
async function recomputeTeamForm(supabase, teamId, seasonId) {
    // 1. Fetch all match results of the team
    const { data: rawRes, error: resErr } = await supabase
        .from('team_results')
        .select('id, points, placement, scrims(date, lobby_number)')
        .eq('team_id', teamId);
    if (resErr) throw resErr;

    // Filter by active season scrims and sort by date desc, lobby_number desc
    const sortedResults = (rawRes || [])
        .filter(r => r.scrims)
        .sort((a, b) => {
            const dateA = new Date(a.scrims.date);
            const dateB = new Date(b.scrims.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB - dateA;
            }
            return b.scrims.lobby_number - a.scrims.lobby_number;
        });

    const matchesCount = sortedResults.length;
    let confidence = 'unranked';
    let rawForm = null;
    let decayedForm = null;
    let trend = 'new';
    let lastPlayedDate = null;
    const matchesUsed = [];

    if (matchesCount > 0) {
        const currentWindowSize = Math.min(WINDOW_SIZE, matchesCount);
        confidence = currentWindowSize === 3 ? 'full' : 'provisional';
        lastPlayedDate = sortedResults[0].scrims.date;

        const currentWindow = sortedResults.slice(0, currentWindowSize);
        currentWindow.forEach(r => matchesUsed.push(r.id));

        // Compute weighted sum
        let weightedSum = 0;
        let weightSum = 0;
        currentWindow.forEach((r, idx) => {
            const weight = currentWindowSize - idx; // 3, 2, 1
            weightedSum += Number(r.points) * weight;
            weightSum += weight;
        });
        rawForm = weightedSum / weightSum;

        // Apply decay
        const days = getDaysInactive(lastPlayedDate);
        let multiplier = 1;
        if (days > GRACE_PERIOD_DAYS) {
            multiplier = Math.max(0, 1 - DECAY_RATE * (days - GRACE_PERIOD_DAYS));
        }
        decayedForm = rawForm * multiplier;

        // Determine trend
        if (matchesCount >= 4) {
            const prevWindowSize = Math.min(3, matchesCount - 3);
            const prevWindow = sortedResults.slice(3, 3 + prevWindowSize);

            let prevWeightedSum = 0;
            let prevWeightSum = 0;
            prevWindow.forEach((r, idx) => {
                const weight = prevWindowSize - idx;
                prevWeightedSum += Number(r.points) * weight;
                prevWeightSum += weight;
            });
            const prevRawForm = prevWeightedSum / prevWeightSum;

            if (rawForm > prevRawForm * 1.05) {
                trend = 'up';
            } else if (rawForm < prevRawForm * 0.95) {
                trend = 'down';
            } else {
                trend = 'flat';
            }
        }
    }

    // Upsert team form history log
    await supabase.from('form_history').insert({
        entity_type: 'team',
        entity_id: teamId,
        raw_form: rawForm,
        decayed_form: decayedForm,
        confidence,
        trend,
        matches_used: matchesUsed,
        last_played_date: lastPlayedDate
    });

    // Update team season aggregates
    if (matchesCount > 0) {
        const wins = sortedResults.filter(r => r.placement === 1).length;
        const totalPlacement = sortedResults.reduce((sum, r) => sum + r.placement, 0);
        const totalPoints = sortedResults.reduce((sum, r) => sum + Number(r.points), 0);
        const top5Count = sortedResults.filter(r => r.placement <= 5).length;

        await supabase.from('team_season_stats').upsert({
            team_id: teamId,
            season_id: seasonId,
            matches_played: matchesCount,
            wins,
            avg_placement: totalPlacement / matchesCount,
            avg_points: totalPoints / matchesCount,
            top5_rate: top5Count / matchesCount
        }, { onConflict: 'team_id,season_id' });
    }
}

// Recalculates player form and logs it
async function recomputePlayerForm(supabase, playerId, seasonId) {
    // 1. Fetch all match results of the player
    const { data: rawRes, error: resErr } = await supabase
        .from('player_results')
        .select('id, kills, scrims(date, lobby_number)')
        .eq('player_id', playerId);
    if (resErr) throw resErr;

    // Sort by date desc, lobby_number desc
    const sortedResults = (rawRes || [])
        .filter(r => r.scrims)
        .sort((a, b) => {
            const dateA = new Date(a.scrims.date);
            const dateB = new Date(b.scrims.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB - dateA;
            }
            return b.scrims.lobby_number - a.scrims.lobby_number;
        });

    const matchesCount = sortedResults.length;
    let confidence = 'unranked';
    let rawForm = null;
    let decayedForm = null;
    let trend = 'new';
    let lastPlayedDate = null;
    const matchesUsed = [];

    if (matchesCount > 0) {
        const currentWindowSize = Math.min(WINDOW_SIZE, matchesCount);
        confidence = currentWindowSize === 3 ? 'full' : 'provisional';
        lastPlayedDate = sortedResults[0].scrims.date;

        const currentWindow = sortedResults.slice(0, currentWindowSize);
        currentWindow.forEach(r => matchesUsed.push(r.id));

        // Compute weighted sum
        let weightedSum = 0;
        let weightSum = 0;
        currentWindow.forEach((r, idx) => {
            const weight = currentWindowSize - idx;
            weightedSum += Number(r.kills) * weight;
            weightSum += weight;
        });
        rawForm = weightedSum / weightSum;

        // Apply decay
        const days = getDaysInactive(lastPlayedDate);
        let multiplier = 1;
        if (days > GRACE_PERIOD_DAYS) {
            multiplier = Math.max(0, 1 - DECAY_RATE * (days - GRACE_PERIOD_DAYS));
        }
        decayedForm = rawForm * multiplier;

        // Determine trend
        if (matchesCount >= 4) {
            const prevWindowSize = Math.min(3, matchesCount - 3);
            const prevWindow = sortedResults.slice(3, 3 + prevWindowSize);

            let prevWeightedSum = 0;
            let prevWeightSum = 0;
            prevWindow.forEach((r, idx) => {
                const weight = prevWindowSize - idx;
                prevWeightedSum += Number(r.kills) * weight;
                prevWeightSum += weight;
            });
            const prevRawForm = prevWeightedSum / prevWeightSum;

            if (rawForm > prevRawForm * 1.05) {
                trend = 'up';
            } else if (rawForm < prevRawForm * 0.95) {
                trend = 'down';
            } else {
                trend = 'flat';
            }
        }
    }

    // Upsert player form history log
    await supabase.from('form_history').insert({
        entity_type: 'player',
        entity_id: playerId,
        raw_form: rawForm,
        decayed_form: decayedForm,
        confidence,
        trend,
        matches_used: matchesUsed,
        last_played_date: lastPlayedDate
    });

    // Update player season aggregates
    if (matchesCount > 0) {
        const totalKills = sortedResults.reduce((sum, r) => sum + r.kills, 0);

        await supabase.from('player_season_stats').upsert({
            player_id: playerId,
            season_id: seasonId,
            matches_played: matchesCount,
            avg_kills: totalKills / matchesCount
        }, { onConflict: 'player_id,season_id' });
    }
}
