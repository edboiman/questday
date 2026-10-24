# Payments: QuestAday Premium on Google Play

**What is sold:** one in-app product, `premium_unlock`, a one-time purchase (non-consumable) for US$0.99
(set the price per country in Play Console). No subscription. RevenueCat entitlement id: `premium`.

**Why Google Play Billing (via RevenueCat), not Stripe:** Google Play's payments policy requires apps
distributed on Play to sell digital content and features through Google Play Billing (some regions now allow
alternatives, with extra requirements; check the current policy before changing this). RevenueCat wraps Play
Billing, verifies purchases on its servers, and handles restores, refunds and pending payments. It is free up
to $2,500/month in tracked revenue, then 1% (check current pricing). Stripe stays relevant only if you later
sell on the web outside the app.

## How it fits together
```
Google Play  ⇄  RevenueCat SDK (inside the Android app, via @revenuecat/purchases-capacitor)
                  │  public SDK key only (goog_…)
                  ▼
         src/billing/revenuecat.ts  →  src/billing/entitlement.ts (reconcile)  →  device Premium flag
                  │
RevenueCat servers ──webhook──▶ supabase/functions/revenuecat-webhook ──▶ entitlements table (for signed-in users)
```
- The web/GitHub version has no billing: Premium features show the paywall, which explains Premium is bought in
  the Play Store app. The personal build can preview Premium with Admin tools.
- The Android build (`node scripts/build.mjs --android`) uses RevenueCat and has no service worker and no admin code.

## Free vs Premium
| | Free | Premium ($0.99 once) |
|---|---|---|
| Quests, chores, Journal, achievements, themes, real-life treats, backups | ✓ | ✓ |
| XP per completion | 1× | 1.5× |
| Town | up to 6×6, base daily income | up to 9×9, 3× daily income, Observatory, Bathhouse, Guildhall |
| Residents | 10 | 13 (Ember the dragon, Luna the unicorn, Gale the griffin) |
| Museum (30 exhibits, 5 wings) | look only | collect |
| Weekly progress reports | — | ✓ |

Things a player already owns (exhibits, buildings, residents, XP earned) are never taken away if Premium ends.

## Edge cases and what the player sees
| Situation | Behaviour | Tested in |
|---|---|---|
| Taps Unlock, closes the Google sheet | Nothing happens, no error | billing.test, e2e/android |
| Double/triple tap on Unlock | One purchase only | billing.test, e2e/android |
| Payment pending (cash, slow bank) | "Pending with Google… unlocks by itself"; unlocks automatically when confirmed (live listener + launch/foreground checks) | both |
| Already owns it (reinstall, new phone) | Unlocks automatically on launch; "Restore purchase" also works; "already owned" errors count as success | both |
| Restore with nothing to restore | "No Premium purchase was found on this Google account…" | both |
| Offline when buying/restoring | Buttons disabled, "You're offline… Nothing was charged" | e2e/android |
| Offline at launch / while playing | Premium kept; never revoked or granted while offline | both |
| Refund or revoked purchase | Premium turns off at the next online check; "everything you collected stays yours" | both |
| Expired entitlement (if a subscription is ever added) | Treated as inactive | billing.test |
| Play Store missing / not signed in / billing disabled / product not set up | "Purchases aren't available on this device…", app keeps working | billing.test |
| RevenueCat not configured yet (no key) | Paywall says purchases are unavailable; build prints a warning | build.mjs |
| Store error | "Google Play couldn't complete that. You were not charged." | billing.test |
| Backup restored or data erased | Play purchase kept (it belongs to the Google account) | museum.test |

## One-time setup (in this order)
1. **Google Play Console** (developer account, $25 once):
   create the app with package name from `android-app/capacitor.config.json` (`appId`; change
   `com.questaday.app` to a domain you control before the first upload: it can never change later).
   Monetize → Products → In-app products → create `premium_unlock`, one-time, price $0.99, activate.
   Setup → License testing → add your Google account (test purchases are free).
2. **RevenueCat** (revenuecat.com, free): create a project → add an Android app with the same package name →
   upload a Google Play service-account JSON (RevenueCat's guide walks through it) → Products: import
   `premium_unlock` → Entitlements: create `premium`, attach the product → Offerings: `default` offering with
   a **Lifetime** package containing `premium_unlock`. Copy the **public Android SDK key** (`goog_…`).
3. **Build the Android app** (on your computer, Node 22+, Android Studio 2025.2.1+):
   ```
   cd android-app
   npm install
   npm install @revenuecat/purchases-capacitor
   npx cap add android
   REVENUECAT_ANDROID_KEY=goog_xxx npm run sync      # Windows: set REVENUECAT_ANDROID_KEY=goog_xxx && npm run sync
   npm run open                                      # opens Android Studio
   ```
   In `android/app/src/main/AndroidManifest.xml`, set the main activity's `android:launchMode="singleTop"`
   (RevenueCat: other modes can cancel purchases when the user switches apps to approve a payment).
   Build a signed App Bundle (Build → Generate Signed Bundle). Keep the keystore safe (not in git).
4. **Upload** to an internal testing track, install from the Play link on your phone, and test: buy with the
   licence-tester account, refund it from Play Console (Order management), check it locks again, reinstall and
   check it comes back.
5. **Optional server record** (needed once sign-in/sync ships): deploy the webhook
   `supabase functions deploy revenuecat-webhook --no-verify-jwt`,
   `supabase secrets set REVENUECAT_WEBHOOK_AUTH="Bearer <long random string>"`, and in RevenueCat →
   Integrations → Webhooks set the URL `https://<project>.supabase.co/functions/v1/revenuecat-webhook` and the
   same Authorization header value.

## Before upgrading the RevenueCat plugin
Check its TypeScript definitions still match `PurchasesPlugin` in `src/billing/revenuecat.ts` (method names,
`customerInfo.entitlements.active`, error codes). Run `node e2e/android.mjs` and a real test purchase.
