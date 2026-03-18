/**
 * ocr-engine.js
 * Nova Scrims Analytics — OCR Pipeline using Google Gemini Flash Vision API
 * 
 * The API key is read from localStorage (set in settings.html).
 * Images are sent as base64 to the Gemini multimodal endpoint.
 */

import stringSimilarity from 'string-similarity';

const GEMINI_MODEL = 'gemini-1.5-flash-latest';

const OCR_PROMPT = `You are analyzing a Call of Duty Mobile Battle Royale scrim scoreboard screenshot.

Your task: Extract every visible player entry from the scoreboard. Each row typically shows a player IGN (in-game name) and their kill count.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Example:
[
  {"name": "Nova|Shadow", "kills": 14},
  {"name": "T1_Viper", "kills": 9}
]

Rules:
- Include ALL visible player rows, even if confidence is low
- Player names may contain: letters, numbers, symbols like | . _ - [ ] > < ~
- Kills are always a small number (0–40). If a number looks wrong (e.g. >40), still include it but flag it.
- If you cannot read a name clearly, include your best guess anyway
- Do NOT include team names, headers, total scores, or place rankings — only individual player rows
- If no valid players are found, return an empty array: []`;

/**
 * Main OCR Extraction — calls Gemini Flash with each screenshot.
 */
export async function runOCRExtraction(imageURIs) {
    const apiKey = localStorage.getItem('nova_gemini_api_key');
    if (!apiKey || apiKey.trim() === '') {
        throw new Error('No Gemini API key found. Please set your API key in Settings → OCR Engine.');
    }

    let allRecords = [];

    for (let i = 0; i < imageURIs.length; i++) {
        console.log(`[Gemini OCR] Processing image ${i + 1} of ${imageURIs.length}...`);
        
        try {
            const records = await extractFromImage(imageURIs[i], apiKey, i);
            allRecords = allRecords.concat(records);
            console.log(`[Gemini OCR] Image ${i + 1}: extracted ${records.length} players`);
        } catch (err) {
            console.error(`[Gemini OCR] Failed on image ${i + 1}:`, err.message);
            // Continue with remaining images
        }
    }

    if (allRecords.length === 0) {
        throw new Error('No player data could be extracted. Check your screenshots or verify your API key in Settings.');
    }

    return resolveDuplicates(allRecords);
}

/**
 * Calls the Gemini API for a single image.
 */
async function extractFromImage(base64DataURI, apiKey, imageIndex) {
    // Strip the data:image/...;base64, prefix
    const base64Data = base64DataURI.split(',')[1];
    const mimeType   = base64DataURI.split(';')[0].split(':')[1] || 'image/png';

    const requestBody = {
        contents: [{
            parts: [
                { text: OCR_PROMPT },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,   // Low temperature = more deterministic/structured
            maxOutputTokens: 2048
        }
    };

    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    );

    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg  = errBody?.error?.message || resp.statusText;
        throw new Error(`Gemini API error (${resp.status}): ${errMsg}`);
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from Gemini's response
    let parsed = [];
    try {
        // Handle cases where Gemini wraps response in ```json ... ```
        const clean = rawText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) parsed = [];
    } catch (e) {
        console.warn(`[Gemini OCR] Could not parse JSON from image ${imageIndex + 1}:`, rawText);
        return [];
    }

    // Map to internal record format
    return parsed.map(entry => {
        const kills = parseInt(entry.kills, 10);
        let confLevel = 'high';
        if (isNaN(kills) || kills > 40) confLevel = 'low';

        return {
            sourceImage:    `Image_${imageIndex + 1}`,
            rawPlayerName:  entry.name || 'Unknown',
            normalizedName: (entry.name || '').trim(),
            rawKills:       isNaN(kills) ? 0 : kills,
            normalizedKills: isNaN(kills) ? 0 : kills,
            teamSlot:       'Unknown',
            confidenceLevel: confLevel,
            tesseractConf:  confLevel === 'high' ? 95 : 50, // Approximate
            isDuplicate:    false
        };
    }).filter(r => r.normalizedName.length > 0);
}

/**
 * Deduplicate players across multiple screenshots.
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
                isMatch = true; // Exact duplicate across screenshots
                break;
            } else if (dist >= THRESHOLD && current.rawKills !== existing.rawKills) {
                // Same player, different kills — flag for human review
                current.confidenceLevel = 'low';
                current.isDuplicate = true;
            }
        }

        if (!isMatch) unique.push(current);
    });

    return unique;
}
