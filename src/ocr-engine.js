/**
 * ocr-engine.js — Nova Stat Engine
 * Client-side pipeline for calling the OCR API and parsing results.
 */

export async function runOCRExtraction(imageURIs, authToken, ocrType = 'players') {
    let allRecords = [];
    let lastError = null;
    let quotaExhausted = false;

    for (let i = 0; i < imageURIs.length; i++) {
        const uri = imageURIs[i];
        console.log(`[OCR] Processing image ${i + 1} of ${imageURIs.length} (${ocrType})...`);

        // Small delay between images to reduce rate limit pressure
        if (i > 0) await new Promise(r => setTimeout(r, 1500));

        try {
            const records = await extractFromImage(uri, i, authToken, ocrType);
            console.log(`[OCR] Image ${i + 1}: extracted ${records.length} items`);
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
        throw new Error(`No ${ocrType === 'teams' ? 'team' : 'player'} data could be extracted. Details: ${lastError || 'Unknown error'}`);
    }

    return resolveDuplicates(allRecords, ocrType);
}

async function extractFromImage(base64DataURI, imageIndex, authToken, ocrType = 'players') {
    const base64Data = base64DataURI.split(',')[1];
    const mimeType = base64DataURI.split(';')[0].split(':')[1] || 'image/png';

    const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ image: base64Data, mimeType, type: ocrType })
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        let errBody = {};
        try { errBody = JSON.parse(errText); } catch(e) {}
        const detail = errBody?.details || errBody?.detail || '';
        const errMsg = (errBody?.error || `OCR API error (${resp.status})`) + (detail ? ` — ${detail}` : '');

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
        let clean = rawText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        
        // Escape invalid backslashes that break JSON.parse
        clean = clean.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
        
        // Remove raw control characters that are invalid in JSON
        clean = clean.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) throw new Error("Parsed JSON is not an array");
    } catch (e) {
        throw new Error(`Parse failed: ${e.message}`);
    }

    if (parsed.length === 0) throw new Error("Model returned an empty array");

    if (ocrType === 'teams') {
        return parsed.map(entry => {
            const rank = parseInt(entry.rank || entry.placement || entry.position, 10);
            const kills = parseInt(entry.kills ?? entry.teamKills ?? entry.totalKills, 10);
            const teamValue = entry.team ?? entry.teamSlot ?? entry.team_slot ?? entry.team_name ?? entry.teamName;
            const teamLabel = typeof teamValue === 'number' || /^\d+$/.test(String(teamValue || '').trim())
                ? `Team ${teamValue}`
                : String(teamValue || 'Unknown').trim();
            
            return {
                sourceImage: `Image_${imageIndex + 1}`,
                rank: isNaN(rank) ? null : rank,
                teamSlot: teamLabel,
                kills: isNaN(kills) ? 0 : kills,
                confidence: isNaN(kills) ? 0.5 : 0.95
            };
        }).filter(r => r.teamSlot !== 'Unknown');
    }

    return parsed.map(entry => {
        const kills = parseInt(entry.kills, 10);
        const conf = isNaN(kills) || kills > 40 ? 0.5 : 0.95;
        const teamValue = entry.team ?? entry.team_name ?? entry.teamName;
        const teamLabel = typeof teamValue === 'number' || /^\d+$/.test(String(teamValue || '').trim())
            ? `Team ${teamValue}`
            : String(teamValue || 'Unknown').trim();
        
        return {
            sourceImage: `Image_${imageIndex + 1}`,
            normalizedName: (entry.name || '').trim(),
            rawKills: isNaN(kills) ? 0 : kills,
            normalizedKills: isNaN(kills) ? 0 : kills,
            teamSlot: teamLabel,
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

function resolveDuplicates(records, ocrType = 'players') {
    const unique = [];
    const senseSetting = typeof window !== 'undefined' ? localStorage.getItem('nova_setting_ocr_sense') : null;
    const THRESHOLD = senseSetting ? parseFloat(senseSetting) : 0.75;

    records.forEach(current => {
        let isMatch = false;
        for (let i = 0; i < unique.length; i++) {
            const existing = unique[i];
            
            if (ocrType === 'teams') {
                const num1 = current.teamSlot.match(/\d+/)?.[0];
                const num2 = existing.teamSlot.match(/\d+/)?.[0];
                if (num1 || num2) {
                    isMatch = (num1 === num2);
                } else {
                    const dist = calculateSimilarity(
                        current.teamSlot.toLowerCase().trim(),
                        existing.teamSlot.toLowerCase().trim()
                    );
                    isMatch = (dist >= THRESHOLD);
                }
            } else {
                const dist = calculateSimilarity(
                    current.normalizedName.toLowerCase(),
                    existing.normalizedName.toLowerCase()
                );
                isMatch = (dist >= THRESHOLD);
            }

            // If key field is very similar, it is a duplicate!
            if (isMatch) {
                // Merge duplicate entries: keep the one with higher confidence, or more kills if confidence is equal
                const currentVal = ocrType === 'teams' ? current.kills : current.normalizedKills;
                const existingVal = ocrType === 'teams' ? existing.kills : existing.normalizedKills;
                if (current.confidence > existing.confidence || 
                    (current.confidence === existing.confidence && currentVal > existingVal)) {
                    unique[i] = current;
                }
                break;
            }
        }
        if (!isMatch) unique.push(current);
    });

    return unique;
}
