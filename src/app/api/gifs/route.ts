import { NextResponse, type NextRequest } from 'next/server';

/**
 * GIF search for the session chat, proxied to GIPHY.
 *
 *   GET /api/gifs?probe=1           → { enabled }
 *   GET /api/gifs?offset=0          → trending
 *   GET /api/gifs?q=vote&offset=24  → search
 *
 * The key is `GIPHY_API_KEY`, a SERVER-ONLY env var (no NEXT_PUBLIC_ prefix): it never reaches
 * a browser. Without it every call answers `{ enabled: false, items: [] }` with status 200 and
 * the chat hides its GIF button, so a missing key is not an error anywhere.
 *
 * Responses are trimmed to what the picker and a message need, cached in memory for 60 s
 * (LRU, per server instance) and marked cacheable for 60 s at the edge. A light per-IP limit
 * stops one client hammering the provider's quota.
 *
 * Privacy: this route sends GIPHY only the search text, never the viewer's IP (the request
 * comes from our server). The GIF IMAGES, however, load from GIPHY's CDN in the viewer's
 * browser, so the viewer's IP does reach GIPHY. See AGENTS.md → FEATURE: CHAT.
 */

export const dynamic = 'force-dynamic';

const PAGE = 24;
const MAX_OFFSET = 499; // GIPHY's beta keys cap offset; we also cap how deep a picker scrolls.
const TTL_MS = 60_000;
const CACHE_MAX = 300;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 90;

export interface GifRendition { url: string; width: number; height: number }
export interface GifItem { id: string; title: string; preview: GifRendition; send: GifRendition; original: GifRendition }
export interface GifResponse { enabled: boolean; items: GifItem[]; next: number | null; error?: string }

const cache = new Map<string, { at: number; data: GifResponse }>();
const hits = new Map<string, { start: number; count: number }>();
const HITS_MAX = 5000;
const PRUNE_EVERY = 200;
let sincePrune = 0;

/** Drop expired windows. Runs every PRUNE_EVERY requests whatever the map's size. */
function pruneHits(now: number): void {
  for (const [k, v] of hits) if (now - v.start > RATE_WINDOW_MS) hits.delete(k);
}

function limited(ip: string): boolean {
  const now = Date.now();
  if (++sincePrune >= PRUNE_EVERY) { sincePrune = 0; pruneHits(now); }
  const h = hits.get(ip);
  if (!h || now - h.start > RATE_WINDOW_MS) {
    // Re-insert so Map order is window-start order: the first key is always the oldest.
    hits.delete(ip);
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > HITS_MAX) pruneHits(now);
    // Still over the cap (a burst of distinct IPs inside one window): drop the oldest.
    while (hits.size > HITS_MAX) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
    return false;
  }
  h.count += 1;
  return h.count > RATE_MAX;
}

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyGif = { id: string; title?: string; images?: Record<string, GiphyImage | undefined> };

function rendition(img: GiphyImage | undefined, preferWebp: boolean): GifRendition | null {
  if (!img) return null;
  const url = (preferWebp && img.webp) || img.url;
  const width = Number(img.width);
  const height = Number(img.height);
  if (!url || !url.startsWith('https://') || !(width > 0) || !(height > 0)) return null;
  // Strip GIPHY's tracking query (cid, rid, ct); the media URL works without it.
  return { url: url.split('?')[0], width, height };
}

function trim(g: GiphyGif): GifItem | null {
  const im = g.images ?? {};
  const preview = rendition(im.fixed_width_small, true) ?? rendition(im.fixed_width, true);
  const send = rendition(im.fixed_width, true) ?? preview;
  const original = rendition(im.original, false) ?? rendition(im.downsized, false) ?? send;
  if (!preview || !send || !original) return null;
  return { id: g.id, title: (g.title ?? '').slice(0, 120), preview, send, original };
}

function json(data: GifResponse, status = 200, cacheable = true) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': cacheable ? 'public, max-age=60, s-maxage=60' : 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return json({ enabled: false, items: [], next: null }, 200, false);

  const sp = req.nextUrl.searchParams;
  if (sp.get('probe')) return json({ enabled: true, items: [], next: null });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  if (limited(ip)) return json({ enabled: true, items: [], next: null, error: 'rate_limited' }, 429, false);

  const q = (sp.get('q') ?? '').trim().slice(0, 50);
  const offsetRaw = Number.parseInt(sp.get('offset') ?? '0', 10);
  const offset = Number.isFinite(offsetRaw) ? Math.min(MAX_OFFSET, Math.max(0, offsetRaw)) : 0;
  const lang = (sp.get('lang') ?? 'en').slice(0, 2).replace(/[^a-z]/g, '') || 'en';

  const cacheKey = `${q.toLowerCase()}|${offset}|${lang}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < TTL_MS) {
    cache.delete(cacheKey); // LRU: move to the newest end
    cache.set(cacheKey, cached);
    return json(cached.data);
  }

  const params = new URLSearchParams({
    api_key: key, limit: String(PAGE), offset: String(offset), rating: 'pg-13', bundle: 'messaging_non_clips',
  });
  if (q) { params.set('q', q); params.set('lang', lang); }
  const endpoint = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?${params}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(endpoint, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return json({ enabled: true, items: [], next: null, error: 'provider' }, 502, false);
    const body = await res.json() as { data?: GiphyGif[]; pagination?: { total_count?: number; count?: number; offset?: number } };
    const items = (body.data ?? []).map(trim).filter((x): x is GifItem => x != null);
    const count = body.pagination?.count ?? body.data?.length ?? 0;
    const total = body.pagination?.total_count ?? 0;
    const nextOffset = offset + count;
    const next = count > 0 && nextOffset < total && nextOffset <= MAX_OFFSET ? nextOffset : null;
    const data: GifResponse = { enabled: true, items, next };
    cache.set(cacheKey, { at: now, data });
    while (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return json(data);
  } catch {
    return json({ enabled: true, items: [], next: null, error: 'provider' }, 502, false);
  }
}
