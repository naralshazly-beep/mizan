import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server jobs that run without a signed-in user
 * (the daily watch job and the WhatsApp webhook). Never import this from
 * client components. Needs SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
