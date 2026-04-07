/**
 * /api/ocr — Vercel Serverless Proxy for Vision OCR
 * Tries Gemini first, falls back to Groq if quota is exhausted.
 * API keys stored as environment variables in Vercel:
 *   - GEMINI_API_KEY
 *   - GROQ_API_KEY
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

async function tryGemini(apiKey, image, mimeType, prompt) {
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
                return { ok: true, text, model: `gemini/${model}` };
            }

            const errBody = await resp.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || `HTTP ${resp.status}`;
            const isQuota = resp.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit');

            if (isQuota) {
                console.log(`[OCR] Gemini quota hit on ${model}, skipping remaining Gemini models`);
                return { ok: false, error: `Gemini quota: ${errMsg}` };
            }

            console.log(`[OCR] Gemini ${model} failed: ${errMsg}`);
        } catch (err) {
            console.error(`[OCR] Gemini ${model} network error:`, err.message);
            return { ok: false, error: `Gemini network: ${err.message}` };
        }
    }
    return { ok: false, error: 'All Gemini models failed' };
}

/* ── Groq Provider (OpenAI-compatible) ────────────────── */

const GROQ_MODELS = [
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview'
];

async function tryGroq(apiKey, image, mimeType, prompt) {
    for (const model of GROQ_MODELS) {
        try {
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
                // Try next model
                continue;
            }

            // Non-quota error — return it for debugging
            return { ok: false, error: `Groq ${model}: ${errMsg}` };
        } catch (err) {
            console.error(`[OCR] Groq ${model} network error:`, err.message);
            return { ok: false, error: `Groq network: ${err.message}` };
        }
    }
    return { ok: false, error: 'All Groq models rate-limited' };
}

/* ── Handler ──────────────────────────────────────────── */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!geminiKey && !groqKey) {
        return res.status(500).json({ error: 'No API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY in Vercel env vars.' });
    }

    const { image, mimeType, prompt } = req.body;
    if (!image || !prompt) {
        return res.status(400).json({ error: 'Missing image or prompt.' });
    }

    const errors = [];

    // 1. Try Gemini first (higher accuracy)
    if (geminiKey) {
        const result = await tryGemini(geminiKey, image, mimeType, prompt);
        if (result.ok) {
            return res.status(200).json({ text: result.text, model: result.model });
        }
        errors.push(result.error);
    } else {
        errors.push('GEMINI_API_KEY not set');
    }

    // 2. Fall back to Groq
    if (groqKey) {
        console.log('[OCR] Falling back to Groq...');
        const result = await tryGroq(groqKey, image, mimeType, prompt);
        if (result.ok) {
            return res.status(200).json({ text: result.text, model: result.model });
        }
        errors.push(result.error);
    } else {
        errors.push('GROQ_API_KEY not set');
    }

    // 3. All providers exhausted — include detailed errors
    return res.status(429).json({
        error: `All providers failed. ${errors.join(' | ')}`
    });
}
