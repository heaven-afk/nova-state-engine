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
            // Weeks: { id, name, totalDays, status, createdAt }
            if (!db.objectStoreNames.contains('weeks')) {
                db.createObjectStore('weeks', { keyPath: 'id' });
            }
            
            // Days: { id, weekId, dayNumber, status, createdAt }
            if (!db.objectStoreNames.contains('days')) {
                const dayStore = db.createObjectStore('days', { keyPath: 'id' });
                dayStore.createIndex('by-week', 'weekId');
            }
            
            // Lobbies: { id, dayId, lobbyNumber, status (pending/reviewing/approved), images: [] }
            if (!db.objectStoreNames.contains('lobbies')) {
                const lobbyStore = db.createObjectStore('lobbies', { keyPath: 'id' });
                lobbyStore.createIndex('by-day', 'dayId');
            }
            
            // RawExtractedRecords: Pre-approval human-review data 
            // { id, lobbyId, sourceImage, rawPlayerName, normalizedName, 
            //   rawKills, normalizedKills, teamSlot, confidence }
            if (!db.objectStoreNames.contains('ocr_records')) {
                const ocrStore = db.createObjectStore('ocr_records', { keyPath: 'id' });
                ocrStore.createIndex('by-lobby', 'lobbyId');
            }
            
            // ApprovedPlayerStats: Final, analytical data after review
            // { id, weekId, dayId, lobbyId, playerIgn, kills }
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

// Ensure DB is initialized
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
    
    const tx = db.transaction(['weeks', 'days', 'lobbies'], 'readwrite');
    
    // Create the Week container
    await tx.objectStore('weeks').put(newWeek);
    
    // Automatically scaffold the Day and Lobby nested containers
    for (let d = 1; d <= totalDays; d++) {
        const dayId = `${weekId}_day_${d}`;
        await tx.objectStore('days').put({
            id: dayId,
            weekId: weekId,
            dayNumber: d,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        // 3 Lobbies per day default (per requirements)
        for (let l = 1; l <= 3; l++) {
            await tx.objectStore('lobbies').put({
                id: `${dayId}_lobby_${l}`,
                dayId: dayId,
                lobbyNumber: l,
                status: 'pending', // pending -> reviewing -> approved
                images: [] // will hold uploaded objectURLs or base64
            });
        }
    }
    
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
    const tx = db.transaction('lobbies', 'readwrite');
    const store = tx.objectStore('lobbies');
    const lobby = await store.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    
    lobby.images = imagesBase64;
    await store.put(lobby);
    await tx.done;
}

export async function updateLobbyStatus(lobbyId, status) {
    const db = await dbPromise;
    const tx = db.transaction('lobbies', 'readwrite');
    const store = tx.objectStore('lobbies');
    const lobby = await store.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    
    lobby.status = status;
    await store.put(lobby);
    await tx.done;
}

// ----------------------------------------------------
// OCR RECORDS (Pre-approval Review Queue)
// ----------------------------------------------------
export async function saveRawOCRRecords(lobbyId, records) {
    const db = await dbPromise;
    const tx = db.transaction('ocr_records', 'readwrite');
    
    // Clear old ones for this lobby if re-running
    const oldRecords = await db.getAllFromIndex('ocr_records', 'by-lobby', lobbyId);
    for (const r of oldRecords) {
        await tx.objectStore('ocr_records').delete(r.id);
    }
    
    // Insert new
    for (const r of records) {
        r.id = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        r.lobbyId = lobbyId;
        await tx.objectStore('ocr_records').put(r);
    }
    
    await tx.done;
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
    const tx = db.transaction(['player_stats', 'lobbies', 'days'], 'readwrite');
    
    // 1. Delete old approved stats for this lobby if replacing
    const oldStats = await db.getAllFromIndex('player_stats', 'by-lobby', lobbyId);
    for (const s of oldStats) {
        await tx.objectStore('player_stats').delete(s.id);
    }
    
    // 2. Insert validated stats
    for (const s of finalPlayerStats) {
        s.id = `stat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        s.weekId = weekId;
        s.dayId = dayId;
        s.lobbyId = lobbyId;
        await tx.objectStore('player_stats').put(s);
    }
    
    // 3. Mark lobby as approved
    const lobbyStore = tx.objectStore('lobbies');
    const lobby = await lobbyStore.get(lobbyId);
    if (lobby) {
        lobby.status = 'approved';
        await lobbyStore.put(lobby);
    }

    // 4. Check if day is fully approved
    const allLobbies = await db.getAllFromIndex('lobbies', 'by-day', dayId);
    const allApproved = allLobbies.every(l => l.status === 'approved' || (l.id === lobbyId));
    if (allApproved) {
        const dayStore = tx.objectStore('days');
        const day = await dayStore.get(dayId);
        if (day) {
            day.status = 'completed';
            await dayStore.put(day);
        }
    }
    
    await tx.done;
}

export async function getWeeklyStats(weekId) {
    const db = await dbPromise;
    return db.getAllFromIndex('player_stats', 'by-week', weekId);
}
