/**
 * /api/staff
 * Owner-only staff role grants backed by Supabase Auth admin APIs.
 */
import { createClient } from '@supabase/supabase-js';

const VALID_ROLES = new Set(['owner', 'admin', 'mod']);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Supabase server credentials are not configured' });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: { user: requester }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !requester) return res.status(401).json({ error: 'Invalid token' });

    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', requester.id)
        .maybeSingle();

    if (roleError) return res.status(500).json({ error: 'Could not verify owner role' });
    if (roleData?.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || '').trim();

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required' });
    if (!VALID_ROLES.has(role)) return res.status(400).json({ error: 'Invalid staff role' });

    let targetUser = await findAuthUserByEmail(supabase, email);
    let invited = false;

    if (!targetUser) {
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
        if (inviteError) {
            return res.status(404).json({
                error: `No auth user found for ${email}, and invite failed: ${inviteError.message}`
            });
        }
        targetUser = inviteData?.user;
        invited = true;
    }

    if (!targetUser?.id) return res.status(500).json({ error: 'Could not resolve staff user id' });

    const { data, error } = await supabase
        .from('user_roles')
        .upsert({
            user_id: targetUser.id,
            email,
            role,
            assigned_by: requester.id,
            assigned_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) {
        console.error('[Staff] Role grant failed:', error);
        return res.status(500).json({ error: 'Failed to grant staff access' });
    }

    return res.status(200).json({ staff: data, invited });
}

async function findAuthUserByEmail(supabase, email) {
    const normalizedEmail = email.toLowerCase();
    let page = 1;
    const perPage = 100;

    while (page <= 20) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const match = data?.users?.find(user => user.email?.toLowerCase() === normalizedEmail);
        if (match) return match;

        if (!data?.users || data.users.length < perPage) break;
        page += 1;
    }

    return null;
}
