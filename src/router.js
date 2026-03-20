/**
 * router.js
 * Nova Stat Engine — Shared UI, Auth Guard & Navigation
 */

import { requireAuth, signOut } from './auth.js';

export const state = { profile: null };

export async function initApp(pageId) {
    const profile = await requireAuth();
    if (!profile) return;

    state.profile = profile;

    // Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        const href = el.getAttribute('href');
        if (href === `/${pageId}.html` || (pageId === 'dashboard' && href === '/')) {
            el.classList.add('active');
        }
    });

    // Mobile Hamburger Menu + Backdrop
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const sidebar   = document.getElementById('sidebar');
    let backdrop    = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }
    const openSidebar  = () => { sidebar?.classList.add('open');    backdrop.classList.add('active'); };
    const closeSidebar = () => { sidebar?.classList.remove('open'); backdrop.classList.remove('active'); };
    mobileBtn?.addEventListener('click', e => { e.stopPropagation(); sidebar?.classList.contains('open') ? closeSidebar() : openSidebar(); });
    backdrop.addEventListener('click', closeSidebar);
    sidebar?.querySelectorAll('.nav-item').forEach(l => l.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); }));

    // User info in topbar
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl   = document.querySelector('.avatar');
    if (userNameEl) userNameEl.textContent = profile.display_name || profile.email || 'User';
    if (userRoleEl) userRoleEl.textContent = capitalize(profile.role);
    if (avatarEl)   avatarEl.textContent   = (profile.display_name || profile.email || 'U')[0].toUpperCase();

    // Apply role visibility
    if (profile.role === 'moderator') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // Sign-out buttons
    document.querySelectorAll('[data-action="signout"]').forEach(btn => btn.addEventListener('click', () => signOut()));
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:10px;z-index:9999;';
        document.body.appendChild(container);
    }
    const colors = { success: 'rgba(0,200,100,0.95)', error: 'rgba(220,50,80,0.95)', info: 'rgba(22,24,40,0.97)' };
    const icons  = { success: 'lucide:check-circle-2', error: 'lucide:alert-circle', info: 'lucide:info' };
    const toast  = document.createElement('div');
    toast.style.cssText = `background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;font-size:0.9rem;font-weight:500;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.1);transform:translateX(120%);transition:transform 0.3s ease;`;
    toast.innerHTML = `<iconify-icon icon="${icons[type]||icons.info}"></iconify-icon><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    setTimeout(() => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, duration);
}
