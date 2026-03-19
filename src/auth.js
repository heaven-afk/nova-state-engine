/**
 * auth.js
 * Nova Stat Engine — Supabase Authentication & Client
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://iafdpyeigkthdakksnih.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_n4n0dFU84gHjsLmHDVeHrA_cb4SFvUu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Session Helpers ──────────────────────────────────────────────────────────

export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signUp(email, password, orgName, displayName) {
    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const userId = data.user.id;

    // 2. Create organization
    const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName })
        .select()
        .single();
    if (orgErr) throw orgErr;

    // 3. Create user profile as Owner
    const { error: profileErr } = await supabase
        .from('user_profiles')
        .insert({ id: userId, org_id: orgData.id, role: 'owner', display_name: displayName || email });
    if (profileErr) throw profileErr;

    return { user: data.user, org: orgData };
}

export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
}

// ─── Profile & Org ────────────────────────────────────────────────────────────

export async function getUserProfile() {
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('user_profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .single();
    return data;
}

// ─── Route Guard ─────────────────────────────────────────────────────────────

/**
 * Call this at the top of every protected page's module script.
 * Redirects to /login.html if the user is not authenticated.
 * Returns the profile (with org) if authenticated.
 */
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    const profile = await getUserProfile();
    if (!profile) {
        // User authed but no profile yet (e.g. mid-signup) — sign out and redirect
        await supabase.auth.signOut();
        window.location.href = '/login.html';
        return null;
    }
    return profile;
}
