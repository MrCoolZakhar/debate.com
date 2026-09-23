// Shared helpers for the position paper chat/review system. The DB layer
// (position_papers.delegate_seen_at / reviewer_seen_at, position_paper_messages,
// the mark_paper_seen / log_paper_system_message RPCs) is already deployed;
// this module only holds pure logic and small batch fetchers reused by the
// organizer Documents roster, the chair roster, and the delegate card.

import type { getAuthedClient } from '@/lib/supabase-auth';

type SupabaseLike = ReturnType<typeof getAuthedClient>;

export interface PaperMessageStub {
  sender_user_id: string;
  created_at: string;
}

/** The storage key inside the `position-papers` bucket, from the URL stored in
 *  `position_papers.file_url` (always the bucket's public-URL form). */
export function positionPaperPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const marker = '/position-papers/';
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;
  const path = fileUrl.slice(i + marker.length).split(/[?#]/)[0];
  try { return decodeURIComponent(path); } catch { return path; }
}

/** The bucket is private (23 Sep 2026): a paper is opened through a short-lived
 *  signed URL minted for the viewer, which storage grants only to the author,
 *  their seatmates, the committee's chairs and the conference's organisers.
 *  Falls back to the stored URL when signing fails, so nothing throws. */
export async function signedPositionPaperUrl(
  supabase: SupabaseLike,
  fileUrl: string,
  expiresInSeconds = 4 * 60 * 60,
): Promise<string> {
  const path = positionPaperPath(fileUrl);
  if (!path) return fileUrl;
  const { data, error } = await supabase.storage.from('position-papers').createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return fileUrl;
  return data.signedUrl;
}

/** A paper is late when it was submitted after its committee's deadline.
 *  Informational only, never blocks anything. */
export function isPaperLate(submittedAt: string | null, deadline: string | null): boolean {
  if (!submittedAt || !deadline) return false;
  return new Date(submittedAt).getTime() > new Date(deadline).getTime();
}

/** Messages newer than the viewer's side's seen stamp, sent by someone else.
 *  A null stamp means "never seen", so everything from others counts. */
export function countUnread(messages: PaperMessageStub[], seenAt: string | null, currentUserId: string): number {
  const threshold = seenAt ? new Date(seenAt).getTime() : -Infinity;
  return messages.filter(m => m.sender_user_id !== currentUserId && new Date(m.created_at).getTime() > threshold).length;
}

/** Batch-fetches (sender, created_at) stubs for every message across a set of
 *  papers in one query, grouped by paper_id — used by roster views so an
 *  unread count can be computed per row without one query per paper. */
export async function fetchMessageStubsForPapers(
  supabase: SupabaseLike,
  paperIds: string[]
): Promise<Record<string, PaperMessageStub[]>> {
  if (paperIds.length === 0) return {};
  const { data } = await supabase
    .from('position_paper_messages')
    .select('paper_id, sender_user_id, created_at')
    .in('paper_id', paperIds);
  const map: Record<string, PaperMessageStub[]> = {};
  for (const row of (data ?? []) as { paper_id: string; sender_user_id: string; created_at: string }[]) {
    (map[row.paper_id] ??= []).push({ sender_user_id: row.sender_user_id, created_at: row.created_at });
  }
  return map;
}
