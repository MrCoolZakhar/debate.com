// Where a chair goes to DECIDE awards. Awards are a conference feature: the slate is
// chosen on the chair's conference page and published by the secretariat. The live
// session only signposts that page — it never hosts award UI itself, and it never
// shows anything award-related in an anonymous standalone session (the callers gate
// on `committee.sessionOrigin === 'conference'`; this helper only resolves the URL).
//
// Resolution is anonymous on purpose: `conference_committees.session_code` → the
// conference slug. That row is readable to anon only for public conferences, so for a
// private conference (or a transient failure) we fall back to /my-conferences, the
// signed-in chair's hub, which lists every committee they chair. Never throws.
import { supabase } from '@/lib/supabase';

const FALLBACK_HREF = '/my-conferences';
const cache = new Map<string, Promise<string>>();

export function chairAwardsHrefForSlug(slug: string): string {
  return `/conferences/${encodeURIComponent(slug)}/role/chair#awards`;
}

export async function resolveChairAwardsHref(code: string): Promise<string> {
  const key = (code ?? '').toUpperCase();
  if (!key) return FALLBACK_HREF;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = (async () => {
    try {
      const { data } = await supabase
        .from('conference_committees')
        .select('conference_id, conferences(slug)')
        .eq('session_code', key)
        .maybeSingle();
      const conf = (data as { conferences?: { slug?: string } | { slug?: string }[] | null } | null)?.conferences;
      const slug = Array.isArray(conf) ? conf[0]?.slug : conf?.slug;
      return slug ? chairAwardsHrefForSlug(slug) : FALLBACK_HREF;
    } catch {
      return FALLBACK_HREF;
    }
  })();
  cache.set(key, pending);
  // A fallback produced by a transient failure should not be pinned for the session.
  pending.then((href) => { if (href === FALLBACK_HREF) cache.delete(key); });
  return pending;
}
