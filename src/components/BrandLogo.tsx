'use client';

// ── The logo ─────────────────────────────────────────────────────────────────
// ONE wordmark everywhere a header or footer logo appears (owner, 25 Sep 2026):
// `public/gavelling-logo.png`, the plain word "Gavelling". The "Gavelling
// Conferences" and "Gavelling Sessions app" lockups are retired. Colour
// variants are CSS filters over that one file, never new files:
//
//   tone="ink"    as drawn (dark on cream / white)
//   tone="white"  on forest
//   tone="gold"   on forest, the pale gold
//
// THE FILE HAS PADDING. It is a 1920 x 1080 canvas and the visible word is a
// 1679 x 416 box at (132, 340) inside it (measured with sharp, 25 Sep 2026).
// Drawn naively at 28px the word was 11px tall, a sliver in the corner. So
// `height` here means the height of the WORD: the image is scaled so the word
// is that tall and the transparent margins are cropped away with a clipping
// box, never by editing the image (the owner's asset stays as delivered).

import Link from 'next/link';

// 25 Sep 2026 (owner, later the same day): the logo is the full lockup, gavel +
// wreath, GAVELLING, "The #1 MUN Ecosystem" (public/gavelling-logo-ecosystem.png,
// 1920 x 1080 canvas, delivered as is). Never type the word as text (CLAUDE.md §8).
export const BRAND_LOGO_SRC = '/gavelling-logo-ecosystem.png';

/** The visible word inside the canvas, in source pixels. */
const CANVAS = { w: 1920, h: 1080 };
const WORD = { x: 88, y: 318, w: 1660, h: 409 };
/** Callers pass the height the plain word used to have. The lockup is two lines
 *  plus the gavel, so it is drawn this much taller to keep GAVELLING about as big. */
const LOCKUP_SCALE = 1.75;

const FILTERS: Record<'ink' | 'white' | 'gold', string | undefined> = {
  ink: undefined,
  white: 'brightness(0) invert(1)',
  // #EED98A: invert to white, then tint through sepia and a hue nudge.
  gold: 'brightness(0) invert(1) sepia(0.6) saturate(2.2) hue-rotate(5deg) brightness(0.97)',
};

export function BrandLogo({
  height = 32,
  tone = 'ink',
  href = '/',
  className,
  style,
  priority = false,
}: {
  /** Height of the visible WORD, in px. */
  height?: number;
  tone?: 'ink' | 'white' | 'gold';
  /** null renders the plain image with no link (inside another link, say). */
  href?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /** The header logo: fetch it first, no lazy loading. */
  priority?: boolean;
}) {
  const boxH = Math.round(height * LOCKUP_SCALE);
  const scale = boxH / WORD.h;
  const boxW = Math.round(WORD.w * scale);
  const img = (
    <span
      className={className}
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        width: boxW,
        height: boxH,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_SRC}
        alt="Gavelling"
        width={Math.round(CANVAS.w * scale)}
        height={Math.round(CANVAS.h * scale)}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        draggable={false}
        style={{
          position: 'absolute',
          left: -Math.round(WORD.x * scale),
          top: -Math.round(WORD.y * scale),
          width: Math.round(CANVAS.w * scale),
          height: Math.round(CANVAS.h * scale),
          maxWidth: 'none',
          display: 'block',
          filter: FILTERS[tone],
        }}
      />
    </span>
  );
  if (href === null) return img;
  return (
    <Link href={href} aria-label="Gavelling home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 rounded-md">
      {img}
    </Link>
  );
}

export default BrandLogo;
