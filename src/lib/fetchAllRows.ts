// PostgREST answers at most 1,000 rows per request (the project's max-rows),
// and it does so SILENTLY: a conference with 1,300 applications used to show
// 1,000 and nothing said the rest were missing. fetchAllRows pages through a
// query with .range() until a short page comes back.
//
// `build` must return a FRESH query each call (a supabase query builder is
// single-use) with a deterministic order, ending in a unique column, so pages
// never overlap or skip a row.

export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PageResult<T>,
  opts: { maxPages?: number } = {},
): Promise<{ data: T[]; error: unknown }> {
  const maxPages = opts.maxPages ?? 100;
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: out, error };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { data: out, error: null };
}

/** Split a list into chunks, for `.in()` filters that would otherwise build a
 *  URL too long for the gateway. */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
