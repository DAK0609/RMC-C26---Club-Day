// Leaderboard page (leaderboard.html, iPad at the booth): top 10 on the right; on the left a QR
// code to play during the day, and the prize call with the 3 prize slots after Finish.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, prizeSlots, connectionBanner } from '../ui.js';
import { COPY } from '../copy.js';

const TOP = 10;
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';

async function refresh() {
  const [top, state] = await Promise.all([api.getLeaderboard(TOP), api.getState()]);
  const prize = api.currentPrize(state);
  const [calling, winners] = state.finished ? await Promise.all([
    prize ? api.getRankRow(state.winner_rank) : null,
    api.getNicknames(state.winners),
  ]) : [null, []];
  renderBoard(top, state, prize, calling);
  renderSide(state, prize, calling, new Map(winners.map((r) => [r.id, r.nickname])));
}

function renderBoard(top, state, prize, calling) {
  // Remember where each row was, so rows can slide to their new place
  const before = new Map([...$('board').children].map((li) => [li.dataset.id, li.getBoundingClientRect().top]));
  $('board').replaceChildren(...top.map((r) => row(r, state, prize, calling)));
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const li of $('board').children) {
      const dy = (before.get(li.dataset.id) ?? li.getBoundingClientRect().top) - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'ease-out' });
    }
  }
  $('board').hidden = top.length === 0;
  $('empty').hidden = top.length > 0;
  $('lb-title').textContent = state.finished ? 'Final ranking' : 'Leaderboard';
  $('lb-live').hidden = state.finished;
}

// Top 3 rows use the prize colours; #1 gets a crown. After Finish, rows get a prize or "Calling" tag.
function row(r, state, prize, calling) {
  const li = el('li', r.rank <= 3 ? `t${r.rank}` : '');
  li.dataset.id = r.id;
  const rank = el('span', 'rk');
  if (r.rank === 1) rank.innerHTML = '<svg class="ic f-white" role="img" aria-label="1st"><use href="#i-crown"/></svg>';
  else rank.textContent = `#${r.rank}`;
  const name = el('span', 'name');
  name.append(el('span', '', r.nickname));
  const won = state.winners.indexOf(r.id);
  if (won >= 0) {
    name.append(el('span', 'tag', `${COPY.place(won + 1)} prize`));
  } else if (prize && calling?.id === r.id) {
    name.append(el('span', 'tag dark', 'Calling'));
    li.classList.add('calling');
  }
  li.append(rank, name, el('span', 'pts', r.total));
  return li;
}

function renderSide(state, prize, calling, names) {
  const finished = state.finished;
  $('scan').hidden = finished;
  $('lb-banner').classList.toggle('short', finished);
  $('claim').hidden = !finished;
  $('lb-prizes').hidden = !finished;
  if (!finished) return;
  const place = prize && COPY.place(prize);
  const [small, who, text] = !prize ? COPY.board.done
    : calling ? COPY.board.calling(calling.nickname, place)
    : COPY.board.nobody(place);
  $('call-small').textContent = small;
  $('call-who').textContent = who;
  $('call-text').textContent = text;
  $('claim').classList.toggle('done', !prize);
  $('claim').classList.toggle('pulse', Boolean(prize && calling));
  $('lb-prizes').replaceChildren(...prizeSlots(state, prize, calling, names));
}

// QR code to the player page, made for wherever the site is hosted (same folder as this page).
import(QR_LIB).then(({ default: qrcode }) => {
  const qr = qrcode(0, 'M');
  qr.addData(new URL('./', location.href).href);
  qr.make();
  $('qr').innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });
}).catch((err) => console.warn('QR code not loaded', err));

keepFresh(refresh, {
  tables: ['players', 'event_state'],
  pollMs: 15_000,
  onConnection: connectionBanner(COPY.reconnecting),
});
