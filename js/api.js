// Every database call the pages make goes through this file.
// Pages never call `db.from(...)` directly, so the rules live in one place.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Errors the pages know how to explain:
//   NICKNAME_TAKEN  another player already has this nickname
//   CLOSED          Finish was pressed, or this entry is locked / removed
//   INVALID         a number outside the allowed range reached the database
//   FAILED          anything else, usually no internet
export class AppError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

const CODES = { '23505': 'NICKNAME_TAKEN', '42501': 'CLOSED', '23514': 'INVALID', '22003': 'INVALID' };

function check({ data, error, count }) {
  if (error) throw new AppError(CODES[error.code] ?? 'FAILED', error);
  return count ?? data;
}

// ---- Shared ----

export async function getState() {
  return check(await db.from('event_state').select('*').eq('id', 1).single());
}

// Prizes go to 1st, 2nd and 3rd. A skipped player is passed over, so the next
// player in line takes their prize.
export const PRIZES = 3;

// The prize being handed out now (1, 2 or 3), or null once all are given.
export const currentPrize = (state) => (state.winners.length < PRIZES ? state.winners.length + 1 : null);

// Ranked, confirmed players, rank 1 first. Pass `limit` for a top-N.
export async function getLeaderboard(limit) {
  let query = db.from('leaderboard').select('*').order('rank');
  if (limit) query = query.limit(limit);
  return check(await query);
}

// Nicknames for these player ids (the prize winners). Removed players are left out.
export async function getNicknames(ids) {
  if (!ids.length) return [];
  return check(await db.from('leaderboard').select('id, nickname').in('id', ids));
}

export async function getRankRow(rank) {
  return check(await db.from('leaderboard').select('*').eq('rank', rank).maybeSingle());
}

// ---- Player ----

export async function getPlayer(id) {
  return check(await db.from('players').select('*').eq('id', id).maybeSingle());
}

export async function createPlayer(nickname) {
  return check(await db.from('players').insert({ nickname }).select().single());
}

export async function getMyRank(id) {
  return check(await db.from('leaderboard').select('*').eq('id', id).maybeSingle());
}

// Saves one game's number as a draft. Nothing is final until confirmResults.
export function saveGame(id, key, value) {
  return updateOpenEntry(id, { [key]: value });
}

// Locks the entry. The database replaces confirmed_at with its own clock,
// so a phone with a wrong clock can't jump ahead in a tie.
export function confirmResults(id, { g1, g2, g3 }) {
  return updateOpenEntry(id, { g1, g2, g3, confirmed_at: new Date().toISOString() });
}

// Row security only lets an entry change while it's unconfirmed and the event
// is open; otherwise the update matches no row.
async function updateOpenEntry(id, patch) {
  const row = check(await db.from('players').update(patch).eq('id', id).select().maybeSingle());
  if (!row) throw new AppError('CLOSED');
  return row;
}

// ---- Admin ----

export async function countPlayers() {
  return check(await db.from('players').select('id', { count: 'exact', head: true }));
}

async function setState(patch) {
  return check(await db.from('event_state').update(patch).eq('id', 1).select().single());
}

export const finishEvent = () => setState({ finished: true });
export const reopenEvent = () => setState({ finished: false, winner_rank: 1, winners: [] });

// Records the current prize as given to `winnerId` and invites the next rank.
export function givePrize(state, winnerId) {
  return moveOn(state.winner_rank, { winners: [...state.winners, winnerId] });
}

// Invites the next rank for the same prize.
export const skipWinner = (fromRank) => moveOn(fromRank, {});

// Only moves on from `fromRank`: if two organisers tap at the same moment,
// one player is given / skipped, not two.
async function moveOn(fromRank, patch) {
  return check(await db.from('event_state').update({ ...patch, winner_rank: fromRank + 1 })
    .eq('id', 1).eq('winner_rank', fromRank).select().maybeSingle());
}

export async function removePlayer(id) {
  return check(await db.from('players').delete().eq('id', id));
}
