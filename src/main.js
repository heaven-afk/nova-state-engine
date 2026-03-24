import { initApp } from './router.js';
import { getDashboardStats } from './supabase-db.js';

await initApp('dashboard');

async function loadDashboard() {
    try {
        const stats = await getDashboardStats();
        const activeWeekEl = document.getElementById('dash-active-week');
        if (activeWeekEl) activeWeekEl.textContent = stats.activeWeek ? stats.activeWeek.name : 'No Active Week';
        
        const playersEl = document.getElementById('dash-players');
        if (playersEl) playersEl.textContent = stats.totalPlayers || 0;
        
        const daysEl = document.getElementById('dash-days');
        if (daysEl) daysEl.textContent = stats.totalDays || 0;
        
        const lobbiesEl = document.getElementById('dash-lobbies');
        if (lobbiesEl) lobbiesEl.textContent = stats.totalLobbies || 0;
        
    } catch (e) {
        console.error('Error loading dashboard stats:', e);
    }
}

// Global logic for quick actions dropdown, etc.
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    
    // Quick Actions Dropdown Toggle
    const btnQuickAction = document.getElementById('btn-quick-action');
    if (btnQuickAction) {
        btnQuickAction.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = btnQuickAction.nextElementSibling;
            
            // Close all other dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            
            menu.classList.toggle('show');
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });
});
