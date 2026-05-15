/**
 * layout.js — Nova Gaming Network
 * Shared layout shell: sidebar, topbar, role-gated navigation
 */
import { signOut, getUserRole, getUser } from './auth.js';

const NOVA_LOGO_SVG = `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 2L26 14L14 26L2 14L14 2Z" fill="#6CB604" opacity="0.2"/>
  <path d="M14 5L23 14L14 23L5 14L14 5Z" stroke="#6CB604" stroke-width="1.5" fill="none"/>
  <text x="14" y="18" text-anchor="middle" fill="#6CB604" font-family="Orbitron" font-weight="900" font-size="10">N</text>
</svg>`;

const NAV_ITEMS = [
    { section: 'OVERVIEW' },
    { id: 'dashboard', href: '/dashboard.html', icon: 'lucide:layout-dashboard', label: 'Dashboard', minRole: 'mod' },
    { id: 'weekly', href: '/weekly.html', icon: 'lucide:calendar-days', label: 'Weekly Stats', minRole: 'mod' },
    { id: 'matches', href: '/matches.html', icon: 'lucide:trophy', label: 'Leaderboard', minRole: 'mod' },
    { section: 'ADMIN' },
    { id: 'upload', href: '/upload.html', icon: 'lucide:upload', label: 'Upload Results', minRole: 'admin' },
    { id: 'gfx', href: '/gfx.html', icon: 'lucide:palette', label: 'GFX Generator', minRole: 'admin' },
    { section: 'SYSTEM' },
    { id: 'users', href: '/users.html', icon: 'lucide:users', label: 'User Management', minRole: 'owner' },
    { id: 'settings', href: '/settings.html', icon: 'lucide:settings', label: 'Settings', minRole: 'owner' },
];

const ROLE_HIERARCHY = { owner: 3, admin: 2, mod: 1 };

/**
 * Injects the full layout shell (sidebar + topbar) into the page
 * @param {string} activePageId - The id of the current page for active state
 * @param {string} pageTitle - The title shown in the topbar
 * @param {object} profile - { user, role, displayName, email }
 */
export function injectLayout(activePageId, pageTitle, profile) {
    const userLevel = ROLE_HIERARCHY[profile.role] || 0;
    const initial = (profile.displayName || 'U')[0].toUpperCase();

    let navHTML = '';
    for (const item of NAV_ITEMS) {
        if (item.section) {
            navHTML += `<div class="nav-section">${item.section}</div>`;
            continue;
        }
        const requiredLevel = ROLE_HIERARCHY[item.minRole] || 0;
        if (userLevel < requiredLevel) continue;
        const active = item.id === activePageId ? ' active' : '';
        navHTML += `<a href="${item.href}" class="nav-item${active}" data-page="${item.id}">
            <iconify-icon icon="${item.icon}" class="nav-icon"></iconify-icon>
            <span>${item.label}</span>
        </a>`;
    }

    const roleBadgeClass = `role-${profile.role}`;

    const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-logo">${NOVA_LOGO_SVG}</div>
            <div class="brand-wordmark">NOVA GAMING<br>NETWORK</div>
        </div>
        <nav class="sidebar-nav">${navHTML}</nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">
                <div class="user-avatar">${initial}</div>
                <div class="user-meta">
                    <div class="user-name">${profile.displayName}</div>
                    <span class="role-badge ${roleBadgeClass}">${profile.role}</span>
                </div>
            </div>
            <button class="btn-signout" id="btn-signout">
                <iconify-icon icon="lucide:log-out"></iconify-icon> Sign Out
            </button>
        </div>
    </aside>`;

    const topbarHTML = `
    <div class="topbar">
        <div style="display:flex;align-items:center;gap:10px;">
            <button class="mobile-menu-btn" id="mobile-menu-toggle">
                <iconify-icon icon="lucide:menu"></iconify-icon>
            </button>
            <span class="topbar-title">${pageTitle}</span>
        </div>
        <div class="topbar-right">
            <div class="user-avatar" style="width:28px;height:28px;font-size:0.7rem;">${initial}</div>
        </div>
    </div>`;

    // Wrap existing page-body content
    const body = document.body;
    const pageBody = body.querySelector('.page-body');
    const pageContent = pageBody ? pageBody.innerHTML : '';

    body.innerHTML = `
    <div class="app-shell">
        ${sidebarHTML}
        <div class="main-content">
            ${topbarHTML}
            <div class="page-body">${pageContent}</div>
        </div>
    </div>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>`;

    // Wire up sidebar toggle
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuBtn = document.getElementById('mobile-menu-toggle');

    const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('active'); };

    menuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('active');
    });
    backdrop?.addEventListener('click', closeSidebar);

    // Wire up sign out
    document.getElementById('btn-signout')?.addEventListener('click', () => signOut());
}

/* ── Toast System ──────────────────────────────── */

export function showToast(message, type = 'info', duration = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<iconify-icon icon="${type === 'error' ? 'lucide:alert-circle' : type === 'success' ? 'lucide:check-circle-2' : 'lucide:info'}"></iconify-icon><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
