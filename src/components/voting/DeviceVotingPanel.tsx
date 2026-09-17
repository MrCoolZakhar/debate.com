'use client';

/**
 * Device voting on the chair's voting screen (src/lib/deviceVoting.ts).
 *
 *  • `DeviceVoteGate`: wraps the roll call before a ballot. It renders the "Vote on devices"
 *    switch (settings.votingMethod, a key-level patch through the page's `applyRules`) and,
 *    when device voting is on and a ballot is about to start, checks which of the delegations
 *    that would be frozen into the ballot hold a live seat claim (`session_participants`).
 *    Start is blocked while any of them is not joined: the chair asks them to join or marks
 *    them absent (which takes them out of the ballot). Render prop, so it owns its polling state
 *    and the roll call only receives a node and a flag.
 *  • `DeviceVotingPanel`: the ballot in progress. Flags of the frozen order with voted / not
 *    voted / not on a device only, never a direction, a big "N of M voted", and Reveal vote
 *    (a confirmation when not everyone has voted). When every delegation has voted it reveals
 *    by itself. Revealed votes go to the page (`onRevealed`), which writes them into vote_state
 *    through the existing ballot path and evaluates the result there.
 *
 * Polling only (the vote tables have no realtime and must not): the status every 2 s while
 * the tab is visible, the joined check every 5 s. No committee state, no updateLocal, no
 * localUpdateTime (AGENTS.md rules 3 to 5).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Eye, MonitorSmartphone, WifiOff } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { getSessionParticipants } from '@/lib/sessionParticipants';
import { getDeviceVoteStatus, revealDeviceVotes, joinedSeatsFrom, type DeviceVoteStatus, type VotingMethod } from '@/lib/deviceVoting';
import type { DelegateVote } from '@/lib/voteState';
import type { Delegate } from '@/lib/types';

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const RED = '#8B2020';

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

// ── The gate before a device ballot ──────────────────────────────────────────
type JoinCheck = { state: 'checking' } | { state: 'error' } | { state: 'ready'; missing: Delegate[]; idle: Delegate[] };

export function DeviceVoteGate({ code, chairSuffix, method, onMethodChange, seats, starting, readOnly, children }: {
  code: string;
  chairSuffix?: string | null;
  method: VotingMethod;
  onMethodChange: (next: VotingMethod) => void;
  /** The delegations the ballot would freeze right now (non-observer, not absent). */
  seats: Delegate[];
  /** A ballot is about to start (the roll call opened for a paper), not a roll call on its own. */
  starting: boolean;
  readOnly?: boolean;
  children: (node: ReactNode, blocked: boolean) => ReactNode;
}) {
  const t = useT();
  const { language } = useLanguage();
  const visible = usePageVisible();
  const [check, setCheck] = useState<JoinCheck>({ state: 'checking' });
  const [tick, setTick] = useState(0);
  const seatsRef = useRef(seats);
  useEffect(() => { seatsRef.current = seats; }, [seats]);
  const active = method === 'device' && starting;

  useEffect(() => {
    if (!active || !visible) return;
    let cancelled = false;
    const run = async () => {
      const p = await getSessionParticipants(code, chairSuffix);
      if (cancelled) return;
      if (!p) { setCheck((prev) => (prev.state === 'ready' ? prev : { state: 'error' })); return; }
      const joined = joinedSeatsFrom(p.seats);
      const list = seatsRef.current;
      setCheck({
        state: 'ready',
        missing: list.filter((d) => !joined.has(d.country.trim().toLowerCase())),
        idle: list.filter((d) => joined.get(d.country.trim().toLowerCase())?.active === false),
      });
    };
    void run();
    const timer = setInterval(run, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [active, visible, code, chairSuffix, tick]);

  // Re-derive against the CURRENT seats when the roll call changes (a delegation marked absent
  // leaves the list at once, without waiting for the next poll).
  const seatKeys = new Set(seats.map((d) => d.id));
  const shown: JoinCheck = check.state === 'ready'
    ? { state: 'ready', missing: check.missing.filter((d) => seatKeys.has(d.id)), idle: check.idle.filter((d) => seatKeys.has(d.id)) }
    : check;
  const blocked = active && (shown.state !== 'ready' || shown.missing.length > 0);
  const names = (list: Delegate[]) => list.map((d) => getCountryDisplayName(d.country, language)).join(', ');

  const node = (
    <div className="relative z-[2] shrink-0 px-4 pt-3 pb-1 flex flex-col gap-2" style={{ backgroundColor: 'rgba(0,0,0,0.10)' }}>
      <div className="flex items-center gap-3">
        <MonitorSmartphone size={20} strokeWidth={2.25} aria-hidden style={{ color: GOLD }} />
        <span id="gv-device-vote-label" className="flex-1 min-w-0 text-[14.5px] font-semibold leading-snug" style={{ color: '#EDE7D8' }}>
          {t('voting_method_label')}
          <span className="block text-[12.5px] font-medium [text-wrap:pretty]" style={{ color: 'rgba(237,231,216,0.72)' }}>{t('voting_method_hint')}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={method === 'device'}
          aria-labelledby="gv-device-vote-label"
          disabled={readOnly}
          onClick={() => onMethodChange(method === 'device' ? 'rollcall' : 'device')}
          className="relative shrink-0 w-12 h-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] transition-[background-color] duration-200 motion-reduce:transition-none disabled:opacity-45 disabled:cursor-not-allowed"
          style={{ backgroundColor: method === 'device' ? '#B6871F' : 'rgba(237,231,216,0.22)' }}
        >
          <span
            className="absolute top-1 start-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transform: method === 'device' ? `translateX(${language === 'ar' ? -20 : 20}px)` : 'translateX(0)' }}
          />
        </button>
      </div>
      {active && (
        <div role="status" aria-live="polite" className="text-[13px] font-semibold leading-snug rounded-xl px-3 py-2 flex items-start gap-2"
          style={{
            backgroundColor: shown.state === 'ready' && shown.missing.length === 0 ? 'rgba(61,122,82,0.35)' : shown.state === 'checking' ? 'rgba(237,231,216,0.10)' : 'rgba(139,32,32,0.35)',
            color: shown.state === 'ready' && shown.missing.length === 0 ? '#DDEFD9' : shown.state === 'checking' ? 'rgba(237,231,216,0.8)' : '#F6CFCF',
          }}>
          <span className="flex-1 min-w-0 [text-wrap:pretty]">
            {shown.state === 'checking' && t('device_join_checking')}
            {shown.state === 'error' && t('device_join_error')}
            {shown.state === 'ready' && (shown.missing.length === 0
              ? t('device_join_all', { n: seats.length })
              : t('device_join_missing', { names: names(shown.missing) }))}
            {shown.state === 'ready' && shown.idle.length > 0 && (
              <span className="block font-medium mt-0.5" style={{ color: 'rgba(238,217,138,0.9)' }}>{t('device_join_idle', { names: names(shown.idle) })}</span>
            )}
          </span>
          {shown.state !== 'checking' && (shown.state === 'error' || shown.missing.length > 0) && (
            <button type="button" onClick={() => { setCheck({ state: 'checking' }); setTick((n) => n + 1); }}
              className="shrink-0 text-[12.5px] font-bold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] rounded">
              {t('device_join_retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
  return <>{children(node, blocked)}</>;
}

// ── The ballot in progress ───────────────────────────────────────────────────
export function DeviceVotingPanel({ code, chairSuffix, documentId, ballotId, seats, isViewOnly, headName, onCount, onRevealed }: {
  code: string;
  chairSuffix?: string | null;
  documentId: string;
  /** vote_state.startedAt: the ballot these counts belong to. */
  ballotId: string;
  /** The frozen order, resolved to live rows. */
  seats: Delegate[];
  isViewOnly: boolean;
  headName: string | null;
  onCount?: (cast: number, total: number) => void;
  /** Moderator only: every choice, once revealed. The page writes them into vote_state. */
  onRevealed: (votes: DelegateVote[]) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const visible = usePageVisible();
  const [status, setStatus] = useState<DeviceVoteStatus | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealFailed, setRevealFailed] = useState(false);
  const revealedBallotRef = useRef<string | null>(null);
  const revealBtnRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const revealingRef = useRef(false);
  useEffect(() => { revealingRef.current = revealing; });
  const onRevealedRef = useRef(onRevealed);
  const onCountRef = useRef(onCount);
  useEffect(() => { onRevealedRef.current = onRevealed; onCountRef.current = onCount; });

  const reveal = async (force: boolean) => {
    if (isViewOnly || revealedBallotRef.current === ballotId) return;
    setRevealing(true);
    setRevealFailed(false);
    const r = await revealDeviceVotes(code, documentId, chairSuffix, force);
    setRevealing(false);
    if (r.ok) {
      if (r.ballot !== ballotId || revealedBallotRef.current === ballotId) return;
      revealedBallotRef.current = ballotId;
      setConfirmOpen(false);
      onRevealedRef.current(r.votes);
      return;
    }
    // 'incomplete' on an automatic reveal means a vote was withdrawn meanwhile: keep waiting.
    if (r.reason !== 'incomplete' || force) setRevealFailed(true);
  };
  const revealRef = useRef(reveal);
  useEffect(() => { revealRef.current = reveal; });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let inFlight = false;
    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      const s = await getDeviceVoteStatus(code, documentId, chairSuffix);
      inFlight = false;
      if (cancelled) return;
      if (!s || s.ballot !== ballotId) { setReadFailed(!s); return; }
      setReadFailed(false);
      setStatus(s);
      onCountRef.current?.(s.cast, s.total);
      // Everyone has voted, or the ballot was already revealed (a reload mid-reveal):
      // reveal (idempotent) and hand the votes to the page.
      if ((s.revealed || (s.total > 0 && s.cast >= s.total)) && revealedBallotRef.current !== ballotId) {
        void revealRef.current(false);
      }
    };
    void run();
    const timer = setInterval(run, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [visible, code, documentId, chairSuffix, ballotId]);

  // The reveal confirmation is modal: Tab stays inside it, Escape closes it wherever focus is
  // (capture phase, so no page-level Escape handler sees it), and focus goes back to Reveal.
  useEffect(() => {
    if (!confirmOpen) return;
    const opener = revealBtnRef.current;
    const onKey = (e: KeyboardEvent) => {
      const root = confirmRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!revealingRef.current) setConfirmOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      const active = document.activeElement;
      if (focusables.length === 0) { e.preventDefault(); root.focus({ preventScroll: true }); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!(active instanceof Node) || !root.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && (active === first || active === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener && opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    };
  }, [confirmOpen]);

  const byId = new Map((status?.seats ?? []).map((s) => [s.id, s]));
  const total = status?.total ?? seats.length;
  const cast = status?.cast ?? 0;
  const notVoted = Math.max(0, total - cast);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center px-8 pt-6 pb-8 gap-6">
      <div className="text-center shrink-0">
        <p className="text-[15px] font-semibold" style={{ color: INK_SOFT }}>{t('device_vote_waiting')}</p>
        <p className="mt-2 text-[56px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: FOREST }} aria-live="polite">
          {t('device_vote_count', { cast, total })}
        </p>
        <div className="mt-4 mx-auto h-2.5 w-[min(520px,80vw)] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(27,56,40,0.10)' }} aria-hidden>
          <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${total > 0 ? (cast / total) * 100 : 0}%`, backgroundColor: FOREST }} />
        </div>
        {readFailed && <p role="status" className="mt-3 text-[13px] font-semibold" style={{ color: RED }}>{t('device_vote_status_failed')}</p>}
      </div>

      <ul className="flex-1 min-h-0 w-full max-w-5xl overflow-y-auto grid gap-3 content-start [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]" aria-label={t('device_vote_waiting')}>
        {seats.map((d) => {
          const s = byId.get(d.id);
          const voted = s?.voted === true;
          const offline = !!s && !s.joined;
          const label = voted ? t('device_vote_voted') : offline ? t('device_vote_not_joined') : t('device_vote_not_voted');
          return (
            <li key={d.id} className="flex flex-col items-center gap-2 rounded-2xl px-3 py-3 text-center"
              style={{ backgroundColor: voted ? 'rgba(27,56,40,0.08)' : '#FAF8F3', boxShadow: voted ? 'none' : '0 0 0 1px rgba(27,56,40,0.10)' }}>
              <span className="relative inline-flex" style={{ opacity: voted ? 1 : 0.8 }}>
                <SeatCircleFlag seat={d} size={52} decorative />
                <span aria-hidden className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: voted ? FOREST : offline ? RED : '#FAF8F3', color: voted ? GOLD : '#fff', boxShadow: voted || offline ? '0 0 0 2px #F6F1E9' : 'inset 0 0 0 1.5px rgba(27,56,40,0.35), 0 0 0 2px #F6F1E9' }}>
                  {voted ? <Check size={14} strokeWidth={3} /> : offline ? <WifiOff size={12} strokeWidth={2.5} /> : null}
                </span>
              </span>
              <span className="text-[14px] font-semibold leading-tight line-clamp-2" style={{ color: INK }}>{getCountryDisplayName(d.country, language)}</span>
              <span className="text-[12px] font-medium" style={{ color: offline ? RED : INK_SOFT }}>{label}</span>
            </li>
          );
        })}
      </ul>

      {isViewOnly ? (
        <p className="shrink-0 text-[15px] font-medium" style={{ color: INK_SOFT }}>{t('device_vote_follower', { name: headName ?? '' })}</p>
      ) : (
        <div className="shrink-0 flex flex-col items-center gap-2">
          {revealFailed && <p role="alert" className="text-[13.5px] font-semibold" style={{ color: RED }}>{t('device_vote_reveal_failed')}</p>}
          <button
            ref={revealBtnRef}
            type="button"
            disabled={revealing}
            onClick={() => { if (notVoted > 0) setConfirmOpen(true); else void reveal(false); }}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-full font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none disabled:opacity-60"
            style={{ backgroundColor: FOREST, color: GOLD, boxShadow: '0 2px 4px rgba(27,56,40,0.22), 0 12px 32px rgba(27,56,40,0.26)' }}
          >
            <Eye size={18} strokeWidth={2.5} aria-hidden />
            {revealing ? t('device_vote_revealing') : t('device_vote_reveal')}
          </button>
        </div>
      )}

      {confirmOpen && !isViewOnly && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(20,24,18,0.55)' }}
            onClick={() => { if (!revealing) setConfirmOpen(false); }}>
            <div ref={confirmRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="gv-reveal-title" aria-describedby="gv-reveal-body"
              className="rounded-[28px] w-full max-w-md flex flex-col overflow-hidden focus:outline-none"
              style={{ backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 24px 64px rgba(20,24,18,0.35)' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="px-7 pt-7 pb-2">
                <h2 id="gv-reveal-title" className="text-[22px] font-bold leading-tight" style={{ color: INK }}>{t('device_vote_reveal_title')}</h2>
                <p id="gv-reveal-body" className="text-[15px] leading-relaxed mt-2" style={{ color: INK_SOFT }}>{t('device_vote_reveal_body', { n: notVoted })}</p>
                {revealFailed && <p role="alert" className="text-sm font-semibold mt-3" style={{ color: RED }}>{t('device_vote_reveal_failed')}</p>}
              </div>
              <div className="px-7 pt-5 pb-7 flex gap-3">
                <button autoFocus type="button" disabled={revealing} onClick={() => setConfirmOpen(false)}
                  className="flex-1 h-12 rounded-2xl font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96] transition-transform disabled:opacity-50"
                  style={{ backgroundColor: '#EDE7D8', color: INK }}>
                  {t('device_vote_reveal_cancel')}
                </button>
                <button type="button" disabled={revealing} onClick={() => { void reveal(true); }}
                  className="flex-1 h-12 rounded-2xl font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96] transition-transform disabled:opacity-60"
                  style={{ backgroundColor: FOREST, color: GOLD }}>
                  {revealing ? t('device_vote_revealing') : t('device_vote_reveal')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
