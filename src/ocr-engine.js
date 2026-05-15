/**
 * ocr-engine.js — Nova Stat Engine
 * Client-side pipeline for calling the OCR API and parsing results.
 */

export async function runOCRExtraction(imageURIs, authToken) {
    let allRecords = [];
    let lastError = null;
    let quotaExhausted = false;

    for (let i = 0; i < imageURIs.length; i++) {
        const uri = imageURIs[i];
        console.log(`[OCR] Processing image ${i + 1} of ${imageURIs.length}...`);

        // Small delay between images to reduce rate limit pressure
        if (i > 0) await new Promise(r => setTimeout(r, 1500));

        try {
            const records = await extractFromImage(uri, i, authToken);
            console.log(`[OCR] Image ${i + 1}: extracted ${records.length} players`);
            allRecords = allRecords.concat(records);
        } catch (err) {
            console.error(`[OCR] Failed on image ${i + 1}:`, err.message);
            lastError = err.message;
            if (err.isQuotaError) {
                quotaExhausted = true;
                break;
            }
        }
    }

    if (allRecords.length === 0) {
        if (quotaExhausted) throw new Error('API quota exhausted across all providers. Try again later.');
        throw new Error(`No player data could be extracted. Details: ${lastError || 'Unknown error'}`);
    }

    return resolveDuplicates(allRecords);
}

async function extractFromImage(base64DataURI, imageIndex, authToken) {
    const base64Data = base64DataURI.split(',')[1];
    const mimeType = base64DataURI.split(';')[0].split(':')[1] || 'image/png';

    const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ image: base64Data, mimeType })
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        let errBody = {};
        try { errBody = JSON.parse(errText); } catch(e) {}
        const errMsg = errBody?.error || `OCR API error (${resp.status})`;

        const isQuota = resp.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('all ocr providers');
        if (isQuota) {
            const err = new Error(errMsg);
            err.isQuotaError = true;
            throw err;
        }
        throw new Error(errMsg);
    }

    const data = await resp.json();
    const rawText = data?.text || '';

    let parsed = [];
    try {
        if (!rawText) throw new Error("API returned empty string");
        const clean = rawText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) throw new Error("Parsed JSON is not an array");
    } catch (e) {
        throw new Error(`Parse failed: ${e.message}`);
    }

    if (parsed.length === 0) throw new Error("Model returned an empty array");

    return parsed.map(entry => {
        const kills = parseInt(entry.kills, 10);
        const conf = isNaN(kills) || kills > 40 ? 0.5 : 0.95;
        const teamNum = entry.team ? `Team ${entry.team}` : 'Unknown';
        
        return {
            sourceImage: `Image_${imageIndex + 1}`,
            normalizedName: (entry.name || '').trim(),
            rawKills: isNaN(kills) ? 0 : kills,
            normalizedKills: isNaN(kills) ? 0 : kills,
            teamSlot: teamNum,
            confidence: conf
        };
    }).filter(r => r.normalizedName.length > 0);
}

function calculateSimilarity(s1, s2) {
    let longer = s1, shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    const costs = [];
    for (let i = 0; i <= longerLength; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longerLength - costs[shorter.length]) / longerLength;
}

function resolveDuplicates(records) {
    const unique = [];
    const THRESHOLD = 0.75; // Sensitivity for matching names

    records.forEach(current => {
        let isMatch = false;
        for (let i = 0; i < unique.length; i++) {
            const existing = unique[i];
            const dist = calculateSimilarity(
                current.normalizedName.toLowerCase(),
                existing.normalizedName.toLowerCase()
            );
            // If name is very similar AND kills are identical, it's a true duplicate
            if (dist >= THRESHOLD && current.rawKills === existing.rawKills) {
                isMatch = true;
                break;
            }
        }
        if (!isMatch) unique.push(current);
    });

    return unique;
}
