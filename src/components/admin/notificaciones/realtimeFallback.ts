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
