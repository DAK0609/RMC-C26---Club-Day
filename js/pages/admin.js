// Admin page (admin.html, organiser): Finish, prize handout, remove fake entries.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, prizeSlots, busy, connectionBanner } from '../ui.js';
import { COPY } from '../copy.js';

let state = null;
let winner = null; // the leaderboard row currently invited to claim the prize

async function refresh() {
  const [s, ranked, joined] = await Promise.all([api.getState(), api.getLeaderboard(), api.countPlayers()]);
  state = s;
  winner = ranked.find((r) => r.rank === s.winner_rank) ?? null;
  renderStatus(ranked.length, joined);
  renderPrize(ranked);
  renderPlayers(ranked);
}

function renderStatus(confirmed, joined) {
  const finished = state.finished;
  $('pill').textContent = finished ? 'Finished' : 'Open';
  $('pill').classList.toggle('done', finished);
  $('n-joined').textContent = joined;
  $('n-confirmed').textContent = confirmed;
  $('n-playing').textContent = joined - confirmed;
  $('n-playing-label').textContent = finished ? 'never confirmed' : 'still playing';
  $('open-card').hidden = finished;
  $('reopen-row').hidden = !finished;
  $('table-title').textContent = finished ? 'Final ranking' : 'Ranking';
}

// One card: the same 3 prize slots as the iPad, who is invited (with their scores, a last
// check for fake entries), and the two buttons.
function renderPrize(ranked) {
  const prize = api.currentPrize(state);
  $('prize').hidden = !state.finished;
  $('now').hidden = !prize;
  $('done').hidden = !!prize;
  const names = new Map(ranked.map((r) => [r.id, r.nickname]));
  $('ad-prizes').replaceChildren(...prizeSlots(state, prize, winner, names));
  if (prize) $('place').textContent = 'Inviting for the prize';
  $('winner').textContent = winner ? `#${winner.rank} ${winner.nickname}` : 'No more players in line';
  $('winner-scores').textContent = winner ? `${winner.total} points: ${scores(winner)}` : '';
  $('given').disabled = $('skip').disabled = !prize || !winner;
  document.querySelector('.ad-actions').hidden = !prize; // nothing left to hand out
  $('winners').replaceChildren(...state.winners.map((id, i) =>
    el('li', '', `Prize: ${names.get(id) ?? '(removed player)'}`)));
}

const scores = (r) => `G1 ${r.g1}, G2 ${r.g2}, G3 ${r.g3}`;

// On a phone the G1/G2/G3 columns fold into one small line under the name (the .sc cell).
function renderPlayers(ranked) {
  const prize = api.currentPrize(state);
  $('players').replaceChildren(...ranked.map((r) => {
    const tr = el('tr', state.finished && prize && r.rank === state.winner_rank ? 'calling' : '');
    const rank = el('td', 'rk');
    rank.append(el('span', r.rank <= 3 ? `tok r${r.rank}` : 'tok', r.rank));
    const name = el('td', 'nm', r.nickname);
    const won = state.winners.indexOf(r.id);
    if (won >= 0) name.append(' ', el('span', 'tag', COPY.prizeTag));
    tr.append(rank, name);
    for (const g of [r.g1, r.g2, r.g3]) tr.append(el('td', 'n g', g));
    tr.append(el('td', 'sc', scores(r)), el('td', 'n tot', r.total));
    const remove = el('button', 'btn icon');
    remove.setAttribute('aria-label', `Remove ${r.nickname}`);
    remove.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg>';
    action(remove, () => api.removePlayer(r.id),
      `Remove "${r.nickname}" (${r.total} points)? Everyone below moves up one rank. This can't be undone.`);
    const cell = el('td', 'rm');
    cell.append(remove);
    tr.append(cell);
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
action($('given'), () => api.givePrize(state, winner.id),
  () => `Confirm the prize was given to ${winner?.nickname}?`);
action($('skip'), () => api.skipWinner(state.winner_rank),
  () => `${winner?.nickname} is not here? The prize moves to the next player in line.`);

const run = keepFresh(refresh, {
  tables: ['players', 'event_state'],
  pollMs: 15_000,
  onConnection: connectionBanner('Connection lost, retrying…'),
});
