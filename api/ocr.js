/**
 * /api/ocr — Vercel Serverless Proxy for Gemini Vision OCR
 * API key is stored as GEMINI_API_KEY environment variable in Vercel.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
    }

    const { image, mimeType, prompt } = req.body;
    if (!image || !prompt) {
        return res.status(400).json({ error: 'Missing image or prompt.' });
    }

    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
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
            }
        );

        if (!geminiRes.ok) {
            const err = await geminiRes.json().catch(() => ({}));
            return res.status(geminiRes.status).json({
                error: err?.error?.message || 'Gemini API error'
            });
        }

        const data = await geminiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
