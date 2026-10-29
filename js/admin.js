import { db, getLeaderboard, getState, subscribe } from './db.js';

const $ = (id) => document.getElementById(id);
const setState = (patch) => db.from('event_state').update(patch).eq('id', 1);

async function render() {
  const [state, all] = await Promise.all([getState(), getLeaderboard()]);
  const winner = all.find((r) => r.rank === state.winner_rank);

  $('status').textContent = state.finished
    ? `Đã chốt bảng xếp hạng (${all.length} người chơi).`
    : `Đang nhận kết quả — ${all.length} người đã xác nhận.`;
  $('finish').hidden = state.finished;
  $('prize').hidden = !state.finished;
  $('winner').textContent = state.prize_given ? `${winner?.nickname} (đã trao)`
    : winner ? `#${winner.rank} ${winner.nickname}` : 'Hết người chơi';
  $('given').disabled = $('skip').disabled = state.prize_given || !winner;

  $('players').innerHTML = '';
  for (const r of all) {
    const tr = document.createElement('tr');
    for (const v of [r.rank, r.nickname, r.g1, r.g2, r.g3, r.total]) {
      tr.insertCell().textContent = v; // nickname is user input: no innerHTML
    }
    const remove = document.createElement('button');
    remove.className = 'secondary';
    remove.textContent = 'Xóa';
    remove.onclick = () => removePlayer(r);
    tr.insertCell().append(remove);
    $('players').append(tr);
  }
}

// For fake or mistyped scores. Everyone below moves up one rank.
async function removePlayer(r) {
  if (!confirm(`Xóa người chơi "${r.nickname}" (${r.total} điểm)? Không thể hoàn tác.`)) return;
  const { error } = await db.from('players').delete().eq('id', r.id);
  if (error) alert(error.message);
}

$('finish').onclick = async () => {
  if (confirm('Chốt bảng xếp hạng? Sẽ không nhận thêm kết quả.')) await setState({ finished: true });
};
$('given').onclick = () => setState({ prize_given: true });
$('skip').onclick = async () => setState({ winner_rank: (await getState()).winner_rank + 1 });

subscribe(render);
render();
