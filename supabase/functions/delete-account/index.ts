// POST /functions/v1/delete-account
//
// Permanently deletes the caller's account. Every table references auth.users
// with ON DELETE CASCADE, so the profile, synced records and entitlements go
// with it (tested in supabase/tests/10_rls.sql). Google Play requires apps with
// accounts to offer this in-app and on the web; GDPR calls it the right to erasure.
// Data on the phone itself stays until the user clears it in Settings.
//
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { callerId, env, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'sign in first' });
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) return json(502, { error: 'could not delete the account right now; please try again' });
  return json(200, { deleted: true });
});
