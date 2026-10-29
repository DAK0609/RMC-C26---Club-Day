import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getLeaderboard(limit) {
  let q = db.from('leaderboard').select('*').order('rank');
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getState() {
  const { data, error } = await db.from('event_state').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

// Calls onChange whenever players or event_state change.
export function subscribe(onChange) {
  return db.channel('club-day')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, onChange)
    .subscribe();
}
