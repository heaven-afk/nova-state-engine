/**
 * /api/teams-form.js
 * GET /api/teams/:id/form — individual team form
 * GET /api/teams/form — team form leaderboard
 */
import { createClient } from '@supabase/supabase-js';

const GRACE_PERIOD_DAYS = 2;
const DECAY_RATE = 0.08;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Supabase server credentials are not configured' });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { id } = req.query;

    try {
        if (id) {
            // GET /api/teams/:id/form
            const { data: team, error: teamErr } = await supabase
                .from('teams')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (teamErr) throw teamErr;
            if (!team) {
                return res.status(404).json({ error: `Team with ID ${id} not found` });
            }

            // Get latest form history entry
            const { data: history, error: histErr } = await supabase
                .from('form_history')
                .select('*')
                .eq('entity_type', 'team')
                .eq('entity_id', id)
                .order('computed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (histErr) throw histErr;

            if (!history) {
                return res.status(200).json({
                    team_id: team.id,
                    team_name: team.team_name,
                    team_logo: team.team_logo,
                    raw_form: null,
                    decayed_form: null,
                    confidence: 'unranked',
                    trend: 'new',
                    matches_used: [],
                    last_played_date: null
                });
            }

            // Apply live decay
            let decayedForm = Number(history.raw_form || 0);
            if (history.last_played_date) {
                const days = getDaysInactive(history.last_played_date);
                let multiplier = 1;
                if (days > GRACE_PERIOD_DAYS) {
                    multiplier = Math.max(0, 1 - DECAY_RATE * (days - GRACE_PERIOD_DAYS));
                }
                decayedForm = Number(history.raw_form || 0) * multiplier;
            } else {
                decayedForm = null;
            }

            return res.status(200).json({
                team_id: team.id,
                team_name: team.team_name,
                team_logo: team.team_logo,
                raw_form: history.raw_form ? Number(history.raw_form) : null,
                decayed_form: decayedForm,
                confidence: history.confidence,
                trend: history.trend,
                matches_used: history.matches_used,
                last_played_date: history.last_played_date,
                computed_at: history.computed_at
            });

        } else {
            // GET /api/teams/form (Leaderboard)
            const { data: teams, error: teamsErr } = await supabase
                .from('teams')
                .select('id, team_name, team_logo');
            if (teamsErr) throw teamsErr;

            const { data: allHistory, error: histErr } = await supabase
                .from('form_history')
                .select('*')
                .eq('entity_type', 'team')
                .order('computed_at', { ascending: false });
            if (histErr) throw histErr;

            // Map latest form entry for each team ID
            const latestHistoryMap = {};
            (allHistory || []).forEach(entry => {
                if (!latestHistoryMap[entry.entity_id]) {
                    latestHistoryMap[entry.entity_id] = entry;
                }
            });

            // Calculate live decay for all teams
            const leaderboard = (teams || []).map(team => {
                const history = latestHistoryMap[team.id];
                if (!history) {
                    return {
                        team_id: team.id,
                        team_name: team.team_name,
                        team_logo: team.team_logo,
                        raw_form: null,
                        decayed_form: null,
                        confidence: 'unranked',
                        trend: 'new',
                        matches_used: [],
                        last_played_date: null
                    };
                }

                let decayedForm = Number(history.raw_form || 0);
                if (history.last_played_date) {
                    const days = getDaysInactive(history.last_played_date);
                    let multiplier = 1;
                    if (days > GRACE_PERIOD_DAYS) {
                        multiplier = Math.max(0, 1 - DECAY_RATE * (days - GRACE_PERIOD_DAYS));
                    }
                    decayedForm = Number(history.raw_form || 0) * multiplier;
                } else {
                    decayedForm = null;
                }

                return {
                    team_id: team.id,
                    team_name: team.team_name,
                    team_logo: team.team_logo,
                    raw_form: history.raw_form ? Number(history.raw_form) : null,
                    decayed_form: decayedForm,
                    confidence: history.confidence,
                    trend: history.trend,
                    matches_used: history.matches_used,
                    last_played_date: history.last_played_date,
                    computed_at: history.computed_at
                };
            });

            // Sort by decayed_form desc, putting unranked / null at the bottom
            leaderboard.sort((a, b) => {
                if (a.confidence === 'unranked' && b.confidence !== 'unranked') return 1;
                if (a.confidence !== 'unranked' && b.confidence === 'unranked') return -1;
                if (a.decayed_form === null && b.decayed_form !== null) return 1;
                if (a.decayed_form !== null && b.decayed_form === null) return -1;
                return (b.decayed_form || 0) - (a.decayed_form || 0);
            });

            return res.status(200).json(leaderboard);
        }

    } catch (err) {
        console.error('[Teams Form API] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}

// Utility to calculate days inactive
function getDaysInactive(lastPlayedDateStr) {
    const today = new Date();
    const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const pDate = new Date(lastPlayedDateStr);
    const lpDate = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
    const diffTime = tDate - lpDate;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}
