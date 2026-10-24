# QuestAday

A cozy RPG quest journal for real life: to-dos, recurring chores, XP, levels, achievements and a reward shop.
Local-first, works offline, no account, no server, no tracking.

> **Your data stays on the device.** Each browser/device keeps its own separate copy in IndexedDB.
> Nothing syncs between your phone and computer yet. Use **Settings → Export / Import backup** to move data.

- [Set up on your Linux computer](#set-up-on-your-linux-computer)
- [Set up on your Android phone](#set-up-on-your-android-phone)
- [Everyday use, backups and updates](#everyday-use-backups-and-updates)
- [Development](#development)
- [How it works](#how-it-works)
- [What was verified, and what was not](#what-was-verified-and-what-was-not)
- [Next steps](#next-steps)

Security details are in [SECURITY.md](SECURITY.md).

---

## Set up on your Linux computer

*(Optional. If you only want it on your phone, skip to the next section.)*

You need **Node.js 20 or newer** (`node --version`). Nothing else: the download includes a ready-built
`dist/` folder, and the server script has no dependencies, so you do **not** need `npm install` just to run it.

```bash
cd questday
node scripts/serve.mjs
```

Open **http://localhost:4173**. The server listens on `127.0.0.1` only, so no other device can reach it.

**Install it as an app (Chromium, Chrome, Brave, Edge):** click the install icon at the right end of the
address bar, or open **Settings → Install app** inside QuestAday. It then gets its own window and launcher entry.

**Firefox:** desktop Firefox does not install web apps. QuestAday works fully in a normal tab, including offline;
pin or bookmark the tab.

**After the first visit the server is optional.** The app is cached by its service worker, so
`http://localhost:4173` (or the installed app) opens even when the server is not running. You only need the
server again to pick up a new version.

Always use the same address (`http://localhost:4173`). Browsers store data per address and port, so
`127.0.0.1:4173` or a different port would look like a brand-new, empty app.

No Node? Any static file server pointed at `dist/` works, for example
`python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` (without the extra security headers).

## Set up on your Android phone

Android only installs a web app, and lets it work offline, from an `https://` address (or `localhost`).
So the app's files have to sit at an https address once, for the install. After that the phone never needs it again.

### Option A — phone only, no computer, no cable (recommended)

You put the ten app files on a free GitHub Pages site using nothing but the phone's browser.
Use `questday-phone.zip`: it contains just those ten files, with no folders.

1. Download `questday-phone.zip` to the phone. In the **Files** app, tap it and choose **Extract**.
2. In Chrome, open **github.com** and sign in (or create a free account).
3. Tap **+ → New repository**. Name it `questday`, keep it **Public**, tap **Create repository**.
4. On the new repository page tap **uploading an existing file**, then **choose your files**.
   Open the extracted folder, select **all ten files**, and tap **Commit changes**.
5. Open the repository's **Settings → Pages**. Under **Build and deployment** pick **Deploy from a branch**,
   branch **main**, folder **/ (root)**, and **Save**.
6. Wait a minute or two, then open **https://YOUR-USERNAME.github.io/questday/** in Chrome.
7. Tap **⋮ → Add to Home screen → Install**.
8. Open QuestAday from the home screen once. From then on it works offline.

If a GitHub screen is hard to use on the phone, turn on **⋮ → Desktop site** for that page.

What this does and does not expose:

- **Your quests are never uploaded.** They are created and kept inside Chrome on your phone. Only the app's
  program files are on GitHub, and they contain nothing personal.
- The program files are public, and GitHub sees an ordinary download (IP address, time) when the phone fetches them.
- **Protect that GitHub account** with a strong password and two-factor sign-in. Whoever controls the
  repository controls the code your phone runs the next time the app updates.
- All sites under `YOUR-USERNAME.github.io` share one storage area in the browser. **Do not host other
  people's or untrusted pages on the same GitHub account**, because they could read QuestAday's data.
  An account used only for this is the simplest way to be sure.

To update later: upload the new files to the same repository, open the app, and tap **Update now**.

### Option B — phone only, nothing hosted anywhere (Termux)

Fully on-device, for the more technical route. Install **Termux** from F-Droid, then:

```bash
pkg install python
termux-setup-storage                     # allow access to Downloads
cd ~/storage/downloads/questday-phone    # the extracted folder
python -m http.server 4173 --bind 127.0.0.1
```

Open **http://localhost:4173** in Chrome and install it (**⋮ → Add to Home screen → Install**). Once installed
you can close Termux; the app no longer needs it. Always use port 4173, since data is stored per address and port.

### Option C — USB cable from your computer

Private, but fiddly. On the computer: install `adb`, enable **USB debugging** on the phone (Settings → About
phone → tap Build number seven times → Developer options), connect the cable, then:

```bash
node scripts/serve.mjs
adb reverse tcp:4173 tcp:4173
```

Open **http://localhost:4173** in the phone's Chrome and install. Unplug, and turn USB debugging off again.

### Android notes

- I could not test any of these on a physical phone. Installation and offline use were tested in desktop
  Chromium with a phone-sized touch screen, including from a plain host with no security headers in a
  sub-folder, which is the same situation as GitHub Pages.
- Use Chrome for installing.
- The app asks for no permissions. Notifications and reminders are not implemented.
- **Uninstalling the app or clearing Chrome's site data deletes your quests.** Export a backup first
  (Settings → Export backup).
- Your keyboard app sees what you type in any app, including this one. That is outside QuestAday's control.

## The museum (coins)

Coins buy exhibits for your museum: 30 hand-drawn pieces in five wings (minerals, fossils, antiquities, space,
curiosities). Rarer pieces open up as you own more of a wing (rare at 2, epic at 4, legendary at 5). One piece a day
is a quarter off. Finishing a wing gives your town 60 gems. Purchases are confirmed first and are final. Your own
real-life treats are still at the bottom of the Museum tab.

## The town (gems, buildings, residents)

Every quest and chore pays **coins** (for your real-life reward shop) and **gems** (for the town). Spend gems on
buildings, more land and seasonal decorations. The challenge is in the choices, never in penalties:

- Land is limited (4×4 to 9×9) and each expansion costs more.
- Residents need food, fun and calm. A balanced town earns up to 50% more gems; an unbalanced one just earns the base rate.
- Residents (10 talking animals and townsfolk) only move in when there is a free home and the town can keep them content.
- Your buildings pay a little income each day (up to 3 days stack while you are away; nothing is ever lost or owed).
- Seasonal decorations can only be bought in their season. A weekly event pays a gem bonus when its goal is met.
- Selling returns 50%. Undo on the "Built" toast refunds in full.

Existing data gains gems automatically, derived from past XP. Everything stays local, like the rest of the app.

## Everyday use, backups and updates

- **Add:** the **New quest** button (or press **N** on a keyboard). Only a title is required; Enter saves.
- **Complete:** tap the circle. XP and coins appear at once, with an **Undo** button for a few seconds.
- **Chores** come back on their schedule. Missed days never pile up and never cost anything; **Skip** moves
  a chore to its next date.
- **Rewards:** spend coins in the shop. Spending never lowers your level.
- **Back up:** Settings → **Export backup** downloads `questday-backup-YYYY-MM-DD.json`. It is plain,
  unencrypted text: keep it somewhere private.
- **Move between devices:** export on one, copy the file across yourself, then Settings → **Import backup**
  on the other and choose **Merge** or **Replace**. Importing the same file twice does not double anything.
- **Example data:** Settings → Load / Remove example data.

## Builds: yours, the web's and Google Play's

- `npm run build:personal` → `dist-personal/`: **your own copy** for GitHub Pages, with **Admin tools** in Settings
  (add/remove XP, coins, gems; toggle Premium; time travel; reset and seed). Works fine without ever touching them.
- `npm run build` → `dist/`: the public web version. Admin tools are removed from the code entirely.
- `node scripts/build.mjs --android` → `dist-android/`: the Google Play app's files, with Premium purchases
  through RevenueCat. Setup: `docs/BILLING.md`.

## Backend (optional, not yet connected)
`supabase/` holds the database (profiles, synced records, Premium entitlements) with Row Level Security, the
purchase-verification and account-deletion functions, and tests. See `supabase/README.md`.

## Planning docs
`docs/PROJECT_PLAN.md` (features, screens, schema, stack, milestones), `docs/DESIGN.md` (themes, type, motion),
`CLAUDE.md` (rules for future AI-assisted work).

## Development

```bash
npm install          # first run creates package-lock.json — commit it, then use `npm ci`
npm run dev          # http://localhost:5173, rebuilds on reload, localhost only
npm test             # unit and integration tests (Node's built-in test runner)
npm run typecheck    # TypeScript
npm run build        # production build into dist/
npm run check:bundle # scan dist/ for secrets, source maps, remote URLs, eval, network calls
npm start            # serve dist/ at http://localhost:4173
npm run e2e          # real-browser tests against dist/ (see below)
npm audit            # check dependencies for known vulnerabilities
npm run verify       # typecheck + test + build + check:bundle
```

`npm run e2e` needs a Chromium for `playwright-core`: run `npx playwright-core install chromium` once, or set
`CHROMIUM_PATH=/usr/bin/chromium`.

To rename the app, edit `app.config.json` and rebuild. The database name is intentionally fixed so a rename
never orphans your data.

## How it works

**Stack.** React 19, TypeScript, esbuild, hand-written CSS, IndexedDB, zod. Three runtime dependencies
(`react`, `react-dom`, `zod`).

**Deviations from the brief's preferred stack**, all forced by the build sandbox having no access to the npm
registry (only a fixed set of preinstalled packages was available), and all leaving fewer dependencies:

| Preferred | Used instead | Why it is fine |
| --- | --- | --- |
| Vite | esbuild + three small scripts in `scripts/` | Same output: hashed JS/CSS, generated HTML, manifest and service worker |
| Tailwind CSS | One plain stylesheet with CSS variables (`src/styles.css`) | The brief allowed another lightweight approach |
| Dexie | A ~100-line IndexedDB adapter (`src/data/storage.ts`) | Transactions are atomic; tested in a real browser |
| Vitest | Node's built-in test runner via `tsx` | No extra dependency |
| vite-plugin-pwa / Workbox | A 40-line hand-written service worker | Small enough to read and audit in a minute |

Swapping any of these back later does not affect the app's logic.

**Layout.**

```
app.config.json        name, colours (single place to rename)
index.html             HTML template
public/                icons, favicon (flat, no sub-folders)
scripts/               build, dev server, static server, service worker template, bundle check
e2e/smoke.mjs          browser tests
src/
  domain/              pure logic, no browser APIs: dates, XP/levels, recurrence, stats,
                       achievements, validation schemas, limits
  data/                storage adapters, repository (all writes), import/export, example data
  state/store.tsx      React state: loads a snapshot, runs actions, shows feedback
  ui/                  shell, dialogs, rows, editors, icons
  pages/               Home, Quests, Chores, Progress, Rewards, Settings
  pwa/register.ts      service worker registration, update prompt, install prompt
```

**The ledger.** Every XP award and reward redemption is one row in an append-only `events` table. Level,
coin balance, streaks, totals and charts are all computed from it; there are no counters that could drift.

**XP rules.**

- Level curve: level L → L+1 costs `100 + 50·(L−1)` XP (level 5 = 700 XP total, level 10 = 2,700).
- Completing a quest or chore occurrence awards XP once. Tapping again, a second tab, or a refresh cannot award it twice.
- Reopening a quest (or Undo) withdraws that award; completing it again awards it once more.
- If you already spent the coins from a completion, it cannot be undone, so the balance never goes negative.
- Changing a quest's XP after completing it does not change what was awarded. Deleting it keeps the XP and history.
- Coins are earned alongside XP (1 per XP by default, adjustable). Spending coins never touches XP or level.
- Achievements stay unlocked. Ending a streak costs nothing.

**Ready for sync.** Business logic only talks to the `Storage` interface in `src/data/storage.ts`; records
carry `updatedAt`, ids are random 128-bit values, and the ledger is append-only, which is the easy case for
merging. Import → Merge already implements a safe union by id.

## What was verified, and what was not

Run in the build sandbox on the delivered code:

| Check | Result |
| --- | --- |
| `npm test` | 101 tests pass (city rules, gem integrity, hostile city imports, plus): XP, levels, duplicate-completion prevention, reopening, recurrence, missed/overdue chores, redemption and insufficient balance, import validation (hostile, malformed, oversized, prototype pollution), persistence across reopen, corrupted stored records, source-code safety scan |
| `npm run build` | succeeds |
| `npm run check:bundle` | clean: no secrets, source maps, remote resources, `eval`, or network calls |
| `npm run e2e` (headless Chromium, 390×844 touch and 1280×800) | 38 checks pass: every core flow, XSS payloads inert, data survives reload, works with the network cut **and** with the server stopped, zero requests to any other origin, CSP blocks inline script / `eval` / third-party requests, no personal data outside IndexedDB, no overflow, 44 px touch targets, keyboard use, reduced motion, running from a header-less host in a sub-folder, refusing to run inside a frame |

**Not verified — please treat as untested:**

- **A physical Android phone, GitHub Pages itself, and Termux.** Installation and offline use were tested in
  desktop Chromium with a phone-sized touch viewport, not on a device, and against a local stand-in for a basic
  static host rather than GitHub's servers. The steps above are the standard procedures but I could not run them.
- **Firefox.** Only Chromium was available. The code uses standard, widely supported APIs.
- **`npm install`, `npm audit` and a lockfile.** The sandbox could not reach the npm registry, so
  `package-lock.json` is **not included** and no dependency audit was run. Versions in `package.json` are pinned
  exactly. Your first `npm install` writes the lockfile; commit it and run `npm audit`.
- **`npm run typecheck` against the official React typings.** `@types/react` was not available. The non-UI code
  type-checks strictly; UI files were checked against a stand-in. If `npm run typecheck` reports anything
  in `src/ui` or `src/pages` on your machine it will be a typing detail, not a behaviour bug — the build does not depend on it.

## Next steps

1. **Cross-device sync (opt-in).** Needs your approval of an architecture and threat model first. The natural
   design: a small self-hosted server that stores end-to-end encrypted ledger events, with per-device keys and
   a recovery phrase; the server never sees quest text. Until then, Export/Import is the manual bridge.
2. **Encrypted vault / app lock.** Derive a key from a passphrase (PBKDF2 or Argon2 → AES-256-GCM via Web
   Crypto) and encrypt records before they reach IndexedDB. Deliberately not faked with a cosmetic PIN.
3. **Reminders.** Web notifications with generic text by default. Android does not guarantee background
   delivery for web apps without a push server, so this needs real-device testing before promising anything.
4. **Encrypted backups**, so an exported file is safe to keep in cloud storage.
5. Project overview page, drag-to-reorder, a home-screen widget (requires a native wrapper).
