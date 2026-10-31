'use client';

import { useEffect, useState } from 'react';
import type { GifResponse } from '@/app/api/gifs/route';

export type { GifItem, GifResponse } from '@/app/api/gifs/route';

/* One probe per page load, shared by every composer. A failed probe reads as "disabled":
   the GIF button simply does not appear. */
let probe: Promise<boolean> | null = null;
function probeGifs(): Promise<boolean> {
  if (!probe) {
    probe = fetch('/api/gifs?probe=1')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => d.enabled === true)
      .catch(() => false);
  }
  return probe;
}

export function useGifsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    void probeGifs().then((v) => { if (alive) setEnabled(v); });
    return () => { alive = false; };
  }, []);
  return enabled;
}

/** One spelling per search (lower case, single spaces), so every viewer asking the same thing
 *  hits the same cached URL. A one-letter query is treated as trending. Trending carries no
 *  language, so it is one shared URL for everyone. */
export function normaliseGifQuery(q: string): string {
  const n = q.trim().toLowerCase().replace(/\s+/g, ' ');
  return n.length < 2 ? '' : n;
}

export async function fetchGifs(q: string, offset: number, lang: string, signal: AbortSignal): Promise<GifResponse> {
  const n = normaliseGifQuery(q);
  const p = new URLSearchParams({ offset: String(offset) });
  if (n) { p.set('q', n); p.set('lang', lang); }
  const r = await fetch(`/api/gifs?${p}`, { signal });
  const d = await r.json() as GifResponse;
  if (!r.ok && !d.error) d.error = 'provider';
  return d;
}
