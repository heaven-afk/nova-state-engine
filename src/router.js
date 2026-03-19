/**
 * router.js
 * Nova Stat Engine — Shared UI, Auth Guard & Navigation
 */

import { requireAuth, signOut } from './auth.js';

export const state = {
    profile: null,
    org:     null
};

/**
 * Initialize every protected page.
 * - Checks auth (redirects to login if not authenticated)
 * - Loads workspace name into topbar
 * - Sets up sidebar active state, mobile menu, role permissions
 */
export async function initApp(pageId) {
    // 1. Auth guard — redirects to /login.html if no session
    const profile = await requireAuth();
    if (!profile) return; // requireAuth already redirected

    state.profile = profile;
    state.org     = profile.organizations;

    // 2. Set workspace name in topbar
    const workspaceLabel = document.getElementById('workspace-name');
    if (workspaceLabel && state.org) {
        workspaceLabel.textContent = `${state.org.name} Workspace`;
    }

    // 3. Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        const href = el.getAttribute('href');
        if (href === `/${pageId}.html` || (pageId === 'dashboard' && href === '/')) {
            el.classList.add('active');
        }
    });

    // 4. Mobile Hamburger Menu + Backdrop Overlay
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const sidebar   = document.getElementById('sidebar');

    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    const openSidebar  = () => { sidebar.classList.add('open');    backdrop.classList.add('active'); };
    const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('active'); };

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', e => { e.stopPropagation(); sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
        backdrop.addEventListener('click', closeSidebar);
        sidebar.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
        });
    }

    // 5. Role-based UI
    applyRolePermissions(profile.role);

    // 6. Wire sign-out buttons
    document.querySelectorAll('[data-action="signout"]').forEach(btn => {
        btn.addEventListener('click', () => signOut());
    });

    // 7. Update user avatar/name in topbar
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl   = document.querySelector('.avatar');
    if (userNameEl)  userNameEl.textContent = profile.display_name || 'User';
    if (userRoleEl)  userRoleEl.textContent = capitalize(profile.role);
    if (avatarEl)    avatarEl.textContent   = (profile.display_name || 'U')[0].toUpperCase();
}

function capitalize(str) { return str ? str[0].toUpperCase() + str.slice(1) : ''; }

function applyRolePermissions(role) {
    // Hide admin-only elements from moderators
    if (role === 'moderator') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
    // Hide owner-only elements from non-owners
    if (role !== 'owner') {
        document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
    }
}

/**
 * Toast Notifications
 */
export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:10px;z-index:9999;';
        document.body.appendChild(container);
    }

    const bgColors = {
        success: 'rgba(0,255,136,0.92)',
        error:   'rgba(255,51,102,0.92)',
        info:    'rgba(22,24,40,0.97)'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${bgColors[type]||bgColors.info};color:white;padding:12px 20px;
        border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);
        font-family:'Inter',sans-serif;font-size:0.9rem;font-weight:500;
        display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.1);
        transform:translateX(120%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
    `;

    const icon = document.createElement('iconify-icon');
    if (type==='success') icon.setAttribute('icon','lucide:check-circle-2');
    else if (type==='error') icon.setAttribute('icon','lucide:alert-circle');
    else icon.setAttribute('icon','lucide:info');

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    setTimeout(() => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, duration);
}
