// Player page (index.html): welcome → enter 3 games → pet → final result after Finish.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, showScreen, busy, toast, connectionBanner } from '../ui.js';
import { GAMES } from '../games.js';
import { petFor } from '../pets.js';
import { COPY } from '../copy.js';

// Some upper limit is needed so the database number can't overflow; the spec says "no limit".
const TECHNICAL_MAX = 999_999;

// ---- Who is this player? ----
// Their personal link is index.html?id=<uuid>. localStorage brings them back if
// they reopen the plain QR link in the same browser.
let playerId = new URLSearchParams(location.search).get('id') || localStorage.getItem('playerId');
if (playerId) localStorage.setItem('playerId', playerId);

function rememberPlayer(id) {
  playerId = id;
  localStorage.setItem('playerId', id);
  history.replaceState(null, '', `?id=${id}`);
}

function forgetPlayer() {
  playerId = null;
  localStorage.removeItem('playerId');
  history.replaceState(null, '', location.pathname);
}

// ---- Page state ----
let player = null;   // this player's row; null before they join
let state = null;    // the event_state row
let myRank = null;   // this player's leaderboard row, once confirmed
let top = [];        // the first MINI_TOP leaderboard rows, once confirmed
let calling = null;  // after Finish: the leaderboard row invited for the current prize
let editing = false; // true after "Edit": hide the summary until the next save
let current = null;  // the game open in the pop-up

const MINI_TOP = 5;

async function refresh() {
  const [p, s] = await Promise.all([playerId ? api.getPlayer(playerId) : null, api.getState()]);
  if (playerId && !p) { // removed by the organiser, or the test data was wiped
    forgetPlayer();
    $('welcome-notice').textContent = COPY.entryRemoved;
    $('welcome-notice').hidden = false;
  }
  player = p;
  state = s;
  [myRank, top, calling] = p?.confirmed_at ? await Promise.all([
    api.getMyRank(p.id),
    api.getLeaderboard(MINI_TOP),
    s.finished && api.currentPrize(s) ? api.getRankRow(s.winner_rank) : null,
  ]) : [null, [], null];
  render();
}

// Picks the screen from the data. Every change goes through here.
function render() {
  if (!player) {
    return state.finished ? showClosed(COPY.ended) : showScreen('welcome');
  }
  if (!player.confirmed_at) {
    if (state.finished) return showClosed(COPY.closed);
    renderCards();
    return showScreen('results');
  }
  renderPet();
}

function showClosed(text) {
  if ($('game-dialog').open) $('game-dialog').close();
  $('closed-text').textContent = text;
  showScreen('closed');
}

// "CLOSED" means the event finished (or the entry was locked/removed) since the
// page last loaded: reload and the right screen explains it.
function handleError(err) {
  if (err.code === 'CLOSED') return run();
  console.error(err);
  toast(COPY.failed);
}

// ---- Screen 1: Welcome ----

$('welcome-form').onsubmit = (e) => {
  e.preventDefault();
  const nickname = $('nickname').value.trim().replace(/\s+/g, ' ');
  if (!nickname) return toast(COPY.nicknameEmpty);
  busy($('start'), async () => {
    try {
      player = await api.createPlayer(nickname);
      rememberPlayer(player.id);
      $('welcome-notice').hidden = true;
      render();
    } catch (err) {
      if (err.code === 'NICKNAME_TAKEN') return $('taken').showModal();
      handleError(err);
    }
  });
};

// ---- Screen 2: Results ----
// Each game is saved as a draft the moment it's entered, so closing the page keeps progress.

const draft = () => ({ g1: player.g1, g2: player.g2, g3: player.g3 });

function renderCards() {
  const d = draft();
  $('game-cards').replaceChildren(...GAMES.map((g, i) => {
    const done = d[g.key] != null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card' + (done ? ' done' : '');
    card.innerHTML = `<img class="game-img" src="${g.img}" alt="">
      <span class="game-label"><small>Game ${i + 1}</small>${g.name}</span>
      <span class="game-status">${done ? '✓ ' + d[g.key] : 'Tap to enter'}</span>`;
    card.onclick = () => openGame(g, i);
    return card;
  }));

  const allDone = GAMES.every((g) => d[g.key] != null);
  $('summary').textContent = COPY.summary(d);
  $('confirm').hidden = !allDone || editing;
}

function openGame(g, i) {
  current = g;
  $('gd-img').src = g.img;
  $('gd-title').textContent = `Game ${i + 1} · ${g.name}`;
  $('gd-question').textContent = g.question;
  $('gd-input').max = g.max ?? '';
  $('gd-input').value = player[g.key] ?? '';
  $('gd-error').hidden = true;
  $('game-dialog').showModal();
}

const inputValue = () => Number($('gd-input').value) || 0;
$('gd-minus').onclick = () => { $('gd-input').value = Math.max(0, inputValue() - 1); };
$('gd-plus').onclick = () => { $('gd-input').value = Math.min(current.max ?? TECHNICAL_MAX, inputValue() + 1); };
$('gd-cancel').onclick = () => $('game-dialog').close();

function showGameError(text) {
  $('gd-error').textContent = text;
  $('gd-error').hidden = false;
}

$('game-form').onsubmit = (e) => {
  e.preventDefault();
  const raw = $('gd-input').value.trim();
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n > (current.max ?? TECHNICAL_MAX)) {
    return showGameError(COPY.invalidNumber(current.max));
  }
  busy($('gd-save'), async () => {
    try {
      player = await api.saveGame(player.id, current.key, n);
      editing = false;
      $('game-dialog').close();
      render();
    } catch (err) {
      if (err.code === 'CLOSED') {
        $('game-dialog').close();
        return run();
      }
      showGameError(err.code === 'INVALID' ? COPY.invalidNumber(current.max) : COPY.failed);
    }
  });
};

$('edit').onclick = () => {
  editing = true;
  renderCards();
};

// "Yes" saves and locks the entry forever.
$('yes').onclick = () => busy($('yes'), async () => {
  try {
    player = await api.confirmResults(player.id, draft());
    render();
    run(); // loads the mini leaderboard with this player in it
  } catch (err) {
    handleError(err);
  }
});

// ---- Screen 3: Pet + mini leaderboard (ranks only, no score or formula shown) ----

function renderPet() {
  const pet = petFor(player.total);
  $('pet-img').src = pet.img;
  $('pet-img').alt = pet.name;
  $('pet-name').textContent = pet.name;
  $('pet-text').textContent = pet.text;

  renderMiniBoard();
  renderFinal();
  showScreen('pet');
}

// Top 5 by rank only (no points, per the spec), plus this player's own row if lower.
function renderMiniBoard() {
  const rows = [...top];
  if (myRank && myRank.rank > MINI_TOP) {
    if (myRank.rank > MINI_TOP + 1) rows.push(null); // null = "…" gap
    rows.push(myRank);
  }
  $('mini-board').replaceChildren(...rows.map((r) => {
    if (!r) return el('li', 'gap', '…');
    const me = r.id === player.id;
    const li = el('li', me ? 'me' : '');
    li.append(
      el('span', 'rank', r.rank === 1 ? '👑' : `#${r.rank}`),
      el('span', 'name', me ? `${r.nickname} (you)` : r.nickname),
    );
    return li;
  }));
}

// After Finish every ranked player is asked to come to the booth: if someone above
// them isn't there, the prize moves down the line and could reach them.
let buzzed = null; // the banner kind the phone last vibrated for
function renderFinal() {
  const prize = api.currentPrize(state);
  const isWinner = prize !== null && myRank?.rank === state.winner_rank;
  const won = state.winners.indexOf(player.id) + 1; // 1–3 if this player got a prize, else 0
  $('final').hidden = !state.finished || !myRank;
  if ($('final').hidden) {
    buzzed = null;
    return;
  }
  $('final').classList.toggle('winner', isWinner || won > 0);
  $('final').textContent = isWinner ? COPY.winner(prize)
    : won ? COPY.prizeReceived(won)
    : `${COPY.finishedRank(myRank.rank)} ${prize ? COPY.comeToBooth(calling?.nickname, prize) : COPY.prizesDone}`;

  const kind = isWinner ? 'invited' : 'finished';
  if (buzzed !== kind) navigator.vibrate?.([200, 100, 200]); // Android only; ignored elsewhere
  buzzed = kind;
}

// Phones listen to event_state (Finish / Skip / Prize given) and players (the mini
// leaderboard). minGapMs keeps 100+ phones from refetching on every single save.
const run = keepFresh(refresh, {
  tables: ['event_state', 'players'],
  minGapMs: 3_000,
  onConnection: connectionBanner(COPY.reconnecting),
});
