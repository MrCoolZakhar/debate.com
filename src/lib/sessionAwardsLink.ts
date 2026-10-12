// Where a chair goes to DECIDE awards, and whether to point them there at all.
//
// Awards are a conference feature: the slate is chosen on the chair's conference
// page and published by the secretariat. The live session only signposts that
// page. It never hosts award UI itself, and it never shows anything award-related
// in an anonymous standalone session (callers gate on
// `committee.sessionOrigin === 'conference'`).
//
// SET-UP GATE (owner, 11 Oct 2026: "If a conference does not set up awards, never
// offer it to chairs"): `resolveChairAwards` also answers `offered`, true only when
// the conference's `awards_config` is set up and gives THIS committee at least one
// award (`awardsOfferedFor` in src/lib/awards.ts). Every signpost renders only on
// `offered`. A failed lookup is `offered: false` (fail closed: no signpost).
//
// Resolution is anonymous on purpose: `conference_committees.session_code` → the
// conference slug and its awards_config (anon may read both). Never throws.
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { awardsOfferedFor, getAwardsConfig } from '@/lib/awards';

const FALLBACK_HREF = '/account/conferences';

export interface ChairAwardsTarget {
  href: string;
  offered: boolean;
}

const cache = new Map<string, Promise<ChairAwardsTarget>>();

export function chairAwardsHrefForSlug(slug: string): string {
  return `/conferences/${encodeURIComponent(slug)}/role/chair#awards`;
}

export async function resolveChairAwards(code: string): Promise<ChairAwardsTarget> {
  const key = (code ?? '').toUpperCase();
  if (!key) return { href: FALLBACK_HREF, offered: false };
  const hit = cache.get(key);
  if (hit) return hit;
  let failed = false;
  const pending = (async (): Promise<ChairAwardsTarget> => {
    try {
      const { data, error } = await supabase
        .from('conference_committees')
        .select('id, conference_id, conferences(slug, awards_config)')
        .eq('session_code', key)
        .maybeSingle();
      if (error) { failed = true; return { href: FALLBACK_HREF, offered: false }; }
      const row = data as { id?: string; conferences?: { slug?: string; awards_config?: unknown } | { slug?: string; awards_config?: unknown }[] | null } | null;
      const conf = Array.isArray(row?.conferences) ? row?.conferences[0] : row?.conferences;
      const offered = !!row?.id && awardsOfferedFor(getAwardsConfig(conf?.awards_config), row.id);
      return { href: conf?.slug ? chairAwardsHrefForSlug(conf.slug) : FALLBACK_HREF, offered };
    } catch {
      failed = true;
      return { href: FALLBACK_HREF, offered: false };
    }
  })();
  cache.set(key, pending);
  // A transient failure is not pinned for the session; neither is any answer for
  // long, so an organiser switching awards on reaches an open room on its next read.
  pending.then(() => {
    if (failed) cache.delete(key);
    else setTimeout(() => { if (cache.get(key) === pending) cache.delete(key); }, 5 * 60_000);
  });
  return pending;
}

/** Kept for callers that only need the URL. */
export async function resolveChairAwardsHref(code: string): Promise<string> {
  return (await resolveChairAwards(code)).href;
}

/**
 * The signposts' one read: `null` until answered, then the target. Pass
 * `enabled = false` for a standalone session and nothing is read.
 */
export function useChairAwards(code: string | null | undefined, enabled: boolean): ChairAwardsTarget | null {
  const [target, setTarget] = useState<{ code: string; value: ChairAwardsTarget } | null>(null);
  useEffect(() => {
    if (!enabled || !code) return;
    let cancelled = false;
    void resolveChairAwards(code).then((v) => { if (!cancelled) setTarget({ code, value: v }); });
    return () => { cancelled = true; };
  }, [code, enabled]);
  if (!enabled || !code || !target || target.code !== code) return null;
  return target.value;
}
