/**
 * auth.js
 * Nova Stat Engine — Supabase Authentication
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iafdpyeigkthdakksnih.supabase.co';
const SUPABASE_KEY = 'sb_publishable_n4n0dFU84gHjsLmHDVeHrA_cb4SFvUu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

export async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Create profile immediately (no org needed)
    if (data.user) {
        await supabase.from('user_profiles').insert({
            id: data.user.id,
            display_name: displayName || email.split('@')[0],
            role: 'admin'
        });
    }
    return data;
}

export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
}

export async function getUserProfile() {
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    return { ...data, email: user.email };
}

/**
 * Route guard — redirect to login if not authenticated.
 * Returns profile if authenticated.
 */
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    const profile = await getUserProfile();
    if (!profile) {
        // Auto-create profile for users who signed up before profile creation was added
        const user = session.user;
        if (user) {
            const { data } = await supabase.from('user_profiles')
                .insert({ id: user.id, display_name: user.email?.split('@')[0], role: 'admin' })
                .select().single();
            return { ...data, email: user.email };
        }
        return null;
    }
    return profile;
}
