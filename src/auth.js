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
            redirectTo: window.location.origin + '/login.html'
        }
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
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
        window.location.href = '/login.html';
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
