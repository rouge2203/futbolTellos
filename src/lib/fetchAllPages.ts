interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

// PostgREST caps every response at 1000 rows (silently — this froze the
// tienda stock for a month). Any select that can grow past that must go
// through here. The query MUST have a deterministic ORDER BY (add id as
// tiebreaker) or rows can repeat/vanish across page boundaries.
export async function fetchAllPages<T>(
  makePageQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makePageQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}
