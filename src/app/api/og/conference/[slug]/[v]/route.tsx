/**
 * GET /api/og/conference/[slug]/[v]  →  the conference's 1200x630 share card.
 *
 * WHAT `[v]` IS FOR
 *
 * Nothing, as far as rendering is concerned. It is read, logged into a response
 * header for debugging, and otherwise thrown away.
 *
 * Its entire job is to make the URL change. WhatsApp, iMessage and Facebook
 * cache a link's preview image against the image URL and do not revalidate, so
 * while `og:image` pointed at the organiser's fixed storage URL, every link
 * already pasted into a group chat kept showing the banner as it was the first
 * time anyone shared it. Changing the bytes at a stable URL does not help;
 * only a new URL does. `ogVersion()` in `src/lib/ogVersion.ts` mints that
 * segment from the row's visible fields plus the card design version (no date since 6 Oct 2026). See that file for why
 * `conferences.updated_at` is not the answer.
 *
 * Because the URL is versioned, the response is safe to mark `immutable` for a
 * year — the old token is never asked to render anything new.
 *
 * RUNTIME: Node, not edge. The card pipeline decodes organiser WebP uploads and
 * re-encodes the finished PNG as JPEG through `sharp`, a native module the edge
 * runtime cannot load. Do not "optimise" this to `runtime = 'edge'`; the visible
 * result is banners silently vanishing from the cards again.
 */
import { conferenceLabels } from '@/lib/conferenceLabels';
import { formatConferenceDates } from '@/lib/conferenceDates';
import { supabase } from '@/lib/supabase';
import { versionToken } from '@/lib/ogVersion';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CardShell,
  type CardChip,
  clampToTwoLines,
  fallbackCard,
  renderCard,
} from '../../../_shared/card';
import { loadBannerDataUri, loadFlagDataUri, loadLogo } from '../../../_shared/remoteImage';

export const runtime = 'nodejs';

interface ConfCard {
  full_name: string | null;
  acronym: string | null;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
}

/* The same columns `ogVersion()` hashes, which is the point: everything the
   card draws is versioned, and nothing it does not draw can churn the URL.

   Deliberately NOT filtered by `is_public`, matching `getConference` in
   `src/app/conferences/[slug]/page.tsx` — that is what produces the `og:` tags
   this image accompanies, and a private conference whose owner shares the link
   should get the same card the tags promise rather than a mismatched generic
   one. If the metadata side ever starts gating on `is_public`, gate here too. */
const CARD_COLUMNS =
  'full_name, acronym, banner_url, logo_url, city, country, start_date, end_date';

/** `undefined` = the database could not be asked (a hiccup, not an answer). */
async function loadConference(slug: string): Promise<ConfCard | null | undefined> {
  try {
    const { data, error } = await supabase
      .from('conferences')
      .select(CARD_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error) return undefined;
    if (data) return data as ConfCard;

    /* A slug that no longer exists is very often one the conference has been
       RENAMED off (`conferences_reslug_on_rename`). The page itself 308s, but
       a card URL is not a page: WhatsApp, iMessage and Facebook cached this
       exact image URL when the link was first pasted and never revalidate, so
       a rename would turn every already-shared preview into the generic card.
       Follow the forwarding address instead. */
    const { data: alias, error: aliasError } = await supabase
      .from('conference_slug_aliases')
      .select(`conferences(${CARD_COLUMNS})`)
      .eq('slug', slug)
      .maybeSingle();
    if (aliasError) return undefined;
    const conf = (alias as { conferences?: ConfCard | null } | null)?.conferences;
    return conf ?? null;
  } catch {
    return undefined;
  }
}

/* THE TIME BUDGET. A link preview is fetched by the SENDER's phone while they
   type, and WhatsApp gives up on a slow image and sends the message with no
   picture. Each organiser asset already has its own 6s fetch timeout; two of
   them plus the flag plus a cold start could take longer than WhatsApp waits.
   So all three share one budget: whatever is not ready by then is left off,
   the card is drawn anyway, and it is marked degraded (short cache) so the
   next request draws the full card. */
const ASSET_BUDGET_MS = 2500;

function withinBudget<T>(p: Promise<T | null>, onLate: () => void): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      onLate();
      resolve(null);
    }, ASSET_BUDGET_MS);
  });
  return Promise.race([p.catch(() => null), late]).finally(() => clearTimeout(timer));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; v: string }> },
): Promise<Response> {
  const { slug, v } = await params;
  // Echoed for debugging only — the render never depends on it. See the note
  // at the top of this file for what it is actually for.
  const token = versionToken(v);

  const conf = await loadConference(slug);
  if (!conf) {
    // `undefined` (DB unreachable) is a hiccup: draw the generic card but let
    // it expire in minutes. `null` (no such conference) is also short-cached:
    // a slug can be created after someone pasted it.
    // A generic card, not a 404. A scraper that gets a non-200 for og:image
    // drops the picture from an otherwise valid card and frequently caches
    // that outcome, so an unknown slug must still answer with an image.
    const res = await renderCard(fallbackCard(), { degraded: true });
    res.headers.set('X-Og-Version', token);
    res.headers.set('X-Og-Source', 'fallback');
    return res;
  }

  // Every asset in parallel and inside ONE budget (see ASSET_BUDGET_MS) — each
  // is an external fetch plus a sharp decode, and serialising them roughly
  // doubles a cold render.
  let degraded = false;
  const markLate = () => {
    degraded = true;
  };
  const place = [conf.city?.trim(), conf.country?.trim()].filter(Boolean).join(', ');
  const [backdrop, logo, flagUri] = await Promise.all([
    withinBudget(loadBannerDataUri(conf.banner_url, CARD_WIDTH, CARD_HEIGHT), markLate),
    withinBudget(loadLogo(conf.logo_url, 176), markLate),
    // Resolved from our own country table, so an unrecognisable "country" (a
    // crisis committee's invented state, a typo) simply yields no flag.
    place ? withinBudget(loadFlagDataUri(conf.country), markLate) : Promise.resolve(null),
  ]);

  // `conferenceLabels` is the single source of truth for how a conference is
  // written: acronym + edition year as the primary, full name as the secondary,
  // and `secondary: null` when the two would say the same thing — which is what
  // stops a card reading "HULTMUN 2026 / Hult Model United Nations 2026" twice
  // over. Never hand-roll this.
  const { primary, secondary } = conferenceLabels(conf);
  const headline = primary || 'Model UN Conference';

  // Date and place are two SEPARATE chips, not one "date · place" line. Each is
  // a distinct question a delegate has ("when is it", "where is it"), and a
  // joined line answers neither at a glance.
  const dates = formatConferenceDates(conf.start_date, conf.end_date, { fallback: '' });
  const flag = place ? flagUri : null;

  const chips: CardChip[] = [
    ...(dates ? [{ label: dates }] : []),
    ...(place ? [{ label: place, flag }] : []),
  ];

  const res = await renderCard(
    <CardShell
      backdrop={backdrop}
      logo={logo}
      headline={headline}
      // 30px type in an 820px column; see `clampToTwoLines` for why this is a
      // character budget rather than a CSS line clamp.
      subhead={secondary ? clampToTwoLines(secondary, 30, 820) : null}
      chips={chips}
    />,
    { degraded },
  );

  res.headers.set('X-Og-Version', token);
  res.headers.set('X-Og-Source', backdrop ? 'banner' : logo ? 'logo' : 'flat');
  return res;
}
