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
 * segment from the row's visible fields plus the date. See that file for why
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
  clampToTwoLines,
  fallbackCard,
  renderCard,
} from '../../../_shared/card';
import { loadBannerDataUri, loadLogo } from '../../../_shared/remoteImage';

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
async function loadConference(slug: string): Promise<ConfCard | null> {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('full_name, acronym, banner_url, logo_url, city, country, start_date, end_date')
      .eq('slug', slug)
      .maybeSingle();
    return (data as ConfCard) ?? null;
  } catch {
    return null;
  }
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
    // A generic card, not a 404. A scraper that gets a non-200 for og:image
    // drops the picture from an otherwise valid card and frequently caches
    // that outcome, so an unknown slug must still answer with an image.
    const res = await renderCard(fallbackCard());
    res.headers.set('X-Og-Version', token);
    res.headers.set('X-Og-Source', 'fallback');
    return res;
  }

  // Both assets in parallel — each is an external fetch plus a sharp decode,
  // and serialising them roughly doubles a cold render.
  const [backdrop, logo] = await Promise.all([
    loadBannerDataUri(conf.banner_url, CARD_WIDTH, CARD_HEIGHT),
    loadLogo(conf.logo_url, 176),
  ]);

  // `conferenceLabels` is the single source of truth for how a conference is
  // written: acronym + edition year as the primary, full name as the secondary,
  // and `secondary: null` when the two would say the same thing — which is what
  // stops a card reading "HULTMUN 2026 / Hult Model United Nations 2026" twice
  // over. Never hand-roll this.
  const { primary, secondary } = conferenceLabels(conf);
  const headline = primary || 'Model UN Conference';

  const dates = formatConferenceDates(conf.start_date, conf.end_date, { fallback: '' });
  const place = [conf.city?.trim(), conf.country?.trim()].filter(Boolean).join(', ');
  const footer = [dates, place].filter(Boolean).join(' · ') || null;

  const res = await renderCard(
    <CardShell
      backdrop={backdrop}
      logo={logo}
      headline={headline}
      // 30px type in an 820px column; see `clampToTwoLines` for why this is a
      // character budget rather than a CSS line clamp.
      subhead={secondary ? clampToTwoLines(secondary, 30, 820) : null}
      footer={footer}
    />,
  );

  res.headers.set('X-Og-Version', token);
  res.headers.set('X-Og-Source', backdrop ? 'banner' : logo ? 'logo' : 'flat');
  return res;
}
