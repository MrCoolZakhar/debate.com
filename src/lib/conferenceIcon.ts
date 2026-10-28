/**
 * A conference's own square link icon (23 Oct 2026).
 *
 * WHY. Linktree, iMessage's compact rows and a phone's home screen show a
 * link's TOUCH ICON, not its share card. Every conference page inherited the
 * Gavelling gavel, so a conference's link in a Linktree read as "Gavelling",
 * not as the conference. Peter: "a small preview of the conference logo and
 * background, similar to whatsapp".
 *
 * WHAT. `/api/og/icon/<slug>/<token>-<size>.png` draws the conference's banner
 * (or its theme colour when it has none) covering the square, with the logo on
 * a white disc in the middle (an acronym on the disc when there is no logo).
 * `conferenceIcons()` is mounted by `src/app/conferences/[slug]/layout.tsx`, so
 * the public page and every page under it carry it.
 *
 * The token works like `ogVersion()`: a hash of what the icon draws plus a
 * design version, so a new logo or banner is a new URL (scrapers never
 * revalidate a URL they have) and the route can answer with a year's cache.
 *
 * Dependency-free and isomorphic, like ogVersion.ts.
 */
import type { Metadata } from 'next';

/** Bump when the icon's DRAWING changes (src/app/api/og/icon/...). */
export const ICON_DESIGN = 'i2';

/** The two sizes we serve: the iOS / Linktree touch icon and the large icon. */
export const ICON_SIZES = [180, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** The fields the icon draws. Structural, so a DB row satisfies it. */
export interface IconVersionInput {
  full_name?: string | null;
  acronym?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
  theme?: unknown;
}

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/** The organiser's main colour, when the theme carries a valid one. */
export function themeMain(theme: unknown): string | null {
  const main = (theme as { main?: unknown } | null)?.main;
  return typeof main === 'string' && /^#[0-9a-f]{6}$/i.test(main.trim()) ? main.trim() : null;
}

/** `<design>-<hash>`: stable while nothing the icon draws changes. */
export function iconVersion(conf: IconVersionInput): string {
  const payload = [
    conf.logo_url ?? '',
    conf.banner_url ?? '',
    themeMain(conf.theme) ?? '',
    // Only drawn when there is no logo, but cheap to always include.
    conf.acronym ?? '',
    conf.full_name ?? '',
  ].join('\n');
  return `${ICON_DESIGN}-${shortHash(payload)}`;
}

/** The icon's path (relative: metadataBase makes it absolute). */
export function conferenceIconPath(slug: string, conf: IconVersionInput, size: IconSize): string {
  return `/api/og/icon/${encodeURIComponent(slug)}/${iconVersion(conf)}-${size}.png`;
}

/** The size asked for in a `[v]` segment (`i1-abc1234-180.png`); 512 by default. */
export function iconSizeFromSegment(segment: string): IconSize {
  const n = Number(segment.match(/-(\d+)\.png$/i)?.[1]);
  return (ICON_SIZES as readonly number[]).includes(n) ? (n as IconSize) : 512;
}

/**
 * The `icons` metadata for a conference page. Setting `icons` drops the root
 * file-convention PNG icons (src/app/icon.png, icon1.png, apple-icon.png) for
 * these pages only; Next always keeps src/app/favicon.ico first, so the
 * browser tab can still fall back to the gavel.
 */
export function conferenceIcons(slug: string, conf: IconVersionInput): NonNullable<Metadata['icons']> {
  return {
    icon: [{ url: conferenceIconPath(slug, conf, 512), sizes: '512x512', type: 'image/png' }],
    apple: [{ url: conferenceIconPath(slug, conf, 180), sizes: '180x180', type: 'image/png' }],
  };
}
