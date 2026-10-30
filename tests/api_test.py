"""End-to-end test of the database rules, run against the real Supabase project.

    python tests/api_test.py

Uses only the Python standard library. Creates players named zz_test_*, presses
Finish/Skip, then deletes its players and restores the event state.
Refuses to run if real players exist, so it can't disturb a live event.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONFIG = (Path(__file__).parent.parent / 'js' / 'config.js').read_text(encoding='utf-8')
URL = re.search(r"SUPABASE_URL = '([^']+)'", CONFIG).group(1) + '/rest/v1'
KEY = re.search(r"SUPABASE_ANON_KEY = '([^']+)'", CONFIG).group(1)
PREFIX = 'zz_test_'


def call(method, path, body=None):
    """Returns (status, parsed JSON or None). Never raises on HTTP errors."""
    req = urllib.request.Request(URL + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'apikey': KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation'})
    try:
        with urllib.request.urlopen(req) as res:
            text = res.read().decode()
            return res.status, json.loads(text) if text else None
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read().decode() or 'null')


def join(name):
    status, rows = call('POST', '/players', {'nickname': PREFIX + name})
    assert status == 201, (status, rows)
    return rows[0]['id']


def patch(pid, body):
    return call('PATCH', f'/players?id=eq.{pid}', body)


def confirm(pid, g1, g2, g3):
    status, rows = patch(pid, {'g1': g1, 'g2': g2, 'g3': g3, 'confirmed_at': now()})
    assert status == 200 and rows, (status, rows)
    return rows[0]


def set_state(body):
    return call('PATCH', '/event_state?id=eq.1', body)[1]


def board():
    return [(r['rank'], r['nickname'].removeprefix(PREFIX), r['total'])
            for r in call('GET', '/leaderboard?select=rank,nickname,total&order=rank')[1]]


def now():
    return datetime.now(timezone.utc).isoformat()


def error_code(result):
    status, body = result
    return body.get('code') if isinstance(body, dict) else status


results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'  -> {detail}'))


def cleanup():
    call('DELETE', f'/players?nickname=like.{PREFIX}*')


def refuse_if_real_players():
    others = [p for p in call('GET', '/players?select=nickname')[1] if not p['nickname'].startswith(PREFIX)]
    if others:
        sys.exit(f'Refusing to run: {len(others)} real players in the database. Run supabase/reset.sql first.')


def get_state():
    return call('GET', '/event_state?id=eq.1')[1][0]


def restore_state(original):
    set_state({k: original[k] for k in ('finished', 'winner_rank', 'prize_given')})


def main():
    refuse_if_real_players()
    original = get_state()
    cleanup()
    set_state({'finished': False, 'winner_rank': 1, 'prize_given': False})
    try:
        run_checks()
    finally:
        cleanup()
        restore_state(original)
    print(f'\n{results.count(True)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)


def run_checks():
    # --- Joining ---
    a = join('A')
    check('join creates an empty entry', call('GET', f'/players?id=eq.{a}')[1][0]['total'] == 0)
    dup = call('POST', '/players', {'nickname': ' ZZ_TEST_a '})
    check('duplicate nickname is rejected (any upper/lower case)', error_code(dup) == '23505', dup)
    cheat = call('POST', '/players', {'nickname': PREFIX + 'cheat', 'g2': 99,
                                      'confirmed_at': now()})
    check('cannot join with scores or pre-confirmed', error_code(cheat) == '42501', cheat)

    # --- Drafts ---
    s, rows = patch(a, {'g1': 2})
    check('save one game as a draft', s == 200 and rows[0]['g1'] == 2, rows)
    check('Game 1 above 3 is rejected', error_code(patch(a, {'g1': 5})) == '23514')
    check('Game 3 above 9 is rejected', error_code(patch(a, {'g3': 10})) == '23514')
    check('negative number is rejected', error_code(patch(a, {'g2': -1})) == '23514')
    check('cannot confirm before all 3 games', error_code(patch(a, {'confirmed_at': now()})) == '23514')
    check('cannot change nickname', error_code(patch(a, {'nickname': PREFIX + 'renamed'})) == '42501')

    # --- Scoring (spec: Web-mind-club.docx) ---
    cases = [((0, 0, 0), 15), ((1, 6, 2), 20), ((2, 8, 4), 80), ((3, 7, 3), 70), ((3, 12, 9), 180)]
    for (g1, g2, g3), want in cases:
        pid = join(f'score_{g1}_{g2}_{g3}')
        got = confirm(pid, g1, g2, g3)['total']
        check(f'score {g1}/{g2}/{g3} = {want}', got == want, got)
    cleanup()
    a = join('A')

    # --- Confirming ---
    past = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    s, rows = patch(a, {'g1': 2, 'g2': 8, 'g3': 4, 'confirmed_at': past})
    stamped = datetime.fromisoformat(rows[0]['confirmed_at'])
    check('confirmation time comes from the database, not the phone',
          abs((datetime.now(timezone.utc) - stamped).total_seconds()) < 120, rows[0]['confirmed_at'])
    check('entry is locked after confirming', patch(a, {'g2': 99}) == (200, []))

    # --- Ranking ---
    b, c = join('B'), join('C')
    confirm(b, 3, 7, 3)   # 70
    confirm(c, 2, 8, 4)   # 80, ties with A but confirmed later
    check('higher total first; on a tie, earlier confirmation first',
          board() == [(1, 'A', 80), (2, 'C', 80), (3, 'B', 70)], board())
    d = join('D')

    # --- Finish ---
    set_state({'finished': True})
    check('after Finish: cannot join', error_code(call('POST', '/players', {'nickname': PREFIX + 'late'})) == '42501')
    check('after Finish: cannot save a game', patch(d, {'g1': 1}) == (200, []))

    # --- Prize handout ---
    first = call('PATCH', '/event_state?id=eq.1&winner_rank=eq.1', {'winner_rank': 2})[1]
    second = call('PATCH', '/event_state?id=eq.1&winner_rank=eq.1', {'winner_rank': 2})[1]
    check('Skip moves the prize to #2', first and first[0]['winner_rank'] == 2, first)
    check('two Skips at once only skip one player', second == [], second)
    s, _ = call('DELETE', f'/players?id=eq.{c}')
    check('Remove deletes a player and everyone below moves up',
          s == 200 and board() == [(1, 'A', 80), (2, 'B', 70)], board())
    rows = set_state({'prize_given': True})
    check('Prize given is saved', rows[0]['prize_given'] is True, rows)

    # --- Reopen ---
    set_state({'finished': False, 'winner_rank': 1, 'prize_given': False})
    s, rows = patch(d, {'g1': 1})
    check('after Reopen: saving works again', s == 200 and rows and rows[0]['g1'] == 1, rows)


if __name__ == '__main__':
    main()
