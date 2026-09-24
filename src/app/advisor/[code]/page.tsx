'use client';

import { openAuth } from '@/lib/authModal';
import { use, useEffect, useState, type ReactNode } from 'react';
import FitToScreen from '@/components/FitToScreen';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import Link from 'next/link';
import { ArrowLeft, Eye, LogIn, Mic, MessageSquareOff, Pause, Plus, X } from 'lucide-react';
import {
  getCommitteeByCodeWithRetry,
  sendMessage as sendMessageDB,
  caucusRemainingNow,
  moderatedCaucusRemainingNow,
  speakerRemainingNow,
} from '@/lib/committeeService';
import { mergeMessagesById } from '@/lib/chatConversations';
import { startSessionSync, rowFields, withCurrentSpeaker, withLists, type ConnectionState } from '@/lib/sessionSync';
import ConnectionPill from '@/components/ConnectionPill';
import { useAuth } from '@/components/AuthProvider';
import type { ConferenceAccess } from '@/lib/conferenceAccess';
import { useSessionAccess } from '@/lib/useSessionAccess';
import { getCommitteeFlags, motionNames } from '@/lib/committeeFlags';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import type { CaucusState, Committee, SpeakerEntry } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { SeatArtProvider } from '@/components/SeatFlag';
import { SeatCircleFlag, SIDEBAR_MONOGRAM } from '@/components/CircleFlag';
import { getCommitteeDisplayName, committeeDisplayName, deriveCommitteeAcronym } from '@/lib/presetNames';

// ── Palette (CLAUDE.md §8) ───────────────────────────────────────────────────
const FONT = "var(--font-brand), sans-serif";
const K = {
  page: '#EDE7D8',
  surface: '#FAF8F3',
  forest: '#1B3828',
  forestLift: '#2A5A3C',
  moss: '#3D7A52',
  gold: '#EED98A',
  goldDeep: '#B6871F',
  amber: '#B8844A',
  ink: '#1C1410',
  inkSoft: '#544B3E',
  ivory: '#EDE7D8',
  line: 'rgba(61,122,82,0.35)',
} as const;
const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 8px 22px rgba(27,56,40,0.08)';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-1';
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const NUDGE_KEYS = ['advisor_nudge_1', 'advisor_nudge_2', 'advisor_nudge_3', 'advisor_nudge_4', 'advisor_nudge_5'] as const;

// ── The floor, derived from the committee row ───────────────────────────────
// ONE place decides who holds the floor and which queue is "up next", so the left
// panel and every delegation card can never disagree.
//   - GSL (and every non-caucus phase): current_speaker + the GSL.
//   - Moderated caucus / Tour de Table: caucus.currentSpeaker + the CAUCUS queue.
//   - Unmoderated caucus / Consultation: no queue at all (the caucus clock is the state).
// The caucus queue is deduped against the caucus floor speaker: the loader only removes
// the current speaker from the GSL, so after a lists refetch the caucus speaker could
// otherwise show up in "Up next" as well.
type FloorKind = 'gsl' | 'moderated' | 'unmoderated';
interface FloorModel {
  kind: FloorKind;
  speaker: { country: string; delegateId: string | null } | null;
  queue: SpeakerEntry[];
  /** The speaker clock anchor (current_speaker), only when it belongs to `speaker`. */
  clock: { base: number; startedAt: string | null } | null;
}

function floorModel(c: Committee): FloorModel {
  if (c.phase === 'moderated-caucus') {
    const country = c.caucus?.currentSpeaker ?? null;
    const row = c.currentSpeaker && country && c.currentSpeaker.country === country ? c.currentSpeaker : null;
    const delegateId = row?.delegateId ?? (country ? c.delegates.find((d) => d.country === country)?.id ?? null : null);
    const queue = (c.caucusQueue ?? []).filter((s) =>
      !country || (s.country !== country && (!delegateId || s.delegateId !== delegateId)));
    return {
      kind: 'moderated',
      speaker: country ? { country, delegateId } : null,
      queue,
      clock: row ? { base: c.speakerTimeRemaining, startedAt: c.speakerStartedAt } : null,
    };
  }
  if (c.phase === 'unmoderated-caucus') {
    return { kind: 'unmoderated', speaker: null, queue: [], clock: null };
  }
  const cs = c.currentSpeaker;
  return {
    kind: 'gsl',
    speaker: cs ? { country: cs.country, delegateId: cs.delegateId } : null,
    queue: cs ? c.speakersList.filter((s) => s.delegateId !== cs.delegateId) : c.speakersList,
    clock: cs ? { base: c.speakerTimeRemaining, startedAt: c.speakerStartedAt } : null,
  };
}

/** 'speaking', a 1-based place in the relevant queue, or null. */
function placeOf(floor: FloorModel, delegate: Committee['delegates'][0]): 'speaking' | number | null {
  const sp = floor.speaker;
  if (sp && (sp.delegateId === delegate.id || (!sp.delegateId && sp.country === delegate.country))) return 'speaking';
  const i = floor.queue.findIndex((s) => s.delegateId === delegate.id);
  return i >= 0 ? i + 1 : null;
}

// ── Clocks: isolated, so only the digits re-render (RULES 3 and 6b) ─────────
// Each reads the anchor on the database clock (serverNow, via the *RemainingNow
// helpers). Nothing is written, and the page itself never re-renders per second.
function useLiveSeconds(read: () => number, running: boolean, deps: unknown[]): number {
  const [value, setValue] = useState(() => read());
  useEffect(() => {
    setValue(read());
    if (!running) return;
    const id = setInterval(() => setValue(read()), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, ...deps]);
  return value;
}

function SpeakerCountdown({ base, startedAt, size = 40 }: { base: number; startedAt: string | null; size?: number }) {
  const t = useT();
  const secs = useLiveSeconds(() => speakerRemainingNow(base, startedAt), !!startedAt, [base, startedAt]);
  const low = secs <= 10;
  return (
    <div className="flex flex-col items-center" aria-live="off">
      <span
        className="font-black tabular-nums leading-none"
        style={{ fontFamily: FONT, fontSize: size, color: low ? K.amber : K.ivory, letterSpacing: '-0.02em' }}
        aria-label={t('advisor_room_time_left', { time: formatTime(secs) })}
      >
        {formatTime(secs)}
      </span>
      {!startedAt && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'rgba(238,217,138,0.7)' }}>
          <Pause size={11} strokeWidth={2.6} aria-hidden /> {t('advisor_room_paused')}
        </span>
      )}
    </div>
  );
}

function CaucusCountdown({ caucus, moderated, speakerBase, speakerStartedAt, children }: {
  caucus: CaucusState | null;
  moderated: boolean;
  speakerBase: number;
  speakerStartedAt: string | null;
  children: (secs: number) => ReactNode;
}) {
  const anchor = caucus?.totalStartedAt ?? null;
  const base = caucus?.remainingTime ?? null;
  const secs = useLiveSeconds(() => {
    if (base === null) return 0;
    const pair = { remainingTime: base, totalStartedAt: anchor } as CaucusState;
    return moderated
      ? moderatedCaucusRemainingNow(pair, speakerBase, speakerStartedAt)
      : caucusRemainingNow(pair);
  }, !!anchor, [anchor, base, moderated, speakerBase, speakerStartedAt]);
  return <>{children(secs)}</>;
}

// ── Delegation cards ─────────────────────────────────────────────────────────
function statusWord(t: ReturnType<typeof useT>, status: Committee['delegates'][0]['status']) {
  return status === 'present' ? t('delegate_status_present')
    : status === 'present-voting' ? t('delegate_status_pv')
    : t('delegate_status_absent');
}

function ExpandedDelegateCard({
  delegate,
  committee,
  floor,
  onClose,
}: {
  delegate: Committee['delegates'][0];
  committee: Committee;
  floor: FloorModel;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const t = useT();
  // Chair-renamed motion names, resolved off the committee row. This page never
  // hydrates the settings store (AGENTS.md rule 14), so this is the only read that
  // works here — and unlike caucus.motionLabel it works with no caucus running.
  const mn = motionNames(committee, language);
  // Nudges are chat messages. With chat disabled a delegate can see them but cannot
  // reply, so the affordance goes away with the rest of chat.
  const chatDisabled = getCommitteeFlags(committee).disableChat;
  const [nudgeSent, setNudgeSent] = useState<string | null>(null);

  const place = placeOf(floor, delegate);
  const inCaucus = floor.kind === 'moderated';

  const lastMotion = [...(committee.pendingMotions ?? [])].reverse().find(
    (m) => m.proposedBy === delegate.country &&
      (m.type as string) !== 'gsl-request' && (m.type as string) !== 'join-request'
  );

  const statusColor =
    delegate.status === 'present' ? K.moss :
    delegate.status === 'present-voting' ? K.forest :
    K.inkSoft;

  const handleNudge = (nudgeKey: string) => {
    if (chatDisabled) return;   // belt-and-braces: the buttons are not rendered either
    const msg = t(nudgeKey as Parameters<typeof t>[0]);
    sendMessageDB(committee.id, 'Faculty Advisor', msg, committee.code, undefined, true, delegate.country);
    setNudgeSent(msg);
    setTimeout(() => setNudgeSent(null), 1500);
  };

  let queueDisplay: string;
  if (place === 'speaking') {
    queueDisplay = t('advisor_currently_speaking');
  } else if (typeof place === 'number') {
    queueDisplay = inCaucus
      ? t('advisor_room_caucus_next', { n: place })
      : t('advisor_next_up').replace('{n}', String(place));
  } else {
    queueDisplay = t('advisor_not_in_queue');
  }

  let motionDisplay: string;
  if (lastMotion) {
    const typeLabel: Record<string, string> = {
      moderated: mn.moderated,
      unmoderated: mn.unmoderated,
      consultation: mn.consultation,
      custom: mn.custom,
      tour: mn.tour,
      'suspend-debate': mn.suspendDebate,
      'end-debate': mn.endDebate,
    };
    motionDisplay = typeLabel[lastMotion.type] || lastMotion.type;
    if (lastMotion.topic) motionDisplay += `: ${lastMotion.topic}`;
  } else {
    motionDisplay = t('advisor_no_motion');
  }

  return (
    <div
      className="relative rounded-3xl p-5 sm:p-6 flex flex-col gap-4"
      style={{ backgroundColor: K.surface, boxShadow: `inset 0 0 0 1.5px rgba(27,56,40,0.28), ${CARD_SHADOW}` }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute top-3 end-3 flex h-10 w-10 items-center justify-center rounded-full ${FOCUS}`}
        style={{ color: K.inkSoft }}
        aria-label={t('advisor_room_close')}
        title={t('advisor_room_close')}
      >
        <X size={20} strokeWidth={2.2} />
      </button>

      <div className="flex flex-col items-center gap-2 pt-1">
        <SeatCircleFlag seat={delegate} size={88} style={{ boxShadow: '0 4px 14px rgba(27,56,40,0.18)' }} loading="eager" />
        <h2 className="text-[26px] sm:text-3xl font-black text-center leading-tight" style={{ color: K.ink, textWrap: 'balance' }}>
          {getCountryDisplayName(delegate.country, language)}
        </h2>
        <span className="text-sm font-bold" style={{ color: statusColor }}>{statusWord(t, delegate.status)}</span>
      </div>

      <dl className="grid w-full gap-2 sm:grid-cols-2">
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: K.inkSoft }}>{t('advisor_last_motion')}</dt>
          <dd className="text-sm" style={{ color: K.ink }}>{motionDisplay}</dd>
        </div>
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: K.inkSoft }}>
            {inCaucus ? t('advisor_room_caucus_position') : t('advisor_queue_position')}
          </dt>
          <dd className="text-sm inline-flex items-center gap-1.5" style={{ color: K.ink }}>
            {place === 'speaking' && <Mic size={14} strokeWidth={2.4} color={K.goldDeep} aria-hidden />}
            {queueDisplay}
          </dd>
        </div>
      </dl>

      {/* Nudges are chat messages under the hood. When the Moderator disables chat the
          delegate can still receive them but has no way to answer, so the whole
          affordance is replaced by a short explanation. */}
      {chatDisabled ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
          <MessageSquareOff size={15} strokeWidth={2} color={K.inkSoft} className="shrink-0" aria-hidden />
          <p className="text-xs" style={{ color: K.inkSoft }}>{t('advisor_room_nudges_off')}</p>
        </div>
      ) : (
      <div className="flex flex-col items-center">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: K.inkSoft }}>{t('advisor_send_nudge')}</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {NUDGE_KEYS.map((nudgeKey) => (
            <button
              key={nudgeKey}
              type="button"
              onClick={() => handleNudge(nudgeKey)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors bg-[rgba(27,56,40,0.06)] text-[#1B3828] hover:bg-[#1B3828] hover:text-[#EED98A] active:scale-[0.97] ${FOCUS}`}
              style={{ boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.14)' }}
            >
              {t(nudgeKey)}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold mt-2 min-h-[16px]" style={{ color: K.forest }} aria-live="polite">
          {nudgeSent ? t('advisor_nudge_sent').replace('{msg}', nudgeSent) : ''}
        </p>
      </div>
      )}
    </div>
  );
}

function CollapsedDelegateCard({
  delegate,
  onSelect,
}: {
  delegate: Committee['delegates'][0];
  onSelect: () => void;
}) {
  const { language } = useLanguage();
  const name = getCountryDisplayName(delegate.country, language);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 w-full py-3 px-1 rounded-2xl transition-colors hover:bg-[rgba(27,56,40,0.08)] ${FOCUS}`}
      title={name}
    >
      <SeatCircleFlag seat={delegate} size={40} decorative />
      <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2 w-full" style={{ color: K.ink }}>{name}</span>
    </button>
  );
}

function NormalDelegateCard({ delegate, floor, onSelect }: { delegate: Committee['delegates'][0]; floor: FloorModel; onSelect: () => void }) {
  const { language } = useLanguage();
  const t = useT();
  const place = placeOf(floor, delegate);
  const absent = delegate.status === 'absent';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-[transform,box-shadow] hover:-translate-y-px active:scale-[0.99] ${FOCUS}`}
      style={{
        backgroundColor: K.surface,
        boxShadow: place === 'speaking' ? `inset 0 0 0 2px ${K.goldDeep}, ${CARD_SHADOW}` : CARD_SHADOW,
      }}
    >
      <SeatCircleFlag seat={delegate} size={38} decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold" style={{ color: K.ink }}>{getCountryDisplayName(delegate.country, language)}</span>
        <span className="block truncate text-xs" style={{ color: absent ? 'rgba(84,75,62,0.8)' : K.inkSoft }}>{statusWord(t, delegate.status)}</span>
      </span>
      {place === 'speaking' ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold" style={{ color: K.goldDeep }}>
          <Mic size={14} strokeWidth={2.5} aria-hidden /> {t('advisor_room_speaking')}
        </span>
      ) : typeof place === 'number' ? (
        <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: K.forest }}>{t('advisor_room_queue_short', { n: place })}</span>
      ) : null}
    </button>
  );
}

// ── Plain full-screen notices (access, errors) ───────────────────────────────
function Notice({ title, body, children, role }: { title: string; body?: string; children?: ReactNode; role?: 'alert' }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: K.page, fontFamily: FONT }}>
      <div className="text-center max-w-sm" role={role}>
        <h1 className="text-2xl font-black mb-2" style={{ color: K.forest, textWrap: 'balance' }}>{title}</h1>
        {body && <p className="mb-6" style={{ color: K.inkSoft, textWrap: 'pretty' }}>{body}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}
const PRIMARY_BTN = `inline-flex items-center gap-2 font-bold text-[#EED98A] px-5 py-3 rounded-xl transition-colors active:scale-[0.97] ${FOCUS}`;
const GHOST_BTN = `inline-flex items-center gap-2 font-bold px-5 py-3 rounded-xl transition-colors active:scale-[0.97] ${FOCUS}`;

const isAdvisorAccessKind = (kind: ConferenceAccess['kind']) => kind === 'advisor' || kind === 'organizer';

export default function AdvisorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { language } = useLanguage();
  const t = useT();
  const { loading: authLoading } = useAuth();
  const advisorAccess = useSessionAccess({ code, gate: 'origin', allow: isAdvisorAccessKind });
  const accessState = advisorAccess.state === 'standalone' ? 'allowed' : advisorAccess.state;
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The initial room read failed (after its retries): an inline Retry, never "not found".
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Live / Reconnecting / Offline, fed by the session sync below (R-4).
  const [connection, setConnection] = useState<ConnectionState>('reconnecting');

  // Conference-session access guard (#8 / #4). Standalone sessions stay anonymous; a
  // conference session requires an advisor/observer or organizer (conference-wide).
  // Gated on session_origin ('origin'), NOT on the dais: an open dais must not open this
  // view (it can nudge delegates) to anyone holding the session code. useSessionAccess
  // is keyed on the user id (a token refresh used to flash the loader over the room) and
  // turns a failed check into an inline retry instead of a verdict.

  useEffect(() => {
    const upperCode = code.toUpperCase();
    let unsub: (() => void) | null = null;

    let cancelled = false;
    // A failed read is not "not found": retried with backoff, then an inline Retry.
    getCommitteeByCodeWithRetry(upperCode, { isCancelled: () => cancelled }).then((result) => {
      if (cancelled) return;
      setLoadFailed(result.status === 'error');
      setLoading(false);
      const c = result.status === 'ok' ? result.committee : null;
      if (!c) return;
      setCommittee(c);
      // One pipeline for every event (src/lib/sessionSync.ts): each event refetches ONLY its
      // own slice, coalesced, with a sequence counter per slice, so a burst of writes (a
      // caucus accept, All Present) is one small fetch per slice instead of a cancelled pile
      // of full refetches. Messages land straight from the realtime payload. This view
      // renders neither chair notes nor organiser broadcasts, so it does not subscribe to
      // `feedback` / `session_broadcasts` at all (PERF-1). Wake, reconnect and back-online
      // refetch every slice (R-4).
      const sync = startSessionSync({
        committeeId: c.id,
        tables: ['committees', 'delegates', 'speakers_list', 'current_speaker', 'motions', 'documents', 'messages'],
        slices: ['row', 'delegates', 'lists', 'currentSpeaker', 'motions', 'documents', 'messages'],
        onConnection: setConnection,
        onMessage: (m) => setCommittee((prev) => {
          if (!prev) return prev;
          const merged = mergeMessagesById(prev.messages, [m]);
          return merged === prev.messages ? prev : { ...prev, messages: merged };
        }),
        apply: (slice, data) => {
          setCommittee((prev) => {
            if (!prev) return prev;
            switch (slice) {
              case 'row': return { ...prev, ...rowFields(data as Committee) };
              case 'delegates': return { ...prev, delegates: data as Committee['delegates'] };
              case 'lists': return withLists(prev, data as Parameters<typeof withLists>[1]);
              case 'currentSpeaker': return withCurrentSpeaker(prev, data as Parameters<typeof withCurrentSpeaker>[1], { includeRemaining: true });
              case 'motions': return { ...prev, pendingMotions: data as Committee['pendingMotions'] };
              case 'documents': return { ...prev, documents: data as Committee['documents'] };
              case 'messages': {
                const merged = mergeMessagesById(prev.messages, data as Committee['messages']);
                return merged === prev.messages ? prev : { ...prev, messages: merged };
              }
              default: return prev;
            }
          });
        },
      });
      unsub = sync.stop;
    });

    return () => { cancelled = true; unsub?.(); };
  }, [code, loadAttempt]);

  const upper = code.toUpperCase();
  const followHref = `/advisor?add=${encodeURIComponent(upper)}`;

  if (accessState === 'signin') {
    return (
      <Notice title={t('advisor_room_signin_title')} body={t('advisor_room_signin_body')}>
        <button type="button" onClick={() => openAuth()} className={PRIMARY_BTN} style={{ backgroundColor: K.forest }}>
          <LogIn size={17} strokeWidth={2.4} aria-hidden /> {t('advisor_room_signin_cta')}
        </button>
      </Notice>
    );
  }

  if (accessState === 'denied') {
    // Anyone may follow a conference room by code, read only, on their board (owner,
    // 24 Sep 2026). This detailed view (which can nudge) stays with the conference team.
    return (
      <Notice title={t('advisor_room_denied_title')} body={t('advisor_room_denied_body')}>
        <Link href={followHref} className={PRIMARY_BTN} style={{ backgroundColor: K.forest }}>
          <Plus size={17} strokeWidth={2.6} aria-hidden /> {t('advisor_room_follow')}
        </Link>
        <Link href="/sessions" className={GHOST_BTN} style={{ color: K.forest, backgroundColor: 'rgba(27,56,40,0.06)' }}>
          {t('advisor_room_home')}
        </Link>
      </Notice>
    );
  }

  if (accessState === 'error') {
    return (
      <Notice title={t('session_access_error_title')} body={t('session_access_error_body')} role="alert">
        <button type="button" onClick={advisorAccess.retry} className={PRIMARY_BTN} style={{ backgroundColor: K.forest }}>{t('delegate_seat_retry')}</button>
      </Notice>
    );
  }

  if (loading || authLoading || accessState === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: K.page }}>
        <style>{`
          @keyframes gavel-strike {
            0%   { transform: rotate(-30deg); }
            35%  { transform: rotate(15deg); }
            50%  { transform: rotate(10deg); }
            65%  { transform: rotate(15deg); }
            100% { transform: rotate(-30deg); }
          }
          .gavel-anim { animation: gavel-strike 1s ease-in-out infinite; transform-origin: 85% 85%; }
          @media (prefers-reduced-motion: reduce) { .gavel-anim { animation: none; } }
        `}</style>
        <svg className="gavel-anim" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="38" y="38" width="8" height="28" rx="3" transform="rotate(-45 38 38)" fill="#1B3828" />
          <rect x="8" y="14" width="36" height="16" rx="5" transform="rotate(-45 8 14)" fill="#B6871F" />
          <rect x="10" y="16" width="36" height="7" rx="3" transform="rotate(-45 10 16)" fill="#6A5A4A" opacity="0.4" />
          <circle cx="56" cy="56" r="3" fill="#1B3828" opacity="0.5" />
        </svg>
        <p className="text-sm font-semibold" style={{ color: K.inkSoft, fontFamily: FONT }}>{t('advisor_room_loading')}</p>
      </div>
    );
  }

  if (!committee && loadFailed) {
    return (
      <Notice title={t('session_load_failed')} role="alert">
        <button
          type="button"
          onClick={() => { setLoadFailed(false); setLoading(true); setLoadAttempt((n) => n + 1); }}
          className={PRIMARY_BTN}
          style={{ backgroundColor: K.forest }}
        >
          {t('delegate_seat_retry')}
        </button>
      </Notice>
    );
  }

  if (!committee) {
    return (
      <Notice title={t('advisor_not_found')}>
        <Link href="/join" className={PRIMARY_BTN} style={{ backgroundColor: K.forest }}>{t('advisor_join_page')}</Link>
        <Link href="/advisor" className={GHOST_BTN} style={{ color: K.forest, backgroundColor: 'rgba(27,56,40,0.06)' }}>{t('advisor_room_back_board')}</Link>
      </Notice>
    );
  }

  const localizedName = getCommitteeDisplayName(committee.name, language);
  const acronym = deriveCommitteeAcronym(committee.name);
  const headline = committeeDisplayName(localizedName, acronym);
  const showFullName = headline !== localizedName;

  const isAdjourned = committee.phase === 'adjourned' && !!committee.suspendedAt && !committee.endedAt;

  if (isAdjourned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8" style={{ backgroundColor: K.page, fontFamily: FONT }}>
        <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <p className="text-sm font-bold mb-2 relative z-10" style={{ color: K.forest }}>{headline} · <span className="tabular-nums">{committee.code}</span></p>
        <h1 className="text-4xl sm:text-5xl font-black mb-4 relative z-10" style={{ color: K.forest, textWrap: 'balance' }}>{t('advisor_adjourned_title')}</h1>
        <p className="text-lg relative z-10" style={{ color: K.inkSoft }}>{t('advisor_adjourned_desc')}</p>
        <Link href="/advisor" className={`${GHOST_BTN} mt-8 relative z-10`} style={{ color: K.forest, backgroundColor: 'rgba(27,56,40,0.06)' }}>
          <ArrowLeft size={16} strokeWidth={2.4} className="rtl:-scale-x-100" aria-hidden /> {t('advisor_room_back_board')}
        </Link>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const floor = floorModel(committee);

  // Same DB-backed resolver the delegate page uses, so a chair's rename shows here
  // too — including for Suspend / End Debate, which no caucus record ever carries.
  const advisorMotionNames = motionNames(committee, language);
  const unmodLabel = committee.caucus?.motionLabel
    || (committee.caucus?.isConsultation ? advisorMotionNames.consultation : advisorMotionNames.unmoderated);
  const advisorPhaseDisplay = (() => {
    // Prefer the chair's (possibly renamed) motion label, synced to every device via the caucus record.
    if (committee.phase === 'moderated-caucus') return committee.caucus?.motionLabel || advisorMotionNames.moderated;
    if (committee.phase === 'unmoderated-caucus') return unmodLabel;
    if (committee.endedAt) return t('advisor_room_phase_ended');
    if (committee.phase === 'pre-session') return t('advisor_room_phase_roll_call');
    if (committee.phase === 'speakers-list') return t('advisor_room_phase_gsl');
    if (committee.phase === 'voting') return t('advisor_room_phase_voting');
    return committee.phase.replace(/-/g, ' ');
  })();

  const caucus = committee.caucus;

  const sortedDelegates = [...committee.delegates].sort((a, b) => compareCountryNames(a.country, b.country, language));
  const selectedDelegate = selectedCountry
    ? sortedDelegates.find((d) => d.country === selectedCountry) ?? null
    : null;
  const otherDelegates = selectedCountry
    ? sortedDelegates.filter((d) => d.country !== selectedCountry)
    : sortedDelegates;

  const rule = { borderBottom: `1px solid ${K.line}` };
  const eyebrow = 'text-[11px] font-bold uppercase tracking-[0.12em]';

  return (
    <FitToScreen>
    <SeatArtProvider delegates={committee.delegates}>
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: K.page, fontFamily: FONT }}>
      <ConnectionPill state={connection} />
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      {/* Header */}
      <header className="px-3 sm:px-4 h-12 flex items-center gap-2 sm:gap-3 shrink-0 relative z-[2]" style={{ backgroundColor: K.surface, boxShadow: '0 1px 0 rgba(27,56,40,0.10)' }}>
        <Link
          href="/advisor"
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold ${FOCUS}`}
          style={{ color: K.forest }}
        >
          <ArrowLeft size={17} strokeWidth={2.4} className="rtl:-scale-x-100" aria-hidden />
          <span className="hidden sm:inline">{t('advisor_room_back_board')}</span>
          <span className="sm:hidden">{t('advisor_room_back_board_short')}</span>
        </Link>
        <span className="flex-1" />
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: K.inkSoft }} title={t('advisor_readonly_badge')}>
          <Eye size={15} strokeWidth={2.2} aria-hidden /> {t('advisor_room_read_only')}
        </span>
        <span className="text-sm font-bold tabular-nums tracking-wider" style={{ color: K.ink }}>{committee.code}</span>
        <Link
          href={followHref}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors bg-[#1B3828] text-[#EED98A] hover:bg-[#2A5A3C] ${FOCUS}`}
        >
          <Plus size={15} strokeWidth={2.6} aria-hidden />
          <span className="hidden sm:inline">{t('advisor_room_follow')}</span>
          <span className="sm:hidden">{t('advisor_room_follow_short')}</span>
        </Link>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative z-[2]">
        {/* Left: the room, the floor and the queue, forest */}
        <div className="w-full md:w-80 flex flex-col md:overflow-hidden md:shrink-0" style={{ backgroundColor: K.forest }}>
          <div className="px-4 pt-4 pb-3 shrink-0" style={rule}>
            <p className="text-xl font-black leading-tight" style={{ color: K.gold }}>{headline}</p>
            {showFullName && (
              <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(238,217,138,0.65)' }}>{localizedName}</p>
            )}
            {committee.topic && committee.topic !== 'TBD' && (
              <p className="text-xs leading-snug line-clamp-2 mt-1.5" style={{ color: 'rgba(237,231,216,0.72)' }} title={committee.topic}>
                <span className="font-bold" style={{ color: 'rgba(238,217,138,0.85)' }}>{t('advisor_topic_label')}</span>{committee.topic}
              </p>
            )}
            {/* Counts as plain type: present, two-thirds, simple majority (observers counted,
                as in the chair's sidebar). */}
            <div className="mt-3 flex items-end gap-4">
              {[
                { n: present, w: t('advisor_room_present') },
                { n: Math.ceil(present * 2 / 3), w: t('advisor_room_two_thirds') },
                { n: Math.floor(present / 2) + 1, w: t('advisor_room_majority') },
              ].map(({ n, w }) => (
                <div key={w} className="min-w-0">
                  <p className="text-2xl font-black tabular-nums leading-none" style={{ color: K.ivory }}>{n}</p>
                  <p className="text-[11px] leading-tight mt-1" style={{ color: 'rgba(237,231,216,0.66)' }}>{w}</p>
                </div>
              ))}
            </div>
            <p className={`${eyebrow} mt-3`} style={{ color: K.gold }}>{advisorPhaseDisplay}</p>
          </div>

          {/* The floor */}
          {floor.kind === 'unmoderated' ? (
            <div className="flex flex-col items-center px-4 py-5 shrink-0" style={rule}>
              <CaucusCountdown caucus={caucus} moderated={false} speakerBase={0} speakerStartedAt={null}>
                {(secs) => (
                  <span className="text-5xl font-black tabular-nums leading-none" style={{ color: secs <= 30 ? K.amber : K.ivory }}>
                    {formatTime(secs)}
                  </span>
                )}
              </CaucusCountdown>
              {caucus?.purpose && (
                <p className="text-sm mt-3 text-center" style={{ color: 'rgba(237,231,216,0.78)' }}>{caucus.purpose}</p>
              )}
              {caucus?.isConsultation && (
                <div className="w-full mt-4">
                  <CowDelegationBoard committee={committee} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-5 shrink-0" style={rule}>
              <p className={`${eyebrow} mb-3`} style={{ color: 'rgba(238,217,138,0.7)' }}>
                {floor.kind === 'moderated' ? t('advisor_caucus_speaker') : t('advisor_room_on_floor')}
              </p>
              {floor.speaker ? (
                <>
                  <SeatCircleFlag
                    country={floor.speaker.country}
                    size={88}
                    ring={false}
                    fallback="initials"
                    monogramColors={SIDEBAR_MONOGRAM}
                    style={{ boxShadow: `0 0 0 3px ${K.gold}, 0 6px 18px rgba(0,0,0,0.25)` }}
                    loading="eager"
                  />
                  <h2 className="text-2xl font-black mt-3 text-center leading-tight" style={{ color: K.ivory, textWrap: 'balance' }}>
                    {getCountryDisplayName(floor.speaker.country, language)}
                  </h2>
                  <p className="text-sm font-semibold mt-0.5 mb-3 inline-flex items-center gap-1.5" style={{ color: 'rgba(238,217,138,0.8)' }}>
                    <Mic size={14} strokeWidth={2.4} aria-hidden /> {t('view_is_speaking')}
                  </p>
                  {floor.clock && <SpeakerCountdown base={floor.clock.base} startedAt={floor.clock.startedAt} />}
                </>
              ) : (
                <p className="text-sm text-center" style={{ color: 'rgba(237,231,216,0.66)' }}>
                  {floor.kind === 'moderated' ? t('advisor_no_speaker') : t('advisor_no_current_speaker')}
                </p>
              )}
              {floor.kind === 'moderated' && (
                <>
                  <CaucusCountdown
                    caucus={caucus}
                    moderated
                    speakerBase={committee.speakerTimeRemaining}
                    speakerStartedAt={committee.speakerStartedAt}
                  >
                    {(secs) => (
                      <p className="text-xs font-semibold tabular-nums mt-3" style={{ color: 'rgba(237,231,216,0.75)' }}>
                        {t('advisor_room_caucus_left', { time: formatTime(secs) })}
                      </p>
                    )}
                  </CaucusCountdown>
                  {caucus?.purpose && (
                    <p className="text-xs mt-2 text-center" style={{ color: 'rgba(238,217,138,0.66)' }}>{caucus.purpose}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Queue */}
          <div className="md:flex-1 md:overflow-y-auto">
            {floor.kind === 'unmoderated' ? (
              <p className="px-4 py-4 text-sm leading-snug" style={{ color: 'rgba(237,231,216,0.72)' }}>
                {caucus?.isConsultation ? t('advisor_room_no_queue_consult') : t('advisor_room_no_queue')}
              </p>
            ) : (
              <>
                <div className="px-4 py-2.5" style={rule}>
                  <p className={eyebrow} style={{ color: 'rgba(238,217,138,0.7)' }}>
                    {t('advisor_up_next').replace('{n}', String(floor.queue.length))}
                  </p>
                </div>
                {floor.queue.length === 0 ? (
                  <div className="px-4 py-4 text-sm" style={{ color: 'rgba(237,231,216,0.6)' }}>{t('advisor_no_speakers_queued')}</div>
                ) : (
                  <ol>
                    {floor.queue.map((s, i) => (
                      <li key={s.delegateId} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid rgba(61,122,82,0.2)' }}>
                        <span className="text-sm font-bold tabular-nums w-5 shrink-0 text-end" style={{ color: 'rgba(238,217,138,0.75)' }}>{i + 1}</span>
                        <SeatCircleFlag country={s.country} size={28} ring={false} fallback="initials" monogramColors={SIDEBAR_MONOGRAM} decorative />
                        <span className="text-[15px] flex-1 truncate font-semibold" style={{ color: K.ivory }}>{getCountryDisplayName(s.country, language)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: every delegation */}
        <main className="md:flex-1 md:overflow-y-auto p-4">
          {selectedCountry === null ? (
            <>
              <div className="mb-4">
                <h2 className="text-2xl font-black" style={{ color: K.ink }}>{t('advisor_room_all_delegations')}</h2>
                <p className="text-sm mt-0.5" style={{ color: K.inkSoft }}>{t('advisor_room_tap_hint')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {sortedDelegates.map((d) => (
                  <NormalDelegateCard
                    key={d.id}
                    delegate={d}
                    floor={floor}
                    onSelect={() => setSelectedCountry(d.country)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-1/2 lg:shrink-0">
                {selectedDelegate && (
                  <ExpandedDelegateCard
                    delegate={selectedDelegate}
                    committee={committee}
                    floor={floor}
                    onClose={() => setSelectedCountry(null)}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`${eyebrow} mb-2`} style={{ color: K.forest }}>
                  {t('advisor_room_other_delegations')} <span className="tabular-nums">{otherDelegates.length}</span>
                </p>
                <div className="grid gap-1 grid-cols-3 sm:grid-cols-5">
                  {otherDelegates.map((d) => (
                    <CollapsedDelegateCard
                      key={d.id}
                      delegate={d}
                      onSelect={() => setSelectedCountry(d.country)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </SeatArtProvider>
    </FitToScreen>
  );
}
