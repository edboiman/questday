// POST /functions/v1/revenuecat-webhook
//
// RevenueCat calls this when a purchase, refund or revocation happens, so the
// signed-in player's Premium is mirrored into `entitlements` (for sync and new
// devices). The app already unlocks on-device straight from Google Play via
// RevenueCat; this is the server-side record. Idempotent: the same event can
// arrive more than once.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVENUECAT_WEBHOOK_AUTH
// (the exact Authorization header value you set in RevenueCat → Integrations → Webhooks).
//
// The app sets RevenueCat's app_user_id to the Supabase user id when someone
// signs in (Purchases.logIn). Anonymous buyers ($RCAnonymousID:…) have no
// account row to update, so their events are acknowledged and skipped.

import { db, env, json, sha256Hex } from '../_shared/http.ts';

const GRANT = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'TRANSFER']);
const REFUND = new Set(['CANCELLATION']); // for one-time products, a cancellation is a refund
const REVOKE = new Set(['EXPIRATION']);

/** Constant-time comparison, so the secret can't be guessed byte by byte from response timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

interface RcEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  transaction_id?: string;
  original_transaction_id?: string;
  store?: string;
  environment?: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!sameSecret(req.headers.get('authorization') ?? '', env('REVENUECAT_WEBHOOK_AUTH'))) return json(401, { error: 'unauthorized' });

  let event: RcEvent;
  try {
    const body = (await req.json()) as { event?: RcEvent };
    if (!body.event || typeof body.event !== 'object') return json(400, { error: 'bad request' });
    event = body.event;
  } catch {
    return json(400, { error: 'bad request' });
  }

  const type = String(event.type ?? '');
  const user = String(event.app_user_id ?? '');
  const forPremium = (event.entitlement_ids ?? []).includes('premium') || event.product_id === 'premium_unlock';
  // Only real accounts, only our product, only known event types. Everything else: acknowledge and ignore.
  if (!forPremium || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(user) || !(GRANT.has(type) || REFUND.has(type) || REVOKE.has(type))) {
    return json(200, { ignored: true });
  }
  if (event.environment === 'SANDBOX' && Deno.env.get('ALLOW_SANDBOX') !== 'true') return json(200, { ignored: 'sandbox' });

  const txn = String(event.original_transaction_id ?? event.transaction_id ?? '');
  if (!/^[A-Za-z0-9._:-]{4,200}$/.test(txn)) return json(400, { error: 'bad request' });

  try {
    const status = GRANT.has(type) ? 'active' : REFUND.has(type) ? 'refunded' : 'revoked';
    const write = await db('/rest/v1/entitlements?on_conflict=user_id,product_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: user, product_id: 'premium_unlock', token_sha256: await sha256Hex(txn), order_id: txn.slice(0, 100), status, updated_at: new Date().toISOString() }),
    });
    // 409: this transaction already belongs to another account. Don't move it; RevenueCat will not retry a 200.
    if (write.status === 409) return json(200, { ignored: 'transaction belongs to another account' });
    // 23503: the user was deleted. Nothing to record.
    if (!write.ok && write.status !== 409) {
      const text = await write.text();
      if (text.includes('23503')) return json(200, { ignored: 'no such user' });
      return json(500, { error: 'retry later' }); // non-2xx makes RevenueCat retry
    }
    return json(200, { ok: true, status });
  } catch {
    return json(500, { error: 'retry later' });
  }
});
