/**
 * auth.js — Nova Stat Engine
 * Supabase Authentication (Clean Rebuild)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iafdpyeigkthdakksnih.supabase.co';
const SUPABASE_KEY = 'sb_publishable_n4n0dFU84gHjsLmHDVeHrA_cb4SFvUu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Session ────────────────────────────────────────── */

export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

/* ── Sign In / Up / Out ─────────────────────────────── */

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: { display_name: displayName || email.split('@')[0] }
        }
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error('Sign out error:', e);
    } finally {
        window.location.href = '/login.html';
    }
}

/* ── Profile ────────────────────────────────────────── */

export async function getUserProfile() {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!data) {
        // Auto-create profile if missing
        const fallbackProfile = {
            id: user.id,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            role: 'member'
        };

        const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert(fallbackProfile)
            .select()
            .single();
            
        // If the insert gets blocked by RLS or fails, gracefully return the fallback profile so UI doesn't freeze
        return newProfile ? { ...newProfile, email: user.email } : { ...fallbackProfile, email: user.email };
    }

    return { ...data, email: user.email };
}

/* ── Auth Guard ─────────────────────────────────────── */

export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return getUserProfile();
}
