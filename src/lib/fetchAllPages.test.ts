import { describe, it, expect, vi } from "vitest";
import { fetchAllPages } from "./fetchAllPages";

const pagedSource = (rows: number[]) =>
  vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1),
    error: null,
  }));

describe("fetchAllPages", () => {
  it("returns a single short page with one request", async () => {
    const query = pagedSource([1, 2, 3]);
    const result = await fetchAllPages(query, 10);
    expect(result).toEqual([1, 2, 3]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(0, 9);
  });

  it("concatenates pages in order until a short page arrives", async () => {
    const query = pagedSource([1, 2, 3, 4, 5]);
    const result = await fetchAllPages(query, 2);
    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenNthCalledWith(2, 2, 3);
    expect(query).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it("requests one extra page when the total is an exact multiple", async () => {
    const query = pagedSource([1, 2, 3, 4]);
    const result = await fetchAllPages(query, 2);
    expect(result).toEqual([1, 2, 3, 4]);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("returns empty array for an empty table", async () => {
    const query = pagedSource([]);
    expect(await fetchAllPages(query, 2)).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("treats null data as an empty page", async () => {
    const query = vi.fn(async () => ({ data: null, error: null }));
    expect(await fetchAllPages(query, 2)).toEqual([]);
  });

  it("throws the supabase error object when a page fails", async () => {
    const boom = { message: "RLS says no" };
    const query = vi.fn(async () => ({ data: null, error: boom }));
    await expect(fetchAllPages(query, 2)).rejects.toBe(boom);
  });
});
