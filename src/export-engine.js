/**
 * export-engine.js
 * Handles CSV generation and Image Generation (via HTML2Canvas).
 */

import html2canvas from 'html2canvas';
import { getDailyLeaderboard, getWeeklyLeaderboard } from './stats-engine.js';

// --- CSV EXPORTS ---

export async function exportDailyCSV(weekId, dayId, dayNumber) {
    // In production, fetch real data
    // const data = await getDailyLeaderboard(weekId, dayId);
    
    // Mock Data for demo functionality
    const data = [
        { rank: 1, ign: 'Nova|Shadow', L1: 14, L2: 10, L3: 8, total: 32 },
        { rank: 2, ign: 'T1_Viper', L1: 12, L2: 12, L3: 4, total: 28 },
        { rank: 3, ign: 'Gh0st-RY', L1: 9, L2: 8, L3: 9, total: 26 },
        { rank: 4, ign: 'Rogue.Aim', L1: 3, L2: 5, L3: 7, total: 15 }
    ];

    const headers = ['Rank', 'Player IGN', 'Lobby 1 Kills', 'Lobby 2 Kills', 'Lobby 3 Kills', 'Daily Total Kills'];
    const rows = data.map(d => [d.rank, d.ign, d.L1, d.L2, d.L3, d.total].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(csvContent, `NovaScrims_Day${dayNumber}_Leaderboard.csv`, 'text/csv');
}

export async function exportWeeklyCSV(weekId, weekName) {
    // const data = await getWeeklyLeaderboard(weekId);
    const data = [
        { rank: 1, ign: 'Nova|Shadow', days: 5, apd: 28.4, apl: 9.4, best: 32, total: 142 },
        { rank: 2, ign: 'T1_Viper', days: 5, apd: 26.0, apl: 8.6, best: 28, total: 130 },
        { rank: 3, ign: 'Gh0st-RY', days: 4, apd: 30.5, apl: 10.1, best: 36, total: 122 },
    ];

    const headers = ['Rank', 'Player IGN', 'Days Played', 'Avg Kills/Day', 'Avg Kills/Lobby', 'Best Day Kills', 'Total Weekly Kills'];
    const rows = data.map(d => [d.rank, d.ign, d.days, d.apd, d.apl, d.best, d.total].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(csvContent, `NovaScrims_${weekName.replace(/\s+/g, '')}_Summary.csv`, 'text/csv');
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Slight delay so the browser has time to start the download before the object URL is revoked
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 500);
}

// --- IMAGE EXPORTS (Top 15 Templates) ---

/**
 * 1. Elite Esports (Neon Cyber)
 * 2. Minimal Professional (Clean Dark)
 * 3. Tournament Broadcast (Blocky/Heavy)
 * 4. Card-based (Grid of player cards)
 * 5. Futuristic UI (Holographic blue overlay)
 */

export async function generateLeaderboardImage(templateId, listType, weekId, dayId = null) {
    // For the demo, we simulate the render process since we don't have the fully populated 
    // HTML DOM chunks for all 5 templates mapped in this file yet.
    
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mocking a successful canvas generation
            resolve(true);
        }, 1500);
    });
}
