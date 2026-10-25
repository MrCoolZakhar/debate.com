'use client';
// Gavelling Crisis: the delegate's live-room actions. This replaces the normal delegate page
// (/delegate/[code]) for a crisis delegate: the room's status, "Request to speak" and "Submit a
// document", as a vertical stack of large buttons.
//
// The room is the live session of the delegate's cabinet (crisis_cabinets.conference_committee_id ->
// conference_committees.session_code). The delegate's SEAT is the room's delegates row whose name
// matches their character (seatKey: case and spaces ignored). Session writes are checked by the
// room code, not by accounts, so the existing session functions are used exactly as the phone does:
//   reads    getCommitteeByCodeWithRetry + startSessionSync (the delegate page's pipeline, no messages)
//   request  requestGslSpot (a gsl-request motion), cooldowns kept in the SAME localStorage key as
//            the delegate page (gsl-request:<committee>:<seat>) and in the shared per-delegation
//            allowance (delegateAllowance.ts)
//   document addDocument, PDF to the session-documents bucket through safeStorageKey, limits from docNames

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Hand, Paperclip, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { getCrisisClient } from '@/lib/crisis/client';
import {
  addDocument, getCommitteeByCodeWithRetry, getPendingMotionsList, requestGslSpot,
} from '@/lib/committeeService';
import { readDelegateAllowance, recordDelegateAllowance, type DelegateAllowance } from '@/lib/delegateAllowance';
import { docCount, docLimit, docLimitReached, docName } from '@/lib/docNames';
import { withRoomOrderQueue } from '@/lib/roomOrderQueue';
import { seatKey } from '@/lib/seatClaims';
import { startSessionSync, rowFields, withCurrentSpeaker, withLists } from '@/lib/sessionSync';
import { safeStorageKey } from '@/lib/storageKey';
import { supabase } from '@/lib/supabase';
import type { Committee, Delegate, DocumentType } from '@/lib/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK, fieldStyle, FieldLabel, Skeleton } from '../../crisisKit';

export interface RoomActionsProps { compact?: boolean }

// ── Request to speak: the same two clocks and key as src/app/delegate/[code]/page.tsx ──
// (that page does not export them; keep the numbers in step with GSL_RETRY_MS / GSL_DENIED_MS there).
const GSL_RETRY_MS = 60 * 1000;
const GSL_DENIED_MS = 15 * 60 * 1000;
const GSL_DENIAL_GRACE_MS = 2500;

type GslCooldown = { requestedAt?: number; deniedAt?: number };
const cooldownKey = (committeeId: string, seat: string) => `gsl-request:${committeeId}:${seat}`;

function readCooldown(committeeId: string, seat: string): GslCooldown {
  try {
    const raw = window.localStorage.getItem(cooldownKey(committeeId, seat));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as GslCooldown) : {};
  } catch { return {}; }
}
function writeCooldown(committeeId: string, seat: string, value: GslCooldown): void {
  try {
    const key = cooldownKey(committeeId, seat);
    if (!value.requestedAt && !value.deniedAt) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private window */ }
}
const leftOf = (at: number | undefined, span: number, now: number) => (at ? Math.max(0, span - (now - at)) : 0);

function waitWords(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  return secs >= 60 ? `${Math.ceil(secs / 60)} min` : `${secs} s`;
}

function ordinal(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

const sameSeat = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && seatKey(a) === seatKey(b);

function phaseLabel(c: Committee): string {
  if (c.endedAt) return 'Ended';
  if (c.suspendedAt || c.phase === 'adjourned') return 'Suspended';
  switch (c.phase) {
    case 'pre-session': case 'roll-call': return 'Roll call';
    case 'speakers-list': return 'Speakers list';
    case 'moderated-caucus': return 'Moderated caucus';
    case 'unmoderated-caucus': return c.caucus?.isConsultation ? 'Consultation of the whole' : 'Unmoderated caucus';
    case 'voting': return 'Voting';
    default: return 'In session';
  }
}

// ── Finding the room ──
/** The cabinet's room code (conference_committees.session_code). Read again each minute while there is none. */
function useRoomCode() {
  const { ref, cabinetId, core } = useCrisis();
  const ccId = core.cabinets.find((c) => c.id === cabinetId)?.conference_committee_id ?? null;
  const [read, setRead] = useState<{ ccId: string; code: string | null } | null>(null);
  const haveCode = useRef(false);

  useEffect(() => {
    if (!ccId) return;
    let cancelled = false;
    const run = async () => {
      if (haveCode.current) return;
      try {
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const r = await client.from('conference_committees').select('session_code').eq('id', ccId).maybeSingle();
        if (cancelled || r.error) return;
        const code = (r.data as { session_code: string | null } | null)?.session_code ?? null;
        haveCode.current = !!code;
        setRead({ ccId, code });
      } catch { /* the next tick retries */ }
    };
    const first = window.setTimeout(() => { void run(); }, 0);
    const again = window.setInterval(() => { if (document.visibilityState === 'visible') void run(); }, 60_000);
    return () => { cancelled = true; haveCode.current = false; window.clearTimeout(first); window.clearInterval(again); };
  }, [ref.conf, ref.crisis, ccId]);

  if (!ccId) return { ready: true, code: null as string | null };
  const mine = read?.ccId === ccId ? read : null;
  return { ready: !!mine, code: mine?.code ?? null };
}

/** The live room, kept current by the delegate page's own sync (no messages, no feedback). */
function useRoom(code: string | null) {
  const [state, setState] = useState<{ code: string; committee: Committee | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    (async () => {
      const result = await getCommitteeByCodeWithRetry(code.toUpperCase(), { isCancelled: () => cancelled });
      if (cancelled) return;
      if (result.status !== 'ok') { setState({ code, committee: null, failed: result.status === 'error' }); return; }
      setState({ code, committee: result.committee, failed: false });
      const patch = (fn: (c: Committee) => Committee) => setState((s) => (s && s.committee ? { ...s, committee: fn(s.committee) } : s));
      const sync = startSessionSync({
        committeeId: result.committee.id,
        tables: ['committees', 'delegates', 'speakers_list', 'current_speaker', 'motions', 'documents'],
        slices: ['row', 'delegates', 'lists', 'currentSpeaker', 'motions', 'documents'],
        apply: (slice, data) => {
          switch (slice) {
            case 'row': patch((p) => withRoomOrderQueue({ ...p, ...rowFields(data as Committee) })); break;
            case 'delegates': patch((p) => ({ ...p, delegates: data as Committee['delegates'] })); break;
            case 'lists': patch((p) => withLists(p, data as Parameters<typeof withLists>[1])); break;
            case 'currentSpeaker': patch((p) => withCurrentSpeaker(p, data as Parameters<typeof withCurrentSpeaker>[1], { includeRemaining: true })); break;
            case 'motions': patch((p) => ({ ...p, pendingMotions: data as Committee['pendingMotions'] })); break;
            case 'documents': patch((p) => ({ ...p, documents: data as Committee['documents'] })); break;
            default: break;
          }
        },
      });
      if (cancelled) { sync.stop(); return; }
      stop = sync.stop;
    })();
    return () => { cancelled = true; stop?.(); };
  }, [code, attempt]);

  const mine = state && state.code === code ? state : null;
  return { loaded: !!mine, committee: mine?.committee ?? null, failed: mine?.failed ?? false, retry: () => { setState(null); setAttempt((a) => a + 1); } };
}

// ── Styling ──
const stackBtn = (tone: 'red' | 'light', disabled: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 0, borderRadius: 16,
  padding: '12px 16px', minHeight: 56, fontFamily: CK.font, cursor: disabled ? 'not-allowed' : 'pointer',
  background: tone === 'red' ? CK.redBtn : CK.card, color: tone === 'red' ? '#FFF4E6' : CK.forest,
  boxShadow: tone === 'red' ? CK.redShadow : `${CK.shadowSm}, inset 0 0 0 1px ${CK.hair}`,
  opacity: disabled ? 0.55 : 1,
});

function StackButton({ tone, icon, label, hint, disabled, onClick, compact }: {
  tone: 'red' | 'light'; icon: React.ReactNode; label: string; hint?: string; disabled?: boolean; onClick: () => void; compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99] transition-transform"
      style={{ ...stackBtn(tone, !!disabled), ...(compact ? { minHeight: 46, padding: '8px 14px' } : {}) }}
    >
      <span style={{ lineHeight: 0, flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: compact ? 14 : 15.5, fontWeight: 800, overflowWrap: 'anywhere' }}>{label}</b>
        {hint && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, opacity: 0.85, overflowWrap: 'anywhere' }}>{hint}</span>}
      </span>
    </button>
  );
}

// ── The panel for one loaded room ──
function RoomPanel({ committee, seat, compact }: { committee: Committee; seat: Delegate; compact?: boolean }) {
  const country = seat.country;
  const committeeRef = useRef(committee);
  useEffect(() => { committeeRef.current = committee; }, [committee]);

  const floor = committee.currentSpeaker ?? null;
  const floorName = floor?.country ?? (committee.phase === 'moderated-caucus' ? committee.caucus?.currentSpeaker ?? null : null);
  const iHaveFloor = sameSeat(floorName, country);
  const gslIndex = committee.speakersList.findIndex((s) => sameSeat(s.country, country));
  const caucusIndex = committee.phase === 'moderated-caucus' ? (committee.caucusQueue ?? []).findIndex((s) => sameSeat(s.country, country)) : -1;
  const onGsl = gslIndex !== -1;
  const onList = iHaveFloor || onGsl || caucusIndex !== -1;
  const pending = (committee.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
  const closedPhase = committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus' || committee.phase === 'voting';
  const over = !!committee.endedAt;
  const paused = !over && (!!committee.suspendedAt || committee.phase === 'adjourned');
  const absent = seat.status === 'absent';

  // Cooldowns (persisted, per committee AND seat; shared with the delegate phone).
  const [cooldown, setCooldown] = useState<GslCooldown>(() => readCooldown(committee.id, country));
  const [now, setNow] = useState(() => Date.now());
  const cooldownRef = useRef(cooldown);
  const commit = useCallback((next: GslCooldown) => {
    cooldownRef.current = next;
    setCooldown(next);
    setNow(Date.now());
    writeCooldown(committeeRef.current.id, country, next);
  }, [country]);

  const deniedLeft = onList ? 0 : leftOf(cooldown.deniedAt, GSL_DENIED_MS, now);
  const retryLeft = onList ? 0 : leftOf(cooldown.requestedAt, GSL_RETRY_MS, now);
  const clockOpen = deniedLeft > 0 || retryLeft > 0;
  useEffect(() => {
    if (!clockOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [clockOpen]);

  // The shared allowance: another phone of this delegation may have asked or been refused.
  const allowanceMissing = useRef(false);
  const lastClearAt = useRef(0);
  const refreshAllowance = useCallback(async () => {
    if (allowanceMissing.current) return;
    const a = await readDelegateAllowance(committeeRef.current.code, country);
    if (a === 'missing') { allowanceMissing.current = true; return; }
    if (!a) return;
    const x: DelegateAllowance = a;
    const req = x.gslRetryLeftMs > 0 ? x.readAt - (GSL_RETRY_MS - x.gslRetryLeftMs) : undefined;
    const den = x.gslDeniedLeftMs > 0 ? x.readAt - (GSL_DENIED_MS - x.gslDeniedLeftMs) : undefined;
    if (req === undefined && den === undefined) return;
    const prev = cooldownRef.current;
    const later = (p?: number, q?: number) => (p === undefined ? q : q === undefined ? p : Math.max(p, q));
    const next: GslCooldown = { requestedAt: later(prev.requestedAt, req), deniedAt: later(prev.deniedAt, den) };
    if (next.requestedAt !== prev.requestedAt || next.deniedAt !== prev.deniedAt) commit(next);
  }, [country, commit]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refreshAllowance(); }, 400);
    return () => window.clearTimeout(id);
  }, [pending, onList, refreshAllowance]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAllowance(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshAllowance]);

  // A request that vanishes without the delegation reaching the list is a refusal, but only after
  // a grace window: an approval is two writes (list insert, motion delete) that can arrive in either order.
  const hadPending = useRef(pending);
  const denialTimer = useRef<number | null>(null);
  useEffect(() => {
    if (hadPending.current && !pending && !onList && denialTimer.current === null) {
      denialTimer.current = window.setTimeout(() => {
        denialTimer.current = null;
        const c = committeeRef.current;
        const listed = c.speakersList.some((s) => sameSeat(s.country, country)) || sameSeat(c.currentSpeaker?.country, country);
        const again = (c.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
        if (!listed && !again) commit({ deniedAt: Date.now() });
      }, GSL_DENIAL_GRACE_MS);
    }
    if (onList) {
      if (denialTimer.current !== null) { window.clearTimeout(denialTimer.current); denialTimer.current = null; }
      // Reaching the list ends both clocks, here and on the delegation's other phones.
      const sh = cooldownRef.current;
      if (sh.requestedAt || sh.deniedAt) {
        const id = window.setTimeout(() => {
          commit({});
          if (!allowanceMissing.current && Date.now() - lastClearAt.current > 5000) {
            lastClearAt.current = Date.now();
            void recordDelegateAllowance(committeeRef.current.code, country, 'gsl_clear');
          }
        }, 0);
        hadPending.current = pending;
        return () => window.clearTimeout(id);
      }
    }
    hadPending.current = pending;
  }, [pending, onList, country, commit]);
  useEffect(() => () => { if (denialTimer.current !== null) window.clearTimeout(denialTimer.current); }, []);

  const [asking, setAsking] = useState(false);
  const request = async () => {
    if (asking) return;
    const c = committeeRef.current;
    setAsking(true);
    const before = cooldownRef.current;
    commit({ requestedAt: Date.now() });
    try {
      await requestGslSpot(c.id, seat.id, country, c.code);
      void recordDelegateAllowance(c.code, country, 'gsl_request');
      // requestGslSpot only logs a failure, so read the motions back once to be sure it landed.
      const motions = await getPendingMotionsList(c.id);
      if (motions) {
        const landed = motions.some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
        const listed = committeeRef.current.speakersList.some((s) => sameSeat(s.country, country)) || sameSeat(committeeRef.current.currentSpeaker?.country, country);
        if (!landed && !listed) { commit(before); notifyErr('Your request did not reach the chair. Try again.'); return; }
      }
      notifyOk('Your chair has your request');
    } catch {
      commit(before);
      notifyErr('Your request did not reach the chair. Try again.');
    } finally {
      setAsking(false);
    }
  };

  // What the request button says. What the room can see outranks anything this device remembers.
  const req = (() => {
    if (iHaveFloor) return { label: 'You have the floor', hint: undefined as string | undefined, off: true };
    if (onList) return { label: 'You are on the list', hint: undefined, off: true };
    if (over) return { label: 'Request to speak', hint: 'The session has ended', off: true };
    if (paused) return { label: 'Request to speak', hint: 'The session is suspended', off: true };
    if (closedPhase) return { label: 'Request to speak', hint: 'Open again on the speakers list', off: true };
    if (absent) return { label: 'Request to speak', hint: 'Your chair marks you present at roll call first', off: true };
    if (deniedLeft > 0) return { label: 'Request to speak', hint: `Your chair said no. Ask again in ${waitWords(deniedLeft)}`, off: true };
    if (pending) {
      if (retryLeft > 0) return { label: 'Request sent', hint: 'Waiting for your chair', off: true };
      return { label: 'Ask again', hint: 'Your chair has not answered yet', off: false };
    }
    return { label: 'Request to speak', hint: undefined, off: false };
  })();

  const statusLines: string[] = [];
  statusLines.push(floorName ? (iHaveFloor ? 'You have the floor' : `${floorName} has the floor`) : 'Nobody has the floor');
  if (!iHaveFloor && onGsl) statusLines.push(`You are ${ordinal(gslIndex + (floor ? 2 : 1))} on the speakers list`);
  if (!iHaveFloor && caucusIndex !== -1) statusLines.push(`You are ${ordinal(caucusIndex + 1)} in the caucus queue`);

  const [docOpen, setDocOpen] = useState(false);

  return (
    <div className="grid gap-2.5">
      <div style={{ background: CK.well, borderRadius: 16, padding: compact ? '8px 12px' : '10px 14px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: CK.red, letterSpacing: '0.06em' }}>{committee.name}</p>
        <p style={{ margin: '2px 0 0', fontSize: compact ? 15 : 17, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{phaseLabel(committee)}</p>
        {!over && (
          <div style={{ marginTop: 4, fontSize: 13, color: CK.inkSoft }}>
            {statusLines.map((l) => <p key={l} style={{ margin: 0, overflowWrap: 'anywhere' }}>{l}</p>)}
          </div>
        )}
      </div>
      <StackButton
        tone="red" icon={<Hand size={22} strokeWidth={1.5} aria-hidden />} label={req.label} hint={req.hint}
        disabled={req.off || asking} onClick={request} compact={compact}
      />
      <StackButton
        tone="light" icon={<FilePlus2 size={22} strokeWidth={1.5} aria-hidden />} label="Submit a document"
        disabled={over} onClick={() => setDocOpen(true)} compact={compact}
      />
      {docOpen && <SubmitDocumentDialog committee={committee} seat={seat} onClose={() => setDocOpen(false)} />}
    </div>
  );
}

// ── Submit a document ──
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** A placeholder code only: the database trigger assigns the real WP or DR number under a lock. */
function placeholderDocCode(type: DocumentType, existing: Committee['documents']): string {
  const same = (existing ?? []).filter((d) => d.type === type).length;
  return type === 'working-paper' ? `WP 1.${same + 1}` : `DR 1/${same + 1}`;
}

function SubmitDocumentDialog({ committee, seat, onClose }: { committee: Committee; seat: Delegate; onClose: () => void }) {
  const country = seat.country;
  const [docType, setDocType] = useState<DocumentType>('working-paper');
  const [title, setTitle] = useState('');
  const [coSponsors, setCoSponsors] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [link, setLink] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    titleInput.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const wpName = docName(committee, 'working-paper', 'singular', 'Working paper');
  const drName = docName(committee, 'draft-resolution', 'singular', 'Draft resolution');
  const limitReached = docLimitReached(committee, docType);
  const limit = docLimit(committee, docType);
  const existing = docCount(committee, docType);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return committee.delegates
      .map((d) => d.country)
      .filter((c) => !sameSeat(c, country) && !coSponsors.includes(c) && c.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, committee.delegates, coSponsors, country]);

  const pickFile = async (file: File | null | undefined) => {
    if (!file) return;
    const isPdf = file.type ? file.type === 'application/pdf' : file.name.toLowerCase().endsWith('.pdf');
    const reject = (msg: string) => { setFileProblem(msg); if (fileInput.current) fileInput.current.value = ''; };
    if (!isPdf) { reject('Use a PDF file.'); return; }
    if (file.size > MAX_PDF_BYTES) { reject('The PDF is over 10 MB.'); return; }
    setFileProblem(null);
    setFileName(file.name);
    setUploading(true);
    try {
      // No upsert: the bucket allows anon insert only, and the path already carries the time.
      const path = safeStorageKey(committee.id, String(Date.now()), file.name);
      const { error } = await supabase.storage.from('session-documents').upload(path, file);
      if (error) {
        setFileName(null);
        setFileProblem('The file could not be uploaded. Try again.');
        if (fileInput.current) fileInput.current.value = '';
        return;
      }
      setFileUrl(supabase.storage.from('session-documents').getPublicUrl(path).data.publicUrl);
    } catch {
      setFileName(null);
      setFileProblem('The file could not be uploaded. Try again.');
    } finally {
      setUploading(false);
    }
  };
  const clearFile = () => { setFileName(null); setFileUrl(null); setFileProblem(null); if (fileInput.current) fileInput.current.value = ''; };

  const canSend = title.trim().length > 0 && !sending && !uploading && !limitReached;
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setFailed(false);
    try {
      const saved = await addDocument(committee.id, {
        type: docType,
        docCode: placeholderDocCode(docType, committee.documents),
        title: title.trim(),
        sponsors: [country, ...coSponsors],
        content: link.trim(),
        status: 'submitted',
        ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
      }, committee.code);
      if (!saved) { setFailed(true); notifyErr('Your document was not sent. Your text is kept.'); return; }
      notifyOk('Sent to your chair');
      onClose();
    } catch {
      setFailed(true);
      notifyErr('Your document was not sent. Your text is kept.');
    } finally {
      setSending(false);
    }
  };

  const typeBtn = (t: DocumentType, label: string) => {
    const on = docType === t;
    return (
      <button
        key={t} type="button" onClick={() => setDocType(t)} aria-pressed={on}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{
          flex: 1, border: 0, borderRadius: 11, padding: '9px 10px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
          background: on ? CK.greenBtn : CK.card, color: on ? '#FFFFFF' : CK.forest, boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${CK.hair}`,
        }}
      >{label}</button>
    );
  };

  return (
    <Portal>
      <div
        role="presentation"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(40,10,10,0.5)', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}
      >
        <div
          role="dialog" aria-modal="true" aria-labelledby="room-doc-title"
          style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: CK.redWash, borderRadius: 22, boxShadow: CK.shadow, padding: '18px 18px 16px', fontFamily: CK.font }}
        >
          <div className="flex items-start justify-between gap-3" style={{ marginBottom: 12 }}>
            <h2 id="room-doc-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CK.ink }}>Submit a Document</h2>
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: CK.well, borderRadius: 10, width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', color: CK.inkSoft, flexShrink: 0 }}
            ><X size={16} strokeWidth={1.5} aria-hidden /></button>
          </div>

          <div className="grid gap-3">
            <div className="flex gap-2">{typeBtn('working-paper', wpName)}{typeBtn('draft-resolution', drName)}</div>

            <div>
              <FieldLabel htmlFor="room-doc-name">Title</FieldLabel>
              <input id="room-doc-name" ref={titleInput} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} style={fieldStyle} placeholder="What is it about?" />
            </div>

            <div>
              <FieldLabel htmlFor="room-doc-sponsor" hint="You are added automatically">Sponsors</FieldLabel>
              <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 6 }}>
                <span style={{ background: CK.well, color: CK.forest, borderRadius: 999, padding: '3px 10px', fontSize: 12.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{country} (you)</span>
                {coSponsors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1" style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                    {c}
                    <button
                      type="button" onClick={() => setCoSponsors((list) => list.filter((x) => x !== c))} aria-label={`Remove ${c}`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 2 }}
                    ><X size={13} strokeWidth={1.5} aria-hidden /></button>
                  </span>
                ))}
              </div>
              <input id="room-doc-sponsor" value={query} onChange={(e) => setQuery(e.target.value)} style={fieldStyle} placeholder="Add another delegation" autoComplete="off" />
              {suggestions.length > 0 && (
                <div className="grid gap-1" style={{ marginTop: 6 }}>
                  {suggestions.map((c) => (
                    <button
                      key={c} type="button" onClick={() => { setCoSponsors((list) => [...list, c]); setQuery(''); }}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ border: 0, background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 10, padding: '7px 10px', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: CK.ink, cursor: 'pointer', overflowWrap: 'anywhere', fontFamily: CK.font }}
                    >{c}</button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="room-doc-link" hint="Optional">Link</FieldLabel>
              <input id="room-doc-link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} style={fieldStyle} placeholder="https://docs.google.com/..." />
            </div>

            <div>
              <FieldLabel hint="Optional, PDF up to 10 MB">File</FieldLabel>
              {fileName || uploading ? (
                <div className="flex items-center gap-2" style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '9px 12px' }}>
                  <Paperclip size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.inkSoft, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{fileName}{uploading ? ' (uploading)' : ''}</span>
                  {!uploading && (
                    <button
                      type="button" onClick={clearFile} aria-label="Remove the file"
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 4 }}
                    ><X size={16} strokeWidth={1.5} aria-hidden /></button>
                  )}
                </div>
              ) : (
                <button
                  type="button" onClick={() => fileInput.current?.click()}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] inline-flex items-center gap-2"
                  style={{ border: 0, background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '9px 14px', fontSize: 13.5, fontWeight: 700, color: CK.forest, cursor: 'pointer', fontFamily: CK.font }}
                ><Paperclip size={16} strokeWidth={1.5} aria-hidden />Attach a PDF</button>
              )}
              {fileProblem && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12.5, color: CK.danger }}>{fileProblem}</p>}
              <input ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); }} />
            </div>

            {limitReached && (
              <p style={{ margin: 0, fontSize: 13, color: CK.danger }}>
                This committee takes {limit} {limit === 1 ? 'document' : 'documents'} of this kind and {existing} {existing === 1 ? 'is' : 'are'} already in.
              </p>
            )}
            {failed && <p role="alert" style={{ margin: 0, fontSize: 13, color: CK.danger }}>The document was not sent. Your text is kept. Try again.</p>}

            <div className="flex flex-wrap gap-2" style={{ marginTop: 2 }}>
              <button
                type="button" onClick={send} disabled={!canSend}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ border: 0, borderRadius: 12, padding: '11px 18px', fontSize: 14.5, fontWeight: 800, background: CK.greenBtn, color: '#FFFFFF', boxShadow: CK.shadowSm, cursor: 'pointer', fontFamily: CK.font }}
              >{sending ? 'Sending' : 'Send to your chair'}</button>
              <button
                type="button" onClick={onClose}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ border: 0, borderRadius: 12, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, background: CK.card, color: CK.forest, boxShadow: `inset 0 0 0 1px ${CK.hair}`, cursor: 'pointer', fontFamily: CK.font }}
              >Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Entry ──
export default function RoomActions({ compact }: RoomActionsProps) {
  const { characterId, core } = useCrisis();
  const { ready, code } = useRoomCode();
  const room = useRoom(code);
  const character = core.characters.find((c) => c.id === characterId) ?? null;

  const line = (text: string) => <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>{text}</p>;

  if (!ready) return <div className="grid gap-2"><Skeleton h={70} r={16} /><Skeleton h={56} r={16} /><Skeleton h={56} r={16} /></div>;
  if (!code) return line('Your committee room opens on the conference days');
  if (!room.loaded) return <div className="grid gap-2"><Skeleton h={70} r={16} /><Skeleton h={56} r={16} /><Skeleton h={56} r={16} /></div>;
  if (room.failed) {
    return (
      <div className="grid gap-2">
        {line('Your committee room did not load.')}
        <button
          type="button" onClick={room.retry}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ ...stackBtn('light', false), justifyContent: 'center', fontWeight: 800, fontSize: 14.5 }}
        >Try again</button>
      </div>
    );
  }
  if (!room.committee) return line('Your committee room opens on the conference days');

  const seat = character ? room.committee.delegates.find((d) => sameSeat(d.country, character.name)) ?? null : null;
  if (!seat) return line('Your seat is not in the room yet. Ask your chair.');
  return <RoomPanel key={room.committee.id + seat.id} committee={room.committee} seat={seat} compact={compact} />;
}
