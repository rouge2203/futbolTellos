// Supabase Realtime cannot reach production. `VITE_SUPABASE_URL` is "/sb" there,
// so the client dials wss://futboltello.com/sb/realtime/v1/websocket, and Vercel
// rewrites do not proxy websocket upgrades — the channel retries forever and
// never reports SUBSCRIBED. Pointing the env var back at the absolute
// supabase.co URL would fix the socket but re-key the stored session
// (supabase-js derives `sb-<hostname-first-label>-auth-token` from the URL) and
// sign every admin out, so the bell falls back to polling instead.

export const NOTIFICACIONES_POLL_MS = 20_000;

export type ChannelStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

/**
 * Whether the bell has to fetch on a timer. `null` means the channel has not
 * reported yet, which is the steady state in production. A hidden tab never
 * polls; the hook refetches once on the way back to visible instead.
 */
export function shouldPollNotificaciones(
  status: ChannelStatus | null,
  hidden: boolean,
): boolean {
  if (hidden) return false;
  return status !== "SUBSCRIBED";
}

/**
 * Whether opening a Realtime channel is worth attempting, given the raw
 * `VITE_SUPABASE_URL`. A relative value means requests are proxied same-origin
 * through the vercel.json rewrite, which cannot upgrade a websocket — the
 * client would retry the handshake forever and fill the console. An absolute
 * URL reaches Supabase directly, as it does in local dev, so the socket works.
 *
 * This reads the raw env value on purpose: `src/lib/supabase.ts` resolves a
 * relative value against `window.location.origin`, which hides the difference.
 */
export function realtimeCanConnect(
  rawSupabaseUrl: string | undefined,
): boolean {
  if (!rawSupabaseUrl) return false;
  return !rawSupabaseUrl.startsWith("/");
}
