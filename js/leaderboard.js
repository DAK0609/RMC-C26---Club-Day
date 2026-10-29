import { getLeaderboard, getState, subscribe } from './db.js';

const board = document.getElementById('board');
const claim = document.getElementById('claim');

async function render() {
  const [top, state] = await Promise.all([getLeaderboard(10), getState()]);
  board.innerHTML = '';
  for (const r of top) {
    const li = document.createElement('li');
    if (r.rank === 1) li.className = 'first';
    li.innerHTML = `<span class="rank">${r.rank === 1 ? '👑' : '#' + r.rank}</span>
                    <span class="name"></span><span class="total">${r.total}</span>`;
    li.querySelector('.name').textContent = r.nickname; // nickname is user input: no innerHTML
    board.append(li);
  }

  claim.hidden = !state.finished;
  if (state.finished) {
    const winner = (await getLeaderboard()).find((r) => r.rank === state.winner_rank);
    claim.textContent = state.prize_given ? '🎉 Prize awarded — thanks everyone!'
      : winner ? `🏆 ${winner.nickname}, please come to the Mind Club booth to claim your prize!`
      : 'No more players in line.';
  }
}

subscribe(render);
render();
