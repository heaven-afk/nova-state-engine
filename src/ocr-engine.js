/**
 * ocr-engine.js — Nova Stat Engine
 * OCR Pipeline — calls /api/ocr Vercel serverless proxy
 */

import stringSimilarity from 'string-similarity';

const OCR_PROMPT = `You are analyzing a Call of Duty Mobile Battle Royale scrim scoreboard screenshot.

Extract every visible player entry. Each row shows a player IGN and their kill count.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Example:
[{"name": "Nova|Shadow", "kills": 14}, {"name": "T1_Viper", "kills": 9}]

Rules:
- Include ALL visible player rows
- Player names may contain: letters, numbers, symbols like | . _ - [ ] > < ~
- Kills are 0–40. If > 40, still include it
- If you cannot read a name clearly, include your best guess
- Do NOT include headers, total scores, or rankings — only individual player rows
- If no valid players found, return: []`;

/**
 * Main OCR Extraction — sends images to /api/ocr proxy
 */
export async function runOCRExtraction(imageURIs) {
    let allRecords = [];
    let lastError = null;

    const promises = imageURIs.map(async (uri, i) => {
        console.log(`[OCR] Processing image ${i + 1} of ${imageURIs.length}...`);
        try {
            const records = await extractFromImage(uri, i);
            console.log(`[OCR] Image ${i + 1}: extracted ${records.length} players`);
            return records;
        } catch (err) {
            console.error(`[OCR] Failed on image ${i + 1}:`, err.message);
            lastError = err.message;
            return [];
        }
    });

    const results = await Promise.all(promises);
    results.forEach(records => {
        allRecords = allRecords.concat(records);
    });

    if (allRecords.length === 0) {
        throw new Error(`No player data could be extracted. Details: ${lastError || 'Unknown error'}`);
    }

    return resolveDuplicates(allRecords);
}

/**
 * Calls the /api/ocr Vercel serverless proxy
 */
async function extractFromImage(base64DataURI, imageIndex) {
    const base64Data = base64DataURI.split(',')[1];
    const mimeType = base64DataURI.split(';')[0].split(':')[1] || 'image/png';

    const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mimeType, prompt: OCR_PROMPT })
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        let errBody = {};
        try { errBody = JSON.parse(errText); } catch(e) {}
        throw new Error(errBody?.error || `OCR API error (${resp.status}): ${errText.substring(0, 50)}`);
    }

    const contentType = resp.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const errText = await resp.text();
        throw new Error(`OCR API returned non-JSON response. Ensure you are running via 'vercel dev'. Content: ${errText.substring(0, 50)}...`);
    }

    const data = await resp.json();
    const rawText = data?.text || '';

    let parsed = [];
    try {
        if (!rawText) throw new Error("API returned empty string (possibly blocked by safety filters)");
        const clean = rawText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) throw new Error("Parsed JSON is not an array");
    } catch (e) {
        throw new Error(`Parse failed: ${e.message}. Raw Output: ${rawText.substring(0, 150)}`);
    }

    if (parsed.length === 0) {
        throw new Error(`Model returned an empty array. Raw Output: ${rawText.substring(0, 50)}`);
    }

    return parsed.map(entry => {
        const kills = parseInt(entry.kills, 10);
        const conf = isNaN(kills) || kills > 40 ? 0.5 : 0.95;
        return {
            sourceImage: `Image_${imageIndex + 1}`,
            rawPlayerName: entry.name || 'Unknown',
            normalizedName: (entry.name || '').trim(),
            rawKills: isNaN(kills) ? 0 : kills,
            normalizedKills: isNaN(kills) ? 0 : kills,
            teamSlot: 'Unknown',
            confidence: conf,
            isDuplicate: false
        };
    }).filter(r => r.normalizedName.length > 0);
}

/**
 * Deduplicate players across multiple screenshots
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
                isMatch = true;
                break;
            } else if (dist >= THRESHOLD && current.rawKills !== existing.rawKills) {
                current.confidence = 0.5;
                current.isDuplicate = true;
            }
        }
        if (!isMatch) unique.push(current);
    });

    return unique;
}
