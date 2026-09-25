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
// The file was deleted by mistake on 25 Sep 2026 and is being restored; until
// it is back the <img> falls back to the old /GavellingLogo.png lockup so no
// page ever shows a broken image. Remove the fallback once the file is in.

import Link from 'next/link';
import { useState } from 'react';

export const BRAND_LOGO_SRC = '/gavelling-logo.png';
const FALLBACK_SRC = '/GavellingLogo.png';

const FILTERS: Record<'ink' | 'white' | 'gold', string | undefined> = {
  ink: undefined,
  white: 'brightness(0) invert(1)',
  // #EED98A: invert to white, then tint through sepia and a hue nudge.
  gold: 'brightness(0) invert(1) sepia(0.6) saturate(2.2) hue-rotate(5deg) brightness(0.97)',
};

export function BrandLogo({
  height = 28,
  tone = 'ink',
  href = '/',
  className,
  style,
  priority = false,
}: {
  height?: number;
  tone?: 'ink' | 'white' | 'gold';
  /** null renders the plain image with no link (inside another link, say). */
  href?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /** The header logo: fetch it first, no lazy loading. */
  priority?: boolean;
}) {
  const [src, setSrc] = useState(BRAND_LOGO_SRC);
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt="Gavelling"
      height={height}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      draggable={false}
      onError={() => { if (src !== FALLBACK_SRC) setSrc(FALLBACK_SRC); }}
      className={className}
      style={{ height, width: 'auto', display: 'block', filter: FILTERS[tone], ...style }}
    />
  );
  if (href === null) return img;
  return (
    <Link href={href} aria-label="Gavelling home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 rounded-md">
      {img}
    </Link>
  );
}

export default BrandLogo;
