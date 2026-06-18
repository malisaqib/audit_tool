// Server-side Supabase client. Uses the service-role key, which must NEVER be
// exposed to the browser — these env vars have no NEXT_PUBLIC_ prefix and this
// module is only imported by server actions.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  // URL is not secret, so accept the NEXT_PUBLIC_ name too for convenience.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Key MUST be a server-side secret (service-role / "secret" key). We do NOT
  // read a NEXT_PUBLIC_ / publishable key here — that key can't bypass RLS and
  // shouldn't be trusted for writes.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the secret key) to .env.local and restart the dev server."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
