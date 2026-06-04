/**
 * Returns the Costa Rica (UTC-6, no DST) calendar day for an ISO timestamp,
 * formatted as YYYY-MM-DD. en-CA locale yields ISO-style date parts.
 */
export function getCostaRicaDayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    timeZone: "America/Costa_Rica",
  });
}
