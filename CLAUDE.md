# QuestAday: instructions for Claude

Storybook-style quest journal PWA (quests, chores, a town, a museum), offline-first, heading for Google Play
with a one-time Premium unlock and optional Supabase sign-in/sync. The owner is not a developer: explain in
plain language, deliver zips of build output plus step-by-step instructions, and ask before big direction changes.

Read first: `docs/PROJECT_PLAN.md` (features, screens, schema, stack, milestones), `docs/DESIGN.md` (themes,
type, spacing, motion), `SECURITY.md`, `supabase/README.md`.

## Non-negotiables
- **Privacy.** No analytics, ads, trackers, crash SDKs, remote fonts/images/scripts. CSP is `default-src 'none'`
  with `connect-src 'self'`. When sync ships, `connect-src` gains only the Supabase project URL. Enforced by
  `scripts/check-bundle.mjs`, `src/safety.test.ts` and e2e. Web storage holds only allow-listed UI flags.
- **Never** `innerHTML`/`dangerouslySetInnerHTML`, `eval`, `new Function`. All imported/synced data goes
  through strict zod schemas (`src/domain/schema.ts`) and integrity checks (`src/data/transfer.ts`).
- **Ledger.** Every balance is derived from the append-only `events` table. Never add stored counters.
  Undo = `voidedAt`. Ledger ids are unique so double taps cannot double-award. Each write is one atomic
  `storage.tx` in `src/data/repo.ts`; checks and spends happen in the same transaction.
- **New ledger kind checklist:** `types.ts` union, `eventConsistent` (schema.ts), `saneAmounts`/`saneEvent`
  (repo.ts), import cross-checks (transfer.ts), `undoEvent` rules, hostile-import tests, Journal history icon.
- **Backwards compatibility.** Old backups must keep importing (optional fields + defaults). Internal ids stay
  `questday` (IndexedDB name, `questday-export` format); renaming them orphans users' data.
- **Kind design.** Nothing decays or is taken away; challenge comes from choices. Free is a complete game.
- **Accessibility.** Tap targets ≥ 44px, no horizontal overflow at 360px, visible focus, reduced motion respected,
  every theme readable.
- **Cloud security.** RLS on every table, forced, keyed on `auth.uid()`; anon gets nothing; entitlements are
  written only by the service role after Google verifies a purchase. Add a test in `supabase/tests/10_rls.sql`
  for every new table or policy.

## Three builds
| | Command | Output | Admin tools | Billing |
|---|---|---|---|---|
| Public web | `node scripts/build.mjs` | `dist/` | Removed at build time | None (paywall explains Premium is bought in the Play app) |
| Personal (owner's GitHub test copy) | `node scripts/build.mjs --personal` | `dist-personal/` | Adjust XP/coins/gems, Premium toggle, time travel, reset+seed | None |
| Android / Google Play | `REVENUECAT_ANDROID_KEY=goog_… node scripts/build.mjs --android` | `dist-android/` → `android-app/www` | Removed | RevenueCat (Play Billing) |

## Payments (read docs/BILLING.md first)
- One-time `premium_unlock` ($0.99) via Google Play Billing through RevenueCat; entitlement id `premium`.
  Do not add Stripe or any other payment path inside the Play app without checking Google Play's payments policy.
- `src/billing/`: `types.ts` (provider interface, outcomes), `revenuecat.ts` (plugin adapter, error mapping),
  `entitlement.ts` (pure `reconcile`: offline never grants or revokes; refunds revoke; admin toggles untouched).
- The paywall (`ui/Paywall.tsx`) appears only when a locked feature is tapped (`act.openPaywall(feature)`).
- Premium rules live in `src/domain/premium.ts` (museum, XP ×1.5, land 6×6 vs 9×9, income ×3, premium buildings
  and residents, weekly report). Never take away what a player owns when Premium ends.
- Only the RevenueCat *public* key may ship; `check-bundle.mjs` flags anything else that looks like a key.

Admin code must be guarded with the build constant `__QA_ADMIN__` used **directly** in an `if`/ternary/`&&`
(or behind a module-level function), so esbuild deletes it from the store build. Class methods and
cross-module constants are NOT removed. `check-bundle.mjs` fails the store build if admin strings leak.
The store build also refuses backups containing `admin` ledger entries.

## Folder structure (where new things go)
```
app.config.json        display name, colours (rename the app here only)
index.html             HTML shell (CSP injected at build)
public/                icons, favicon (copied flat into the build)
design/                source SVGs for icons
docs/                  PROJECT_PLAN.md, DESIGN.md
scripts/               build.mjs (--personal), serve.mjs (--personal), dev.mjs, check-bundle.mjs (--personal),
                       shared.mjs (CSP, headers, manifest), sw.template.js, test-env.mjs
src/
  main.tsx, App.tsx    boot, router (hash), page-turn direction, opening scene
  config.ts            APP_NAME, DB_NAME
  flags.ts             __QA_ADMIN__ build flag
  clock.ts             now() — the only clock (admin time travel); never call new Date() for "today"
  themes.ts            theme list
  domain/              pure rules, no I/O: xp, stats, recurrence, achievements, city, museum, premium,
                       schema, limits, dates, types
  data/                storage.ts (IndexedDB), repo.ts (all writes), transfer.ts (export/import), demo.ts, *.test.ts
  state/store.tsx      React context: derived values, actions, toasts, reward pops
  pages/               Quests (Ch I), Chores (Ch II), City (Ch III), RewardsChapter + Museum + Rewards/Treats
                       (Ch IV), Progress (Journal), Settings
  ui/                  Shell (book, ribbons, swipe), Opening, Dialog, editors, rows, overlays (toasts, pops,
                       level up), Icon, CityArt, ExhibitArt, AdminPanel
  billing/             payments: provider interface, RevenueCat adapter, entitlement reconcile, tests
  cloud/               (next) Supabase auth + sync client — create here
  styles.css           all styles; themes at the top, book section near the end
supabase/
  migrations/          SQL, applied in filename order (YYYYMMDDHHMMSS_name.sql); never edit a shipped migration
  functions/           edge functions (Deno): verify-purchase, delete-account, _shared
  tests/run.sh         local Postgres + RLS tests
android-app/           Capacitor 8 shell for Google Play (capacitor.config.json, scripts/copy-web.mjs)
e2e/                   smoke.mjs (public build), personal.mjs (admin build), android.mjs (billing flows with a
                       scripted store), shots/ (screenshots, not committed)
```

## Commands
- Unit tests: `node --import tsx --import ./scripts/test-env.mjs --test "src/**/*.test.ts"` (117 tests)
- Type-check: `tsc --noEmit` (the sandbox needed a React types shim)
- Builds: `node scripts/build.mjs` then `node scripts/check-bundle.mjs`; same with `--personal`
- Browser tests: `node e2e/smoke.mjs` (public build, 42 checks), `node e2e/personal.mjs` (admin build) and
  `node e2e/android.mjs` (Android build with a scripted RevenueCat; build with a dummy `goog_…` key first);
  rebuild first; takes ~3 min. Don't `pkill -f serve.mjs` in the same shell command (it kills the shell).
- Backend tests: `supabase/tests/run.sh` (needs Postgres 16+; 21 checks)
- Phone package: copy `dist-personal/` (owner's copy) or `dist/` into a folder and zip it (15 flat files).
- Look check: `node e2e/look.mjs [theme]` (screenshots of every chapter, phone + desktop, console/overflow check);
  `node e2e/opening.mjs` (book opening keeps its 0.9s swing, 1800px perspective, tap + keyboard).

## Deployment today
Owner's personal copy: GitHub Pages, repo `edboiman/questday`, https://edboiman.github.io/questday/,
the 15 flat files at the repo root (app files, icons, `lora-*.woff`, `paper.svg`, `fibres.svg`, `flourish.svg`). After uploading, the app shows "Update now".

## Visual design
Default theme is **Wildwood** (forest green #243C32, parchment #F4E9D2, antique gold #D8AA55, ink #282B26).
The redesign layer is the "cozy fantasy" section at the end of `styles.css`; it only restyles. Never change the
`.opening`/`.cover` transform, transition, timing or the `.turn` keyframes — the book opening is the signature
interaction (`e2e/opening.mjs` guards it). Decorations are scoped to book themes (not Ink/Paper). Local assets
referenced from CSS (`*.svg`, `*.woff`) are marked external in `scripts/shared.mjs` and live in `public/`.

## Art pipeline (owner draws original art)
- Only original art, or CC0/MIT/Apache with an entry in `ASSETS.md` (file, source, licence, author).
- No famous characters, brands, logos or look-alikes, even redrawn.
- SVG, or PNG with transparency. Buildings 256×256 (shown 44–52px), residents 256×256, exhibits 512×512.
- Swap internals of `BuildingArt` / `ResidentFace` / `ExhibitArt`; keep the ids so saves and backups work.
  Bundle locally (CSP blocks remote images).

## Status (Oct 2026)
Done: milestones 1–3 in `docs/PROJECT_PLAN.md` (offline game, backend, billing + Android shell). Next:
real-device purchase test, sign-in/profile/sync client (`src/cloud/`, then `Purchases.logIn(supabaseUserId)`),
privacy policy, licences screen, original art. Untested on a physical phone; no
lockfile or dependency audit yet (the sandbox had no npm registry access).
