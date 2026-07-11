'use client';

// Study guides + position paper submission — moved verbatim out of
// ConferenceDetailClient's old "Documents" tab. Self-contained: owns its own
// data loading and upload flow, driven only by the conference id and the
// caller's committee allocation (delegate-only; chairs/observers never have
// one, so this quietly shows the "not allocated yet" notice for them).

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Download, Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantAllocation } from './types';

interface StudyGuide {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  is_published: boolean;
}

interface PositionPaper {
  id: string;
  status: string;
  chair_feedback: string | null;
  submitted_at: string;
  file_name: string;
}

const ppStatusMap: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

const ppMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${ppMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function DocumentsSection({ conferenceId, myAllocation }: {
  conferenceId: string;
  myAllocation: ParticipantAllocation | null;
}) {
  const { user, session } = useAuth();

  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [studyGuidesLoading, setStudyGuidesLoading] = useState(false);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [myPositionPaper, setMyPositionPaper] = useState<PositionPaper | null>(null);
  const [ppFile, setPPFile] = useState<File | null>(null);
  const [ppUploading, setPPUploading] = useState(false);
  const [ppError, setPPError] = useState('');
  const [ppNotify, setPPNotify] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showPPWarning, setShowPPWarning] = useState(false);
  const ppFileInputRef = useRef<HTMLInputElement>(null);

  const loadDocumentsData = useCallback(async () => {
    if (!myAllocation || !session) return;
    setStudyGuidesLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data: sgData } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name, is_published')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .order('created_at', { ascending: true });
    setStudyGuides((sgData ?? []) as StudyGuide[]);
    const { data: ccData } = await supabase
      .from('conference_committees')
      .select('pp_submissions_enabled')
      .eq('id', myAllocation.conference_committee_id)
      .single();
    setPpEnabled((ccData as { pp_submissions_enabled?: boolean } | null)?.pp_submissions_enabled ?? false);
    setStudyGuidesLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAllocation?.conference_committee_id, session?.access_token]);

  useEffect(() => { loadDocumentsData(); }, [loadDocumentsData]);

  const loadMyPositionPaper = useCallback(async () => {
    if (!user || !myAllocation || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('position_papers')
      .select('id, status, chair_feedback, submitted_at, file_name, notify_on_feedback')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .eq('user_id', user.id)
      .maybeSingle();
    setMyPositionPaper((data as PositionPaper | null) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, myAllocation?.conference_committee_id, session?.access_token]);

  useEffect(() => { loadMyPositionPaper(); }, [loadMyPositionPaper]);

  function handlePPFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setPPError('Only PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPPError('File must be under 5MB.'); return; }
    setPPError('');
    setPPFile(file);
  }

  async function handlePPSubmit() {
    if (!ppFile || !myAllocation || !user || !session) return;
    setPPUploading(true);
    const supabase = getAuthedClient(session.access_token);
    if (myPositionPaper) {
      await supabase.from('position_papers').delete().eq('id', myPositionPaper.id);
    }
    const path = `${conferenceId}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { setPPError('Upload failed.'); setPPUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('position-papers').getPublicUrl(path);
    await supabase.from('position_papers').insert({
      conference_committee_id: myAllocation.conference_committee_id,
      user_id: user.id,
      country_code: myAllocation.country_code,
      country_name: myAllocation.country_name,
      file_url: publicUrl,
      file_name: ppFile.name,
      file_size_bytes: ppFile.size,
      status: 'submitted',
      notify_on_feedback: ppNotify,
    });
    setPPUploading(false);
    setPPFile(null);
    setIsReplacing(false);
    await loadMyPositionPaper();
  }

  if (!myAllocation) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center text-center py-10">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}
          >
            <Lock size={24} strokeWidth={1.8} style={{ color: '#1B3828' }} />
          </div>
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Documents are locked
          </p>
          <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Study guides and position paper submissions unlock once you receive your committee allocation.
          </p>
        </div>
      </SectionCard>
    );
  }

  const deadline = myAllocation.conference_committees?.position_paper_deadline ?? null;
  const deadlineSoon = deadline ? (new Date(deadline).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 && new Date(deadline) > new Date() : false;
  const showUploadForm = !myPositionPaper || isReplacing;

  return (
    <div className="flex flex-col gap-6">
      {/* Study Guides */}
      <SectionCard>
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
          STUDY GUIDES
        </p>
        {studyGuidesLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          </div>
        ) : studyGuides.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            No study guides have been published yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {studyGuides.map(sg => (
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

      {/* Position Paper */}
      <SectionCard>
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 6px 0' }}>
          POSITION PAPER
        </p>
        <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontSize: 11, color: '#9A8A78', marginBottom: 16 }}>
          {myAllocation.conference_committees?.name} · {myAllocation.country_name}
        </p>

        {!ppEnabled ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78' }}>
            Position paper submissions are not yet open for your committee.
          </p>
        ) : showUploadForm ? (
          <>
            {deadline && (
              <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: deadlineSoon ? '#B8844A' : '#9A8A78', marginBottom: 14 }}>
                Due {fmtDate(deadline)}
              </p>
            )}
            <input type="file" accept="application/pdf" onChange={handlePPFileSelect} className="hidden" ref={ppFileInputRef} />
            {!ppFile ? (
              <div
                onClick={() => ppFileInputRef.current?.click()}
                style={{ border: '1.5px dashed rgba(154,138,120,0.6)', borderRadius: 14, padding: '28px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color 0.15s, background-color 0.15s', backgroundColor: 'rgba(237,231,216,0.25)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(154,138,120,0.6)'; el.style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
              >
                <p style={{ fontSize: 13, color: '#4A4238', fontFamily: OUTFIT, marginBottom: 2, fontWeight: 600 }}>Click to select PDF</p>
                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>MAX 5MB</p>
              </div>
            ) : (
              <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 12, padding: '10px 14px', backgroundColor: 'rgba(61,122,82,0.05)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileText size={15} style={{ color: '#2A5A3C', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ppFile.name}</p>
                </div>
                <button onClick={() => ppFileInputRef.current?.click()} className="focus:outline-none" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0 }}>
                  Change
                </button>
              </div>
            )}
            {ppError && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT, marginBottom: 8 }}>{ppError}</p>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={ppNotify} onChange={e => setPPNotify(e.target.checked)} style={{ accentColor: '#1B3828' }} />
              <span style={{ fontFamily: OUTFIT, fontSize: 12, color: '#9A8A78' }}>
                Notify me via email when my position paper receives feedback
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {isReplacing && (
                <button onClick={() => { setIsReplacing(false); setPPFile(null); setPPError(''); }} className="focus:outline-none" style={{ border: '1px solid #DDD4C0', borderRadius: 12, padding: '10px 16px', fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
                  CANCEL
                </button>
              )}
              <button
                onClick={handlePPSubmit}
                disabled={!ppFile || ppUploading}
                className="focus:outline-none"
                style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', backgroundColor: !ppFile || ppUploading ? '#DDD4C0' : '#1B3828', color: !ppFile || ppUploading ? '#9A8A78' : '#EED98A', cursor: !ppFile || ppUploading ? 'default' : 'pointer' }}
              >
                {ppUploading ? 'UPLOADING...' : 'SUBMIT POSITION PAPER'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 500, fontSize: 11, color: '#9A8A78', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {myPositionPaper!.file_name}
              </span>
              {(() => {
                const s = ppStatusMap[myPositionPaper!.status] ?? ppStatusMap.submitted;
                return (
                  <span style={{ backgroundColor: s.bg, color: s.color, fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.08em', flexShrink: 0 }}>
                    {myPositionPaper!.status.toUpperCase()}
                  </span>
                );
              })()}
            </div>
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', marginBottom: 10 }}>
              Submitted {fmtDate(myPositionPaper!.submitted_at)}
            </p>
            {myPositionPaper!.chair_feedback && (
              <div style={{ backgroundColor: 'rgba(27,56,40,0.04)', borderLeft: '3px solid #B6871F', padding: '10px 14px', borderRadius: '0 10px 10px 0', marginBottom: 12 }}>
                <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#1C1410', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {myPositionPaper!.chair_feedback}
                </p>
              </div>
            )}
            <button
              onClick={() => setShowPPWarning(true)}
              className="focus:outline-none"
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              REPLACE
            </button>
          </>
        )}
      </SectionCard>

      {/* Replace warning modal */}
      {showPPWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 24px 64px rgba(16,28,21,0.35)' }}>
            <h3 className="font-semibold text-base mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Replace Position Paper?</h3>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Your current submission will be deleted and replaced. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPPWarning(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: OUTFIT, backgroundColor: 'transparent' }}
              >
                CANCEL
              </button>
              <button
                onClick={() => { setShowPPWarning(false); setIsReplacing(true); setPPFile(null); setPPError(''); }}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
              >
                REPLACE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
