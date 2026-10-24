// Shared helpers for QuestAday edge functions (Deno, Supabase Edge Runtime).
// No third-party imports: only fetch and WebCrypto, so there is nothing to audit but this file.

export const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env ${name}`);
  return value;
};

/** JSON response. Errors never echo request content or internals back to the caller. */
export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

/**
 * Resolves the caller's user id from their Supabase access token by asking
 * Supabase Auth itself (so expired, forged or revoked tokens are rejected).
 */
export async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(auth)) return null;
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { authorization: auth, apikey: env('SUPABASE_ANON_KEY') },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: unknown };
  return typeof user.id === 'string' && /^[0-9a-f-]{36}$/.test(user.id) ? user.id : null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Service-role call to the database REST API. Only used server-side; the key never reaches the app. */
export function db(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}
