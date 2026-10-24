import { ENTITLEMENT_ID, PRODUCT_ID, type BillingProvider, type EntitlementCheck, type Offer, type PurchaseOutcome } from './types';

/*
 * RevenueCat adapter for the Android (Capacitor) app.
 *
 * The plugin is the official `@revenuecat/purchases-capacitor`, installed in
 * android-app/. We reach it through Capacitor's bridge
 * (`Capacitor.registerPlugin('Purchases')`), which is exactly what the npm
 * package's JS does, so the web bundle needs no extra dependency.
 *
 * Only the RevenueCat *public* SDK key ships in the app (by design). Purchases
 * are validated by Google and RevenueCat's servers, never by this code.
 *
 * Error codes follow RevenueCat's PURCHASES_ERROR_CODE. Re-check them against
 * the plugin's TypeScript definitions when upgrading (docs/BILLING.md).
 */

interface Entitlement {
  isActive?: boolean;
  expirationDate?: string | null;
}
interface CustomerInfo {
  entitlements?: { active?: Record<string, Entitlement | undefined> };
}
interface Pkg {
  identifier?: string;
  product?: { identifier?: string; priceString?: string };
}
interface Offerings {
  current?: { availablePackages?: Pkg[] } | null;
}
export interface PurchasesPlugin {
  configure(options: { apiKey: string; appUserID?: string | null }): Promise<void>;
  getOfferings(): Promise<Offerings>;
  purchasePackage(options: { aPackage: Pkg }): Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases(): Promise<{ customerInfo: CustomerInfo }>;
  getCustomerInfo(): Promise<{ customerInfo: CustomerInfo }>;
  addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): Promise<string>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  registerPlugin?: <T>(name: string) => T;
}

/** The native plugin, or null when not running inside the Android app. */
export function nativePurchases(): PurchasesPlugin | null {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.registerPlugin) return null;
  return cap.registerPlugin<PurchasesPlugin>('Purchases');
}

/** Whether Premium is active in a RevenueCat CustomerInfo. Expired or missing entitlements count as inactive. */
export function premiumActive(info: CustomerInfo | undefined, now: number = Date.now()): boolean {
  const e = info?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!e || e.isActive === false) return false;
  // Lifetime purchases have no expiry. A past expiry (e.g. a future subscription that lapsed) is not active.
  if (e.expirationDate && Date.parse(e.expirationDate) <= now) return false;
  return true;
}

type ErrorKind = 'cancelled' | 'pending' | 'offline' | 'already-owned' | 'unavailable' | 'error';

const CODES: Record<string, ErrorKind> = {
  '1': 'cancelled', // PURCHASE_CANCELLED_ERROR
  '2': 'error', // STORE_PROBLEM_ERROR
  '3': 'unavailable', // PURCHASE_NOT_ALLOWED_ERROR (e.g. parental controls, no Play account)
  '5': 'unavailable', // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  '6': 'already-owned', // PRODUCT_ALREADY_PURCHASED_ERROR
  '10': 'offline', // NETWORK_ERROR
  '20': 'pending', // PAYMENT_PENDING_ERROR
  '23': 'unavailable', // CONFIGURATION_ERROR
  '35': 'offline', // OFFLINE_CONNECTION_ERROR
};

/** Turns a RevenueCat/Capacitor error into one of a few user-meaningful outcomes. */
export function classify(err: unknown): ErrorKind {
  const e = (err ?? {}) as { code?: unknown; userCancelled?: unknown; message?: unknown; data?: { userCancelled?: unknown; code?: unknown } };
  if (e.userCancelled === true || e.data?.userCancelled === true) return 'cancelled';
  const code = String(e.code ?? e.data?.code ?? '');
  if (CODES[code]) return CODES[code]!;
  const text = String(e.message ?? '').toLowerCase();
  if (/cancel/.test(text)) return 'cancelled';
  if (/pending/.test(text)) return 'pending';
  if (/network|offline|internet|connection/.test(text)) return 'offline';
  if (/already (owned|purchased)/.test(text)) return 'already-owned';
  if (/not available|billing.*unavailable|configuration/.test(text)) return 'unavailable';
  return 'error';
}

const UNAVAILABLE = 'Google Play purchases aren’t available on this device right now. Check that the Play Store app is installed and signed in.';

export function createRevenueCat(plugin: PurchasesPlugin | null, apiKey: string): BillingProvider {
  let ready: Promise<boolean> | null = null;
  let busy = false;
  const listeners = new Set<(c: EntitlementCheck) => void>();

  const init = (): Promise<boolean> => {
    if (!ready) {
      ready = (async () => {
        if (!plugin || !apiKey) return false;
        try {
          await plugin.configure({ apiKey });
          await plugin.addCustomerInfoUpdateListener((info) => {
            const check: EntitlementCheck = { kind: premiumActive(info) ? 'active' : 'inactive' };
            for (const fn of listeners) fn(check);
          });
          return true;
        } catch {
          ready = null; // allow a retry later (e.g. Play Services updating)
          return false;
        }
      })();
    }
    return ready;
  };

  const findPackage = async (): Promise<Pkg | null> => {
    const offerings = await plugin!.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    return pkgs.find((p) => p.product?.identifier === PRODUCT_ID) ?? pkgs[0] ?? null;
  };

  const fromError = (err: unknown): PurchaseOutcome => {
    switch (classify(err)) {
      case 'cancelled':
        return { kind: 'cancelled' };
      case 'pending':
        return { kind: 'pending' };
      case 'offline':
        return { kind: 'offline' };
      case 'already-owned':
        return { kind: 'purchased' }; // they own it: treat as success and unlock
      case 'unavailable':
        return { kind: 'unavailable', reason: UNAVAILABLE };
      default:
        return { kind: 'error', message: 'Google Play couldn’t complete that. You were not charged. Please try again.' };
    }
  };

  return {
    name: 'revenuecat',
    get canPurchase() {
      return Boolean(plugin && apiKey);
    },
    init: async () => void (await init()),
    async offer(): Promise<Offer | null> {
      if (!(await init())) return null;
      try {
        const pkg = await findPackage();
        return pkg?.product?.priceString ? { priceString: pkg.product.priceString } : null;
      } catch {
        return null;
      }
    },
    async purchase(): Promise<PurchaseOutcome> {
      if (busy) return { kind: 'error', message: 'A purchase is already in progress.' };
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
      busy = true; // set before any await, so a double tap can't start two purchases
      try {
        if (!(await init())) return { kind: 'unavailable', reason: UNAVAILABLE };
        const pkg = await findPackage();
        if (!pkg) return { kind: 'unavailable', reason: 'Premium isn’t available in your country’s Play Store yet.' };
        const { customerInfo } = await plugin!.purchasePackage({ aPackage: pkg });
        return premiumActive(customerInfo) ? { kind: 'purchased' } : { kind: 'pending' };
      } catch (err) {
        return fromError(err);
      } finally {
        busy = false;
      }
    },
    async restore(): Promise<PurchaseOutcome> {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
      if (!(await init())) return { kind: 'unavailable', reason: UNAVAILABLE };
      try {
        const { customerInfo } = await plugin!.restorePurchases();
        return premiumActive(customerInfo) ? { kind: 'purchased' } : { kind: 'nothing-to-restore' };
      } catch (err) {
        const out = fromError(err);
        return out.kind === 'cancelled' ? { kind: 'nothing-to-restore' } : out;
      }
    },
    async check(): Promise<EntitlementCheck> {
      if (!(await init())) return { kind: 'unknown' };
      try {
        const { customerInfo } = await plugin!.getCustomerInfo();
        return { kind: premiumActive(customerInfo) ? 'active' : 'inactive' };
      } catch {
        return { kind: 'unknown' };
      }
    },
    onChange(listener) {
      listeners.add(listener);
    },
  };
}
