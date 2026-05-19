/**
 * auth.js — Nova Gaming Network
 * Supabase Authentication (Email/Password only)
 */
import { supabase } from './supabase.js';

/* ── Session ─────────────────────────────────────── */

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/* ── Sign In / Out ───────────────────────────────── */

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/ngn-access.html'
        }
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/ngn-access.html';
}

export async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
}

/* ── Role Lookup ─────────────────────────────────── */

export async function getUserRole() {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) { console.error('[Auth] Role lookup failed:', error); return null; }
    return data?.role || null;
}

/* ── Owner Bootstrap ─────────────────────────────── */

export async function bootstrapOwner() {
    const user = await getUser();
    if (!user) return null;

    // Call serverless function to check if this user should be owner
    try {
        const session = await getSession();
        const resp = await fetch('/api/bootstrap-owner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        if (resp.ok) {
            const result = await resp.json();
            return result.role;
        }
    } catch (e) {
        console.error('[Auth] Owner bootstrap failed:', e);
    }
    return null;
}

/* ── Auth Guard ──────────────────────────────────── */

export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        // Show 404 to unauthenticated users — don't reveal protected routes exist
        window.location.replace('/404.html');
        return null;
    }
    return session;
}

export async function requireRole(minimumRole) {
    const session = await requireAuth();
    if (!session) return null;

    // Try owner bootstrap first
    let role = await getUserRole();
    if (!role) {
        role = await bootstrapOwner();
    }

    const hierarchy = { owner: 3, admin: 2, mod: 1 };
    const userLevel = hierarchy[role] || 0;
    const requiredLevel = hierarchy[minimumRole] || 0;

    if (userLevel < requiredLevel) {
        window.location.href = '/dashboard.html';
        return null;
    }

    const user = await getUser();
    return {
        user,
        role,
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        email: user.email
    };
}

/* ── Auth State Listener ─────────────────────────── */

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

/* ── Session Expiry Modal ────────────────────────── */

/**
 * Call on protected pages to show an overlay modal when session expires,
 * instead of redirecting (which would leak the hidden access URL).
 */
export function watchSessionExpiry() {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            showSessionExpiredModal();
        }
    });
}

function showSessionExpiredModal() {
    // Don't show if already visible
    if (document.getElementById('session-expired-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'session-expired-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(0,0,0,0.85);
        display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(6px);
    `;
    overlay.innerHTML = `
        <div style="
            background:#0F0F0F;
            border:0.5px solid rgba(108,182,4,0.2);
            border-top:2px solid #6CB604;
            border-radius:4px;
            padding:40px 32px;
            max-width:360px;
            width:90%;
            text-align:center;
        ">
            <div style="font-family:'Orbitron',sans-serif;font-weight:900;font-size:1.8rem;color:#6CB604;margin-bottom:12px;">⏱</div>
            <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1rem;color:#fff;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">
                Session Expired
            </h3>
            <p style="font-size:0.85rem;color:rgba(255,255,255,0.45);margin-bottom:28px;">
                Your session has expired. Please sign in again.
            </p>
            <a href="/ngn-access.html" style="
                display:inline-block;
                padding:14px 32px;
                background:#6CB604;
                color:#0A0A0A;
                border:none;
                border-radius:4px;
                font-family:'Orbitron',sans-serif;
                font-weight:700;
                font-size:0.8rem;
                letter-spacing:0.06em;
                text-decoration:none;
                cursor:pointer;
                transition:box-shadow 0.2s;
            " onmouseover="this.style.boxShadow='0 0 20px rgba(108,182,4,0.4)'" onmouseout="this.style.boxShadow='none'">
                SIGN IN
            </a>
        </div>
    `;
    document.body.appendChild(overlay);
}
