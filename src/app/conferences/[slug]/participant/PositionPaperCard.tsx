'use client';

// Position paper, an expandable unit. Collapsed shows just the submission
// status; expanded shows the upload/submission flow (moved from the old
// documents tab, same allocation-dependent states) plus a FEEDBACK section
// that always renders once a paper exists (chair_feedback, or "No feedback
// yet").

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT, useAllocationPartner } from './shared';
import type { ParticipantAllocation } from './types';

interface PositionPaper {
  id: string;
  status: string;
  chair_feedback: string | null;
  submitted_at: string;
  file_name: string;
  user_id: string;
}

const ppStatusMap: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};
const NOT_SUBMITTED_STYLE = { bg: 'rgba(154,138,120,0.14)', color: '#6B5F52' };

const ppMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${ppMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function PositionPaperCard({ conferenceId, myAllocation }: {
  conferenceId: string;
  myAllocation: ParticipantAllocation | null;
}) {
  const { user, session } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [myPositionPaper, setMyPositionPaper] = useState<PositionPaper | null>(null);
  const [ppFile, setPPFile] = useState<File | null>(null);
  const [ppUploading, setPPUploading] = useState(false);
  const [ppError, setPPError] = useState('');
  const [ppNotify, setPPNotify] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showPPWarning, setShowPPWarning] = useState(false);
  const ppFileInputRef = useRef<HTMLInputElement>(null);

  const loadPpEnabled = useCallback(async () => {
    if (!myAllocation || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: ccData } = await supabase
      .from('conference_committees')
      .select('pp_submissions_enabled')
      .eq('id', myAllocation.conference_committee_id)
      .single();
    setPpEnabled((ccData as { pp_submissions_enabled?: boolean } | null)?.pp_submissions_enabled ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAllocation?.conference_committee_id, session?.access_token]);

  useEffect(() => { loadPpEnabled(); }, [loadPpEnabled]);

  // Fetched by COUNTRY, not user — a double-delegation country shares one
  // paper between its two seat-holders, whoever submitted it.
  const loadMyPositionPaper = useCallback(async () => {
    if (!user || !myAllocation || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('position_papers')
      .select('id, status, chair_feedback, submitted_at, file_name, user_id')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .eq('country_code', myAllocation.country_code)
      .maybeSingle();
    setMyPositionPaper((data as PositionPaper | null) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, myAllocation?.conference_committee_id, myAllocation?.country_code, session?.access_token]);

  useEffect(() => { loadMyPositionPaper(); }, [loadMyPositionPaper]);

  const partner = useAllocationPartner(myAllocation);

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
    // position_papers has no country_name column — that field used to make
    // PostgREST reject the whole insert, and the ignored error let the paper
    // silently vanish while the file sat orphaned in storage.
    const { error: insertError } = await supabase.from('position_papers').insert({
      conference_id: conferenceId,
      conference_committee_id: myAllocation.conference_committee_id,
      user_id: user.id,
      country_code: myAllocation.country_code,
      file_url: publicUrl,
      file_name: ppFile.name,
      file_size_bytes: ppFile.size,
      status: 'submitted',
      notify_on_feedback: ppNotify,
    });
    if (insertError) {
      console.error('[PositionPaperCard] position_papers insert failed:', insertError);
      await supabase.storage.from('position-papers').remove([path]);
      setPPError('Your paper could not be submitted. Please try again.');
      setPPUploading(false);
      return;
    }
    setPPUploading(false);
    setPPFile(null);
    setIsReplacing(false);
    await loadMyPositionPaper();
  }

  if (!myAllocation) {
    return (
      <SectionCard>
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 8px 0' }}>
          POSITION PAPER
        </p>
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Your position paper submission unlocks once you receive your committee allocation.
        </p>
      </SectionCard>
    );
  }

  const deadline = myAllocation.conference_committees?.position_paper_deadline ?? null;
  const deadlineSoon = deadline ? (new Date(deadline).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 && new Date(deadline) > new Date() : false;
  const showUploadForm = !myPositionPaper || isReplacing;
  const collapsedStyle = myPositionPaper ? (ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted) : NOT_SUBMITTED_STYLE;
  const collapsedLabel = myPositionPaper ? `${myPositionPaper.status.toUpperCase()} ${fmtDate(myPositionPaper.submitted_at)}` : 'NOT SUBMITTED';

  return (
    <SectionCard>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 focus:outline-none"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          POSITION PAPER
        </p>
        <div className="flex items-center gap-2.5">
          <span
            className="px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: collapsedStyle.bg, color: collapsedStyle.color, fontSize: '9px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
          >
            {collapsedLabel}
          </span>
          {expanded ? <ChevronUp size={15} style={{ color: '#9A8A78' }} /> : <ChevronDown size={15} style={{ color: '#9A8A78' }} />}
        </div>
      </button>

      {expanded && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
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
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', marginBottom: myPositionPaper!.user_id !== user?.id ? 2 : 10 }}>
                Submitted {fmtDate(myPositionPaper!.submitted_at)}
              </p>
              {myPositionPaper!.user_id !== user?.id && (
                <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', marginBottom: 10 }}>
                  Submitted by {partner?.name ?? 'your co-delegate'}
                </p>
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

          {/* Feedback, always present once a paper exists */}
          {myPositionPaper && (
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
              <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 8px 0' }}>
                FEEDBACK
              </p>
              {myPositionPaper.chair_feedback ? (
                <div style={{ backgroundColor: 'rgba(27,56,40,0.04)', borderLeft: '3px solid #B6871F', padding: '10px 14px', borderRadius: '0 10px 10px 0' }}>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#1C1410', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
                    {myPositionPaper.chair_feedback}
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  No feedback yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
                onClick={() => { setShowPPWarning(false); setIsReplacing(true); setPPFile(null); setPPError(''); setExpanded(true); }}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
              >
                REPLACE
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
