/**
 * db.js
 * Nova Scrims Analytics — IndexedDB Data Layer
 * Handles all storage for Weeks, Days, Lobbies, OCR Records, and Approved Stats.
 */

import { openDB } from 'idb';

const DB_NAME = 'NovaScrimsDB';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB database and creates object stores.
 */
async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('weeks')) {
                db.createObjectStore('weeks', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('days')) {
                const dayStore = db.createObjectStore('days', { keyPath: 'id' });
                dayStore.createIndex('by-week', 'weekId');
            }
            if (!db.objectStoreNames.contains('lobbies')) {
                const lobbyStore = db.createObjectStore('lobbies', { keyPath: 'id' });
                lobbyStore.createIndex('by-day', 'dayId');
            }
            if (!db.objectStoreNames.contains('ocr_records')) {
                const ocrStore = db.createObjectStore('ocr_records', { keyPath: 'id' });
                ocrStore.createIndex('by-lobby', 'lobbyId');
            }
            if (!db.objectStoreNames.contains('player_stats')) {
                const statStore = db.createObjectStore('player_stats', { keyPath: 'id' });
                statStore.createIndex('by-week', 'weekId');
                statStore.createIndex('by-day', 'dayId');
                statStore.createIndex('by-lobby', 'lobbyId');
                statStore.createIndex('by-player', 'playerIgn');
            }
        }
    });
}

const dbPromise = initDB();

// ----------------------------------------------------
// WEEKS API
// ----------------------------------------------------
export async function createWeek(name, totalDays = 7) {
    const db = await dbPromise;
    const weekId = 'wk_' + Date.now();

    const newWeek = {
        id: weekId,
        name,
        totalDays,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    // Build all writes up front, then do a single transaction
    const days = [];
    const lobbies = [];
    for (let d = 1; d <= totalDays; d++) {
        const dayId = `${weekId}_day_${d}`;
        days.push({ id: dayId, weekId, dayNumber: d, status: 'pending', createdAt: new Date().toISOString() });
        for (let l = 1; l <= 3; l++) {
            lobbies.push({ id: `${dayId}_lobby_${l}`, dayId, lobbyNumber: l, status: 'pending', images: [] });
        }
    }

    const tx = db.transaction(['weeks', 'days', 'lobbies'], 'readwrite');
    tx.objectStore('weeks').put(newWeek);
    days.forEach(d => tx.objectStore('days').put(d));
    lobbies.forEach(l => tx.objectStore('lobbies').put(l));
    await tx.done;

    return newWeek;
}

export async function getAllWeeks() {
    const db = await dbPromise;
    return db.getAll('weeks');
}

export async function getWeek(weekId) {
    const db = await dbPromise;
    return db.get('weeks', weekId);
}

// ----------------------------------------------------
// DAYS API
// ----------------------------------------------------
export async function getDaysByWeek(weekId) {
    const db = await dbPromise;
    const days = await db.getAllFromIndex('days', 'by-week', weekId);
    return days.sort((a, b) => a.dayNumber - b.dayNumber);
}

// ----------------------------------------------------
// LOBBIES API
// ----------------------------------------------------
export async function getLobby(lobbyId) {
    const db = await dbPromise;
    return db.get('lobbies', lobbyId);
}

export async function getLobbiesByDay(dayId) {
    const db = await dbPromise;
    const lobbies = await db.getAllFromIndex('lobbies', 'by-day', dayId);
    return lobbies.sort((a, b) => a.lobbyNumber - b.lobbyNumber);
}

export async function updateLobbyImages(lobbyId, imagesBase64) {
    const db = await dbPromise;
    // Read first (outside transaction), then write
    const lobby = await db.get('lobbies', lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    lobby.images = imagesBase64;
    await db.put('lobbies', lobby);
}

export async function updateLobbyStatus(lobbyId, status) {
    const db = await dbPromise;
    const lobby = await db.get('lobbies', lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    lobby.status = status;
    await db.put('lobbies', lobby);
}

// ----------------------------------------------------
// OCR RECORDS (Pre-approval Review Queue)
// ----------------------------------------------------
export async function saveRawOCRRecords(lobbyId, records) {
    const db = await dbPromise;

    // ---- Step 1: Read old records BEFORE opening the write transaction ----
    const oldRecords = await db.getAllFromIndex('ocr_records', 'by-lobby', lobbyId);

    // ---- Step 2: Assign IDs to new records (no async needed here) ----
    const now = Date.now();
    const newRecords = records.map((r, i) => ({
        ...r,
        id: `ocr_${now}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        lobbyId
    }));

    // ---- Step 3: Single write transaction — delete old, insert new ----
    const tx = db.transaction('ocr_records', 'readwrite');
    const store = tx.objectStore('ocr_records');
    oldRecords.forEach(r => store.delete(r.id));
    newRecords.forEach(r => store.put(r));
    await tx.done;

    // ---- Step 4: Mark lobby as 'reviewing' in a separate transaction ----
    const lobby = await db.get('lobbies', lobbyId);
    if (lobby) {
        lobby.status = 'reviewing';
        await db.put('lobbies', lobby);
    }
}

export async function getOCRRecordsByLobby(lobbyId) {
    const db = await dbPromise;
    return db.getAllFromIndex('ocr_records', 'by-lobby', lobbyId);
}

// ----------------------------------------------------
// FINAL STATS API (Post-approval Analytics)
// ----------------------------------------------------
export async function approveLobbyStats(weekId, dayId, lobbyId, finalPlayerStats) {
    const db = await dbPromise;

    // ---- Step 1: All reads BEFORE any write transaction ----
    const oldStats   = await db.getAllFromIndex('player_stats', 'by-lobby', lobbyId);
    const allLobbies = await db.getAllFromIndex('lobbies', 'by-day', dayId);
    const lobby      = await db.get('lobbies', lobbyId);
    const day        = await db.get('days', dayId);

    // ---- Step 2: Prepare new stat records ----
    const now = Date.now();
    const newStats = finalPlayerStats.map((s, i) => ({
        ...s,
        id:      `stat_${now}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        weekId,
        dayId,
        lobbyId
    }));

    // ---- Step 3: Determine if the whole day is now approved ----
    const allApproved = allLobbies.every(l => l.status === 'approved' || l.id === lobbyId);

    // ---- Step 4: Single write transaction for stats ----
    const statsTx = db.transaction('player_stats', 'readwrite');
    const statsStore = statsTx.objectStore('player_stats');
    oldStats.forEach(s => statsStore.delete(s.id));
    newStats.forEach(s => statsStore.put(s));
    await statsTx.done;

    // ---- Step 5: Update lobby status ----
    if (lobby) {
        lobby.status = 'approved';
        await db.put('lobbies', lobby);
    }

    // ---- Step 6: Update day status if fully approved ----
    if (allApproved && day) {
        day.status = 'completed';
        await db.put('days', day);
    }
}

export async function getWeeklyStats(weekId) {
    const db = await dbPromise;
    return db.getAllFromIndex('player_stats', 'by-week', weekId);
}
