/**
 * export-engine.js — Nova Stat Engine
 * Real CSV and image exports
 */

import html2canvas from 'html2canvas';
import { getDailyLeaderboard, getWeeklyLeaderboard } from './stats-engine.js';

/* ── CSV EXPORTS ────────────────────────────────────── */

export async function exportDailyCSV(weekId, dayId, dayLabel) {
    const data = await getDailyLeaderboard(weekId, dayId);
    if (data.length === 0) throw new Error('No data to export for this day.');

    const headers = ['Rank', 'Player IGN', 'Daily Total Kills'];
    const rows = data.map((d, i) => [i + 1, d.name, d.dailyTotal].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, `Nova_${dayLabel}_Leaderboard.csv`, 'text/csv');
}

export async function exportWeeklyCSV(weekId, weekName) {
    const data = await getWeeklyLeaderboard(weekId);
    if (data.length === 0) throw new Error('No data to export for this week.');

    const headers = ['Rank', 'Player IGN', 'Days Played', 'Avg/Day', 'Avg/Lobby', 'Best Day', 'Total Kills'];
    const rows = data.map((d, i) => [
        i + 1, d.name, d.daysPlayed, d.avgKillsPerDay,
        d.avgKillsPerLobby, d.bestDayKills, d.weeklyTotal
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, `Nova_${weekName.replace(/\s+/g, '_')}_Summary.csv`, 'text/csv');
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
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

/* ── IMAGE EXPORT ───────────────────────────────────── */

export async function exportLeaderboardImage(elementId) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error('Element not found for image export.');

    const canvas = await html2canvas(el, {
        backgroundColor: '#0a0a0f',
        scale: 2,
        useCORS: true
    });

    const link = document.createElement('a');
    link.download = 'Nova_Leaderboard.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}
