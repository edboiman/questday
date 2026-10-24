import '../flags';
import { createRevenueCat, nativePurchases } from './revenuecat';
import { noBilling, type BillingProvider } from './types';

/** The billing provider for this build. Web builds have none; the Android app uses RevenueCat. */
export function createBilling(): BillingProvider {
  return __QA_TARGET__ === 'android' ? createRevenueCat(nativePurchases(), __QA_RC_KEY__) : noBilling;
}

export * from './types';
