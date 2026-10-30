# Mind Club — Club Day web app

Booth game companion for RMIT Mind Club's Club Day (3 Nov 2026). Players enter their 3 game
results on their phone, discover their virtual pet, and compete for a prize on a live leaderboard.

Plain HTML/CSS/JS (no build step) + Supabase (database + realtime). All on-screen text is English.
Project plan and decisions: `PLAN.md`.

**Live site (Vercel, updates on every push to `main`):**
- Player (QR code target): https://mindchi.vercel.app
- Leaderboard (iPad): https://mindchi.vercel.app/leaderboard.html
- Admin: https://mindchi.vercel.app/admin.html

`.vercelignore` keeps tests, database scripts, wireframes and dev tools off the public site.

| Page | File | Used on |
|---|---|---|
| Player | `index.html` (QR code target) | Players' phones |
| Leaderboard | `leaderboard.html` | iPad at the booth |
| Admin | `admin.html` | Organiser |

## Run it locally
```
python serve.py        # like http.server, but browsers never cache (or double-click start.bat)
```
Open http://localhost:8000, http://localhost:8000/leaderboard.html, http://localhost:8000/admin.html.
(Opening the HTML files directly doesn't work: browsers block JS modules from `file://`.)

## Database setup (new Supabase project)
1. Supabase → SQL Editor: run each file in `supabase/migrations/` **in order** (001, 002, …).
2. Put the Project URL and publishable key in `js/config.js`.

Changing the database later = add a new numbered file in `supabase/migrations/`, never edit an old one
(the old ones have already been run on the live project).

## Tests
Both run against the real database, create `zz_test_*` players, clean up after themselves,
and refuse to run if real players exist.

| Test | What it checks | Run |
|---|---|---|
| `tests/api_test.py` | Database rules: scoring, locking, ties, Finish, Skip, Remove, anti-cheat | `python tests/api_test.py` |
| `tests/browser_test.py` | The whole event in a headless browser, incl. live updates; saves screenshots to `tests/shots/` | start the local server, then `python tests/browser_test.py` |

The browser test needs `python -m pip install websockets` and Microsoft Edge (or set `BROWSER` to Chrome's path).

## Structure
```
index.html, leaderboard.html, admin.html   page markup (fixed text lives here)
css/style.css                              brand colours (CSS variables) and all styles
js/config.js        Supabase URL + publishable key
js/api.js           every database call; turns errors into NICKNAME_TAKEN / CLOSED / INVALID / FAILED
js/live.js          keepFresh(): realtime + polling + wake-up refresh, never overlapping
js/ui.js            DOM helpers: screens, busy buttons, toast, connection banner
js/copy.js          text the scripts show (spec sentences marked)
js/games.js         the 3 games: names, pictures, questions, limits
js/pets.js          total → pet image + text
js/pages/*.js       one script per page: load data → render
supabase/migrations/  database schema, in run order
supabase/reset.sql    wipes players + reopens the event (event morning)
tests/                api_test.py, browser_test.py, cdp.py (browser driver)
img/                  logo, banner; pets/ cut from the banner; games/ icons
```

### How a page works
Each page has one `refresh()` that loads everything it shows and one `render()` that picks what to
display from that data. `keepFresh(refresh, …)` calls it on start, on realtime events, after
reconnecting, when the phone wakes up, and on a timer. Button handlers call the API, then render.
Scoring and ranking are computed in the database (`players.total`, `leaderboard` view) so all pages agree.

## Event day
1. 8:30: run `supabase/reset.sql` in the SQL Editor.
2. Open `leaderboard.html` on the iPad (charger on, auto-lock off).
3. 3:45 PM: on `admin.html` press **Finish**, then hand out the prize (one prize, for #1):
   **Prize given** if the invited player is there, **Not here: skip** if not (the next player in line is invited).
