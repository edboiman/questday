import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile } from './entitlement';
import { classify, createRevenueCat, premiumActive, type PurchasesPlugin } from './revenuecat';
import { noBilling } from './types';

const active = { entitlements: { active: { premium: { isActive: true, expirationDate: null } } } };
const none = { entitlements: { active: {} } };

function fakePlugin(over: Partial<PurchasesPlugin> = {}) {
  const calls: string[] = [];
  let listener: ((info: unknown) => void) | null = null;
  const plugin: PurchasesPlugin = {
    configure: async () => void calls.push('configure'),
    getOfferings: async () => ({ current: { availablePackages: [{ identifier: '$rc_lifetime', product: { identifier: 'premium_unlock', priceString: '$0.99' } }] } }),
    purchasePackage: async () => ({ customerInfo: active }),
    restorePurchases: async () => ({ customerInfo: active }),
    getCustomerInfo: async () => ({ customerInfo: none }),
    addCustomerInfoUpdateListener: async (fn) => {
      listener = fn as (info: unknown) => void;
      return 'id';
    },
    ...over,
  };
  return { plugin, calls, emit: (info: unknown) => listener?.(info) };
}

test('reconcile: store active unlocks; offline never changes anything; refunds revoke; admin toggles are left alone', () => {
  assert.deepEqual(reconcile({ active: false, source: null }, { kind: 'active' }), { next: { active: true, source: 'play' }, change: 'unlocked' });
  assert.deepEqual(reconcile({ active: true, source: 'play' }, { kind: 'active' }).change, null);
  assert.deepEqual(reconcile({ active: true, source: 'play' }, { kind: 'unknown' }), { next: { active: true, source: 'play' }, change: null });
  assert.deepEqual(reconcile({ active: false, source: null }, { kind: 'unknown' }).next.active, false);
  assert.deepEqual(reconcile({ active: true, source: 'play' }, { kind: 'inactive' }), { next: { active: false, source: null }, change: 'revoked' });
  assert.deepEqual(reconcile({ active: true, source: 'admin' }, { kind: 'inactive' }), { next: { active: true, source: 'admin' }, change: null });
  assert.deepEqual(reconcile({ active: false, source: null }, { kind: 'inactive' }).change, null);
});

test('premiumActive: lifetime counts; a lapsed expiry or inactive flag does not', () => {
  assert.equal(premiumActive(active), true);
  assert.equal(premiumActive(none), false);
  assert.equal(premiumActive(undefined), false);
  assert.equal(premiumActive({ entitlements: { active: { premium: { isActive: true, expirationDate: '2020-01-01T00:00:00Z' } } } }), false);
  assert.equal(premiumActive({ entitlements: { active: { premium: { isActive: true, expirationDate: '2999-01-01T00:00:00Z' } } } }), true);
  assert.equal(premiumActive({ entitlements: { active: { premium: { isActive: false } } } }), false);
});

test('classify: RevenueCat error codes and messages map to plain outcomes', () => {
  assert.equal(classify({ code: '1' }), 'cancelled');
  assert.equal(classify({ userCancelled: true, code: '2' }), 'cancelled');
  assert.equal(classify({ code: 20 }), 'pending');
  assert.equal(classify({ code: '10' }), 'offline');
  assert.equal(classify({ code: '35' }), 'offline');
  assert.equal(classify({ code: '6' }), 'already-owned');
  assert.equal(classify({ code: '3' }), 'unavailable');
  assert.equal(classify({ code: '23' }), 'unavailable');
  assert.equal(classify({ message: 'The Internet connection appears to be offline.' }), 'offline');
  assert.equal(classify(new Error('boom')), 'error');
  assert.equal(classify(undefined), 'error');
});

test('purchase: success, cancel, pending, already owned, store problem', async () => {
  let rc = createRevenueCat(fakePlugin().plugin, 'goog_test');
  assert.equal(rc.canPurchase, true);
  assert.deepEqual(await rc.offer(), { priceString: '$0.99' });
  assert.deepEqual(await rc.purchase(), { kind: 'purchased' });

  rc = createRevenueCat(fakePlugin({ purchasePackage: async () => Promise.reject({ code: '1', userCancelled: true }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.purchase(), { kind: 'cancelled' });

  rc = createRevenueCat(fakePlugin({ purchasePackage: async () => Promise.reject({ code: '20' }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.purchase(), { kind: 'pending' });

  // Google accepted the order but the entitlement isn't active yet: also pending, not "purchased".
  rc = createRevenueCat(fakePlugin({ purchasePackage: async () => ({ customerInfo: none }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.purchase(), { kind: 'pending' });

  rc = createRevenueCat(fakePlugin({ purchasePackage: async () => Promise.reject({ code: '6' }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.purchase(), { kind: 'purchased' });

  rc = createRevenueCat(fakePlugin({ purchasePackage: async () => Promise.reject({ code: '2' }) }).plugin, 'goog_test');
  assert.equal((await rc.purchase()).kind, 'error');
});

test('purchase: a double tap starts only one purchase', async () => {
  let n = 0;
  const rc = createRevenueCat(
    fakePlugin({
      purchasePackage: async () => {
        n++;
        await new Promise((r) => setTimeout(r, 20));
        return { customerInfo: active };
      },
    }).plugin,
    'goog_test',
  );
  const [a, b] = await Promise.all([rc.purchase(), rc.purchase()]);
  assert.equal(n, 1);
  assert.deepEqual([a.kind, b.kind].sort(), ['error', 'purchased']);
});

test('no product set up, no plugin, no key, or configure failing: unavailable, never a crash', async () => {
  let rc = createRevenueCat(fakePlugin({ getOfferings: async () => ({ current: null }) }).plugin, 'goog_test');
  assert.equal((await rc.purchase()).kind, 'unavailable');
  assert.equal(await rc.offer(), null);
  rc = createRevenueCat(null, 'goog_test');
  assert.equal(rc.canPurchase, false);
  assert.equal((await rc.purchase()).kind, 'unavailable');
  assert.deepEqual(await rc.check(), { kind: 'unknown' });
  rc = createRevenueCat(fakePlugin().plugin, '');
  assert.equal(rc.canPurchase, false);
  let tries = 0;
  const flaky = fakePlugin({
    configure: async () => {
      tries++;
      if (tries === 1) throw new Error('Play Services updating');
    },
  });
  rc = createRevenueCat(flaky.plugin, 'goog_test');
  assert.equal((await rc.purchase()).kind, 'unavailable');
  assert.equal((await rc.purchase()).kind, 'purchased'); // retried configure
});

test('restore: found, nothing found, offline', async () => {
  let rc = createRevenueCat(fakePlugin().plugin, 'goog_test');
  assert.deepEqual(await rc.restore(), { kind: 'purchased' });
  rc = createRevenueCat(fakePlugin({ restorePurchases: async () => ({ customerInfo: none }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.restore(), { kind: 'nothing-to-restore' });
  rc = createRevenueCat(fakePlugin({ restorePurchases: async () => Promise.reject({ code: '10' }) }).plugin, 'goog_test');
  assert.deepEqual(await rc.restore(), { kind: 'offline' });
});

test('check and live updates: refunds and completed pending payments reach the app', async () => {
  const f = fakePlugin({ getCustomerInfo: async () => Promise.reject({ code: '10' }) });
  const rc = createRevenueCat(f.plugin, 'goog_test');
  assert.deepEqual(await rc.check(), { kind: 'unknown' }); // offline: unknown, so nothing changes
  const seen: string[] = [];
  rc.onChange((c) => seen.push(c.kind));
  await rc.init();
  f.emit(active);
  f.emit(none);
  assert.deepEqual(seen, ['active', 'inactive']);
});

test('web build: no billing, nothing to buy, nothing changes', async () => {
  assert.equal(noBilling.canPurchase, false);
  assert.deepEqual(await noBilling.purchase(), { kind: 'unavailable', reason: 'web' });
  assert.deepEqual(await noBilling.check(), { kind: 'unknown' });
});
