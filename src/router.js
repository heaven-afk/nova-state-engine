/**
 * router.js — Nova Stat Engine
 * Navigation, Auth Guard, Toasts, Mobile Bottom Tabs
 */

import { requireAuth, signOut } from './auth.js';

export const state = { profile: null };

export async function initApp(pageId) {
    const profile = await requireAuth();
    if (!profile) return;
    state.profile = profile;

    // Highlight active nav (sidebar)
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
        el.classList.toggle('active', el.dataset.page === pageId);
    });

    // Highlight active bottom tab (mobile)
    document.querySelectorAll('.tab-item[data-page]').forEach(el => {
        el.classList.toggle('active', el.dataset.page === pageId);
    });

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }
    const openSidebar = () => { sidebar?.classList.add('open'); backdrop.classList.add('active'); };
    const closeSidebar = () => { sidebar?.classList.remove('open'); backdrop.classList.remove('active'); };
    mobileBtn?.addEventListener('click', e => {
        e.stopPropagation();
        sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    backdrop.addEventListener('click', closeSidebar);
    sidebar?.querySelectorAll('.nav-item').forEach(l =>
        l.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); })
    );

    // User info
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.avatar');
    if (userNameEl) userNameEl.textContent = profile.display_name || 'User';
    if (userRoleEl) userRoleEl.textContent = capitalize(profile.role);
    if (avatarEl) avatarEl.textContent = (profile.display_name || 'U')[0].toUpperCase();

    // Sign-out
    document.querySelectorAll('[data-action="signout"]').forEach(btn =>
        btn.addEventListener('click', () => signOut())
    );
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

/* ── Toast ──────────────────────────────────────────── */

export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;display:flex;flex-direction:column;gap:10px;z-index:9999;max-width:90vw;';
        document.body.appendChild(container);
    }
    const colors = {
        success: 'linear-gradient(135deg, rgba(0,200,100,0.95), rgba(0,160,80,0.95))',
        error: 'linear-gradient(135deg, rgba(220,50,80,0.95), rgba(180,30,60,0.95))',
        info: 'linear-gradient(135deg, rgba(22,24,40,0.97), rgba(30,32,46,0.97))'
    };
    const icons = { success: 'lucide:check-circle-2', error: 'lucide:alert-circle', info: 'lucide:info' };
    const toast = document.createElement('div');
    toast.style.cssText = `background:${colors[type] || colors.info};color:white;padding:14px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:'Inter',sans-serif;font-size:0.9rem;font-weight:500;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.1);transform:translateY(-20px);opacity:0;transition:all 0.3s ease;`;
    toast.innerHTML = `<iconify-icon icon="${icons[type] || icons.info}"></iconify-icon><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ── Utility: Sidebar HTML ──────────────────────────── */

export function getSidebarHTML(activePage) {
    const items = [
        { page: 'dashboard', href: '/', icon: 'lucide:layout-dashboard', label: 'Dashboard', section: 'MAIN' },
        { page: 'weeks', href: '/weeks.html', icon: 'lucide:calendar-days', label: 'Weeks' },
        { page: 'leaderboards', href: '/leaderboards.html', icon: 'lucide:trophy', label: 'Leaderboards', section: 'ANALYSIS' },
        { page: 'exports', href: '/exports.html', icon: 'lucide:download-cloud', label: 'Exports' },
        { page: 'settings', href: '/settings.html', icon: 'lucide:settings', label: 'Settings', section: 'SYSTEM' },
    ];
    let html = '';
    let currentSection = '';
    items.forEach(item => {
        if (item.section && item.section !== currentSection) {
            currentSection = item.section;
            html += `<div class="nav-section">${currentSection}</div>`;
        }
        const active = item.page === activePage ? ' active' : '';
        html += `<a href="${item.href}" class="nav-item${active}" data-page="${item.page}">
            <iconify-icon icon="${item.icon}" class="nav-icon"></iconify-icon><span>${item.label}</span></a>`;
    });
    return html;
}

/* ── Utility: Bottom Tab Bar HTML (Mobile) ──────────── */

export function getBottomTabsHTML(activePage) {
    const tabs = [
        { page: 'dashboard', href: '/', icon: 'lucide:layout-dashboard', label: 'Home' },
        { page: 'weeks', href: '/weeks.html', icon: 'lucide:calendar-days', label: 'Weeks' },
        { page: 'ocr-review', href: '/ocr-review.html', icon: 'lucide:scan-eye', label: 'OCR' },
        { page: 'leaderboards', href: '/leaderboards.html', icon: 'lucide:trophy', label: 'Ranks' },
        { page: 'more', href: '#', icon: 'lucide:menu', label: 'More' },
    ];
    return tabs.map(t => {
        const active = t.page === activePage ? ' active' : '';
        return `<a href="${t.href}" class="tab-item${active}" data-page="${t.page}">
            <iconify-icon icon="${t.icon}"></iconify-icon><span>${t.label}</span></a>`;
    }).join('');
}
