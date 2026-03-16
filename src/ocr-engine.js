/**
 * ocr-engine.js
 * Core logic for processing scrim screenshots.
 * Handles Tesseract initialization, duplicate resolving, and confidence scoring.
 */

import Tesseract from 'tesseract.js';
import stringSimilarity from 'string-similarity';

// Thresholds for confidence
const CONFIDENCE_HIGH = 85;
const CONFIDENCE_MED = 60;

/**
 * Main OCR Extraction function.
 * Called from day-view.html after user drops screenshots.
 * 
 * In a real production app, this would use hidden `<canvas>` to crop out 
 * specific leaderboard blocks to improve Tesseract accuracy significantly. 
 * For this implementation, we run a full pass and normalize text into rows.
 */
export async function runOCRExtraction(imageURIs) {
    let allRecords = [];
    
    // Initialize a single worker for speed (or spawn multiple for parallel)
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => console.log(m) // Can be hooked into UI progress bar
    });
    
    // Setup whitelist to improve numeric read for kills
    await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789|.-_[]',
    });

    for (let i = 0; i < imageURIs.length; i++) {
        const result = await worker.recognize(imageURIs[i]);
        const lines = result.data.lines;
        
        // --- 1. Structured Region Detection / Row Extraction Heuristics ---
        // A naive heuristic for CODM Scrims: 
        // We look for lines that contain a mix of letters (IGN) and a number at the end (Kills).
        
        for (const line of lines) {
            const rawText = line.text.trim();
            if (!rawText || rawText.length < 3) continue;
            
            // Regex to find "PlayerName 12" or "Clan|Name 5"
            // Captures group 1 as the name, group 2 as the kill count at the end
            const match = rawText.match(/^(.*?)[\t\s]+(\d{1,2})$/i);
            
            if (match) {
                const rawName = match[1].trim();
                const rawKills = parseInt(match[2].trim(), 10);
                
                // Normalization (strip excessive spaces, lowercase for comparison later)
                const normalizedName = rawName.replace(/\s+/g, ' ').trim();
                
                // Assign confidence based on Tesseract's word confidence + heuristic rules
                let confLevel = 'high';
                if (line.confidence < CONFIDENCE_MED) confLevel = 'low';
                else if (line.confidence < CONFIDENCE_HIGH) confLevel = 'medium';
                
                // Penalize if kill count seems absurd (e.g., > 40 in a scrim lobby)
                if (rawKills > 40) confLevel = 'low';

                allRecords.push({
                    sourceImage: `Image_${i+1}`,
                    rawPlayerName: rawName,
                    normalizedName: normalizedName,
                    rawKills: rawKills,
                    normalizedKills: rawKills, // starts same as raw, editable by human
                    teamSlot: 'Unknown', // In real prod, derived via geometric bounds
                    confidenceLevel: confLevel,
                    tesseractConf: line.confidence,
                    isDuplicate: false
                });
            }
        }
    }
    
    await worker.terminate();

    // --- 2. Smart Normalization / Duplicate Handling ---
    const deduplicatedRecords = resolveDuplicates(allRecords);
    
    return deduplicatedRecords;
}

/**
 * Resolves overlapping players from multiple screenshots.
 * Rules based on user prompt: 
 * If same player appears multiple times in the same lobby, keep only one valid record.
 * Use string similarity to handle OCR variations.
 */
function resolveDuplicates(records) {
    const unique = [];
    const flagged = [];
    
    // We get the admin sensitivity setting, default to 0.75
    const sensitivityStr = localStorage.getItem('nova_setting_ocr_sense') || "0.75";
    const THRESHOLD = parseFloat(sensitivityStr);

    records.forEach(current => {
        // Compare current against everything already in the "unique" array
        let isMatch = false;
        
        for (let i = 0; i < unique.length; i++) {
            const existing = unique[i];
            
            // 1. Check exact numeric match AND highly similar name
            const dist = stringSimilarity.compareTwoStrings(
                current.normalizedName.toLowerCase(), 
                existing.normalizedName.toLowerCase()
            );

            if (dist >= THRESHOLD && current.rawKills === existing.rawKills) {
                // It's the same player from overlapping screenshot. We skip adding it.
                isMatch = true;
                break;
            } else if (dist >= THRESHOLD && current.rawKills !== existing.rawKills) {
                // Name matches but kills differ? Flag for human review as conflict.
                current.confidenceLevel = 'low';
                current.isDuplicate = true; // Mark as conflicting duplicate
            }
        }

        if (!isMatch) {
            unique.push(current);
        }
    });

    return unique;
}
