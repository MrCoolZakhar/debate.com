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
import { versionToken } from '@/lib/ogVersion';
import { CardShell, type CardChip, renderCard } from '../../_shared/card';
import { loadListingCounts, plural } from '../../_shared/counts';

export const runtime = 'nodejs';

// The counts (public, not yet finished, with a timeout and a warm-instance
// memo) live in `_shared/counts.ts`, shared with the explore card so the two
// can never disagree about the size of the catalogue.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ v: string }> },
): Promise<Response> {
  const { v } = await params;
  const counts = await loadListingCounts();

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
