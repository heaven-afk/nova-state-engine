/**
 * stats-engine.js — Nova Stat Engine
 * Aggregation engine for daily/weekly leaderboards
 */

import { getWeeklyStats, getDailyStats } from './db.js';

/**
 * Get full stats tree for a week: days → lobbies → players
 */
export async function getAggregatedStatsTree(weekId) {
    const rawStats = await getWeeklyStats(weekId);
    if (!rawStats || rawStats.length === 0) return { days: {}, players: {} };

    const dayMap = {};
    const playerMap = {};

    for (const stat of rawStats) {
        const dId = stat.day_id;
        const ign = stat.player_ign;
        const kills = stat.kills || 0;

        // Day breakdown
        if (!dayMap[dId]) dayMap[dId] = { players: {} };
        if (!dayMap[dId].players[ign]) {
            dayMap[dId].players[ign] = { name: ign, lobbies: {}, dailyTotal: 0 };
        }
        dayMap[dId].players[ign].dailyTotal += kills;
        dayMap[dId].players[ign].lobbies[stat.lobby_id] = kills;

        // Player breakdown
        if (!playerMap[ign]) {
            playerMap[ign] = {
                name: ign, weeklyTotal: 0, lobbiesPlayed: 0,
                dailyBreakdown: {}
            };
        }
        playerMap[ign].weeklyTotal += kills;
        playerMap[ign].lobbiesPlayed += 1;
        if (!playerMap[ign].dailyBreakdown[dId]) playerMap[ign].dailyBreakdown[dId] = 0;
        playerMap[ign].dailyBreakdown[dId] += kills;
    }

    // Compute averages
    Object.values(playerMap).forEach(p => {
        const activeDays = Object.values(p.dailyBreakdown);
        p.daysPlayed = activeDays.length;
        p.avgKillsPerDay = p.daysPlayed > 0 ? (p.weeklyTotal / p.daysPlayed).toFixed(1) : '0.0';
        p.avgKillsPerLobby = p.lobbiesPlayed > 0 ? (p.weeklyTotal / p.lobbiesPlayed).toFixed(1) : '0.0';
        p.bestDayKills = activeDays.length > 0 ? Math.max(...activeDays) : 0;
        p.worstDayKills = activeDays.length > 0 ? Math.min(...activeDays) : 0;
    });

    return { days: dayMap, players: playerMap };
}

/**
 * Daily leaderboard sorted by total kills
 */
export async function getDailyLeaderboard(weekId, dayId) {
    const tree = await getAggregatedStatsTree(weekId);
    if (!tree.days[dayId]) return [];
    return Object.values(tree.days[dayId].players)
        .sort((a, b) => b.dailyTotal - a.dailyTotal);
}

/**
 * Weekly leaderboard sorted by total kills
 */
export async function getWeeklyLeaderboard(weekId) {
    const tree = await getAggregatedStatsTree(weekId);
    if (!tree.players) return [];
    return Object.values(tree.players)
        .sort((a, b) => b.weeklyTotal - a.weeklyTotal);
}
