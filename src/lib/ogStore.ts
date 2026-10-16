/**
 * Finished share cards, stored once on Supabase Storage's CDN (16 Oct 2026).
 *
 * WHY. A card not in Vercel's cache is a fresh serverless render (the DB, the
 * organiser's banner and logo fetched and re-encoded): about 1.5 to 2.5 s.
 * Vercel's CDN cache is REGIONAL, so the render-after-page-view in ogWarm.ts
 * only warms the region the server sits in. A sender in India, Egypt or
 * Bangladesh asked a cold edge, waited for the render on top of a 1 to 2.5 s
 * page, and WhatsApp sent the link with no picture. Previews kept "breaking"
 * for people far from the server.
 *
 * WHAT. The card route, after drawing a COMPLETE card (never a degraded one)
 * for the conference's CURRENT version, saves the JPEG to the public bucket
 * `og-cards` at `conference/<slug>/<version>.jpg`. The conference page then
 * points `og:image` straight at that stored file whenever it exists. The
 * stored file is served by Supabase's CDN from anywhere, with no render.
 * Until it exists the page keeps the route URL, which renders and saves it.
 *
 * Safe by construction:
 *  - the path carries the same version token as the route URL, so an edit to
 *    anything the card draws is a new file; nothing is ever overwritten with
 *    different content (and an old link keeps its old, correct picture);
 *  - only the server writes (service role; the bucket has no write policy);
 *  - only production writes, so a preview deployment can never pin its own
 *    drawing under a production path;
 *  - only the current version is saved, so a made-up token in a URL cannot
 *    fill the bucket;
 *  - every failure is swallowed: this is an optimisation, never a dependency.
 */
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const OG_CARD_BUCKET = 'og-cards';

/** Storage path of a conference card. Slugs are [a-z0-9-], tokens [a-z0-9-]. */
export function conferenceCardPath(slug: string, version: string): string {
  return `conference/${encodeURIComponent(slug)}/${encodeURIComponent(version)}.jpg`;
}

export function storedCardUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${OG_CARD_BUCKET}/${path}`;
}

/* Existence answers, per server instance. A file that exists never stops
   existing (versioned path), so a yes is remembered for good; a no is
   re-asked after a minute, by which time the route has usually saved it. */
const known = new Set<string>();
const missingUntil = new Map<string, number>();
const MAX_REMEMBERED = 5000;

/** True when the stored card is there. Never slower than `timeoutMs`; a slow or
 *  failed answer is a no (the page then falls back to the route URL). */
export async function storedCardExists(path: string, timeoutMs = 500): Promise<boolean> {
  if (!SUPABASE_URL) return false;
  if (known.has(path)) return true;
  const until = missingUntil.get(path);
  if (until && until > Date.now()) return false;
  try {
    const res = await fetch(storedCardUrl(path), {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (res.ok) {
      if (known.size >= MAX_REMEMBERED) known.clear();
      known.add(path);
      missingUntil.delete(path);
      return true;
    }
  } catch {
    // timeout or network: treat as missing for now
  }
  if (missingUntil.size >= MAX_REMEMBERED) missingUntil.clear();
  missingUntil.set(path, Date.now() + 60_000);
  return false;
}

/** Save a finished card. Production only; swallows every failure. */
export async function saveStoredCard(path: string, jpeg: Uint8Array): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key || jpeg.byteLength === 0) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${OG_CARD_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'image/jpeg',
        // a year: the path is versioned, so the bytes never change
        'Cache-Control': 'max-age=31536000',
        'x-upsert': 'true',
      },
      body: new Blob([jpeg as BlobPart], { type: "image/jpeg" }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (res.ok) {
      known.add(path);
      missingUntil.delete(path);
    }
  } catch {
    // an optimisation: the route URL keeps working without it
  }
}
