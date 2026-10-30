// Player page (index.html): welcome → enter 3 games → pet → final result after Finish.
import * as api from '../api.js';
import { keepFresh } from '../live.js';
import { $, el, showScreen, prizeSlots, busy, toast, connectionBanner } from '../ui.js';
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
let winnerNames = new Map(); // after Finish: id → nickname of each prize winner
let editing = false; // true after "Edit": the egg can't hatch until the next save
let current = null;  // the game open in the pop-up
let saves = 0;       // counts this phone's saves, so an older refresh can't undo one
let hatchNext = false; // set by "Yes": the pet hatches when it first appears

const MINI_TOP = 5;

async function refresh() {
  const savesBefore = saves;
  const [p, s] = await Promise.all([playerId ? api.getPlayer(playerId) : null, api.getState()]);
  const ranks = p?.confirmed_at ? await Promise.all([
    api.getMyRank(p.id),
    api.getLeaderboard(MINI_TOP),
    s.finished && api.currentPrize(s) ? api.getRankRow(s.winner_rank) : null,
    s.finished ? api.getNicknames(s.winners) : [],
  ]) : [null, [], null, []];
  // A save finished while this was loading, so the data may be from before it. Load again instead.
  if (saves !== savesBefore) {
    run();
    return;
  }
  if (playerId && !p) { // removed by the organiser, or the test data was wiped
    forgetPlayer();
    $('welcome-notice').textContent = COPY.entryRemoved;
    $('welcome-notice').hidden = false;
  }
  player = p;
  state = s;
  [myRank, top, calling] = ranks;
  winnerNames = new Map(ranks[3].map((r) => [r.id, r.nickname]));
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
      saves++;
      rememberPlayer(player.id);
      $('welcome-notice').hidden = true;
      render();
    } catch (err) {
      if (err.code === 'NICKNAME_TAKEN') {
        $('nickname').classList.add('bad');
        return $('taken').showModal();
      }
      handleError(err);
    }
  });
};

// After "OK" on the taken pop-up, the red box stays until the nickname is changed.
$('taken').onclose = () => $('nickname').focus();
$('nickname').oninput = () => $('nickname').classList.remove('bad');

// ---- Screen 2: Results ----
// Each game is saved as a draft the moment it's entered, so closing the page keeps progress.

const draft = () => ({ g1: player.g1, g2: player.g2, g3: player.g3 });

function renderCards() {
  const d = draft();
  const entered = GAMES.filter((g) => d[g.key] != null).length;
  const ready = entered === GAMES.length && !editing;

  // The egg gets one crack per game entered. With all 3 in, it's big and shakes fast.
  $('egg-svg').innerHTML = '<use href="#egg"/>' + ['crack1', 'crack2', 'crack3'].slice(0, entered)
    .map((id) => `<use href="#${id}"/>`).join('');
  $('egg-svg').classList.toggle('fast', ready);
  $('yes').disabled = !ready;
  $('yes').setAttribute('aria-label', ready ? 'Hatch your egg. Your numbers lock after this.' : `Your egg: ${entered} of 3 games entered`);
  $('egg-display').classList.toggle('compact', !ready);
  $('egg-title').textContent = ready ? 'Ready to hatch!' : `${player.nickname}'s egg`;
  $('egg-count').textContent = ready ? 'Tap the egg to hatch it! Your numbers lock after this.' : `${entered} of 3 games entered`;
  [...$('egg-pips').children].forEach((pip, i) => pip.classList.toggle('on', i < entered));

  // While the egg is ready to hatch, the games just show their numbers; "Edit" unlocks them.
  $('game-cards').replaceChildren(...GAMES.map((g, i) => gameCard(g, i, d[g.key], ready)));


  $('edit').hidden = !ready;
}

function gameCard(g, i, value, locked) {
  const done = value != null;
  const button = el(locked ? 'div' : 'button', 'game');
  if (!locked) button.type = 'button';
  button.innerHTML = `<img src="${g.img}" alt=""><span><small>Game ${i + 1}</small><strong>${g.name}</strong>`
    + (done ? '</span>' : '<em>Tap after you play</em></span>')
    + (done ? `<span class="lcd">${value}</span>`
      : '<span class="lcd empty"><svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg></span>');
  button.setAttribute('aria-label', `Game ${i + 1}, ${g.name}: ${done ? value : 'not entered yet'}.`
    + (locked ? '' : done ? ' Tap to change.' : ''));
  if (!locked) button.onclick = () => openGame(g, i);
  return button;
}

// Games with a maximum get one button per number (no typing, nothing out of range).
// Game 2 has no maximum, so it keeps − / + and typing. #gd-input holds the number either way.
function openGame(g, i) {
  current = g;
  $('gd-img').src = g.img;
  $('gd-num').textContent = `Game ${i + 1}`;
  $('gd-title').textContent = g.name;
  $('gd-question').textContent = g.question;
  $('gd-input').max = g.max ?? '';
  $('gd-input').value = player[g.key] ?? '';
  const pick = g.max != null;
  $('gd-picker').hidden = !pick;
  $('gd-stepper').hidden = pick;
  $('gd-tip').hidden = pick;
  if (pick) {
    $('gd-picker').style.setProperty('--cols', Math.min(g.max + 1, 5));
    $('gd-picker').replaceChildren(...Array.from({ length: g.max + 1 }, (_, n) => {
      const b = el('button', '', String(n));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.onclick = () => {
        $('gd-input').value = n;
        markPicked();
      };
      return b;
    }));
    markPicked();
  }
  $('gd-error').hidden = true;
  $('game-dialog').showModal();
}

function markPicked() {
  for (const b of $('gd-picker').children) {
    b.setAttribute('aria-checked', String(b.textContent === $('gd-input').value));
  }
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
      saves++;
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

// Tapping the ready egg saves and locks the entry forever, then it hatches.
$('yes').onclick = () => busy($('yes'), async () => {
  try {
    player = await api.confirmResults(player.id, draft());
    saves++;
    hatchNext = true;
    render();
    run(); // loads the mini leaderboard with this player in it
  } catch (err) {
    handleError(err);
  }
});

// ---- Screen 3: Pet + live rank (ranks only, no score or formula shown) ----

function renderPet() {
  const pet = petFor(player.total);
  $('pet-img').src = pet.img;
  $('pet-img').alt = pet.name;
  // "Teenager Mindchi": the first word(s) pink, "Mindchi" blue, like the logo's two colours
  const words = pet.name.split(' ');
  $('pet-name').replaceChildren(el('span', 'a', words.slice(0, -1).join(' ')), ' ', el('span', 'b', words.at(-1)));
  $('pet-text').textContent = pet.text;
  if (hatchNext) {
    hatchNext = false;
    hatch();
  }

  renderMiniBoard();
  renderFinal();
  showScreen('pet');
}

// The hatch is drawn by CSS (.hatching). This adds the light burst, sparkles and shell chips the
// first time, each flying out in its own direction, and buzzes Android phones along with the rumble.
function hatch() {
  const stage = $('hatch');
  if (!stage.querySelector('.burst')) {
    stage.prepend(el('i', 'burst'));
    const colours = ['var(--yellow)', 'var(--pink)', 'var(--blue)', '#fff'];
    for (let i = 0; i < 14; i++) {
      const spark = el('i', 'spark');
      spark.style.cssText = `--a:${i * 360 / 14}deg; --d:${90 + (i % 3) * 25}px; --c:${colours[i % 4]}; --s:${14 + (i % 3) * 6}px`;
      stage.append(spark);
    }
    for (let i = 0; i < 8; i++) {
      const chip = el('i', 'chip');
      chip.style.cssText = `--a:${i * 45 + 20}deg; --d:${60 + (i % 2) * 30}px; --r:${i * 70}deg`;
      stage.append(chip);
    }
  }
  $('pet-display').classList.add('hatching');
  navigator.vibrate?.([30, 50, 30, 50, 40, 40, 60, 30, 250]);
  setTimeout(() => $('pet-display').classList.remove('hatching'), 2600);
}

// Top 5 by rank only (no points, per the spec), plus this player's own row if lower.
function renderMiniBoard() {
  const rows = [...top];
  if (myRank && myRank.rank > MINI_TOP) {
    if (myRank.rank > MINI_TOP + 1) rows.push(null); // null = "…" gap
    rows.push(myRank);
  }
  $('mini-board').replaceChildren(...rows.map((r) => {
    if (!r) {
      const gap = el('li', 'gap', '…');
      gap.setAttribute('aria-hidden', 'true');
      return gap;
    }
    const me = r.id === player.id;
    const li = el('li', me ? 'me' : '');
    li.append(
      el('span', r.rank <= 3 ? `tok r${r.rank}` : 'tok', r.rank),
      el('span', 'name', me ? `${r.nickname} (you)` : r.nickname),
    );
    return li;
  }));
  $('my-rank').textContent = myRank ? `#${myRank.rank}` : '…';
  $('rank-label').textContent = state.finished ? 'Final rank' : 'Your rank';
  $('rank-live').hidden = state.finished;
}

// After Finish, a card sits above the device. The player being called gets a pulsing pink
// card; everyone else is asked to come to the booth too (a prize can move down the line to
// them) and sees the same 3 prize slots as the iPad.
let buzzed = null; // the card the phone last vibrated for
function renderFinal() {
  const prize = api.currentPrize(state);
  const isWinner = prize !== null && myRank?.rank === state.winner_rank;
  const won = state.winners.indexOf(player.id) + 1; // 1–3 if this player got a prize, else 0
  $('final').hidden = !state.finished || !myRank;
  if ($('final').hidden) {
    buzzed = null;
    return;
  }
  const pink = isWinner || won > 0;
  const msg = isWinner ? COPY.winner(myRank.rank) : won ? COPY.prizeReceived
    : { title: COPY.finishedRank(myRank.rank), text: prize ? COPY.comeToBooth : COPY.prizesDone };
  $('final-card').className = `callout ${pink ? 'pink' : 'yellow'}${isWinner ? ' pulse' : ''}`;
  $('final-icon').setAttribute('class', `ic ${pink ? 'f-yellow' : 'f-white'}`);
  $('final-icon').innerHTML = `<use href="#${pink ? 'i-trophy' : 'i-pin'}"/>`;
  $('final-title').textContent = msg.title;
  $('final-text').textContent = msg.text;
  $('prizes').hidden = pink;
  if (!pink) $('prizes').replaceChildren(...prizeSlots(state, prize, calling, winnerNames));

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
