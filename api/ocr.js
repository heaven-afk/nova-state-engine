/**
 * /api/ocr — Vercel Serverless Function
 * Handles the actual Gemini/Groq Vision API calls securely.
 */

export const config = {
    maxDuration: 60, // Maximum execution time in seconds
};

const OCR_PROMPT = `You are analyzing a Call of Duty Mobile Battle Royale scrim scoreboard screenshot.

Extract every visible player entry. Each row shows a player IGN and their kill count.
The screenshots also contain Team Numbers (e.g., 1, 2, 3...) next to the players.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Example:
[{"name": "Nova|Shadow", "kills": 14, "team": 1}, {"name": "T1_Viper", "kills": 9, "team": 1}]

Rules:
- Include ALL visible player rows
- Extract the Team Number for each player:
  - Max 4 players per team. If a team has more than 4, it is likely a misread.
  - If a team number is missing/unclear, you can leave it out or return null for that player.
- Player names may contain: letters, numbers, symbols like | . _ - [ ] > < ~
- Kills are 0-40. If > 40, still include it
- If you cannot read a name clearly, include your best guess
- Do NOT include headers, total scores, or rankings - only individual player rows
- If no valid players found, return: []`;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Verify authentication via Supabase JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });

    // Role check
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const role = roleData?.role;
    if (role !== 'owner' && role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required for OCR' });
    }

    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const KEYS = [
        { name: 'Gemini Primary', key: process.env.GEMINI_API_KEY, type: 'gemini' },
        { name: 'Gemini Backup', key: process.env.GEMINI_API_KEY_2, type: 'gemini' },
        { name: 'Groq LLamaVision', key: process.env.GROQ_API_KEY, type: 'groq' }
    ].filter(k => k.key);

    if (KEYS.length === 0) return res.status(500).json({ error: 'No OCR API keys configured' });

    for (let i = 0; i < KEYS.length; i++) {
        const provider = KEYS[i];
        try {
            console.log(`[OCR] Trying provider ${i + 1}/${KEYS.length}: ${provider.name}`);
            let text = '';

            if (provider.type === 'gemini') {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${provider.key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: OCR_PROMPT },
                                { inlineData: { mimeType: mimeType || 'image/png', data: image } }
                            ]
                        }]
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 429) throw new Error('Quota Exceeded');
                    throw new Error(`Gemini API Error: ${response.status} ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } 
            else if (provider.type === 'groq') {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${provider.key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "llama-3.2-11b-vision-preview",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: OCR_PROMPT },
                                    { type: "image_url", image_url: { url: `data:${mimeType || 'image/png'};base64,${image}` } }
                                ]
                            }
                        ],
                        temperature: 0.1
                    })
                });

                if (!response.ok) {
                    if (response.status === 429) throw new Error('Quota Exceeded');
                    throw new Error(`Groq API Error: ${response.status}`);
                }

                const data = await response.json();
                text = data.choices?.[0]?.message?.content || '';
            }

            // Successfully got a response
            return res.status(200).json({ text, model: provider.name });

        } catch (error) {
            console.error(`[OCR] Provider ${provider.name} failed:`, error.message);
            // If it's the last provider, return the error
            if (i === KEYS.length - 1) {
                return res.status(500).json({ 
                    error: 'All OCR providers failed.', 
                    details: error.message 
                });
            }
            // Otherwise loop continues to next provider
        }
    }
}
