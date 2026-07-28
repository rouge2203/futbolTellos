import { describe, it, expect } from "vitest";
import { formatSinpe, isValidSinpe, normalizeSinpe } from "./sinpe";

describe("normalizeSinpe", () => {
  it("keeps a plain 8-digit number", () => {
    expect(normalizeSinpe("86167000")).toBe("86167000");
  });

  it("strips separators", () => {
    expect(normalizeSinpe("6180-8040")).toBe("61808040");
    expect(normalizeSinpe("6180 8030")).toBe("61808030");
  });

  it("drops a leading 506 country code instead of truncating to a wrong number", () => {
    // The dangerous case: naive slice(0,8) would yield "50686167".
    expect(normalizeSinpe("+506 8616-7000")).toBe("86167000");
    expect(normalizeSinpe("50661808040")).toBe("61808040");
  });

  it("does not strip 506 when it is the actual start of an 8-digit number", () => {
    expect(normalizeSinpe("50612345")).toBe("50612345");
  });
});

describe("isValidSinpe", () => {
  it("accepts the three real cuentas", () => {
    expect(isValidSinpe("86167000")).toBe(true); // Kathia Salas
    expect(isValidSinpe("61808040")).toBe(true); // Sebastián Tello
    expect(isValidSinpe("61808030")).toBe(true); // José Tello
  });

  it("rejects missing, short, long and non-mobile values", () => {
    expect(isValidSinpe(null)).toBe(false);
    expect(isValidSinpe(undefined)).toBe(false);
    expect(isValidSinpe("")).toBe(false);
    expect(isValidSinpe("6180804")).toBe(false);
    expect(isValidSinpe("618080401")).toBe(false);
    expect(isValidSinpe("6180-8040")).toBe(false); // must already be normalized
    expect(isValidSinpe("50686167")).toBe(false); // country-code truncation
    expect(isValidSinpe("22334455")).toBe(false); // landline, not SINPE Móvil
  });
});

describe("formatSinpe", () => {
  it("formats for display", () => {
    expect(formatSinpe("86167000")).toBe("8616-7000");
    expect(formatSinpe("61808040")).toBe("6180-8040");
    expect(formatSinpe("61808030")).toBe("6180-8030");
  });

  it("returns empty string rather than a partial number", () => {
    expect(formatSinpe(null)).toBe("");
    expect(formatSinpe(undefined)).toBe("");
    expect(formatSinpe("")).toBe("");
    expect(formatSinpe("618")).toBe("");
    expect(formatSinpe("22334455")).toBe("");
  });

  it("is idempotent on already-formatted input", () => {
    expect(formatSinpe("8616-7000")).toBe("8616-7000");
  });
});
