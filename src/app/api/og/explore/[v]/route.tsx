/**
 * GET /api/og/explore/[v]  →  the share card for /conferences/explore.
 *
 * WHY IT EXISTS. The explore page was sharing the site-wide `/og-image.jpg`
 * ("MUN Conferences & Committee Software"). The page is where a DELEGATE finds
 * a conference, and the link is typically forwarded in a school or society
 * WhatsApp group, so the card says exactly that: find your next conference,
 * with the size of the catalogue as the reason to tap.
 *
 * COMPOSED DOWN THE MIDDLE, like the /conferences/new card. WhatsApp
 * centre-crops toward a square for its in-chat preview and its chat-list
 * thumbnail, so everything that must be read sits inside the centre 630x630.
 * Only the decorative rings live outside it.
 *
 * LIVE COUNTS, GUARDED. `loadListingCounts()` is shared with the home card,
 * has a hard timeout and a warm-instance memo, and returns `null` on any
 * failure. On `null` the pill falls back to a static line, so a slow database
 * costs the card its number, never its picture.
 *
 * Versioned `[v]` segment (dated, built by `exploreOgImageUrl()`) because scrapers
 * cache a URL's bytes effectively forever; the route ignores it when rendering.
 * Node runtime because `renderCard` uses sharp.
 */
import { versionToken } from '@/lib/ogVersion';
import { CARD_WIDTH, CARD_HEIGHT, FOREST, FOREST_DEEP, GOLD, IVORY, IVORY_DIM, renderCard } from '../../_shared/card';
import { loadListingCounts, plural } from '../../_shared/counts';
import { FONT_FAMILY } from '../../_shared/fonts';

export const runtime = 'nodejs';

/** The centre square a square-cropping scraper keeps. */
const SAFE = CARD_HEIGHT; // 630
const SAFE_LEFT = (CARD_WIDTH - SAFE) / 2; // 285

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ v: string }> },
): Promise<Response> {
  const { v } = await params;
  const counts = await loadListingCounts();

  const pill = counts
    ? `${plural(counts.conferences, 'conference', 'conferences')} · ${plural(counts.countries, 'country', 'countries')}`
    : 'Free to browse';

  const res = await renderCard(
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fontFamily: FONT_FAMILY,
        backgroundColor: FOREST,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          backgroundImage: `linear-gradient(135deg, ${FOREST_DEEP} 0%, ${FOREST} 55%, ${FOREST} 100%)`,
        }}
      />

      {/* Two globe-like rings, mirrored left and right, kept just outside the safe
          square so no line runs behind the type. Decoration only: a square crop losing them costs nothing. */}
      <div
        style={{
          position: 'absolute',
          top: -140,
          left: -640,
          width: 900,
          height: 900,
          borderRadius: 450,
          border: `2px solid ${GOLD}`,
          opacity: 0.1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -140,
          left: 940,
          width: 900,
          height: 900,
          borderRadius: 450,
          border: `2px solid ${GOLD}`,
          opacity: 0.1,
        }}
      />

      {/* Everything that must be READ lives in here. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: SAFE_LEFT,
          width: SAFE,
          height: CARD_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 34px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: 5,
            color: GOLD,
            marginBottom: 26,
          }}
        >
          GAVELLING
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -1.6,
            color: IVORY,
            marginBottom: 22,
          }}
        >
          Find your next MUN conference
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 27,
            fontWeight: 500,
            lineHeight: 1.34,
            color: IVORY_DIM,
            opacity: 0.86,
            marginBottom: 34,
            // Two explicit lines rather than a measure, since Satori has no
            // text-wrap: balance. No comma on purpose: Outfit's comma renders
            // with a visible gap after it in Satori ("country,  date").
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex' }}>Browse by country and date.</div>
          <div style={{ display: 'flex' }}>Apply in minutes.</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: GOLD,
            color: FOREST,
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: 0.4,
            borderRadius: 999,
            padding: '14px 34px',
          }}
        >
          {pill}
        </div>
      </div>
    </div>,
  );

  res.headers.set('X-Og-Version', versionToken(v));
  res.headers.set('X-Og-Source', counts ? 'live-counts' : 'static');
  return res;
}
