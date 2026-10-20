// Study guide files (20 Oct 2026): the `study-guides` bucket is private, so a
// guide is opened through a short-lived signed URL minted for the viewer. Storage
// grants it only to someone who can read the guide's `study_guides` row (the
// release-date rule: seated delegates, chairs, delegation members, organisers),
// see scratch-private-buckets.sql. The stored `study_guides.file_url` stays the
// bucket's public-URL form; the object path is derived from it.
// The twin for papers is src/lib/positionPapers.ts.

import type { getAuthedClient } from '@/lib/supabase-auth';

type SupabaseLike = ReturnType<typeof getAuthedClient>;

export const STUDY_GUIDES_BUCKET_ID = 'study-guides';

/** The storage key inside the `study-guides` bucket, from a stored file_url. */
export function studyGuidePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const marker = '/study-guides/';
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;
  const path = fileUrl.slice(i + marker.length).split(/[?#]/)[0];
  try { return decodeURIComponent(path); } catch { return path; }
}

/** A signed URL for a guide, or null when it cannot be signed (no access, a
 *  relative seed path, or a network failure). Never throws. */
export async function signedStudyGuideUrl(
  supabase: SupabaseLike,
  fileUrl: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const path = studyGuidePath(fileUrl);
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from(STUDY_GUIDES_BUCKET_ID).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Opens a guide in a new tab from a click. The tab is opened INSIDE the click,
 *  before any await, so browsers never block it, then pointed at the signed URL.
 *  Returns false (and closes the empty tab) when the guide cannot be opened. */
export async function openStudyGuide(supabase: SupabaseLike, fileUrl: string | null | undefined): Promise<boolean> {
  const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
  const url = await signedStudyGuideUrl(supabase, fileUrl, 10 * 60);
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) {
    try { tab.opener = null; } catch { /* cross-origin after navigation; harmless */ }
    tab.location.href = url;
  } else {
    window.location.href = url;
  }
  return true;
}
