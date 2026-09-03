/**
 * The share card itself: palette, layout primitives and the render pipeline
 * every `/api/og/*` route ends in.
 *
 * THE DESIGN BRIEF, IN ONE LINE: the banner is a BACKDROP, never the card.
 *
 * The previous behaviour pointed `og:image` at the organiser's raw banner, so
 * the card was whatever they happened to upload — usually a poster with its own
 * baked-in text at its own scale, cropped to 1.91:1 by the scraper, frequently
 * illegible and occasionally just a texture. Here the banner is pushed behind a
 * forest scrim heavy enough that OUR type is readable over ANY image, including
 * a white one, and the conference is identified by text we control.
 *
 * SATORI CONSTRAINTS THAT SHAPE THIS FILE
 *
 *  • Every element with more than one child needs an explicit `display`.
 *    Satori throws rather than guessing, so `display: 'flex'` is on everything.
 *  • There is no text measurement API and no `text-wrap: balance`. Font sizes
 *    are chosen from string length (`acronymFontSize`) and the full name is
 *    truncated by an estimated character budget (`clampToTwoLines`) rather than
 *    by a CSS line clamp, whose support varies across satori versions.
 *  • Images must be data URIs of a format satori decodes. See `remoteImage.ts`.
 */
/* eslint-disable @next/next/no-img-element --
 * `next/image` is meaningless here. This JSX is never mounted in a browser; it
 * is fed to satori, which understands a small subset of HTML and knows nothing
 * about `next/image`'s wrapper markup, srcset or loader. Every source below is
 * already an inlined data URI that `remoteImage.ts` resized to the exact box it
 * is drawn in, so the optimisation the rule is asking for has happened — just
 * upstream of the element. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageResponse } from 'next/og';
import { CARD_FONTS, FONTS_ARE_OUTFIT, FONT_FAMILY } from './fonts';
import { encodeCard } from './remoteImage';

/** Open Graph's canonical 1.91:1. Every scraper crops to something near it. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// ── Palette ──────────────────────────────────────────────────────────────────
// The brand five, plus two shades derived from forest purely for gradient
// stops. Nothing here should be invented at a call site.
export const FOREST = '#1B3828';
export const FOREST_DEEP = '#0F2017';
export const GOLD = '#EED98A';
export const IVORY = '#FAF8F3';
export const IVORY_DIM = '#EDE7D8';
export const INK = '#1C1410';

// ── The Gavelling mark ───────────────────────────────────────────────────────
//
// A 120px copy of `public/gavelling-mark.png`, kept in this folder rather than
// read from `public/` at runtime: on Vercel, `public/` is uploaded as static
// assets and is NOT part of the serverless function's filesystem, so a
// `readFileSync(process.cwd() + '/public/…')` that works perfectly in `next dev`
// returns ENOENT in production.
//
// It is the SQUARE mark, never `/GavellingLogo.png`. That file is an 800x200
// lockup whose square crop reads as a crescent "C" — see the note in
// `src/lib/seo.ts`. Here the container is square, so the square mark is the
// only correct file.
const MARK_DATA_URI: string | null = (() => {
  const candidates = [
    join(process.cwd(), 'src/app/api/og/_shared/gavelling-mark-120.png'),
    (() => {
      try {
        const u = new URL('./gavelling-mark-120.png', import.meta.url);
        return u.protocol === 'file:' ? fileURLToPath(u) : null;
      } catch {
        return null;
      }
    })(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return `data:image/png;base64,${readFileSync(candidate).toString('base64')}`;
    } catch {
      // Next candidate.
    }
  }
  // The mark is a signature, not structure — its absence must not cost us the
  // card. The brand row falls back to the wordmark alone.
  return null;
})();

// ── Text fitting ─────────────────────────────────────────────────────────────

/**
 * The dominant line's size, chosen from its length.
 *
 * Satori cannot measure text, so this is a lookup rather than a fit. The
 * breakpoints are tuned against the real spread of acronyms in the table,
 * which runs from "NS" to "MAANVARTAMUN 2026" — and remember every label
 * carries its edition year, so budget four characters more than the acronym
 * alone suggests.
 */
export function acronymFontSize(label: string): number {
  const n = label.length;
  if (n <= 8) return 108;
  if (n <= 11) return 94;
  if (n <= 14) return 80;
  if (n <= 18) return 66;
  if (n <= 24) return 54;
  return 44;
}

/**
 * Truncate to roughly two rendered lines, breaking on a word boundary.
 *
 * Outfit's average advance is a little over half its em, so at `fontSize` the
 * text block fits about `width / (fontSize * 0.52)` characters per line. That
 * approximation is generous enough to never overflow into a third line and
 * tight enough not to cut names that would have fitted.
 */
export function clampToTwoLines(text: string, fontSize: number, width: number): string {
  const perLine = Math.floor(width / (fontSize * 0.52));
  const budget = perLine * 2;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= budget) return clean;

  const cut = clean.slice(0, budget - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Only honour the word boundary if it does not throw away most of the line;
  // one very long word should be hard-cut rather than collapse the whole block.
  const stem = lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${stem.trimEnd()}…`;
}

// ── Layout pieces ────────────────────────────────────────────────────────────

/** The logo chip: the mark on a plate, so a transparent PNG has something to
 *  sit on. `plate` comes from the luminance probe in `remoteImage.ts` — a
 *  near-white logo gets a dark plate instead of disappearing into the ivory. */
function LogoChip({ src, plate }: { src: string; plate: 'ivory' | 'forest' }) {
  const dark = plate === 'forest';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 116,
        height: 116,
        borderRadius: 28,
        padding: 14,
        backgroundColor: dark ? 'rgba(12,26,19,0.92)' : IVORY,
        border: dark ? `2px solid ${GOLD}` : '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 18px 44px rgba(6,16,11,0.55)',
      }}
    >
      {/* `contain`, never `cover`: a wide lockup must stay a wide lockup.
          Stretching it into the square is the specific ugliness we avoid. */}
      <img src={src} width={88} height={88} style={{ objectFit: 'contain' }} alt="" />
    </div>
  );
}

/** The dates · place pill under the name. */
function FooterChip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '13px 28px',
        backgroundColor: 'rgba(238,217,138,0.13)',
        border: '1px solid rgba(238,217,138,0.42)',
        color: GOLD,
        fontSize: 25,
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      {label}
    </div>
  );
}

/** Mark + wordmark, bottom-right. Small on purpose: this card belongs to the
 *  conference, and we are the footer.
 *
 *  The mark sits on an ivory plate for the same reason the conference logo
 *  does. It is a brown gavel over a sage wreath — mid-tone artwork that turns
 *  to mud at 40px against forest, and worse against a dark banner. The plate is
 *  a deliberate echo of `LogoChip`, so the two read as one system rather than
 *  as an accident. */
function BrandRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {MARK_DATA_URI ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: IVORY,
            marginRight: 13,
          }}
        >
          <img src={MARK_DATA_URI} width={38} height={38} style={{ objectFit: 'contain' }} alt="" />
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          color: IVORY,
          opacity: 0.82,
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        Gavelling
      </div>
    </div>
  );
}

// ── The shell ────────────────────────────────────────────────────────────────

export interface CardShellProps {
  /** Normalised banner as a data URI, or `null` for the flat forest field. */
  backdrop: string | null;
  /** Top-left chip. Omitted entirely when the conference has no logo — never
   *  substituted with a stretched placeholder. */
  logo: { dataUri: string; plate: 'ivory' | 'forest' } | null;
  /** The dominant line: acronym + edition year. */
  headline: string;
  /** Secondary line, already clamped. `null` when it would repeat the
   *  headline. */
  subhead: string | null;
  /** The dates · place pill. `null` when we know neither. */
  footer: string | null;
}

/**
 * The card layout, shared by every route so all our previews are one family.
 *
 * The composition is IDENTICAL whether or not there is a banner or a logo —
 * only the field behind it changes. That is what stops the no-assets case from
 * looking like a broken version of the rich one.
 */
export function CardShell({ backdrop, logo, headline, subhead, footer }: CardShellProps) {
  const headlineSize = acronymFontSize(headline);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fontFamily: FONT_FAMILY,
        backgroundColor: FOREST,
        // The flat field is a ramp, not a solid: an unbroken rectangle of one
        // colour reads as a rendering failure at thumbnail size.
        backgroundImage: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 58%, ${INK} 100%)`,
      }}
    >
      {backdrop ? (
        <>
          <img
            src={backdrop}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
            alt=""
          />
          {/* Scrim, horizontal: anchors the type side in near-solid forest and
              lets the banner breathe on the right. This is what guarantees
              legibility over a white poster as readily as over a dark one. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              backgroundImage:
                'linear-gradient(100deg, rgba(11,24,17,0.95) 0%, rgba(13,29,20,0.90) 38%, rgba(17,38,26,0.66) 68%, rgba(20,44,31,0.44) 100%)',
            }}
          />
          {/* Scrim, vertical: darkens top and bottom so the gold rule and the
              footer row keep their contrast whatever sits behind them. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              backgroundImage:
                'linear-gradient(180deg, rgba(8,19,13,0.55) 0%, rgba(8,19,13,0) 30%, rgba(8,19,13,0.30) 62%, rgba(8,19,13,0.78) 100%)',
            }}
          />
        </>
      ) : (
        /* No banner: a soft gold bloom in the top-right keeps the field from
           reading as empty, without pretending to be an image.

           The scrims are SKIPPED here rather than drawn over it. They exist to
           tame an unknown photograph; with no photograph they only mute a
           gradient we already control, and they flattened this bloom to
           invisibility when it sat underneath them. */
        <div
          style={{
            position: 'absolute',
            top: -260,
            right: -220,
            width: 820,
            height: 820,
            borderRadius: 999,
            backgroundImage:
              'radial-gradient(circle, rgba(238,217,138,0.26) 0%, rgba(238,217,138,0.09) 42%, rgba(238,217,138,0) 68%)',
          }}
        />
      )}

      {/* Gold rule. The one piece of pure brand furniture, and the thing that
          makes a row of these cards recognisably ours in a feed. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: 8,
          backgroundColor: GOLD,
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          padding: '62px 68px 54px',
        }}
      >
        {/* Fixed-height slot, occupied or not, so the block below lands in the
            same place on every card in the set. */}
        <div style={{ display: 'flex', height: 116 }}>
          {logo ? <LogoChip src={logo.dataUri} plate={logo.plate} /> : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: IVORY,
              fontSize: headlineSize,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -1.5,
              // Keeps a very long headline off the brand row on the right.
              maxWidth: 940,
            }}
          >
            {headline}
          </div>

          {subhead ? (
            <div
              style={{
                display: 'flex',
                marginTop: 18,
                maxWidth: 820,
                color: IVORY_DIM,
                opacity: 0.86,
                fontSize: 30,
                fontWeight: 500,
                lineHeight: 1.28,
              }}
            >
              {subhead}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 30,
            }}
          >
            {footer ? <FooterChip label={footer} /> : <div style={{ display: 'flex' }} />}
            <BrandRow />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Render ───────────────────────────────────────────────────────────────────

/**
 * Render an element to a finished image response.
 *
 * The `Cache-Control` is a full year AND `immutable`, which would normally be
 * reckless for content derived from a mutable DB row. It is correct here only
 * because the URL carries a version token (`src/lib/ogVersion.ts`): an edit
 * produces a NEW URL rather than new bytes at the old one. If that token is
 * ever dropped from the route, this header has to go with it.
 *
 * `X-Og-*` headers exist so the two silent failure modes — Outfit not bundled,
 * sharp not installed — are visible from `curl -I` rather than only to the eye.
 */
export async function renderCard(element: React.ReactElement): Promise<Response> {
  const image = new ImageResponse(element, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: CARD_FONTS,
  });

  const png = await image.arrayBuffer();
  const { body, contentType } = await encodeCard(png);

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Og-Fonts': FONTS_ARE_OUTFIT ? 'outfit' : 'fallback',
      'X-Og-Encoder': contentType === 'image/jpeg' ? 'sharp-jpeg' : 'raw-png',
    },
  });
}

/**
 * A card that still says something when the conference cannot be loaded at all
 * (unknown slug, private row, DB hiccup). Never a 404: a scraper that gets a
 * 404 for `og:image` drops the picture from an otherwise perfectly good card,
 * and some cache that outcome for days.
 */
export function fallbackCard(): React.ReactElement {
  return (
    <CardShell
      backdrop={null}
      logo={null}
      headline="Gavelling"
      subhead="Model UN conferences, applications and committee software — in one place."
      footer="gavelling.com"
    />
  );
}
