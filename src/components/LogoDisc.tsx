'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LogoDisc, the ONE way a conference logo renders anywhere in the app.
//
// Conference logos sit inside a clean circular backdrop: a near-white disc
// (#FDFCF9, reads as white on both ivory and forest surfaces) with a soft
// forest shadow and only a hairline rim.
//
// Since 23 Sep 2026 every upload goes through LogoCropModal's CIRCLE crop, so
// the file is a square whose inscribed circle is exactly what the organiser
// framed. A square picture is therefore drawn EDGE TO EDGE: no inner margin,
// nothing cropped twice (the old ~7% margin on top of the crop tool's own
// margin is what made logos look small). A picture that is NOT square (an
// upload from before any crop tool, or seeded data) is contained with just
// enough padding for its corners to stay inside the circle, measured from its
// real aspect ratio once it loads, so a wide logo is never clipped by the rim.
//
// `bare` renders the logo free-floating instead: no disc, no border, no chip,
// just the contained artwork on a transparent background (still with the
// monogram fallback for a missing/failed src). Consumed by surfaces that want
// the raw mark, e.g. the assignment page.
//
// When there is no logo (or the image fails to load) the disc falls back to
// the house monogram language: forest gradient disc + gold initials. The
// monogram fallback follows the conference theme through the --gv-* variables
// (--gv-main-dark, --gv-main-mid, --gv-on-main) and falls back to the
// Gavelling literals when none are set.
// `fallbackTone="plain"` drops that disc so the initials float on their own —
// for DARK surfaces (the chair sidebar) where a forest disc on forest reads as
// nothing at all. Everything else keeps the default 'disc'.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Inner padding (px) that keeps a contained picture's corners inside the disc.
 * A square picture (every circle-cropped upload) gets none: its circle is the
 * disc. A w/h picture contained in a square box of side b shows as b x b/r
 * (r >= 1); its half-diagonal b/2 * sqrt(1 + 1/r^2) must not pass the radius.
 */
function circleSafePadding(size: number, aspect: number): number {
  const r = aspect >= 1 ? aspect : 1 / aspect;
  if (!Number.isFinite(r) || r < 1.03) return 0;
  const box = size / Math.sqrt(1 + 1 / (r * r));
  return Math.max(0, Math.round((size - box) / 2));
}

export function LogoDisc({
  src,
  alt,
  size,
  fallbackText,
  className,
  style,
  bare = false,
  fallbackTone = 'disc',
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
  /**
   * How the MONOGRAM FALLBACK is drawn (the image path is unaffected).
   * 'disc' (default) is the house treatment — forest gradient disc + gold
   * initials — which is what every ivory surface needs and what all existing
   * call sites get.
   * 'plain' drops the disc entirely and floats the gold initials on their own.
   * For DARK surfaces only: on the chair sidebar (#1B3828) a forest-gradient
   * disc is invisible against the panel, so the fallback has to be the letters.
   */
  fallbackTone?: 'disc' | 'plain';
}) {
  // Track failures per-URL so a src change retries the image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  // Aspect ratio (w / h) of the loaded picture, per URL. Unknown until it
  // loads; square is assumed meanwhile because every cropped upload is square.
  const [loaded, setLoaded] = useState<{ src: string; aspect: number } | null>(null);
  const aspect = loaded && loaded.src === src ? loaded.aspect : 1;
  function noteAspect(el: HTMLImageElement) {
    if (!src) return;
    const a = el.naturalWidth > 0 && el.naturalHeight > 0 ? el.naturalWidth / el.naturalHeight : 1;
    if (loaded && loaded.src === src && Math.abs(loaded.aspect - a) < 0.001) return;
    setLoaded({ src, aspect: a });
  }

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
          // bare: transparent, no rim, the raw mark floats. Padding only for a
          // non-square picture, so its corners stay inside the circle.
          backgroundColor: bare ? 'transparent' : '#FDFCF9',
          border: bare ? 'none' : '0.5px solid rgba(221,212,192,0.5)',
          padding: `${circleSafePadding(size, aspect)}px`,
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ''}
          onError={() => setFailedSrc(src)}
          // A server-rendered <img> can finish loading before hydration, when
          // onLoad has nobody to tell, so the ref reads a complete image too.
          ref={(el) => { if (el && el.complete && el.naturalWidth > 0) noteAspect(el); }}
          onLoad={(e) => noteAspect(e.currentTarget)}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

  const text = (fallbackText ?? '?').toUpperCase();
  const plain = fallbackTone === 'plain';
  return (
    <div
      className={className}
      aria-label={alt}
      style={{
        ...base,
        background: plain ? 'none' : 'linear-gradient(135deg, var(--gv-main-dark, #16301F) 0%, var(--gv-main-mid, #2A5A3C) 100%)',
        border: bare || plain ? 'none' : '1px solid color-mix(in srgb, var(--gv-on-main, #EED98A) 35%, transparent)',
        ...(plain ? { boxShadow: 'none' } : null),
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-brand), sans-serif",
          fontWeight: plain ? 900 : 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
          color: 'var(--gv-on-main, #EED98A)',
          // No disc means no inner margin to respect, so the letters can own
          // the whole box and still read at a glance.
          fontSize: `${Math.max(9, Math.round(size * (plain ? (text.length > 2 ? 0.34 : 0.44) : text.length > 2 ? 0.24 : 0.3)))}px`,
          lineHeight: 1,
          userSelect: 'none',
          ...(plain ? { textShadow: '0 1px 3px rgba(0,0,0,0.45)' } : null),
        }}
      >
        {text}
      </span>
    </div>
  );
}
