import { initApp } from './router.js';

initApp('dashboard');

// Global logic for quick actions dropdown, etc.
document.addEventListener('DOMContentLoaded', () => {
    
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
