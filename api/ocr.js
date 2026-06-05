/**
 * /api/ocr — Vercel Serverless Function
 * Handles the actual Gemini/Groq Vision API calls securely.
 */

export const config = {
    maxDuration: 60, // Maximum execution time in seconds
};

const PLAYER_OCR_PROMPT = `You are analyzing a Call of Duty Mobile Battle Royale scrim scoreboard screenshot.

Extract every visible player entry. Each row shows a player IGN (In-Game Name), their kill count, and their team number or team name.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Example:
[{"name": "Nova|Shadow", "kills": 14, "team": "44 Regents"}, {"name": "T1_Viper", "kills": 9, "team": 1}]

CRITICAL ACCURACY RULES:
1. PLAYER KILLS ACCURACY:
   - Carefully read the player's kill count. This is typically a number from 0 to 40.
   - Do NOT confuse kills with damage (damage is usually hundreds/thousands, like 450, 1200) or placement rank (like #1, #2).
   - If a player has 0 kills, write 0. Do not skip or read as another character.
2. PLAYER NAME (IGN) ACCURACY:
   - Player names may contain special characters, clan tags, and symbols (e.g. |, ., _, -, [, ], >, <, ~, *).
   - Pay close attention to characters that look similar (e.g., '0' vs 'O', 'l' vs '1' vs 'I', '|' vs 'I').
   - Extract the name exactly as it is shown. Do not strip tags unless they are clearly separate from the IGN.
3. TEAM ASSIGNMENT & GROUPING:
   - Extract the team name or team slot/number (e.g., 1, 2, 3...) next to the player.
   - In Battle Royale scrims, players are grouped in teams of up to 4. Pay attention to the visual grouping or background colors.
   - If a player is clearly part of a team but their row doesn't have the team number visible, assign them to the same team as their teammates.
   - If only a team slot/number is visible, return that number. If a team name is visible, return the team name.
   - If a team slot/number is missing or unclear, return null.
4. NO DUPLICATE PLAYERS:
   - Ensure each player is listed exactly once per image.
   - Do NOT include headers, total team scores, or lobby rankings — only individual player rows.
5. EMPTY STATE:
   - If no valid player rows are found, return: []`;

const TEAM_OCR_PROMPT = `You are analyzing a Call of Duty Mobile Battle Royale scrim lobby results/scoreboard screenshot (specifically team placement and total team kills).

Extract every visible team entry. Each row shows a team placement/rank, team number or team name (e.g. Slot/Team 23 or "Team 23"), and the team's total kill count in that particular lobby.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Example:
[{"rank": 1, "teamSlot": "Team 23", "kills": 31}, {"rank": 2, "teamSlot": "Team 12", "kills": 10}]

CRITICAL ACCURACY RULES:
1. TEAM PLACEMENT RANK ACCURACY:
   - Read the team's placement position (e.g. 1, 2, 3...). This shows how they finished the match.
2. TEAM SLOT / NAME ACCURACY:
   - Identify the team slot/number (e.g., "Team 23", "Team 12", "Slot 5") or team name.
3. TEAM TOTAL KILLS:
   - Read the total team kills in that particular lobby.
4. NO DUPLICATE TEAMS:
   - Ensure each team is listed at most once.
5. EMPTY STATE:
   - If no valid team rows are found, return: []`;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Check required env vars first
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        if (!supabaseUrl || !serviceKey) {
            console.error('[OCR] Missing env vars:', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceKey });
            return res.status(500).json({ error: `Server config error: missing ${!supabaseUrl ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_KEY'}` });
        }

        // Verify authentication via Supabase JWT
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, serviceKey);
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            console.error('[OCR] Auth failed:', authError?.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid token', detail: authError?.message });
        }

        // Role check
        const { data: roleData, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
        if (roleError) {
            console.error('[OCR] Role check error:', roleError.message);
            return res.status(500).json({ error: 'Role check failed', detail: roleError.message });
        }
        const role = roleData?.role;
        if (role !== 'owner' && role !== 'admin') {
            return res.status(403).json({ error: `Forbidden: Your role is '${role || 'none'}'. Admin/Owner required.` });
        }

        const { image, mimeType, type = 'players' } = req.body;
        if (!image) return res.status(400).json({ error: 'No image provided' });

        const prompt = type === 'teams' ? TEAM_OCR_PROMPT : PLAYER_OCR_PROMPT;

        const KEYS = [
            { name: 'Gemini Primary', key: process.env.GEMINI_API_KEY, type: 'gemini' },
            { name: 'Gemini Backup', key: process.env.GEMINI_API_KEY_2, type: 'gemini' },
            { name: 'Groq Llama4 Scout', key: process.env.GROQ_API_KEY, type: 'groq', groq_model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
            { name: 'Groq Qwen3 VL', key: process.env.GROQ_API_KEY, type: 'groq', groq_model: 'qwen/qwen-2.5-vl-32b-instruct' }
        ].filter(k => k.key);

        if (KEYS.length === 0) {
            return res.status(500).json({ error: 'No OCR API keys configured. Add GEMINI_API_KEY or GROQ_API_KEY to Vercel env vars.' });
        }

        // Groq has a 4MB base64 limit — check size
        const imageSizeBytes = Math.ceil(image.length * 3 / 4);
        const imageSizeMB = (imageSizeBytes / (1024 * 1024)).toFixed(2);
        console.log(`[OCR] Image size: ${imageSizeMB}MB`);

        for (let i = 0; i < KEYS.length; i++) {
            const provider = KEYS[i];
            try {
                console.log(`[OCR] Trying provider ${i + 1}/${KEYS.length}: ${provider.name}`);
                let text = '';

                if (provider.type === 'gemini') {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${provider.key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
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
                    // Skip Groq if image exceeds 4MB limit
                    if (imageSizeBytes > 4 * 1024 * 1024) {
                        throw new Error(`Image too large for Groq (${imageSizeMB}MB > 4MB limit)`);
                    }
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${provider.key}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: provider.groq_model,
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: prompt },
                                        { type: "image_url", image_url: { url: `data:${mimeType || 'image/png'};base64,${image}` } }
                                    ]
                                }
                            ],
                            temperature: 0.1
                        })
                    });

                    if (!response.ok) {
                        const errBody = await response.text().catch(() => '');
                        if (response.status === 429) throw new Error('Quota Exceeded');
                        throw new Error(`Groq API Error: ${response.status} ${errBody.slice(0, 200)}`);
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
    } catch (outerError) {
        console.error('[OCR] Unhandled error:', outerError);
        return res.status(500).json({ error: 'Internal server error', detail: outerError.message });
    }
}

