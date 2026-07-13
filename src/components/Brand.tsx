'use client';

/**
 * Brand.tsx — the Gavelling brand lockup (gavel mark + optional live wordmark).
 *
 * The shipped logo PNGs read "GAVELLING SESSIONS APP"; every
 * conferences-related surface must read "GAVELLING CONFERENCES" instead.
 * Rather than shipping another baked PNG, <Brand /> composes the standalone
 * gavel mark (/gavel-mark.png — gavel + laurel, transparent) with live text:
 * "GAVELLING" in Outfit 900 (ink on light surfaces, ivory on dark) and — for
 * the conferences variant — a gold "CONFERENCES" eyebrow underneath.
 *
 * <BrandConferences /> is the stable conferences-variant shorthand used by
 * SiteNav and other conferences surfaces.
 */

const OUTFIT = "'Outfit', sans-serif";

export interface BrandProps {
  /**
   * Which product layer the lockup names:
   * - 'sessions'    — "GAVELLING" wordmark only
   * - 'conferences' — "GAVELLING" + gold "CONFERENCES" eyebrow
   */
  variant?: 'sessions' | 'conferences';
  /**
   * Surface the brand sits on:
   * - 'light'  — ivory pages (ink wordmark, deep-gold eyebrow)
   * - 'dark'   — forest bars / dark heroes (ivory wordmark, light-gold eyebrow)
   */
  tone?: 'light' | 'dark';
  /** Gavel-mark height in px; the type block scales off it. Default 34. */
  size?: number;
  /** Drop shadow for overlay-over-photo placements. */
  shadow?: boolean;
  /** Render the gavel mark only, no wordmark text. */
  markOnly?: boolean;
  /** Greyed treatment (desaturated mark) for quiet chrome like the /manage top bar. */
  monochrome?: boolean;
}

export function Brand({
  variant = 'conferences',
  tone = 'light',
  size = 34,
  shadow = false,
  markOnly = false,
  monochrome = false,
}: BrandProps) {
  const ink = tone === 'dark' ? '#EDE7D8' : '#1C1410';
  const gold = monochrome
    ? (tone === 'dark' ? 'rgba(238,217,138,0.75)' : '#9A8A78')
    : tone === 'dark' ? '#EED98A' : '#B6871F';
  // Type scales with the mark: wordmark ~46% of mark height, eyebrow fixed 8–9px band.
  const wordSize = Math.max(13, Math.round(size * 0.46));
  const eyebrowSize = size >= 32 ? 9 : 8;

  const markFilter = monochrome
    ? `grayscale(1)${tone === 'dark' ? ' brightness(2.1)' : ''}`
    : undefined;

  const mark = (
    <img
      src="/gavel-mark.png"
      alt={markOnly ? 'Gavelling' : ''}
      aria-hidden={markOnly ? undefined : true}
      style={{ height: size, width: size, objectFit: 'contain', flexShrink: 0, filter: markFilter }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );

  if (markOnly) {
    return (
      <span
        className="inline-flex items-center"
        style={{ filter: shadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.55))' : undefined }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: Math.round(size * 0.22),
        filter: shadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.55)) drop-shadow(0 1px 3px rgba(0,0,0,0.4))' : undefined,
      }}
    >
      {mark}
      <span className="flex flex-col" style={{ lineHeight: 1 }}>
        <span
          style={{
            fontFamily: OUTFIT,
            fontWeight: 900,
            fontSize: wordSize,
            letterSpacing: '0.04em',
            color: ink,
            lineHeight: 1,
          }}
        >
          GAVELLING
        </span>
        {variant === 'conferences' && (
          <span
            style={{
              fontFamily: OUTFIT,
              fontWeight: 800,
              fontSize: eyebrowSize,
              letterSpacing: '0.2em',
              color: gold,
              lineHeight: 1,
              marginTop: Math.max(2, Math.round(size * 0.09)),
            }}
          >
            CONFERENCES
          </span>
        )}
      </span>
    </span>
  );
}

export type BrandConferencesProps = Omit<BrandProps, 'variant'>;

/** Stable conferences-variant shorthand (used by SiteNav and auth surfaces). */
export function BrandConferences(props: BrandConferencesProps) {
  return <Brand variant="conferences" {...props} />;
}
