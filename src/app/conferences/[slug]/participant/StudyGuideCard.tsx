'use client';

// Study guide card — the delegate's committee's study guide(s). Same data
// source the old documents tab used (study_guides table).

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT } from './shared';

interface StudyGuide {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
}

export default function StudyGuideCard({ committeeId }: { committeeId: string | null }) {
  const { session } = useAuth();
  const [guides, setGuides] = useState<StudyGuide[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!committeeId || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name')
      .eq('conference_committee_id', committeeId)
      .order('created_at', { ascending: true });
    setGuides((data ?? []) as StudyGuide[]);
    setLoading(false);
  }, [committeeId, session]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard>
      <p className="mb-3" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
        STUDY GUIDE
      </p>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      ) : !committeeId || guides.length === 0 ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          The study guide hasn&apos;t been released yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {guides.map(sg => (
            <a
              key={sg.id}
              href={sg.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: '38px', height: '38px', borderRadius: '11px', backgroundColor: 'rgba(27,56,40,0.07)' }}
              >
                <FileText size={16} style={{ color: '#1B3828' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{sg.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 500, margin: 0 }}>{sg.file_name}</p>
              </div>
              <Download size={15} style={{ color: '#9A8A78', flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
