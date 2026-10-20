'use client';

// The study guides of one or more committees, for the delegate's You page
// (5A's Study guide card, 5B's Study guides card). The same two reads the
// classic StudyGuideCard makes: the `study_guides` rows (RLS shows a delegate
// the published guides of a committee they sit in) and the committee's own
// release date (`conference_committees.study_guides_publish_at`, readable by
// any participant). A committee whose guides RLS hides reads as "no guide
// yet", never as an error.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { openStudyGuide } from '@/lib/studyGuideFiles';
import { notifyErr } from '@/lib/appNotify';

export interface GuideFile {
  id: string;
  title: string;
  file_url: string;
}

export interface CommitteeGuides {
  guides: GuideFile[];
  releaseAt: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Jan", the short date the You page uses. */
export function shortDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Guides per committee id; null while the first read is out or after it failed. */
export function useCommitteeGuides(committeeIds: string[]): Map<string, CommitteeGuides> | null {
  const key = [...new Set(committeeIds.filter(Boolean))].sort().join(',');
  const [loaded, setLoaded] = useState<{ key: string; map: Map<string, CommitteeGuides> } | null>(null);

  useEffect(() => {
    if (!key) return;
    const ids = key.split(',');
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const [{ data: guideRows, error: guideErr }, { data: ccRows, error: ccErr }] = await Promise.all([
        client.from('study_guides').select('id, title, file_url, conference_committee_id')
          .in('conference_committee_id', ids).order('created_at', { ascending: true }),
        client.from('conference_committees').select('id, study_guides_publish_at').in('id', ids),
      ]);
      if (cancelled || guideErr || ccErr) return;
      const map = new Map<string, CommitteeGuides>();
      for (const id of ids) map.set(id, { guides: [], releaseAt: null });
      for (const r of (ccRows ?? []) as { id: string; study_guides_publish_at: string | null }[]) {
        const entry = map.get(r.id);
        if (entry) entry.releaseAt = r.study_guides_publish_at;
      }
      for (const g of (guideRows ?? []) as (GuideFile & { conference_committee_id: string })[]) {
        map.get(g.conference_committee_id)?.guides.push({ id: g.id, title: g.title, file_url: g.file_url });
      }
      setLoaded({ key, map });
    })().catch(() => { /* stays null: the cards show their quiet state */ });
    return () => { cancelled = true; };
  }, [key]);

  return key && loaded?.key === key ? loaded.map : null;
}

/** Opens a guide from a click. The `study-guides` bucket is private, so the tab
 *  opens inside the click and is then pointed at a signed URL minted for the
 *  viewer (getAuthedClient sends the SDK's current token at request time). */
export function useOpenStudyGuide(): (fileUrl: string) => void {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useCallback((fileUrl: string) => {
    if (!token) { notifyErr("This file can't be opened right now", 'study-guides'); return; }
    void openStudyGuide(getAuthedClient(token), fileUrl).then(ok => {
      if (!ok) notifyErr("This file can't be opened right now", 'study-guides');
    });
  }, [token]);
}

/** One line for a committee's guide: released (with a link), out on a date, or not out yet. */
export function guideState(entry: CommitteeGuides | undefined, now: number): { kind: 'open'; line: string } | { kind: 'scheduled' | 'none'; line: string } {
  const releaseAt = entry?.releaseAt ?? null;
  const releaseMs = releaseAt ? new Date(releaseAt).getTime() : null;
  // A guide RLS lets this person read is out (the classic card shows it too).
  if (entry && entry.guides.length > 0) {
    return { kind: 'open', line: releaseAt && releaseMs !== null && releaseMs <= now ? `Released ${shortDay(releaseAt)}` : 'Ready to read' };
  }
  if (releaseAt && releaseMs !== null && releaseMs > now) return { kind: 'scheduled', line: `Out ${shortDay(releaseAt)}` };
  return { kind: 'none', line: 'Not out yet' };
}
