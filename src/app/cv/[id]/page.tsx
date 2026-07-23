import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import type { CVEntry } from '@/components/CVEntryModal';
import PublicCVClient, { type PublicProfile } from './PublicCVClient';

export const metadata: Metadata = {
  title: 'MUN CV · Gavelling',
  description: 'A Model UN delegate record on Gavelling.',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CvPayload { profile: PublicProfile | null; entries: CVEntry[] }

// Resolve a public CV from the [id] route param. Accepts BOTH forms:
//   • a raw user UUID (old links: /cv/<uuid>) — used directly, and
//   • a pretty slug (/cv/<name-slug>-<first8ofuuid>) — the trailing 8 hex
//     characters are resolved to a single user via get_public_cv_by_prefix.
// Runs entirely on the server so the page ships with data on first paint
// (no client RPC round-trip / spinner).
async function resolveCv(idParam: string): Promise<CvPayload | null> {
  const raw = decodeURIComponent(idParam).trim();
  try {
    if (UUID_RE.test(raw)) {
      const { data } = await supabase.rpc('get_public_cv', { p_user_id: raw });
      return (data as CvPayload) ?? null;
    }
    // Pretty slug — the id is the trailing run of 8 hex chars.
    const prefix = raw.match(/([0-9a-f]{8})$/i)?.[1];
    if (!prefix) return null;
    const { data } = await supabase.rpc('get_public_cv_by_prefix', { p_prefix: prefix });
    return (data as CvPayload) ?? null;
  } catch {
    return null;
  }
}

export default async function PublicCVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await resolveCv(id);

  const profile = payload?.profile ?? null;
  const entries: CVEntry[] = ((payload?.entries as CVEntry[]) ?? []).map((r) => ({
    ...r,
    entry_type: r.entry_type ?? 'delegate',
    awards: r.awards ?? [],
    photos: r.photos ?? [],
  }));

  return <PublicCVClient profile={profile} entries={entries} />;
}
