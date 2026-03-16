/**
 * router.js
 * Handles shared UI components (Sidebar active states, User Roles, Toasts)
 */

export const state = {
    role: localStorage.getItem('nova_role') || 'Admin' 
};

/**
 * Initializes the page, highlights the active sidebar link, 
 * and handles generic UI listeners like the Role toggle (for demo purposes).
 */
export function initApp(pageId) {
    // 1. Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('href') === `/${pageId}.html` || (pageId === 'dashboard' && el.getAttribute('href') === '/')) {
            el.classList.add('active');
        }
    });

    // 2. Apply Role Permissions
    applyRolePermissions();

    // 3. User Role Toggle (Allows easy switching for demo purposes)
    const userRoleText = document.querySelector('.user-role');
    if (userRoleText) {
        userRoleText.textContent = state.role;
        userRoleText.style.cursor = 'pointer';
        userRoleText.title = "Click to toggle role (Admin / Moderator)";
        
        userRoleText.addEventListener('click', () => {
            state.role = state.role === 'Admin' ? 'Moderator' : 'Admin';
            localStorage.setItem('nova_role', state.role);
            userRoleText.textContent = state.role;
            applyRolePermissions();
            showToast(`Role switched to ${state.role}`, 'info');
        });
    }

    // 4. Sidebar Toggle (Mobile / Compact)
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (sidebar.classList.contains('collapsed')) {
                sidebar.style.width = '70px';
                document.querySelectorAll('.sidebar-nav span, .brand-text, .nav-section').forEach(el => el.style.display = 'none');
            } else {
                sidebar.style.width = '260px';
                document.querySelectorAll('.sidebar-nav span, .brand-text, .nav-section').forEach(el => el.style.display = '');
            }
        });
    }
}

/**
 * Hides/Shows UI elements based on Admin vs Moderator role.
 */
function applyRolePermissions() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (state.role === 'Moderator') {
            el.style.display = 'none';
        } else {
            el.style.display = ''; // revert to default
        }
    });
}

/**
 * Displays a toast notification in the bottom right corner.
 */
export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            display: flex; flex-direction: column; gap: 10px; z-index: 9999;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
        success: 'rgba(0, 255, 136, 0.9)',
        error: 'rgba(255, 51, 102, 0.9)',
        info: 'rgba(30, 32, 46, 0.95)'
    };
    
    toast.style.cssText = `
        background: ${bgColors[type] || bgColors.info};
        color: white; padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: 'Inter', sans-serif;
        font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const icon = document.createElement('iconify-icon');
    if (type === 'success') icon.setAttribute('icon', 'lucide:check-circle-2');
    else if (type === 'error') icon.setAttribute('icon', 'lucide:alert-circle');
    else icon.setAttribute('icon', 'lucide:info');
    icon.style.fontSize = '1.1rem';

    const text = document.createElement('span');
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');

    // Remove after duration
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
