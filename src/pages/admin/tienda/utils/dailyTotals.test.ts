import { describe, it, expect } from "vitest";
import { getCostaRicaDayKey } from "./dailyTotals";

describe("getCostaRicaDayKey", () => {
  it("returns the CR calendar day for a CR-offset timestamp", () => {
    expect(getCostaRicaDayKey("2026-06-02T23:30:00-06:00")).toBe("2026-06-02");
  });

  it("returns the previous CR day for a late-night UTC timestamp", () => {
    // 2026-06-03 04:30 UTC === 2026-06-02 22:30 in Costa Rica
    expect(getCostaRicaDayKey("2026-06-03T04:30:00Z")).toBe("2026-06-02");
  });

  it("handles midnight at CR offset", () => {
    expect(getCostaRicaDayKey("2026-06-02T00:00:00-06:00")).toBe("2026-06-02");
  });
});
