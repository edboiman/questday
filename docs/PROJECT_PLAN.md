# QuestAday: project plan

A storybook-style quest journal for real life. You write quests and chores; finishing them earns XP
(levels), coins (museum exhibits or real-life treats) and gems (your town). Offline-first, private by
default, aimed at a Google Play release with a one-time Premium unlock.

## Product principles
1. **Kind, never guilt-inducing.** Nothing decays, nothing is taken away, no streak shaming.
2. **Choices matter.** Scarce land, town needs, rarity unlocks, one coin purse with two uses.
3. **Private by default.** Works with no account. Cloud sync is optional and only stores your own data.
4. **Free is a complete game.** Premium adds content and speed, never removes anything.
5. **Original and clean.** Original art and names; no third-party characters, brands or trackers.

## Screens (the book)
| Where | What it does | Status |
|---|---|---|
| Opening | Leather cover with gilt title and embers; "Open the book" swings it open onto Chapter I. Once per visit. | Done |
| Chapter I · Quests | Greeting, level, today's XP/streak/gems; quest log with search, filters (Open, Today, Upcoming, Overdue, Completed, All), sort; any calendar due date | Done |
| Chapter II · Chores | Due now / coming up; repeats every 1–4 (or N) days, weekly, monthly; first-due date; skip; history | Done |
| Chapter III · Town | Gem balance, town map (land 4×4 → 6×6 free, 9×9 Premium), shop, needs (food/fun/calm), residents, weekly event, seasons | Done |
| Chapter IV · Rewards | One coin purse; **Museum** (30 exhibits, 5 wings, rarity unlocks, daily special, wing bonus) or **Real-life treats** (your own rewards) | Done |
| Journal | Level, totals, weekly report (Premium), week chart, weekly goal, achievements, recent activity | Done |
| Settings | Name, theme picker (6 themes + match device), Premium card, game rules, backup/import/erase, storage, install | Done |
| Admin tools (personal build only) | Adjust XP/coins/gems, toggle Premium, time travel by days, reset and seed | Done |
| Sign in / account | Optional email one-time-code sign-in, profile (display name, avatar), sync status, delete account | **Next** |
| Paywall + Premium purchase | Shown when a locked feature is tapped; RevenueCat/Play Billing; restore; all edge cases | Done (needs real-device test) |
| Privacy policy page | Hosted page + link from Settings and the Play listing | **Next** |
| Licences screen | Open-source licences (React, zod) and art credits from `ASSETS.md` | Next |

Navigation: four ribbon bookmarks (chapters), swipe left/right to turn pages, Journal and Settings in the header.

## Data model

### On the device (IndexedDB `questday`, version 2): the source of truth
| Store | Contents |
|---|---|
| `tasks` | Quests: title, notes, type (task/chore/project), project, due date, focus day, priority, tag, estimate, subtasks, XP, completion |
| `chores` | Recurring chores: recurrence rule, next due, difficulty, XP, paused |
| `events` | **The ledger.** Append-only. Kinds: `task`, `chore` (earn XP+coins+gems), `redeem` (treat), `collect` (exhibit), `build` (buy/sell/land), `income`, `event` (weekly event, wing bonus), `admin` (personal build only). Undo = `voidedAt`. |
| `rewards` | Real-life treats you define |
| `achievements` | Unlock dates |
| `city`, `residents` | Buildings on tiles; residents who moved in |
| `meta` | Settings, city meta (land level, last income day), Premium flag |

Every number (level, coins, gems, owned exhibits, streaks) is derived from the ledger; no counters to drift.

### In the cloud (Supabase Postgres, optional): see `supabase/migrations`
| Table | Purpose | Access (Row Level Security) |
|---|---|---|
| `auth.users` | Supabase accounts (email) | Managed by Supabase |
| `profiles` | id, display_name (≤40), avatar id, theme, timestamps | Owner reads/updates own row; created by signup trigger |
| `records` | One row per local record: (user_id, collection, id, data jsonb ≤16 KB, deleted, updated_at) | Owner only; server sets `updated_at`; identity immutable; 60,000 rows per user |
| `entitlements` | `premium_unlock` per user; SHA-256 of Play token (unique), status | Owner can read; **only the server** (verify-purchase) can write |

Edge functions: `verify-purchase` (asks Google, grants Premium), `delete-account` (erases everything).

## Sync design (next milestone)
- Local-first: the app keeps working offline; sync runs when signed in and online.
- Push: records changed since last push → upsert into `records` (batched). Pull: rows with `updated_at` > last pull.
- Conflicts: ledger events are immutable except `voidedAt` (once set, stays set), so most merges are unions;
  for editable records (tasks, chores, rewards, settings) last-writer-wins by `updatedAt`.
- Premium on device = (Play purchase verified on this device) OR (`has_premium()` from the server).
- Imports and sync data pass the same schema + integrity checks as backups today.
- CSP `connect-src` gains only the Supabase project URL; the bundle check is updated to allow exactly that host.

## Tech stack decisions
| Choice | Why |
|---|---|
| React 19 + TypeScript, hand-written CSS | Small, fast, no CSS framework lock-in; full control of the book look |
| esbuild, flat `dist/` | One-second builds; flat output can be uploaded from a phone to GitHub Pages |
| zod schemas | Every import/sync record validated; strict, no unknown keys |
| IndexedDB (own 100-line adapter) | Offline, atomic transactions, no dependency |
| PWA on the web + Capacitor 8 for Play | One codebase; Capacitor gives RevenueCat's official plugin for Play Billing |
| Supabase (Postgres + RLS + Auth + Edge Functions) | Row Level Security is real database security, not client checks; standard Postgres = no lock-in; EU regions |
| Google Play Billing via RevenueCat | One-time `premium_unlock`; purchases verified by Google/RevenueCat; restores, refunds, pending handled |
| Node test runner + Playwright, local Postgres for RLS | Tests run offline; RLS tested against real Postgres 16 |
| No analytics, ads or crash SDKs | Keeps Play "Data safety" simple and GDPR exposure low |

## Free vs Premium (one-time unlock, $0.99)
See `docs/BILLING.md` for the full table, the edge cases and the setup steps. In short: free is quests, chores,
Journal, treats and a 6×6 town; Premium adds the museum, +50% XP, a 9×9 town with triple income, three
buildings, three unique residents and weekly progress reports.

## Compliance checklist before Play release
- [ ] Privacy policy (what is stored on device; what sync stores; Supabase as processor; deletion; contact)
- [ ] Play Data safety form (with sync: email + app content, encrypted in transit, deletable)
- [ ] In-app and web account deletion (function exists; needs UI + a web page)
- [ ] Supabase DPA accepted; EU region if EU users; records of processing (a one-page note)
- [ ] Trademark search for "QuestAday" (USPTO, EUIPO) and the icon
- [ ] `ASSETS.md` listing every image/font/sound with source and licence; licences screen
- [ ] Content rating questionnaire; target API level; closed testing period for new developer accounts
- [ ] Refund handling (Play real-time developer notifications → entitlement `refunded`)
- [ ] Physical-device testing (Android Chrome + Firefox), accessibility pass with TalkBack

## Milestones
1. ✅ Offline game: quests, chores, town, museum, journal, themes, storybook UI, personal admin build
2. ✅ Backend schema + RLS + purchase/deletion functions, tested locally
3. ✅ Payments: RevenueCat + Play Billing adapter, paywall, Capacitor Android shell, webhook (needs device test)
4. ⏳ Sign-in, profile and sync client (Supabase Auth email OTP; `src/cloud/`; `Purchases.logIn`)
5. ⏳ Play listing: privacy policy, data safety, content rating, closed test
6. ⏳ Original art swap-in (owner), sound (optional), more seasons/events
