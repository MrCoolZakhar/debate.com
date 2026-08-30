'use client';

// Position paper card. Before a paper exists it's an expandable unit with
// the upload flow (unchanged, minus the retired notify_on_feedback
// checkbox). Once a paper exists it becomes a clickable row, study-guide-
// card style, that opens the paper's chat + PDF page — the chair_feedback
// column and the old inline FEEDBACK section are both gone, the thread on
// the paper page replaces them entirely.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ChevronUp, FileText } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { isPaperLate, countUnread, type PaperMessageStub } from '@/lib/positionPapers';
import { NEU, EASE, NeuCard } from '@/components/neu';
import ProfileLink from '@/components/ProfileLink';
import { ActionButton } from '@/components/PositionPaperButtons';
import { SectionCard, OUTFIT, useAllocationPartner } from './shared';
import type { ParticipantAllocation } from './types';
import { useScrollLock } from '@/hooks/useScrollLock';

interface PositionPaper {
  id: string;
  status: string;
  submitted_at: string;
  file_name: string;
  file_url: string;
  user_id: string;
  delegate_seen_at: string | null;
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

// getPublicUrl returns .../object/public/position-papers/<path>. Storage
// deletes need the bare <path>, not the full URL.
function storagePathFromUrl(url: string): string | null {
  const marker = '/position-papers/';
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export default function PositionPaperCard({ conferenceId, conferenceSlug, myAllocation }: {
  conferenceId: string;
  conferenceSlug: string;
  myAllocation: ParticipantAllocation | null;
}) {
  const { user, session } = useAuth();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [myPositionPaper, setMyPositionPaper] = useState<PositionPaper | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ppFile, setPPFile] = useState<File | null>(null);
  const [ppUploading, setPPUploading] = useState(false);
  const [ppError, setPPError] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [showPPWarning, setShowPPWarning] = useState(false);
  // The replace-paper confirm is a modal — freeze the participant page behind it.
  useScrollLock(showPPWarning);
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
      .select('id, status, submitted_at, file_name, file_url, user_id, delegate_seen_at')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .eq('country_code', myAllocation.country_code)
      .maybeSingle();
    const paper = (data as PositionPaper | null) ?? null;
    setMyPositionPaper(paper);
    if (paper) {
      const { data: msgData } = await supabase
        .from('position_paper_messages')
        .select('sender_user_id, created_at')
        .eq('paper_id', paper.id);
      setUnreadCount(countUnread((msgData ?? []) as PaperMessageStub[], paper.delegate_seen_at, user.id));
    } else {
      setUnreadCount(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, myAllocation?.conference_committee_id, myAllocation?.country_code, session?.access_token]);

  useEffect(() => { loadMyPositionPaper(); }, [loadMyPositionPaper]);

  // A tab left open never learns about new reviewer messages on its own,
  // refetch when the user actually comes back to it (window focus, or the
  // tab becoming visible again after being backgrounded).
  useEffect(() => {
    function onFocus() { loadMyPositionPaper(); }
    function onVisible() { if (document.visibilityState === 'visible') loadMyPositionPaper(); }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadMyPositionPaper]);

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
    const path = `${conferenceId}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { setPPError('Upload failed.'); setPPUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('position-papers').getPublicUrl(path);
    const { error: insertError } = await supabase.from('position_papers').insert({
      conference_id: conferenceId,
      conference_committee_id: myAllocation.conference_committee_id,
      user_id: user.id,
      country_code: myAllocation.country_code,
      file_url: publicUrl,
      file_name: ppFile.name,
      file_size_bytes: ppFile.size,
      status: 'submitted',
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
    await loadMyPositionPaper();
  }

  // Replace keeps the permanent row (the chat thread hangs off its id) —
  // upload the new file first, update the row in place, then clean up the
  // old storage object and drop a system message marking the new version.
  async function handleReplace() {
    if (!ppFile || !myAllocation || !myPositionPaper || !user || !session) return;
    setPPUploading(true);
    setPPError('');
    const supabase = getAuthedClient(session.access_token);
    const path = `${conferenceId}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { setPPError('Upload failed.'); setPPUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('position-papers').getPublicUrl(path);
    const oldPath = storagePathFromUrl(myPositionPaper.file_url);
    const { error: updateError } = await supabase.from('position_papers').update({
      file_url: publicUrl,
      file_name: ppFile.name,
      file_size_bytes: ppFile.size,
      user_id: user.id,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
    }).eq('id', myPositionPaper.id);
    if (updateError) {
      console.error('[PositionPaperCard] replace update failed:', updateError);
      await supabase.storage.from('position-papers').remove([path]);
      setPPError('Your paper could not be updated. Please try again.');
      setPPUploading(false);
      return;
    }
    if (oldPath) await supabase.storage.from('position-papers').remove([oldPath]);
    await supabase.rpc('log_paper_system_message', { p_paper_id: myPositionPaper.id, p_body: 'New version uploaded.' });
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
  const deadlinePassed = deadline ? new Date(deadline).getTime() <= Date.now() : false;
  const late = myPositionPaper ? isPaperLate(myPositionPaper.submitted_at, deadline) : false;
  // Shown in every state, submission doesn't retire the deadline, a
  // replacement is still held to it (see the late-warning in the replace
  // modal below).
  const dueLine = deadline ? (
    <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: deadlineSoon ? '#B8844A' : '#9A8A78', margin: '0 0 10px 0' }}>
      Due {fmtDate(deadline)}
    </p>
  ) : null;

  // Once a paper exists (and we aren't mid-replace), the card is a static,
  // always-visible clickable row — no accordion, matching the study guide
  // card's pattern.
  if (myPositionPaper && !isReplacing) {
    const statusStyle = ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted;
    return (
      <SectionCard>
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
          POSITION PAPER
        </p>
        {dueLine}
        <NeuCard
          hover
          onClick={() => router.push(`/conferences/${conferenceSlug}/papers/${myPositionPaper.id}`)}
          className="w-full flex items-center gap-3.5 text-left"
          style={{ padding: '12px 16px', borderRadius: 16 }}
        >
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(27,56,40,0.07)' }}>
            <FileText size={16} style={{ color: '#1B3828' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 13, color: '#1C1410', margin: 0 }}>{myPositionPaper.file_name}</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', margin: '2px 0 0 0' }}>
              Submitted {fmtDate(myPositionPaper.submitted_at)}
              {myPositionPaper.user_id !== user?.id && (
                <>
                  {/* `nested` — the enclosing NeuCard is given onClick (not href),
                      so it renders a plain div and an anchor inside it is legal.
                      Stopping propagation means clicking the co-delegate's name
                      opens their CV instead of the paper page. */}
                  {' by '}
                  <ProfileLink userId={partner?.userId} name={partner?.name} nested>
                    {partner?.name ?? 'your co-delegate'}
                  </ProfileLink>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {unreadCount > 0 && (
              <span
                className="flex items-center justify-center"
                style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, backgroundColor: '#1B3828', color: '#EED98A', fontSize: 10, fontFamily: OUTFIT, fontWeight: 800 }}
              >
                {unreadCount}
              </span>
            )}
            {late && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(184,132,74,0.16)', color: '#8A5A2E', fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
              >
                LATE
              </span>
            )}
            <span
              className="px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, fontSize: 9, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}
            >
              {myPositionPaper.status.toUpperCase()}
            </span>
            <ChevronRight size={16} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
          </div>
        </NeuCard>
        <button
          onClick={() => setShowPPWarning(true)}
          className="focus:outline-none mt-2.5"
          style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 500, color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'none', transition: `color 160ms ${EASE}` }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.forest; el.style.textDecoration = 'underline'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.muted; el.style.textDecoration = 'none'; }}
        >
          Replace
        </button>

        {showPPWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
            <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 24px 64px rgba(16,28,21,0.35)' }}>
              <h3 className="font-semibold text-base mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Replace Position Paper?</h3>
              <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, marginBottom: deadlinePassed ? 8 : 24 }}>
                This uploads a new version and reopens it for review. The conversation with your reviewer stays intact.
              </p>
              {deadlinePassed && (
                <p className="text-sm mb-6" style={{ color: '#8A5A2E', fontFamily: OUTFIT, fontWeight: 600 }}>
                  The deadline has passed, so a new version will be marked late.
                </p>
              )}
              <div className="flex gap-3">
                <ActionButton
                  onClick={() => setShowPPWarning(false)}
                  background={NEU.surface}
                  color={NEU.ink}
                  boxShadowColor="rgba(27,56,40,0.1)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  CANCEL
                </ActionButton>
                <ActionButton
                  onClick={() => { setShowPPWarning(false); setIsReplacing(true); setExpanded(true); setPPFile(null); setPPError(''); }}
                  background="linear-gradient(135deg, #1B3828, #2F6644)"
                  color="#EED98A"
                  boxShadowColor="rgba(27,56,40,0.35)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  REPLACE
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    );
  }

  const collapsedStyle = myPositionPaper ? (ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted) : NOT_SUBMITTED_STYLE;
  const collapsedLabel = myPositionPaper ? `REPLACING ${myPositionPaper.status.toUpperCase()}` : 'NOT SUBMITTED';

  return (
    <SectionCard>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-xl focus:outline-none"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', transition: `background-color 180ms ${EASE}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
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
      {dueLine && <div className="mt-2.5">{dueLine}</div>}

      {expanded && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          {!ppEnabled ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#9A8A78' }}>
              Position paper submissions are not yet open for your committee.
            </p>
          ) : (
            <>
              <input type="file" accept="application/pdf" onChange={handlePPFileSelect} className="hidden" ref={ppFileInputRef} />
              {!ppFile ? (
                <div
                  onClick={() => ppFileInputRef.current?.click()}
                  style={{
                    border: '1.5px dashed rgba(154,138,120,0.55)', borderRadius: 14, padding: '28px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 12,
                    backgroundColor: NEU.base, boxShadow: NEU.inSm,
                    transition: `box-shadow 220ms ${EASE}, border-color 220ms ${EASE}`,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = NEU.forest; el.style.boxShadow = NEU.in; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(154,138,120,0.55)'; el.style.boxShadow = NEU.inSm; }}
                >
                  <p style={{ fontSize: 13, color: '#4A4238', fontFamily: OUTFIT, marginBottom: 2, fontWeight: 600 }}>Click to select PDF</p>
                  <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>MAX 5MB</p>
                </div>
              ) : (
                <div style={{ borderRadius: 12, padding: '10px 14px', backgroundColor: 'rgba(61,122,82,0.06)', boxShadow: NEU.inSm, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={15} style={{ color: '#2A5A3C', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ppFile.name}</p>
                  </div>
                  <button
                    onClick={() => ppFileInputRef.current?.click()}
                    className="focus:outline-none"
                    style={{ fontSize: 11, fontWeight: 500, color: NEU.muted, fontFamily: OUTFIT, textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, transition: `color 160ms ${EASE}` }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.forest; el.style.textDecoration = 'underline'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.muted; el.style.textDecoration = 'none'; }}
                  >
                    Change
                  </button>
                </div>
              )}
              {ppError && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT, marginBottom: 8 }}>{ppError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                {isReplacing && (
                  <ActionButton
                    onClick={() => { setIsReplacing(false); setPPFile(null); setPPError(''); }}
                    background={NEU.surface}
                    color={NEU.ink}
                    boxShadowColor="rgba(27,56,40,0.1)"
                    style={{ padding: '10px 18px', fontSize: 13, borderRadius: 12 }}
                  >
                    CANCEL
                  </ActionButton>
                )}
                <ActionButton
                  onClick={isReplacing ? handleReplace : handlePPSubmit}
                  disabled={!ppFile || ppUploading}
                  background="linear-gradient(135deg, #1B3828, #2F6644)"
                  color="#EED98A"
                  boxShadowColor="rgba(27,56,40,0.35)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  {ppUploading ? 'UPLOADING...' : isReplacing ? 'SUBMIT NEW VERSION' : 'SUBMIT POSITION PAPER'}
                </ActionButton>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
