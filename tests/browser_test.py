"""Plays a whole event in a real (headless) browser against the real database:
player flow, live leaderboard, Finish, Skip, 3 prizes given, Remove, Reopen.

    python -m http.server 8000          # in one terminal, from the project folder
    python tests/browser_test.py        # in another

Needs: python -m pip install websockets, and Microsoft Edge (or set BROWSER to Chrome's path).
Creates zz_test_* players and cleans them up. Refuses to run if real players exist.
Screenshots of every screen go to tests/shots/.
"""
import asyncio, sys, pathlib
from cdp import Browser, Tab
import api_test as t

L = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'
SHOTS = pathlib.Path(__file__).parent / 'shots'
SHOTS.mkdir(exist_ok=True)
SCREEN = "[...document.querySelectorAll('.screen')].find(s => !s.hidden)?.id"
results = []


def g(i):
    return f"document.getElementById('{i}')"


def report(name, ok, detail=''):
    results.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'  -> {detail}'), flush=True)


async def enter(p, idx, value):
    await p.js(f"document.querySelectorAll('.game-card')[{idx}].click()")
    await p.wait_for(f"{g('game-dialog')}.open")
    await p.js(f"{g('gd-input')}.value = '{value}'; {g('gd-save')}.click()")
    return await p.wait_for(f"!{g('game-dialog')}.open")


def errors(tab):
    # AssistantLoadState comes from a script Edge itself injects into pages, not from this app.
    return [l for l in tab.logs if (l.startswith('error') or l.startswith('EXCEPTION'))
            and 'AssistantLoadState' not in l]


def seed():
    """5 confirmed demo players and 1 who has only entered Game 1."""
    ids = {}
    for name, g in [('Minh', (3, 10, 6)), ('Linh', (2, 8, 4)), ('An', (1, 7, 3)), ('Bao', (0, 2, 1)), ('Chi', (2, 9, 5))]:
        ids[name] = t.join(name)
        t.confirm(ids[name], *g)
    ids['Draft'] = t.join('Draft')
    t.patch(ids['Draft'], {'g1': 2})
    return ids


def main():
    t.refuse_if_real_players()
    original = t.get_state()
    t.cleanup()
    t.set_state({'finished': False, 'winner_rank': 1, 'winners': []})
    try:
        asyncio.run(run(seed()))
    finally:
        t.cleanup()
        t.restore_state(original)
    print(f'\n{results.count(True)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)


async def run(ids):
    with Browser():
        # ---------- Player flow ----------
        p = await Tab.open()
        await p.go(L + '/')
        report('fresh visitor sees welcome', await p.wait_for(f"{SCREEN} === 'welcome'"))
        await p.shot(SHOTS / 'p1-welcome.png')

        await p.js(f"{g('nickname')}.value = '  ZZ_TEST_minh '; {g('start')}.click()")
        report('taken nickname (any case/spaces) shows pop-up', await p.wait_for(f"{g('taken')}.open"))
        await p.shot(SHOTS / 'p2-taken.png')
        await p.js(f"{g('taken')}.close()")

        await p.js(f"{g('nickname')}.value = 'zz_test_New'; {g('start')}.click()")
        report('Start -> results screen', await p.wait_for(f"{SCREEN} === 'results'"))
        report('URL becomes the personal link', await p.js("location.search.startsWith('?id=')"))

        await p.js("document.querySelectorAll('.game-card')[1].click()")
        await p.wait_for(f"{g('game-dialog')}.open")
        await p.js(f"{g('gd-input')}.value = '-3'; {g('gd-save')}.click()")
        report('invalid number shows an error', await p.wait_for(f"!{g('gd-error')}.hidden"))
        await p.js(f"{g('gd-input')}.value = ''; for (let i = 0; i < 8; i++) {g('gd-plus')}.click()")
        await p.shot(SHOTS / 'p3-dialog.png')
        await p.js(f"{g('gd-save')}.click()")
        report('+ button x8 then Save -> card shows check and 8',
               await p.wait_for("document.querySelectorAll('.game-status')[1].textContent === '✓ 8'"))
        report('summary hidden until all 3 games', await p.js(f"{g('confirm')}.hidden"))
        await enter(p, 0, 2)
        await enter(p, 2, 4)
        report('summary appears after all 3', await p.wait_for(f"!{g('confirm')}.hidden"))
        summary = await p.js(f"{g('summary')}.textContent")
        report('summary text matches the spec', summary == 'Game 1: 2 · Game 2: 8 · Game 3: 4 — Is this correct?', summary)
        await p.shot(SHOTS / 'p4-summary.png')

        await p.js(f"{g('edit')}.click()")
        report('Edit hides the summary', await p.wait_for(f"{g('confirm')}.hidden"))
        await enter(p, 2, 4)
        report('saving again brings the summary back', await p.wait_for(f"!{g('confirm')}.hidden"))

        await p.go(await p.js('location.href'))
        report('reloading keeps the saved games', await p.wait_for(f"!{g('confirm')}.hidden"))
        await p.go(L + '/')
        report('reopening the plain QR link restores progress', await p.wait_for(f"{SCREEN} === 'results'"))

        await p.js(f"{g('yes')}.click()")
        report('Yes -> pet screen', await p.wait_for(f"{SCREEN} === 'pet'"))
        pet = await p.js(f"{g('pet-name')}.textContent")
        report('80 points -> Adult Pet', pet == 'Adult Pet', pet)
        report('mini leaderboard shows the player, highlighted',
               await p.wait_for("document.querySelector('#mini-board li.me')?.textContent.includes('(you)')"))
        report('pet screen shows no score', '80' not in await p.js("document.getElementById('pet').innerText"))
        await p.shot(SHOTS / 'p5-pet.png')

        # ---------- Leaderboard: live update ----------
        b = await Tab.open(1024, 768, mobile=False)
        await b.go(L + '/leaderboard.html')
        await b.wait_for("document.querySelectorAll('#board li').length > 0")
        report('leaderboard shows confirmed players only (not the draft player)',
               'Draft' not in await b.js("document.getElementById('board').innerText"))
        live = t.join('Live')
        t.confirm(live, 3, 12, 9)  # 180 -> new #1
        secs = await b.wait_for("document.querySelector('#board li .name')?.textContent === 'zz_test_Live'", 14)
        report(f'leaderboard updates live without reload ({secs}s; polling alone would take up to 15s)',
               secs is not None and secs < 5, secs)
        secs = await p.wait_for("document.querySelector('#mini-board li .name')?.textContent === 'zz_test_Live'", 10)
        report(f'player mini leaderboard updates live ({secs}s)', secs is not None and secs < 6, secs)
        report('#1 row is highlighted with a crown',
               await b.js("document.querySelector('#board li').className === 'first' && document.querySelector('#board li .rank').textContent === '👑'"))
        await b.shot(SHOTS / 'b1-board.png')

        # ---------- Admin ----------
        a = await Tab.open(820, 1000, mobile=False)
        await a.go(L + '/admin.html')
        await a.wait_for("document.querySelectorAll('#players tr').length > 0")
        await a.js('window.confirm = () => true')  # auto-accept the confirm boxes
        await a.shot(SHOTS / 'a1-admin-open.png')

        # Phones waiting when Finish is pressed
        w = await Tab.open()
        await w.go(f'{L}/?id={live}')
        await w.wait_for(f"{SCREEN} === 'pet'")
        d = await Tab.open()
        await d.go(f"{L}/?id={ids['Draft']}")
        await d.wait_for(f"{SCREEN} === 'results'")

        await a.js(f"{g('finish')}.click()")
        secs = await w.wait_for(f"!{g('final')}.hidden", 10)
        report(f'Finish reaches the winner phone live ({secs}s)', secs is not None and secs < 5, secs)
        text = await w.js(f"{g('final')}.textContent")
        report('winner sees the spec message', text == "Congratulations! You're #1! 🏆 Come back to the Mind Club booth to claim your prize.", text)
        await w.shot(SHOTS / 'p6-winner.png')
        await p.wait_for(f"!{g('final')}.hidden", 10)
        text = await p.js(f"{g('final')}.textContent")
        report('other players see their rank', text.startswith('Thanks for playing! You finished #'), text)
        report('other players are asked to come to the booth', 'Come to the Mind Club booth now' in text, text)
        report('unconfirmed player sees "results closed"', await d.wait_for(f"{SCREEN} === 'closed'", 10))
        await d.shot(SHOTS / 'p7-closed.png')
        report('leaderboard shows who to invite', await b.wait_for(f"{g('claim')}.textContent.includes('zz_test_Live')", 10))
        await b.shot(SHOTS / 'b2-claim.png')

        n = await Tab.open()
        await n.go(L + '/')
        await n.js("localStorage.clear()")
        await n.go(L + '/')
        report('new visitor after Finish sees "game has ended"', await n.wait_for(f"{SCREEN} === 'closed'"))

        # Skip -> #2 is invited on the iPad and on their phone
        second = (await a.js("document.querySelectorAll('#players tr')[1].children[1].textContent"))
        await a.js(f"{g('skip')}.click()")
        report(f'Skip moves the invitation to #2 ({second}) on the iPad',
               await b.wait_for(f"{g('claim')}.textContent.includes('{second}')", 10))
        text = await w.wait_for(f"{g('final')}.textContent.startsWith('Thanks for playing! You finished #1')", 10)
        report('skipped player now sees "You finished #1"', text)
        report('the newly invited player (#2) sees the winner message',
               await p.wait_for(f"{g('final')}.textContent.startsWith('Congratulations')", 10) if second == 'zz_test_New' else True)

        # 1st prize to #2 (since #1 was skipped), then the 2nd prize moves on to #3
        await a.wait_for(f"!{g('given')}.disabled")
        await a.js(f"{g('given')}.click()")
        third = await a.js("document.querySelectorAll('#players tr')[2].children[1].textContent")
        report(f'Prize given -> #3 ({third}) invited for the 2nd prize on the iPad',
               await b.wait_for(f"{g('claim')}.textContent.includes('{third}') && "
                                f"{g('claim')}.textContent.includes('2nd prize')", 10))
        for n in (2, 3):  # 2nd and 3rd prize; wait until admin lists each one, like an organiser would
            await a.wait_for(f"!{g('given')}.disabled && document.querySelectorAll('#winners li').length === {n - 1}")
            await a.js(f"{g('given')}.click()")
            report(f'Prize given -> admin lists {n} winners',
                   await a.wait_for(f"document.querySelectorAll('#winners li').length === {n}"),
                   (t.get_state(), await a.js(f"{g('prize')}.innerText")))
        report('3 prizes given -> iPad thanks everyone', await b.wait_for(f"{g('claim')}.textContent.includes('awarded')", 10),
               (t.get_state(), await a.js(f"{g('prize')}.innerText")))
        report('3 prizes given -> buttons disabled', await a.wait_for(f"{g('given')}.disabled && {g('skip')}.disabled"))
        report('admin lists the 3 winners in order', await a.wait_for(
            "[...document.querySelectorAll('#winners li')].map(li => li.textContent.slice(0, 3)).join() === '1st,2nd,3rd'"))
        await a.shot(SHOTS / 'a2-admin-finished.png')

        before = await a.js("document.querySelectorAll('#players tr').length")
        await a.js("document.querySelector('#players tr:last-child button').click()")
        report('Remove deletes a row', await a.wait_for(f"document.querySelectorAll('#players tr').length === {before - 1}"))

        await a.js(f"{g('reopen')}.click()")
        report('Reopen -> unconfirmed player can enter again', await d.wait_for(f"{SCREEN} === 'results'", 10))
        report('Reopen -> winner message disappears', await w.wait_for(f"{g('final')}.hidden", 10))

        for name, tab in [('player', p), ('leaderboard', b), ('admin', a), ('winner phone', w), ('draft phone', d)]:
            report(f'no JS errors on {name}', not errors(tab), errors(tab))


if __name__ == '__main__':
    main()
