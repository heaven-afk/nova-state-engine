/**
 * layout.js — Nova Gaming Network
 * Shared layout shell: sidebar, topbar, role-gated navigation
 */
import { signOut, getUserRole, getUser, watchSessionExpiry } from './auth.js';

const NOVA_LOGO_HTML = `<img src="/assets/brand/nova_logo_nmark.png" alt="Nova Gaming" width="28" height="28" class="sidebar-logo">`;

const NAV_ITEMS = [
    { section: 'OVERVIEW' },
    { id: 'dashboard', href: '/dashboard.html', icon: 'lucide:layout-dashboard', label: 'Dashboard', minRole: 'mod' },
    { id: 'weekly', href: '/weekly.html', icon: 'lucide:calendar-days', label: 'Weekly Stats', minRole: 'mod' },
    { id: 'matches', href: '/matches.html', icon: 'lucide:trophy', label: 'Leaderboard', minRole: 'mod' },
    { id: 'teams', href: '/teams.html', icon: 'lucide:shield', label: 'Team Registry', minRole: 'mod' },
    { id: 'profile', href: '/profile.html', icon: 'lucide:user', label: 'My Profile', minRole: 'mod' },
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
    const avatarUrl = profile.user?.user_metadata?.avatar_url;
    const avatarHTML = avatarUrl 
        ? `<img src="${avatarUrl}" alt="Avatar" class="avatar-img" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`
        : initial;

    let navHTML = '';
    for (const item of NAV_ITEMS) {
        if (item.section) {
            navHTML += `<div class="nav-section">${item.section}</div>`;
            continue;
        }
        const requiredLevel = ROLE_HIERARCHY[item.minRole] || 0;
        if (userLevel < requiredLevel) continue;
        const active = item.id === activePageId ? ' active' : '';
        navHTML += `<a href="${item.href}" class="nav-item${active}" data-page="${item.id}" data-label="${item.label}">
            <iconify-icon icon="${item.icon}" class="nav-icon"></iconify-icon>
            <span>${item.label}</span>
        </a>`;
    }

    const roleBadgeClass = `role-${profile.role}`;

    const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-logo">${NOVA_LOGO_HTML}</div>
            <div class="brand-wordmark">NOVA GAMING<br>NETWORK</div>
        </div>
        <nav class="sidebar-nav">${navHTML}</nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">
                <div class="user-avatar">${avatarHTML}</div>
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
        <div class="topbar-left">
            <span class="topbar-title">${pageTitle}</span>
            <!-- Global Search Bar -->
            <div class="topbar-search-wrap global-search-wrap">
                <iconify-icon icon="lucide:search" class="topbar-search-icon"></iconify-icon>
                <input type="text" id="global-search-input" placeholder="Search players, teams..." class="form-input topbar-search-input">
                <div id="global-search-results" class="search-results-dropdown hidden"></div>
            </div>
        </div>
        <div class="topbar-right">
            <div class="user-avatar topbar-avatar">${avatarHTML}</div>
        </div>
    </div>`;

    // Generate Floating Glow Navbar
    const primaryNavItems = [
        { id: 'dashboard', href: '/dashboard.html', icon: 'lucide:layout-dashboard', label: 'Dashboard' },
        { id: 'weekly', href: '/weekly.html', icon: 'lucide:calendar-days', label: 'Weekly' },
        { id: 'matches', href: '/matches.html', icon: 'lucide:trophy', label: 'Leaderboard' },
        { id: 'teams', href: '/teams.html', icon: 'lucide:shield', label: 'Registry' }
    ];

    let navItemsHTML = primaryNavItems.map(item => {
        const isActive = item.id === activePageId;
        const activeClass = isActive ? ' active' : '';
        const glowHTML = isActive ? '<span class="glow"></span>' : '';
        return `
        <a href="${item.href}" class="nav-item${activeClass}" aria-label="${item.label}" ${isActive ? 'aria-current="page"' : ''}>
            ${glowHTML}
            <iconify-icon icon="${item.icon}"></iconify-icon>
        </a>`;
    }).join('');

    navItemsHTML += `
    <button class="nav-item" id="app-more-btn" aria-label="More Menu">
        <iconify-icon icon="lucide:more-horizontal"></iconify-icon>
    </button>`;

    let ctaHTML = '';
    if (profile.role === 'admin' || profile.role === 'owner') {
        const isCtaActive = activePageId === 'upload';
        const ctaClass = isCtaActive ? ' active' : '';
        const ctaGlow = isCtaActive ? '<span class="glow"></span>' : '';
        ctaHTML = `
        <a href="/upload.html" class="nav-cta${ctaClass}" aria-label="Upload Results" ${isCtaActive ? 'aria-current="page"' : ''}>
            ${ctaGlow}
            <iconify-icon icon="lucide:upload"></iconify-icon>
        </a>`;
    }

    let bottomSheetItemsHTML = '';
    const isProfileActive = activePageId === 'profile';
    bottomSheetItemsHTML += `
    <a href="/profile.html" class="mob-sheet-item${isProfileActive ? ' active' : ''}">
        <iconify-icon icon="lucide:user"></iconify-icon>
        <span>My Profile</span>
    </a>`;

    if (userLevel >= ROLE_HIERARCHY['admin']) {
        const isGfxActive = activePageId === 'gfx';
        bottomSheetItemsHTML += `
        <a href="/gfx.html" class="mob-sheet-item${isGfxActive ? ' active' : ''}">
            <iconify-icon icon="lucide:palette"></iconify-icon>
            <span>GFX Generator</span>
        </a>`;
    }

    if (userLevel >= ROLE_HIERARCHY['owner']) {
        const isUsersActive = activePageId === 'users';
        bottomSheetItemsHTML += `
        <a href="/users.html" class="mob-sheet-item${isUsersActive ? ' active' : ''}">
            <iconify-icon icon="lucide:users"></iconify-icon>
            <span>User Management</span>
        </a>`;
        
        const isSettingsActive = activePageId === 'settings';
        bottomSheetItemsHTML += `
        <a href="/settings.html" class="mob-sheet-item${isSettingsActive ? ' active' : ''}">
            <iconify-icon icon="lucide:settings"></iconify-icon>
            <span>Settings</span>
        </a>`;
    }

    const appNavWrapperHTML = `
    <div class="app-nav-wrapper">
        <nav class="navbar">
            ${navItemsHTML}
        </nav>
        ${ctaHTML}
    </div>`;

    const bottomSheetHTML = `
    <div class="mob-bottom-sheet-backdrop" id="mob-sheet-backdrop"></div>
    <div class="mob-bottom-sheet" id="mob-bottom-sheet">
        <div class="mob-sheet-header">
            <span class="mob-sheet-title">Nova Network Menu</span>
            <button class="mob-sheet-close" id="mob-sheet-close-btn">
                <iconify-icon icon="lucide:x"></iconify-icon>
            </button>
        </div>
        <div class="mob-sheet-grid">
            ${bottomSheetItemsHTML}
            <button class="mob-sheet-item mob-sheet-signout" id="mob-sheet-signout-btn">
                <iconify-icon icon="lucide:log-out"></iconify-icon>
                <span>Sign Out</span>
            </button>
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
    ${appNavWrapperHTML}
    ${bottomSheetHTML}`;

    // Wire up global search interactions
    const searchInput = document.getElementById('global-search-input');
    const searchResults = document.getElementById('global-search-results');
    let searchDebounce;

    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        const query = e.target.value.trim();
        if (!query) {
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
            return;
        }

        searchDebounce = setTimeout(async () => {
            try {
                const { searchRegistry } = await import('./db.js');
                const results = await searchRegistry(query);
                
                let html = '';
                
                // Teams matches
                if (results.teams.length > 0) {
                    html += `<span class="search-result-label">Teams</span>`;
                    results.teams.forEach(t => {
                        html += `<a href="/team-profile.html?id=${t.id}" class="search-result-item">
                            <span class="search-result-name">${t.team_name}</span>
                            <span class="search-result-meta">Manager: ${t.team_manager || 'None'}</span>
                        </a>`;
                    });
                }
                
                // Players matches
                if (results.players.length > 0) {
                    if (html) html += `<div class="search-result-separator"></div>`;
                    html += `<span class="search-result-label">Players</span>`;
                    results.players.forEach(p => {
                        const teamName = p.teams?.team_name || 'Free Agent';
                        html += `<a href="/player-profile.html?id=${p.id}" class="search-result-item search-result-item-team">
                            <div>
                                <span class="search-result-name text-green">${p.professional_name}</span>
                                <span class="search-result-meta">IGN: ${p.current_ign || p.professional_name}</span>
                            </div>
                            <span class="badge badge-muted">${teamName}</span>
                        </a>`;
                    });
                }
                
                if (!html) {
                    html = `<div class="search-no-result">No matches found</div>`;
                }
                
                searchResults.innerHTML = html;
                searchResults.classList.remove('hidden');
            } catch (err) {
                console.error('[Search] Error:', err);
            }
        }, 250);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
            searchResults?.classList.add('hidden');
        }
    });

    // Bottom sheet interactions
    const sheet = document.getElementById('mob-bottom-sheet');
    const sheetBackdrop = document.getElementById('mob-sheet-backdrop');
    const moreBtn = document.getElementById('app-more-btn');
    const sheetCloseBtn = document.getElementById('mob-sheet-close-btn');
    const sheetSignoutBtn = document.getElementById('mob-sheet-signout-btn');

    const openBottomSheet = () => {
        sheet.classList.add('show');
        sheetBackdrop.classList.add('show');
    };

    const closeBottomSheet = () => {
        sheet.classList.remove('show');
        sheetBackdrop.classList.remove('show');
    };

    moreBtn?.addEventListener('click', openBottomSheet);
    sheetCloseBtn?.addEventListener('click', closeBottomSheet);
    sheetBackdrop?.addEventListener('click', closeBottomSheet);
    sheetSignoutBtn?.addEventListener('click', () => {
        closeBottomSheet();
        signOut();
    });

    document.getElementById('btn-signout')?.addEventListener('click', () => signOut());

    window.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeBottomSheet();
            searchResults?.classList.add('hidden');
            searchInput?.blur();
        }
    });

    // Watch for session expiry — shows modal instead of exposing login URL
    watchSessionExpiry();
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
