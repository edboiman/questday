/*
 * Build flags, replaced at build time by esbuild `define`:
 *   store build (dist/):              __QA_ADMIN__ = false  → admin code is removed from the bundle
 *   personal build (dist-personal/):  __QA_ADMIN__ = true   → admin tools for your own testing copy
 * Unit tests run with it set to true (scripts/test-env.mjs) so admin paths are testable.
 */
declare global {
  /** Build-time constant. Use it directly in `if`/ternaries around admin-only code so esbuild deletes that code. */
  const __QA_ADMIN__: boolean;
  /** Build target: 'web' (GitHub Pages / browser) or 'android' (Capacitor app from Google Play). */
  const __QA_TARGET__: 'web' | 'android';
  /** RevenueCat public Android SDK key (starts with "goog_"); empty outside the Android build. Public by design. */
  const __QA_RC_KEY__: string;
}

// A plain constant, so esbuild can inline it and delete admin-only code from the store build.
export const ADMIN_BUILD: boolean = __QA_ADMIN__;

export const ANDROID_BUILD: boolean = __QA_TARGET__ === 'android';
