/**
 * /api/bootstrap-owner — Vercel Serverless
 * Auto-assigns owner role on first login if email matches OWNER_EMAIL
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const supabase = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    // Verify the JWT and get the user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    const ownerEmail = process.env.OWNER_EMAIL;
    if (!ownerEmail) return res.status(500).json({ error: 'OWNER_EMAIL not configured' });

    // Check if user email matches owner email
    if (user.email !== ownerEmail) {
        // Not the owner — check if they have any role
        const { data: existing } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        return res.status(200).json({ role: existing?.role || null });
    }

    // Check if owner already exists
    const { data: ownerExists } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'owner')
        .maybeSingle();

    if (ownerExists) {
        // Owner exists — just return their role
        const { data: myRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        return res.status(200).json({ role: myRole?.role || null });
    }

    // Bootstrap: insert owner role
    const { error: insertErr } = await supabase.from('user_roles').upsert({
        user_id: user.id,
        email: user.email,
        role: 'owner',
        assigned_by: user.id
    }, { onConflict: 'user_id' });

    if (insertErr) {
        console.error('[Bootstrap] Insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to bootstrap owner' });
    }

    console.log(`[Bootstrap] Owner role assigned to ${user.email}`);
    return res.status(200).json({ role: 'owner', bootstrapped: true });
}
