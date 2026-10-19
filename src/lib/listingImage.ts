/**
 * Images of a Gavelling listing (src/lib/listings.ts) through OUR origin.
 *
 * A listing's `logo_url` / `banner_url` may be any https address (the conference's own site, or a
 * free city photo on upload.wikimedia.org). Drawing that address in an <img> would send every
 * visitor's IP and browser to a third party (CLAUDE.md §3: no third parties). So every surface that
 * draws a conference logo or banner passes it through `conferenceImageSrc`, which answers:
 *   - organiser conferences, our own storage and the /banners/ presets: the URL unchanged;
 *   - a listing's third-party image: `/api/listing-image?c=<slug>&k=<logo|banner>&v=<hash>`.
 *
 * The route (src/app/api/listing-image/route.ts) is NOT an open proxy: it takes no URL. It looks the
 * conference up by slug, requires `listed_by = 'gavelling'`, and fetches only the address stored in
 * that row's column (src/lib/listingImageFetch.ts: https only, public host names, image/* only, no
 * SVG, 5 MB cap). `v` is a hash of the stored address, so a changed image gets a new cache key.
 *
 * Isomorphic on purpose (no server-only imports): the Explore grid, hubs and the conference page all
 * call it.
 */

export type ListingImageKind = 'logo' | 'banner';

const OWN_STORAGE_HOST = 'luruhkwrgisytejswlas.supabase.co';

/** True when `url` is an absolute https address that is not our own storage. */
export function isThirdPartyImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname !== OWN_STORAGE_HOST;
  } catch {
    return false;
  }
}

/** FNV-1a, base 36: a short cache key for the stored address. Not a security measure. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Our proxied address for a listing's image. */
export function listingImagePath(slug: string, kind: ListingImageKind, sourceUrl: string): string {
  return `/api/listing-image?c=${encodeURIComponent(slug)}&k=${kind}&v=${shortHash(sourceUrl)}`;
}

/**
 * The address to draw a conference's logo or banner from. Pass the row (it needs `slug`,
 * `listed_by` and the url); everything that is not a listing's third-party image comes back as is.
 */
export function conferenceImageSrc(
  conf: { slug?: string | null; listed_by?: string | null } | null | undefined,
  kind: ListingImageKind,
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (conf?.listed_by !== 'gavelling' || !isThirdPartyImage(url)) return url;
  // A listing with no slug in hand cannot be proxied; draw nothing rather than hot-link.
  if (!conf.slug) return null;
  return listingImagePath(conf.slug, kind, url);
}
