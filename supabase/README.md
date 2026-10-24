# QuestAday backend (Supabase)

Optional cloud layer: accounts, profile, backup/sync of your game, and the paid unlock.
The app works fully without it (offline, on-device). Nothing here is connected to the app yet;
the sign-in and sync client is the next milestone (see `docs/PROJECT_PLAN.md`).

## What is here
| Path | What it does |
|---|---|
| `migrations/…_init.sql` | Tables `profiles`, `records`, `entitlements`, Row Level Security, signup trigger, storage quota |
| `functions/verify-purchase` | Confirms a Google Play purchase with Google, then grants `premium_unlock` |
| `functions/delete-account` | Deletes the caller's account and (by cascade) all their cloud data |
| `tests/run.sh` | Spins up a throwaway local Postgres, applies the migrations and runs 20 security tests |

## Security model in one paragraph
Every table has Row Level Security forced on, keyed on `auth.uid()`. Signed-in users can only read and
change their own rows; anonymous visitors can read nothing. Gameplay data is trusted per user (cheating only
affects your own account: there are no leaderboards or trading). The paid unlock is the exception: users can
read their entitlement but only the service role can write it, after Google confirms the purchase, and a
purchase token can unlock only one account. The service-role key lives only in Supabase secrets, never in the app.

## Set up (when you are ready)
1. Create a project at supabase.com. Pick an EU region if most players will be in Europe.
2. Dashboard → SQL Editor → paste and run `migrations/20261011000001_init.sql`
   (or `supabase link` + `supabase db push` with the Supabase CLI).
3. Authentication → Providers: enable **Email** with one-time codes (no passwords to leak). Optionally Google.
4. Authentication → URL configuration: set your site URL.
5. Edge functions: `supabase functions deploy verify-purchase` and `supabase functions deploy delete-account`,
   then `supabase secrets set PLAY_PACKAGE_NAME=… PLAY_SERVICE_ACCOUNT_JSON="$(cat key.json)"`.
6. The app will need only the project URL and the **anon** key (both are public by design; RLS is what protects data).

## Run the tests
`supabase/tests/run.sh` (needs Postgres 16+ installed locally). Expect "All RLS tests passed."

## Still to do before launch
- Refunds: subscribe to Google Play real-time developer notifications and set `status = 'refunded'`.
- Rate limiting on the edge functions (Supabase API gateway or a small counter table).
- Run Supabase's Security Advisor in the dashboard after setup.
