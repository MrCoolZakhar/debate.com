import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import type { CVEntry } from '@/components/CVEntryModal';
import PublicCVClient, { type PublicProfile } from './PublicCVClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CvPayload { profile: PublicProfile | null; entries: CVEntry[] }

// Resolve a public CV from the [id] route param. Accepts BOTH forms:
//   • a raw user UUID (old links: /cv/<uuid>) — used directly, and
//   • a pretty slug (/cv/<name-slug>-<first8ofuuid>) — the trailing 8 hex
//     characters are resolved to a single user via get_public_cv_by_prefix.
// Runs entirely on the server so the page ships with data on first paint
// (no client RPC round-trip / spinner).
// Three answers, kept apart: a payload, `null` (no such public CV: a real
// 404), or 'error' (the read failed: render the page's own empty state rather
// than 404 a CV that exists over a transient blip).
const resolveCv = cache(async (idParam: string): Promise<CvPayload | null | 'error'> => {
  let raw: string;
  try { raw = decodeURIComponent(idParam).trim(); } catch { return null; }
  try {
    if (UUID_RE.test(raw)) {
      const { data, error } = await supabase.rpc('get_public_cv', { p_user_id: raw });
      if (error) return 'error';
      return (data as CvPayload) ?? null;
    }
    // Pretty slug — the id is the trailing run of 8 hex chars.
    const prefix = raw.match(/([0-9a-f]{8})$/i)?.[1];
    if (!prefix) return null;
    const { data, error } = await supabase.rpc('get_public_cv_by_prefix', { p_prefix: prefix });
    if (error) return 'error';
    return (data as CvPayload) ?? null;
  } catch {
    return 'error';
  }
});

/** No such public CV (as opposed to a failed read). */
function isMissing(r: CvPayload | null | 'error'): boolean {
  return r !== 'error' && !r?.profile;
}

// A public CV is a link people paste into chats and applications, so it needs
// its OWN og:url (this exact /cv/… path) and its own title — inheriting the
// root layout's would make every CV share one preview-cache entry.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const resolved = await resolveCv(id);
  if (isMissing(resolved)) {
    return pageMetadata({
      title: { absolute: 'MUN CV not found · Gavelling' },
      description: 'This Model UN CV does not exist or is no longer public.',
      path: `/cv/${id}`,
      robots: { index: false, follow: true },
    });
  }
  const profile = resolved === 'error' ? null : resolved?.profile ?? null;
  const name = (profile?.display_name ?? '').trim();

  return pageMetadata({
    title: { absolute: name ? `${name} · MUN CV · Gavelling` : 'MUN CV · Gavelling' },
    description: name
      ? `${name}'s Model UN record on Gavelling: committees, roles, conferences and awards.`
      : 'A Model UN delegate record on Gavelling.',
    path: `/cv/${id}`,
    ogTitle: name ? `${name} · Model UN CV` : 'Model UN CV',
  });
}

export default async function PublicCVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveCv(id);
  // An unknown or private CV is a real 404, not a 200 "empty CV" page (a
  // soft 404 in Search Console).
  if (isMissing(resolved)) notFound();
  const payload = resolved === 'error' ? null : resolved;

  const profile = payload?.profile ?? null;
  const entries: CVEntry[] = ((payload?.entries as CVEntry[]) ?? []).map((r) => ({
    ...r,
    entry_type: r.entry_type ?? 'delegate',
    awards: r.awards ?? [],
    photos: r.photos ?? [],
  }));

  return <PublicCVClient profile={profile} entries={entries} />;
}
