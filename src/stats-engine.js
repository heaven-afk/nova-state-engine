/**
 * stats-engine.js
 * Responsible for querying the IndexedDB ApprovedPlayerStats store
 * and computing Daily and Weekly aggregations.
 */

import { getWeeklyStats } from './db.js';

/**
 * Given a weekId, fetches all raw approved lobby row stats,
 * and groups them structurally by Day -> Lobby -> Player.
 * 
 * Returns the raw aggregated tree.
 */
export async function getAggregatedStatsTree(weekId) {
    const rawStats = await getWeeklyStats(weekId);
    if (!rawStats || rawStats.length === 0) return { days: {}, players: {} };

    // Structure:
    // days[dayId] = { summary, players[ign] = { name, L1, L2, L3, totalKills } }
    // players[ign] = { totalKills, daysPlayed, bestDay, worstDay, avgPerDay, avgPerLobby... }
    
    const dayMap = {};
    const playerMap = {};

    for (const stat of rawStats) {
        const dId = stat.dayId;
        const ign = stat.playerIgn;
        
        // 1. Initialize logic sets
        if (!dayMap[dId]) dayMap[dId] = { players: {} };
        if (!dayMap[dId].players[ign]) {
            dayMap[dId].players[ign] = { name: ign, L1: 0, L2: 0, L3: 0, dailyTotal: 0 };
        }
        if (!playerMap[ign]) {
            playerMap[ign] = { 
                name: ign, weeklyTotal: 0, lobbiesPlayed: 0, 
                dailyBreakdown: {} // Track kills per day to find best/worst
            };
        }

        // 2. Map Lobby Number to L1/L2/L3 column
        // stat.lobbyId format: wk_XXXX_day_X_lobby_X 
        const lobbyParts = stat.lobbyId.split('_lobby_');
        const lobbyNum = parseInt(lobbyParts[1] || '1', 10);
        
        // 3. Increment values
        dayMap[dId].players[ign][`L${lobbyNum}`] += stat.kills;
        dayMap[dId].players[ign].dailyTotal += stat.kills;
        
        playerMap[ign].weeklyTotal += stat.kills;
        playerMap[ign].lobbiesPlayed += 1;
        
        if (!playerMap[ign].dailyBreakdown[dId]) {
            playerMap[ign].dailyBreakdown[dId] = 0;
        }
        playerMap[ign].dailyBreakdown[dId] += stat.kills;
    }

    // 4. Compute Weekly Averages & Best/Worst
    Object.values(playerMap).forEach(p => {
        const activeDays = Object.values(p.dailyBreakdown);
        p.daysPlayed = activeDays.length;
        
        p.avgKillsPerDay = (p.weeklyTotal / p.daysPlayed).toFixed(1);
        p.avgKillsPerLobby = (p.weeklyTotal / p.lobbiesPlayed).toFixed(1);
        
        p.bestDayKills = Math.max(...activeDays);
        p.worstDayKills = Math.min(...activeDays);
    });

    return { days: dayMap, players: playerMap };
}

/**
 * Returns a sorted array representing the Daily Leaderboard Top-Down
 */
export async function getDailyLeaderboard(weekId, dayId) {
    const tree = await getAggregatedStatsTree(weekId);
    if (!tree.days[dayId]) return [];
    
    // Convert object map to array and sort by dailyTotal
    return Object.values(tree.days[dayId].players).sort((a, b) => b.dailyTotal - a.dailyTotal);
}

/**
 * Returns a sorted array representing the Full Weekly Leaderboard Top-Down
 */
export async function getWeeklyLeaderboard(weekId) {
    const tree = await getAggregatedStatsTree(weekId);
    if (!tree.players) return [];
    
    // Sort primarily by total weekly kills
    return Object.values(tree.players).sort((a, b) => b.weeklyTotal - a.weeklyTotal);
}
