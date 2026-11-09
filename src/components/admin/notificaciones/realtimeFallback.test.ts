import { describe, it, expect } from "vitest";
import {
  shouldPollNotificaciones,
  NOTIFICACIONES_POLL_MS,
} from "./realtimeFallback";

describe("notificaciones polling fallback", () => {
  it("polls when the channel never reached SUBSCRIBED", () => {
    // Production dials wss://futboltello.com/sb/... through a Vercel rewrite,
    // which does not proxy websocket upgrades, so the status stays null.
    expect(shouldPollNotificaciones(null, false)).toBe(true);
  });

  it("does not poll while the channel is live", () => {
    expect(shouldPollNotificaciones("SUBSCRIBED", false)).toBe(false);
  });

  it("polls after a channel error", () => {
    expect(shouldPollNotificaciones("CHANNEL_ERROR", false)).toBe(true);
  });

  it("polls after the channel times out", () => {
    expect(shouldPollNotificaciones("TIMED_OUT", false)).toBe(true);
  });

  it("polls after the channel closes", () => {
    expect(shouldPollNotificaciones("CLOSED", false)).toBe(true);
  });

  it("stays quiet behind a hidden tab even with a dead channel", () => {
    // An admin panel left open overnight must not keep querying.
    expect(shouldPollNotificaciones("CHANNEL_ERROR", true)).toBe(false);
    expect(shouldPollNotificaciones(null, true)).toBe(false);
  });

  it("polls often enough to be useful but not every second", () => {
    expect(NOTIFICACIONES_POLL_MS).toBeGreaterThanOrEqual(10_000);
    expect(NOTIFICACIONES_POLL_MS).toBeLessThanOrEqual(60_000);
  });
});
