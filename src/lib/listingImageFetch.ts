import 'server-only';

/**
 * The one way our server fetches a Gavelling listing's third-party image (src/lib/listingImage.ts).
 * Used by /api/listing-image (visitors' pages) and by the share card route (src/app/api/og).
 *
 * The address comes from `conferences.logo_url` / `banner_url` of a `listed_by = 'gavelling'` row,
 * written only by the staff RPC `upsert_gavelling_listing` (https, at most 500 characters). Even so
 * it is treated as untrusted, because this is a fetch made by our server:
 *   - https only, port 443, no user:password, a real host name (never an IP literal, localhost,
 *     *.local / *.internal, or a single-label name);
 *   - redirects followed by hand, at most 3, each hop checked the same way;
 *   - the answer must be image/jpeg, png, webp, gif or avif (never SVG, which can carry script);
 *   - at most MAX_LISTING_IMAGE_BYTES, enforced while streaming, not only by Content-Length;
 *   - a timeout over the whole fetch, body included.
 * Returns null on any problem: a listing with no picture is a design case, not an error.
 */

export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const USER_AGENT = 'GavellingBot/1.0 (+https://gavelling.com)';

export interface ListingImage {
  bytes: Buffer;
  contentType: string;
}

/** True for an https URL on a public-looking host name. */
export function isFetchableListingUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  if (!host || !host.includes('.')) return false;
  // IPv4 literal, IPv6 literal (brackets), or anything that ends in a digit-only label.
  if (/^\d+(\.\d+){3}$/.test(host) || host.startsWith('[') || /\.\d+$/.test(host)) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return false;
  return true;
}

async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > cap) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return total === 0 ? null : Buffer.concat(chunks);
}

export async function fetchListingImage(
  url: string | null | undefined,
  { timeoutMs = 6000, maxBytes = MAX_LISTING_IMAGE_BYTES }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<ListingImage | null> {
  if (!url || !isFetchableListingUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9' },
        // The CDN in front of our route is the cache; never keep these in Next's data cache.
        cache: 'no-store',
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        if (!next) return null;
        const resolved = new URL(next, current).toString();
        if (!isFetchableListingUrl(resolved)) return null;
        current = resolved;
        continue;
      }
      if (!res.ok) return null;
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.has(type)) return null;
      const bytes = await readCapped(res, maxBytes);
      if (!bytes) return null;
      return { bytes, contentType: type === 'image/jpg' ? 'image/jpeg' : type };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
