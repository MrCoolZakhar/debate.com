/**
 * GET /api/og/home/[v]  →  the homepage share card, with live counts.
 *
 * The same versioned-URL trick as the conference card, for the same reason:
 * `/og-image.jpg` has been the homepage card since launch, so every scraper
 * that has ever seen gavelling.com is holding those exact bytes forever. A
 * dated `[v]` segment gives the homepage a card that can actually change, and
 * lets it say something true today — how many conferences are listed and how
 * many countries they run in — rather than a fixed graphic that ages.
 *
 * Daily rotation is the right cadence here: those two numbers move slowly, and
 * a per-request token would mean re-rendering for every scrape.
 *
 * NOTE: this route does not replace `/og-image.jpg`; that file stays for any
 * consumer already referencing it. Wire it in via `homeOgImageUrl()` in
 * `src/lib/ogVersion.ts` if and when you want the homepage on it.
 *
 * Node runtime for the same reason as the conference card — `sharp`.
 */
import { hasConcluded } from '@/lib/conferenceDates';
import { supabase } from '@/lib/supabase';
import { versionToken } from '@/lib/ogVersion';
import { CardShell, type CardChip, renderCard } from '../../_shared/card';

export const runtime = 'nodejs';

interface Counts {
  conferences: number;
  countries: number;
}

/**
 * The counts as a visitor would meet them: public, and not already finished.
 *
 * That "not finished" clause matters — it is the same rule the browse surfaces
 * apply (`hasConcluded`), so the card cannot advertise a bigger catalogue than
 * `/conferences/explore` actually shows. Counting is done here rather than in
 * SQL because supabase-js has no `count(distinct …)`; the table is small
 * enough (low hundreds of rows, two short columns) that this is a cheaper
 * round trip than adding an RPC.
 */
async function loadCounts(): Promise<Counts | null> {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('country, start_date, end_date')
      .eq('is_public', true);
    if (!data) return null;

    const live = (data as Array<{ country: string | null; start_date: string | null; end_date: string | null }>)
      .filter((row) => !hasConcluded(row));

    const countries = new Set(
      live.map((row) => (row.country ?? '').trim().toLowerCase()).filter(Boolean),
    );

    return { conferences: live.length, countries: countries.size };
  } catch {
    return null;
  }
}

/** Pluralise without dragging in Intl for two words. Explicit plural form
 *  rather than a suffix rule — "country" is exactly the case a naive `+ 's'`
 *  gets wrong. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ v: string }> },
): Promise<Response> {
  const { v } = await params;
  const counts = await loadCounts();

  // No counts is not a failure worth showing: the card falls back to the plain
  // wordmark line rather than printing "0 conferences", which would be both
  // wrong and actively off-putting.
  //
  // One chip per count, matching the conference card's date/place split — two
  // separate facts read as two facts, where a joined line reads as a caption.
  const chips: CardChip[] = counts
    ? [
        { label: plural(counts.conferences, 'conference', 'conferences') },
        { label: plural(counts.countries, 'country', 'countries') },
      ]
    : [{ label: 'gavelling.com' }];

  const res = await renderCard(
    <CardShell
      backdrop={null}
      logo={null}
      // NOT "Gavelling". The shell already signs every card with the mark and
      // wordmark bottom-right, and a headline repeating it reads as a bug
      // rather than as branding. The headline's job is to say what the site is
      // for; the brand row says whose it is.
      headline="Find your next MUN"
      subhead="Conferences, applications and committee software — all in one place."
      chips={chips}
    />,
  );

  res.headers.set('X-Og-Version', versionToken(v));
  res.headers.set('X-Og-Source', counts ? 'live-counts' : 'static');
  return res;
}
