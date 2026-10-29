import { db, getLeaderboard, getState, subscribe } from './db.js';
import { petFor } from './pets.js';
import { GAMES } from './games.js';

const $ = (id) => document.getElementById(id);
const show = (id) => document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id));

// Each player's personal link is index.html?id=<uuid>; localStorage is the fallback.
let playerId = new URLSearchParams(location.search).get('id') || localStorage.getItem('playerId');

async function load() {
  if (!playerId) return show('welcome');
  const { data: p } = await db.from('players').select('*').eq('id', playerId).single();
  if (!p) { localStorage.removeItem('playerId'); playerId = null; return show('welcome'); }
  if (p.confirmed_at) return showPet(p);
  draft = { g1: p.g1, g2: p.g2, g3: p.g3 };
  showResults();
}

$('welcome-form').onsubmit = async (e) => {
  e.preventDefault();
  const { data, error } = await db.from('players')
    .insert({ nickname: $('nickname').value.trim() }).select().single();
  if (error?.code === '23505') return $('taken').showModal(); // unique nickname violated
  if (error) return alert(error.message);
  playerId = data.id;
  localStorage.setItem('playerId', playerId);
  history.replaceState(null, '', `?id=${playerId}`);
  showResults();
};

// Each game is saved as a draft as soon as it's entered, so closing the page keeps progress.
let draft = { g1: null, g2: null, g3: null };
let editing = false; // true after "Edit": hide the summary until the next save
let current;         // the game open in the pop-up

function showResults() {
  renderCards();
  show('results');
}

function renderCards() {
  $('game-cards').innerHTML = '';
  GAMES.forEach((g, i) => {
    const done = draft[g.key] != null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card' + (done ? ' done' : '');
    card.innerHTML = `<img class="game-img" src="${g.img}" alt="">
      <span class="game-label"><small>Game ${i + 1}</small>${g.name}</span>
      <span class="game-status">${done ? '✓ ' + draft[g.key] : 'Tap to enter'}</span>`;
    card.onclick = () => openGame(g, i);
    $('game-cards').append(card);
  });

  const allDone = GAMES.every((g) => draft[g.key] != null);
  $('summary').textContent =
    `Game 1: ${draft.g1} · Game 2: ${draft.g2} · Game 3: ${draft.g3} — Is this correct?`;
  $('confirm').hidden = !allDone || editing;
}

function openGame(g, i) {
  current = g;
  $('gd-img').src = g.img;
  $('gd-title').textContent = `Game ${i + 1} · ${g.name}`;
  $('gd-question').textContent = g.question;
  $('gd-input').max = g.max ?? '';
  $('gd-input').value = draft[g.key] ?? '';
  $('gd-error').hidden = true;
  $('game-dialog').showModal();
}

const inputValue = () => Number($('gd-input').value) || 0;
$('gd-minus').onclick = () => { $('gd-input').value = Math.max(0, inputValue() - 1); };
$('gd-plus').onclick = () => { $('gd-input').value = Math.min(current.max ?? Infinity, inputValue() + 1); };
$('gd-cancel').onclick = () => $('game-dialog').close();

function showError(text) {
  $('gd-error').textContent = text;
  $('gd-error').hidden = false;
}

$('game-form').onsubmit = async (e) => {
  e.preventDefault();
  const raw = $('gd-input').value.trim();
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || (current.max != null && n > current.max)) {
    return showError(current.max != null
      ? `Please enter a whole number from 0 to ${current.max}.`
      : 'Please enter a whole number (0 or more).');
  }
  const { data, error } = await db.from('players')
    .update({ [current.key]: n }).eq('id', playerId).select().single();
  if (error || !data) return showError("Couldn't save. Results may be closed. Please ask a game host.");
  draft[current.key] = n;
  editing = false;
  $('game-dialog').close();
  renderCards();
};

$('edit').onclick = () => { editing = true; renderCards(); };

$('yes').onclick = async () => {
  const { data, error } = await db.from('players')
    .update({ ...draft, confirmed_at: new Date().toISOString() })
    .eq('id', playerId).select().single();
  if (error || !data) return alert('Results are closed or already submitted.');
  showPet(data);
};

function showPet(p) {
  const pet = petFor(p.total);
  $('pet-img').src = pet.img;
  $('pet-img').alt = pet.name;
  $('pet-name').textContent = pet.name;
  $('pet-text').textContent = pet.text;
  show('pet');
  updateFinal();
}

// After the host taps Finish, show either the prize message or the final rank.
async function updateFinal() {
  if (!playerId) return;
  const state = await getState();
  if (!state.finished) return;
  const me = (await getLeaderboard()).find((r) => r.id === playerId);
  if (!me) return;
  $('final').textContent = me.rank === state.winner_rank
    ? "Congratulations! You're #1! 🏆 Come back to the Mind Club booth to claim your prize."
    : `Thanks for playing! You finished #${me.rank}.`;
  $('final').hidden = false;
}

subscribe(updateFinal);
load();
