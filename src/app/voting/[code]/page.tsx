'use client';

import { use, useEffect, useRef, useState } from 'react';
import FitToScreen from '@/components/FitToScreen';
import Portal from '@/components/Portal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, Delegate, DelegateStatus, CommitteeDocument } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { SeatArtProvider } from '@/components/SeatFlag';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { Emoji } from '@/components/Emoji';
import { Check, CornerDownRight, Flag, Minus, ShieldAlert, SkipForward, Undo2, X } from 'lucide-react';
import { PreVoteScreen } from '@/components/voting/PreVoteScreen';
import { VotingHeader } from '@/components/voting/VotingHeader';
import { ResolutionPicker, type PickCardState } from '@/components/voting/ResolutionPicker';
import { VoterCarousel, type SeatMark as CarouselMark } from '@/components/voting/VoterCarousel';
import { useCommitteeIdentity } from '@/components/voting/useCommitteeEmblem';
import { serverNowIso } from '@/lib/serverClock';
import { startSessionSync, rowFields } from '@/lib/sessionSync';
import { getCommitteeByCodeWithRetry, setDelegateStatus as setDelegateStatusInDB, setDelegateStatusesBulk, setDelegateObserver as setDelegateObserverInDB, updateDocumentStatus as updateDocumentStatusInDB, saveCommitteeSettings, endDebate as endDebateInDB } from '@/lib/committeeService';
import { useSettingsStore, DEFAULT_SETTINGS, impliedSettings, stripNonHydratedSettings, type CommitteeSettings } from '@/lib/settingsStore';
import { supabase } from '@/lib/supabase';
import { deriveGavelRole, getGavelDeviceId } from '@/lib/gavelDevice';
import { useSettingsSync } from '@/lib/useSettingsSync';
import {
  loadVoteStates, saveVoteState, setVotingPhase, isVoteOpen,
  type VoteChoice, type DelegateVote, type VoteStateV1, type VoteStatus, type FrozenSeat,
} from '@/lib/voteState';
import { VotingRulesPopover, computeVoteOutcome, isVetoDelegation } from '@/components/VotingRulesPanel';
import { useAuth } from '@/components/AuthProvider';
import type { ConferenceAccess } from '@/lib/conferenceAccess';
import { useSessionAccess } from '@/lib/useSessionAccess';
import ChairDeviceKickModal from '@/components/ChairDeviceKickModal';
import { useChairDeviceLock } from '@/lib/useChairDeviceLock';
import { sponsorLabel } from '@/lib/committeeFlags';
import { docName } from '@/lib/docNames';
import { SettingsPanel } from '@/components/SettingsPanel';

/**
 * Device-local evidence that this browser has actually been a chair of `code`.
 *
 * Two sources, both written by /chair/[code] and by nothing else:
 *   • `gavelling-settings` → settings[CODE].chairJoinSuffix — the chair page mirrors
 *     the DB credential there on every load (the delegate and advisor pages never
 *     write it, so its presence really does mean "this device opened the chair view")
 *   • `gavelling-rejoin` → { code, chairSuffix, chairName } for THIS committee
 *
 * Read straight out of localStorage rather than through the Zustand selector, and
 * captured during the FIRST render, because the access-granted effect below writes
 * the DB suffix into that same store. Reading it back afterwards would hand the
 * gate its own answer and let anyone in on the second page load.
 */
function readChairDeviceProof(code: string): { suffix: string | null; chairName: string | null } {
  if (typeof window === 'undefined') return { suffix: null, chairName: null };
  const upper = code.toUpperCase();
  let suffix: string | null = null;
  let chairName: string | null = null;
  try {
    const raw = localStorage.getItem('gavelling-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { settings?: Record<string, { chairJoinSuffix?: string }> } };
      const bag = parsed?.state?.settings ?? {};
      const entry = bag[upper] ?? bag[code];
      if (entry?.chairJoinSuffix) suffix = String(entry.chairJoinSuffix);
    }
  } catch { /* unreadable store — fall through to the rejoin blob */ }
  try {
    const raw = localStorage.getItem('gavelling-rejoin');
    if (raw) {
      const parsed = JSON.parse(raw) as { code?: string; chairSuffix?: string | null; chairName?: string | null };
      if ((parsed?.code ?? '').toUpperCase() === upper) {
        if (!suffix && parsed.chairSuffix) suffix = String(parsed.chairSuffix);
        if (parsed.chairName) chairName = String(parsed.chairName);
      }
    }
  } catch { /* malformed blob — no proof from here */ }
  return { suffix, chairName };
}

function abbreviateCommitteeName(name: string): string {
  return name
    .replace(/\bUN\s+Security\s+Council\b/gi, 'UNSC')
    .replace(/\bUN\s+General\s+Assembly\b/gi, 'UNGA')
    .replace(/\bUN\s+Human\s+Rights\s+Council\b/gi, 'UNHRC')
    .replace(/United Nations Security Council/gi, 'UNSC')
    .replace(/Security Council/gi, 'UNSC')
    .replace(/United Nations General Assembly/gi, 'UNGA')
    .replace(/General Assembly/gi, 'UNGA')
    .replace(/United Nations Human Rights Council/gi, 'UNHRC')
    .replace(/Human Rights Council/gi, 'HRC')
    .replace(/^UN\s+/i, '');
}

type VotingPhase = VoteStatus;

/**
 * `Date.now()` behind a module-scope helper.
 *
 * The purity lint treats a bare `Date.now()` written inside a component body as a
 * render-time impurity even when the call only ever happens from an event handler
 * (see the standing error on RollCallPanel's `applyStatus`). The timestamps below
 * are receipts for optimistic writes, so they must be taken at click time.
 */
function nowMs(): number {
  return Date.now();
}

/**
 * How long an optimistic observer placard survives without the refetched row
 * agreeing. `setDelegateObserver` returns void and swallows its error, and every
 * `delegates` write is gated on the `x-chair-suffix` header by RLS — the exact
 * class of silent rejection that broke every delegate write for two months. Long
 * enough for a slow write, short enough that a refused one cannot keep hiding
 * behind a placard that looks correct. Mirrors RollCallPanel's OPTIMISTIC_TTL_MS.
 */
const OBSERVER_WRITE_TTL_MS = 8000;

/** Announces delegations that joined the committee since this screen opened.
 *  It never seats anyone: seating a delegation is the chair's decision. */
function RosterNotice({ names, notInVote, onOpenRollCall, onDismiss }: {
  names: string[];
  /** A ballot is frozen, so the arrivals are not part of the vote on screen. */
  notInVote: boolean;
  onOpenRollCall: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  return (
    <div className="w-full flex justify-center px-4 pt-3 shrink-0">
      <div
        className="w-full max-w-3xl rounded-xl px-4 py-2.5 flex items-center gap-3"
        style={{ backgroundColor: 'rgba(182,135,31,0.14)', border: '1px solid rgba(182,135,31,0.40)' }}
      >
        <Emoji size="1.1rem">🪧</Emoji>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1C1410]">{t('voting_roster_joined', { names: names.join(', ') })}</p>
          <p className="text-xs text-[#6A5A4A]">
            {notInVote ? `${t('voting_roster_not_in_vote')} ${t('voting_roster_open_roll_call')}` : t('voting_roster_open_roll_call')}
          </p>
        </div>
        <button
          onClick={onOpenRollCall}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors focus:outline-none gv-lift"
          style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
        >
          {t('voting_roll_call_heading')}
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-[#9A8A78] hover:text-[#1C1410] transition-colors focus:outline-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** A slim notice under the header: the room's voting mode, a refused ballot write, the
 *  Commenter's read-only state. */
function VotingBanner({ tone, text, actionLabel, onAction, onDismiss }: {
  tone: 'red' | 'amber' | 'neutral';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const palette = tone === 'red'
    ? { bg: 'rgba(139,32,32,0.10)', border: 'rgba(139,32,32,0.32)', fg: '#8B2020' }
    : tone === 'amber'
    ? { bg: 'rgba(182,135,31,0.14)', border: 'rgba(182,135,31,0.40)', fg: '#6A4A0A' }
    : { bg: 'rgba(27,56,40,0.06)', border: 'rgba(27,56,40,0.18)', fg: '#1B3828' };
  return (
    <div className="w-full flex justify-center px-4 pt-3 shrink-0">
      <div
        role={tone === 'red' ? 'alert' : 'status'}
        className="w-full max-w-3xl rounded-xl px-4 py-2 flex items-center gap-3"
        style={{ backgroundColor: palette.bg, border: `1px solid ${palette.border}` }}
      >
        <p className="flex-1 min-w-0 text-xs font-semibold leading-snug" style={{ color: palette.fg }}>{text}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold focus:outline-none gv-lift"
            style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[#9A8A78] hover:text-[#1C1410] focus:outline-none">✕</button>
        )}
      </div>
    </div>
  );
}

/** An observer write that the DB never confirmed. Portaled above the roll call
 *  modal so it is visible whether or not that modal is still open. */
function ObserverWriteFailedBanner({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  return (
    <Portal>
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md rounded-xl px-4 py-3 flex items-start gap-3 shadow-2xl"
        style={{ backgroundColor: '#8B2020', color: 'white' }}
        role="alert"
      >
        <span className="flex-1 text-sm font-semibold leading-snug">{t('voting_observer_write_failed')}</span>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100 focus:outline-none">✕</button>
      </div>
    </Portal>
  );
}

/** The ballot buttons. Colour carries the direction, an icon repeats it for anyone who
 *  cannot tell red from green, and "with rights" is a second line, never a separate hue.
 *  `recorded` marks the choice already on record for this delegation (after Back). */
function BallotButton({ tone, icon, label, sub, onClick, disabled, recorded, wide }: {
  tone: 'for' | 'against' | 'neutral';
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  recorded?: boolean;
  wide?: boolean;
}) {
  const palette = tone === 'for'
    ? { bg: '#2F6B45', hover: '#3A7F53', fg: '#FFFFFF', sub: 'rgba(238,217,138,0.95)', shadow: 'rgba(27,56,40,0.28)' }
    : tone === 'against'
    ? { bg: '#8B2020', hover: '#A02C2C', fg: '#FFFFFF', sub: 'rgba(255,222,190,0.95)', shadow: 'rgba(90,20,20,0.26)' }
    : { bg: '#FAF8F3', hover: '#FFFFFF', fg: '#1C1410', sub: '#6A5A4A', shadow: 'rgba(27,56,40,0.12)' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={recorded || undefined}
      className={`gv-ballot relative ${wide ? 'flex-[1.25]' : 'flex-1'} min-w-0 min-h-[84px] rounded-[18px] px-3 py-3 flex flex-col items-center justify-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F1E9] disabled:cursor-not-allowed disabled:opacity-40`}
      style={{
        ['--gv-b-bg' as string]: palette.bg,
        ['--gv-b-hover' as string]: palette.hover,
        color: palette.fg,
        boxShadow: `${tone === 'neutral' ? '0 0 0 1px rgba(27,56,40,0.12), ' : ''}0 2px 4px ${palette.shadow}, 0 10px 24px ${palette.shadow}${recorded ? ', 0 0 0 3px #F6F1E9, 0 0 0 6px #D9B44A' : ''}`,
      }}
    >
      <span className="flex items-center gap-2 text-[17px] font-semibold leading-none">
        <span aria-hidden className="shrink-0">{icon}</span>
        {label}
      </span>
      {sub && <span className="text-[13px] font-medium leading-none" style={{ color: palette.sub }}>{sub}</span>}
    </button>
  );
}

function VoteScale({ forCount, againstCount, totalVoted }: {
  forCount: number; againstCount: number; totalVoted: number;
}) {
  const t = useT();
  const forPct = totalVoted > 0 ? (forCount / totalVoted) * 50 : 0;
  const againstPct = totalVoted > 0 ? (againstCount / totalVoted) * 50 : 0;
  // The bar is physical (against on the left, for on the right) in every language, and so
  // are its labels, so the picture and the words always agree.
  return (
    <div className="w-full px-0" dir="ltr">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(27,56,40,0.09)' }}>
        <div
          className="absolute right-1/2 top-0 bottom-0 rounded-l-full transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          style={{ width: `${againstPct}%`, backgroundColor: '#8B2020' }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 rounded-r-full transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          style={{ width: `${forPct}%`, backgroundColor: '#2F6B45' }}
        />
        <div className="absolute left-1/2 -top-px -bottom-px w-[3px] -translate-x-1/2 rounded-full" style={{ backgroundColor: '#F6F1E9' }} />
      </div>
      <div className="flex justify-between mt-2 text-[13px] font-semibold tabular-nums">
        <span style={{ color: '#8B2020' }}>{t('voting_against_bar').replace('{n}', String(againstCount))}</span>
        <span className="text-[12.5px] font-medium" style={{ color: '#6A5A4A' }}>{t('voting_voted_count').replace('{n}', String(totalVoted))}</span>
        <span style={{ color: '#2F6B45' }}>{t('voting_for_bar').replace('{n}', String(forCount))}</span>
      </div>
    </div>
  );
}

function GavelLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#EDE7D8' }}>
      <style>{`
        @keyframes gavel-strike {
          0%   { transform: rotate(-30deg); }
          35%  { transform: rotate(15deg); }
          50%  { transform: rotate(10deg); }
          65%  { transform: rotate(15deg); }
          100% { transform: rotate(-30deg); }
        }
        .gavel-anim {
          animation: gavel-strike 1s ease-in-out infinite;
          transform-origin: 85% 85%;
        }
      `}</style>
      <svg className="gavel-anim" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="38" y="38" width="8" height="28" rx="3" transform="rotate(-45 38 38)" fill="#1B3828" />
        <rect x="8" y="14" width="36" height="16" rx="5" transform="rotate(-45 8 14)" fill="#B6871F" />
        <rect x="10" y="16" width="36" height="7" rx="3" transform="rotate(-45 10 16)" fill="#6A5A4A" opacity="0.4" />
        <circle cx="56" cy="56" r="3" fill="#1B3828" opacity="0.5" />
      </svg>
      <span className="sr-only" role="status">Loading</span>
    </div>
  );
}

const isVotingAccessKind = (kind: ConferenceAccess['kind']) => kind === 'chair' || kind === 'organizer';

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  // ── ALL hooks must be called before any early returns ──────────────────────
  const t = useT();
  const { language } = useLanguage();
  // Subscribe to the settings SLICE, not the getSettings selector: selecting the
  // (stable) function would never re-render this page when a rule changes, so the
  // inline rules console could not live-recompute the verdict.
  const settingsMap = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { user, session, loading: authLoading } = useAuth();
  const votingAccess = useSessionAccess({ code, gate: 'dais', allow: isVotingAccessKind });
  const confAccess = votingAccess.state;
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  // The initial room read failed (after its retries): an inline Retry, never "not found".
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // ── Standalone chair gate ──────────────────────────────────────────────────
  // This page ends debate, adjourns the committee, rewrites delegate statuses,
  // persists resolution results and hosts the whole SettingsPanel. It used to be
  // reachable by anyone who could read the six-character code off the header chip.
  // Standalone sessions now require the chair code — the same credential the join
  // page checks (`dbChairJoinSuffix`). Captured on the first render, before the
  // access-granted effect mirrors the DB value into the settings store.
  const [deviceChairProof] = useState(() => readChairDeviceProof(code));
  // ?chairName= read once, in the same first-render initializer, so the derived gate
  // below never touches `window` during render (this page has no Suspense boundary,
  // so useSearchParams() would break the prerender).
  const [urlChairName] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('chairName') ?? '',
  );
  const [chairCodeUnlocked, setChairCodeUnlocked] = useState(false);
  const [chairCodeInput, setChairCodeInput] = useState('');
  const [chairCodeError, setChairCodeError] = useState('');
  // Identity-implied settings seeded at load (UNSC → P5 veto) that still have to be
  // written back to the DB. Only flushed once access is granted.
  const settingsSeedRef = useRef<Partial<CommitteeSettings> | null>(null);

  // Conference-session access guard (#8). A conference session requires a signed-in
  // verified member of THIS committee's conference; a standalone session falls
  // through to the chair-code gate below. useSessionAccess is keyed on the user id (a token
  // refresh used to flash the loader over an open ballot) and turns a failed check into an
  // inline retry instead of a verdict.

  // Standalone gate — DERIVED, not state. It is a pure function of the committee row
  // plus the credentials this device already held at first render, so there is no
  // window where it reads "allowed" before the committee has loaded.
  const chairGate: 'checking' | 'allowed' | 'locked' = (() => {
    if (confAccess !== 'standalone') return 'allowed';        // conference path owns its own gate
    if (loading) return 'checking';
    if (chairCodeUnlocked) return 'allowed';                  // chair code typed on this screen
    if (!committee) return 'allowed';                         // the "not found" screen owns this case
    const expected = (committee.dbChairJoinSuffix ?? '').trim();
    if (expected) return deviceChairProof.suffix === expected ? 'allowed' : 'locked';
    // Legacy committee with no chair code at all — there is no credential to check,
    // so fall back to the weaker device proof rather than locking its chairs out:
    // having been in this committee's chair view, or arriving with a ?chairName=
    // the committee itself knows.
    const knownName = !!urlChairName && committee.chairNames.includes(urlChairName);
    return deviceChairProof.chairName || knownName ? 'allowed' : 'locked';
  })();

  const accessGranted = confAccess === 'allowed' || (confAccess === 'standalone' && chairGate === 'allowed');

  // One device per signed-in account (src/lib/useChairDeviceLock.ts). Same device token as
  // the chair page, so opening voting on the SAME device never kicks the chair page, while
  // a second device does. Anonymous chairs: inert.
  const deviceLock = useChairDeviceLock({
    code,
    committeeId: committee?.id,
    userId: user?.id,
    accessToken: session?.access_token,
    enabled: accessGranted && !!committee?.id && !committee?.endedAt,
  });

  // Post-access side effects. Deliberately NOT in the loader:
  //  • mirroring `chairJoinSuffix` into the settings store there would hand the gate
  //    its own answer on the next load (and is only needed so SettingsPanel does not
  //    mint a fresh suffix — SettingsPanel only renders once access is granted)
  //  • the identity-implied settings seed is a DB write, which must never fire for
  //    someone who has not proved they chair this committee
  useEffect(() => {
    if (!accessGranted || !committee) return;
    if (committee.dbChairJoinSuffix) {
      updateSetting(committee.code, 'chairJoinSuffix', committee.dbChairJoinSuffix);
    }
    const seed = settingsSeedRef.current;
    if (seed && Object.keys(seed).length > 0) {
      settingsSeedRef.current = null;
      // Read-merge write: it only ADDS the absent key, so it cannot disturb anything
      // the chair has already chosen.
      saveCommitteeSettings(committee.id, seed, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  }, [accessGranted, committee?.id]);
  // ── Persisted votes (V-2) ──────────────────────────────────────────────────
  // Every ballot, the voter pointer, the pass round, the rights sequence and the verdict live
  // in `documents.vote_state` (src/lib/voteState.ts), so a reload loses nothing and every
  // chair device sees the same vote. ONE device drives it: the Moderator's (the same
  // `deriveGavelRole` the chair page uses). Every other chair device renders the stored
  // state read-only and follows it live.
  const [voteStates, setVoteStates] = useState<Record<string, VoteStateV1>>({});
  /** Synchronous mirror, so two taps inside one render still chain their seq numbers. */
  const voteStatesRef = useRef<Record<string, VoteStateV1>>({});
  /** Highest seq this device wrote per document that the DB has not echoed back yet. */
  const pendingSeqRef = useRef<Record<string, number>>({});
  /** Writes are serialised: a later ballot can never land before an earlier one. */
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  /** Highest seq the DB has accepted from this device, per document. */
  const savedSeqRef = useRef<Record<string, number>>({});
  const [voteSaveError, setVoteSaveError] = useState<null | { docId: string; kind: 'denied' | 'error' | 'stale' }>(null);
  /** A verdict whose documents.status write did not land (V2). */
  const [resultSaveError, setResultSaveError] = useState<null | { docId: string; result: 'passed' | 'failed' | 'introduced' }>(null);
  const [rightsSpeakerTime, setRightsSpeakerTime] = useState(60);
  const [rightsRunning, setRightsRunning] = useState(false);
  const rightsTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** The roll call opened on its own (resolution list, roster notice), with no vote to start. */
  const [rollCallOpen, setRollCallOpen] = useState(false);
  /** The draft resolution a new vote is about to open on. Choosing one (or Vote again) opens
   *  the roll call; confirming it starts the ballot. Every new ballot passes through it. */
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // Local delegate statuses for roll call modal (mirrors committee.delegates)
  const [rollCallStatuses, setRollCallStatuses] = useState<Record<string, DelegateStatus>>({});
  const [showEndDebateConfirm, setShowEndDebateConfirm] = useState(false);
  const [endDebateState, setEndDebateState] = useState<'idle' | 'working' | 'failed'>('idle');
  /** Why phones are NOT in voting mode, or why leaving it failed. */
  const [phaseNotice, setPhaseNotice] = useState<null | 'closed' | 'enter_failed' | 'leave_failed'>(null);
  const [backBusy, setBackBusy] = useState(false);
  /** "Hide tally": the running count is not on screen at all (no bar, no numbers, no
   *  verdict chip) until the result. Per device, remembered per committee so a reload
   *  on a projector never flashes the tally. localStorage only (a per-viewer preference). */
  const [hideVotes, setHideVotesState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(`gavelling-hide-tally:${code.toUpperCase()}`) === '1'; } catch { return false; }
  });
  const setHideVotes = (next: boolean) => {
    setHideVotesState(next);
    try { localStorage.setItem(`gavelling-hide-tally:${code.toUpperCase()}`, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  /** A follower (view-only) tracks the live vote unless they picked a document themselves. */
  const [followLive, setFollowLive] = useState(true);
  const dragIndexRef = useRef<number | null>(null);
  const enteredVotingRef = useRef(false);
  const [gavelDeviceId] = useState(() => getGavelDeviceId(code));
  // D-1: another chair's settings change reaches this screen's rules as well.
  const settingsSync = useSettingsSync(committee);
  // Same derivation as the chair page. UI gate only (AGENTS.md rule 15).
  const gavelRole = deriveGavelRole(committee, urlChairName, gavelDeviceId);
  const isViewOnly = !!committee && !gavelRole.isModerator;
  /** Latest role for async continuations (a queued vote save outliving a gavel handover). */
  const isViewOnlyRef = useRef(isViewOnly);
  useEffect(() => { isViewOnlyRef.current = isViewOnly; }, [isViewOnly]);
  // The committee's emblem and acronym for the header (same resolution as the chair masthead).
  const identity = useCommitteeIdentity(code, committee?.name, committee?.sessionOrigin === 'conference', language);

  const followDocId = isViewOnly && followLive
    ? (Object.entries(voteStates)
        .filter(([, st]) => isVoteOpen(st))
        .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0]?.[0] ?? null)
    : null;
  const activeDocId = selectedDocId ?? followDocId;
  const activeVote: VoteStateV1 | null = activeDocId ? voteStates[activeDocId] ?? null : null;
  const rightsIndex = activeVote?.rightsIndex ?? 0;
  const rightsTimerLimit = activeVote?.rightsTimerLimit ?? 60;
  const anyOpenVote = Object.values(voteStates).some(isVoteOpen);

  // ── Live roster plumbing ───────────────────────────────────────────────────
  /** Monotonic ticket, taken before every fetch and re-checked after it resolves.
   *  Realtime fires several events per chair action, so overlapping refetches are
   *  the normal case, not an edge case: without this a slow earlier response lands
   *  on top of a newer one and the roster goes backwards. */
  const refetchSeqRef = useRef(0);
  /** Ids whose roll-call status THIS chair set on THIS screen. Those keep the local
   *  value across a refetch; every other id follows the DB. The old one-time seed
   *  did the opposite — it froze the whole map at mount, so another chair's status
   *  changes were ignored for the rest of the session. */
  const touchedStatusRef = useRef<Set<string>>(new Set());
  /** Every delegate id this screen has already seen. `null` until the first load,
   *  so the initial roster is never announced as an arrival. */
  const knownSeatIdsRef = useRef<Set<string> | null>(null);
  const [newSeatIds, setNewSeatIds] = useState<string[]>([]);
  /** Verdicts this screen has already recorded, re-applied after every refetch so a
   *  refetch racing the write cannot revert a result that is already on screen. */
  const docResultPatchRef = useRef<Record<string, 'passed' | 'failed' | 'introduced'>>({});
  // Back from a result puts the paper back to `introduced`, but only once THAT vote state
  // has landed (seq per document). If another device's newer state wins instead, nothing
  // is written to the document and the stored state is applied.
  const backStatusSeqRef = useRef<Record<string, number>>({});
  /** Optimistic observer placards awaiting confirmation from the refetched row. */
  const observerWriteRef = useRef<Record<string, { value: boolean; at: number }>>({});
  const [observerOverrides, setObserverOverrides] = useState<Record<string, boolean>>({});
  const [observerReconcileTick, setObserverReconcileTick] = useState(0);
  const [observerWriteFailed, setObserverWriteFailed] = useState(false);
  /**
   * The room as it stood when this ballot opened.
   *
   * FREEZE THE BALLOT — do not merely re-key `currentVoterIndex` off a delegate id.
   * Re-keying the pointer would protect only the pointer, but the numerator and the
   * denominator are roster-derived too: `presentAndPvDelegates` is the unanimity and
   * quorum NUMERATOR and `votableDelegates` is the quorum/veto DENOMINATOR passed as
   * `totalCount`. A delegation arriving (or a placard changing) mid-ballot would
   * therefore silently move the bar that a vote already in progress is being judged
   * against. A roll-call vote is a snapshot of the room at the moment it opened, so
   * the whole roster is snapshotted here and every count reads from it until the
   * ballot ends. Rows are resolved back to the live row BY ID at render time, so a
   * rename or a new crest still flows through while the array length can never
   * change under the index. "Vote again" re-freezes from the live room.
   */
  // (The frozen roster now lives in the persisted vote state: `order` and `votable`.)

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    /** Re-apply verdicts this screen already recorded. `persistResult` writes them
     *  optimistically; a refetch in flight when that write went out still carries
     *  the pre-vote status, and would otherwise revert the result on screen. */
    const withRecordedDocs = (docs: Committee['documents']): Committee['documents'] => {
      const patches = docResultPatchRef.current;
      if (Object.keys(patches).length === 0) return docs;
      return (docs ?? []).map((d) => (patches[d.id] ? { ...d, status: patches[d.id] } : d));
    };

    const absorbDelegates = (delegates: Delegate[]) => {
      // MERGE, never re-seed: ids this chair touched on this screen keep their local
      // value, everything else follows the DB.
      setRollCallStatuses((prev) => {
        const next: Record<string, DelegateStatus> = {};
        delegates.forEach((d) => {
          next[d.id] = touchedStatusRef.current.has(d.id) ? (prev[d.id] ?? d.status) : d.status;
        });
        return next;
      });
      // Announce arrivals. Never seat them — marking a delegation present is a
      // chair's decision, and this screen counts votes.
      const known = knownSeatIdsRef.current;
      if (known === null) {
        knownSeatIdsRef.current = new Set(delegates.map((d) => d.id));
        return;
      }
      const arrivals = delegates.filter((d) => !known.has(d.id)).map((d) => d.id);
      delegates.forEach((d) => known.add(d.id));
      if (arrivals.length > 0) {
        setNewSeatIds((prev) => [...prev, ...arrivals.filter((id) => !prev.includes(id))]);
      }
    };

    const absorb = (found: Committee) => {
      setCommittee({ ...found, documents: withRecordedDocs(found.documents) });
      absorbDelegates(found.delegates);
    };

    // Vote states: the DB wins, except where this device has written a newer seq that has
    // not echoed back yet (the driver's optimistic ballots).
    let voteSeq = 0;
    const refetchVotes = async (committeeId: string) => {
      const ticket = ++voteSeq;
      const loaded = await loadVoteStates(committeeId);
      if (cancelled || ticket !== voteSeq || !loaded) return;
      const merged: Record<string, VoteStateV1> = { ...loaded };
      for (const [docId, local] of Object.entries(voteStatesRef.current)) {
        const pending = pendingSeqRef.current[docId];
        const stored = loaded[docId];
        if (pending !== undefined && (!stored || stored.seq < pending)) {
          merged[docId] = local;
        } else if (pending !== undefined) {
          delete pendingSeqRef.current[docId];
        }
      }
      voteStatesRef.current = merged;
      setVoteStates(merged);
    };

    async function load() {
      const ticket = ++refetchSeqRef.current;
      // A failed read is not "not found": retried with backoff, then an inline Retry.
      const result = await getCommitteeByCodeWithRetry(code, { isCancelled: () => cancelled });
      if (cancelled || ticket !== refetchSeqRef.current) return;
      if (result.status === 'error') { setLoadFailed(true); setLoading(false); return; }
      setLoadFailed(false);
      const found = result.status === 'ok' ? result.committee : null;
      if (!found) setCommittee(null);
      if (found) {
        // Defaults the committee's IDENTITY implies — today: a Security Council
        // starts with the P5 veto on. `impliedSettings` returns a key ONLY when it
        // is absent from the stored jsonb, so an explicit chair choice (including
        // deliberately switching the veto OFF) always wins and is never re-applied.
        const stored = (found.dbSettings ?? {}) as Record<string, unknown>;
        const implied = impliedSettings(found.name, stored);
        settingsSeedRef.current = Object.keys(implied).length > 0 ? implied : null;
        if (found.dbSettings) {
          // DB is the source of truth — apply the master chair's saved thresholds/veto/etc.
          //
          // `headChair` must NOT enter the store. Both write paths on this page
          // (`applyRule` below and SettingsPanel's `upd`) POST the WHOLE settings
          // object back, so a gavel holder captured at page load would silently
          // revert the gavel the moment another chair took it. Same for the
          // write-only `separateChairCode` marker. See AGENTS.md rule 12.
          // `chairJoinSuffix` is stripped here too — it is the credential the
          // standalone gate below checks against, and hydrating it would write the
          // DB answer into localStorage for anyone who merely opened this URL,
          // unlocking the gate on their next page load. The access-granted effect
          // above puts it back once the viewer has proved they chair this session.
          // `agendaTopicIndex` is stripped for the same reason as `headChair`: it is written
          // only by the chair's agenda picker (updateCommitteeAgendaInDB), and a copy
          // captured here would revert a later choice made on another device.
          // `headChairDevice` (src/lib/gavelDevice.ts) is the gavel's device half: same reason.
          // `votingReturnPhase` (set_committee_voting_phase) is stripped too: see
          // NON_HYDRATED_SETTING_KEYS in settingsStore.ts, the one list of these keys.
          const rest = stripNonHydratedSettings(stored);
          // Key on found.code, not the URL param: getCommitteeByCode uppercases
          // before querying, and every read below goes through committee.code.
          // A lowercase URL would otherwise hydrate a key nothing ever reads.
          hydrateSettings(found.code, { ...(rest as Partial<CommitteeSettings>), ...implied });
        } else if (Object.keys(implied).length > 0) {
          hydrateSettings(found.code, implied);
        }
        // `chairJoinSuffix` DOES have to reach the store — it is the opposite case.
        // It is the only write credential (x-chair-suffix → is_session_chair) and
        // the code every chair typed on the join page. Leaving it out means the
        // store reads '' on any device that has no localStorage entry for this
        // committee (Commenter who arrived by link, fresh browser, incognito,
        // cleared cache); SettingsPanel's mount effect then MINTS A NEW RANDOM
        // SUFFIX and writes it to the DB, and `applyRule` writes '' back over the
        // real one — either way every chair holding the printed code is locked out.
        // It is written by the access-granted effect above rather than here, so the
        // standalone chair gate cannot be satisfied by this page's own write.
        absorb(found);
        await refetchVotes(found.id);
        if (cancelled) return;
      }
      setLoading(false);
      if (cancelled || !found) return;
      // The roster used to be frozen at mount: nothing refreshed committee.delegates,
      // so a delegation added mid-session (chair sidebar, or the organiser's committee
      // editor) stayed invisible and the quorum denominator here disagreed with the
      // chair page's. speakers_list, current_speaker and messages are deliberately
      // ignored: this page renders none of them.
      //
      // The same pipeline as the chair, delegate and advisor pages (src/lib/sessionSync.ts):
      // one fetch per SLICE, coalesced 200 ms, per-slice sequencing, catch-up on reconnect,
      // wake and online. A ballot write fires a documents event on every chair device; it
      // now costs one documents read (plus the light vote-state read), never a whole
      // committee refetch per vote.
      const sync = startSessionSync({
        committeeId: found.id,
        tables: ['committees', 'delegates', 'documents'],
        slices: ['row', 'delegates', 'documents'],
        onEvent: (table) => { if (table === 'documents') void refetchVotes(found.id); return false; },
        onCatchUp: (phase) => { if (phase === 'start') void refetchVotes(found.id); },
        apply: (slice, data) => {
          if (cancelled) return;
          switch (slice) {
            case 'row': setCommittee((prev) => (prev ? { ...prev, ...rowFields(data as Committee) } : prev)); return;
            case 'delegates': {
              const delegates = data as Delegate[];
              setCommittee((prev) => (prev ? { ...prev, delegates } : prev));
              absorbDelegates(delegates);
              return;
            }
            case 'documents': setCommittee((prev) => (prev ? { ...prev, documents: withRecordedDocs(data as Committee['documents']) } : prev)); return;
          }
        },
      });
      unsubscribe = sync.stop;
    }
    load();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [code, loadAttempt]);

  // ── Observer write reconciliation ──────────────────────────────────────────
  // `setDelegateObserver` returns void and swallows its error, and every delegates
  // write is gated on the x-chair-suffix header by RLS. So an optimistic placard is
  // only a claim until the refetched row agrees with it: drop the override the
  // moment it does, revert it and say so after OBSERVER_WRITE_TTL_MS if it never
  // does. An RLS rejection must never hide behind a placard that looks correct.
  useEffect(() => {
    const pending = observerWriteRef.current;
    const ids = Object.keys(pending);
    if (ids.length === 0) return;
    const flagById = new Map((committee?.delegates ?? []).map((d) => [d.id, d.isObserver === true]));
    const now = nowMs();
    let changed = false;
    let failed = false;
    let nextCheckIn = Infinity;
    for (const id of ids) {
      const entry = pending[id];
      const dbFlag = flagById.get(id);
      if (dbFlag === undefined || dbFlag === entry.value) {
        delete pending[id];
        changed = true;
      } else if (now - entry.at >= OBSERVER_WRITE_TTL_MS) {
        delete pending[id];
        changed = true;
        failed = true;
      } else {
        nextCheckIn = Math.min(nextCheckIn, OBSERVER_WRITE_TTL_MS - (now - entry.at));
      }
    }
    if (changed) {
      const rebuilt: Record<string, boolean> = {};
      for (const [id, entry] of Object.entries(pending)) rebuilt[id] = entry.value;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the DB row is the external system this effect synchronises against; there is no render-time value that can tell a landed write from a silently refused one.
      setObserverOverrides(rebuilt);
      // Same reason: only this reconcile pass knows the write never landed, and a
      // silent RLS rejection has to become visible.
      if (failed) setObserverWriteFailed(true);
    }
    // Nothing will arrive if the write was refused, so self-schedule the backstop.
    if (nextCheckIn !== Infinity) {
      const timer = setTimeout(() => setObserverReconcileTick((n) => n + 1), nextCheckIn + 50);
      return () => clearTimeout(timer);
    }
  }, [committee?.delegates, observerReconcileTick]);

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)}: Voting`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

  // Rights speaker countdown timer
  useEffect(() => {
    if (rightsRunning) {
      rightsTimerRef.current = setInterval(() => {
        setRightsSpeakerTime((prev) => {
          if (prev <= 1) { setRightsRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; }
    }
    return () => { if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; } };
  }, [rightsRunning]);

  // Reset rights timer when speaker index or limit changes
  useEffect(() => {
    setRightsSpeakerTime(rightsTimerLimit);
    setRightsRunning(false);
  }, [rightsIndex, rightsTimerLimit, activeDocId]);

  // ── V-3: the room enters voting mode when the Moderator opens this screen ──────
  // `set_committee_voting_phase` remembers the phase the room was in and sets 'voting' in
  // ONE statement, so delegate phones switch to "Vote in progress" and Request to Speak
  // closes. Already voting (a reload) is a no-op, so the remembered phase is never
  // overwritten with 'voting'. A suspended or ended room is refused and the chair is told.
  // Commenters never write it. "Back to Session" restores the remembered phase (V-4).
  // A suspended room refuses with `closed`. The latch is released on every refusal, and the
  // effect is keyed on whether the room is closed, so the moment the room resumes (the row
  // arrives with suspended_at cleared and a live phase) the entry is attempted again.
  const roomClosed = !!committee?.suspendedAt || committee?.phase === 'adjourned';
  useEffect(() => {
    if (!accessGranted || !committee || isViewOnly || enteredVotingRef.current) return;
    if (committee.endedAt) return;
    enteredVotingRef.current = true;
    const id = committee.id;
    void setVotingPhase(id, true, committee.code, committee.dbChairJoinSuffix ?? undefined).then((r) => {
      if (r.ok) {
        setPhaseNotice(null);
        setCommittee((prev) => (prev && prev.id === id ? { ...prev, phase: 'voting' } : prev));
      } else {
        setPhaseNotice(r.reason === 'closed' ? 'closed' : 'enter_failed');
        // Released on every refusal: a `closed` room retries when `roomClosed` flips back.
        enteredVotingRef.current = false;
      }
    });
  // Keyed on identity and on the room opening or closing, not on every refetched committee object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessGranted, committee?.id, committee?.endedAt, isViewOnly, roomClosed]);

  if (
    loading || authLoading || confAccess === 'checking' ||
    (confAccess === 'standalone' && chairGate === 'checking')
  ) {
    return <GavelLoader />;
  }

  if (confAccess === 'signin') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1B3828' }}>Sign in to view this session</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>This is a conference session. Sign in to verify your access.</p>
          <Link href={'/auth/signin?next=' + encodeURIComponent('/join?code=' + code)} className="inline-block font-semibold text-white px-6 py-3 rounded-full transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  if (confAccess === 'denied') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1B3828' }}>You don&apos;t chair this committee</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>The voting screen is part of the chair session. Only the committee&apos;s chair can open it.</p>
          <Link href="/sessions" className="inline-block font-semibold text-white px-6 py-3 rounded-full transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>Back to home</Link>
        </div>
      </div>
    );
  }

  if (confAccess === 'error') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm" role="alert">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1B3828' }}>{t('session_access_error_title')}</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>{t('session_access_error_body')}</p>
          <button onClick={votingAccess.retry} className="inline-block font-semibold text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>{t('delegate_seat_retry')}</button>
        </div>
      </div>
    );
  }

  if (!committee && loadFailed) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center px-6">
        <div className="text-center max-w-sm" role="alert">
          <h1 className="text-xl font-bold text-[#1C1410] mb-6">{t('session_load_failed')}</h1>
          <button
            onClick={() => { setLoadFailed(false); setLoading(true); setLoadAttempt((n) => n + 1); }}
            className="inline-block font-semibold text-white px-6 py-3 rounded-xl transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828' }}
          >
            {t('delegate_seat_retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4"><Emoji size="2.5rem">🔍</Emoji></div>
          <h1 className="text-2xl font-bold text-[#1C1410] mb-2">Committee not found</h1>
          <p className="text-[#6A5A4A] mb-6">Code &ldquo;{code}&rdquo; is invalid or the session ended.</p>
          <Link href="/sessions" className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // This account took the committee on another device: nothing interactive renders here.
  if (deviceLock.kicked) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#EDE7D8' }}>
        <ChairDeviceKickModal
          onUseThisDevice={deviceLock.takeBack}
          onLeave={() => router.push(committee.sessionOrigin === 'conference' ? '/my-conferences' : '/join')}
        />
      </div>
    );
  }

  // ── Standalone chair gate: prove the chair code before anything is writable ──
  if (confAccess === 'standalone' && chairGate !== 'allowed') {
    const expectedSuffix = (committee.dbChairJoinSuffix ?? '').trim();
    const submitChairCode = () => {
      const entered = chairCodeInput.trim();
      // Accept the full printed chair code ("UNSC26-4821") as well as the bare suffix.
      const bare = entered.includes('-') ? (entered.split('-').pop() ?? '').trim() : entered;
      if (!expectedSuffix || bare !== expectedSuffix) {
        setChairCodeError('Incorrect chair code. Ask your Moderator.');
        return;
      }
      setChairCodeError('');
      setChairCodeUnlocked(true);
    };
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-3"><Emoji size="2.25rem">🪑</Emoji></div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1B3828' }}>Chairs only</h1>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: '#6A5A4A' }}>
            The voting screen records resolution results, changes the committee&apos;s rules and can end
            debate. Enter the chair code for{' '}
            <span className="font-semibold" style={{ color: '#1B3828' }}>{committee.code}</span> to open it.
          </p>
          {expectedSuffix ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitChairCode(); }}
              className="space-y-3"
            >
              <input
                autoFocus
                inputMode="numeric"
                maxLength={24}
                value={chairCodeInput}
                onChange={(e) => { setChairCodeInput(e.target.value); setChairCodeError(''); }}
                placeholder="0000"
                aria-label="Chair code"
                className="w-full text-center rounded-xl px-4 py-3 font-black tracking-[0.4em] focus:outline-none"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: `1.5px solid ${chairCodeError ? '#8B2020' : '#DDD4C0'}`,
                  color: '#1C1410',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
              {chairCodeError && (
                <p className="text-xs font-semibold" style={{ color: '#8B2020' }}>{chairCodeError}</p>
              )}
              <button
                type="submit"
                className="w-full font-semibold text-white px-6 py-3 rounded-xl transition-colors focus:outline-none gv-lift"
                style={{ backgroundColor: '#1B3828' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                Open voting
              </button>
            </form>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: '#6A5A4A' }}>
              This committee has no chair code. Open the voting screen from the chair session itself —
              Documents → Go to voting.
            </p>
          )}
          <Link
            href={`/join?code=${encodeURIComponent(committee.code)}&mode=chair`}
            className="inline-block mt-5 text-xs font-semibold underline"
            style={{ color: '#6A5A4A' }}
          >
            Re-join as chair
          </Link>
        </div>
      </div>
    );
  }

  // ── committee is guaranteed non-null and the viewer is a chair from here ────
  const settings: CommitteeSettings = { ...DEFAULT_SETTINGS, ...(settingsMap[committee.code] ?? {}) };

  const allDRs = (committee.documents ?? []).filter(
    (d) => d.type === 'draft-resolution' &&
      ['introduced', 'passed', 'failed'].includes(d.status)
  );
  const selectedDoc = allDRs.find((d) => d.id === activeDocId) ?? null;
  const suffix = committee.dbChairJoinSuffix ?? undefined;

  /** The placard as this screen currently believes it, optimistic write included,
   *  so the denominator moves the instant a chair hands one out. */
  const isObserverSeat = (d: Delegate): boolean => observerOverrides[d.id] ?? d.isObserver === true;
  const seatStatus = (d: Delegate): DelegateStatus => rollCallStatuses[d.id] ?? d.status;

  // The live room. Used directly whenever no ballot is open, and it is what a new
  // ballot is frozen from. `seatStatus` is the DB row except where this chair set a status on
  // this screen (the roll call every new ballot passes through), so it is always the room
  // as the roll call left it.
  const livePresent = committee.delegates
    .filter((d) => !isObserverSeat(d) && seatStatus(d) !== 'absent')
    .sort((a, b) => compareCountryNames(a.country, b.country, language));
  const livePresentAndPv = committee.delegates.filter((d) => !isObserverSeat(d) && seatStatus(d) !== 'absent');
  const liveVotable = committee.delegates.filter((d) => !isObserverSeat(d));

  // A frozen seat is resolved back to the live row BY ID, so a rename or a new crest
  // still flows through, with the snapshot as the fallback: the array length can never
  // change under `currentVoterIndex`.
  const liveSeatById = new Map(committee.delegates.map((d) => [d.id, d]));
  const liveSeat = (f: FrozenSeat): Delegate => liveSeatById.get(f.id) ?? { id: f.id, country: f.country, status: 'present' };
  const freeze = (list: Delegate[]): FrozenSeat[] => list.map((d) => ({ id: d.id, country: d.country }));
  // The vote on screen: the persisted state for the selected draft resolution.
  const vote: VoteStateV1 | null = selectedDoc ? voteStates[selectedDoc.id] ?? null : null;
  const votes: DelegateVote[] = vote?.votes ?? [];
  const phase: VotingPhase = vote?.status ?? 'voting';
  const currentVoterIndex = vote?.currentVoterIndex ?? 0;
  const passedIds = vote?.passedIds ?? [];
  const orderedRights = vote?.rightsOrder ?? [];

  const presentDelegates = vote ? vote.order.map(liveSeat) : livePresent;

  /** Tally and verdict for a given vote list (the one on screen, or a corrected one). */
  const tallyOf = (list: DelegateVote[]) => ({
    forCount: list.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length,
    againstCount: list.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length,
    abstainCount: list.filter((v) => v.choice === 'abstain').length,
  });
  const { forCount, againstCount, abstainCount } = tallyOf(votes);
  const withRightsAll = votes
    .filter((v) => v.choice === 'for-rights' || v.choice === 'against-rights')
    .sort((a, b) => compareCountryNames(a.country, b.country, language));
  const withRights = withRightsAll.slice(0, 10);

  // Unanimous mode looks at every present delegate (P and PV). Both of these are
  // frozen with the ballot: they are the unanimity/quorum numerator and the
  // quorum/veto denominator, and a vote in progress must not be judged against a
  // bar that moved under it.
  const presentAndPvDelegates = vote ? vote.order.map(liveSeat) : livePresentAndPv;
  const votableDelegates = vote ? vote.votable.map(liveSeat) : liveVotable;
  const tally = { forCount, againstCount, abstainCount };

  /** The veto seats in force under a given rule set. `custom` → the chair-picked
   *  list; `p5` → p5Delegations, falling back to the shipped P5 default. */
  const vetoListFor = (s: CommitteeSettings): string[] => {
    if (s.vetoMode === 'custom') return s.vetoCountries ?? [];
    if (s.vetoMode === 'p5') return s.p5Delegations?.length ? s.p5Delegations : DEFAULT_SETTINGS.p5Delegations;
    return [];
  };

  // ── Live outcome ───────────────────────────────────────────────────────────
  // One pure evaluation shared by the screen and the inline rules console, so
  // flipping a rule instantly moves the denominator, the required-to-pass number
  // and the verdict for the vote already in progress. `evaluate` is also called
  // with the *next* settings when a rule changes, and with a corrected vote list.
  const evaluate = (s: CommitteeSettings, list: DelegateVote[] = votes) => {
    const vetoList = vetoListFor(s);
    // Matched by resolved country identity, NOT raw string equality. A roster
    // imported as "Russian Federation" / "United States of America" / "USA" / "UK"
    // used to match nothing here, so the veto never fired and a vetoed resolution
    // was recorded as PASSED with no warning anywhere. Entries that resolve to no
    // country (crisis cabinets, corporations) still match by exact name.
    const vetoBlocked = (s.vetoMode === 'p5' || s.vetoMode === 'custom')
      && vetoList.length > 0
      && list.some((v) => (v.choice === 'against' || v.choice === 'against-rights')
        && isVetoDelegation(vetoList, v.country));
    // Unanimous: every present delegate must have voted 'for' or 'for-rights'
    const unanFail = s.vetoMode === 'unanimous' && presentAndPvDelegates.some((d) => {
      const cast = list.find((v) => v.delegateId === d.id);
      return !cast || (cast.choice !== 'for' && cast.choice !== 'for-rights');
    });
    return {
      vetoBlocked,
      unanFail,
      outcome: computeVoteOutcome({
        tally: tallyOf(list),
        rules: s,
        presentCount: presentAndPvDelegates.length,
        totalCount: votableDelegates.length,
        vetoBlocked,
        unanimousFail: unanFail,
      }),
    };
  };

  const { vetoBlocked: p5Veto, unanFail: unanimousFail, outcome } = evaluate(settings);
  const totalDecisive = outcome.denominator;
  const passed = outcome.passed;

  const persistResult = (docId: string, result: 'passed' | 'failed' | 'introduced') => {
    if (isViewOnly) return;
    // A verdict given after Back supersedes the `introduced` still waiting on Back's save.
    if (result !== 'introduced') delete backStatusSeqRef.current[docId];
    // Recorded so every refetch re-applies it: a fetch already in flight still
    // carries the pre-vote status and would otherwise revert the verdict on screen.
    docResultPatchRef.current[docId] = result;
    setResultSaveError((prev) => (prev?.docId === docId ? null : prev));
    // Checked (V2): a refused status write used to leave the paper looking un-voted after a
    // reload, and the list then offered "start a vote" over the stored result. The patch
    // stays applied on screen; the banner offers Retry with the same verdict.
    void updateDocumentStatusInDB(docId, result, committee.code, suffix).then((ok) => {
      if (ok) return;
      if (docResultPatchRef.current[docId] !== result) return;   // a newer verdict superseded it
      setResultSaveError({ docId, result });
    });
    // Update local committee state so the DR list reflects the result immediately
    setCommittee((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, status: result } : d
        ),
      };
    });
  };

  // ── Vote writes ────────────────────────────────────────────────────────────
  // Optimistic first (the ref and the state), then a serialised, checked write. Only the
  // driving device ever calls this; a Commenter's controls are not rendered.
  /** Back's `introduced` status write, once the vote state it belongs to has landed. */
  const flushBackStatus = (docId: string) => {
    const want = backStatusSeqRef.current[docId];
    if (want == null || (savedSeqRef.current[docId] ?? 0) < want) return;
    delete backStatusSeqRef.current[docId];
    persistResult(docId, 'introduced');
  };

  const saveLatest = (docId: string) => {
    saveChainRef.current = saveChainRef.current.then(async () => {
      const latest = voteStatesRef.current[docId];
      if (!latest) return;
      // Every queued save sends the LATEST state, so once it has landed the saves queued
      // behind it have nothing new to send.
      if ((savedSeqRef.current[docId] ?? 0) >= latest.seq) { flushBackStatus(docId); return; }
      const r = await saveVoteState(docId, latest, committee.code, suffix);
      if (r === 'ok') {
        savedSeqRef.current[docId] = Math.max(savedSeqRef.current[docId] ?? 0, latest.seq);
        flushBackStatus(docId);
        setVoteSaveError((prev) => (prev?.docId === docId ? null : prev));
        return;
      }
      if (r === 'stale') {
        // The stored seq is at or above ours: another write landed first (a lost response
        // that did land, an earlier Moderator device). Re-read and look before deciding.
        const loaded = await loadVoteStates(committee.id);
        const stored = loaded?.[docId] ?? null;
        const local = voteStatesRef.current[docId];
        if (stored && local && stored.startedAt === local.startedAt && !isViewOnlyRef.current) {
          // Same ballot: this device's taps are the newer intent. Re-apply the local state
          // under a seq above the stored one instead of dropping the ballot.
          const seq = Math.max(stored.seq, local.seq, pendingSeqRef.current[docId] ?? 0) + 1;
          const next: VoteStateV1 = { ...local, seq, updatedAt: serverNowIso() };
          pendingSeqRef.current[docId] = seq;
          voteStatesRef.current = { ...voteStatesRef.current, [docId]: next };
          setVoteStates(voteStatesRef.current);
          const again = await saveVoteState(docId, next, committee.code, suffix);
          if (again === 'ok') {
            savedSeqRef.current[docId] = Math.max(savedSeqRef.current[docId] ?? 0, seq);
            // Same ballot re-applied: it carries the Back, so the waiting status write goes out.
            flushBackStatus(docId);
            setVoteSaveError((prev) => (prev?.docId === docId ? null : prev));
            return;
          }
          setVoteSaveError({ docId, kind: again === 'stale' ? 'stale' : again === 'denied' ? 'denied' : 'error' });
          if (again !== 'stale') return;
        } else {
          setVoteSaveError({ docId, kind: 'stale' });
        }
        // A different ballot (or a second refusal): the DB wins. A Back waiting on this save
        // is dropped with it: the document keeps the status the stored state implies.
        delete pendingSeqRef.current[docId];
        delete backStatusSeqRef.current[docId];
        if (loaded) {
          voteStatesRef.current = { ...voteStatesRef.current, ...loaded };
          setVoteStates(voteStatesRef.current);
        }
        return;
      }
      // Nothing is thrown away: the local state stays on screen and Retry re-sends it.
      setVoteSaveError({ docId, kind: r === 'denied' ? 'denied' : 'error' });
    });
  };

  const commitVote = (docId: string, build: (prev: VoteStateV1 | null) => Omit<VoteStateV1, 'seq' | 'updatedAt' | 'driver' | 'v'>) => {
    if (isViewOnly) return;
    const prev = voteStatesRef.current[docId] ?? null;
    const seq = Math.max(prev?.seq ?? 0, pendingSeqRef.current[docId] ?? 0) + 1;
    const next: VoteStateV1 = { ...build(prev), v: 1, seq, updatedAt: serverNowIso(), driver: urlChairName || null };
    pendingSeqRef.current[docId] = seq;
    voteStatesRef.current = { ...voteStatesRef.current, [docId]: next };
    setVoteStates(voteStatesRef.current);
    saveLatest(docId);
  };

  /** Patch the vote on screen. */
  const updateVote = (patch: (prev: VoteStateV1) => Partial<VoteStateV1>) => {
    if (!selectedDoc) return;
    const docId = selectedDoc.id;
    if (!voteStatesRef.current[docId]) return;
    commitVote(docId, (prev) => {
      if (!prev) throw new Error('no vote to update');
      const { seq: _s, updatedAt: _u, driver: _d, v: _v, ...rest } = { ...prev, ...patch(prev) };
      void _s; void _u; void _d; void _v;
      return rest;
    });
  };

  const retryVoteSave = () => {
    const err = voteSaveError;
    if (!err) return;
    setVoteSaveError(null);
    const current = voteStatesRef.current[err.docId];
    if (!current || err.kind === 'stale') return;
    // Re-send under a fresh seq so the write is accepted even if an earlier one landed.
    commitVote(err.docId, () => {
      const { seq: _s, updatedAt: _u, driver: _d, v: _v, ...rest } = current;
      void _s; void _u; void _d; void _v;
      return rest;
    });
  };

  // ── Live rule changes from the inline console ──────────────────────────────
  // Store (instant, this device) + a key-level patch of committees.settings (D-1), so
  // every chair device computes the identical verdict and no other setting is touched.
  const applyRules = (patch: Partial<CommitteeSettings>) => {
    if (isViewOnly) return;   // V-7: UI gate, consistent with SettingsPanel's `upd`
    const keys = Object.keys(patch) as (keyof CommitteeSettings)[];
    if (keys.length === 0) return;
    for (const key of keys) updateSetting(committee.code, key, patch[key] as CommitteeSettings[typeof key]);
    const next: CommitteeSettings = { ...settings, ...patch };
    // ONLY the changed keys, in ONE patch, so two keys that belong together (a veto
    // mode and its list) land together and the verdict below sees both.
    // chairJoinSuffix, headChair, headChairDevice and agendaTopicIndex can never ride
    // along (rules 12 and 13).
    saveCommitteeSettings(committee.id, patch, committee.code, suffix);
    // Result already on screen: the verdict can flip, so the DR's stored status
    // has to follow it rather than keeping the value from the first evaluation.
    if (phase === 'result' && selectedDoc) {
      const nextPassed = evaluate(next).outcome.passed;
      if (nextPassed !== passed) {
        persistResult(selectedDoc.id, nextPassed ? 'passed' : 'failed');
        updateVote(() => ({ result: nextPassed ? 'passed' : 'failed' }));
      }
    }
  };
  const applyRule = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) =>
    applyRules({ [key]: value } as Partial<CommitteeSettings>);

  /** Veto seats a chair can pick: every non-observer delegation on the roster. */
  const vetoRoster = committee.delegates.filter((d) => !isObserverSeat(d));

  /** Switching the veto mode. Choosing Custom seeds the list only when this committee
   *  has never stored one: from P5, the P5 seats that sit here (roster spelling);
   *  otherwise empty. A list the chairs already chose is kept as it is. */
  const changeVetoMode = (mode: CommitteeSettings['vetoMode']) => {
    if (mode === settings.vetoMode) return;
    const stored = (committee.dbSettings ?? {}) as Record<string, unknown>;
    const hasStoredList = Array.isArray(stored.vetoCountries);
    if (mode === 'custom' && !hasStoredList) {
      const seeded = settings.vetoMode === 'p5'
        ? vetoRoster.filter((d) => isVetoDelegation(vetoListFor(settings), d.country)).map((d) => d.country)
        : [];
      applyRules({ vetoMode: 'custom', vetoCountries: seeded });
      return;
    }
    applyRules({ vetoMode: mode });
  };

  const rulesProps = {
    rules: settings,
    onChange: applyRule,
    vetoMode: settings.vetoMode,
    onVetoModeChange: changeVetoMode,
    vetoRoster,
    onVetoCountriesChange: (next: string[]) => applyRules({ vetoCountries: next }),
    // "Hide tally" hides the running count in the header console too, until the result.
    hideTally: hideVotes && phase !== 'result',
    tally,
    outcome,
    votesCast: votes.length,
    eligible: presentDelegates.length,
    presentCount: presentAndPvDelegates.length,
    totalCount: votableDelegates.length,
    resultShown: phase === 'result',
    vetoBlocked: p5Veto,
    unanimousFail,
    // So the console can warn about veto seats that match NO delegation in the room
    // — a silent no-match is exactly how a missing veto used to hide.
    vetoEntries: vetoListFor(settings),
    delegationNames: votableDelegates.map((d) => d.country),
    readOnly: isViewOnly,
  };

  const startNewVote = (docId: string) => {
    if (isViewOnly) return;
    setSelectedDocId(docId);
    // Freeze the room as it stands right now. "Vote again" comes through here too,
    // so a re-vote is judged against the room as it is at that moment.
    commitVote(docId, () => ({
      status: 'voting',
      order: freeze(livePresent),
      votable: freeze(liveVotable),
      votes: [],
      currentVoterIndex: 0,
      passedIds: [],
      rightsOrder: [],
      rightsIndex: 0,
      rightsTimerLimit: voteStatesRef.current[docId]?.rightsTimerLimit ?? 60,
      result: null,
      startedAt: serverNowIso(),   // database clock (T-1): compared across chair devices
    }));
  };

  /** Re-open an unfinished vote after a reload, exactly where it stopped. */
  const resumeVote = (docId: string) => {
    setSelectedDocId(docId);
    setRollCallOpen(false);
  };

  // ── Casting, passing and moving back ───────────────────────────────────────
  // Invariants the pass round depends on (it is derived: the delegation voting in the pass
  // round is `passedIds[number of passedIds that have a vote]`):
  //   • in the MAIN round a delegation has either a vote or a Pass, never both. A vote cast
  //     after Back drops its Pass; a Pass after Back drops its vote.
  //   • `passedIds` stays in ballot order, so a Pass recorded after Back still comes back in
  //     the pass round at its own place.
  //   • the pass-round votes are always a prefix of `passedIds`, so Back in the pass round
  //     removes the last of them and that delegation is asked again.
  // Every step is one `updateVote`, so `seq` grows and `vote_state` stays authoritative.
  const inBallotOrder = (prev: VoteStateV1, ids: string[]) => {
    const pos = new Map(prev.order.map((s, i) => [s.id, i]));
    return [...ids].sort((a, b) => (pos.get(a) ?? Infinity) - (pos.get(b) ?? Infinity));
  };

  const castVoteAndAdvance = (delegateId: string, country: string, choice: VoteChoice) => {
    updateVote((prev) => {
      const mainRound = prev.currentVoterIndex < prev.order.length;
      const existing = prev.votes.find((v) => v.delegateId === delegateId);
      const nextVotes = existing
        ? prev.votes.map((v) => (v.delegateId === delegateId ? { ...v, choice } : v))
        : [...prev.votes, { delegateId, country, choice }];
      return {
        votes: nextVotes,
        passedIds: mainRound ? prev.passedIds.filter((id) => id !== delegateId) : prev.passedIds,
        currentVoterIndex: prev.currentVoterIndex + 1,
      };
    });
  };

  const handlePass = (delegateId: string) => {
    updateVote((prev) => ({
      passedIds: prev.passedIds.includes(delegateId) ? prev.passedIds : inBallotOrder(prev, [...prev.passedIds, delegateId]),
      votes: prev.votes.filter((v) => v.delegateId !== delegateId),
      currentVoterIndex: prev.currentVoterIndex + 1,
    }));
  };

  /** After Back: leave this delegation's recorded vote (or Pass) as it is and move on. */
  const keepAndAdvance = () => {
    updateVote((prev) => ({ currentVoterIndex: prev.currentVoterIndex + 1 }));
  };

  /**
   * Back: one step towards the start of the vote, as many times as needed.
   *   result or rights speakers (at the first speaker) → the ballot, all votes kept, verdict
   *     cleared (and the paper's status put back to introduced until the vote is finished again)
   *   rights speakers → the previous rights speaker
   *   pass round → the last delegation that voted in it is asked again
   *   main round → the previous delegation, whose recorded choice is shown and can be kept
   */
  const stepBack = () => {
    if (isViewOnly || !vote || !selectedDoc) return;
    const docId = selectedDoc.id;
    const fromResult = vote.status === 'result' && (() => {
      const docStatus = committee.documents.find((d) => d.id === docId)?.status;
      return docStatus === 'passed' || docStatus === 'failed' || !!vote.result;
    })();
    updateVote((prev) => {
      if (prev.status === 'rights-speakers' && prev.rightsIndex > 0) return { rightsIndex: prev.rightsIndex - 1 };
      if (prev.status !== 'voting') return { status: 'voting', result: null, rightsOrder: [], rightsIndex: 0 };
      const n = prev.order.length;
      const idx = Math.min(prev.currentVoterIndex, n);
      if (idx >= n) {
        const votedInPassRound = prev.passedIds.filter((id) => prev.votes.some((v) => v.delegateId === id));
        const last = votedInPassRound[votedInPassRound.length - 1];
        if (last) return { votes: prev.votes.filter((v) => v.delegateId !== last), currentVoterIndex: n };
      }
      if (idx > 0) return { currentVoterIndex: idx - 1 };
      return {};
    });
    // Put the paper back to `introduced` only once this Back's vote state has landed
    // (flushBackStatus). commitVote stamped its seq synchronously; the save runs later.
    if (fromResult && pendingSeqRef.current[docId] != null) backStatusSeqRef.current[docId] = pendingSeqRef.current[docId];
  };

  const finishWithResult = () => {
    if (isViewOnly || !selectedDoc) return;
    persistResult(selectedDoc.id, passed ? 'passed' : 'failed');
    updateVote(() => ({ status: 'result', result: passed ? 'passed' : 'failed' }));
  };

  const handleFinishVoting = () => {
    if (withRights.length > 0) {
      updateVote(() => ({ status: 'rights-speakers', rightsOrder: [...withRights], rightsIndex: 0 }));
    } else {
      finishWithResult();
    }
  };

  const handleNextRightsSpeaker = () => {
    if (rightsIndex + 1 >= orderedRights.length) {
      finishWithResult();
    } else {
      updateVote((prev) => ({ rightsIndex: prev.rightsIndex + 1 }));
    }
  };

  // Carries ?chairName= on: a chair's identity is ONLY that param. Read from
  // window.location: this page has no Suspense boundary, so useSearchParams() would
  // fail the prerender, and this only ever runs in a click handler.
  const chairPageHref = () => {
    const chairName = new URLSearchParams(window.location.search).get('chairName') ?? '';
    return `/chair/${committee.code}${chairName ? `?chairName=${encodeURIComponent(chairName)}` : ''}`;
  };

  // ── V-4: back to exactly the phase the room was in ────────────────────────
  // `set_committee_voting_phase(false)` restores the remembered phase (a caucus whose
  // caucus data is gone falls back to the GSL) and is a no-op when the room is not in
  // voting mode, so it never forces the GSL over a caucus or a suspension. A Commenter
  // only navigates. A refused write keeps the chair here and says so.
  const handleBackToSession = async () => {
    if (isViewOnly || committee.endedAt) { router.push(chairPageHref()); return; }
    setBackBusy(true);
    const r = await setVotingPhase(committee.id, false, committee.code, suffix);
    setBackBusy(false);
    if (!r.ok) { setPhaseNotice('leave_failed'); return; }
    router.push(chairPageHref());
  };

  // ── V-1: End debate is the real End, checked ──────────────────────────────
  // Same write as the chair page (`endDebate`: ended_at, expires_at, phase). The row is
  // read back afterwards because a refused update resolves with no error: only a stored
  // `ended_at` counts as ended. On success the chair lands on the chair page's End View.
  const handleEndDebate = async () => {
    if (isViewOnly) return;
    setEndDebateState('working');
    await endDebateInDB(committee.id, committee.code, suffix);
    const { data } = await supabase.from('committees').select('ended_at').eq('id', committee.id).maybeSingle();
    if (!data?.ended_at) { setEndDebateState('failed'); return; }
    setEndDebateState('idle');
    setShowEndDebateConfirm(false);
    router.push(chairPageHref());
  };

  // VotingHeader lives at module scope so it never remounts; the rules popover it
  // hosts therefore keeps its open state while votes are being cast.
  const drPlural = docName(committee, 'draft-resolution', 'plural', t('documents_draft_resolutions_tab'));
  const drSingular = docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution_type'));
  const headerProps = {
    identity,
    onBack: () => { void handleBackToSession(); },
    backBusy,
    onEndDebate: () => { setEndDebateState('idle'); setShowEndDebateConfirm(true); },
    onOpenSettings: () => setShowSettings(true),
    rules: <VotingRulesPopover {...rulesProps} trigger="icon" />,
    tally: { hidden: hideVotes, onToggle: () => setHideVotes(!hideVotes) },
    isViewOnly,
    headName: gavelRole.head,
  };

  // ── Pre-vote screen: roll call + rules (blocks until confirmed) ──────────
  /** Set one seat's roll-call status directly (the pre-vote screen's segmented control). */
  const setRollCallStatus = (id: string, next: DelegateStatus) => {
    if (isViewOnly) return;
    touchedStatusRef.current.add(id);
    setRollCallStatuses((prev) => ({ ...prev, [id]: next }));
    setDelegateStatusInDB(id, next, committee.code, suffix);
  };

  /** Hand out or take back an observer placard. Optimistic first, write
   *  fire-and-forget (AGENTS.md rule 5); the ref is the receipt the reconcile
   *  effect above checks the DB against. */
  const toggleObserverSeat = (d: Delegate) => {
    if (isViewOnly) return;
    const next = !isObserverSeat(d);
    observerWriteRef.current[d.id] = { value: next, at: nowMs() };
    setObserverOverrides((prev) => ({ ...prev, [d.id]: next }));
    setObserverWriteFailed(false);
    // Arms the TTL backstop even when no refetch ever arrives.
    setObserverReconcileTick((n) => n + 1);
    setDelegateObserverInDB(d.id, next, committee.code, suffix);
    // An observer holds no voting placard, so present-voting drops to present.
    if (next && seatStatus(d) === 'present-voting') {
      touchedStatusRef.current.add(d.id);
      setRollCallStatuses((prev) => ({ ...prev, [d.id]: 'present' }));
      setDelegateStatusInDB(d.id, 'present', committee.code, suffix);
    }
  };

  const newSeats = newSeatIds
    .map((id) => committee.delegates.find((d) => d.id === id))
    .filter((d): d is Delegate => !!d);

  /** All present / All P+V for every voting seat. One RPC (`set_delegate_statuses`, the
   *  chair page's bulk path), per-row only when the RPC is missing; a refused bulk write
   *  gives the rows back to the DB values. */
  const setAllRollCallStatuses = (status: 'present' | 'present-voting') => {
    if (isViewOnly) return;
    const seats = committee.delegates.filter((d) => !isObserverSeat(d));
    if (seats.length === 0) return;
    seats.forEach((d) => touchedStatusRef.current.add(d.id));
    setRollCallStatuses((prev) => {
      const next = { ...prev };
      seats.forEach((d) => { next[d.id] = status; });
      return next;
    });
    const ids = seats.map((d) => d.id);
    void setDelegateStatusesBulk(committee.id, status, ids, committee.code, suffix).then((r) => {
      if (r === 'unavailable') { ids.forEach((id) => setDelegateStatusInDB(id, status, committee.code, suffix)); return; }
      if (r !== null) return;
      seats.forEach((d) => touchedStatusRef.current.delete(d.id));
      setRollCallStatuses((prev) => {
        const next = { ...prev };
        seats.forEach((d) => { next[d.id] = d.status; });
        return next;
      });
    });
  };

  // The roll call and the failure banner are shared by the document-selection screen and
  // the ballot screens, so a chair can seat a late arrival or see a refused write without
  // abandoning a vote in progress. Commenters never get it: it writes delegate statuses.
  // It opens for a chosen document (`pendingDocId`: confirming starts that ballot) or on its
  // own (`rollCallOpen`: confirming just closes it).
  const pendingDoc = pendingDocId ? allDRs.find((d) => d.id === pendingDocId) ?? null : null;
  const showRollCall = !isViewOnly && (rollCallOpen || !!pendingDoc);
  const closeRollCall = () => { setRollCallOpen(false); setPendingDocId(null); };
  const rollCallModal = showRollCall ? (
    <PreVoteScreen
      delegates={committee.delegates}
      rollCallStatuses={rollCallStatuses}
      isObserverSeat={isObserverSeat}
      onToggleObserver={toggleObserverSeat}
      onSetStatus={setRollCallStatus}
      onBulkStatus={setAllRollCallStatuses}
      onClose={closeRollCall}
      doc={pendingDoc ? { code: pendingDoc.docCode, title: pendingDoc.title } : null}
      onConfirm={() => {
        const docId = pendingDoc?.id ?? null;
        closeRollCall();
        setNewSeatIds([]);
        if (docId) startNewVote(docId);
      }}
      settings={settings}
      onRulesChange={applyRules}
      onVetoModeChange={changeVetoMode}
      vetoEntries={vetoListFor(settings)}
      readOnly={isViewOnly}
    />
  ) : null;

  const observerFailBanner = observerWriteFailed
    ? <ObserverWriteFailedBanner onDismiss={() => setObserverWriteFailed(false)} />
    : null;

  const rosterNotice = newSeats.length > 0 && !isViewOnly ? (
    <RosterNotice
      names={newSeats.map((d) => getCountryDisplayName(d.country, language))}
      notInVote={!!vote && isVoteOpen(vote)}
      onOpenRollCall={() => { setRollCallOpen(true); setNewSeatIds([]); }}
      onDismiss={() => setNewSeatIds([])}
    />
  ) : null;

  // Banners every screen shares: the voting-mode state of the room, a refused ballot
  // write, and another chair's settings change.
  const statusBanners = (
    <>
      {settingsSync.notice}
      {phaseNotice && !isViewOnly && (
        <VotingBanner
          tone={phaseNotice === 'closed' ? 'amber' : 'red'}
          text={t(
            phaseNotice === 'closed' ? 'voting_phase_closed'
              : phaseNotice === 'leave_failed' ? 'voting_phase_leave_failed'
              : 'voting_phase_enter_failed',
          )}
          onDismiss={() => setPhaseNotice(null)}
        />
      )}
      {resultSaveError && !isViewOnly && (
        <VotingBanner
          tone="red"
          text={t('voting_save_failed')}
          actionLabel={t('voting_save_retry')}
          onAction={() => { const e = resultSaveError; setResultSaveError(null); persistResult(e.docId, e.result); }}
          onDismiss={() => setResultSaveError(null)}
        />
      )}
      {voteSaveError && !isViewOnly && (
        <VotingBanner
          tone={voteSaveError.kind === 'stale' ? 'amber' : 'red'}
          text={t(voteSaveError.kind === 'stale' ? 'voting_save_stale' : 'voting_save_failed')}
          actionLabel={voteSaveError.kind === 'stale' ? undefined : t('voting_save_retry')}
          onAction={retryVoteSave}
          onDismiss={() => setVoteSaveError(null)}
        />
      )}
      {isViewOnly && (
        <VotingBanner tone="neutral" text={t('voting_view_only_note', { name: gavelRole.head ?? '' })} />
      )}
    </>
  );

  // ── V-1: End Debate confirmation ─────────────────────────────────────────
  // Rendered on EVERY screen (it used to exist only on the ballot screen, so the header's
  // End Debate button did nothing on the document list). Stays open while the write runs
  // and when it fails, so a refused end is never mistaken for an ended room.
  const endDebateModal = showEndDebateConfirm && !isViewOnly ? (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(20,24,18,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={() => { if (endDebateState !== 'working') setShowEndDebateConfirm(false); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gv-end-debate-title"
        className="rounded-[28px] w-full max-w-md mx-4 flex flex-col overflow-hidden"
        style={{ backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 24px 64px rgba(20,24,18,0.35)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape' && endDebateState !== 'working') setShowEndDebateConfirm(false); }}
      >
        <div className="px-7 pt-7 pb-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(139,32,32,0.10)', color: '#8B2020' }} aria-hidden>
            <Flag size={22} strokeWidth={2.25} />
          </div>
          <h2 id="gv-end-debate-title" className="text-[22px] font-bold leading-tight text-[#1C1410]">{t('voting_end_debate_title')}</h2>
          <p className="text-[15px] text-[#6A5A4A] leading-relaxed mt-2 [text-wrap:pretty]">
            {t('voting_end_debate_body')}
          </p>
          {endDebateState === 'failed' && (
            <p role="alert" className="text-sm font-semibold leading-snug mt-3" style={{ color: '#8B2020' }}>
              {t('voting_end_debate_failed')}
            </p>
          )}
        </div>
        <div className="px-7 pt-5 pb-7 flex gap-3">
          <button
            autoFocus
            onClick={() => setShowEndDebateConfirm(false)}
            disabled={endDebateState === 'working'}
            className="flex-1 h-12 rounded-2xl font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
            style={{ backgroundColor: '#EDE7D8', color: '#1C1410' }}
          >
            {t('voting_cancel')}
          </button>
          <button
            onClick={() => { void handleEndDebate(); }}
            disabled={endDebateState === 'working'}
            className="flex-1 h-12 rounded-2xl font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96] disabled:opacity-60"
            style={{ backgroundColor: '#8B2020', color: 'white', boxShadow: '0 2px 4px rgba(90,20,20,0.2), 0 8px 20px rgba(90,20,20,0.22)' }}
          >
            {endDebateState === 'working' ? t('voting_end_debate_working') : endDebateState === 'failed' ? t('voting_save_retry') : t('voting_confirm_end')}
          </button>
        </div>
      </div>
    </div></Portal>
  ) : null;

  // ── Doc selection screen ──────────────────────────────────────────────────
  if (!selectedDoc || !vote) {
    // The page's decision per card. Moderator: start a vote (through the roll call), resume
    // an unfinished one exactly where it stopped, or reopen a finished one with its stored
    // ballots (Back from the result corrects a placard). Commenter: only a vote that exists.
    const cardState = (doc: CommitteeDocument): PickCardState => {
      const stored = voteStates[doc.id] ?? null;
      // V2: a stored result counts as voted even when the documents.status write was lost,
      // so a reload can never offer "start a vote" over a recorded result.
      const isVoted = doc.status === 'passed' || doc.status === 'failed' || stored?.status === 'result';
      const canOpen = isViewOnly ? !!stored : true;
      if (stored && isVoteOpen(stored)) return { kind: 'live', vote: stored, canOpen };
      if (isVoted) {
        const result = stored?.result ?? (doc.status === 'failed' ? 'failed' : 'passed');
        return { kind: 'voted', result, vote: stored, canOpen: !!stored };
      }
      return { kind: 'ready', canOpen };
    };
    const openCard = (doc: CommitteeDocument) => {
      const st = cardState(doc);
      if (!st.canOpen) return;
      const stored = voteStates[doc.id] ?? null;
      if (isViewOnly) { setFollowLive(false); setSelectedDocId(doc.id); return; }
      if (st.kind === 'live') { resumeVote(doc.id); return; }
      if (st.kind === 'voted' && stored) {
        resumeVote(doc.id);
        // The stored verdict is the truth; re-record a status write that was lost.
        if (stored.result && doc.status !== stored.result) persistResult(doc.id, stored.result);
        return;
      }
      // Not voted yet (or a result recorded before votes were stored): the roll call first.
      setPendingDocId(doc.id);
    };
    return (
      <SeatArtProvider delegates={committee.delegates}>
      <div className="h-[100dvh] bg-[#EDE7D8] flex flex-col overflow-hidden">
        <VotingHeader {...headerProps} docsLabel={drPlural} />
        {rollCallModal}
        {observerFailBanner}
        {endDebateModal}
        {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} isViewOnly={isViewOnly} myChairName={urlChairName} />}
        <ResolutionPicker
          docs={[...allDRs].sort((a, b) => a.docCode.localeCompare(b.docCode, undefined, { numeric: true }))}
          stateOf={cardState}
          onOpen={openCard}
          isViewOnly={isViewOnly}
          hideTally={hideVotes}
          docSingular={drSingular}
          docPlural={drPlural}
          sponsorWord={sponsorLabel(committee, t('voting_sponsors'))}
          onOpenRollCall={isViewOnly ? undefined : () => setRollCallOpen(true)}
          onFollowLive={isViewOnly && !followLive && anyOpenVote ? () => { setFollowLive(true); setSelectedDocId(null); } : undefined}
          onBackToSession={() => { void handleBackToSession(); }}
        >
          {rosterNotice}
          {statusBanners}
        </ResolutionPicker>
      </div>
      </SeatArtProvider>
    );
  }

  // Pass-round: derived, no extra state needed
  const mainRoundComplete = currentVoterIndex >= presentDelegates.length;
  const passVoterIndex = passedIds.filter(id => votes.some(v => v.delegateId === id)).length;
  const inPassRound = mainRoundComplete && passVoterIndex < passedIds.length;

  const currentDelegate = (() => {
    if (!mainRoundComplete) return presentDelegates[currentVoterIndex];
    if (inPassRound) {
      const nextId = passedIds[passVoterIndex];
      return committee.delegates.find(d => d.id === nextId) ?? null;
    }
    return null;
  })();

  // The line the carousel draws: the ballot order in the main round, the delegations that
  // passed in the pass round. Resolved to live rows by id (a new crest still flows through).
  const passRoundSeats: Delegate[] = passedIds.map((id) => liveSeatById.get(id) ?? { id, country: vote.order.find((s) => s.id === id)?.country ?? '', status: 'present' as DelegateStatus });
  const carouselSeats = inPassRound ? passRoundSeats : presentDelegates;
  const carouselIndex = inPassRound ? passVoterIndex : Math.min(currentVoterIndex, Math.max(0, presentDelegates.length - 1));
  const markOf = (id: string): CarouselMark => {
    const cast = votes.find((v) => v.delegateId === id);
    if (cast) return cast.choice;
    return !inPassRound && passedIds.includes(id) ? 'pass' : null;
  };
  // After Back, the delegation on screen may already have a choice on record (main round).
  const recordedMark: CarouselMark = currentDelegate && !mainRoundComplete ? markOf(currentDelegate.id) : null;
  const choiceLabel = (m: Exclude<CarouselMark, null>) => t(
    m === 'for' ? 'voting_choice_for'
      : m === 'for-rights' ? 'voting_choice_for_rights'
      : m === 'abstain' ? 'voting_choice_abstain'
      : m === 'against-rights' ? 'voting_choice_against_rights'
      : m === 'against' ? 'voting_choice_against'
      : 'voting_choice_pass',
  );
  const canStepBack = !isViewOnly && (phase !== 'voting' || currentVoterIndex > 0 || passVoterIndex > 0);

  const stage = phase === 'result' ? t('voting_stage_result')
    : phase === 'rights-speakers' ? t('voting_stage_rights')
    : inPassRound ? t('voting_stage_pass')
    : !currentDelegate ? t('voting_stage_tallied')
    : t('voting_stage_voting');

  const summaryLine = settings.substantiveThreshold === 'consensus'
    ? t('voting_summary_counted_consensus', { counted: totalDecisive })
    : t('voting_summary_counted', { counted: totalDecisive, needed: outcome.needed });

  /** The quiet Back control, shared by every stage of the vote. */
  const backButton = (label: string) => (
    <button
      type="button"
      onClick={stepBack}
      disabled={!canStepBack}
      title={t('voting_step_back_title')}
      className="inline-flex items-center gap-2 h-11 ps-4 pe-5 rounded-full text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,transform,opacity] duration-150 active:scale-[0.96] motion-reduce:transition-none disabled:opacity-35 disabled:cursor-not-allowed enabled:hover:bg-[rgba(27,56,40,0.13)]"
      style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1B3828' }}
    >
      <Undo2 size={18} strokeWidth={2.5} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
      {label}
    </button>
  );

  const bigCount = (value: number, label: string, color: string) => (
    <div className="text-center min-w-[88px]">
      <div className="text-[36px] font-bold leading-none tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[13px] font-medium mt-2" style={{ color: '#6A5A4A' }}>{label}</div>
    </div>
  );

  return (
    <FitToScreen>
    <SeatArtProvider delegates={committee.delegates}>
    <div className="gv-ballot-screen h-full w-full bg-[#F6F1E9] flex flex-col overflow-hidden">
      <style>{`
        @keyframes gvNameIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .gv-ballot-screen .gv-name-in { animation: gvNameIn 360ms cubic-bezier(0.2,0,0,1) backwards }
        .gv-ballot-screen .gv-ballot { background-color: var(--gv-b-bg); transition: background-color 150ms, transform 150ms cubic-bezier(0.2,0,0,1), box-shadow 200ms }
        .gv-ballot-screen .gv-ballot:not(:disabled):hover { background-color: var(--gv-b-hover); transform: translateY(-2px) }
        .gv-ballot-screen .gv-ballot:not(:disabled):active { transform: scale(0.96) }
        @media (prefers-reduced-motion: reduce) {
          .gv-ballot-screen .gv-name-in { animation: none }
          .gv-ballot-screen .gv-ballot { transition: none }
          .gv-ballot-screen .gv-ballot:not(:disabled):hover, .gv-ballot-screen .gv-ballot:not(:disabled):active { transform: none }
        }
      `}</style>
      <VotingHeader
        {...headerProps}
        docsLabel={drPlural}
        onDocs={() => { setSelectedDocId(null); if (isViewOnly) setFollowLive(false); }}
        doc={{ code: selectedDoc.docCode, title: selectedDoc.title }}
        progress={{ stage, cast: votes.length, total: presentDelegates.length }}
      />
      {rollCallModal}
      {observerFailBanner}
      {rosterNotice}
      {statusBanners}

      {/* ── Active voting: one delegation at a time ── */}
      {phase === 'voting' && currentDelegate && (
        <div className="flex-1 min-h-0 flex flex-col items-center px-8 pt-4 pb-8">
          <div className="h-9 shrink-0 flex items-center">
            {inPassRound ? (
              <span className="inline-flex items-center gap-2 h-9 ps-3 pe-4 rounded-full text-[13.5px] font-semibold" style={{ backgroundColor: 'rgba(182,135,31,0.16)', color: '#6A4A0A' }}>
                <SkipForward size={15} strokeWidth={2.5} aria-hidden />
                {t('voting_pass_round')}
                <span className="font-medium tabular-nums">· {t('voting_pass_round_sub', { current: passVoterIndex + 1, total: passedIds.length })}</span>
              </span>
            ) : (
              <span className="text-[14px] font-medium tabular-nums" style={{ color: '#6A5A4A' }}>
                {currentVoterIndex + 1} / {presentDelegates.length}
              </span>
            )}
          </div>

          {/* The line of delegations, voting now in the centre */}
          <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center">
            <VoterCarousel seats={carouselSeats} current={carouselIndex} markOf={markOf} hideTally={hideVotes} />
            <h1
              key={currentDelegate.id}
              className="gv-name-in text-[36px] font-bold text-[#1C1410] text-center leading-[1.1] tracking-[-0.015em] mt-3 max-w-4xl [text-wrap:balance]"
              aria-live="polite"
            >
              {getCountryDisplayName(currentDelegate.country, language)}
            </h1>
            <div className="h-8 mt-2 flex items-center">
              {recordedMark && (
                <span className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-[13.5px] font-medium" style={{ backgroundColor: 'rgba(182,135,31,0.16)', color: '#6A4A0A' }}>
                  {hideVotes && recordedMark !== 'pass' ? t('voting_recorded_hidden') : t('voting_recorded_choice', { choice: choiceLabel(recordedMark) })}
                </span>
              )}
            </div>
          </div>

          {isViewOnly ? (
            <p className="shrink-0 w-full max-w-3xl my-6 text-center text-[15px] font-medium text-[#6A5A4A]">
              {t('voting_follower_waiting', { name: gavelRole.head ?? '' })}
            </p>
          ) : (
            <div className="shrink-0 w-full max-w-[1080px] flex flex-col gap-3 mt-3">
              <div className="flex gap-3">
                <BallotButton
                  tone="for" wide icon={<Check size={22} strokeWidth={3} />} label={t('voting_in_favour')}
                  recorded={!hideVotes && recordedMark === 'for'}
                  onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for')}
                />
                <BallotButton
                  tone="for" icon={<Check size={20} strokeWidth={3} />} label={t('voting_in_favour')} sub={t('voting_with_rights_label')}
                  recorded={!hideVotes && recordedMark === 'for-rights'}
                  onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for-rights')}
                />
                {settings.allowAbstentions && (
                  seatStatus(currentDelegate) === 'present' ? (
                    <BallotButton
                      tone="neutral" icon={<Minus size={20} strokeWidth={3} />} label={t('voting_abstain')}
                      recorded={!hideVotes && recordedMark === 'abstain'}
                      onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'abstain')}
                    />
                  ) : (
                    <BallotButton tone="neutral" icon={<Minus size={20} strokeWidth={3} />} label={t('voting_abstain_pv')} disabled onClick={() => {}} />
                  )
                )}
                {!inPassRound && (
                  <BallotButton
                    tone="neutral" icon={<SkipForward size={20} strokeWidth={2.75} />} label={t('voting_pass')}
                    recorded={recordedMark === 'pass'}
                    onClick={() => handlePass(currentDelegate.id)}
                  />
                )}
                <BallotButton
                  tone="against" icon={<X size={20} strokeWidth={3} />} label={t('voting_against')} sub={t('voting_with_rights_label')}
                  recorded={!hideVotes && recordedMark === 'against-rights'}
                  onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against-rights')}
                />
                <BallotButton
                  tone="against" wide icon={<X size={22} strokeWidth={3} />} label={t('voting_against')}
                  recorded={!hideVotes && recordedMark === 'against'}
                  onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against')}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                {backButton(t('voting_step_back'))}
                {!hideVotes && (
                  <div className="flex-1 max-w-xl">
                    <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
                  </div>
                )}
                {recordedMark ? (
                  <button
                    type="button"
                    onClick={keepAndAdvance}
                    className="inline-flex items-center gap-2 h-11 ps-4 pe-5 rounded-full text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 4px rgba(27,56,40,0.2), 0 8px 18px rgba(27,56,40,0.2)' }}
                  >
                    <CornerDownRight size={18} strokeWidth={2.5} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
                    {t('voting_keep_vote')}
                  </button>
                ) : (
                  <span className="w-[120px] shrink-0" aria-hidden />
                )}
              </div>
            </div>
          )}
          {isViewOnly && !hideVotes && (
            <div className="shrink-0 w-full max-w-xl">
              <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
            </div>
          )}
        </div>
      )}

      {/* ── All voted: proceed ── */}
      {phase === 'voting' && !currentDelegate && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 gap-7">
          <h2 className="text-[28px] font-bold text-[#1C1410] text-center leading-tight tracking-[-0.012em] [text-wrap:balance]">
            {t('voting_all_voted', { n: presentDelegates.length })}
          </h2>
          {hideVotes ? (
            <p className="text-[15px] font-medium text-[#6A5A4A]">{t('voting_tally_hidden')}</p>
          ) : (
            <div className="w-full max-w-2xl flex flex-col items-center gap-6">
              <div className="flex gap-10">
                {bigCount(forCount, t('voting_for_label'), '#2F6B45')}
                {bigCount(againstCount, t('voting_against_label'), '#8B2020')}
                {abstainCount > 0 && bigCount(abstainCount, t('voting_abstain_label'), '#6A5A4A')}
                {withRights.length > 0 && bigCount(withRights.length, t('voting_with_rights_label'), '#8A6414')}
              </div>
              <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
              <p className="text-[13.5px] font-medium text-[#6A5A4A] tabular-nums -mt-2">
                {summaryLine}
                {outcome.quorumNeeded > 0 && ` · ${t('voting_summary_quorum', { present: presentAndPvDelegates.length, needed: outcome.quorumNeeded })}`}
              </p>
            </div>
          )}
          {isViewOnly ? (
            <p className="text-[15px] font-medium text-[#6A5A4A]">{t('voting_follower_waiting', { name: gavelRole.head ?? '' })}</p>
          ) : (
            <div className="flex items-center gap-3">
              {backButton(t('voting_step_back'))}
              <button
                type="button"
                onClick={handleFinishVoting}
                className="h-12 px-8 rounded-full font-semibold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 4px rgba(27,56,40,0.22), 0 12px 32px rgba(27,56,40,0.26)' }}
              >
                {/* A hidden tally reveals nothing here either, not even whether anyone voted with rights. */}
                {hideVotes
                  ? t('voting_continue')
                  : withRights.length > 0
                    ? t('voting_proceed_rights', { n: withRights.length })
                    : t('voting_see_result')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Rights speakers ── */}
      {phase === 'rights-speakers' && orderedRights.length > rightsIndex && (() => {
        const speaker = orderedRights[rightsIndex];
        const rightsSeat = committee.delegates.find((d) => d.id === speaker.delegateId) ?? { country: speaker.country };
        return (
          <div className="flex-1 min-h-0 flex gap-8 px-10 py-6">
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
              <p className="text-[14px] font-medium mb-5 tabular-nums" style={{ color: '#6A5A4A' }}>
                {t('voting_rights_header', { current: rightsIndex + 1, total: orderedRights.length })}
              </p>
              <span key={speaker.delegateId} className="gv-name-in rounded-full" style={{ boxShadow: '0 0 0 7px #F6F1E9, 0 0 0 12px #D9B44A, 0 18px 40px rgba(27,56,40,0.25)' }}>
                <SeatCircleFlag seat={rightsSeat} size={144} decorative />
              </span>
              <h1 key={`n-${speaker.delegateId}`} className="gv-name-in text-[32px] font-bold text-[#1C1410] text-center mt-6 leading-tight tracking-[-0.012em] [text-wrap:balance]">
                {getCountryDisplayName(speaker.country, language)}
              </h1>
              <p className="text-[15px] font-medium mt-1" style={{ color: '#6A5A4A' }}>
                {hideVotes
                  ? t('voting_with_rights_label')
                  : speaker.choice === 'for-rights' ? t('voting_rights_for') : t('voting_rights_against')}
              </p>
              {/* The rights clock runs on the driving device only (nothing per-second is ever
                  written), so a Commenter does not get a clock that would sit still. */}
              {!isViewOnly && (
                <>
                  <div
                    className="text-[56px] font-bold mt-5 tabular-nums leading-none tracking-[-0.02em]"
                    style={{ color: rightsSpeakerTime <= 10 ? '#8B2020' : rightsSpeakerTime <= 20 ? '#8A6414' : '#1C1410' }}
                  >
                    {Math.floor(rightsSpeakerTime / 60)}:{String(rightsSpeakerTime % 60).padStart(2, '0')}
                  </div>
                  <div className="flex gap-2 mt-4 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => setRightsRunning((r) => !r)}
                      className="h-11 px-6 rounded-full font-semibold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96]"
                      style={{ backgroundColor: rightsRunning ? '#8A6414' : '#2F6B45', color: '#FFFFFF' }}
                    >
                      {rightsRunning ? t('voting_pause') : t('voting_start')}
                    </button>
                    {[30, 45, 60, 90, 120].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateVote(() => ({ rightsTimerLimit: s }))}
                        aria-pressed={rightsTimerLimit === s}
                        className="h-11 min-w-11 px-3 rounded-full font-medium text-[13px] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,transform] duration-150 active:scale-[0.96]"
                        style={{ backgroundColor: rightsTimerLimit === s ? '#1B3828' : 'rgba(27,56,40,0.07)', color: rightsTimerLimit === s ? '#EED98A' : '#4A3F33' }}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-[380px] shrink-0 flex flex-col justify-center gap-3 min-h-0">
              <div className="min-h-0 overflow-y-auto rounded-[20px] p-2 space-y-1" style={{ backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 10px 28px rgba(27,56,40,0.08)' }}>
                {orderedRights.map((v, absIdx) => {
                  const done = absIdx < rightsIndex;
                  const isCurrent = absIdx === rightsIndex;
                  const movable = !isCurrent && !done && !isViewOnly;
                  return (
                    <div
                      key={v.delegateId}
                      draggable={movable}
                      onDragStart={() => { dragIndexRef.current = absIdx; }}
                      onDragOver={(e) => { if (movable) e.preventDefault(); }}
                      onDrop={() => {
                        const from = dragIndexRef.current;
                        if (from === null || from === absIdx || from <= rightsIndex || absIdx <= rightsIndex) return;
                        updateVote((prev) => {
                          const arr = [...prev.rightsOrder];
                          const [item] = arr.splice(from, 1);
                          arr.splice(absIdx, 0, item);
                          return { rightsOrder: arr };
                        });
                        dragIndexRef.current = null;
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-2xl transition-[background-color,opacity] duration-200 ${movable ? 'cursor-grab' : ''}`}
                      style={{ backgroundColor: isCurrent ? '#1B3828' : 'transparent', opacity: done ? 0.45 : 1 }}
                    >
                      <span className="text-[12px] w-5 font-medium text-end tabular-nums" style={{ color: isCurrent ? 'rgba(238,217,138,0.8)' : '#9A8A78' }}>{absIdx + 1}</span>
                      <SeatCircleFlag country={v.country} size={30} decorative ring={!isCurrent} />
                      <span className="flex-1 min-w-0 truncate text-[15px] font-medium" style={{ color: isCurrent ? '#FFFFFF' : '#1C1410' }}>{getCountryDisplayName(v.country, language)}</span>
                      <span className="text-[12.5px] font-medium shrink-0" style={{
                        color: isCurrent ? '#EED98A' : hideVotes ? '#6A5A4A' : v.choice === 'for-rights' ? '#2F6B45' : '#8B2020',
                      }}>
                        {isCurrent ? t('voting_speaking') : hideVotes ? t('voting_with_rights_label') : v.choice === 'for-rights' ? t('voting_for_rights_list') : t('voting_against_rights_list')}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!isViewOnly && (
                <div className="shrink-0 flex items-center gap-2">
                  {backButton(t('voting_step_back'))}
                  <button
                    type="button"
                    onClick={() => { setRightsRunning(false); handleNextRightsSpeaker(); }}
                    className="flex-1 h-11 rounded-full font-semibold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform duration-150 active:scale-[0.96]"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 4px rgba(27,56,40,0.2), 0 8px 18px rgba(27,56,40,0.2)' }}
                  >
                    {rightsIndex + 1 < orderedRights.length ? t('voting_next_rights') : t('voting_see_result')}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Final result ── */}
      {phase === 'result' && (() => {
        const soft = passed ? 'rgba(238,217,138,0.72)' : 'rgba(255,222,210,0.78)';
        return (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 gap-6">
            <p className="text-[14px] font-medium tabular-nums" style={{ color: '#6A5A4A' }}>
              {t('voting_final_result', { code: selectedDoc.docCode })}
            </p>

            <div
              className="gv-name-in rounded-[24px] px-10 py-8 text-center w-full max-w-2xl"
              style={{
                backgroundColor: passed ? '#1B3828' : '#8B2020',
                boxShadow: passed ? '0 2px 4px rgba(27,56,40,0.2), 0 24px 64px rgba(27,56,40,0.30)' : '0 2px 4px rgba(90,20,20,0.2), 0 24px 64px rgba(139,32,32,0.30)',
              }}
            >
              <div className="flex items-center justify-center gap-3">
                <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: passed ? '#EED98A' : '#FFE1D6', color: passed ? '#1B3828' : '#8B2020' }} aria-hidden>
                  {passed ? <Check size={22} strokeWidth={2.75} /> : <X size={22} strokeWidth={2.75} />}
                </span>
                <span className="text-[40px] font-bold leading-none tracking-[-0.02em]" style={{ color: passed ? '#EED98A' : '#FFFFFF' }}>
                  {passed ? t('voting_pick_status_passed') : t('voting_pick_status_failed')}
                </span>
              </div>
              <p className="text-[16px] font-medium mt-3 mb-6 leading-snug [text-wrap:balance]" style={{ color: soft }}>
                {selectedDoc.title}
              </p>
              <div className="flex justify-center gap-10">
                {[
                  { n: forCount, label: t('voting_for_label'), color: '#9BE3B4', show: true },
                  { n: againstCount, label: t('voting_against_label'), color: '#FFB4A8', show: true },
                  { n: abstainCount, label: t('voting_abstain_label'), color: 'rgba(255,255,255,0.7)', show: abstainCount > 0 },
                  { n: withRights.length, label: t('voting_with_rights_label'), color: '#F3D98A', show: withRights.length > 0 },
                ].filter((c) => c.show).map((c) => (
                  <div key={c.label} className="text-center">
                    <div className="text-[34px] font-bold leading-none tabular-nums" style={{ color: c.color }}>{c.n}</div>
                    <div className="text-[13px] font-medium mt-2" style={{ color: soft }}>{c.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-1.5 text-[13.5px] font-medium tabular-nums" style={{ color: '#FFFFFF' }}>
                {p5Veto && (
                  <p className="flex items-center gap-1.5 justify-center"><ShieldAlert size={16} strokeWidth={2.5} aria-hidden /> {settings.vetoMode === 'custom' ? t('voting_veto_exercised') : t('voting_p5_veto')}</p>
                )}
                {unanimousFail && <p>{t('voting_unanimous_fail')}</p>}
                {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'supermajority-2-3' && (
                  <p style={{ color: soft }}>{t('voting_supermajority', { for: forCount, total: totalDecisive, pct: totalDecisive > 0 ? Math.round(forCount / totalDecisive * 100) : 0 })}</p>
                )}
                {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'consensus' && (
                  <p style={{ color: soft }}>{t('voting_consensus', { against: againstCount })}</p>
                )}
                {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'simple' && (
                  <p style={{ color: soft }}>{t('voting_result_simple', { for: forCount, total: totalDecisive, needed: outcome.needed })}</p>
                )}
                {!outcome.quorumMet && (
                  <p>{t('voting_result_quorum_not_met', { present: presentAndPvDelegates.length, needed: outcome.quorumNeeded })}</p>
                )}
                {outcome.countsAbstentions && abstainCount > 0 && (
                  <p className="text-[13px]" style={{ color: soft }}>{t('voting_result_abst_counted')}</p>
                )}
              </div>
            </div>

            <div className="w-full max-w-2xl">
              <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
            </div>

            {!isViewOnly && (
              <div className="flex gap-3 flex-wrap justify-center items-center">
                {backButton(t('voting_step_back_to_ballot'))}
                <button
                  type="button"
                  onClick={() => setPendingDocId(selectedDoc.id)}
                  className="h-11 px-5 rounded-full font-semibold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,transform] duration-150 active:scale-[0.96] hover:bg-white"
                  style={{ backgroundColor: '#FAF8F3', color: '#1B3828', boxShadow: '0 0 0 1px rgba(27,56,40,0.14), 0 2px 6px rgba(27,56,40,0.08)' }}
                >
                  {t('voting_vote_again')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDocId(null)}
                  className="h-11 px-6 rounded-full font-semibold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96]"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 4px rgba(27,56,40,0.22), 0 10px 26px rgba(27,56,40,0.24)' }}
                >
                  {t('voting_next_doc', { doc: docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution')) })}
                </button>
              </div>
            )}
          </div>
        );
      })()}
      {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} isViewOnly={isViewOnly} myChairName={urlChairName} />}

      {endDebateModal}
    </div>
    </SeatArtProvider>
    </FitToScreen>
  );
}