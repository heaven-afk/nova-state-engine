/**
 * ocr-engine.js
 * Core logic for processing scrim screenshots.
 * Uses Tesseract.js loaded from CDN (window.Tesseract).
 */

// string-similarity is bundled by Vite normally (pure JS, no Node deps)
import stringSimilarity from 'string-similarity';

// Thresholds for confidence
const CONFIDENCE_HIGH = 85;
const CONFIDENCE_MED  = 60;

/**
 * Main OCR Extraction function.
 * Called from day-view.html after user drops screenshots.
 */
export async function runOCRExtraction(imageURIs) {
    // Safety check — CDN must be loaded
    if (typeof window.Tesseract === 'undefined') {
        throw new Error('Tesseract.js CDN not loaded. Check the <script> tag in day-view.html.');
    }

    const Tesseract = window.Tesseract;
    let allRecords = [];

    // Use the simpler one-shot `recognize()` per image to avoid worker lifecycle issues
    for (let i = 0; i < imageURIs.length; i++) {
        let result;
        try {
            result = await Tesseract.recognize(imageURIs[i], 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`[OCR] Image ${i + 1}: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
        } catch (err) {
            console.error(`[OCR] Failed on image ${i + 1}:`, err);
            continue; // skip this image, keep going with others
        }

        const lines = result.data.lines;

        for (const line of lines) {
            const rawText = line.text.trim();
            if (!rawText || rawText.length < 3) continue;

            // Look for "PlayerName 12" — name then a 1-2 digit number at end
            const match = rawText.match(/^(.*?)[\t\s]+(\d{1,2})$/i);

            if (match) {
                const rawName   = match[1].trim();
                const rawKills  = parseInt(match[2].trim(), 10);
                const normName  = rawName.replace(/\s+/g, ' ').trim();

                let confLevel = 'high';
                if (line.confidence < CONFIDENCE_MED)  confLevel = 'low';
                else if (line.confidence < CONFIDENCE_HIGH) confLevel = 'medium';
                if (rawKills > 40) confLevel = 'low'; // Absurd kill count

                allRecords.push({
                    sourceImage:    `Image_${i + 1}`,
                    rawPlayerName:  rawName,
                    normalizedName: normName,
                    rawKills:       rawKills,
                    normalizedKills: rawKills,
                    teamSlot:       'Unknown',
                    confidenceLevel: confLevel,
                    tesseractConf:  line.confidence,
                    isDuplicate:    false
                });
            }
        }
    }

    return resolveDuplicates(allRecords);
}

/**
 * Deduplicates player records from multiple overlapping screenshots.
 */
function resolveDuplicates(records) {
    const unique = [];
    const sensitivityStr = localStorage.getItem('nova_setting_ocr_sense') || '0.75';
    const THRESHOLD = parseFloat(sensitivityStr);

    records.forEach(current => {
        let isMatch = false;

        for (let i = 0; i < unique.length; i++) {
            const existing = unique[i];
            const dist = stringSimilarity.compareTwoStrings(
                current.normalizedName.toLowerCase(),
                existing.normalizedName.toLowerCase()
            );

            if (dist >= THRESHOLD && current.rawKills === existing.rawKills) {
                // Same player from overlapping screenshot — skip
                isMatch = true;
                break;
            } else if (dist >= THRESHOLD && current.rawKills !== existing.rawKills) {
                // Same name, different kills — flag as conflict
                current.confidenceLevel = 'low';
                current.isDuplicate = true;
            }
        }

        if (!isMatch) unique.push(current);
    });

    return unique;
}
