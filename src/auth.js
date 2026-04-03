/**
 * auth.js — Nova Stat Engine
 * Firebase Authentication
 */

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

/* ── Session ────────────────────────────────────────── */

export function getSession() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });
}

export async function getUser() {
    return await getSession();
}

/* ── Sign In / Up / Out ─────────────────────────────── */

export async function signIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
}

export async function signUp(email, password, displayName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update Firebase Profile
    if (displayName) {
        await updateProfile(user, { displayName });
    }

    // Provision Firestore Profile
    await setDoc(doc(db, 'user_profiles', user.uid), {
        id: user.uid,
        display_name: displayName || email.split('@')[0],
        role: 'member',
        created_at: new Date().toISOString()
    });

    return { user };
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Check/provision Firestore profile
    const docRef = doc(db, 'user_profiles', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        await setDoc(docRef, {
            id: user.uid,
            display_name: user.displayName || user.email?.split('@')[0] || 'User',
            role: 'member',
            created_at: new Date().toISOString()
        });
    }

    return { user };
}

export async function signOut() {
    try {
        await fbSignOut(auth);
    } catch (e) {
        console.error('Sign out error:', e);
    } finally {
        window.location.href = '/login.html';
    }
}

export async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
}

/* ── Profile ────────────────────────────────────────── */

export async function getUserProfile() {
    const user = await getUser();
    if (!user) return null;

    try {
        const docRef = doc(db, 'user_profiles', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Auto-create profile if missing
            const fallbackProfile = {
                id: user.uid,
                display_name: user.displayName || user.email?.split('@')[0] || 'User',
                role: 'member'
            };
            await setDoc(docRef, fallbackProfile);
            return { ...fallbackProfile, email: user.email };
        }

        return { ...docSnap.data(), email: user.email };
    } catch (e) {
        console.error("Failed to fetch user profile", e);
        // Fallback for UI resilience
        return {
            id: user.uid,
            display_name: user.displayName || user.email?.split('@')[0] || 'User',
            role: 'member',
            email: user.email
        };
    }
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
