'use client';

// Study guide card, the delegate's committee's study guide(s). Same data
// source the old documents tab used (study_guides table).

import { useState, useEffect, useCallback } from 'react';
import { useNow } from '@/lib/useNow';
import { FileText, Download } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT } from './shared';
import { CardHeading, INK_SOFT } from './dashboardKit';
import Loader from '@/components/Loader';
import { openStudyGuide } from '@/lib/studyGuideFiles';
import { notifyErr } from '@/lib/appNotify';

interface StudyGuide {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function StudyGuideCard({ committeeId }: { committeeId: string | null }) {
  const now = useNow();
  const { session } = useAuth();
  const [guides, setGuides] = useState<StudyGuide[]>([]);
  const [releaseAt, setReleaseAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!committeeId || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data: guideData }, { data: ccData }] = await Promise.all([
      supabase
        .from('study_guides')
        .select('id, title, file_url, file_name')
        .eq('conference_committee_id', committeeId)
        .order('created_at', { ascending: true }),
      // conference_committees is participant-readable, the same schedule
      // the organizer sets in Documents settings.
      supabase.from('conference_committees').select('study_guides_publish_at').eq('id', committeeId).maybeSingle(),
    ]);
    setGuides((guideData ?? []) as StudyGuide[]);
    setReleaseAt((ccData as { study_guides_publish_at: string | null } | null)?.study_guides_publish_at ?? null);
    setLoading(false);
  }, [committeeId, session]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  // The bucket is private: the tab opens inside the click, then gets a signed URL.
  function openGuide(fileUrl: string) {
    if (!session) return;
    void openStudyGuide(getAuthedClient(session.access_token), fileUrl).then(ok => {
      if (!ok) notifyErr("This file can't be opened right now", 'study-guides');
    });
  }

  // useNow ticks every minute, so a scheduled guide flips to released while the page is open.
  const scheduled = !!releaseAt && new Date(releaseAt).getTime() > now;

  return (
    <SectionCard>
      <CardHeading title="Study Guide" />
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader size={36} />
        </div>
      ) : !committeeId || guides.length === 0 ? (
        <p style={{ color: INK_SOFT, fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {scheduled ? `Releases ${fmtDate(releaseAt!)}.` : "The study guide hasn't been released yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {guides.map(sg => (
            <button
              key={sg.id}
              type="button"
              onClick={() => openGuide(sg.file_url)}
              className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer focus:outline-none"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 5%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: '38px', height: '38px', borderRadius: '11px', backgroundColor: 'color-mix(in srgb, var(--gv-main) 7%, transparent)' }}
              >
                <FileText size={16} style={{ color: 'var(--gv-main)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p title={sg.title} style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere', margin: 0 }}>{sg.title}</p>
                <p style={{ color: INK_SOFT, fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, margin: '3px 0 0', overflowWrap: 'anywhere' }}>{sg.file_name}</p>
              </div>
              <Download size={15} style={{ color: '#9A8A78', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
