'use client';

// Position paper card. Before a paper exists it's an expandable unit with
// the upload flow (unchanged, minus the retired notify_on_feedback
// checkbox). Once a paper exists it becomes a clickable row, study-guide-
// card style, that opens the paper's chat + PDF page — the chair_feedback
// column and the old inline FEEDBACK section are both gone, the thread on
// the paper page replaces them entirely.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Download, FileText, RotateCcw, Upload } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { isPaperLate, countUnread, downloadPositionPaper, type PaperMessageStub } from '@/lib/positionPapers';
import { NEU, EASE, NeuCard } from '@/components/neu';
import ProfileLink from '@/components/ProfileLink';
import { ActionButton } from '@/components/PositionPaperButtons';
import { SectionCard, OUTFIT, useAllocationPartner } from './shared';
import { CardHeading, CARD_TITLE_STYLE, INK_SOFT } from './dashboardKit';
import type { ParticipantAllocation } from './types';
import { useScrollLock } from '@/hooks/useScrollLock';
import DocTile, { TileAction } from './delegation/overview/DocTile';
import { friendlyError } from '@/lib/friendlyError';
import { isNoiseError, reportBlocked } from '@/lib/reportCrash';
import { notifyErr, notifyOk } from '@/lib/appNotify';

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
  submitted: { bg: 'color-mix(in srgb, var(--gv-accent-light) 20%, transparent)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
  approved: { bg: 'color-mix(in srgb, var(--gv-main-light) 12%, transparent)', color: 'var(--gv-main-light)' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};
const NOT_SUBMITTED_STYLE = { bg: 'rgba(154,138,120,0.14)', color: '#6B5F52' };

const PP_MAX_BYTES = 5 * 1024 * 1024;
const PP_NOT_PDF = "That file isn't a PDF. Export or save it as a PDF and try again.";
const PP_TOO_LARGE = "This PDF is over 5 MB. Compress it (for example with your PDF app's reduce size option) and try again.";
const PP_SESSION_ENDED = 'Your session has ended. Sign in again and retry.';
const PP_NETWORK = "The upload didn't finish because the connection dropped. Check your connection and try again.";
const PP_FALLBACK = 'Your paper could not be uploaded. Try again, and if it keeps failing, contact the organisers.';

// What a failed upload / insert / update tells the delegate. Never raw text.
function uploadErrorSentence(error: unknown): string {
  const e = (error ?? {}) as { message?: unknown; error?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const text = [e.message, e.error, e.code].filter(x => typeof x === 'string').join(' ');
  const status = Number(e.status ?? e.statusCode);
  if (status === 413 || /payload too large|too large|maximum allowed size|exceeded the maximum/i.test(text)) return PP_TOO_LARGE;
  if (status === 401 || /jwt|PGRST30[1-3]|unauthori[sz]ed|invalid token|not authenticated/i.test(text)) return PP_SESSION_ENDED;
  if (isNoiseError(error, text)) return PP_NETWORK;
  return friendlyError(error, PP_FALLBACK);
}

const ppMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "22 Jul 2026": the site's one date format (prompt 139). */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${ppMonths[d.getMonth()]} ${d.getFullYear()}`;
}

// getPublicUrl returns .../object/public/position-papers/<path>. Storage
// deletes need the bare <path>, not the full URL.
function storagePathFromUrl(url: string): string | null {
  const marker = '/position-papers/';
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export default function PositionPaperCard({ conferenceId, conferenceSlug, myAllocation, onPaperState, variant = 'card' }: {
  conferenceId: string;
  conferenceSlug: string;
  myAllocation: ParticipantAllocation | null;
  /** 'tile': the small tile in the Overview's "Your Seat" (owner, 21 Oct 2026):
   *  a thin icon, the name, the deadline small beneath and ONE action (Upload,
   *  which picks a PDF and submits it at once, or Submitted, which opens the
   *  paper's page). Same reads and writes as the card; outcomes are glass cards. */
  variant?: 'card' | 'tile';
  /** Told what this card already read (no extra query), so the phone
   *  dashboard's "next step" never asks for a paper that is already in, or
   *  for one the committee is not taking. Null while the read is pending. */
  onPaperState?: (state: { enabled: boolean; submitted: boolean } | null) => void;
}) {
  const { user, session } = useAuth();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [myPositionPaper, setMyPositionPaper] = useState<PositionPaper | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ppFileState, setPPFile] = useState<File | null>(null);
  const ppFile = ppFileState;
  const [ppUploading, setPPUploading] = useState(false);
  const [ppError, setPPError] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [showPPWarning, setShowPPWarning] = useState(false);
  // The replace-paper confirm is a modal — freeze the participant page behind it.
  useScrollLock(showPPWarning);
  const ppFileInputRef = useRef<HTMLInputElement>(null);
  // A failed read of the paper is NOT "no paper": the card used to say
  // "NOT SUBMITTED" to a delegate whose paper was on file, whenever the read
  // was refused (an expired token on a tab left open). 'error' shows a retry.
  const [paperLoad, setPaperLoad] = useState<'loading' | 'ok' | 'error'>('loading');

  const paperSubmitted = !!myPositionPaper && myPositionPaper.status !== 'rejected';
  useEffect(() => {
    onPaperState?.(paperLoad === 'ok' ? { enabled: ppEnabled, submitted: paperSubmitted } : null);
  }, [onPaperState, paperLoad, ppEnabled, paperSubmitted]);

  // The session captured in React state goes stale on a tab left open (its
  // access_token expires; supabase-js refreshes its own copy). Ask the auth
  // client for the current session at call time, falling back to the
  // captured one only when that read returns nothing.
  const client = useCallback(async () => {
    const fresh = await getFreshAuthedClient();
    if (fresh) return fresh;
    return session ? getAuthedClient(session.access_token) : null;
  }, [session]);

  const loadPpEnabled = useCallback(async () => {
    if (!myAllocation || !session) return;
    const supabase = await client();
    if (!supabase) return;
    const { data: ccData } = await supabase
      .from('conference_committees')
      .select('pp_submissions_enabled')
      .eq('id', myAllocation.conference_committee_id)
      .single();
    setPpEnabled((ccData as { pp_submissions_enabled?: boolean } | null)?.pp_submissions_enabled ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAllocation?.conference_committee_id, session?.access_token, client]);

  useEffect(() => { loadPpEnabled(); }, [loadPpEnabled]);

  // Fetched by COUNTRY, not user — a double-delegation country shares one
  // paper between its two seat-holders, whoever submitted it.
  const loadMyPositionPaper = useCallback(async () => {
    if (!user || !myAllocation || !session) return;
    const supabase = await client();
    if (!supabase) { setPaperLoad('error'); return; }
    const { data, error } = await supabase
      .from('position_papers')
      .select('id, status, submitted_at, file_name, file_url, user_id, delegate_seen_at')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .eq('country_code', myAllocation.country_code)
      .maybeSingle();
    if (error) {
      // Keep whatever we last showed; only a first load with nothing on
      // screen turns into the retry state.
      console.error('[PositionPaperCard] position_papers read failed:', error);
      setPaperLoad(prev => (prev === 'ok' ? 'ok' : 'error'));
      return;
    }
    setPaperLoad('ok');
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
  }, [user?.id, myAllocation?.conference_committee_id, myAllocation?.country_code, session?.access_token, client]);

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

  // The tile has no room for an error line: a failed upload is a glass card.
  useEffect(() => {
    if (variant !== 'tile' || !ppError) return;
    notifyErr(ppError);
    setPPError('');
  }, [variant, ppError]);

  /** Null when the file is a PDF the bucket takes, else the sentence to show. */
  async function pdfProblem(file: File): Promise<string | null> {
    // Some Android pickers, Windows set-ups and cloud downloads report '' or
    // application/x-pdf / octet-stream for a real PDF, so the name counts too,
    // and the first bytes decide (a renamed .docx never starts with %PDF-).
    const typeSaysPdf = file.type === 'application/pdf';
    if (!typeSaysPdf && !/\.pdf$/i.test(file.name)) return PP_NOT_PDF;
    if (file.size > PP_MAX_BYTES) return PP_TOO_LARGE;
    let magic: string | null = null;
    try {
      magic = String.fromCharCode(...new Uint8Array(await file.slice(0, 5).arrayBuffer()));
    } catch {
      magic = null; // unreadable here: trust only a browser that said application/pdf
    }
    if (magic === null ? !typeSaysPdf : magic !== '%PDF-') return PP_NOT_PDF;
    return null;
  }

  async function handlePPFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Let the same file be picked again after a refusal (onChange would not fire).
    input.value = '';
    if (!file) return;
    const problem = await pdfProblem(file);
    if (problem) { setPPFile(null); setPPError(problem); return; }
    setPPError('');
    setPPFile(file);
  }

  // The tile submits the picked file at once: a first paper, or a new version
  // of one that was sent back.
  async function handleTilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file || ppUploading) return;
    const problem = await pdfProblem(file);
    if (problem) { notifyErr(problem); return; }
    setPPError('');
    const ok = myPositionPaper ? await handleReplace(file) : await handlePPSubmit(file);
    if (ok) notifyOk(myPositionPaper ? 'New version submitted' : 'Position paper submitted');
  }

  // Points the delegate's existing row at the new file (the chat thread hangs
  // off its id), then removes the old object and logs the new version. When
  // the update errors, the row is read back: a write that landed but whose
  // answer was lost is a success.
  async function replaceRowFile(
    supabase: NonNullable<Awaited<ReturnType<typeof client>>>,
    paperId: string,
    oldUrl: string,
    file: File,
    publicUrl: string,
  ): Promise<{ ok: true } | { ok: false; error: unknown; unknown: boolean }> {
    const oldPath = oldUrl === publicUrl ? null : storagePathFromUrl(oldUrl);
    const { error: updateError } = await supabase.from('position_papers').update({
      file_url: publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      user_id: user!.id,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
    }).eq('id', paperId);
    if (updateError) {
      const { data: back, error: readError } = await supabase
        .from('position_papers').select('file_url').eq('id', paperId).maybeSingle();
      if (readError) return { ok: false, error: updateError, unknown: true };
      if ((back as { file_url?: string } | null)?.file_url !== publicUrl) return { ok: false, error: updateError, unknown: false };
    }
    if (oldPath) await supabase.storage.from('position-papers').remove([oldPath]);
    await supabase.rpc('log_paper_system_message', { p_paper_id: paperId, p_body: 'New version uploaded.' });
    return { ok: true };
  }

  function uploadFailed(action: string, stage: string, error: unknown, path: string) {
    // reportBlocked's noise gate drops pure offline / network noise; a storage
    // or database refusal is reported.
    reportBlocked(action, error, { stage, path, committee: myAllocation?.conference_committee_id });
    setPPError(uploadErrorSentence(error));
    setPPUploading(false);
  }

  async function handlePPSubmit(fileArg?: File): Promise<boolean> {
    const ppFile = fileArg ?? ppFileState;
    if (!ppFile || !myAllocation || !user || !session) return false;
    setPPUploading(true);
    setPPError('');
    const supabase = await client();
    if (!supabase) { setPPError(PP_SESSION_ENDED); setPPUploading(false); return false; }
    const path = `${conferenceId}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { uploadFailed('upload position paper', 'storage', storageError, path); return false; }
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
      // A 23505 on (conference_committee_id, user_id), or a lost answer to an
      // insert that landed: if the delegate's row exists, the save succeeded.
      const { data: existing, error: readError } = await supabase
        .from('position_papers')
        .select('id, file_url')
        .eq('conference_committee_id', myAllocation.conference_committee_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (readError) {
        // Unknown whether the row landed: keep the object (an orphan is
        // harmless, a paper pointing at a deleted file is not).
        uploadFailed('upload position paper', 'insert', insertError, path);
        return false;
      }
      const row = existing as { id: string; file_url: string } | null;
      if (!row) {
        await supabase.storage.from('position-papers').remove([path]);
        uploadFailed('upload position paper', 'insert', insertError, path);
        return false;
      }
      if (row.file_url !== publicUrl) {
        // An earlier attempt's row: the latest file wins.
        const res = await replaceRowFile(supabase, row.id, row.file_url, ppFile, publicUrl);
        if (!res.ok) {
          if (!res.unknown) await supabase.storage.from('position-papers').remove([path]);
          uploadFailed('upload position paper', 'insert-then-replace', res.error, path);
          return false;
        }
      }
    }
    setPPUploading(false);
    setPPFile(null);
    await loadMyPositionPaper();
    return true;
  }

  // Replace keeps the permanent row (the chat thread hangs off its id) —
  // upload the new file first, update the row in place, then clean up the
  // old storage object and drop a system message marking the new version.
  async function handleReplace(fileArg?: File): Promise<boolean> {
    const ppFile = fileArg ?? ppFileState;
    if (!ppFile || !myAllocation || !myPositionPaper || !user || !session) return false;
    setPPUploading(true);
    setPPError('');
    const supabase = await client();
    if (!supabase) { setPPError(PP_SESSION_ENDED); setPPUploading(false); return false; }
    const path = `${conferenceId}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { uploadFailed('replace position paper', 'storage', storageError, path); return false; }
    const { data: { publicUrl } } = supabase.storage.from('position-papers').getPublicUrl(path);
    const res = await replaceRowFile(supabase, myPositionPaper.id, myPositionPaper.file_url, ppFile, publicUrl);
    if (!res.ok) {
      if (!res.unknown) await supabase.storage.from('position-papers').remove([path]);
      uploadFailed('replace position paper', 'update', res.error, path);
      return false;
    }
    setPPUploading(false);
    setPPFile(null);
    setIsReplacing(false);
    await loadMyPositionPaper();
    return true;
  }

  async function downloadMine() {
    if (!myPositionPaper) return;
    const supabase = await client();
    const ok = supabase ? await downloadPositionPaper(supabase, myPositionPaper.file_url, myPositionPaper.file_name) : false;
    if (!ok) setPPError("Couldn't download your paper. Please try again.");
  }

  if (!myAllocation) {
    if (variant === 'tile') return null;
    return (
      <SectionCard>
        <CardHeading title="Position Paper" />
        <p style={{ color: INK_SOFT, fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Your position paper submission unlocks once you receive your committee allocation.
        </p>
      </SectionCard>
    );
  }

  // No due date and no "Late" while the committee's papers are closed (prompt
  // 141); the saved deadline is kept and comes back when they open again.
  const deadline = ppEnabled ? (myAllocation.conference_committees?.position_paper_deadline ?? null) : null;
  // A rejected paper can ALWAYS be replaced, whatever the switch or the
  // deadline says (owner, 16 Oct 2026); "not yet open" is for a first paper only.
  const replacingRejected = isReplacing && myPositionPaper?.status === 'rejected';
  const deadlineSoon = deadline ? (new Date(deadline).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 && new Date(deadline) > new Date() : false;
  const deadlinePassed = deadline ? new Date(deadline).getTime() <= Date.now() : false;
  const late = myPositionPaper ? isPaperLate(myPositionPaper.submitted_at, deadline) : false;
  // Shown in every state, submission doesn't retire the deadline, a
  // replacement is still held to it (see the late-warning in the replace
  // modal below).
  const dueLine = deadline ? (
    <p style={{ fontFamily: OUTFIT, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 14, color: deadlineSoon ? '#8A5A2E' : INK_SOFT, margin: '0 0 12px 0' }}>
      Due {fmtDate(deadline)}
    </p>
  ) : null;

  if (variant === 'tile') {
    const picker = (
      <input type="file" accept="application/pdf,.pdf" onChange={(e) => { void handleTilePick(e); }} className="hidden" ref={ppFileInputRef} />
    );
    const pick = () => ppFileInputRef.current?.click();
    const dueWords = deadline ? (deadlinePassed ? `Was due ${fmtDate(deadline)}` : `Due ${fmtDate(deadline)}`) : null;
    if (paperLoad === 'loading' && !myPositionPaper) {
      return <DocTile Icon={FileText} title="Position paper" line={dueWords ?? 'Loading'} />;
    }
    if (paperLoad === 'error' && !myPositionPaper) {
      return (
        <DocTile
          Icon={FileText}
          title="Position paper"
          line="Could not be read"
          action={<TileAction Icon={RotateCcw} label="Try again" onClick={() => { setPaperLoad('loading'); void loadMyPositionPaper(); }} />}
        />
      );
    }
    if (myPositionPaper) {
      const sentBack = myPositionPaper.status === 'rejected';
      const accepted = myPositionPaper.status === 'approved';
      return (
        <>
          {picker}
          <DocTile
            Icon={FileText}
            title="Position paper"
            line={sentBack ? 'Sent back. Upload a new version' : `${accepted ? 'Accepted' : 'Submitted'} ${fmtDate(myPositionPaper.submitted_at)}${unreadCount > 0 ? ` · ${unreadCount} new ${unreadCount === 1 ? 'message' : 'messages'}` : ''}`}
            lineColor={sentBack ? '#8B2020' : undefined}
            action={sentBack
              ? <TileAction Icon={Upload} label={ppUploading ? 'Uploading' : 'Upload'} busy={ppUploading} onClick={pick} />
              : <TileAction Icon={CheckCircle2} label="Submitted" tone="done" onClick={() => router.push(`/conferences/${conferenceSlug}/papers/${myPositionPaper.id}`)} />}
          />
        </>
      );
    }
    if (!ppEnabled) {
      return <DocTile Icon={FileText} title="Position paper" line={dueWords ? `Opens later. ${dueWords}` : 'Not open yet'} />;
    }
    return (
      <>
        {picker}
        <DocTile
          Icon={FileText}
          title="Position paper"
          line={dueWords ?? 'Not submitted yet'}
          lineColor={deadlineSoon || deadlinePassed ? '#8A5A2E' : undefined}
          action={<TileAction Icon={Upload} label={ppUploading ? 'Uploading' : 'Upload'} busy={ppUploading} onClick={pick} />}
        />
      </>
    );
  }

  // Once a paper exists (and we aren't mid-replace), the card is a static,
  // always-visible clickable row — no accordion, matching the study guide
  // card's pattern.
  if (myPositionPaper && !isReplacing) {
    // "Upload and Replace" (prompt 142): always for a rejected paper; for a
    // paper submitted or under review only while submissions are open and the
    // deadline (if any) has not passed; never once it is accepted.
    const st = myPositionPaper.status;
    const canReplace = st === 'rejected'
      || ((st === 'submitted' || st === 'reviewed') && ppEnabled && !deadlinePassed);
    const statusStyle = ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted;
    return (
      <SectionCard>
        <CardHeading title="Position Paper" />
        {dueLine}
        <NeuCard
          hover
          onClick={() => router.push(`/conferences/${conferenceSlug}/papers/${myPositionPaper.id}`)}
          className="w-full flex items-center gap-3.5 text-left"
          style={{ padding: '12px 16px', borderRadius: 16 }}
        >
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'color-mix(in srgb, var(--gv-main) 7%, transparent)' }}>
            <FileText size={16} style={{ color: 'var(--gv-main)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="[overflow-wrap:anywhere]" title={myPositionPaper.file_name} style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15.5, lineHeight: 1.3, color: '#1C1410', margin: 0 }}>{myPositionPaper.file_name}</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, color: INK_SOFT, margin: '3px 0 0 0' }}>
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
                style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, backgroundColor: 'var(--gv-main)', color: 'var(--gv-on-main)', fontSize: 10, fontFamily: OUTFIT, fontWeight: 800 }}
              >
                {unreadCount}
              </span>
            )}
            {late && (
              <span
                style={{ color: '#8A5A2E', fontSize: 12, fontFamily: OUTFIT, fontWeight: 800 }}
              >
                Late
              </span>
            )}
            <span
              className="capitalize"
              style={{ color: statusStyle.color, fontSize: 12, fontFamily: OUTFIT, fontWeight: 700 }}
            >
              {myPositionPaper.status}
            </span>
            <ChevronRight size={16} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
          </div>
        </NeuCard>
        <div className="flex flex-wrap items-center gap-2.5" style={{ marginTop: 12 }}>
          {canReplace && (
            <ActionButton
              onClick={() => {
                // A rejected paper goes straight to the upload; any other paper
                // first says the new version reopens it for review.
                if (myPositionPaper.status === 'rejected') { setIsReplacing(true); setExpanded(true); setPPFile(null); setPPError(''); }
                else setShowPPWarning(true);
              }}
              background="linear-gradient(135deg, var(--gv-main), var(--gv-main-mid))"
              color="var(--gv-on-main)"
              boxShadowColor="color-mix(in srgb, var(--gv-main) 35%, transparent)"
              style={{ padding: '10px 18px', fontSize: 13, borderRadius: 12 }}
            >
              Upload and Replace
            </ActionButton>
          )}
          {/* Download with the file's own name (prompt 143). */}
          <ActionButton
            onClick={() => { void downloadMine(); }}
            icon={Download}
            background={NEU.surface}
            color={NEU.ink}
            boxShadowColor="color-mix(in srgb, var(--gv-main) 12%, transparent)"
            style={{ padding: '10px 18px', fontSize: 13, borderRadius: 12 }}
          >
            Download
          </ActionButton>
        </div>
        {ppError && <p style={{ fontSize: 13, color: '#8B2020', fontFamily: OUTFIT, margin: '8px 0 0' }}>{ppError}</p>}

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
                  boxShadowColor="color-mix(in srgb, var(--gv-main) 10%, transparent)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={() => { setShowPPWarning(false); setIsReplacing(true); setExpanded(true); setPPFile(null); setPPError(''); }}
                  background="linear-gradient(135deg, var(--gv-main), var(--gv-main-mid))"
                  color="var(--gv-on-main)"
                  boxShadowColor="color-mix(in srgb, var(--gv-main) 35%, transparent)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  Replace
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    );
  }

  // The paper could not be read. Say so, never "not submitted".
  if (!myPositionPaper && paperLoad !== 'ok') {
    return (
      <SectionCard>
        <CardHeading title="Position Paper" />
        {dueLine}
        {paperLoad === 'loading' ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Loading your paper…</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: '#4A4238', fontFamily: OUTFIT, margin: 0 }}>
              Couldn&apos;t load your position paper. Check your connection and try again.
            </p>
            <button
              onClick={() => { setPaperLoad('loading'); loadMyPositionPaper(); }}
              className="focus:outline-none flex-shrink-0 rounded-full px-3.5 py-1.5"
              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: 'var(--gv-on-main)', background: 'var(--gv-main)', border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        )}
      </SectionCard>
    );
  }

  const collapsedStyle = myPositionPaper ? (ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted) : NOT_SUBMITTED_STYLE;
  const collapsedLabel = myPositionPaper ? `Replacing ${myPositionPaper.status}` : 'Not submitted';

  return (
    <SectionCard>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-xl focus:outline-none"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', transition: `background-color 180ms ${EASE}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--gv-main) 4%, transparent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <h3 style={CARD_TITLE_STYLE}>Position Paper</h3>
        <div className="flex items-center gap-2.5">
          <span
            style={{ color: collapsedStyle.color, fontSize: 12, fontFamily: OUTFIT, fontWeight: 700 }}
          >
            {collapsedLabel}
          </span>
          {expanded ? <ChevronUp size={15} style={{ color: '#9A8A78' }} /> : <ChevronDown size={15} style={{ color: '#9A8A78' }} />}
        </div>
      </button>
      {dueLine && <div className="mt-2.5">{dueLine}</div>}

      {expanded && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          {!ppEnabled && !replacingRejected ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5, color: INK_SOFT, margin: 0 }}>
              Position paper submissions are not yet open for your committee.
            </p>
          ) : (
            <>
              <input type="file" accept="application/pdf,.pdf" onChange={handlePPFileSelect} className="hidden" ref={ppFileInputRef} />
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
                <div style={{ borderRadius: 12, padding: '10px 14px', backgroundColor: 'color-mix(in srgb, var(--gv-main-light) 6%, transparent)', boxShadow: NEU.inSm, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={15} style={{ color: 'var(--gv-main-mid)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p title={ppFile.name} style={{ fontSize: 13, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600, overflowWrap: 'anywhere' }}>{ppFile.name}</p>
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
                    boxShadowColor="color-mix(in srgb, var(--gv-main) 10%, transparent)"
                    style={{ padding: '10px 18px', fontSize: 13, borderRadius: 12 }}
                  >
                    Cancel
                  </ActionButton>
                )}
                <ActionButton
                  onClick={() => { void (isReplacing ? handleReplace() : handlePPSubmit()); }}
                  disabled={!ppFile || ppUploading}
                  background="linear-gradient(135deg, var(--gv-main), var(--gv-main-mid))"
                  color="var(--gv-on-main)"
                  boxShadowColor="color-mix(in srgb, var(--gv-main) 35%, transparent)"
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12 }}
                >
                  {ppUploading ? 'Uploading…' : isReplacing ? 'Submit new version' : 'Submit position paper'}
                </ActionButton>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
