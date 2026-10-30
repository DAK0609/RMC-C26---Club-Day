// Admin page (admin.html, organiser): Finish, prize handout, remove fake entries.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, busy, connectionBanner } from '../ui.js';

let state = null;
let winner = null; // the leaderboard row currently invited to claim the prize

async function refresh() {
  const [s, ranked, joined] = await Promise.all([api.getState(), api.getLeaderboard(), api.countPlayers()]);
  state = s;
  winner = ranked.find((r) => r.rank === s.winner_rank) ?? null;
  renderStatus(ranked.length, joined);
  renderPrize();
  renderPlayers(ranked);
}

function renderStatus(confirmed, joined) {
  $('stats').textContent =
    `${joined} joined · ${confirmed} confirmed · ${joined - confirmed} still playing`;
  $('status').textContent = state.finished
    ? 'Finished: the ranking is locked and no more results are accepted.'
    : 'Open: accepting results.';
  $('finish').hidden = state.finished;
  $('reopen').hidden = !state.finished;
}

function renderPrize() {
  $('prize').hidden = !state.finished;
  $('winner').textContent = !winner ? 'No more players in line'
    : `#${winner.rank} ${winner.nickname}` + (state.prize_given ? ' (prize given)' : '');
  $('given').disabled = $('skip').disabled = state.prize_given || !winner;
}

function renderPlayers(ranked) {
  $('players').replaceChildren(...ranked.map((r) => {
    const tr = el('tr', r.rank === state.winner_rank && state.finished ? 'current' : '');
    for (const v of [r.rank, r.nickname, r.g1, r.g2, r.g3, r.total]) tr.append(el('td', '', v));
    const remove = el('button', 'secondary', 'Remove');
    action(remove, () => api.removePlayer(r.id),
      `Remove "${r.nickname}" (${r.total} points)? Everyone below moves up one rank. This can't be undone.`);
    const td = el('td');
    td.append(remove);
    tr.append(td);
    return tr;
  }));
  $('no-players').hidden = ranked.length > 0;
}

// Wires a button: confirm → run the task (button disabled meanwhile) → reload.
// `question` can be a function so it reads the latest data when tapped.
function action(button, task, question) {
  button.onclick = () => {
    const text = typeof question === 'function' ? question() : question;
    if (text && !confirm(text)) return;
    busy(button, async () => {
      try {
        await task();
      } catch (err) {
        console.error(err);
        alert("Couldn't save. Check the internet connection and try again.");
      }
      await run();
    });
  };
}

action($('finish'), api.finishEvent,
  'Finish now? The ranking locks and players can no longer submit results.');
action($('reopen'), api.reopenEvent,
  'Reopen? Players can submit again and the prize handout restarts from #1.');
action($('given'), api.markPrizeGiven,
  () => `Confirm the prize was given to ${winner?.nickname}?`);
action($('skip'), () => api.skipWinner(state.winner_rank),
  () => `Skip ${winner?.nickname}? The prize moves to the next player in line.`);

const run = keepFresh(refresh, {
  tables: ['players', 'event_state'],
  pollMs: 15_000,
  onConnection: connectionBanner('Connection lost, retrying…'),
});
