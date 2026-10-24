// POST /functions/v1/verify-purchase   body: { "purchaseToken": "..." }
//
// Called by the app after Google Play Billing reports a successful purchase of
// the one-time "premium_unlock" product. The app's word is never trusted:
// this function asks Google whether the purchase is real, paid and for this
// app, then records the entitlement with the service role (users cannot write
// entitlements themselves; see the RLS policy). A purchase token can only ever
// unlock one account (unique constraint on its hash).
//
// Secrets (supabase secrets set ...): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY, PLAY_PACKAGE_NAME, PLAY_SERVICE_ACCOUNT_JSON
// (a Google Cloud service account with "View financial data" + "Manage orders" in Play Console).

import { callerId, db, env, json, sha256Hex } from '../_shared/http.ts';

const PRODUCT_ID = 'premium_unlock';

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** OAuth access token for the Play Developer API, from a service-account key (RS256 JWT bearer flow). */
async function googleAccessToken(): Promise<string> {
  const sa = JSON.parse(env('PLAY_SERVICE_ACCOUNT_JSON')) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error('google auth failed');
  return ((await res.json()) as { access_token: string }).access_token;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'sign in first' });

  let token: unknown;
  try {
    token = ((await req.json()) as { purchaseToken?: unknown }).purchaseToken;
  } catch {
    return json(400, { error: 'bad request' });
  }
  if (typeof token !== 'string' || !/^[A-Za-z0-9._-]{10,4096}$/.test(token)) return json(400, { error: 'bad request' });

  try {
    const pkg = encodeURIComponent(env('PLAY_PACKAGE_NAME'));
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/products/${PRODUCT_ID}/tokens/${encodeURIComponent(token)}`;
    const access = await googleAccessToken();
    const res = await fetch(base, { headers: { authorization: `Bearer ${access}` } });
    if (!res.ok) return json(402, { error: 'purchase not found' });
    const purchase = (await res.json()) as { purchaseState?: number; acknowledgementState?: number; orderId?: string; obfuscatedExternalAccountId?: string };
    // 0 = purchased (1 = cancelled, 2 = pending).
    if (purchase.purchaseState !== 0) return json(402, { error: 'purchase not completed' });
    // The app passes a hash of the user id as obfuscatedAccountId when starting the purchase,
    // so a token bought by one account cannot be redeemed by another.
    if (purchase.obfuscatedExternalAccountId && purchase.obfuscatedExternalAccountId !== (await sha256Hex(userId)).slice(0, 64)) {
      return json(403, { error: 'purchase belongs to another account' });
    }

    const tokenHash = await sha256Hex(token);
    const write = await db('/rest/v1/entitlements?on_conflict=user_id,product_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, product_id: PRODUCT_ID, token_sha256: tokenHash, order_id: purchase.orderId?.slice(0, 100) ?? null, status: 'active', updated_at: new Date().toISOString() }),
    });
    if (write.status === 409) return json(409, { error: 'purchase already used by another account' });
    if (!write.ok) throw new Error('entitlement write failed');

    // Google refunds unacknowledged purchases after 3 days, so acknowledge once the entitlement is stored.
    if (purchase.acknowledgementState === 0) {
      await fetch(`${base}:acknowledge`, { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: '{}' });
    }
    return json(200, { premium: true });
  } catch {
    return json(502, { error: 'could not verify the purchase right now; please try again' });
  }
});
