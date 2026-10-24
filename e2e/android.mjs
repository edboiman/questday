// Browser test for the Android build's billing flows, with a scripted stand-in
// for the RevenueCat Capacitor plugin. Real Google Play purchases must still be
// tested on a device with a licence-tester account (docs/BILLING.md).
//   REVENUECAT_ANDROID_KEY=goog_TestPublicKey123456 node scripts/build.mjs --android && node e2e/android.mjs
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4395;
const ORIGIN = `http://localhost:${PORT}`;
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const proc = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--android'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => proc.stdout.on('data', (d) => String(d).includes('Serving') && r()));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// The stand-in plugin. Tests steer it through window.__rc.
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem('qa-opened', '1');
  } catch {}
  const ACTIVE = { entitlements: { active: { premium: { isActive: true, expirationDate: null } } } };
  const NONE = { entitlements: { active: {} } };
  const rc = (window.__rc = { owned: false, next: 'success', listener: null, purchases: 0 });
  const plugin = {
    configure: async () => undefined,
    getOfferings: async () => ({ current: { availablePackages: [{ identifier: '$rc_lifetime', product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
    purchasePackage: async () => {
      rc.purchases++;
      if (rc.next === 'cancel') throw { code: '1', userCancelled: true, message: 'Purchase was cancelled.' };
      if (rc.next === 'pending') throw { code: '20', message: 'The payment is pending.' };
      rc.owned = true;
      return { customerInfo: ACTIVE };
    },
    restorePurchases: async () => ({ customerInfo: rc.owned ? ACTIVE : NONE }),
    getCustomerInfo: async () => ({ customerInfo: rc.owned ? ACTIVE : NONE }),
    addCustomerInfoUpdateListener: async (fn) => {
      rc.listener = fn;
      return 'l1';
    },
  };
  rc.emit = () => rc.listener?.(rc.owned ? ACTIVE : NONE);
  window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => plugin };
});

const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`);
  }
};
const wall = () => p.locator('dialog[open]');
const openWall = async () => {
  await p.goto(`${ORIGIN}/#/settings`);
  await p.getByRole('button', { name: 'Unlock Premium' }).click();
  await wall().getByRole('button', { name: /^Unlock Premium · / }).waitFor();
};

console.log('\nAndroid build (billing flows with a scripted store)');

await step('no service worker in the Android app; price comes from Google Play', async () => {
  await p.goto(`${ORIGIN}/#/quests`);
  await p.waitForTimeout(500);
  assert((await p.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))) === 0, 'service worker registered');
  await openWall();
  await wall().getByRole('button', { name: 'Unlock Premium · $0.99' }).waitFor();
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(root, 'e2e/shots/android-paywall.png') });
});

await step('cancelling the Google Play sheet is silent and changes nothing', async () => {
  await p.evaluate(() => (window.__rc.next = 'cancel'));
  await wall().getByRole('button', { name: /^Unlock Premium · / }).click();
  await p.waitForTimeout(300);
  assert((await wall().locator('.note').count()) === 0, 'showed a message for a cancel');
  assert((await p.getByText('Premium is active').count()) === 0, 'unlocked after cancel');
});

await step('pending payment: explained, not unlocked, then unlocks by itself when Google confirms', async () => {
  await p.evaluate(() => (window.__rc.next = 'pending'));
  await wall().getByRole('button', { name: /^Unlock Premium · / }).click();
  await wall().getByText('Your payment is pending with Google').waitFor();
  await p.evaluate(() => {
    window.__rc.owned = true;
    window.__rc.emit();
  });
  await p.getByText('Premium is active. Thank you!').waitFor();
  await wall().waitFor({ state: 'detached' }).catch(() => undefined);
  await p.goto(`${ORIGIN}/#/rewards`);
  await p.getByRole('heading', { name: 'Space Wing' }).waitFor();
  assert((await p.locator('.wing.locked-wing').count()) === 0, 'museum still locked');
});

await step('refund: Premium turns off when the store says so; nothing owned is taken away', async () => {
  await p.evaluate(() => {
    window.__rc.owned = false;
    window.__rc.emit();
  });
  await p.getByText('Premium is no longer active on this Google account.').waitFor();
  assert((await p.locator('.wing.locked-wing').count()) === 5, 'museum not locked again');
});

await step('offline: buying and restoring are disabled with an explanation; Premium is never revoked offline', async () => {
  await p.evaluate(() => (window.__rc.next = 'success'));
  await openWall();
  await wall().getByRole('button', { name: /^Unlock Premium · / }).click();
  await p.getByText('Premium is active. Thank you!').first().waitFor();
  await ctx.setOffline(true);
  await p.evaluate(() => {
    window.__rc.owned = false; // the store's cache is stale while offline
    window.__rc.emit();
    window.dispatchEvent(new Event('offline'));
  });
  await p.waitForTimeout(400);
  await p.goto(`${ORIGIN}/#/rewards`);
  await p.getByRole('heading', { name: 'Space Wing' }).waitFor();
  assert((await p.locator('.wing.locked-wing').count()) === 0, 'revoked while offline');
  // (A real phone also restarts fine offline: the app's files are inside the APK.)
  await ctx.setOffline(false);
  await p.evaluate(() => (window.__rc.owned = true));
  // The paywall itself, offline: explains, and buying/restoring are disabled.
  const off = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await off.addInitScript(() => {
    try {
      sessionStorage.setItem('qa-opened', '1');
    } catch {}
    const NONE = { entitlements: { active: {} } };
    const plugin = {
      configure: async () => undefined,
      getOfferings: async () => ({ current: { availablePackages: [{ product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
      purchasePackage: async () => ({ customerInfo: NONE }),
      restorePurchases: async () => ({ customerInfo: NONE }),
      getCustomerInfo: async () => ({ customerInfo: NONE }),
      addCustomerInfoUpdateListener: async () => 'x',
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => plugin };
  });
  const o = await off.newPage();
  await o.goto(`${ORIGIN}/#/settings`);
  await o.getByRole('button', { name: 'Unlock Premium' }).waitFor();
  await off.setOffline(true);
  await o.evaluate(() => window.dispatchEvent(new Event('offline')));
  await o.getByRole('button', { name: 'Unlock Premium' }).click();
  await o.locator('dialog[open]').getByText('You’re offline').waitFor();
  assert(await o.locator('dialog[open]').getByRole('button', { name: /^Unlock Premium · / }).isDisabled(), 'buy enabled offline');
  assert(await o.locator('dialog[open]').getByRole('button', { name: 'Restore purchase' }).isDisabled(), 'restore enabled offline');
  await o.screenshot({ path: join(root, 'e2e/shots/android-paywall-offline.png') });
  await off.close();
  await p.evaluate(() => (window.__rc.owned = true));
});

await step('restore: finds the purchase on a "new phone"; says so plainly when there is none', async () => {
  // A "new phone" (fresh profile) whose Google account owns Premium: unlocks on launch, no tap needed.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await phone.addInitScript(() => {
    sessionStorage.setItem('qa-opened', '1');
    const ACTIVE = { entitlements: { active: { premium: { isActive: true, expirationDate: null } } } };
    const plugin = {
      configure: async () => undefined,
      getOfferings: async () => ({ current: { availablePackages: [{ product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
      purchasePackage: async () => ({ customerInfo: ACTIVE }),
      restorePurchases: async () => ({ customerInfo: ACTIVE }),
      getCustomerInfo: async () => ({ customerInfo: ACTIVE }),
      addCustomerInfoUpdateListener: async () => 'x',
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => plugin };
  });
  const np = await phone.newPage();
  await np.goto(`${ORIGIN}/#/quests`);
  await np.getByText('Premium is active. Thank you!').waitFor();
  assert((await np.getByText('Premium is active. Thank you!').count()) === 1, 'unlock announced twice');
  await phone.close();
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await fresh.addInitScript(() => {
    sessionStorage.setItem('qa-opened', '1');
    const NONE = { entitlements: { active: {} } };
    const plugin = {
      configure: async () => undefined,
      getOfferings: async () => ({ current: { availablePackages: [{ product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
      purchasePackage: async () => ({ customerInfo: NONE }),
      restorePurchases: async () => ({ customerInfo: NONE }),
      getCustomerInfo: async () => ({ customerInfo: NONE }),
      addCustomerInfoUpdateListener: async () => 'x',
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => plugin };
  });
  const q = await fresh.newPage();
  await q.goto(`${ORIGIN}/#/settings`);
  await q.getByRole('button', { name: 'Unlock Premium' }).click();
  await q.locator('dialog[open]').getByRole('button', { name: 'Restore purchase' }).click();
  await q.locator('dialog[open]').getByText('No Premium purchase was found on this Google account').waitFor();
  await fresh.close();
});

await step('double tap on Unlock starts one purchase', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => {
    sessionStorage.setItem('qa-opened', '1');
    const rc = (window.__rc = { purchases: 0 });
    const ACTIVE = { entitlements: { active: { premium: { isActive: true } } } };
    const plugin = {
      configure: async () => undefined,
      getOfferings: async () => ({ current: { availablePackages: [{ product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
      purchasePackage: async () => {
        rc.purchases++;
        await new Promise((r) => setTimeout(r, 300));
        return { customerInfo: ACTIVE };
      },
      restorePurchases: async () => ({ customerInfo: { entitlements: { active: {} } } }),
      getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
      addCustomerInfoUpdateListener: async () => 'x',
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => plugin };
  });
  const q = await ctx2.newPage();
  await q.goto(`${ORIGIN}/#/settings`);
  await q.getByRole('button', { name: 'Unlock Premium' }).click();
  const buy = q.locator('dialog[open]').getByRole('button', { name: /^Unlock Premium · / });
  await buy.waitFor();
  await buy.evaluate((el) => {
    el.click();
    el.click();
    el.click();
  });
  await q.getByText('Premium is active. Thank you!').waitFor();
  assert((await q.evaluate(() => window.__rc.purchases)) === 1, 'more than one purchase started');
  await ctx2.close();
});

await step('no console errors', async () => assert(errors.length === 0, errors.slice(0, 3).join(' | ')));

await browser.close();
proc.kill();
console.log(failed ? `\n${failed} failed` : '\nAll Android billing checks passed.');
process.exit(failed ? 1 : 0);
