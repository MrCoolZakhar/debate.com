'use client';

/**
 * Brand.tsx, the Gavelling logo.
 *
 * Since 25 Sep 2026 there is ONE logo everywhere (owner: "i don't want any of them
 * to say sessions or conferences anymore"): /gavelling-lockup.webp (gavel + wreath,
 * GAVELLING, "The #1 MUN Ecosystem"). The old files GavellingLogo, GavellingSessionsApp
 * and Conferences (.png / .webp) now hold the same artwork, so every older reference
 * shows it too. `markOnly` still draws the square gavel mark for round / square spots.
 * `variant` and `tone` are kept so callers compile; they no longer change the art.
 */

export interface BrandProps {
  /**
   * Which product layer the lockup names:
   * - 'sessions'   , "GAVELLING" wordmark only
   * - 'conferences', "GAVELLING" + gold "CONFERENCES" eyebrow
   */
  variant?: 'sessions' | 'conferences';
  /**
   * Surface the brand sits on:
   * - 'light' , ivory pages (ink wordmark, deep-gold eyebrow)
   * - 'dark'  , forest bars / dark heroes (ivory wordmark, light-gold eyebrow)
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
  tone = 'light',
  size = 34,
  shadow = false,
  markOnly = false,
  monochrome = false,
}: BrandProps) {
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

  // The full logo is ONE image (owner, 25 Sep 2026): gavel + wreath, GAVELLING,
  // and "The #1 MUN Ecosystem" beneath. Never type "GAVELLING" out as text in
  // place of it (CLAUDE.md §8). 4:1 artwork, so width = 4 x the height. `size`
  // keeps meaning "the mark's height"; the lockup is drawn a little taller so the
  // mark inside it stays about that size.
  const h = Math.round(size * 1.35);
  return (
    <img
      src="/gavelling-lockup.webp"
      alt="Gavelling"
      width={h * 4}
      height={h}
      style={{
        height: h, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: [markFilter, shadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.55))' : ''].filter(Boolean).join(' ') || undefined,
      }}
      onError={(e) => { const img = e.target as HTMLImageElement; if (!img.src.endsWith('.png')) img.src = '/gavelling-lockup.png'; }}
    />
  );
}

export type BrandConferencesProps = Omit<BrandProps, 'variant'>;

/** Stable conferences-variant shorthand (used by SiteNav and auth surfaces). */
export function BrandConferences(props: BrandConferencesProps) {
  return <Brand variant="conferences" {...props} />;
}
