'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LogoDisc, the ONE way a conference logo renders anywhere in the app.
//
// Conference logos are arbitrary user uploads (transparent PNGs, odd crops,
// dark seals). Rendered raw they look bad on cards, so every logo sits inside
// a clean circular backdrop: a near-white disc (#FDFCF9, reads as white on
// both ivory and forest surfaces) with a soft forest shadow, only a hairline
// rim, and the artwork contained inside a ~7% inner margin so it barely chips.
//
// `bare` renders the logo free-floating instead: no disc, no border, no chip,
// just the contained artwork on a transparent background (still with the
// monogram fallback for a missing/failed src). Consumed by surfaces that want
// the raw mark, e.g. the assignment page.
//
// When there is no logo (or the image fails to load) the disc falls back to
// the house monogram language: forest gradient disc + gold initials.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import type { CSSProperties } from 'react';

export function LogoDisc({
  src,
  alt,
  size,
  fallbackText,
  className,
  style,
  bare = false,
}: {
  /** Logo URL. Null/undefined (or a load error) renders the monogram fallback. */
  src?: string | null;
  alt?: string;
  /** Disc diameter in px. The artwork gets a ~7% inner margin of this. */
  size: number;
  /** Monogram initials for the fallback disc (e.g. acronym.slice(0, 3)). */
  fallbackText?: string;
  className?: string;
  /** Merged last, positioning overrides (margins, z-index…) welcome. */
  style?: CSSProperties;
  /**
   * Render the logo free-floating: no disc backdrop, no border, no shadow chip,
   * just the contained artwork on a transparent background. The monogram
   * fallback still renders (for a missing/failed src) but without a heavy rim.
   */
  bare?: boolean;
}) {
  // Track failures per-URL so a src change retries the image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  const base: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '9999px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: bare ? 'none' : '0 4px 12px rgba(27,56,40,0.15)',
  };

  if (showImage) {
    return (
      <div
        className={className}
        style={{
          ...base,
          // bare: transparent, no rim, no inner padding, the raw mark floats.
          backgroundColor: bare ? 'transparent' : '#FDFCF9',
          border: bare ? 'none' : '0.5px solid rgba(221,212,192,0.5)',
          // ~7% of the diameter so the logo barely chips (none when bare).
          padding: bare ? 0 : `${Math.round(size * 0.07)}px`,
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ''}
          onError={() => setFailedSrc(src)}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

  const text = (fallbackText ?? '?').toUpperCase();
  return (
    <div
      className={className}
      aria-label={alt}
      style={{
        ...base,
        background: 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
        border: bare ? 'none' : '1px solid rgba(238,217,138,0.35)',
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
          color: '#EED98A',
          fontSize: `${Math.max(9, Math.round(size * (text.length > 2 ? 0.24 : 0.3)))}px`,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {text}
      </span>
    </div>
  );
}
