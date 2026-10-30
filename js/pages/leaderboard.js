// Leaderboard page (leaderboard.html, iPad): top 10, plus who is invited to claim the prize after Finish.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, connectionBanner } from '../ui.js';
import { COPY } from '../copy.js';

const TOP = 10;

async function refresh() {
  const [top, state] = await Promise.all([api.getLeaderboard(TOP), api.getState()]);
  const prize = api.currentPrize(state);
  const winner = state.finished && prize ? await api.getRankRow(state.winner_rank) : null;
  renderBoard(top);
  renderClaim(state, prize, winner);
}

function renderBoard(top) {
  $('board').replaceChildren(...top.map((r) => {
    const li = el('li', r.rank === 1 ? 'first' : '');
    li.append(
      el('span', 'rank', r.rank === 1 ? '👑' : `#${r.rank}`),
      el('span', 'name', r.nickname),
      el('span', 'total', r.total),
    );
    return li;
  }));
  $('empty').hidden = top.length > 0;
}

function renderClaim(state, prize, winner) {
  $('claim').hidden = !state.finished;
  if (!state.finished) return;
  $('claim').textContent = !prize ? COPY.prizeGiven
    : winner ? COPY.claimPrize(winner.nickname, prize)
    : COPY.noMorePlayers;
}

keepFresh(refresh, {
  tables: ['players', 'event_state'],
  pollMs: 15_000,
  onConnection: connectionBanner(COPY.reconnecting),
});
