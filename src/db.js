/**
 * db.js — Nova Stat Engine
 * Firebase Firestore Database Layer
 */

import { db } from './firebase.js';
import { collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';

/* ── WEEKS ──────────────────────────────────────────── */

export async function createWeek(name, totalDays = 7) {
    const weekRef = await addDoc(collection(db, 'weeks'), {
        name,
        total_days: totalDays,
        status: 'active',
        created_at: new Date().toISOString()
    });
    const week = { id: weekRef.id, name, total_days: totalDays, status: 'active' };

    const batch = writeBatch(db);

    for (let i = 0; i < totalDays; i++) {
        const dayRef = doc(collection(db, 'days'));
        batch.set(dayRef, {
            week_id: week.id,
            day_number: i + 1,
            status: 'pending'
        });

        for (let n = 1; n <= 3; n++) {
            const lobbyRef = doc(collection(db, 'lobbies'));
            batch.set(lobbyRef, {
                day_id: dayRef.id,
                lobby_number: n,
                status: 'pending'
            });
        }
    }
    await batch.commit();
    return week;
}

export async function getAllWeeks() {
    const q = query(collection(db, 'weeks'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllWeeksWithDays() {
    const weeks = await getAllWeeks();
    const daysSnapshot = await getDocs(collection(db, 'days'));
    const days = daysSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    return weeks.map(w => ({
        ...w,
        days: days.filter(d => d.week_id === w.id).sort((a,b) => a.day_number - b.day_number)
    }));
}

export async function getWeek(weekId) {
    const d = await getDoc(doc(db, 'weeks', weekId));
    if (!d.exists()) throw new Error("Week not found");
    return { id: d.id, ...d.data() };
}

export async function deleteWeek(weekId) {
    await deleteDoc(doc(db, 'weeks', weekId));
}

export async function updateWeekStatus(weekId, status) {
    await updateDoc(doc(db, 'weeks', weekId), { status });
}

/* ── DAYS ───────────────────────────────────────────── */

export async function getDaysByWeek(weekId) {
    const q = query(collection(db, 'days'), where('week_id', '==', weekId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.day_number - b.day_number);
}

export async function updateDayStatus(dayId, status) {
    await updateDoc(doc(db, 'days', dayId), { status });
}

/* ── LOBBIES ────────────────────────────────────────── */

export async function getLobby(lobbyId) {
    const d = await getDoc(doc(db, 'lobbies', lobbyId));
    if (!d.exists()) throw new Error("Lobby not found");
    return { id: d.id, ...d.data() };
}

export async function getLobbiesByDay(dayId) {
    const q = query(collection(db, 'lobbies'), where('day_id', '==', dayId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.lobby_number - b.lobby_number);
}

export async function getLobbiesByDayLight(dayId) {
    // Firestore lacks fine-grained column picking, return standard
    return getLobbiesByDay(dayId);
}

export async function updateLobbyImages(lobbyId, imagesBase64) {
    await updateDoc(doc(db, 'lobbies', lobbyId), { images: imagesBase64, status: 'uploaded' });
}

export async function updateLobbyStatus(lobbyId, status) {
    await updateDoc(doc(db, 'lobbies', lobbyId), { status });
}

/* ── OCR RECORDS ────────────────────────────────────── */

export async function saveOCRRecords(lobbyId, records) {
    const batch = writeBatch(db);
    // Delete old
    const oldQ = query(collection(db, 'ocr_records'), where('lobby_id', '==', lobbyId));
    const oldDocs = await getDocs(oldQ);
    oldDocs.forEach(d => batch.delete(d.ref));

    // Save new
    records.forEach(r => {
        const ref = doc(collection(db, 'ocr_records'));
        batch.set(ref, {
            lobby_id: lobbyId,
            source_image: r.sourceImage,
            raw_player_name: r.rawPlayerName,
            normalized_name: r.normalizedName,
            raw_kills: String(r.rawKills || '0'),
            normalized_kills: parseInt(r.normalizedKills) || 0,
            team_slot: r.teamSlot === 'Unknown' ? null : parseInt(r.teamSlot) || null,
            confidence: r.confidence ?? 0.95,
            is_duplicate: r.isDuplicate || false
        });
    });
    
    await batch.commit();
    await updateLobbyStatus(lobbyId, 'reviewing');
}

export async function getOCRRecordsByLobby(lobbyId) {
    const q = query(collection(db, 'ocr_records'), where('lobby_id', '==', lobbyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
        const r = d.data();
        return {
            id: d.id, lobbyId: r.lobby_id, sourceImage: r.source_image,
            rawPlayerName: r.raw_player_name, normalizedName: r.normalized_name,
            rawKills: r.raw_kills, normalizedKills: r.normalized_kills,
            teamSlot: r.team_slot, confidence: r.confidence,
            isDuplicate: r.is_duplicate
        };
    });
}

export async function updateOCRRecord(recordId, updates) {
    await updateDoc(doc(db, 'ocr_records', recordId), {
        normalized_name: updates.normalizedName,
        normalized_kills: updates.normalizedKills
    });
}

export async function deleteOCRRecord(recordId) {
    await deleteDoc(doc(db, 'ocr_records', recordId));
}

/* ── PLAYER STATS ───────────────────────────────────── */

export async function approveLobbyStats(weekId, dayId, lobbyId, players) {
    const batch = writeBatch(db);
    // Delete old
    const oldQ = query(collection(db, 'player_stats'), where('lobby_id', '==', lobbyId));
    const oldDocs = await getDocs(oldQ);
    oldDocs.forEach(d => batch.delete(d.ref));

    // Save new
    players.forEach(p => {
        const ref = doc(collection(db, 'player_stats'));
        batch.set(ref, {
            week_id: weekId, day_id: dayId, lobby_id: lobbyId,
            player_ign: p.normalizedName || p.playerIgn,
            kills: p.normalizedKills ?? p.kills ?? 0
        });
    });
    
    await batch.commit();
    await updateLobbyStatus(lobbyId, 'approved');
    
    const allLobbies = await getLobbiesByDay(dayId);
    if (allLobbies.every(l => l.status === 'approved')) {
        await updateDayStatus(dayId, 'completed');
    }
}

export async function getWeeklyStats(weekId) {
    const q = query(collection(db, 'player_stats'), where('week_id', '==', weekId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
}

export async function getDailyStats(dayId) {
    const q = query(collection(db, 'player_stats'), where('day_id', '==', dayId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
}

/* ── DASHBOARD ──────────────────────────────────────── */

export async function getDashboardStats() {
    const [weeksSnap, daysSnap, playersSnap, lobbiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'weeks'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'days')),
        getDocs(collection(db, 'player_stats')),
        getDocs(collection(db, 'lobbies'))
    ]);
    
    const weeks = weeksSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const activeWeek = weeks.find(w => w.status === 'active');
    
    const uniquePlayers = new Set(playersSnap.docs.map(d => d.data().player_ign));
    
    return {
        activeWeek,
        totalWeeks: weeks.length,
        totalDays: daysSnap.docs.filter(d => d.data().status === 'completed').length,
        totalPlayers: uniquePlayers.size,
        totalLobbies: lobbiesSnap.docs.filter(d => d.data().status === 'approved').length
    };
}
