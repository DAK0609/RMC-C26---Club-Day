# Mind Club — Club Day web app

Spec: `Web-mind-club.docx`. Static HTML/JS + Supabase (database + realtime). No build step.

| Page | URL | Who |
|---|---|---|
| Player | `index.html` (QR code target) | Players' phones |
| Leaderboard | `leaderboard.html` | iPad at the booth |
| Admin | `admin.html` | Organiser |

## Setup
1. Create a free project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql`.
3. Copy Project URL + anon key into `js/config.js`.
4. Run locally: `npx serve .` (or deploy the folder to GitHub Pages / Netlify).

## Structure
```
index.html, leaderboard.html, admin.html
css/style.css
js/config.js       Supabase keys
js/db.js           client, queries, realtime subscription
js/pets.js         total → pet + text
js/games.js        the 3 games: names, pictures, questions, limits
js/player.js, js/leaderboard.js, js/admin.js
supabase/schema.sql  tables, scoring (generated column), ranking view, RLS
img/               logo, banner
img/pets/          baby/teen/adult pets, cut from the banner
img/games/         game icons (swap for real photos with the same names)
```
