/**
 * The catalogue counts two share cards print: how many conferences a visitor
 * can actually find, and in how many countries.
 *
 * Shared by the homepage card (`/api/og/home/[v]`) and the explore card
 * (`/api/og/explore/[v]`). It lives here rather than in either route because a
 * Next route file may only export its handlers and route config.
 *
 * "Public and not already finished" is the same rule the browse surfaces apply
 * (`hasConcluded`), so a card can never advertise a bigger catalogue than
 * `/conferences/explore` shows. Counting happens in JS because supabase-js has
 * no `count(distinct ...)`; the table is low hundreds of rows and two short
 * columns, cheaper than an RPC round trip.
 *
 * TWO GUARDS, BOTH FOR THE SCRAPER'S BUDGET. WhatsApp gives a link a short
 * window and does not retry well, and a card that times out is a preview with
 * no picture at all.
 *  - A hard timeout. A slow query resolves to `null` and the card draws its
 *    static line instead of making the scraper wait.
 *  - A per-instance memo. The counts move over days, the card URL rotates
 *    daily, and a warm lambda should not query twice for the same answer.
 *    Failures are not memoised, so the next request tries again.
 */
import { hasConcluded } from '@/lib/conferenceDates';
import { supabase } from '@/lib/supabase';

export interface ListingCounts {
  conferences: number;
  countries: number;
}

const TIMEOUT_MS = 1500;
const MEMO_MS = 60 * 60 * 1000;

let memo: { at: number; value: ListingCounts } | null = null;

async function queryCounts(): Promise<ListingCounts | null> {
  const { data, error } = await supabase
    .from('conferences')
    .select('country, start_date, end_date')
    .eq('is_public', true);
  // supabase-js resolves on an error rather than throwing; treat it as "no counts".
  if (error || !data) return null;

  const live = (data as Array<{ country: string | null; start_date: string | null; end_date: string | null }>)
    .filter((row) => !hasConcluded(row));

  const countries = new Set(
    live.map((row) => (row.country ?? '').trim().toLowerCase()).filter(Boolean),
  );

  return { conferences: live.length, countries: countries.size };
}

export async function loadListingCounts(): Promise<ListingCounts | null> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      queryCounts(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
    // Zero is a real answer only in theory; printing "0 conferences" on a share
    // card is wrong in practice and off-putting either way.
    if (!value || value.conferences === 0) return null;
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Pluralise without dragging in Intl for two words. Explicit plural form
 *  rather than a suffix rule: "country" is exactly the case `+ 's'` gets wrong. */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
