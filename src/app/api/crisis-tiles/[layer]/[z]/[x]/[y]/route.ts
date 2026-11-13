// Gavelling Crisis: map tiles of a historical map, proxied from our own origin so a visitor's browser never contacts a third
// party (CLAUDE.md §3). Only the layers listed in LAYERS are served; the address is built here from validated numbers, never
// from the request, so this is not an open proxy.
//   etatmajor: IGN's État-major map of France (1820 to 1866), Géoplateforme WMTS, Web Mercator, zoom 6 to 15.

import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAYERS: Record<string, { layer: string; minZ: number; maxZ: number }> = {
  etatmajor: { layer: 'GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40', minZ: 6, maxZ: 15 },
};

const HIT = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800';
const MISS = 'public, max-age=86400, s-maxage=86400';
const FETCH_TIMEOUT_MS = 8000;

function empty(status: number, cache: string): Response {
  return new Response(null, { status, headers: { 'Cache-Control': cache } });
}

function int(raw: string): number | null {
  return /^\d{1,8}$/.test(raw) ? Number(raw) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }) {
  const p = await params;
  const spec = Object.prototype.hasOwnProperty.call(LAYERS, p.layer) ? LAYERS[p.layer] : null;
  if (!spec) return empty(404, MISS);
  const z = int(p.z);
  const x = int(p.x);
  const y = int(p.y.replace(/\.jpe?g$/i, ''));
  if (z === null || x === null || y === null || z < spec.minZ || z > spec.maxZ) return empty(400, 'no-store');
  const n = 2 ** z;
  if (x >= n || y >= n) return empty(400, 'no-store');

  const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
    + `&LAYER=${spec.layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/jpeg`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'image/jpeg' } });
    // Outside the map's coverage IGN answers 400 or 404: show nothing there, and do not ask again for a day.
    if (res.status === 404 || res.status === 400) return empty(404, MISS);
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return empty(502, 'no-store');
    const bytes = new Uint8Array(await res.arrayBuffer());
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': HIT,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return empty(502, 'no-store');
  } finally {
    clearTimeout(timer);
  }
}
