/*
 * Billing: the one-time "QuestAday Premium" unlock.
 *
 * The app talks to a BillingProvider. In the Android app that is RevenueCat
 * (Google Play Billing underneath); in the web version there is no provider
 * and the paywall explains that Premium is bought in the Play Store app.
 */

/** RevenueCat entitlement id and Google Play product id. Keep in sync with the dashboards (docs/BILLING.md). */
export const ENTITLEMENT_ID = 'premium';
export const PRODUCT_ID = 'premium_unlock';

export interface Offer {
  /** Localised price from Google Play, e.g. "$0.99" or "0,99 €". */
  priceString: string;
}

export type PurchaseOutcome =
  | { kind: 'purchased' }
  /** Restore found nothing to restore. */
  | { kind: 'nothing-to-restore' }
  /** The person closed the Google Play sheet. Not an error: say nothing. */
  | { kind: 'cancelled' }
  /** Payment is pending (e.g. cash at a shop). Premium unlocks when Google confirms. */
  | { kind: 'pending' }
  | { kind: 'offline' }
  /** Billing can't run here: web version, no Google Play on the device, store disabled, product not set up. */
  | { kind: 'unavailable'; reason: string }
  | { kind: 'error'; message: string };

/**
 * Result of asking the store whether Premium is owned.
 * `unknown` means the store could not be reached: keep whatever this device last knew.
 */
export type EntitlementCheck = { kind: 'active' } | { kind: 'inactive' } | { kind: 'unknown' };

export interface BillingProvider {
  readonly name: 'revenuecat' | 'none';
  /** True when purchases can be attempted in this build. */
  readonly canPurchase: boolean;
  init(): Promise<void>;
  offer(): Promise<Offer | null>;
  purchase(): Promise<PurchaseOutcome>;
  restore(): Promise<PurchaseOutcome>;
  check(): Promise<EntitlementCheck>;
  /** Called when the store reports a change on its own (pending payment completed, refund). */
  onChange(listener: (check: EntitlementCheck) => void): void;
}

/** The web/GitHub version: no payments here. */
export const noBilling: BillingProvider = {
  name: 'none',
  canPurchase: false,
  init: async () => undefined,
  offer: async () => null,
  purchase: async () => ({ kind: 'unavailable', reason: 'web' }),
  restore: async () => ({ kind: 'unavailable', reason: 'web' }),
  check: async () => ({ kind: 'unknown' }),
  onChange: () => undefined,
};
