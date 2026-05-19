/**
 * /api/get-role — Vercel Serverless
 * Returns the authenticated user's role by querying user_roles
 * with the service key (bypasses RLS entirely).
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server credentials not configured' });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the JWT and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Query user_roles with service key (bypasses RLS)
    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[GetRole] Lookup failed:', error);
        return res.status(500).json({ error: 'Role lookup failed' });
    }

    return res.status(200).json({ role: data?.role || null });
}
