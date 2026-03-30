import { initApp } from './router.js';
import { getDashboardStats, getWeeklyStats, getAllWeeks } from './db.js';
import { showToast } from './router.js';

await initApp('dashboard');

async function loadDashboard() {
    try {
        const stats = await getDashboardStats();

        setText('dash-active-week', stats.activeWeek?.name || 'No Active Week');
        setText('dash-players', stats.totalPlayers || 0);
        setText('dash-days', stats.totalDays || 0);
        setText('dash-lobbies', stats.totalLobbies || 0);

        // Load top players for active week
        if (stats.activeWeek) {
            const weekStats = await getWeeklyStats(stats.activeWeek.id);
            const playerMap = {};
            weekStats.forEach(s => {
                if (!playerMap[s.player_ign]) playerMap[s.player_ign] = { name: s.player_ign, kills: 0 };
                playerMap[s.player_ign].kills += s.kills;
            });
            const sorted = Object.values(playerMap).sort((a, b) => b.kills - a.kills).slice(0, 5);
            renderTopPlayers(sorted);
        }
    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderTopPlayers(players) {
    const list = document.getElementById('dash-top-list');
    const table = document.getElementById('dash-top-table');
    if (!list) return;

    if (players.length === 0) {
        list.innerHTML = '<div class="empty-state"><p class="text-muted">No player data yet</p></div>';
        return;
    }

    // Mobile: card list
    list.innerHTML = players.map((p, i) => {
        const rankClass = i < 3 ? ` rank-${i + 1}` : '';
        return `<div class="data-item">
            <div class="data-item-rank${rankClass}">${i + 1}</div>
            <div class="data-item-content">
                <div class="data-item-title">${p.name}</div>
            </div>
            <div class="data-item-value">${p.kills}</div>
        </div>`;
    }).join('');

    // Desktop: table
    if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = players.map((p, i) => `<tr>
                <td><div class="data-item-rank${i < 3 ? ` rank-${i + 1}` : ''}">${i + 1}</div></td>
                <td>${p.name}</td>
                <td class="font-mono font-bold text-cyan">${p.kills}</td>
            </tr>`).join('');
        }
    }
}

// Call directly — modules are deferred, and DOMContentLoaded may have
// already fired during the top-level await for initApp()
loadDashboard();
