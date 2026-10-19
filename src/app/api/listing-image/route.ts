import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchListingImage } from '@/lib/listingImageFetch';
import { isThirdPartyImage } from '@/lib/listingImage';

/**
 * GET /api/listing-image?c=<slug>&k=<logo|banner>&v=<hash>
 *
 * Serves a Gavelling listing's logo or banner from OUR origin, so a visitor's browser never contacts
 * the conference's site or Wikimedia (CLAUDE.md §3). Built by `conferenceImageSrc`
 * (src/lib/listingImage.ts); nothing else should link here.
 *
 * Not an open proxy: it takes no URL. It reads the conference by slug, requires
 * `listed_by = 'gavelling'`, and fetches only the address in that row's column, through
 * fetchListingImage (https only, public hosts, image/* without SVG, 5 MB). `v` is only a cache key
 * (a hash of the stored address), so a new image gets a new URL.
 *
 * Cached hard at the CDN (a week in browsers, 30 days at the edge); a miss answers 404 for 5
 * minutes. The listing's row is read with the anon key: `conferences` is readable by link.
 */

export const dynamic = 'force-dynamic';

const HIT_CACHE = 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400';
const MISS_CACHE = 'public, max-age=300, s-maxage=300';

function miss(status = 404): Response {
  return new Response(null, { status, headers: { 'Cache-Control': MISS_CACHE } });
}

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get('c') ?? '').trim();
  const kind = request.nextUrl.searchParams.get('k');
  if (!slug || slug.length > 120 || !/^[a-z0-9-]+$/i.test(slug)) return miss(400);
  if (kind !== 'logo' && kind !== 'banner') return miss(400);

  const { data, error } = await supabase
    .from('conferences')
    .select('listed_by, logo_url, banner_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return miss(503);
  const row = data as { listed_by: string | null; logo_url: string | null; banner_url: string | null } | null;
  if (!row || row.listed_by !== 'gavelling') return miss();

  const source = kind === 'logo' ? row.logo_url : row.banner_url;
  if (!source || !isThirdPartyImage(source)) return miss();

  const image = await fetchListingImage(source, { timeoutMs: 8000 });
  if (!image) return miss();

  return new Response(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(image.bytes.byteLength),
      'Cache-Control': HIT_CACHE,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
      'X-Robots-Tag': 'noindex',
    },
  });
}
