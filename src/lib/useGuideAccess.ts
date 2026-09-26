'use client';

// useGuideAccess.ts — which premium guides the signed-in reader can read
// (26 Sep 2026), for the surfaces that LIST guides and for the guide page's
// contents list. One guide_access(p_slug) per slug per account per page load,
// shared by every mounted reader (module cache of promises). PremiumBody
// primes the cache with its own read, and an unlock re-reads, so the card,
// the mark and the contents list follow at once. Signed out: nothing.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchGuideAccess, type GuideAccess } from '@/lib/guideAccess';

const cache = new Map<string, Promise<GuideAccess | null>>();
const EVENT = 'gavelling-guide-access';

function keyOf(userId: string, slug: string) { return `${userId}|${slug}`; }

function read(userId: string, slug: string): Promise<GuideAccess | null> {
  const k = keyOf(userId, slug);
  let p = cache.get(k);
  if (!p) {
    p = fetchGuideAccess(slug).then(a => {
      // A failed read is not cached, so the next mount asks again.
      if (!a) cache.delete(k);
      return a;
    });
    cache.set(k, p);
  }
  return p;
}

/** Store an answer already in hand (PremiumBody's own read) and tell readers. */
export function primeGuideAccess(userId: string, slug: string, a: GuideAccess | null) {
  if (!a) return;
  const k = keyOf(userId, slug);
  cache.set(k, Promise.resolve(a));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: k }));
}

/** Access for several guides; a slug is absent until its answer arrives. */
export function useGuideAccessMap(slugs: readonly string[]): Record<string, GuideAccess> {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [answers, setAnswers] = useState<{ user: string | null; map: Record<string, GuideAccess> }>({ user: null, map: {} });
  const [tick, setTick] = useState(0);
  const slugKey = slugs.join(',');

  useEffect(() => {
    const on = () => setTick(t => t + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    const list = slugKey ? slugKey.split(',') : [];
    void Promise.all(list.map(s => read(userId, s).then(a => [s, a] as const))).then(pairs => {
      if (cancelled) return;
      const map: Record<string, GuideAccess> = {};
      for (const [s, a] of pairs) if (a) map[s] = a;
      setAnswers({ user: userId, map });
    });
    return () => { cancelled = true; };
  }, [userId, loading, slugKey, tick]);

  // Signed out, or answers that belong to another account, count as none.
  return userId && answers.user === userId ? answers.map : {};
}

export function useGuideAccess(slug: string): GuideAccess | null {
  const map = useGuideAccessMap([slug]);
  return map[slug] ?? null;
}
