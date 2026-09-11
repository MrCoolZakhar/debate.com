/**
 * GET /api/og/list/[v]  →  the share card for /conferences/new.
 *
 * WHY THIS EXISTS AT ALL. That page was sharing the site-wide
 * `/og-image.jpg`, which reads "Gavelling: MUN Conferences & Committee
 * Software" — a card aimed at DELEGATES looking for a conference. But
 * /conferences/new is the organiser's page: its whole job is "list yours,
 * free". Someone forwarding that link on WhatsApp was showing a stranger a
 * card about the wrong product.
 *
 * WHY IT IS COMPOSED DOWN THE MIDDLE. The shared CardShell deliberately
 * anchors its type to the left and lets a banner breathe on the right, which
 * is right for a conference card seen on Twitter or Slack at a full 1.91:1.
 * WhatsApp is the odd one out: it centre-crops toward a square for its
 * in-chat preview and its chat-list thumbnail, so a left-anchored headline
 * loses its first words. Everything here sits inside the centre 630x630, so
 * the card survives being cropped to a square and still says what it means.
 * That is the actual optimisation being asked for.
 *
 * WHY IT CARRIES NO LIVE DATA. The home card queries Supabase for counts.
 * This one deliberately does not: WhatsApp's scraper gives a link a short
 * budget and does not retry well, and "list your conference free" is not a
 * claim that ages. Fewer moving parts before the first byte is worth more
 * here than freshness.
 *
 * Versioned `[v]` segment for the same reason as the other two cards:
 * scrapers cache a URL's bytes effectively forever, so the only way to ever
 * change this card is to change its URL. Node runtime because `renderCard`
 * uses sharp.
 */
import { CARD_WIDTH, CARD_HEIGHT, FOREST, FOREST_DEEP, GOLD, IVORY, IVORY_DIM, renderCard } from '../../_shared/card';
import { FONT_FAMILY } from '../../_shared/fonts';

export const runtime = 'nodejs';

/** The centre square a square-cropping scraper keeps. Nothing that has to be
 *  read may sit outside it. */
const SAFE = CARD_HEIGHT; // 630
const SAFE_LEFT = (CARD_WIDTH - SAFE) / 2; // 285

export async function GET() {
  return renderCard(
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
      {/* Field. A ramp rather than a flat rectangle, same reasoning as the
          shared shell: one solid colour reads as a missing image. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          backgroundImage: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST} 42%, ${FOREST_DEEP} 100%)`,
        }}
      />

      {/* The committee horseshoe, off to the right where a square crop will
          lose most of it. Decoration only, so losing it costs nothing. */}
      <div
        style={{
          position: 'absolute',
          top: -180,
          left: 720,
          width: 900,
          height: 900,
          borderRadius: 450,
          border: `2px solid ${GOLD}`,
          opacity: 0.10,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -60,
          left: 840,
          width: 660,
          height: 660,
          borderRadius: 330,
          border: `2px solid ${GOLD}`,
          opacity: 0.08,
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
          List your MUN conference
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
            // Narrower than the safe box on purpose. At the full width this
            // line broke after "in one" and left "place." alone on the second
            // row; Satori has no text-wrap: balance, so the measure is the
            // only lever. 470 splits it into two even lines.
            width: 470,
          }}
        >
          Applications, allocations and payments in one place.
        </div>

        {/* The one claim an organiser is actually weighing. */}
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
          Free for organisers
        </div>
      </div>
    </div>,
  );
}
