/**
 * /api/ocr — Vercel Serverless Proxy for Vision OCR
 * 3-tier fallback: Gemini Key 1 → Gemini Key 2 → Groq
 *
 * Environment variables (set in Vercel dashboard + local .env):
 *   - GEMINI_API_KEY      (primary)
 *   - GEMINI_API_KEY_2    (backup — different project/account)
 *   - GROQ_API_KEY        (final fallback)
 */

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb'
        }
    }
};

/* ── Gemini Provider ──────────────────────────────────── */

const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite'
];

async function tryGeminiWithKey(apiKey, keyLabel, image, mimeType, prompt) {
    for (const model of GEMINI_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType || 'image/png', data: image } }
                        ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return { ok: true, text, model: `gemini/${model} (${keyLabel})` };
            }

            const errBody = await resp.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
            const isQuota = resp.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit');

            if (isQuota) {
                console.log(`[OCR] ${keyLabel} quota hit on ${model}, moving to next provider`);
                return { ok: false, error: `${keyLabel} quota: ${errMsg}`, isQuota: true };
            }

            // Non-quota error on this model — try next model
            console.log(`[OCR] ${keyLabel} ${model} failed: ${errMsg}`);
        } catch (err) {
            console.error(`[OCR] ${keyLabel} ${model} network error:`, err.message);
            return { ok: false, error: `${keyLabel} network: ${err.message}`, isQuota: false };
        }
    }
    return { ok: false, error: `All Gemini models failed for ${keyLabel}`, isQuota: false };
}

/* ── Groq Provider (OpenAI-compatible) ────────────────── */

const GROQ_MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-3.2-90b-vision',
    'meta-llama/llama-3.2-11b-vision'
];

async function tryGroq(apiKey, image, mimeType, prompt) {
    for (const model of GROQ_MODELS) {
        try {
            console.log(`[OCR] Trying Groq model: ${model}...`);
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType || 'image/png'};base64,${image}`
                                }
                            }
                        ]
                    }],
                    temperature: 0.1,
                    max_tokens: 2048
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const text = data?.choices?.[0]?.message?.content || '';
                return { ok: true, text, model: `groq/${model}` };
            }

            const errBody = await resp.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
            console.log(`[OCR] Groq ${model} failed: ${errMsg}`);

            const isQuota = resp.status === 429 || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');
            if (isQuota) {
                continue; // Try next Groq model
            }

            return { ok: false, error: `Groq ${model}: ${errMsg}` };
        } catch (err) {
            console.error(`[OCR] Groq ${model} network error:`, err.message);
            return { ok: false, error: `Groq network: ${err.message}` };
        }
    }
    return { ok: false, error: 'All Groq models failed or were rate-limited' };
}

/* ── Handler ──────────────────────────────────────────── */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const geminiKey1 = process.env.GEMINI_API_KEY;
    const geminiKey2 = process.env.GEMINI_API_KEY_2;
    const groqKey = process.env.GROQ_API_KEY;

    // ── Startup diagnostic: log which keys are detected ──
    const keyStatus = [
        geminiKey1 ? `✅ GEMINI_API_KEY (${geminiKey1.substring(0, 5)}...)` : '❌ GEMINI_API_KEY (not set)',
        geminiKey2 ? `✅ GEMINI_API_KEY_2 (${geminiKey2.substring(0, 5)}...)` : '❌ GEMINI_API_KEY_2 (not set)',
        groqKey    ? `✅ GROQ_API_KEY (${groqKey.substring(0, 5)}...)` : '❌ GROQ_API_KEY (not set)'
    ];
    console.log(`[OCR] Provider health check: ${keyStatus.join(' | ')}`);

    if (!geminiKey1 && !geminiKey2 && !groqKey) {
        return res.status(500).json({
            error: 'No API keys configured. Set them in your .env or Vercel dashboard.',
            keys: keyStatus
        });
    }

    const { image, mimeType, prompt } = req.body;
    if (!image || !prompt) {
        return res.status(400).json({ error: 'Missing image or prompt.' });
    }

    const errors = [];

    // ── Tier 1: Gemini Key 1 (primary) ──
    if (geminiKey1) {
        console.log(`[OCR] Attempting with Gemini Key 1...`);
        const result = await tryGeminiWithKey(geminiKey1, 'Gemini-Key-1', image, mimeType, prompt);
        if (result.ok) {
            return res.status(200).json({ text: result.text, model: result.model });
        }
        errors.push(result.error);
    }

    // ── Tier 2: Gemini Key 2 (backup) ──
    if (geminiKey2) {
        console.log(`[OCR] Attempting with Gemini Key 2...`);
        const result = await tryGeminiWithKey(geminiKey2, 'Gemini-Key-2', image, mimeType, prompt);
        if (result.ok) {
            return res.status(200).json({ text: result.text, model: result.model });
        }
        errors.push(result.error);
    }

    // ── Tier 3: Groq (final fallback) ──
    if (groqKey) {
        console.log('[OCR] Falling back to Groq...');
        const result = await tryGroq(groqKey, image, mimeType, prompt);
        if (result.ok) {
            return res.status(200).json({ text: result.text, model: result.model });
        }
        errors.push(result.error);
    }

    // ── All providers exhausted ──
    return res.status(429).json({
        error: `All providers failed. Details: ${errors.join(' | ')}`,
        keys: keyStatus
    });
}
