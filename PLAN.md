# Mind Club — Club Day Web App: Project Plan

**Event:** Tuesday 3 Nov 2026, 9AM–3PM, Sports Hall · Prize handout **3:45 PM**
**Theme:** *Grow Pet – Grow Mind* (Tamagotchi / virtual pet keychain)
**Spec:** `description/Web-mind-club.docx` · **Brand:** `img/RMC_logo.jpg`, `img/RMC-banner.png`
**Days left:** 5 (today is Thu 29 Oct)

---

## 1. What we're building

Three pages, each with its own link, sharing one live database:

| Page | File | Device | Language |
|---|---|---|---|
| Player | `index.html` | Player's phone (via QR code) | English |
| Leaderboard | `leaderboard.html` | iPad at the booth (landscape) | English |
| Admin | `admin.html` | Organiser's phone/laptop | Vietnamese |

### Player journey
```
Scan QR → [1] Welcome + nickname → Start
        → play Game 1, 2, 3 at the booth (host tells the number)
        → [2] Enter 3 numbers → summary "Is this correct?" → Yes (locked forever) / Edit
        → [3] Pet reveal (Baby / Teenager / Adult), no score or rank shown
        → (keep the page open) at Finish: "Congratulations, you're #1!" or "You finished #12."
```

### How the games map to the web inputs
| Web input | Booth activity | Number the host reads out | Range |
|---|---|---|---|
| Game 1 | A Little In Common | number of shared answers (3 rounds) | 0–3 |
| Game 2 | The Skillful Hand | marbles moved in 30s | 0+ |
| Game 3 | Ring The Right Thing | rings landed (9 rings) | 0–9 |

### Scoring (already done in the database, `supabase/schema.sql`)
- Game 1: 0→5, 1→10, 2→20, 3→30
- Game 2: n<7 → 5, n≥7 → 20 + 10×(n−7)
- Game 3: n<3 → 5, n≥3 → 20 + 10×(n−3)
- Pet: total <30 Baby · 30–59 Teenager · ≥60 Adult
- Tie: whoever confirmed first ranks higher

---

## 2. Tech stack

| Part | Choice | Why |
|---|---|---|
| Frontend | Plain HTML + CSS + JS modules, no build step | Fewest moving parts; anyone in the club can edit it |
| Database + realtime | Supabase (free tier) | Postgres + live updates + row security, nothing to host |
| Hosting | GitHub Pages (this repo) | Free, HTTPS, deploys on `git push` |
| Font | Fredoka (Google Fonts) | Rounded and bubbly like the logo lettering |

Free tier limits: 200 live connections and 500 MB storage, enough for 100+ players.

---

## 3. Visual design (from the logo and banner)

### Colour palette (sampled from the images)
| Role | Colour | Where it comes from |
|---|---|---|
| Background (primary) | `#68D0F8` sky blue | logo background |
| Pink accent / buttons | `#FE9DC0` | "RMIT MIND CLUB" pink letters |
| Blue accent | `#7CCCEF` | blue letters |
| Soft pink surface | `#FFE4EC` / `#F8C8D8` | banner Tamagotchi body + screen |
| Yellow highlight (#1, stars) | `#F8E878` / `#F8F0B8` | stars, brain quadrant |
| Coral | `#F58E89` | brain quadrant |
| Outline + text | `#111111` | thick sticker outlines |

### Style rules
- **Sticker look:** white cards with a thick black outline (3px) and a hard offset shadow (`4px 4px 0 #111`), rounded corners
- **Tamagotchi frame:** on the player page the content sits inside a pink egg-shaped "device" with a light-pink "screen", matching the banner
- **Decorations:** sparkles and stars (CSS/SVG) in the corners, used sparingly
- **Big touch targets:** buttons at least 48px high, number keypad on phones (`inputmode="numeric"`)
- **Accessibility:** black text on pastels (passes contrast); pink buttons get black text, not white

### Pet images
The banner already shows the 3 growth stages: **egg → small brain → brain with legs**.
- Baby Pet = egg, Teenager Pet = small brain, Adult Pet = brain with legs and antlers
- **Option A (fast):** crop them from `RMC-banner.png`
- **Option B (best):** ask the Media team for 3 transparent PNGs of the same characters

### Moments that make it fun
1. **Pet reveal:** an egg wobbles, cracks, and the pet pops out (CSS animation, ~1.5s)
2. **Leaderboard:** rows slide into place when ranks change; #1 is bigger, yellow, with a 👑
3. **Finish:** the player's phone switches to a full-screen congrats or "thanks" card (+ confetti for #1)

---

## 4. Work breakdown

### Phase 0 — Scaffold ✅ (done)
- 3 pages, shared JS modules, database schema with scoring, ranking view, realtime, basic CSS

### Phase 1 — Setup (≈1 hour) · Thu 29 – Fri 30 Oct
1. ✅ Create the Supabase project, run `supabase/schema.sql`
2. ✅ Put the URL + publishable key into `js/config.js`
3. Turn on GitHub Pages for this repo, check that all 3 links open
4. ✅ Smoke test against the real database: join, drafts, confirm, lock, tie order, Finish, Skip, Remove, realtime

### Phase 2 — Branding & UI (≈4 hours) · Fri 30 – Sat 31 Oct
1. Palette as CSS variables, Fredoka font, sticker card/button styles
2. Player page: Tamagotchi frame, logo on top, 3 screens styled, egg-hatch reveal
3. Leaderboard (iPad landscape): banner header, top 10, #1 highlight, animated reorder, "claim prize" banner after Finish
4. Admin page: clean and functional (no decoration), large buttons
5. ✅ Pet images in `img/pets/`

### Phase 3 — Robustness & admin tools (≈3 hours) · Sun 1 Nov
1. Admin protection (decision #2, pending team meeting)
2. ✅ "Remove player" button on admin to delete fake entries
3. Edge cases (list below)
4. "Reconnecting…" indicator if the phone loses Wi-Fi; refresh data when it reconnects
5. ✅ Reset script: `supabase/reset.sql`

### Phase 4 — Rehearsal (≈2 hours) · Mon 2 Nov
1. 5–10 club members on their own phones + the real iPad, run a full mock event including Finish → Skip → Prize given
2. Test on iPhone Safari + Android Chrome + iPad Safari
3. Test on venue-like conditions (mobile data, weak signal)
4. Print the QR code (A5 standee + small stickers on each game table)
5. Write a 1-page "host cheat sheet" (which number to read out per game)

### Event day — Tue 3 Nov
| Time | Action | Who |
|---|---|---|
| 8:30 | Run `supabase/reset.sql` in SQL Editor, open leaderboard on iPad (charger plugged in, auto-lock off) | Tech lead |
| 9:00–15:00 | Players scan QR, hosts read out numbers | Game admins |
| 15:00–15:45 | Remind players to keep the page open | Sales |
| 15:45 | Admin presses **Finish** → winner invited → **Đã trao quà** or **Bỏ qua** | Organiser |
| After | Export the players table (CSV) for the club's records | Tech lead |

---

## 5. Edge cases to handle

| Case | Behaviour |
|---|---|
| Player closes the tab and reopens | Same link / same browser → back to where they were |
| Player opens the QR in a different browser | Starts fresh (acceptable; tell hosts to say "use the same browser") |
| Player started but never submitted, then Finish happens | Show "Results are closed. Thanks for playing!" with no rank |
| Player tries to submit after Finish | Database rejects it, page shows "Results are closed" |
| Two players with the same nickname | Blocked with a pop-up; "Minh" and "minh " count as the same |
| Winner skipped, next player is #2 | #2's phone updates live, iPad shows the new name |
| Everyone skipped | Admin shows "No more players", iPad shows "No more players in line" |
| iPad refreshes | Full leaderboard reloads from the database |

---

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Players type fake scores** (Game 2 has no maximum, so typing 99 = 940 pts) | Wrong winner gets the prize | Admin sees every player's G1/G2/G3 and can remove fakes; host checks the winner before handing over the prize |
| Anyone opens `admin.html` | Event finished early or players deleted | Decision #2, pending team meeting |
| Sports Hall Wi-Fi/4G is weak | Pages slow, live updates lag | Pages are tiny; realtime reconnects; leaderboard also re-fetches every 30s as a backup |
| iPad sleeps / browser tab killed | Leaderboard disappears | Auto-lock off, charger, Guided Access mode |
| Winner's phone was closed before Finish | Winner doesn't see the message | Leaderboard shows the name at the booth + the reminder text says to come back at 3:45 |

---

## 7. Decisions

| # | Topic | Status |
|---|---|---|
| 1 | Fake-score protection | ✅ Admin "Remove player" button only, Game 2 stays unlimited |
| 2 | Admin page protection | ⏳ Waiting for team meeting (PIN / login / none) |
| 3 | Duplicate nicknames | ✅ Not allowed: pop-up "This username has been taken. Please choose another one." (case-insensitive) |
| 4 | Result screen layout | ✅ 3 tappable game cards (picture + "Game 1 · A Little In Common"), tap → pop-up with − / + number input; each game saves as a draft so progress survives closing the page |
| 5 | Pet images | ✅ Cut from the banner → `img/pets/`; swap in Media's PNGs if they arrive |

---

## 8. Definition of done

- [ ] 3 links live on GitHub Pages, QR code printed
- [ ] Player flow works on iPhone + Android, survives closing and reopening
- [ ] Leaderboard updates within 2s of a submit, no reload needed
- [ ] Finish → Skip → Prize given works end-to-end on real phones
- [ ] Looks like Mind Club: palette, logo, Tamagotchi frame, pet stages from the banner
- [ ] Test data wiped the morning of the event
