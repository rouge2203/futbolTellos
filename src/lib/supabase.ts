import { createClient } from "@supabase/supabase-js";

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!envSupabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

// If VITE_SUPABASE_URL is a relative path (e.g. "/sb"), resolve it against the
// current origin at runtime. This keeps requests same-origin regardless of
// whether the user landed on the apex or the www subdomain, avoiding CORS
// preflight redirects that browsers refuse to follow.
const supabaseUrl = envSupabaseUrl.startsWith("/")
  ? `${window.location.origin}${envSupabaseUrl}`
  : envSupabaseUrl;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isReservaConflictError(error: any): boolean {
  return error?.code === "23505";
}
