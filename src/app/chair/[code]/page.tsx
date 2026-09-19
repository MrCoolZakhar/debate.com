'use client';
import { openAuth } from '@/lib/authModal';
import { use, useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import Portal from '@/components/Portal';
import { anchorBox } from '@/components/voting/anchorPosition';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import FitToScreen from '@/components/FitToScreen';
import GavelChip from '@/components/GavelChip';
import CommitteeIdentityBadge, { emblemMonogram } from '@/components/CommitteeIdentityBadge';
import SeatAddField from '@/components/SeatAddField';
import { TopBarTab, TopBarIconButton, TOP_BAR_ROW_PX, useTopBarTwoRows } from '@/components/ChairTopBar';
import SpeakerControls, { FloorProgress, SpeakerClock, POPOVER_TONES, type ControlLock } from '@/components/SpeakerControls';
import { moderatorNameOf, notifyCommenterOnly } from '@/lib/commenterNotice';
import DraggablePopover from '@/components/DraggablePopover';
import SpeakerStrip, { type StripHeader } from '@/components/SpeakerStrip';
import CommenterFloor from '@/components/CommenterFloor';
import SessionCodePresenter from '@/components/SessionCodePresenter';
import FloorEmblemBackdrop from '@/components/FloorEmblemBackdrop';
import ConferencePromoDialog from '@/components/ConferencePromoDialog';
import { Ban, ClockPlus, ListOrdered, Maximize2, MessageCircle, MessageSquareReply, Settings, Trophy, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CaucusState, Committee, Delegate, DelegateStatus } from '@/lib/types';
import RollCallPanel, { FlagCircle, recognisedStatus } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import MotionFlightNotice from '@/components/MotionFlightNotice';
import { logFloorSpeech, logTimedSpeech, cowTurnKey, floorSpeechSeconds, creditRoomOrderTour } from '@/lib/floorSpeech';
import DocumentsModal from '@/components/DocumentsModal';
import { getCountryByName, getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { SeatFlag, SeatArtProvider } from '@/components/SeatFlag';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCommitteeDisplayName, committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';
import { SettingsPanel } from '@/components/SettingsPanel';
import ScoreboardPanel from '@/components/ScoreboardPanel';
import FeedbackLogPanel, { liveCaucus } from '@/components/FeedbackLogPanel';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import { useSettingsStore, stripNonHydratedSettings } from '@/lib/settingsStore';
import { useAuth } from '@/components/AuthProvider';
import { useSessionAccess } from '@/lib/useSessionAccess';
import type { ConferenceAccess } from '@/lib/conferenceAccess';
import { resolveChairAwardsHref } from '@/lib/sessionAwardsLink';
import { supabase } from '@/lib/supabase';
import ChatPanel from '@/components/ChatPanel';
import ChatDialog from '@/components/chat/ChatDialog';
import ChatDisabledNotice from '@/components/ChatDisabledNotice';
import { getCommitteeFlags } from '@/lib/committeeFlags';
import { chatUnreadTotal, mergeMessagesById, chatConvKeyForMessage } from '@/lib/chatConversations';
import { isViewingChatConversation } from '@/lib/chatViewing';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import ChairSidebarShell from '@/components/ChairSidebarShell';
import SidebarFlagRail from '@/components/SidebarFlagRail';
import FloorBarExtent from '@/components/FloorBarExtent';
import { loadSidebarWidth, saveSidebarWidth, loadSidebarCollapsed, saveSidebarCollapsed } from '@/lib/sidebarWidth';
import { startSessionSync, rowFields, withCurrentSpeaker, withLists, ALL_SYNC_SLICES, COALESCE_MS, type ConnectionState, type SessionSync, type FetchMeta } from '@/lib/sessionSync';
import { endModeratedCaucusIfAnchorUnchanged } from '@/lib/caucusExpiryWrite';
import ConnectionPill from '@/components/ConnectionPill';
import TutorialOverlay from '@/components/TutorialOverlay';
import { useAgendaPicker } from '@/components/AgendaPicker';
import { useSettingsSync } from '@/lib/useSettingsSync';
import { VotingInProgressCard } from '@/components/VotingInProgressCard';
import { useGavelCue, type GavelCue } from '@/lib/useGavelCue';
import NotificationStack, { type NotificationExtra } from '@/components/notifications/NotificationStack';
import GlassToast from '@/components/notifications/GlassToast';
import GavelDeviceBanner from '@/components/GavelDeviceBanner';
import ChairDeviceKickModal from '@/components/ChairDeviceKickModal';
import { useChairDeviceLock } from '@/lib/useChairDeviceLock';
import { getGavelDeviceId, deriveGavelRole, markResumeClaim, clearResumeClaim, resumeClaimIsMine } from '@/lib/gavelDevice';
import {
  notify,
  dismiss as dismissNotification,
  setNotificationsSuppressed,
  notifyKey,
  NOTIFY_TTL,
} from '@/lib/sessionNotifications';
import {
  getCommitteeByCode,
  getCommitteeByCodeWithRetry,
  logEvent,
  setPhase as setPhaseInDB,
  setDelegateStatus as setDelegateStatusInDB,
  setDelegateStatusesBulk as setDelegateStatusesBulkInDB,
  addToSpeakersList as addToSpeakersListInDB,
  removeFromSpeakersList as removeFromSpeakersListInDB,
  addToCaucusList as addToCaucusListInDB,
  removeFromCaucusList as removeFromCaucusListInDB,
  reorderSpeakersList as reorderSpeakersListInDB,
  nextSpeaker as nextSpeakerInDB,
  syncSpeakerTime as syncSpeakerTimeInDB,
  startSpeakerTimer as startSpeakerTimerInDB,
  stopSpeakerTimer as stopSpeakerTimerInDB,
  updateCaucus as updateCaucusInDB,
  updateCaucusIfUnchanged as updateCaucusIfUnchangedInDB,
  stopSpeakerAtZeroIfUnchanged as stopSpeakerAtZeroIfUnchangedInDB,
  clearCurrentSpeakerIfUnchanged,
  caucusRemainingNow,
  speakerRemainingNow,
  anchorCaucusClock,
  moderatedCaucusRemainingNow,
  caucusQueueCapacity,
  capSpeakerSlot,
  approveJoinRequest,
  denyJoinRequest,
  approveGslRequest,
  denyGslRequest,
  resumeSession as resumeSessionInDB,
  claimResumeSession as claimResumeSessionInDB,
  resolveJoinRequestsOnAdmit,
  startResumeRollCall as startResumeRollCallInDB,
  releaseResumeClaim as releaseResumeClaimInDB,
  takeOverResumeClaim as takeOverResumeClaimInDB,
  removePendingMotion as removePendingMotionInDB,
  updateSpeakerTimeLimit,
  updateCommitteeTopicInDB,
  COMMITTEE_TOPIC_MAX,
  updateCommitteeHeadChairInDB,
  getActiveBroadcasts,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
  setPhaseAndCaucus as setPhaseAndCaucusInDB,
  pauseSpeakerTimer as pauseSpeakerTimerInDB,
  grantSpeakerTime as grantSpeakerTimeInDB,
  phaseForCaucus,
  freezeCaucusForBreak,
  type SessionBroadcast,
} from '@/lib/committeeService';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import SaveStatusToast from '@/components/notifications/SaveStatusToast';
import ClockSkewHint from '@/components/ClockSkewHint';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';

/** Who holds the floor, as a stable key (delegate id, or the country for a Room-Order
 *  placeholder). Two different keys = the floor changed hands. */
const isChairAccessKind = (kind: ConferenceAccess['kind']) => kind === 'chair' || kind === 'organizer';

function speakerTurnKey(c: Committee | null | undefined): string | null {
  const s = c?.currentSpeaker;
  return s ? (s.delegateId || s.country || null) : null;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function GavelLoader() {
  const t = useT();
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
      <p className="text-[#9A8A78] text-sm font-mono tracking-widest">{t('session_loading')}</p>
    </div>
  );
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

const COUNTRY_ABBREV: Record<string, string> = {
  'United Kingdom': 'UK',
  'United States': 'USA',
  'United Arab Emirates': 'UAE',
  'South Korea': 'S. Korea',
  'North Korea': 'N. Korea',
  'Democratic Republic of Congo': 'DR Congo',
  'Dominican Republic': 'D.R.',
  'Central African Republic': 'CAR',
  'Papua New Guinea': 'PNG',
  'Trinidad and Tobago': 'T&T',
  'Bosnia and Herzegovina': 'BiH',
  'Saint Kitts and Nevis': 'St. Kitts',
  'Saint Vincent and the Grenadines': 'St. Vincent',
  'Antigua and Barbuda': 'Antigua',
  'Equatorial Guinea': 'Eq. Guinea',
};
function abbrevCountry(name: string): string {
  return COUNTRY_ABBREV[name] ?? name;
}

type CommitteeSetter = React.Dispatch<React.SetStateAction<Committee | null>>;
/** The two floating floor panels. Independent: both may be open at once. */
type FloorPopover = 'extraTime' | 'rightToReply';
type FloorPopovers = Record<FloorPopover, boolean>;

const localUpdateTime = { current: 0 };
// R-1: bumped by EVERY optimistic local write (updateLocal, structural or not). Timer ticks
// never call updateLocal (RULE 3), so ticks never move it. The session sync stamps its value
// on each refetch; a refetch that returns after a local write it predates is a snapshot from
// BEFORE the click, so it is not applied over the chair's own state (it is fetched again).
// Before this, a delegate's event within ~1 s of Next brought the previous speaker back and
// a second Next logged their speech twice.
const localWriteSeq = { current: 0 };

// How long a locally-written delegate status stays pinned against an incoming refetch before
// we hand control back to the DB row. Deliberately the same number as OPTIMISTIC_TTL_MS in
// RollCallPanel.tsx — both are the backstop for a status write that never lands, and a chair
// should not see the two surfaces give up at different moments.
const STATUS_PIN_TTL_MS = 8000;

// ── Organiser broadcasts: per-device dismissal memory ─────────────────────────
// A broadcast lives in the DB until it expires, and the chair page refetches the whole
// active set on every reload and on every realtime event. Without a record of what this
// device has already dealt with, one refresh would re-raise a card the chair dismissed ten
// minutes ago. Keyed per committee AND per broadcast id — the same dais laptop can host two
// committees in a day, and a chair who dismissed a message in one must not have it
// suppressed in the other.
const broadcastSeenStorageKey = (code: string) => `gavelling-broadcast-seen-${code}`;

function loadSeenBroadcasts(code: string): Set<string> {
  try {
    const raw = localStorage.getItem(broadcastSeenStorageKey(code));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch { return new Set(); }
}

function markBroadcastSeen(code: string, id: string): void {
  try {
    const seen = loadSeenBroadcasts(code);
    if (seen.has(id)) return;
    seen.add(id);
    // Capped: broadcasts are deleted upstream once they expire, so an unbounded list would
    // only ever accumulate ids for rows that no longer exist.
    localStorage.setItem(broadcastSeenStorageKey(code), JSON.stringify(Array.from(seen).slice(-120)));
  } catch {}
}

// An actionable broadcast whose `action_at` is already well in the past must NOT fire. The
// effect has either already happened (the committee is suspended/ended, and the guards below
// catch that) or the committee has deliberately been resumed since — and re-suspending, or
// worse re-ending, a committee that a chair brought back is destructive and unrecoverable.
// Inside this window we do fire, so a chair who loads the page moments after the deadline
// still gets the effect the organiser scheduled.
const BROADCAST_LATE_FIRE_GRACE_MS = 5 * 60 * 1000;
// setTimeout clamps anything past 2^31-1 ms to fire immediately. A broadcast scheduled
// further out than ~24 days is simply not armed on this mount; a later reload will arm it.
const MAX_TIMEOUT_MS = 2_147_483_647;

/** A one-off full resync (gavel handover, resume) with the R-1 local-write guard the session
 *  sync applies to every slice: `stale` is true when an optimistic local write happened
 *  while the fetch was in flight, so the snapshot predates the chair's own click and must not
 *  be merged over it. Callers still read server FACTS from it (is it suspended, who holds the
 *  latch) but hand the state merge to a forced catch-up instead. */
async function fetchCommitteeGuarded(code: string): Promise<{ fresh: Committee | null; stale: boolean }> {
  const seqAtStart = localWriteSeq.current;
  const fresh = await getCommitteeByCode(code);
  return { fresh, stale: localWriteSeq.current !== seqAtStart };
}

function updateLocal(setCommittee: CommitteeSetter, updater: (c: Committee) => Committee, structural = false) {
  if (structural) localUpdateTime.current = Date.now();
  localWriteSeq.current++;
  setCommittee((prev) => prev ? updater(prev) : prev);
}

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk':   'United Kingdom',
  'us':   'United States',
  'usa':  'United States',
  'uae':  'United Arab Emirates',
  'drc':  'DR Congo',
  'roc':  'Taiwan',
  'rok':  'South Korea',
  'dprk': 'North Korea',
  'car':  'Central African Republic',
  'png':  'Papua New Guinea',
};

function resolveQuery(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return COUNTRY_ACRONYMS[lower] ?? raw.trim();
}

// ── Add Speaker Input ─────────────────────────────────────────────────────────
// `onRecognise` (optional): absent delegates are offered too, tagged, and picking one marks
// them Present in the same action, exactly like clicking their row in the sidebar. Without it
// (below quorum, where the add itself is a no-op) absent delegates stay out of the list, so
// nobody is ever marked Present without being added.
//
// 16 Sep 2026 (owner): the quick-add chips and the + disc that led the field were removed
// again ("remove the suggested speakers and the plus button"). It is the plain search field:
// typeahead, Enter shortcut and the recognise-absent path.
function AddSpeakerInput({ committee, onAdd, onRecognise }: { committee: Committee; onAdd: (id: string) => void; onRecognise?: (id: string) => void }) {
  const { language } = useLanguage();
  const t = useT();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set([
    ...committee.speakersList.map((s) => s.delegateId),
    ...(committee.currentSpeaker ? [committee.currentSpeaker.delegateId] : []),
  ]);
  const eligible = committee.delegates.filter(
    (d) => (d.status !== 'absent' || !!onRecognise) && d.id !== committee.currentSpeaker?.delegateId
  );
  const q = resolveQuery(query).toLowerCase();
  const matches = q
    ? eligible.filter((d) => startsWithCountryQuery(d.country, q, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, q, language) && matchesCountryQuery(d.country, q, language)))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => {
    if (!d || onList.has(d.id)) return;
    if (d.status === 'absent') { if (!onRecognise) return; onRecognise(d.id); }   // status before the add
    onAdd(d.id); setQuery('');
  };
  return (
    <div className="relative" data-tutorial="speakers-input">
      <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder={t('gsl_add_to_list')} autoFocus
          className="flex-1 min-w-[7rem] bg-transparent px-4 py-2.5 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#9A8A78] px-2 truncate max-w-[120px]">↵ {getCountryDisplayName(topNotOnList.country, language)}</span>}
      </div>
      {query && matches.length > 0 && (
        <div data-tutorial="speakers-autocomplete" className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d, i) => {
            const alreadyOnList = onList.has(d.id);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
                  <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  <SeatFlag country={d.country} size={20} className="object-contain" fallback={<UnknownSeatIcon size={20} />} />
                </span>
                  <span className="text-sm flex-1 text-[#9A8A78]">{getCountryDisplayName(d.country, language)}</span>
                  <span className="text-xs text-[#9A8A78]">{t('gsl_already_on_list')}</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  <SeatFlag country={d.country} size={20} className="object-contain" fallback={<UnknownSeatIcon size={20} />} />
                </span>
                <span className="text-sm">{getCountryDisplayName(d.country, language)}</span>
                {d.status === 'absent' && <span className="text-[10px] text-[#B6871F] shrink-0">{t('rollcall_absent')}</span>}
                {isFirst && <span className="ms-auto text-xs text-[#9A8A78]">{t('gsl_enter_hint')}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Right of Reply country input — type-ahead, no dropdown ───────────────────
function RtrCountryInput({
  committee,
  value,
  onChange,
}: {
  committee: Committee;
  value: string;
  onChange: (v: string) => void;
}) {
  const { language } = useLanguage();
  const t = useT();
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const q = resolveQuery(query).toLowerCase();
  const matches = q
    ? eligible.filter((d) => startsWithCountryQuery(d.country, q, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, q, language) && matchesCountryQuery(d.country, q, language)))
    : [];
  const topMatch = matches[0] ?? null;
  const shown = matches.slice(0, 5);
  const listShown = !!query && shown.length > 0 && !value;

  // The suggestions render through Portal at fixed coordinates (UI RULE: never clipped). The
  // Right of Reply panel is `overflow-hidden`, so the old `absolute bottom-full` list was cut
  // off. Above the field by default (the panel usually sits low on the floor), flipped below
  // when there is no room, clamped inside #fit-root. z 48: over the floor panels (40 / 41),
  // under every dialog (50+). The panel can be dragged while the list is open, so the list
  // follows it on a rAF loop that runs ONLY while it is shown and sets state only on a change.
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  useEffect(() => {
    if (!listShown) return;
    let raf = 0;
    const tick = () => {
      const el = inputRef.current?.parentElement;
      if (el) {
        const box = anchorBox(el);
        const width = box.right - box.left;
        const h = listRef.current?.offsetHeight ?? shown.length * 34;
        const M = 8;
        const above = box.top - 4 - h;
        const top = above >= M ? above : Math.min(box.bottom + 4, box.viewH - h - M);
        const left = Math.min(Math.max(M, box.left), Math.max(M, box.viewW - width - M));
        setPos((p) => (p && p.left === left && p.top === top && p.width === width ? p : { left, top, width }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listShown, shown.length]);

  return (
    <div className="relative flex-1">
      <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus
          onChange={(e) => { setQuery(e.target.value); onChange(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (topMatch) { setQuery(topMatch.country); onChange(topMatch.country); }
            }
            if (e.key === 'Escape') { setQuery(''); onChange(''); }
          }}
          placeholder={language === 'ar' ? 'أدخل اسم الدولة...' : language === 'fr' ? 'Ajouter un pays...' : language === 'es' ? 'Agregar país...' : 'Type country...'}
          className="flex-1 bg-transparent px-3 py-1.5 text-[#1C1410] text-xs placeholder-[#9A8A78] focus:outline-none"
        />
        {topMatch && query && !value && query.toLowerCase() !== topMatch.country.toLowerCase() && (
          <span className="text-[10px] text-[#9A8A78] px-2 truncate max-w-[90px]">↵ {getCountryDisplayName(topMatch.country, language)}</span>
        )}
      </div>
      {listShown && (
        <Portal>
          <div
            ref={listRef}
            data-rtr-suggestions=""
            style={{ position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width ?? 240, zIndex: 48, visibility: pos ? 'visible' : 'hidden' }}
            className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl"
          >
            {shown.map((d, i) => {
              return (
                <button
                  key={d.id}
                  onMouseDown={(e) => { e.preventDefault(); setQuery(d.country); onChange(d.country); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-start text-xs transition-colors focus:outline-none ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}
                >
                  <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
                    <SeatFlag country={d.country} size={16} className="object-contain" fallback={<UnknownSeatIcon size={16} />} />
                  </span>
                  <span className="flex-1">{getCountryDisplayName(d.country, language)}</span>
                  {i === 0 && <span className="text-[#9A8A78] shrink-0">{t('gsl_enter_hint')}</span>}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}

// ── Draggable GSL Speakers Queue ──────────────────────────────────────────────
/** The speaker holding the floor (GSL, moderated caucus, Tour de Table): a round seat flag
 *  (crest, then flag, then monogram) with a soft forest-tinted lift. */
// 17 Sep 2026 (owner: "increase the size of the current speaker by another 20%, don't move
// anything else"): 164 -> 197 and the name 1.8rem -> 2.16rem. ONLY the flag and the name grow;
// the clock, the progress bar, the strip and the buttons are untouched, and zone 2 still
// centres inside `flex-1 min-h-0`, so nothing else on the floor moves.
const FLOOR_FLAG_PX = 197;
/** The name under the floor flag, grown with it. */
const FLOOR_NAME_REM = '2.16rem';
/** The Room Order Tour de Table number disc, the floor "flag" of a numbered turn. */
const FLOOR_DISC_PX = 173;
const FLOOR_FLAG_SHADOW = '0 0 0 4px #F0EBDD, 0 2px 6px rgba(27,56,40,0.12), 0 12px 28px rgba(27,56,40,0.20)';

function DraggableSpeakersQueue({ list, onReorder, onRemove, onRemoveCurrent, lastSpeakerDelegateId, currentSpeakerDelegateId, onDeckDelegateId, header, isRoomOrderTdT, onLockedAttempt }: {
  list: { delegateId: string; country: string }[];
  onReorder?: (newList: { delegateId: string; country: string }[]) => void;
  onRemove?: (delegateId: string) => void;
  /** X on the speaker holding the floor: log the speech, pause, clear the floor. */
  onRemoveCurrent?: () => void;
  lastSpeakerDelegateId?: string | null;
  currentSpeakerDelegateId?: string | null;
  onDeckDelegateId?: string | null;
  header?: StripHeader | null;
  isRoomOrderTdT?: boolean;
  /** A Commenter pressing a flag: the "only the Moderator" notice. */
  onLockedAttempt?: () => void;
}) {
  // Pointer-driven drag (mouse, pen, touch), drop bar, the X on the floor speaker:
  // src/components/SpeakerStrip.tsx.
  const { language } = useLanguage();
  return (
    <SpeakerStrip
      list={list}
      onReorder={onReorder}
      onRemove={onRemove}
      onRemoveCurrent={onRemoveCurrent}
      lastSpeakerDelegateId={lastSpeakerDelegateId}
      currentSpeakerDelegateId={currentSpeakerDelegateId}
      onDeckDelegateId={onDeckDelegateId}
      header={header}
      isRoomOrderTdT={isRoomOrderTdT}
      onLockedAttempt={onLockedAttempt}
      formatName={(country) => abbrevCountry(getCountryDisplayName(country, language))}
    />
  );
}

// ── Caucus Queue Sidebar (numbered list view for sidebar) ─────────────────────
function CaucusQueueSidebar({ committee, onRemove, onReorder, lastSpeakerDelegateId }: {
  committee: Committee;
  onRemove: (delegateId: string) => void;
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  lastSpeakerDelegateId?: string | null;
}) {
  const { language } = useLanguage();
  const t = useT();
  const dragIndexRef = useRef<number | null>(null);
  const queue = committee.caucusQueue ?? [];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#DDD4C0] shrink-0">
        <span className="text-sm font-bold text-[#1C1410]">{t('gsl_speaker_queue')}</span>
        <span className="text-xs text-[#9A8A78] ms-2 font-mono">{queue.length} speakers</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#9A8A78] text-sm">{t('gsl_no_speakers_queued')}</div>
        ) : (
          queue.map((s, i) => {
            return (
              <div
                key={s.delegateId}
                draggable
                onDragStart={() => { dragIndexRef.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragIndexRef.current;
                  if (from === null || from === i) return;
                  const newList = [...queue];
                  const [moved] = newList.splice(from, 1);
                  newList.splice(i, 0, moved);
                  onReorder(newList);
                  dragIndexRef.current = null;
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all bg-[#FAF8F3] border border-[#DDD4C0] hover:border-[#1B3828]/40 cursor-grab group"
              >
                <span className="text-xs text-[#9A8A78] font-mono w-5 text-end shrink-0">{i + 1}</span>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  <SeatFlag country={s.country} size={20} className="object-contain" fallback={<UnknownSeatIcon size={20} />} />
              </span>
                <span className="flex-1 text-sm text-[#1C1410] line-clamp-2 break-words whitespace-normal leading-tight">{getCountryDisplayName(s.country, language)}</span>
                {lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && (
                  <span className="text-xs font-bold text-[#9A8A78] bg-[#DDD4C0] px-1.5 py-0.5 rounded shrink-0">Last</span>
                )}
                <button
                  onClick={() => onRemove(s.delegateId)}
                  className="text-[#9A8A78] hover:text-[#8B2020] transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
                >✕</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** "Queue full": a short glass card in the top-right NotificationStack (owner, 15 Sep 2026),
 *  not a flash in the sidebar or a message over the add bar. One key, so repeated refusals
 *  restart the same card instead of stacking; urgent so it shows during a running speech
 *  (a refusal the chair cannot see reads as a dead click). */
function notifyCaucusQueueFull(t: ReturnType<typeof useT>) {
  notify({
    key: 'caucus-queue-full',
    kind: 'info',
    title: t('caucus_queue_full_title'),
    body: t('caucus_queue_full_body'),
    ttlMs: NOTIFY_TTL.notice,   // under 5 s of unattended time (owner, 17 Sep 2026)
    urgent: true,
  });
}

// ── Caucus Add Speaker Input ──────────────────────────────────────────────────
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd, onAddFirst, onAddLast, maxSpeakers, currentQueueLength, currentSpeakerCountry, onEndCaucus, onRecognise }: {
  committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void;
  /** Same as AddSpeakerInput. Recognition runs only after the capacity check passed (a full
   *  queue raises the queue-full notification instead), and the add handlers use the same
   *  capacity, so a recognised delegate is always queued. */
  onRecognise?: (id: string) => void;
  onAddFirst?: (id: string) => void; onAddLast?: (id: string) => void;
  maxSpeakers?: number; currentQueueLength?: number;
  currentSpeakerCountry?: string | null;
  onEndCaucus?: () => void;
}) {
  const { language } = useLanguage();
  const t = useT();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set((committee.caucusQueue ?? committee.speakersList).map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent' || !!onRecognise);
  const isFull = maxSpeakers !== undefined && currentQueueLength !== undefined && currentQueueLength >= maxSpeakers;
  const cq = resolveQuery(query).toLowerCase();
  const matches = cq
    ? eligible.filter((d) => startsWithCountryQuery(d.country, cq, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, cq, language) && matchesCountryQuery(d.country, cq, language)))
    : [];
  const isCurrentSpeaker = (d: { country: string }) => !!currentSpeakerCountry && d.country === currentSpeakerCountry;
  const topNotOnList = matches.find((d) => !onList.has(d.id) && !isCurrentSpeaker(d)) ?? null;
  // Absent delegates are recognised (status first) only once every refusal check passed.
  const recogniseIfAbsent = (d: { id: string; status: DelegateStatus }) => {
    if (d.status !== 'absent') return true;
    if (!onRecognise) return false;
    onRecognise(d.id);
    return true;
  };
  // Full: the bar stays in place and the refusal is a short top-right notification
  // (notifyCaucusQueueFull), never a message that replaces the bar.
  const refuseIfFull = () => { if (isFull) notifyCaucusQueueFull(t); return isFull; };
  const commit = (d: typeof topNotOnList) => {
    if (!d || onList.has(d.id) || isCurrentSpeaker(d)) return;
    if (refuseIfFull()) return;
    if (!recogniseIfAbsent(d)) return;
    onAdd(d.id); setQuery('');
  };
  // Full (owner, 17 Sep 2026): the field cannot even be typed in. It is disabled (so it is
  // not focusable), whatever was half typed is dropped, and the bar itself says "Queue full".
  // It re-enables on its own the moment room appears (a removal, Next, an extension).
  // Adjusted during render (React's derived-state pattern), not in an effect.
  if (isFull && query) setQuery('');
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
      <>
      <div
        className={`flex items-center border rounded-xl transition-colors ${isFull ? 'bg-[#EFE9DC] border-[#DDD4C0] cursor-not-allowed' : 'bg-[#FAF8F3] border-[#DDD4C0] focus-within:border-[#1B3828]'}`}
        title={isFull ? t('caucus_queue_full_body') : undefined}
      >
        <input ref={inputRef} type="text" value={isFull ? '' : query} onChange={(e) => setQuery(e.target.value)}
          disabled={isFull}
          aria-describedby={isFull ? 'caucus-queue-full-note' : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder={isFull ? t('caucus_queue_full_body') : t('gsl_add_to_list')}
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm disabled:cursor-not-allowed" />
        {isFull && (
          <span id="caucus-queue-full-note" role="status"
            className="shrink-0 me-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(139,32,32,0.08)', color: '#8B2020', boxShadow: 'inset 0 0 0 1px rgba(139,32,32,0.18)' }}>
            <Ban size={12} strokeWidth={2.6} aria-hidden />
            {t('caucus_queue_full_title')}
          </span>
        )}
        {!isFull && topNotOnList && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {getCountryDisplayName(topNotOnList.country, language)}</span>}
      </div>
      {!isFull && query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d) => {
            const alreadyOnList = onList.has(d.id);
            const spoke = spokenCountries.includes(d.country);
            const isCurrent = isCurrentSpeaker(d);
            if (isCurrent || alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
                  <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                    <SeatFlag country={d.country} size={20} className="object-contain" fallback={<UnknownSeatIcon size={20} />} />
                </span>
                  <span className="text-sm flex-1 text-[#9A8A78]">{getCountryDisplayName(d.country, language)}</span>
                  <span className="text-xs text-[#9A8A78]">{isCurrent ? t('caucus_currently_speaking') : t('gsl_already_on_list')}</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  <SeatFlag country={d.country} size={20} className="object-contain" fallback={<UnknownSeatIcon size={20} />} />
                </span>
                <span className="text-sm flex-1">{getCountryDisplayName(d.country, language)}</span>
                {d.status === 'absent' && <span className="text-[10px] text-[#B6871F] shrink-0">{t('rollcall_absent')}</span>}
                {spoke && <span className="text-[10px] text-[#B6871F] shrink-0">{t('caucus_already_spoke')}</span>}
                {isFirst && !spoke && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onAddFirst && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (refuseIfFull() || !recogniseIfAbsent(d)) return; onAddFirst(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors gv-lift">
                        {t('caucus_add_first')}
                      </button>
                    )}
                    {onAddLast && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (refuseIfFull() || !recogniseIfAbsent(d)) return; onAddLast(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors gv-lift">
                        {t('caucus_add_last')}
                      </button>
                    )}
                    <span className="text-xs text-[#9A8A78]">{t('gsl_enter_hint')}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      </>
      </div>
      {onEndCaucus && (
        <button onClick={onEndCaucus}
          className="shrink-0 px-5 py-3 rounded-xl font-black text-sm bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors gv-lift">
          {t('caucus_end')}
        </button>
      )}
    </div>
  );
}

// ── Unmoderated Caucus View ───────────────────────────────────────────────────
function UnmoderatedCaucusView({ committee, setCommittee, isViewOnly = false, gavelCue }: { committee: Committee; setCommittee: CommitteeSetter; isViewOnly?: boolean; gavelCue?: GavelCue }) {
  const t = useT();
  const { language } = useLanguage();
  const unmoderatedName = language === 'ar' ? 'حوار حر' : language === 'fr' ? 'Caucus non modéré' : language === 'es' ? 'Cáucus No Moderado' : 'Unmoderated Caucus';
  // Resume the countdown on mount when the stored caucus carries a live anchor — i.e. the
  // clock was running when this chair refreshed or rejoined (H2). Lazy initial state, so it
  // reads the anchor before the chair-level resolver effect consumes it. No anchor (paused
  // clock, or a pre-anchor caucus) → false, exactly the old behaviour.
  const [running, setRunning] = useState(() => !isViewOnly && !!committee.caucus?.totalStartedAt);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;
  // The LIVE remaining seconds, re-derived from the anchor on every tick — never a local
  // decrement. `caucus.remainingTime` is only the value AT `caucus.totalStartedAt`; treating
  // it as a live counter here is what let this clock part company with the delegate board
  // (measured: chair frozen at 9:27 while delegates and the DB read 8:07) with nothing to
  // pull the two back together.
  const [liveTotal, setLiveTotal] = useState(() => caucusRemainingNow(caucus));
  const [showExtendUnmod, setShowExtendUnmod] = useState(false);
  const [extendMinsUnmod, setExtendMinsUnmod] = useState(5);

  // CoW standalone timer — behaves like Right of Reply: own state, own interval, no DB writes
  const { getSettings } = useSettingsStore();
  const cowSettings = getSettings(committee.code);
  const cowEnabled = caucus.isConsultation === true && cowSettings.cowTimerEnabled === true;
  const cowDefaultSecs = cowSettings.cowTimerSeconds || 60;
  const [cowOpen, setCowOpen] = useState(false);
  const [cowActive, setCowActive] = useState(false);
  const [cowRemaining, setCowRemaining] = useState(cowDefaultSecs);
  // The duration the CoW timer was last set to (preset or custom). Used as the progress-bar
  // denominator so the bar reads correctly for any value, not only the default.
  const [cowSetSecs, setCowSetSecs] = useState(cowDefaultSecs);
  const [cowCustom, setCowCustom] = useState('');
  const cowIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cowActive) {
      cowIntervalRef.current = setInterval(() => {
        setCowRemaining((prev) => {
          if (prev <= 1) { setCowActive(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (cowIntervalRef.current) { clearInterval(cowIntervalRef.current); cowIntervalRef.current = null; }
    }
    return () => { if (cowIntervalRef.current) { clearInterval(cowIntervalRef.current); cowIntervalRef.current = null; } };
  }, [cowActive]);
  // Gavel knock for the CoW timer: a read-only side effect of its own state (RULES 3 and 4).
  useGavelCue(cowRemaining, cowActive, gavelCue, cowSetSecs);

  // CoW open-floor speaker tracking — set who holds the floor by tapping a flag.
  // Database clock (T-1), and the start doubles as the turn key: one log per floor holder
  // even if a tap and End Caucus race (src/lib/floorSpeech.ts).
  //
  // The floor holder's start is PERSISTED as `caucus.floorSince` (written with the tap), so a
  // reload or a gavel handover keeps the real start instead of restarting the holder's time
  // at mount. A caucus from before that field falls back to the last CoW speech logged in
  // this caucus (a tap logs the previous holder at the instant the floor changed hands), and
  // only then to this device's mount time.
  const cowSpeakerStartRef = useRef<number | null>(null);
  const [cowMountedAt] = useState(() => serverNow());
  const cowFloorStart = (): number => {
    const persisted = caucus.floorSince ? new Date(caucus.floorSince).getTime() : NaN;
    if (Number.isFinite(persisted)) return persisted;
    if (cowSpeakerStartRef.current !== null) return cowSpeakerStartRef.current;
    let last = NaN;
    for (const m of committee.messages ?? []) {
      if (m.sender !== '__system__' || m.recipient !== '__log__' || !m.content.includes('|cow:')) continue;
      try {
        const e = JSON.parse(m.content.slice('__log__:'.length)) as { type?: string; context?: string; topic?: string; timestamp?: string };
        if (e.type !== 'speech' || e.context !== 'unmoderated-caucus' || e.topic !== (caucus.purpose ?? committee.topic)) continue;
        const at = e.timestamp ? new Date(e.timestamp).getTime() : NaN;
        if (Number.isFinite(at) && !(at <= last)) last = at;
      } catch { /* not a log row */ }
    }
    return Number.isFinite(last) ? last : cowMountedAt;
  };
  const handleCowTap = (countryName: string) => {
    const prev = caucus.currentSpeaker;
    if (prev === countryName) return;
    const now = serverNow();
    if (prev) {
      const since = cowFloorStart();
      const secs = Math.max(0, Math.round((now - since) / 1000));
      void logTimedSpeech(committee, { country: prev, seconds: secs, context: 'unmoderated-caucus', topic: caucus.purpose ?? committee.topic, turnKey: cowTurnKey(committee.id, prev, since) });
    }
    cowSpeakerStartRef.current = now;
    const spoken = prev && !(caucus.spokenCountries ?? []).includes(prev)
      ? [...(caucus.spokenCountries ?? []), prev]
      : (caucus.spokenCountries ?? []);
    const updated = { ...caucus, currentSpeaker: countryName, spokenCountries: spoken, floorSince: new Date(now).toISOString() };
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: updated } : c), true);
    updateCaucusInDB(committee.id, updated, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (cowEnabled) { setCowRemaining(cowDefaultSecs); setCowActive(true); }
  };

  // Pure READER (RULE 3 / RULE 4): re-derives from the persisted anchor and touches nothing
  // but its own state — no setCommittee, no updateLocal, no localUpdateTime. The interval is
  // a repaint trigger, not the clock, so a throttled or blocked tab loses repaints rather
  // than seconds and lands on the right number as soon as it runs again.
  const unmodAnchor = committee.caucus?.totalStartedAt ?? null;
  const unmodBase = committee.caucus?.remainingTime ?? null;
  useEffect(() => {
    const read = () => caucusRemainingNow(
      unmodBase === null ? null : ({ remainingTime: unmodBase, totalStartedAt: unmodAnchor } as CaucusState),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the anchor just changed (a press on any chair device, via realtime); the clock must re-derive from it at once, not a second later on the first tick.
    setLiveTotal(read());
    if (!unmodAnchor) return;   // null anchor IS the paused signal
    const tick = () => {
      const next = read();
      setLiveTotal(next);
      if (next <= 0) setRunning(false);
    };
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [unmodAnchor, unmodBase]);

  // Keep the button in step with the persisted anchor, so a Commenter pressing play/pause (or
  // this chair reloading) is reflected here rather than leaving a PAUSE label over a stopped
  // clock.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- `running` is also flipped locally by the press itself (before the write echoes), so it cannot simply be derived from the anchor during render.
  useEffect(() => { setRunning(!isViewOnly && !!unmodAnchor); }, [unmodAnchor, isViewOnly]);

  // ── H2 — ANCHOR the total clock ────────────────────────────────────────────
  // Nothing writes remainingTime per second (that is the H1 bug), so on its own the value
  // in the DB is frozen at whatever it was when the caucus started: delegates and advisors
  // rendered a dead clock for the whole caucus, and a chair refresh restored the FULL
  // original time. Instead we persist a start timestamp once per play/pause and let every
  // device compute `remaining = remainingTime - (now - totalStartedAt)` locally. Same
  // proven shape as current_speaker.started_at.
  //
  // ONE write per press. Not structural — no localUpdateTime (RULE 4): arming the debounce
  // here would blind the chair to speakers_list events for 3s. It does not need to be:
  // the write IS the clock now, so there is no local-only value for an echo to clobber.
  const handleToggleUnmodClock = () => {
    const nowRunning = !running;
    setRunning(nowRunning);
    if (!committee.caucus) return;
    const anchored = anchorCaucusClock(committee.caucus, caucusRemainingNow(committee.caucus), nowRunning);   // live, read at the press
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), false);
    updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  // Extending RE-ANCHORS: the added seconds go onto the live remaining, and the anchor is
  // restamped to now so the elapsed time already burnt is not charged twice.
  const handleExtendUnmod = (addSecs: number) => {
    if (addSecs <= 0 || !committee.caucus) return;
    // caucusRemainingNow is the LIVE derived value, so the elapsed time is already subtracted:
    // never use committee.caucus.remainingTime here, which is the value at the anchor and
    // would hand back every second the caucus had already burnt.
    const extended = { ...committee.caucus, totalTime: committee.caucus.totalTime + addSecs };
    const anchored = anchorCaucusClock(extended, caucusRemainingNow(committee.caucus) + addSecs, running);
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), true);
    updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setShowExtendUnmod(false);
  };

  const handleEndCaucus = () => {
    setRunning(false);
    // Consultation of the Whole: whoever held the floor when the caucus ended spoke too.
    // Only a flag tap used to log, so the last holder's time was dropped. Same clock
    // handleCowTap uses (time since the floor last changed on this device).
    if (caucus.isConsultation && caucus.currentSpeaker) {
      const since = cowFloorStart();
      const secs = Math.max(0, Math.round((serverNow() - since) / 1000));
      void logTimedSpeech(committee, { country: caucus.currentSpeaker, seconds: secs, context: 'unmoderated-caucus', topic: caucus.purpose ?? committee.topic, turnKey: cowTurnKey(committee.id, caucus.currentSpeaker, since) });
    }
    // H4 — clear the current_speaker DB ROW, not just local state. getCommitteeByCode loads
    // current_speaker unconditionally, so a stale row resurrects the caucus speaker as the
    // GSL current speaker on the next refresh — someone who was never on the GSL — and the
    // next "Next" logs speaking time for them all over again. Conditional + serialised
    // against nextSpeaker(), so it is not the blind clear MUST NEVER HAPPEN #5 forbids.
    if (committee.currentSpeaker) {
      clearCurrentSpeakerIfUnchanged(
        committee.id, committee.currentSpeaker.delegateId, committee.currentSpeaker.country,
        committee.code, committee.dbChairJoinSuffix ?? undefined,
      );
    }
    // Phase and caucus in ONE update (R-7): no reader sees the GSL with a caucus clock.
    setPhaseAndCaucusInDB(committee.id, 'speakers-list', null, committee.code, committee.dbChairJoinSuffix ?? undefined);
    updateLocal(setCommittee, (c) => {
      // Ending a caucus never touches the GSL — the speakers list is returned exactly as it
      // was before the caucus. (Previously prepended currentSpeaker into the GSL; harmless in
      // an unmoderated caucus, which has no currentSpeaker, but removed so a future refactor
      // cannot resurrect the GSL/caucus-mixing bug.)
      return {
        ...c,
        caucus: null,
        phase: 'speakers-list' as const,
        caucusQueue: [],
        currentSpeaker: null,
        speakersList: c.speakersList,
        speakerTimeRemaining: c.speakerTimeLimit,
      };
    }, true);
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 py-12">
      {/* Absolute overlay: motion name + topic — does not affect centred layout */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 max-w-[200px] ps-4 pointer-events-none select-none">
        <span className="text-[#1C1410] font-black text-2xl leading-tight uppercase">
          {caucus.motionLabel ?? unmoderatedName}
        </span>
        {caucus.purpose && (
          <span className="text-[#1C1410]/70 text-lg font-medium leading-snug">
            {caucus.purpose}
          </span>
        )}
      </div>
      {/* liveTotal, not caucus.remainingTime — the stored field is the value at the anchor,
          so rendering it raw is a clock that only moves when the chair writes. */}
      <div className={`floor-emblem-anchor text-9xl font-black font-mono tabular-nums mb-8 ${liveTotal <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>
        {formatTime(liveTotal)}
      </div>
      <div className="w-full max-w-sm h-2 bg-[#DDD4C0] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-[#B6871F] rounded-full transition-all" style={{ width: `${caucus.totalTime > 0 ? (liveTotal / caucus.totalTime) * 100 : 0}%` }} />
      </div>
      {/* Consultation of the Whole — live open-floor delegation board (tap to set speaker; Commenters too) */}
      {caucus.isConsultation && (
        <div className="w-full max-w-xl mb-6">
          <CowDelegationBoard committee={committee} onTap={handleCowTap} />
        </div>
      )}
      {!isViewOnly && <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={handleToggleUnmodClock} className={`gv-lift flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none ${running ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}>
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <span className="flex gap-[3px] items-center">
                <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
                <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
              </span>
              <span>{t('gsl_pause')}</span>
            </span>
          ) : t('gsl_start')}
        </button>
        <button onClick={() => setShowExtendUnmod((v) => !v)} className="px-4 py-3 rounded-xl font-bold bg-[#1B3828] hover:bg-[#2A5A3C] text-[#EDE7D8] transition-colors focus:outline-none gv-lift">
          {t('caucus_extend')}
        </button>
        {cowEnabled && (
          <button onClick={() => { setCowOpen((v) => !v); }} className="px-4 py-3 rounded-xl font-bold bg-[#B8844A]/15 hover:bg-[#B8844A]/25 border border-[#B8844A]/30 text-[#B8844A] transition-colors focus:outline-none gv-lift">
            {t('cow_timer')}
          </button>
        )}
        <button onClick={handleEndCaucus} className="px-8 py-3 rounded-xl font-black bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors focus:outline-none gv-lift">
          {t('caucus_end')}
        </button>
      </div>}
      {/* CoW standalone timer overlay — fixed, independent of the caucus countdown, no DB writes */}
      {cowEnabled && cowOpen && !isViewOnly && (
        <div className="fixed z-50" style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}>
          <div className="bg-[#EDE7D8] border border-[#B8844A]/30 rounded-xl p-4 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#B8844A' }}>{t('cow_timer')}</span>
              <button onClick={() => { setCowOpen(false); setCowActive(false); }} className="text-[#1C1410] hover:text-[#8B2020] text-sm font-bold">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              {[30, 60, 90].map((s) => (
                <button key={s} onClick={() => { setCowActive(false); setCowRemaining(s); setCowSetSecs(s); }}
                  className={`gv-lift flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors border ${
                    cowRemaining === s && !cowActive ? 'bg-[#B8844A] border-[#B8844A] text-[#1C1410]' : 'bg-[#EDE7D8] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#B8844A]/50'
                  }`}>
                  {s}s
                </button>
              ))}
            </div>
            {/* Custom seconds — set the CoW timer to any value, alongside the presets */}
            <div className="flex gap-2 mb-3">
              <input
                type="number" min={1}
                value={cowCustom}
                onChange={(e) => setCowCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const s = parseInt(cowCustom, 10); if (s > 0) { setCowActive(false); setCowRemaining(s); setCowSetSecs(s); setCowCustom(''); } } }}
                placeholder={String(cowDefaultSecs)}
                className="flex-1 min-w-0 bg-[#EDE7D8] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-xs text-center text-[#1C1410] focus:outline-none focus:border-[#B8844A]"
              />
              <span className="text-xs font-black self-center shrink-0" style={{ color: '#6A5A4A' }}>s</span>
              <button
                onClick={() => { const s = parseInt(cowCustom, 10); if (s > 0) { setCowActive(false); setCowRemaining(s); setCowSetSecs(s); setCowCustom(''); } }}
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide bg-[#B8844A] hover:bg-[#B8844A]/80 text-[#1C1410] transition-colors focus:outline-none shrink-0 gv-lift"
                aria-label={t('cow_timer_set_custom')}
              >
                ✓
              </button>
            </div>
            <div className={`text-5xl font-black font-mono text-center mb-3 tabular-nums ${
              cowRemaining <= 5 ? 'text-red-500' : cowRemaining <= 10 ? 'text-[#B6871F]' : 'text-[#B8844A]'
            }`}>
              {Math.floor(cowRemaining / 60)}:{String(cowRemaining % 60).padStart(2, '0')}
            </div>
            <div className="w-full h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${cowRemaining / cowSetSecs > 0.5 ? 'bg-[#B8844A]' : cowRemaining / cowSetSecs > 0.2 ? 'bg-[#B6871F]' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, (cowRemaining / cowSetSecs) * 100)}%` }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCowActive((r) => !r)}
                className={`gv-lift flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${cowActive ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}>
                {cowActive ? t('rtr_pause') : t('rtr_start')}
              </button>
              <button onClick={() => { setCowActive(false); setCowRemaining(cowDefaultSecs); setCowSetSecs(cowDefaultSecs); setCowCustom(''); }}
                className="px-3 py-2 rounded-lg font-bold text-xs bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#6A5A4A] transition-colors gv-lift">
                ↺
              </button>
            </div>
          </div>
        </div>
      )}
      {showExtendUnmod && (
        <div className="mt-4 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 shadow-xl" style={{ minWidth: '180px' }}>
          <div className="flex gap-1.5 mb-2 justify-center">
            {(() => {
              const halfMins = caucus.totalTime / 120;
              const rawSuggestions = [5, 10, halfMins];
              const suggestions = [...new Set(
                rawSuggestions
                  .filter((m) => m > 0)
                  .map((m) => Math.round(m * 2) / 2)
              )].sort((a, b) => a - b);
              return suggestions.map((m) => (
                <button key={m} onClick={() => handleExtendUnmod(m * 60)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-transparent border border-[#DDD4C0] text-[#1B3828] hover:border-[#1B3828] transition-colors focus:outline-none">
                  {m % 1 === 0 ? `${m}m` : `${m}m`}
                </button>
              ));
            })()}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="number" min={1} value={extendMinsUnmod === 0 ? '' : extendMinsUnmod} onChange={(e) => setExtendMinsUnmod(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
              className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-[#1C1410] text-xs text-center focus:outline-none focus:border-[#1B3828]" />
            <span className="text-xs text-[#9A8A78] shrink-0">m</span>
          </div>
          <button onClick={() => handleExtendUnmod(extendMinsUnmod * 60)}
            className="w-full py-1.5 rounded-lg text-xs font-black bg-[#1B3828] hover:bg-[#2A5A3C] text-[#EDE7D8] transition-colors focus:outline-none gv-lift">
            {t('gsl_add_time_extended')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Moderated Caucus Main ─────────────────────────────────────────────────────
function ModeratedCaucusMain({
  committee, setCommittee,
  speakerTimeRemaining, timerRunning, caucusSeconds,
  openPopovers, setPopover, extraTimeAdded,
  handleToggleTimer, handleRestartTime, handleNextCaucusSpeaker, handleEndCaucus, handleStartOnDeck,
  sessionEnded, isViewOnly = false, onRecognise, commenterLock = null, onRemoveFloorSpeaker,
}: {
  committee: Committee; setCommittee: CommitteeSetter;
  /** Take the delegation holding the caucus floor off it (the page's
   *  `handleRemoveCurrentSpeaker`: pause at the live value, log the speech, conditional clear,
   *  the total re-anchored paused with nobody on its floor). Omitted = no removal here. */
  onRemoveFloorSpeaker?: () => void;
  /** A real Commenter: the Moderator's controls drawn disabled, a press raises the notice. */
  commenterLock?: ControlLock | null;
  /** Start with a delegation on deck: seat the head of the queue AND start both clocks in one
   *  press (the page's `handleStartCaucusOnDeck`). */
  handleStartOnDeck: () => Promise<void>;
  /** Marks an absent delegate Present before the typed bar queues them (see AddSpeakerInput). */
  onRecognise?: (id: string) => void;
  /** Live seconds on the TOTAL caucus clock, derived from the anchor by the page. */
  caucusSeconds: number;
  speakerTimeRemaining: number; timerRunning: boolean;
  /** Add time and Right of Reply are independent: both may be open at once. */
  openPopovers: FloorPopovers;
  setPopover: (which: FloorPopover, open: boolean | 'toggle') => void;
  extraTimeAdded: boolean;
  handleToggleTimer: () => void;
  handleRestartTime: () => void;
  handleNextCaucusSpeaker: () => Promise<void>;
  handleEndCaucus: () => void;
  sessionEnded: boolean;
  isViewOnly?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const caucus = committee.caucus!;
  const queue = committee.caucusQueue ?? [];
  const speakerTime = caucus.speakingTime;
  const isTdT = caucus.purpose?.startsWith('Tour de Table') ?? false;
  const isRoomOrderTdT = isTdT && (caucus.purpose?.includes('Room Order') ?? false);
  const caucusTitle = isTdT ? (language === 'ar' ? 'جولة المتحدثين' : 'TOUR DE TABLE') : (language === 'ar' ? 'حوار منهجي' : language === 'fr' ? 'CAUCUS MODÉRÉ' : language === 'es' ? 'CÁUCUS MODERADO' : 'MODERATED CAUCUS');
  const spokenCountries = caucus.spokenCountries ?? [];

  // Extend-time UI state
  const [showExtendMod, setShowExtendMod] = useState(false);
  const [extendMinsMod, setExtendMinsMod] = useState<number>(1);
  const extendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExtendMod) return;
    const handler = (e: MouseEvent) => {
      if (extendRef.current && !extendRef.current.contains(e.target as Node)) setShowExtendMod(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExtendMod]);

  // The total clock is `caucusSeconds`, derived from the anchor by the page and passed in.
  // This component used to keep a THIRD copy of it (`liveRemaining`), decremented by the
  // per-tick delta of the speaker atom — so the chair's own two clocks could disagree with
  // each other as well as with the delegates. One derivation, one number, everywhere.
  const liveRemaining = caucusSeconds;

  // Extending RE-ANCHORS the total clock (H2). `caucusSeconds` is the LIVE derived value, so
  // the elapsed time is already subtracted — never use `caucus.remainingTime` here, which is
  // the value at the anchor and would refund every second the caucus had already burnt. In a
  // moderated caucus the total clock only advances while the speaker timer runs, so the
  // anchor is armed iff timerRunning: the two stay in lockstep.
  const handleExtendMod = (addSecs: number) => {
    if (addSecs <= 0 || !committee.caucus) return;
    const extended = { ...committee.caucus, totalTime: committee.caucus.totalTime + addSecs };
    const anchored = anchorCaucusClock(extended, caucusSeconds + addSecs, timerRunning);
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), true);
    updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setShowExtendMod(false);
  };

  // Capacity: one more delegate fits whenever ANY time is left beyond what the current
  // speaker and the queue already commit (caucusQueueCapacity). The old
  // floor(remaining / speakingTime) ignored the queue and said "full" with time left.
  const maxByTime = caucusQueueCapacity(
    liveRemaining, speakerTime, queue.length,
    committee.currentSpeaker ? speakerTimeRemaining : 0,
  );
  const totalProgress = caucus.totalTime > 0 ? (liveRemaining / caucus.totalTime) * 100 : 0;
  const caucusProgress = speakerTime > 0 ? (speakerTimeRemaining / speakerTime) * 100 : 0;

  const handleCaucusAddToQueue = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (committee.caucus?.currentSpeaker === delegate.country) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
    // Position is assigned by the database (max + 1 under a lock). Never `queue.length + 1`:
    // after a Next or a removal that collides with an existing row and the queue reshuffles.
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'end');
  };

  const handleCaucusAddFirst = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const newList = [{ delegateId, country: delegate.country }, ...queue];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    // One write: min - 1 under the list lock. The old insert-at-0 plus a separate
    // fire-and-forget reorder could land in either order.
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'start');
  };

  const handleCaucusAddLast = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const newList = [...queue, { delegateId, country: delegate.country }];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'end');
  };

  const handleCaucusRemoveFromQueue = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
    removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  const handleCaucusReorderQueue = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, committee.code, committee.dbChairJoinSuffix ?? undefined, 'caucus');
  };

  // One row of speaker buttons for both branches (speaker on the floor or not), so the
  // controls never vanish when the floor empties. Next with nobody on the floor calls the
  // first delegate in the queue (handleNextCaucusSpeaker already does exactly that).
  const caucusHasSpeaker = !!committee.caucus?.currentSpeaker;
  // ON DECK (owner, 17 Sep 2026: "there is always a delegate in the middle"). With nobody
  // seated, the head of the queue is drawn on the floor exactly like the GSL's on deck:
  // nothing is written, they stay an ordinary caucus queue row (movable, removable, counted
  // by the capacity check), no clock starts and no speech is logged. Start seats them and
  // starts the clock in one press. So a removed or absent floor speaker is replaced in the
  // middle by the next delegation at once, and the empty hint shows only for an empty queue.
  const onDeck = !caucusHasSpeaker ? (queue[0] ?? null) : null;
  const floorCountry = committee.caucus?.currentSpeaker ?? onDeck?.country ?? null;
  // The seated caucus speaker as a strip entry. `caucus.currentSpeaker` is a country STRING,
  // so the delegate row is looked up by country; a Room Order placeholder ("Speaker 3") matches
  // nothing, which is exactly right — it is not a delegation.
  const caucusFloorEntry = (() => {
    const country = committee.caucus?.currentSpeaker;
    if (!country || isRoomOrderTdT) return null;
    const d = committee.delegates.find((x) => x.country === country);
    return d ? { delegateId: d.id, country } : null;
  })();
  // #1 is the floor holder, then the queue. Deduped, because a stale realtime row could leave
  // the seated delegation in the queue for a moment and two chips with one id break the drag.
  const caucusStripList = caucusFloorEntry
    ? [caucusFloorEntry, ...queue.filter((s) => s.delegateId !== caucusFloorEntry.delegateId)]
    : queue;
  // The slot Start will give them: the speaking time, capped to what the caucus has left.
  const onDeckSlot = capSpeakerSlot(speakerTime, liveRemaining);
  const toggleRtr = () => setPopover('rightToReply', 'toggle');
  // The mode marker above the flags: a bare icon and the motion's name (owner, 16 Sep 2026),
  // then " - <topic>" in regular weight on the same line (owner, 17 Sep 2026). A Tour de
  // Table's purpose is an internal marker ("Tour de Table (A→Z)"), never a topic, so it is
  // not shown.
  const caucusTopic = !isTdT ? (caucus.purpose ?? '').trim() : '';
  const caucusStripHeader: StripHeader = {
    icon: <Users size={18} strokeWidth={2.4} aria-hidden />,
    label: committee.caucus?.motionLabel ?? caucusTitle,
    detail: caucusTopic || null,
  };
  // Not drawn for a Commenter (see gslControls): the dock leaves no room for the row.
  const caucusControls = !sessionEnded && !isViewOnly ? (
    <SpeakerControls
      hasSpeaker={caucusHasSpeaker}
      floorReady={caucusHasSpeaker || !!onDeck}
      timerRunning={timerRunning}
      onToggleTimer={caucusHasSpeaker ? handleToggleTimer : () => { void handleStartOnDeck(); }}
      onRestart={handleRestartTime}
      next={{
        // Never "Call first speaker" (owner, 16 Sep 2026). On deck, Start gives them the
        // floor, so Next is unavailable and says so (the GSL's rule): it never skips them.
        label: t('gsl_next'),
        title: t('speaker_ctl_next_title'),
        blockedReason: onDeck
          ? t('speaker_ctl_on_deck_start').replace('{country}', getCountryDisplayName(onDeck.country, language))
          : queue.length === 0 ? t('speaker_ctl_queue_empty') : null,
        onClick: () => { void handleNextCaucusSpeaker(); },
      }}
      onAddTime={() => setPopover('extraTime', 'toggle')}
      addTimeActive={openPopovers.extraTime}
      onRightOfReply={isTdT || caucusHasSpeaker || onDeck ? undefined : toggleRtr}
      rightOfReplyActive={openPopovers.rightToReply}
    />
  ) : null;

  // A Commenter reads the caucus floor the same way as the GSL: the delegation on the floor
  // big on the inline-start side, the queue beside it (owner, 17 Sep 2026). The total-time bar
  // below is unchanged, so they still see how much of the caucus is left.
  const roomOrderNumber = isRoomOrderTdT && floorCountry ? (floorCountry.match(/(\d+)$/)?.[1] ?? '1') : null;
  if (isViewOnly) {
    return (
      <>
        <CommenterFloor
          header={caucusStripHeader}
          floorCountry={floorCountry}
          floorNumber={roomOrderNumber}
          floorLabel={floorCountry ? (caucusHasSpeaker ? t('view_is_speaking') : t('gsl_on_deck')) : null}
          upcoming={queue.filter((s) => s.delegateId !== onDeck?.delegateId && s.country !== committee.caucus?.currentSpeaker)}
          formatName={(c) => (isRoomOrderTdT ? c : getCountryDisplayName(c, language))}
          onLockedAttempt={commenterLock?.onAttempt}
          emptyHint={<p className="text-center text-sm font-semibold" style={{ color: '#6A5A4A' }}>{t('gsl_no_speakers_queued')}</p>}
        />
        {!sessionEnded && !isTdT && (
          // How much of the caucus is left, nothing else: Extend, End and the add bar are the
          // Moderator's and a disabled copy of each only takes room from the comment dock.
          <div className="shrink-0 border-t border-[#DDD4C0] px-6 py-2 flex items-center gap-3" style={{ backgroundColor: '#F6F1E9' }}>
            <span className="text-xs text-[#9A8A78] font-mono shrink-0">{t('gsl_total')}</span>
            <p className={`text-lg font-black font-mono shrink-0 ${liveRemaining <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>{formatTime(liveRemaining)}</p>
            <div className="flex-1 h-2 bg-[#DDD4C0] rounded-full overflow-hidden">
              <div className="h-full bg-[#B6871F]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {floorCountry ? (
        <>
          {/* ZONE 1 — mode marker + queue locked at top.
              The delegation HOLDING the caucus floor is drawn at #1 here (17 Sep 2026, owner:
              "move the current speaker away even if they have already started their speech").
              Before this the caucus strip showed the queue only, so the only way off the floor
              was their sidebar row — unreachable with the sidebar collapsed or the Roll Call
              tab open, and invisible mid-speech. This is NOT an X beside the caucus speaker's
              name (owner, 15 Sep 2026, still respected): it is the same #1 chip, gold ring and
              always-visible X the GSL already has. Room Order tours are excluded — their
              "Speaker N" placeholders are not delegations and the strip numbers from 2. */}
          <div className="shrink-0">
            <DraggableSpeakersQueue
              list={caucusStripList}
              header={caucusStripHeader}
              currentSpeakerDelegateId={caucusFloorEntry?.delegateId ?? null}
              onDeckDelegateId={onDeck?.delegateId ?? null}
              // The floor holder is not a queue row: strip them back out before the write, the
              // same way the GSL does, or the reorder would insert them into `caucusQueue`.
              onReorder={isViewOnly ? undefined
                : (newList) => handleCaucusReorderQueue(newList.filter((s) => s.delegateId !== caucusFloorEntry?.delegateId))}
              onRemove={isViewOnly ? undefined : handleCaucusRemoveFromQueue}
              onRemoveCurrent={isViewOnly || sessionEnded || !caucusFloorEntry || !onRemoveFloorSpeaker ? undefined : onRemoveFloorSpeaker}
              isRoomOrderTdT={isRoomOrderTdT}
              onLockedAttempt={commenterLock?.onAttempt}
            />
          </div>
          {/* ZONE 2 — Flag + name + timer + progress: compresses as viewport shrinks */}
          <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2">
            {isRoomOrderTdT ? (
              <div className="floor-emblem-anchor relative rounded-full bg-[#DDD4C0] shrink-0 flex items-center justify-center" style={{ width: FLOOR_DISC_PX, height: FLOOR_DISC_PX }}>
                <span className="font-black" style={{ color: '#1B3828', fontSize: '4.5rem' }}>{(() => {
                  const match = floorCountry.match(/(\d+)$/);
                  return match ? match[1] : '1';
                })()}</span>
              </div>
            ) : (
              <SeatCircleFlag
                country={floorCountry}
                size={FLOOR_FLAG_PX}
                decorative
                loading="eager"
                className="floor-emblem-anchor"
                style={{ boxShadow: FLOOR_FLAG_SHADOW }}
              />
            )}
            {/* No X beside the caucus speaker's name (owner, 15 Sep 2026): taking a delegation
                off the caucus floor stays on its sidebar row. */}
            <h1 className="font-black text-[#1C1410] text-center" style={{ fontSize: FLOOR_NAME_REM, margin: '8px 0' }}>
              {getCountryDisplayName(floorCountry, language)}
            </h1>
            {onDeck && (
              <p className="text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#8A6A1F', marginTop: -4 }}>{t('gsl_on_deck')}</p>
            )}
            <SpeakerClock
              running={caucusHasSpeaker && timerRunning}
              locked={commenterLock}
              onToggle={!sessionEnded && !isViewOnly
                ? (caucusHasSpeaker ? handleToggleTimer : () => { void handleStartOnDeck(); })
                : undefined}
              className={`font-black font-mono tabular-nums ${caucusHasSpeaker && speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'}`}
              style={{ fontSize: '5rem', margin: '4px 0', lineHeight: 1.15 }}
            >
              {/* On deck nothing is seated: show the slot Start will give them. */}
              {formatTime(caucusHasSpeaker ? speakerTimeRemaining : onDeckSlot)}
              {caucusHasSpeaker && extraTimeAdded && <span className="text-base ms-2 font-normal text-[#1C1410]">{t('gsl_plus_time')}</span>}
            </SpeakerClock>
            <FloorProgress
              percent={caucusHasSpeaker ? caucusProgress : 100}
              barClassName={!caucusHasSpeaker || caucusProgress > 20 ? 'bg-[#B6871F]' : 'bg-red-500'}
              rtr={!sessionEnded && (!isViewOnly || commenterLock) && !isTdT ? { onClick: toggleRtr, active: openPopovers.rightToReply, locked: commenterLock } : null}
            />
          </div>
          {/* ZONE 3 — Action buttons locked just above bottom bar */}
          {caucusControls}
        </>
      ) : (
        /* Nobody seated AND nobody queued (on deck covers every other case). */
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-3 overflow-hidden">
          <div className="shrink-0 w-full">
            <DraggableSpeakersQueue list={[]} header={caucusStripHeader} isRoomOrderTdT={isRoomOrderTdT} />
          </div>
          {/* The shouty "No Current Speaker" heading is gone (owner, 16 Sep 2026); the marker
              above already says where the room is, so this is just the next step to take. */}
          <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
            {!isViewOnly && <p className="text-center text-sm font-semibold" style={{ color: '#6A5A4A' }}>{t('gsl_add_call_first')}</p>}
          </div>
          {/* The speaker buttons stay in place with nobody on the floor: Next calls the
              first delegate in the queue, the rest say why they are waiting. */}
          {caucusControls}
        </div>
      )}

      {!sessionEnded && (
        // Same full-width treatment as the GSL add bar (FloorBarExtent). Not for a Commenter:
        // their comment dock sits under this bar, so it is not flush with the page bottom.
        <FloorBarExtent active={!isViewOnly} className="border-t border-[#DDD4C0] px-6 py-2" style={{ backgroundColor: '#F6F1E9' }}>
          {/* Total timer bar — hidden for Tour de Table */}
          {!isTdT && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-[#9A8A78] font-mono shrink-0">{t('gsl_total')}</span>
              <p className={`text-lg font-black font-mono shrink-0 ${liveRemaining <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>{formatTime(liveRemaining)}</p>
              <div className="flex-1 h-2 bg-[#DDD4C0] rounded-full overflow-hidden">
                <div className="h-full bg-[#B6871F]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
              </div>
              {!isViewOnly && <div className="relative" ref={extendRef}>
                <button onClick={() => setShowExtendMod((v) => !v)}
                  className="px-3 py-2 rounded-lg font-bold text-xs bg-[#1B3828] hover:bg-[#2A5A3C] text-[#EDE7D8] transition-colors focus:outline-none gv-lift">
                  {t('caucus_extend')}
                </button>
                {showExtendMod && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 shadow-xl z-20" style={{ minWidth: '180px' }}>
                    <div className="flex gap-1.5 mb-2 justify-center">
                      {(() => {
                        const halfMins = caucus.totalTime / 120;
                        const rawSuggestions = [5, 10, halfMins];
                        const suggestions = [...new Set(
                          rawSuggestions
                            .filter((m) => m > 0)
                            .map((m) => Math.round(m * 2) / 2)
                        )].sort((a, b) => a - b);
                        return suggestions.map((m) => (
                          <button key={m} onClick={() => handleExtendMod(m * 60)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-transparent border border-[#DDD4C0] text-[#1B3828] hover:border-[#1B3828] transition-colors focus:outline-none">
                            {m % 1 === 0 ? `${m}m` : `${m}m`}
                          </button>
                        ));
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="number" min={1} value={extendMinsMod === 0 ? '' : extendMinsMod} onChange={(e) => setExtendMinsMod(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                        className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-[#1C1410] text-xs text-center focus:outline-none focus:border-[#1B3828]" />
                      <span className="text-xs text-[#9A8A78] shrink-0">m</span>
                    </div>
                    <button onClick={() => handleExtendMod(extendMinsMod * 60)}
                      className="w-full py-1.5 rounded-lg text-xs font-black bg-[#1B3828] hover:bg-[#2A5A3C] text-[#EDE7D8] transition-colors focus:outline-none gv-lift">
                      {t('gsl_add_time_extended')}
                    </button>
                  </div>
                )}
              </div>}
              {!isViewOnly && <button onClick={handleEndCaucus}
                className="px-8 py-3 rounded-lg font-black text-sm bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors gv-lift">
                {t('caucus_end')}
              </button>}
              {isViewOnly && commenterLock && (
                // A Commenter sees Extend and End disabled; a press explains the gavel.
                <>
                  <button type="button" aria-disabled title={commenterLock.reason} onClick={commenterLock.onAttempt}
                    className="px-3 py-2 rounded-lg font-bold text-xs bg-[#1B3828] text-[#EDE7D8] opacity-45 cursor-not-allowed focus:outline-none">
                    {t('caucus_extend')}
                  </button>
                  <button type="button" aria-disabled title={commenterLock.reason} onClick={commenterLock.onAttempt}
                    className="px-8 py-3 rounded-lg font-black text-sm bg-[#8B2020] text-white opacity-45 cursor-not-allowed focus:outline-none">
                    {t('caucus_end')}
                  </button>
                </>
              )}
            </div>
          )}
          {!isViewOnly && <CaucusAddSpeakerInput
            committee={committee}
            spokenCountries={spokenCountries}
            onAdd={handleCaucusAddToQueue}
            onAddFirst={handleCaucusAddFirst}
            onAddLast={handleCaucusAddLast}
            maxSpeakers={maxByTime}
            currentQueueLength={queue.length}
            currentSpeakerCountry={committee.currentSpeaker?.country ?? null}
            onEndCaucus={isTdT ? handleEndCaucus : undefined}
            onRecognise={onRecognise}
          />}
        </FloorBarExtent>
      )}
    </>
  );
}

// ── Session Ended Content ─────────────────────────────────────────────────────
// ── Awards signpost (conference-linked sessions ONLY) ─────────────────────────
// Awards are a CONFERENCE feature: the slate is decided on the chair's conference page
// and announced by the secretariat. The session never hosts award UI — it only points
// there, and only when `committee.sessionOrigin === 'conference'`. An anonymous
// standalone session must render NOTHING award-related (PRD hard gate), so every
// caller of this CTA checks the origin first. Both the Moderator and a Commenter may
// open it — it is deliberately NOT gated on isViewOnly.
//
// Rendered as a real anchor with a prefetched href (not a click-then-resolve
// `window.open`) so opening in a new tab never trips a popup blocker; until the
// lookup lands, or when the conference is private to anon, it points at the chair's
// conference hub, which lists every committee they chair.
function ChairAwardsCta({ code, label, className, style }: {
  code: string; label: string; className?: string; style?: React.CSSProperties;
}) {
  const [href, setHref] = useState('/my-conferences');
  useEffect(() => {
    let cancelled = false;
    resolveChairAwardsHref(code).then((h) => { if (!cancelled) setHref(h); });
    return () => { cancelled = true; };
  }, [code]);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {label}
    </a>
  );
}

function SessionEndedContent({ committee, hoursRemaining }: { committee: Committee; hoursRemaining: number | null }) {
  const { language } = useLanguage();
  const t = useT();
  const isConferenceSession = committee.sessionOrigin === 'conference';
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <h1 className="text-5xl font-black mb-4" style={{ color: '#1B3828' }}>{t('session_ended_title')}</h1>
      <p className="text-xl mb-2" style={{ color: '#1C1410' }}>{getCommitteeDisplayName(committee.name, language)}</p>
      <p className="text-lg mb-8" style={{ color: '#9A8A78' }}>{committee.topic}</p>
      {hoursRemaining !== null && (
        <p className="text-base" style={{ color: '#9A8A78' }}>{t('session_hours_until_delete', { n: hoursRemaining ?? 0, s: hoursRemaining !== 1 ? 's' : '' })}</p>
      )}
      {/* Conference-linked sessions only — see ChairAwardsCta. Standalone sessions get nothing here. */}
      {isConferenceSession && (
        <div className="mt-8 w-full max-w-md rounded-2xl px-6 py-5 text-start"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 6px 18px rgba(28,20,16,0.06)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B6871F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <span className="text-sm font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('chair_ended_awards_title')}</span>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#6A5A4A' }}>{t('chair_ended_awards_body')}</p>
          <ChairAwardsCta
            code={committee.code}
            label={t('chair_ended_awards_cta')}
            className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-black transition-colors focus:outline-none gv-lift-dark"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
          />
        </div>
      )}
      <p className="text-xs mt-8" style={{ color: '#9A8A78' }}>{t('session_adjourned_hint')}</p>
    </div>
  );
}

// ── Main Chair Session ────────────────────────────────────────────────────────
function ChairSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const t = useT();
  const { language } = useLanguage();
  const { code } = use(params);
  const router = useRouter();
  const { updateSetting, getSettings, hydrateSettings } = useSettingsStore();
  const searchParams = useSearchParams();
  // A chair's identity is ONLY ?chairName=. Some navigations back into the session drop it
  // (the voting page's "Back to Session" still does — see report), and an empty chairName
  // makes isViewOnly unreachable: this device then believes it holds the gavel forever.
  // Fall back to the rejoin blob we wrote for THIS committee before defaulting to ''.
  // Read in an effect, never during render — localStorage does not exist on the server.
  const urlChairName = searchParams.get('chairName') ?? '';
  const [rejoinChairName, setRejoinChairName] = useState('');
  useEffect(() => {
    if (urlChairName) { setRejoinChairName(''); return; }
    try {
      const raw = localStorage.getItem('gavelling-rejoin');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; chairName?: string };
      if (typeof parsed?.chairName !== 'string' || !parsed.chairName) return;
      if ((parsed.code ?? '').toUpperCase() !== code.toUpperCase()) return;
      setRejoinChairName(parsed.chairName);
    } catch { /* malformed blob — stay anonymous */ }
  }, [urlChairName, code]);
  const myChairName = urlChairName || rejoinChairName;
  const { user, session, loading: authLoading } = useAuth();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  // The initial room read failed (after its retries): an inline Retry, never "not found".
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Conference-session access guard (Phase 2 #8). Standalone sessions stay anonymous
  // ('allowed'); a conference session requires a signed-in user who is a chair of THIS
  // committee, so a crafted /chair/CODE url can't drop a non-chair into the chair view.
  // useSessionAccess: keyed on the user id (an hourly token refresh used to flash the
  // loader over the live room), keeps a settled page on screen during a re-check, and turns
  // a failed check into an inline retry instead of a verdict.
  const chairAccess = useSessionAccess({ code, gate: 'dais', allow: isChairAccessKind });
  const accessState = chairAccess.state === 'standalone' ? 'allowed' : chairAccess.state;

  // Committee emblem for the sidebar. The sessions `committees` table has no logo column,
  // so the artwork is resolved in this order:
  //   1. conference_committees.logo_url, then the CONFERENCE's logo_url: a conference-created
  //      session (session_origin = 'conference'). Both tables have an anon `true` SELECT
  //      policy ("Anyone can read ... by link"), so a chair who joined an open dais with the
  //      code, signed out, gets the artwork too. Standalone sessions never run the query.
  //   2. matchPresetEmblem(name): the committee's OWN emblem, derived from the name the
  //      chair typed ("UN Security Council" wears the real UN mark).
  //   3. null → CommitteeIdentityBadge's default, the UN emblem, then gold initials.
  const [committeeEmblem, setCommitteeEmblem] = useState<{ logoUrl: string | null; abbreviation: string | null }>({ logoUrl: null, abbreviation: null });
  const isConferenceRoom = committee?.sessionOrigin === 'conference';
  useEffect(() => {
    let cancelled = false;
    if (!isConferenceRoom) { setCommitteeEmblem({ logoUrl: null, abbreviation: null }); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('conference_committees')
          .select('logo_url, abbreviation, conferences(logo_url)')
          .eq('session_code', code.toUpperCase())
          .limit(1)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as unknown as {
          logo_url: string | null;
          abbreviation: string | null;
          conferences: { logo_url: string | null } | { logo_url: string | null }[] | null;
        };
        const conf = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
        setCommitteeEmblem({ logoUrl: row.logo_url || conf?.logo_url || null, abbreviation: row.abbreviation ?? null });
      } catch { /* no row or no read access: preset match, then the UN emblem */ }
    })();
    return () => { cancelled = true; };
  }, [code, isConferenceRoom]);
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  // Unexpired organiser broadcasts for THIS committee. Refetched on load and on every
  // `session_broadcasts` realtime event; the notification cards and the scheduled effects
  // are both derived from it, never from the realtime payload directly.
  const [broadcasts, setBroadcasts] = useState<SessionBroadcast[]>([]);
  const [suspendTab, setSuspendTab] = useState<'suspend' | 'session'>('suspend');
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRollCall, setShowRollCall] = useState(true);
  /**
   * Draggable roster-sidebar width. Starts at the historical w-[22rem] so the
   * server-rendered markup matches; the stored preference is adopted in an
   * effect below, because localStorage cannot be read during render.
   *
   * AGENTS.md RULE 3/4: this is its own isolated atom, exactly like
   * speakerTimeRemaining. It never enters the committee object, so it can
   * never call updateLocal and can never move `localUpdateTime`. The drag
   * itself does not even come through here — ChairSidebarShell paints the slot and
   * panel straight onto the DOM per frame and commits once on release.
   */
  // null = no stored preference: ChairSidebarShell then uses a proportion of the screen.
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  /** The sidebar folded to its floating flag column (per reader, localStorage). Same isolation as the width. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  const [showMotions, setShowMotions] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  /** A document introduction (order of proceedings or a timed stage) is on screen. It sits
   *  under the top bar, and the bar is lifted over it so its Gavel, code, Chat, Scoreboard
   *  and Settings keep working (17 Sep 2026). Set by DocumentsModal. */
  const [docIntroActive, setDocIntroActive] = useState(false);
  // Top bar in two rows when the tabs have no room beside the icon cluster (18 Sep 2026).
  // Refs + one measurement hook; nothing here runs per second.
  const topBarRef = useRef<HTMLElement | null>(null);
  const topBarNavRef = useRef<HTMLElement | null>(null);
  const topBarClusterRef = useRef<HTMLDivElement | null>(null);
  const topBarTwoRows = useTopBarTwoRows(topBarRef, topBarNavRef, topBarClusterRef, [
    language,
    committee && committee.phase !== 'pre-session' && !sessionEnded && !docIntroActive ? 'tabs' : 'none',
    (committee?.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length,
    (committee?.documents ?? []).filter((d) => d.status === 'submitted').length,
  ].join('|'));
  // The session-code presenter: the rect of the button it grows from, null = closed.
  const [codePresenterOrigin, setCodePresenterOrigin] = useState<DOMRect | null>(null);
  const closeCodePresenter = useCallback(() => setCodePresenterOrigin(null), []);
  const [speakerTimeLimit, setSpeakerTimeLimitLocal] = useState(90);
  const [speakerTimeLimitInput, setSpeakerTimeLimitInput] = useState<string>('90');
  const [showSettings, setShowSettings] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  // Bumped by every realtime `feedback` event. Passed to the comment dock and the
  // scoreboard as a refetch key so both stay live while open.
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatReadCounts, setChatReadCounts] = useState<Record<string, number>>({});
  // Resume-from-suspend UI state. `resumeBusy` also double-taps the button, so one chair
  // cannot fire two claims at once. `resumeError` surfaces a failure the chair can act on
  // instead of a console.error nobody sees. `resumeStuckSince` starts ticking the moment we
  // observe ANOTHER chair holding the latch, so a latch abandoned mid-resume can be taken
  // over rather than bricking the committee.
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeStale, setResumeStale] = useState(false);
  // Only one of these can be open at a time
  // Add time and Right of Reply are INDEPENDENT floating panels (owner, 15 Sep 2026): the
  // chair may keep both open at once. Each has its own flag; nothing else closes one when
  // the other opens.
  const [openPopovers, setOpenPopovers] = useState<FloorPopovers>({ extraTime: false, rightToReply: false });
  const setPopover = useCallback((which: FloorPopover, open: boolean | 'toggle') => {
    setOpenPopovers((p) => {
      const next = open === 'toggle' ? !p[which] : open;
      return p[which] === next ? p : { ...p, [which]: next };
    });
  }, []);
  // A Commenter who tries a Moderator-only control gets ONE notice explaining the gavel
  // (src/lib/commenterNotice.ts). Stable identity (refs), so memoised panels do not
  // re-render on every page render. UI only (rule 15): nothing is written.
  const moderatorNameRef = useRef('');
  const notifyCommenter = useCallback(() => { notifyCommenterOnly(t, moderatorNameRef.current); }, [t]);
  const [extraTimeSecs, setExtraTimeSecs] = useState('');
  const [extraTimeAdded, setExtraTimeAdded] = useState(false);
  const [caucusLoading, setCaucusLoading] = useState(false);
  const [caucusPanelLocked, setCaucusPanelLocked] = useState(false);
  const [unmodLoading, setUnmodLoading] = useState(false);

  // RTR overlay — completely independent of GSL
  const [rtrOpen, setRtrOpen] = useState(false);
  const [rtrCountry, setRtrCountry] = useState('');
  const [rtrSeconds, setRtrSeconds] = useState(30);
  const [rtrTimerActive, setRtrTimerActive] = useState(false);
  const [rtrTimeRemaining, setRtrTimeRemaining] = useState(30);
  const rtrIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Isolated timer atom — ticks never touch the `committee` object, preventing
  // whole-tree re-renders every second.
  const [speakerTimeRemaining, setSpeakerTimeRemaining] = useState(90);
  // Bumped on every seat of the speaker clock (never by a tick): the gavel knock's anchor
  // identity, so a value that JUMPED below the mark is never read as a countdown step.
  const [speakerClockEpoch, setSpeakerClockEpoch] = useState(0);
  // ── The speaker clock's ANCHOR, and the only thing the tick reads ────────────
  // This pair mirrors current_speaker.{time_remaining, started_at} exactly, so the
  // chair renders the SAME function of the SAME two numbers that every other surface
  // renders (speakerRemainingNow). Before this existed the tick did `prev - 1`, which
  // is a different clock: it counts INTERVAL FIRINGS, not seconds. A browser coalesces
  // the firings of a background/throttled/blocked tab into one, so the chair's clock
  // silently ran slow and never reconverged — measured at 15s lost to a single 12s
  // stall, permanently. Deriving from the anchor makes a missed tick cost nothing: the
  // next one lands on the right number.
  const speakerAnchorRef = useRef<{ base: number; startedAt: string | null }>({ base: 90, startedAt: null });
  /* The single writer for the speaker clock. `startedAt` null = paused, and `base` is
     then the literal truth. ALWAYS seat both together — a base without its anchor (or
     vice versa) is the desync. Reader only: never touches `committee`, never sets
     localUpdateTime (RULE 3 / RULE 4). */
  const seatSpeakerClock = useCallback((base: number, startedAt: string | null) => {
    const safeBase = Number.isFinite(base) ? Math.max(0, Math.round(base)) : 0;
    speakerAnchorRef.current = { base: safeBase, startedAt: startedAt ?? null };
    setSpeakerTimeRemaining(speakerRemainingNow(safeBase, startedAt ?? null));
    setSpeakerClockEpoch((n) => n + 1);
  }, []);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [headChairName, setHeadChairName] = useState<string | null>(null);
  // One device per name holds the gavel (src/lib/gavelDevice.ts). `gavelElsewhere` = this
  // chair's name holds it but another device is the Moderator: the take-back banner shows.
  const [gavelElsewhere, setGavelElsewhere] = useState(false);
  const gavelDeviceId = useMemo(() => getGavelDeviceId(code), [code]);
  // A device that just claimed pins its own id for 4s, so a refetch that was already in
  // flight before its write landed cannot bounce the role. `gavelPinTick` re-derives once
  // when the pin expires. Cost: if two same-name devices claim within the same 4s, the
  // loser keeps acting as Moderator until its pin expires, then converges on the DB value.
  const gavelPinRef = useRef<{ device: string; until: number } | null>(null);
  const [gavelPinTick, setGavelPinTick] = useState(0);
  const gavelPinNow = () => {
    const pin = gavelPinRef.current;
    return pin && Date.now() < pin.until ? pin.device : null;
  };
  // One device per signed-in ACCOUNT (src/lib/useChairDeviceLock.ts). Supersedes the
  // same-name rule for accounts: the older device is kicked out, not demoted. While kicked
  // it derives Commenter (so every Moderator-only effect and write stops), never claims
  // the gavel, and renders only ChairDeviceKickModal. Anonymous chairs: inert.
  const deviceLock = useChairDeviceLock({
    code,
    committeeId: committee?.id,
    userId: user?.id,
    accessToken: session?.access_token,
    enabled: accessState === 'allowed' && !!committee?.id && !committee?.endedAt,
  });
  const gavelRoleOf = (c: Committee | null | undefined) => {
    const role = deriveGavelRole(c, myChairName, gavelDeviceId, gavelPinNow());
    return deviceLock.kicked ? { ...role, heldElsewhere: false, isModerator: false } : role;
  };
  // Gavel chip: live presence dots + the transient handover toast.
  const [onlineChairs, setOnlineChairs] = useState<Set<string>>(new Set());
  const [headOffline, setHeadOffline] = useState(false);
  const [gavelToast, setGavelToast] = useState<{ tone: 'lost' | 'gained'; text: string } | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Set by the speaker tick when the clock reaches zero on its own (not a pause). Holds the
  // TURN KEY of the speaker whose clock ran out, so the one re-anchor below is skipped if
  // the floor has changed hands since (a fast Next).
  const speakerExpiredRef = useRef<{ turn: string | null } | null>(null);
  const speakerTurnKeyRef = useRef<string | null>(null);
  const [extraTimeCapMsg, setExtraTimeCapMsg] = useState<number | null>(null);
  const timerRunningRef = useRef(false);
  const isViewOnlyRef = useRef(false);
  // The realtime → state pipeline (src/lib/sessionSync.ts): per-slice fetches, one counter
  // PER SLICE, coalesced, catch-up on wake / reconnect / online. Held in a ref so automatic
  // Moderator writes can ask whether local state is fresh first (R-6).
  const syncRef = useRef<SessionSync | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('reconnecting');
  // Bumped when a catch-up's fetches have all returned, so the automatic-write effects that
  // stood down while it ran get to run again against the fresh state (R-6).
  const [catchUpTick, setCatchUpTick] = useState(0);
  // Delegate statuses this chair has written but not yet seen confirmed by a DB refetch.
  // A refetch whose snapshot predates our write would otherwise repaint the roll-call
  // slider with the pre-click status. Pinned until DB truth agrees, or the TTL expires
  // (backstop for a write that failed outright).
  const pendingStatusWrites = useRef<Record<string, { value: DelegateStatus; at: number }>>({});
  // Set by the loader when it reconstructs the speaker clock from current_speaker.started_at
  // / time_remaining, so the caucus seeding effect knows not to overwrite it (H5).
  const speakerClockHydratedRef = useRef(false);
  const committeeIdRef = useRef('');
  const committeeCodeRef = useRef('');
  const chairSuffixRef = useRef<string | undefined>(undefined);
  const committeePhaseRef = useRef('');
  const speakerTimeLimitRef = useRef(speakerTimeLimit);
  // Accumulates seconds granted via +time to the CURRENT speaker so speaking-time logging
  // counts against the extended limit, not the base — otherwise a speaker given extra time
  // who yields early underflows to a negative value and their speech is silently dropped.
  // Reset on every speaker transition (Next / Call First / Restart).
  const extraTimeAddedSecsRef = useRef(0);
  // Add time pressed for the delegation ON DECK (owner, 16 Sep 2026: "add more time even if
  // it is the first speaker"). Nobody is seated, so there is no current_speaker row to grant
  // to: the seconds are held here, keyed by the on-deck delegate, shown on the floor clock,
  // and folded into the slot when Start seats them (`handleStartOnDeck`). Nothing is written,
  // logged or started by the grant. A different delegation coming on deck ignores it.
  const [onDeckGrant, setOnDeckGrant] = useState<{ id: string; secs: number } | null>(null);
  // Mutable map of delegateId → current status — updated immediately on each cycle
  // so rapid clicks read the post-click status, not the pre-re-render (stale) status.
  const delegateStatusRef = useRef<Map<string, DelegateStatus>>(new Map());
  // ── Notification plumbing ────────────────────────────────────────────────
  // The GSL card's buttons must call the SAME approve/deny handlers as the banner,
  // but those are declared after the loading early-return while the effect that
  // raises the card must live before it. A ref assigned during render (same pattern
  // as timerRunningRef above) bridges the two and keeps the closures fresh, so a
  // card raised minutes ago never fires a stale-committee write.
  const gslActionsRef = useRef<{
    approve: (motionId: string, delegateId: string, country: string) => void | Promise<void>;
    deny: (motionId: string) => void | Promise<void>;
  }>({ approve: () => {}, deny: () => {} });
  // Motion ids we have already raised a card for. Presence here means "raised at some
  // point", NOT "still on screen" — a card that timed out must not be re-raised by the
  // next render of the same still-pending motion (rule 1: notify() restarts the TTL).
  const raisedGslKeysRef = useRef<Set<string>>(new Set());
  // Broadcast ids this device has already raised a card for, and ids whose action this
  // device has already executed. Both mean "already handled at some point", not "still on
  // screen" — a dismissed card must not be re-raised by the next refetch, and a fired
  // suspend must not fire twice if the row is re-delivered.
  const raisedBroadcastKeysRef = useRef<Set<string>>(new Set());
  const firedBroadcastsRef = useRef<Set<string>>(new Set());
  // Same bridge pattern as gslActionsRef: reassigned every render so a timer armed minutes
  // ago fires against the CURRENT committee row, gavel state and chair suffix — never a
  // stale closure that would write to a committee this device has since stopped chairing.
  const broadcastEffectRef = useRef<(b: SessionBroadcast) => void>(() => {});
  // Chat message ids already accounted for. Seeded with the whole backlog on first load
  // so a refresh does not burst a card for every historical message.
  const seenChatIdsRef = useRef<Set<string> | null>(null);
  const seenChatCommitteeRef = useRef<string | null>(null);
  timerRunningRef.current = timerRunning;
  speakerTurnKeyRef.current = speakerTurnKey(committee);
  isViewOnlyRef.current = isViewOnly;
  speakerTimeLimitRef.current = speakerTimeLimit;
  committeePhaseRef.current = committee?.phase ?? '';
  committeeCodeRef.current = committee?.code ?? '';
  chairSuffixRef.current = committee?.dbChairJoinSuffix ?? undefined;

  // Merge a freshly fetched delegates array over this chair's still-unconfirmed status writes.
  // Only rows this device just wrote are pinned; every other row is taken from the DB, so a
  // delegate's own status change or a co-chair's roll call still lands. Each pin releases the
  // moment DB truth agrees with it — or after the TTL, if the write never landed at all.
  // Pins for ids missing from `fresh` (a deleted delegate) simply age out on the TTL.
  const applyPinnedStatuses = (fresh: Delegate[]): Delegate[] => {
    const pins = pendingStatusWrites.current;
    if (Object.keys(pins).length === 0) return fresh;
    const now = Date.now();
    return fresh.map((d) => {
      const pin = pins[d.id];
      if (!pin) return d;
      // DB agrees, or the pin is stale — hand control back to the authoritative row.
      if (d.status === pin.value || now - pin.at >= STATUS_PIN_TTL_MS) {
        delete pins[d.id];
        return d;
      }
      return { ...d, status: pin.value };
    });
  };


  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} - Gavelling Session`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    // S6: an unmount (or a code / seatSpeakerClock change) while the load is in flight must
    // start nothing: no state writes, no sync, no heartbeat, no listeners, no channel.
    let cancelled = false;
    async function load() {
      // A failed read is not "not found": retried with backoff, then an inline Retry.
      const result = await getCommitteeByCodeWithRetry(code, { isCancelled: () => cancelled });
      if (cancelled) return;
      if (result.status === 'error') { setLoadFailed(true); setLoading(false); return; }
      setLoadFailed(false);
      const found = result.status === 'ok' ? result.committee : null;
      if (found) {
        if (found.suspendedAt) {
          setSessionSuspended(true);
        } else if (found.endedAt) {
          setSessionEnded(true);
        }
      }
      if (found) {
        // Clean up orphaned suspend/end-debate motions left from cycles where the delete silently failed
        const staleMotions = (found.pendingMotions ?? []).filter(
          (m) => m.type === 'suspend-debate' || m.type === 'end-debate'
        );
        if (staleMotions.length > 0) {
          staleMotions.forEach((m) => removePendingMotionInDB(m.id, found.code, found.dbChairJoinSuffix ?? undefined));
          found.pendingMotions = (found.pendingMotions ?? []).filter(
            (m) => m.type !== 'suspend-debate' && m.type !== 'end-debate'
          );
        }
      }
      setCommittee(found ?? null);
      if (found) {
        setSpeakerTimeLimitLocal(found.speakerTimeLimit);
        if (found.speakerStartedAt) {
          // Timer was running when the chair left — compute real elapsed time and resume.
          // The base is current_speaker.time_remaining (the value AT the anchor), NOT the
          // committee speaker limit: nextSpeaker() writes the limit into time_remaining
          // when it seats someone, a pause syncs the true remainder, and a moderated caucus
          // seats speakers with the CAUCUS speaking time. Using speakerTimeLimit therefore
          // rewound a paused-then-resumed GSL speaker and reset every caucus speaker to the
          // committee default (H5).
          seatSpeakerClock(found.speakerTimeRemaining, found.speakerStartedAt);
          if (speakerRemainingNow(found.speakerTimeRemaining, found.speakerStartedAt) > 0) setTimerRunning(true);
        } else {
          seatSpeakerClock(found.speakerTimeRemaining, null);
        }
        // The load has authoritatively reconstructed the speaker clock from the DB anchor.
        // Tell the caucus seeding effect below not to clobber it on its first pass (H5).
        speakerClockHydratedRef.current = true;
        committeeIdRef.current = found.id;
        if (found.dbSettings) {
          // DB is the source of truth for committee settings (thresholds, veto, motions, etc.).
          // `headChair` is stripped on the way IN (MUST NEVER HAPPEN #12): it is not a
          // CommitteeSettings field, it goes stale the instant another chair takes the gavel,
          // and SettingsPanel's `upd` posts the whole store blob back — a hydrated copy would
          // silently revert the gavel to whoever held it at page load.
          // `agendaTopicIndex` likewise: only the agenda picker writes it, and a hydrated copy
          // would revert a later choice made on another device.
          // `headChairDevice` is the gavel's device half (src/lib/gavelDevice.ts): same reason.
          // `votingReturnPhase` too. The one list of these keys is NON_HYDRATED_SETTING_KEYS.
          hydrateSettings(found.code, stripNonHydratedSettings(found.dbSettings));
        }
        if (found.dbChairJoinSuffix) {
          updateSetting(found.code, 'chairJoinSuffix', found.dbChairJoinSuffix);
        }
        if (!found.endedAt) {
          const foundSettings = getSettings(found.code);
          localStorage.setItem('gavelling-rejoin', JSON.stringify({
            code: found.code,
            chairName: myChairName || (found.chairNames[0] ?? 'Chair'),
            committeeTitle: found.name ?? found.topic ?? found.code,
            savedAt: Date.now(),
            chairSuffix: foundSettings.chairJoinSuffix || null,
          }));
        }
      }
      setLoading(false);
      if (cancelled) return;
      if (found) {
        // A chair who joins late, or reloads mid-session, still gets any live organiser
        // broadcast — realtime only ever delivers what arrives AFTER the socket opens.
        // Fire-and-forget: nothing about the session waits on an announcement.
        getActiveBroadcasts(found.id).then((b) => { if (!cancelled) setBroadcasts(b); });
        const cid = found.id;
        // Milliseconds left in RULE 4's debounce window. A Commenter owns no session state and
        // writes none, so it never debounces: doing so would silently drop phase/caucus changes
        // it can only learn remotely, leaving it (and its feedback dock) on a caucus the
        // committee has already left.
        const debounceLeft = () => (isViewOnlyRef.current ? 0 : Math.max(0, 3000 - (Date.now() - localUpdateTime.current)));
        // R-1: an optimistic local write happened AFTER this fetch started, so the snapshot
        // predates the chair's own click. Never apply it over that click; fetch again.
        const wroteSince = (meta: FetchMeta) => localWriteSeq.current !== meta.localWriteSeqAtStart;
        // R-3: what the window swallows is fetched once more when the window closes.
        const afterWindow = () => Math.max(250, debounceLeft() + 50);
        const STALE_RETRY_MS = 250;

        const sync = startSessionSync({
          committeeId: cid,
          tables: ['committees', 'delegates', 'speakers_list', 'current_speaker', 'motions', 'documents', 'messages', 'feedback', 'session_broadcasts'],
          slices: ALL_SYNC_SLICES,
          getLocalWriteSeq: () => localWriteSeq.current,
          onConnection: setConnection,
          onCatchUp: (phase) => { if (phase === 'done') setCatchUpTick((n) => n + 1); },
          onEvent: (table) => {
            // Broadcasts first, and outside the debounce entirely. They are organiser-owned:
            // this device never writes the table, so there is no optimistic state to protect,
            // and swallowing one because the chair happened to press Next three seconds ago
            // would drop the message that pauses the committee.
            if (table === 'session_broadcasts') {
              getActiveBroadcasts(cid).then(setBroadcasts);
              return true;
            }
            // Chair notes + factor ratings, also outside the debounce. `feedback` is not
            // optimistic speaker/timer/caucus state, so RULE 4 does not apply and swallowing
            // the echo would only make a second chair's note invisible until a remount. We bump
            // a counter rather than refetch: the two readers (the comment dock and the
            // scoreboard) each own their own query and neither is always mounted.
            if (table === 'feedback') {
              setFeedbackVersion((v) => v + 1);
              return true;
            }
            return false;
          },
          // RULE 6: the Moderator owns current_speaker (writes it on start/pause/next) and
          // ignores its echoes. A Commenter does not own it and needs every change.
          wants: (table) => table !== 'current_speaker' || isViewOnlyRef.current,
          // Inside the window a speakers_list event cannot be applied anyway (the chair just
          // wrote the list and its optimistic state is truth), so do not even fetch it until
          // the window closes. Every other slice is fetched promptly.
          delayFor: (slice) => (slice === 'lists' && debounceLeft() > 0 ? afterWindow() : COALESCE_MS),
          // Chat + speech-log rows are append-only and belong to no optimistic state: merge
          // the realtime row by id, no refetch.
          onMessage: (m) => setCommittee((prev) => {
            if (!prev) return prev;
            const merged = mergeMessagesById(prev.messages, [m]);
            return merged === prev.messages ? prev : { ...prev, messages: merged };
          }),
          apply: (slice, data, meta) => {
            const stale = wroteSince(meta);
            const inWindow = debounceLeft() > 0;
            switch (slice) {
              case 'row': {
                const updated = data as Committee;
                if (stale) {
                  // Only what no click on this device can have changed: the roster of chair
                  // names, and the end of the session (endedAt is permanent). The gavel,
                  // the resume latch, phase and caucus all wait for the fresh fetch.
                  setCommittee((prev) => prev ? {
                    ...prev,
                    chairNames: updated.chairNames,
                    ...(updated.endedAt ? { endedAt: updated.endedAt, expiresAt: updated.expiresAt } : {}),
                  } : prev);
                  if (updated.endedAt) { setSessionEnded(true); setSessionSuspended(false); }
                  return STALE_RETRY_MS;
                }
                if (inWindow) {
                  setCommittee((prev) => {
                    if (!prev) return prev;
                    // The gavel arrives as exactly ONE `committees` event and is never
                    // re-delivered. Dropping it inside the debounce meant a handover made
                    // within 3 s of this chair's last write was silently discarded. Neither
                    // it nor the resume latch is optimistic speaker/timer/caucus state, so
                    // merging them here does not weaken RULE 4.
                    let next: Committee = {
                      ...prev,
                      dbHeadChair: updated.dbHeadChair,
                      dbHeadChairDevice: updated.dbHeadChairDevice,
                      chairNames: updated.chairNames,
                      resumingChair: updated.resumingChair,
                    };
                    if (updated.endedAt) next = { ...next, endedAt: updated.endedAt, expiresAt: updated.expiresAt };
                    if (updated.suspendedAt !== prev.suspendedAt) next = { ...next, suspendedAt: updated.suspendedAt, resumingChair: updated.resumingChair, phase: updated.phase };
                    return next;
                  });
                  if (updated.endedAt) { setSessionEnded(true); setSessionSuspended(false); }
                  else if (updated.suspendedAt) { setSessionSuspended(true); }
                  else { setSessionSuspended(false); }
                  // phase / caucus / topic / settings: once more when the window closes (R-3).
                  return afterWindow();
                }
                if (updated.endedAt) {
                  setSessionEnded(true);
                } else if (updated.suspendedAt) {
                  setSessionSuspended(true);
                } else {
                  setSessionEnded(false);
                  setSessionSuspended(false);
                }
                // A foreign event must never disturb the live speaker/caucus state owned by
                // the running chair: while this Moderator's speaker clock runs, keep phase,
                // caucus and the speaker limit. A Commenter always takes the fresh row.
                // (The unmoderated countdown needs no pin: its clock IS the persisted anchor.)
                if (timerRunningRef.current && !isViewOnlyRef.current) {
                  setCommittee((prev) => prev ? {
                    ...prev, ...rowFields(updated),
                    caucus: prev.caucus, phase: prev.phase, speakerTimeLimit: prev.speakerTimeLimit,
                  } : prev);
                } else {
                  setCommittee((prev) => prev ? { ...prev, ...rowFields(updated) } : prev);
                }
                return;
              }
              case 'lists': {
                // RULE 4: within the window the chair's optimistic queue is truth.
                if (stale || inWindow) return afterWindow();
                setCommittee((prev) => prev ? withLists(prev, data as Parameters<typeof withLists>[1]) : prev);
                return;
              }
              case 'currentSpeaker': {
                const cs = data as Parameters<typeof withCurrentSpeaker>[1];
                if (isViewOnlyRef.current) {
                  if (stale) return STALE_RETRY_MS;
                  setCommittee((prev) => prev ? withCurrentSpeaker(prev, cs, { includeRemaining: false }) : prev);
                  // Anchor base is the row's own time_remaining, NOT the committee speaker
                  // limit: a moderated-caucus speaker is seated with the CAUCUS speaking time,
                  // and a paused-then-resumed speaker carries their true remainder (H5).
                  seatSpeakerClock(cs.speakerTimeRemaining, cs.speakerStartedAt);
                  return;
                }
                // The Moderator owns this row (RULE 6). It only reads it back on a catch-up
                // (wake / reconnect), never over its own window or a running clock.
                if (!meta.catchUp) return;
                if (stale || inWindow) return afterWindow();
                if (timerRunningRef.current) return;
                setCommittee((prev) => prev ? withCurrentSpeaker(prev, cs, { includeRemaining: true }) : prev);
                seatSpeakerClock(cs.speakerTimeRemaining, cs.speakerStartedAt);
                return;
              }
              case 'delegates': {
                // Not held for the window: delegates and Commenters write this table too, and
                // it feeds the present count and the quorum gate. Every status this chair has
                // just written stays pinned until DB truth confirms it.
                if (stale) return STALE_RETRY_MS;
                setCommittee((prev) => prev ? { ...prev, delegates: applyPinnedStatuses(data as Committee['delegates']) } : prev);
                return;
              }
              case 'motions': {
                if (stale) return STALE_RETRY_MS;
                setCommittee((prev) => prev ? { ...prev, pendingMotions: data as Committee['pendingMotions'] } : prev);
                return;
              }
              case 'documents': {
                // Merged inside the window too (R-3): a delegate's new paper is not this
                // chair's optimistic state.
                if (stale) return STALE_RETRY_MS;
                setCommittee((prev) => prev ? { ...prev, documents: data as Committee['documents'] } : prev);
                return;
              }
              case 'messages': {
                setCommittee((prev) => {
                  if (!prev) return prev;
                  const merged = mergeMessagesById(prev.messages, data as Committee['messages']);
                  return merged === prev.messages ? prev : { ...prev, messages: merged };
                });
                return;
              }
            }
          },
        });
        syncRef.current = sync;
        unsubscribe = () => { sync.stop(); if (syncRef.current === sync) syncRef.current = null; };
      }
    }
    load();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [code, seatSpeakerClock, loadAttempt]);

  useEffect(() => {
    if (!committee?.id || !myChairName) return;
    const channel = supabase.channel(`chair-presence-${committee.id}`, {
      config: { presence: { key: myChairName } },
    });
    // Presence tells the join page which chairs are active, and feeds the GavelChip's
    // live dots. Head-chair status is NOT decided here — it's a persisted, claim-at-will
    // setting derived from committee.dbHeadChair (see the effect below). Presence must
    // NEVER auto-transfer the gavel: a 5s network blip would hand the session away
    // mid-speech. It only surfaces "this chair looks offline" so a human decides.
    const syncPresence = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      const names = new Set(Object.keys(state));
      names.add(myChairName);
      const now = Date.now();
      names.forEach((n) => { lastSeenRef.current.set(n, now); });
      setOnlineChairs(names);
    };
    channel.on('presence', { event: 'sync' }, syncPresence);
    channel.on('presence', { event: 'join' }, syncPresence);
    channel.on('presence', { event: 'leave' }, syncPresence);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await channel.track({ joinedAt: Date.now() }); syncPresence(); }
    });
    return () => { supabase.removeChannel(channel); };
  }, [committee?.id, myChairName]);

  // "Holder looks offline" — informational only, never an auto-handover. 20s of grace so a
  // brief disconnect is invisible; past that the chip turns amber and offers a take-over.
  useEffect(() => {
    const evaluate = () => {
      const head = headChairName;
      if (!head || head === myChairName) { setHeadOffline(false); return; }
      if (onlineChairs.has(head)) { setHeadOffline(false); return; }
      const last = lastSeenRef.current.get(head);
      setHeadOffline(last !== undefined && Date.now() - last > 20_000);
    };
    evaluate();
    const id = setInterval(evaluate, 5_000);
    return () => clearInterval(id);
  }, [headChairName, myChairName, onlineChairs]);

  // Moderator (the gavel) is a persisted, claim-at-will setting — derive view-only status
  // from it, never from presence join-order. Unset → the committee creator (chairNames[0])
  // holds it. Any chair can claim it (Settings or at join), flipping the previous head to
  // view-only via the realtime committees refetch.
  // The role flip is detected HERE, synchronously, in the same pass that computes it —
  // not by diffing the isViewOnly state in a later effect. isViewOnly starts false and only
  // settles once the committee loads, so a state-diff would read that initial settle as a
  // handover and make every already-Commenter refetch on mount. roleRef records the
  // baseline the first time a loaded committee is available; only real changes after that
  // raise a flip.
  const roleRef = useRef<boolean | null>(null);
  const [roleFlip, setRoleFlip] = useState<{ lost: boolean; at: number; device?: boolean } | null>(null);

  // Claim the gavel for THIS device (one device per name). Declared BEFORE the derivation
  // effect on purpose: both run in the same flush, so the pin is already set when the role
  // is first derived and a newly opened device settles straight into Moderator, with no
  // phantom "you lost / you gained" flip. Claims only (a) once per page load when this name
  // holds the gavel and another device is recorded (newest wins), and (b) whenever the
  // gavel reaches this name with no device recorded. A re-check never steals it back: after
  // the first load, a foreign device id is left alone until the explicit "Use this device".
  const gavelLoadClaimDoneRef = useRef(false);
  const gavelPinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (gavelPinTimerRef.current) clearTimeout(gavelPinTimerRef.current); }, []);
  const claimGavelForThisDevice = useCallback((c: Committee, name: string) => {
    // A page opened without ?chairName= has no identity to claim with (src/lib/gavelDevice.ts).
    if (!gavelDeviceId || !name || !myChairName) return;
    gavelPinRef.current = { device: gavelDeviceId, until: Date.now() + 4000 };
    if (gavelPinTimerRef.current) clearTimeout(gavelPinTimerRef.current);
    gavelPinTimerRef.current = setTimeout(() => { gavelPinTimerRef.current = null; setGavelPinTick((n) => n + 1); }, 4100);
    updateLocal(setCommittee, (prev) => ({ ...prev, dbHeadChair: name, dbHeadChairDevice: gavelDeviceId }));
    updateCommitteeHeadChairInDB(c.id, name, c.code, c.dbChairJoinSuffix ?? undefined, gavelDeviceId);
  }, [gavelDeviceId, myChairName]);
  useEffect(() => {
    if (!committee?.id || accessState !== 'allowed' || !myChairName) return;
    if (committee.endedAt) return;                    // read-only: never write
    if (deviceLock.kicked) return;                    // this account is chairing on another device
    // Already ours. The pin is NOT cleared here: this value may be our own optimistic write,
    // and the stale refetch the pin exists for can still arrive. It expires on its own.
    if (committee.dbHeadChairDevice === gavelDeviceId) { gavelLoadClaimDoneRef.current = true; return; }
    const role = deriveGavelRole(committee, myChairName, gavelDeviceId, null);
    const firstLoad = !gavelLoadClaimDoneRef.current;
    gavelLoadClaimDoneRef.current = true;
    if (!role.nameHolds) return;
    if (committee.dbHeadChairDevice && !firstLoad) return;   // held elsewhere: only the tap takes it
    if (gavelPinNow() === gavelDeviceId) return;             // our claim is already in flight
    claimGavelForThisDevice(committee, role.head ?? myChairName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.dbHeadChair, committee?.dbHeadChairDevice, committee?.chairNames, committee?.endedAt, accessState, myChairName, gavelDeviceId, deviceLock.kicked]);

  useEffect(() => {
    const role = gavelRoleOf(committee);
    setHeadChairName(role.head);
    setGavelElsewhere(role.heldElsewhere);
    const next = !role.isModerator;
    setIsViewOnly(next);
    // Not loaded yet, or access not settled (the load claim waits for it) — no baseline.
    if (!committee?.id || accessState !== 'allowed') return;
    const prev = roleRef.current;
    roleRef.current = next;
    if (prev === null || prev === next) return;       // first settle, or nothing changed
    setRoleFlip({ lost: next, at: Date.now(), device: next && role.heldElsewhere });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.dbHeadChair, committee?.dbHeadChairDevice, committee?.chairNames, committee?.id, myChairName, accessState, gavelPinTick, deviceLock.kicked]);

  // ── "Who is moderating now": one glass card on EVERY chair device ───────────
  // (17 Sep 2026, owner: "add some sort of notification in the top right when a chair takes
  // control over the session or they get the gavel".)
  //
  // The handover toast below only reaches the two devices whose OWN role flipped. A third
  // chair on the dais stays a Commenter through a handover and used to be told nothing at
  // all, so "who has control" was something you had to open Settings to find out. This fires
  // on the MODERATOR'S NAME changing, so all three devices report the same event, and says
  // whether it is you.
  //
  // Keyed on the holder (`notifyKey.gavel`), so a realtime re-delivery, a device claim under
  // the same name and two same-second claims collapse onto one card (store rule 1). `urgent`,
  // because the stack is suppressed while a speech runs and a chair still pressing Next on a
  // session they no longer drive needs this now, not after the speech. The first loaded value
  // is only a baseline: opening the page announces nothing.
  //
  // Read-only, like every other notification producer: no setCommittee, no updateLocal, no
  // localUpdateTime, no DB write (RULES 3 to 5).
  const gavelHolderRef = useRef<string | null>(null);
  /** When the last name-change card fired, so the ROLE TRANSITION toast below does not say
   *  the same thing a second time on the two devices whose role flipped. */
  const gavelCardAtRef = useRef(0);
  useEffect(() => {
    if (!committee?.id || accessState !== 'allowed' || !myChairName) return;
    const holder = (committee.dbHeadChair || committee.chairNames?.[0] || '').trim();
    if (!holder) return;
    const prev = gavelHolderRef.current;
    gavelHolderRef.current = holder;
    if (prev === null || prev === holder) return;       // baseline, or nothing moved
    if (sessionEnded || deviceLock.kicked) return;      // the overlay / modal owns the screen
    const mine = holder === myChairName;
    gavelCardAtRef.current = Date.now();
    notify({
      key: notifyKey.gavel(holder),
      kind: 'info',
      title: mine ? t('gavel_notify_mine_title') : t('gavel_notify_taken_title', { name: holder }),
      body: mine ? t('gavel_notify_mine_body') : t('gavel_notify_taken_body'),
      ttlMs: NOTIFY_TTL.notice,
      urgent: true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.dbHeadChair, committee?.chairNames, accessState, myChairName, sessionEnded, deviceLock.kicked, t]);

  // Agenda: a conference committee with 2+ topics opens on the topic the Moderator picks
  // (src/components/AgendaPicker.tsx). Inert for standalone sessions and 0/1 topics.
  const applyAgendaLocal = useCallback((u: (c: Committee) => Committee) => updateLocal(setCommittee, u), []);
  const agenda = useAgendaPicker({ committee, isViewOnly, sessionEnded, sessionSuspended, applyLocal: applyAgendaLocal });
  // D-1: re-hydrate the settings store whenever ANOTHER chair's write changes
  // committee.dbSettings (the loader above hydrates only once), and say so on screen.
  const settingsSync = useSettingsSync(committee);

  // ── ROLE TRANSITION (A1) ────────────────────────────────────────────────────
  // Flipping isViewOnly changes what this device OWNS, so it must also drop what it was
  // holding on to as the acting chair. Without this the demoted chair's chrome went
  // view-only while its session state froze: the local timer kept ticking, the debounce
  // stayed armed, and the subscription's timerRunning pin kept re-applying the stale
  // phase/caucus/currentSpeaker — the Commenter watched a session that had moved on.
  // Symmetrically, the promoted chair must pick up the RUNNING timer, not a dead one.
  useEffect(() => {
    if (!roleFlip) return;
    const lost = roleFlip.lost;

    // Stop owning the clock, and close anything that only makes sense while acting.
    setTimerRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setOpenPopovers({ extraTime: false, rightToReply: false });
    setRtrOpen(false);
    setRtrTimerActive(false);
    setCaucusLoading(false);
    setUnmodLoading(false);
    // Release the debounce immediately — whatever this device wrote is no longer the truth.
    localUpdateTime.current = 0;

    const newHead = committee?.dbHeadChair || committee?.chairNames?.[0] || '';
    // Kicked by the account rule: the modal says it, a toast under it would only linger.
    // A NAME change is already announced by the "who is moderating" card (every device, top
    // right), so the toast is kept only for a same-name DEVICE move, which that card cannot
    // see (the holder's name did not change).
    const cardJustFired = Date.now() - gavelCardAtRef.current < 3000;
    if (!deviceLock.kicked && !cardJustFired) setGavelToast({
      tone: lost ? 'lost' : 'gained',
      // Routed through translations: this fires at the exact moment control changes
      // hands, so it is the worst possible place to fall back to English.
      text: lost
        ? (roleFlip.device ? t('gavel_device_elsewhere') : t('gavel_toast_lost', { name: newHead || t('gavel_another_chair') }))
        : t('gavel_toast_gained'),
    });

    // ONE clean resync, then recompute the timer from current_speaker.started_at exactly
    // the way the initial load path does — so the new chair inherits a live countdown.
    let cancelled = false;
    (async () => {
      const { fresh, stale } = await fetchCommitteeGuarded(code);
      if (cancelled || !fresh) return;
      // R-1: this device wrote something while the resync was in flight (a Start pressed the
      // moment the gavel arrived). The snapshot predates it: let the guarded session sync
      // land the fresh slices instead of replacing the committee wholesale.
      if (stale) { syncRef.current?.catchUp(undefined, { force: true }); return; }
      // Keep the gavel value we already hold. On the GAINING side it is our optimistic
      // claim, and this fetch can easily outrun the settings write — taking fresh here would
      // bounce the role back and re-fire the whole transition. On the LOSING side prev
      // already carries the incoming value that caused this flip, so it is identical.
      setCommittee((prev) => prev ? { ...fresh, dbHeadChair: prev.dbHeadChair, dbHeadChairDevice: prev.dbHeadChairDevice } : fresh);
      setSpeakerTimeLimitLocal(fresh.speakerTimeLimit);
      // Anchor base is current_speaker.time_remaining, not the committee limit — see H5.
      const remaining = speakerRemainingNow(fresh.speakerTimeRemaining, fresh.speakerStartedAt);
      seatSpeakerClock(fresh.speakerTimeRemaining, fresh.speakerStartedAt);
      if (fresh.speakerStartedAt && !lost && remaining > 0) setTimerRunning(true);
      // Gained the gavel on a speaker whose clock already ran out with nobody watching: do
      // the one stop-at-zero re-anchor now, or the total stays armed and drains uncapped.
      // Role from the gavel values we hold (see the setCommittee above), not fresh's.
      if (fresh.speakerStartedAt && !lost && remaining === 0) {
        reanchorCaucusAtSpeakerZero(
          committee ? { ...fresh, dbHeadChair: committee.dbHeadChair, dbHeadChairDevice: committee.dbHeadChairDevice } : fresh,
          fresh.speakerTimeRemaining, fresh.speakerStartedAt,
        );
      }
    })();
    return () => { cancelled = true; };
  // committee/code are read, not tracked: this must run on the ROLE flip only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFlip]);

  // Extra-time cap notice — transient, 6s.
  useEffect(() => {
    if (extraTimeCapMsg === null) return;
    const id = setTimeout(() => setExtraTimeCapMsg(null), 6000);
    return () => clearTimeout(id);
  }, [extraTimeCapMsg]);

  // Handover toast — transient, 6s flash.
  useEffect(() => {
    if (!gavelToast) return;
    const t = setTimeout(() => setGavelToast(null), 6000);
    return () => clearTimeout(t);
  }, [gavelToast]);

  // The ONLY gavel write: settings.headChair, read-merged so chairJoinSuffix survives.
  // Nothing else is touched — not current_speaker, not speakers_list, not caucus, not
  // phase. The session keeps running and delegates see nothing at all. Last writer wins
  // on simultaneous claims; every client converges on the realtime `committees` event.
  // Taking it for yourself records THIS device (claimGavelForThisDevice); handing it to
  // another name clears the device, and that chair's device claims it on arrival.
  const handleSetHeadChair = useCallback((name: string) => {
    if (!committee || !name) return;
    if (name === myChairName) { claimGavelForThisDevice(committee, name); return; }
    updateLocal(setCommittee, (c) => ({ ...c, dbHeadChair: name, dbHeadChairDevice: null }));
    updateCommitteeHeadChairInDB(committee.id, name, committee.code, committee.dbChairJoinSuffix ?? undefined, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.code, committee?.dbChairJoinSuffix, myChairName, claimGavelForThisDevice]);

  // Timer — isolated: only updates the speakerTimeRemaining atom, never the committee object.
  // This prevents whole-tree re-renders every second (S1).
  // tickSpeakerTimerInDB removed — DB is synced only at pause/next/expire (S2).
  //
  // The tick RE-DERIVES from speakerAnchorRef every time; it does NOT decrement. That is
  // the whole fix: the interval is now only a repaint trigger, so losing firings (hidden
  // tab, blocked main thread, sleeping laptop) costs accuracy nothing. Still a pure
  // reader — no setCommittee, no updateLocal, no localUpdateTime (RULE 3 / RULE 4).
  useEffect(() => {
    if (timerRunning) {
      const tick = () => {
        const { base, startedAt } = speakerAnchorRef.current;
        const next = speakerRemainingNow(base, startedAt);
        setSpeakerTimeRemaining(next);
        // A ref flag, not a write: the effect keyed on `timerRunning` below does the one
        // re-anchor of the moderated-caucus total (RULE 3, nothing structural in here).
        if (next === 0) { speakerExpiredRef.current = { turn: speakerTurnKeyRef.current }; setTimerRunning(false); }
      };
      // Fire once immediately (fixes 1-second delay), then every 1000ms
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [timerRunning]);

  // Seed the speaker timer atom to the caucus speaking time when ENTERING a caucus.
  //
  // H5 — this used to fire on the initial load too (phase goes undefined → moderated-caucus,
  // which is indistinguishable from a real transition), overwriting the value the load path
  // had just reconstructed from current_speaker.started_at. A chair refreshing mid-speech in
  // a moderated caucus therefore watched the clock jump back to the full speaking time.
  // Now the first pass after a load is skipped whenever the load reconstructed a clock.
  const caucusSeedPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = committee?.phase ?? null;
    const prev = caucusSeedPhaseRef.current;
    caucusSeedPhaseRef.current = phase;
    if (phase !== 'moderated-caucus' || !committee?.caucus) return;
    if (prev === null && speakerClockHydratedRef.current) {
      // First render after a load — the DB anchor already won. Do not reseed.
      speakerClockHydratedRef.current = false;
      return;
    }
    seatSpeakerClock(committee.caucus.speakingTime, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.phase, committee?.caucus?.speakingTime]);

  // ── The TOTAL caucus clock, derived — never decremented ─────────────────────
  // `caucus.remainingTime` is the value AT `caucus.totalStartedAt`, and the two together
  // are an ANCHOR, not a live countdown. Everything that renders this clock — the
  // delegate board, the advisor view, the organiser live wall — reads it that way via
  // caucusRemainingNow.
  //
  // The chair used to be the exception: it collapsed the anchor into a "live" local
  // remainingTime and then decremented that copy once per second. So the same field meant
  // two different things on two surfaces, and the moment anything disturbed the chair's
  // decrement (a hidden tab, a blocked main thread, a refetch pinning the old value) the
  // two readings parted company with nothing to pull them back. Measured on a real
  // session: chair 9:27, delegate 8:09, DB anchor 8:07 — and the chair was frozen while
  // the delegates kept draining.
  //
  // Now the chair is just another reader of the anchor it wrote. `remainingTime` in local
  // state is only ever changed by an explicit chair action that also writes the DB, so the
  // local pair and the persisted pair stay identical by construction.
  const [caucusSeconds, setCaucusSeconds] = useState(0);
  const caucusSecondsRef = useRef(0);
  caucusSecondsRef.current = caucusSeconds;
  const caucusAnchor = committee?.caucus?.totalStartedAt ?? null;
  const caucusAnchoredRemaining = committee?.caucus?.remainingTime ?? null;
  useEffect(() => {
    // In a moderated caucus (and Tour de Table) the total is speaking time: read it capped
    // at the instant the running speaker clock reaches zero, so it stops WITH the speaker
    // even before the one re-anchor write below lands. Refs only, still a pure reader.
    const read = () => {
      const pair = caucusAnchoredRemaining === null
        ? null
        : ({ remainingTime: caucusAnchoredRemaining, totalStartedAt: caucusAnchor } as CaucusState);
      return committeePhaseRef.current === 'moderated-caucus'
        ? moderatedCaucusRemainingNow(pair, speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt)
        : caucusRemainingNow(pair);
    };
    setCaucusSeconds(read());
    // A null anchor IS the paused signal — the stored value is the literal truth and there
    // is nothing to tick.
    if (!caucusAnchor) return;
    const id = setInterval(() => setCaucusSeconds(read()), 1000);
    return () => clearInterval(id);
  }, [caucusAnchor, caucusAnchoredRemaining]);

  // H3 (local half) — entering ANY caucus stops the GSL clock on this device.
  // MotionsModal can only null `currentSpeaker` in the committee object; `timerRunning` is
  // a chair-page atom it cannot reach, so the GSL countdown kept running straight into the
  // caucus and drained the caucus total clock during the 3.5s loading screen. The DB half
  // (clearing the current_speaker row) is done in MotionsModal.
  const prevCaucusPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = committee?.phase ?? null;
    const prev = prevCaucusPhaseRef.current;
    prevCaucusPhaseRef.current = phase;
    const isCaucus = phase === 'moderated-caucus' || phase === 'unmoderated-caucus';
    const wasCaucus = prev === 'moderated-caucus' || prev === 'unmoderated-caucus';
    if (prev !== null && isCaucus && !wasCaucus) setTimerRunning(false);
  }, [committee?.phase]);

  // ── Moderated-caucus EXPIRY — the one-shot, not a countdown ─────────────────
  // The countdown itself is the derived `caucusSeconds` above; this effect only fires the
  // single structural write that ends the caucus when the derived clock reaches zero.
  // Because it is driven by a derived value rather than by a decrement, a chair whose tab
  // was asleep past the deadline ends the caucus on wake instead of sitting on a clock
  // that stopped — and it fires exactly once (expiredRef), not once per tick.
  //
  // Only the acting (head) chair runs this. A Commenter must not: it would write
  // the caucus/phase it does not own, and arming the debounce would blind it to the head
  // chair's caucus-end broadcast.
  // Log the speech of whoever holds the floor when a moderated caucus ENDS (auto-expiry or
  // the End button). Only Next used to log, so the last speaker of every caucus that ran
  // out, or was ended by hand, was silently missing from stats and scoring. That is now
  // the usual ending: the last speaker's clock is capped to the caucus's remaining time,
  // so the caucus expires the moment they finish. Room-Order placeholders are never logged
  // per turn; a Room Order Tour de Table credits every delegation on its roster snapshot with
  // ONE speech here instead (creditRoomOrderTour, idempotent per tour + country).
  const logFloorSpeechOnCaucusEnd = (c: Committee | null) => {
    if (c?.caucus && c.phase === 'moderated-caucus') void creditRoomOrderTour(c);
    if (!c?.caucus || c.phase !== 'moderated-caucus' || !c.currentSpeaker) return;
    // The one speech logger (src/lib/floorSpeech.ts): persisted anchor first (T-3), local
    // slot + extra time as the fallback, idempotent per turn, Room Order skipped. Called
    // synchronously BEFORE the caller's conditional clear, so the anchor read is queued
    // ahead of it on the current_speaker chain.
    void logFloorSpeech(c, {
      base: speakerAnchorRef.current.base,
      startedAt: speakerAnchorRef.current.startedAt,
      extraSecs: extraTimeAddedSecsRef.current,
    });
    extraTimeAddedSecsRef.current = 0;
  };
  const caucusExpiredRef = useRef(false);
  useEffect(() => {
    // Re-arm whenever a caucus with time on the clock is in play.
    if (caucusSeconds > 0) caucusExpiredRef.current = false;
  }, [caucusSeconds]);
  useEffect(() => {
    // READ THE CLOCK, DO NOT TRUST THE STATE.
    //
    // `caucusSeconds` starts at useState(0) and is only raised by the derived-clock effect
    // ABOVE — which schedules its setState inside the same passive-effect flush this one
    // runs in. So on the first commit where `committee` is non-null, this closure still
    // sees 0 and every guard below passes: a chair page that MOUNTS during a running
    // moderated caucus ended that caucus instantly, for the whole committee, with nobody
    // touching anything. A reload, a tab restore, a second device opening the chair link,
    // or a deploy-driven refresh was enough. There is no undo — the caucus JSONB is
    // overwritten with null and the queue is dropped — so a committee lost its caucus and
    // its speaker queue and had to re-raise the motion from scratch.
    //
    // Deriving the remaining time from the caucus object itself is immune: it is a pure
    // function of the persisted anchor and the wall clock, correct on the very first render.
    // Derive the role here too, for the same reason. `isViewOnly` is useState(false) set by
    // an effect, and `isViewOnlyRef` is assigned during RENDER from that same state — so on
    // the first loaded commit BOTH still say "I am the Moderator" even on a Commenter's
    // device. This is the documented derivation (AGENTS.md, Role derivation), evaluated
    // against the row we are holding right now.
    const amCommenter = !gavelRoleOf(committee).isModerator;   // name AND device
    if (amCommenter || caucusExpiredRef.current) return;
    if (committee?.phase !== 'moderated-caucus' || !committee.caucus) return;
    if (!committee.caucus.totalStartedAt) return;   // paused — a paused clock never expires
    // Capped at the speaker clock's zero: a laptop that slept past BOTH the speaker's end
    // and the uncapped total must not end a caucus that really stopped with time left.
    if (moderatedCaucusRemainingNow(committee.caucus, speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt) > 0) return;
    // R-6: a laptop that just woke (or is mid catch-up) holds a row that may be minutes
    // old. Refetch first; this effect runs again on `catchUpTick` against the fresh row.
    if (syncRef.current && !syncRef.current.isFresh()) return;
    caucusExpiredRef.current = true;
    setTimerRunning(false);
    logFloorSpeechOnCaucusEnd(committee);
    // This IS a structural write (unlike the tick that used to live here), so it arms the
    // debounce itself: the DB updates below must not flicker back in.
    localUpdateTime.current = Date.now();
    // The DB writes are issued HERE, once, from the row this effect checked. They used to
    // sit inside the setCommittee updater, which React may run twice (StrictMode), so every
    // expiry could issue its clear and its phase write twice.
    // H4 — clear the current_speaker DB ROW as well as local state. Without this the row
    // still holds the caucus speaker (with started_at set), so the next chair refresh
    // resurrects them as the GSL current speaker, and the following "Next" logs their
    // speaking time a second time. Conditional and serialised against nextSpeaker(), so it
    // is not the blind clear MUST NEVER HAPPEN #5 forbids.
    if (committee.currentSpeaker) {
      clearCurrentSpeakerIfUnchanged(
        committee.id, committee.currentSpeaker.delegateId, committee.currentSpeaker.country,
        committee.code, committee.dbChairJoinSuffix ?? undefined,
      );
    }
    // One update (R-7), and CONDITIONAL (R-6): it lands only while the stored row is still
    // this caucus (same phase, same total-clock anchor; the guard above guarantees there is
    // one). If another device has meanwhile started a new caucus, paused, extended or ended
    // this one, nothing is written (a skip, not reported). A real failure is retried and
    // reported by writeStatus. Either way a non-landing drops the window and refetches, so
    // the local optimistic end is replaced by the truth.
    void endModeratedCaucusIfAnchorUnchanged(committee.id, committee.caucus.totalStartedAt, committee.code, committee.dbChairJoinSuffix ?? undefined)
      .then((landed) => { if (!landed) { localUpdateTime.current = 0; syncRef.current?.catchUp(undefined, { force: true }); } });
    updateLocal(setCommittee, (prev) => {
      if (!prev?.caucus || prev.phase !== 'moderated-caucus') return prev;
      // Auto-expiry must mirror the manual End button: clear the caucus and its speaker but
      // NEVER prepend the current caucus speaker (or a Room-Order "Speaker N" placeholder)
      // into the permanent GSL. The GSL is returned exactly as it was before the caucus.
      return { ...prev, caucus: null, phase: 'speakers-list' as const, caucusQueue: [], currentSpeaker: null, speakersList: prev.speakersList };
    }, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caucusSeconds, committee?.phase, isViewOnly, catchUpTick]);

  // ── A speaker's clock ran out → the moderated-caucus TOTAL stops with it ─────
  // The total is time spent speaking. Before this, the speaker tick stopped only its own
  // clock, so `caucus.totalStartedAt` stayed armed and the total kept draining on every
  // device while nobody held the floor, until the chair pressed Next. Now, once, when the
  // speaker clock reaches zero by itself: stamp `remainingTime` with the total read AT the
  // speaker's zero and null the anchor (the same re-anchor a Pause does). One write, keyed
  // on the `timerRunning` boolean, never per second, never structural (RULE 3 / RULE 4).
  // When the total is itself used up, nothing is written here: the expiry effect above
  // ends the caucus cleanly. Moderator only, derived from the row like the expiry effect.
  //
  // Both writes are CONDITIONAL, because they are fire-and-forget and a fast Next can
  // overtake them: the caucus write applies only while the stored caucus still names this
  // speaker AND still carries the anchor we read (Next, pause, restart and end all change
  // one of those), and the current_speaker write applies only while the row still holds
  // this speaker and rides the same per-committee chain as nextSpeaker, so it can never land
  // after a Next issued later.
  const reanchorCaucusAtSpeakerZero = (c: Committee, base: number, startedAt: string | null) => {
    if (c.phase !== 'moderated-caucus' || !c.caucus?.totalStartedAt) return;
    if (c.endedAt || c.suspendedAt) return;
    if (!gavelRoleOf(c).isModerator) return;   // name AND device
    const liveTotal = moderatedCaucusRemainingNow(c.caucus, base, startedAt);
    if (liveTotal <= 0) return;   // the expiry effect ends the caucus
    const expected = { currentSpeaker: c.caucus.currentSpeaker ?? null, totalStartedAt: c.caucus.totalStartedAt };
    const anchored = anchorCaucusClock(c.caucus, liveTotal, false);
    const turn = speakerTurnKey(c);
    updateLocal(setCommittee, (x) => (
      x.caucus && x.phase === 'moderated-caucus'
        && x.caucus.totalStartedAt === expected.totalStartedAt && speakerTurnKey(x) === turn
        ? { ...x, caucus: anchored } : x
    ), false);
    updateCaucusIfUnchangedInDB(c.id, anchored, expected, c.code, c.dbChairJoinSuffix ?? undefined);
    // Park the speaker clock at a literal zero too, so no reader keeps an armed anchor.
    seatSpeakerClock(0, null);
    stopSpeakerAtZeroIfUnchangedInDB(
      c.id, c.currentSpeaker?.delegateId ?? null, c.currentSpeaker?.country ?? null,
      c.code, c.dbChairJoinSuffix ?? undefined,
    );
  };
  useEffect(() => {
    if (timerRunning) { speakerExpiredRef.current = null; return; }
    const expired = speakerExpiredRef.current;
    if (!expired) return;
    // R-6: the zero may be the first tick after a wake. Keep the flag and refetch first;
    // this effect runs again on `catchUpTick`, where the turn check below sees the fresh row.
    if (syncRef.current && !syncRef.current.isFresh()) return;
    speakerExpiredRef.current = null;
    if (!committee || sessionEnded || sessionSuspended) return;
    // The floor changed hands between the zero and this effect: nothing to re-anchor.
    if (speakerTurnKey(committee) !== expired.turn) return;
    const { base, startedAt } = speakerAnchorRef.current;
    reanchorCaucusAtSpeakerZero(committee, base, startedAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, catchUpTick]);

  // The same re-anchor when NO Moderator was watching the zero: the speaker's clock ran
  // out during a reload or while the gavel was changing hands, so the tick above never
  // fired and `caucus.totalStartedAt` is still armed in the DB. Checked once per load
  // (here) and once on gaining the gavel (the ROLE TRANSITION effect). Reads the anchor the
  // loader seated; declared after the load-claim effect so a newly opened same-name device
  // already carries its pin and derives Moderator.
  const zeroReanchorCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!committee?.id || accessState !== 'allowed') return;
    if (zeroReanchorCheckedRef.current === committee.id) return;
    zeroReanchorCheckedRef.current = committee.id;
    if (timerRunningRef.current) return;
    const { base, startedAt } = speakerAnchorRef.current;
    if (!startedAt) {
      // LEGACY: a moderated total left armed with NO speaker clock running (written before
      // the total stopped with its speaker). It drained on every device while nobody spoke.
      // Pause it once, at its live value capped to the caucus's own total, conditional on
      // the anchor and floor we read, so a newer press on another device wins.
      const c = committee;
      if (c.phase !== 'moderated-caucus' || !c.caucus?.totalStartedAt || c.endedAt || c.suspendedAt) return;
      if (!gavelRoleOf(c).isModerator) return;
      const total = Number.isFinite(c.caucus.totalTime) && c.caucus.totalTime > 0 ? c.caucus.totalTime : Infinity;
      const live = Math.min(caucusRemainingNow(c.caucus), total);
      if (live <= 0) return;   // out of time: the expiry effect ends it
      const expected = { currentSpeaker: c.caucus.currentSpeaker ?? null, totalStartedAt: c.caucus.totalStartedAt };
      const anchored = anchorCaucusClock(c.caucus, live, false);
      updateLocal(setCommittee, (x) => (
        x.caucus && x.phase === 'moderated-caucus' && x.caucus.totalStartedAt === expected.totalStartedAt
          ? { ...x, caucus: anchored } : x
      ), false);
      updateCaucusIfUnchangedInDB(c.id, anchored, expected, c.code, c.dbChairJoinSuffix ?? undefined);
      return;
    }
    if (speakerRemainingNow(base, startedAt) > 0) return;
    reanchorCaucusAtSpeakerZero(committee, base, startedAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, accessState]);

  // RTR overlay countdown — fully independent of speakersList/DB
  useEffect(() => {
    if (rtrTimerActive) {
      rtrIntervalRef.current = setInterval(() => {
        setRtrTimeRemaining((prev) => {
          if (prev <= 1) { setRtrTimerActive(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (rtrIntervalRef.current) { clearInterval(rtrIntervalRef.current); rtrIntervalRef.current = null; }
    }
    return () => { if (rtrIntervalRef.current) { clearInterval(rtrIntervalRef.current); rtrIntervalRef.current = null; } };
  }, [rtrTimerActive]);

  // Right of Reply and Add time STICK (owner, 17 Sep 2026: "make them stick no matter what,
  // except when going into a different motion"). Starting or pausing a clock, Next, Finish,
  // a removed speaker, a grant and Restart leave both panels open. They close only when the
  // MOTION CONTEXT changes: any phase change (a caucus starting or ending, voting, adjourned),
  // Suspend, End, or another caucus accepted over a running one (type / proposer / purpose /
  // tour instance change). Press-driven values only, never a per-second value, and no
  // setCommittee / updateLocal / localUpdateTime (RULES 3 and 4). Nothing is logged here: a
  // reply was logged when it was granted.
  const floorCloseKey = `${committee?.phase ?? ''}|${committee?.suspendedAt ?? ''}|${committee?.endedAt ?? ''}|${sessionSuspended ? 's' : ''}${sessionEnded ? 'e' : ''}|${committee?.caucus?.type ?? ''}|${committee?.caucus?.proposedBy ?? ''}|${committee?.caucus?.purpose ?? ''}|${committee?.caucus?.tourStartedAt ?? ''}`;
  const prevFloorCloseRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevFloorCloseRef.current;
    prevFloorCloseRef.current = floorCloseKey;
    if (prev === null || prev === floorCloseKey) return;
    setPopover('extraTime', false);
    if (!rtrOpen && !openPopovers.rightToReply) return;
    setPopover('rightToReply', false);
    setRtrOpen(false);
    setRtrTimerActive(false);
    setRtrCountry('');
    setRtrTimeRemaining(rtrSeconds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorCloseKey]);

  // ── Gavel knock when time is nearly up ──────────────────────────────────────
  // A pure READ of the timer values above (RULES 3 and 4): no setCommittee, no
  // updateLocal, no localUpdateTime, no DB write. Moderator's device only, so one laptop
  // knocks per room. The role and the ended/suspended state are derived from the row
  // itself as well as from state, because both states lag the first loaded commit.
  // The store is hydrated from the DB once, at load, so a change made on ANOTHER chair's
  // laptop (then a gavel handover) would otherwise leave this device knocking at the old
  // mark. Copy the two gavel keys across whenever the realtime row carries new values.
  // A change made HERE lands in the store first and the echo writes the same value back.
  const dbGavelOn = committee?.dbSettings?.gavelSoundEnabled;
  const dbGavelAt = committee?.dbSettings?.gavelSoundAtSeconds;
  const gavelCode = committee?.code;
  useEffect(() => {
    if (!gavelCode) return;
    if (typeof dbGavelOn === 'boolean') updateSetting(gavelCode, 'gavelSoundEnabled', dbGavelOn);
    if (typeof dbGavelAt === 'number') updateSetting(gavelCode, 'gavelSoundAtSeconds', dbGavelAt);
  }, [gavelCode, dbGavelOn, dbGavelAt, updateSetting]);
  const gavelSettings = committee ? getSettings(committee.code) : null;
  // Name AND device (src/lib/gavelDevice.ts): a same-name phone must never knock too.
  const gavelCue: GavelCue = {
    armed: !!committee && gavelSettings?.gavelSoundEnabled !== false
      && !isViewOnly && gavelRoleOf(committee).isModerator
      && !sessionEnded && !sessionSuspended && !committee.endedAt && committee.phase !== 'adjourned',
    atSeconds: gavelSettings?.gavelSoundAtSeconds ?? 15,
    scope: committee?.code,
  };
  // One speaker clock serves the GSL, the moderated caucus and Tour de Table.
  // Each clock passes its anchor identity: the knock needs a continuous countdown step on
  // one anchor (src/lib/useGavelCue.ts), never a reseat, a catch-up or a woken tab's jump.
  useGavelCue(speakerTimeRemaining, timerRunning, gavelCue, speakerClockEpoch);
  // The unmoderated / Consultation total. The moderated caucus total is left out on
  // purpose: its speakers already knock, and two knocks at once would say nothing.
  useGavelCue(caucusSeconds, committee?.caucus?.type === 'unmoderated' && !!caucusAnchor, gavelCue, `${caucusAnchor}|${caucusAnchoredRemaining}`);
  useGavelCue(rtrTimeRemaining, rtrTimerActive, gavelCue, rtrCountry);

  // ── A speech starts → leave the Roll Call tab for the queue ─────────────────
  // The Roll Call tab (showSliders) sorts A-Z; the owner's rule is that any speech start
  // (GSL Start / Next / call first, moderated-caucus Next, Tour de Table advance) goes back
  // to the queue, and RollCallPanel then scrolls to the top. One effect over press-driven
  // values covers every path: the floor speaker, the caucus speaker and the clock's
  // running BOOLEAN (false → true only). Nothing per second, no setCommittee, no
  // updateLocal, no localUpdateTime (RULES 3 and 4). Right of Reply touches none of them.
  const speechStartKey = `${committee?.currentSpeaker?.delegateId ?? ''}|${committee?.caucus?.currentSpeaker ?? ''}`;
  const prevSpeechStartRef = useRef<{ key: string; running: boolean } | null>(null);
  useEffect(() => {
    const prev = prevSpeechStartRef.current;
    prevSpeechStartRef.current = { key: speechStartKey, running: timerRunning };
    if (!prev) return;                                         // first pass: baseline only
    const newSpeaker = speechStartKey !== prev.key && speechStartKey !== '|';
    const clockStarted = timerRunning && !prev.running;
    if (newSpeaker || clockStarted) setShowSliders(false);
  }, [speechStartKey, timerRunning]);

  // Keep delegateStatusRef in sync with DB truth (realtime events, initial load).
  // Cycles update the ref immediately; this effect reconciles external changes.
  useEffect(() => {
    if (!committee?.delegates) return;
    const incoming = new Map(committee.delegates.map((d) => [d.id, d.status]));
    // Only overwrite entries that have NOT been dirtied by a pending cycle
    // (i.e. entries not currently "in flight"). Simplest safe approach: full replace.
    delegateStatusRef.current = incoming;
  }, [committee?.delegates]);

  const prevPhaseRef = useRef<string | null>(null);

  // Tutorial — fires once on first pre-session → speakers-list transition
  useEffect(() => {
    if (!committee) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = committee.phase;
    if (committee.phase === 'speakers-list' && prev === 'pre-session') {
      const key = 'gavelling_tutorial_seen_' + committee.id;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setShowTutorial(true);
      }
    }
  }, [committee?.phase, committee?.id]);

  // Stable Set references — prevents RollCallPanel re-renders when only timer ticks
  const gslListIds = useMemo(
    () => {
      const ids = new Set((committee?.speakersList ?? []).map((s) => s.delegateId));
      if (committee?.currentSpeaker?.delegateId) ids.add(committee.currentSpeaker.delegateId);
      return ids;
    },
    [committee?.speakersList, committee?.currentSpeaker]
  );
  const caucusQueueIds = useMemo(
    () => new Set((committee?.caucusQueue ?? []).map((s) => s.delegateId)),
    [committee?.caucusQueue]
  );

  const caucusRollCallCommittee = useMemo(
    () => committee ? { ...committee, speakersList: committee.caucusQueue ?? [], currentSpeaker: null } : null,
    // caucus / pendingMotions / endedAt too: RollCallPanel's memo compares all three, and a
    // snapshot missing them kept the OLD caucus speaker at #1 of the sidebar queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [committee?.caucusQueue, committee?.delegates, committee?.phase, committee?.caucus, committee?.pendingMotions, committee?.endedAt]
  );

  // ── Stable callbacks (must be before early returns — Rules of Hooks) ──────────

  // Cycle a delegate's roll-call status using a mutable ref so rapid clicks always
  // read the post-previous-click status, not a stale render closure.
  const handleCycleStatus = useCallback((delegateId: string) => {
    const current = delegateStatusRef.current.get(delegateId);
    if (current === undefined) return;
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    delegateStatusRef.current.set(delegateId, next); // Update ref immediately before re-render
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status: next } : d),
      ...(next === 'absent' && c.phase !== 'pre-session' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, next, committeeCodeRef.current, chairSuffixRef.current);
    if (next === 'absent' && committeePhaseRef.current !== 'pre-session') {
      removeFromSpeakersListInDB(committeeIdRef.current, delegateId, committeeCodeRef.current, chairSuffixRef.current);
      removeFromCaucusListInDB(committeeIdRef.current, delegateId, committeeCodeRef.current, chairSuffixRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddToSpeakersList = useCallback((delegateId: string) => {
    if (!committee) return;
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    const alreadyOn = committee.speakersList.some((s) => s.delegateId === delegateId);
    if (alreadyOn) return;
    if (committee.currentSpeaker?.delegateId === delegateId) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: [...c.speakersList, { delegateId, country: delegate.country }] }), true);
    addToSpeakersListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.delegates, committee?.speakersList, committee?.currentSpeaker]);

  const handleRemoveFromSpeakersList = useCallback((delegateId: string) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId) }), true);
    removeFromSpeakersListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleReorderSpeakersList = useCallback((newList: { delegateId: string; country: string }[]) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, committee.code, committee.dbChairJoinSuffix ?? undefined, 'gsl');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  // The caucus queue's reorder, stable across renders (it used to be an inline arrow, which
  // defeated RollCallPanel's memo on every page render, timer ticks included).
  const handleReorderCaucusQueue = useCallback((newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    reorderSpeakersListInDB(committeeIdRef.current, newList, committeeCodeRef.current, chairSuffixRef.current, 'caucus');
  }, []);

  const handleStatusChange = useCallback((delegateId: string, status: DelegateStatus) => {
    if (!committee) return;
    // Pin this row against any refetch whose snapshot predates the write below.
    pendingStatusWrites.current[delegateId] = { value: status, at: Date.now() };
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status } : d),
      ...(status === 'absent' && c.phase !== 'pre-session' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    void setDelegateStatusInDB(delegateId, status, committee.code, committee.dbChairJoinSuffix ?? undefined).then((ok) => {
      if (ok) return;
      // Refused (or failed): unpin and read the roster back, so the slider shows the truth.
      if (pendingStatusWrites.current[delegateId]?.value === status) delete pendingStatusWrites.current[delegateId];
      syncRef.current?.mark('delegates', 0);
    });
    if (status === 'absent' && committee.phase !== 'pre-session') {
      removeFromSpeakersListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
      removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.phase]);

  // Roll call "All present / All present+voting / Clear" (PERF-2): ONE optimistic update and
  // ONE statement (set_delegate_statuses) instead of one UPDATE, one realtime event and one
  // refetch per delegate. Every row is pinned exactly like a single status change. The bulk
  // buttons exist only in pre-session, so no list removal is needed; if one is ever offered
  // mid-session, going absent still drops the delegates from both lists. Only when the RPC
  // does not exist (PGRST202) does it fall back to per-row writes; a refusal unpins the rows
  // and reads the roster back.
  const handleBulkStatusChange = useCallback((status: DelegateStatus, ids: string[]) => {
    if (!committee || ids.length === 0) return;
    const at = Date.now();
    const idSet = new Set(ids);
    ids.forEach((id) => { pendingStatusWrites.current[id] = { value: status, at }; });
    const dropFromLists = status === 'absent' && committee.phase !== 'pre-session';
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => idSet.has(d.id) ? { ...d, status } : d),
      ...(dropFromLists ? {
        speakersList: c.speakersList.filter((s) => !idSet.has(s.delegateId)),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => !idSet.has(s.delegateId)),
      } : {}),
    }), true);
    const suffix = committee.dbChairJoinSuffix ?? undefined;
    const allIds = committee.delegates.length === ids.length && committee.delegates.every((d) => idSet.has(d.id));
    void setDelegateStatusesBulkInDB(committee.id, status, allIds ? null : ids, committee.code, suffix).then((n) => {
      if (typeof n === 'number') return;
      if (n === 'unavailable') {
        ids.forEach((id) => setDelegateStatusInDB(id, status, committee.code, suffix));
        return;
      }
      // Refused or failed: unpin and read the roster back rather than showing a roll call
      // that never landed.
      ids.forEach((id) => { if (pendingStatusWrites.current[id]?.at === at) delete pendingStatusWrites.current[id]; });
      syncRef.current?.mark('delegates', 0);
    });
    if (dropFromLists) {
      ids.forEach((id) => {
        removeFromSpeakersListInDB(committee.id, id, committee.code, suffix);
        removeFromCaucusListInDB(committee.id, id, committee.code, suffix);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.phase, committee?.delegates, committee?.code, committee?.dbChairJoinSuffix]);

  // ── Taking the speaker holding the floor off it ─────────────────────────────
  // `handleRemoveCurrentSpeaker` (defined with the other action handlers, below the early
  // returns) is published through this ref, so the memoised sidebar gets ONE stable
  // callback and the absent effect below always calls the handler of the latest render.
  const removeCurrentSpeakerRef = useRef<((delegateId?: string) => void) | null>(null);
  const stableRemoveCurrentSpeaker = useCallback((delegateId: string) => {
    removeCurrentSpeakerRef.current?.(delegateId);
  }, []);
  /** "Whoever holds the floor right now", for the strip X (no delegate id to check against). */
  const stableRemoveFloorSpeaker = useCallback(() => {
    removeCurrentSpeakerRef.current?.();
  }, []);
  // The speaker holding the floor was marked ABSENT (sidebar status, the Roll Call tab, the
  // delegate's own phone, another chair device): they leave the floor too. Their speech is
  // logged first; both lists already drop an absent delegate. Never in pre-session roll call
  // (RULE 7) and never during a break. The handler itself checks Moderator, ended and
  // suspended, and derives who holds the floor from the row it is handed.
  const floorAbsentId = (() => {
    if (!committee) return '';
    let id = committee.currentSpeaker?.delegateId ?? '';
    if (!id && committee.phase === 'moderated-caucus' && committee.caucus?.currentSpeaker) {
      id = committee.delegates.find((d) => d.country === committee.caucus!.currentSpeaker)?.id ?? '';
    }
    if (!id) return '';
    return committee.delegates.find((d) => d.id === id)?.status === 'absent' ? id : '';
  })();
  // Whether THIS render may take a speaker off the floor. Evaluated from this render's live
  // values (not the handler's closure, which can predate a kick or a handover), and part of
  // the deps, so the effect re-runs when this device becomes the Moderator later. A re-run
  // after a removal finds `floorAbsentId` empty; a racing repeat is deduped by the turnKey.
  const floorRemovalAllowed = !!committee && !deviceLock.kicked && !sessionEnded && !sessionSuspended
    && !isViewOnly && gavelRoleOf(committee).isModerator;
  useEffect(() => {
    if (!floorAbsentId || !committee || !floorRemovalAllowed) return;
    if (committee.phase === 'pre-session' || committee.phase === 'adjourned' || (committee.phase as string) === 'roll-call') return;
    // A laptop that just woke holds an old row: refetch first, re-run on catchUpTick.
    if (syncRef.current && !syncRef.current.isFresh()) return;
    removeCurrentSpeakerRef.current?.(floorAbsentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorAbsentId, catchUpTick, floorRemovalAllowed]);

  // RollCallPanel recognised an absent delegate (clicked onto a list): drop that country's
  // waiting-room request from local state. The panel deletes the motion row itself, after
  // the status write lands. Functional updater, so no stale committee is captured.
  const handleJoinRequestResolved = useCallback((country: string) => {
    updateLocal(setCommittee, (c) => {
      const pm = c.pendingMotions ?? [];
      const next = pm.filter((m) => !((m.type as string) === 'join-request' && m.proposedBy === country));
      return next.length === pm.length ? c : { ...c, pendingMotions: next };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The typed add bars recognise an absent delegate the same way the sidebar row click does:
  // the status their waiting-room request asked for, the request dropped locally, and the
  // motion deleted only after the status write lands. The caller adds them to the list next.
  const recogniseAbsentDelegate = useCallback((delegateId: string) => {
    if (!committee || committee.endedAt) return;
    const d = committee.delegates.find((x) => x.id === delegateId);
    if (!d || d.status !== 'absent') return;
    const desired = recognisedStatus(committee.pendingMotions, d.country, d.isObserver === true);
    handleStatusChange(d.id, desired);
    handleJoinRequestResolved(d.country);
    resolveJoinRequestsOnAdmit(committee.id, d.id, d.country, desired, committee.code, committee.dbChairJoinSuffix ?? undefined);
  }, [committee, handleStatusChange, handleJoinRequestResolved]);

  // Can the moderated-caucus queue take this delegate right now? The sidebar asks BEFORE it
  // marks an absent delegate Present, so a full queue never leaves someone Present but not
  // queued; on "no" it raises the queue-full notification (top right). Read through a ref, assigned every
  // render, so the memoised RollCallPanel always gets the live caucus and speaker clock
  // behind one stable callback. Same capacity rule as the main caucus view, read LIVE.
  const caucusRoomRef = useRef<(delegateId: string) => boolean>(() => true);
  caucusRoomRef.current = (delegateId: string) => {
    const c = committee;
    if (!c?.caucus || c.caucus.type !== 'moderated') return true;
    const queue = c.caucusQueue ?? [];
    const d = c.delegates.find((x) => x.id === delegateId);
    if (queue.some((s) => s.delegateId === delegateId) || (d && c.caucus.currentSpeaker === d.country)) return true;
    const cap = caucusQueueCapacity(
      moderatedCaucusRemainingNow(c.caucus, speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt),
      c.caucus.speakingTime,
      queue.length,
      c.currentSpeaker ? speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt) : 0,
    );
    if (queue.length < cap) return true;
    notifyCaucusQueueFull(t);
    return false;
  };
  const canAddToCaucusQueue = useCallback((delegateId: string) => caucusRoomRef.current(delegateId), []);

  // A seat added from the inline seat field (SeatAddField, beside the quorum tabs) is created PRESENT, in
  // roll call and mid-session alike: a chair adds a seat because that delegation is in the
  // room right now, and having to add it and then answer roll for it was two steps for one
  // fact. The observer flag rides along in the same INSERT, so a seat never flashes as a
  // voting delegation before a second write makes it an observer.
  const handleDelegateAdd = useCallback(async (country: string, options?: { observer?: boolean }) => {
    if (!committee) return;
    const observer = options?.observer === true;
    const { addDelegate: addDelegateInDB } = await import('@/lib/committeeService');
    const realId = await addDelegateInDB(committee.id, country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'present', observer);
    if (realId) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        delegates: [...c.delegates, { id: realId, country, status: 'present', isObserver: observer }],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  // Prevent browser back button from leaving an active session.
  // When sessionEnded or sessionSuspended become true the effect re-runs,
  // the cleanup removes the listener, and the early return skips re-adding it.
  useEffect(() => {
    if (sessionEnded || sessionSuspended) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sessionEnded, sessionSuspended]);

  useEffect(() => {
    if (!sessionEnded && !sessionSuspended) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/sessions'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionEnded, sessionSuspended, router]);

  // Previous lifecycle stamps, so a stamp that goes BACK to null (MotionsModal rolling back a
  // Suspend / End whose write failed, R-5) also drops the overlay. Only that transition
  // clears it: a legacy 'adjourned' row that never carried suspended_at is left alone.
  const prevLifecycleRef = useRef<{ endedAt: string | null; suspendedAt: string | null }>({ endedAt: null, suspendedAt: null });
  useEffect(() => {
    const prev = prevLifecycleRef.current;
    const endedAt = committee?.endedAt ?? null;
    const suspendedAt = committee?.suspendedAt ?? null;
    prevLifecycleRef.current = { endedAt, suspendedAt };
    if (endedAt) {
      setSessionEnded(true);
      setSessionSuspended(false);
      localStorage.removeItem('gavelling-rejoin');
    } else if (suspendedAt) {
      setSessionSuspended(true);
      setSessionEnded(false);
    } else {
      if (prev.endedAt) setSessionEnded(false);
      if (prev.suspendedAt) setSessionSuspended(false);
    }
  }, [committee?.endedAt, committee?.suspendedAt]);

  useEffect(() => {
    if (sessionSuspended) setSuspendTab('suspend');
  }, [sessionSuspended]);

  // C-1 / G-4 (local half): a suspended or ended session owns no running clock. suspendDebate
  // and endDebate freeze the DB anchors; this stops this device's tick at the live value so
  // it cannot run on under the overlay and fire a stop-at-zero write mid-break. A read-only
  // side effect (RULES 3 and 4): no setCommittee, no debounce, no DB write.
  useEffect(() => {
    if (!sessionSuspended && !sessionEnded) return;
    setTimerRunning(false);
    const { base, startedAt } = speakerAnchorRef.current;
    if (startedAt) seatSpeakerClock(speakerRemainingNow(base, startedAt), null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSuspended, sessionEnded]);

  const caucusLoadingFiredRef = useRef(false);
  const prevCaucusKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (committee?.phase === 'moderated-caucus' && committee.caucus) {
      const caucusKey = `${committee.phase}-${committee.caucus.proposedBy}-${committee.caucus.totalTime}`;
      if (prevCaucusKeyRef.current !== caucusKey) {
        prevCaucusKeyRef.current = caucusKey;
        caucusLoadingFiredRef.current = false;
      }
      if (!caucusLoadingFiredRef.current) {
        caucusLoadingFiredRef.current = true;
        setCaucusPanelLocked(true);
        setCaucusLoading(true);
        const t = setTimeout(() => setCaucusLoading(false), 3500);
        return () => clearTimeout(t);
      }
    } else {
      prevCaucusKeyRef.current = null;
      caucusLoadingFiredRef.current = false;
      setCaucusPanelLocked(false);
    }
  }, [committee?.phase, committee?.caucus?.proposedBy, committee?.caucus?.totalTime]);

  const unmodLoadingFiredRef = useRef(false);
  const prevUnmodKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (committee?.phase === 'unmoderated-caucus' && committee.caucus) {
      const unmodKey = `${committee.phase}-${committee.caucus.proposedBy}-${committee.caucus.totalTime}`;
      if (prevUnmodKeyRef.current !== unmodKey) {
        prevUnmodKeyRef.current = unmodKey;
        unmodLoadingFiredRef.current = false;
      }
      if (!unmodLoadingFiredRef.current) {
        unmodLoadingFiredRef.current = true;
        setUnmodLoading(true);
        const t = setTimeout(() => setUnmodLoading(false), 3000);
        return () => clearTimeout(t);
      }
    } else {
      prevUnmodKeyRef.current = null;
      unmodLoadingFiredRef.current = false;
    }
  }, [committee?.phase, committee?.caucus?.proposedBy, committee?.caucus?.totalTime]);

  useEffect(() => {
    if (!committee?.expiresAt) { setHoursRemaining(null); return; }
    function calc() {
      const ms = new Date(committee!.expiresAt!).getTime() - serverNow();
      setHoursRemaining(Math.max(1, Math.ceil(ms / (1000 * 60 * 60))));
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [committee?.expiresAt]);

  // Read-state (per conversation) is owned here and mutated by ChatPanel via
  // onReadCountsChange while the panel is open; the header badge below reads the same
  // map. Persist it across reloads (mirrors the delegate view) so the badge reflects
  // genuinely new messages, not the whole backlog, after every refresh.
  // Keyed by READER, not just by committee: two chairs on one dais laptop (or a chair who
  // also opens the delegate view) used to share `chat-read-${code}` and overwrite each
  // other, resurrecting badges on threads they had already read. See src/lib/chatReadKey.ts.
  useEffect(() => {
    if (!committee?.code) return;
    const stored = loadChatReadCounts(committee.code, { role: 'chair', identity: myChairName });
    if (stored) setChatReadCounts(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.code, myChairName]);

  useEffect(() => {
    if (!committee?.code) return;
    saveChatReadCounts(committee.code, { role: 'chair', identity: myChairName }, chatReadCounts);
  }, [chatReadCounts, committee?.code, myChairName]);

  // ── Sidebar width ─────────────────────────────────────────────────────────
  // Adopted after mount (localStorage is an external store; reading it during
  // render would desync the server markup). Keyed by READER for the same
  // reason the chat read-state is — two chairs on one dais laptop must not
  // resize the roster for each other. See src/lib/sidebarWidth.ts.
  useEffect(() => {
    const stored = loadSidebarWidth({ role: 'chair', identity: myChairName });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setSidebarWidth(stored);
  }, [myChairName]);

  // One commit per gesture (pointer release, or one keypress on the focused
  // separator) — never per frame. Writes localStorage and nothing else: no DB
  // write, no committee mutation, so `localUpdateTime` stays where it was.
  const handleSidebarResize = useCallback((next: number) => {
    setSidebarWidth(next);
    saveSidebarWidth({ role: 'chair', identity: myChairName }, next);
  }, [myChairName]);

  // Collapsed sidebar: adopted after mount like the width, one write per toggle. Mod+\
  // toggles it (never while typing in a field).
  useEffect(() => {
    const stored = loadSidebarCollapsed({ role: 'chair', identity: myChairName });
    if (stored !== null) setSidebarCollapsed(stored);
  }, [myChairName]);
  const toggleSidebarCollapsed = useCallback((next?: boolean) => {
    setSidebarCollapsed((prev) => {
      const value = typeof next === 'boolean' ? next : !prev;
      saveSidebarCollapsed({ role: 'chair', identity: myChairName }, value);
      return value;
    });
  }, [myChairName]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '\\' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      toggleSidebarCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebarCollapsed]);

  // ── Notifications ─────────────────────────────────────────────────────────
  // See src/lib/sessionNotifications.ts for the four rules this obeys. The store is
  // headless and module-level, so everything below is a pure producer: it never
  // touches committee state, never arms the structural debounce, and never awaits a
  // DB write (the actions delegate straight to the existing optimistic handlers).

  // Suppress while a delegate is actually speaking. Keyed on the `timerRunning`
  // BOOLEAN, never on the per-second `speakerTimeRemaining` atom (RULE 3/4) — this
  // effect must not re-run once a second. `timerRunning` drives both the GSL clock and
  // the moderated-caucus speaker clock (they share this atom), so one effect covers
  // both. Suppression only HIDES: TTLs pause and nothing is dropped (rule 2), so a
  // request raised mid-speech is still waiting when the gavel comes down.
  //
  // Every exit from a running clock lands back here because they all go through
  // `setTimerRunning(false)`: pause (`handleToggleTimer`), Next on the GSL
  // (`handleNextSpeaker`) and in caucus (`handleNextCaucusSpeaker`), restart
  // (`handleRestartTime`), and the tick itself when it reaches zero. Unmount is covered
  // by the cleanup — the store is module-level, so leaving `suppressed` armed on the way
  // out would hide the stack for good on the next mount.
  useEffect(() => {
    setNotificationsSuppressed(timerRunning);
    return () => setNotificationsSuppressed(false);
  }, [timerRunning]);

  // GSL speak requests → one card per pending `gsl-request` motion.
  const pendingMotions = committee?.pendingMotions;
  useEffect(() => {
    const requests = (pendingMotions ?? []).filter((m) => (m.type as string) === 'gsl-request');
    const liveKeys = new Set<string>();

    for (const m of requests) {
      // Optimistic temp ids are replaced by the real UUID a moment later (AGENTS.md,
      // MOTIONS MODAL). Keying on a temp id would mint a SECOND card the instant the
      // UUID lands, and the reject write would fire against an id the DB never had.
      if (m.id.startsWith('temp-')) continue;
      const key = notifyKey.gsl(m.id);
      liveKeys.add(key);
      if (raisedGslKeysRef.current.has(key)) continue;

      let delegateId = '';
      try { delegateId = JSON.parse(m.topic).delegateId; } catch {}
      if (!delegateId) continue;

      const motionId = m.id;
      const country = m.proposedBy;
      const found = getCountryByName(country);
      raisedGslKeysRef.current.add(key);
      notify({
        key,
        kind: 'gsl-request',
        flagCode: found?.code,
        title: getCountryDisplayName(country, language),
        body: t('notif_gsl_requests_addition'),
        // STICKY, and it has to be. This card is now the ONLY chair-side affordance for a
        // GSL request: the full-width banner below the header is gone, and MotionsModal
        // filters `gsl-request` out of every list it draws. A re-request from the delegate
        // cannot resurrect an expired card either — `requestGslSpot` is idempotent
        // (committeeService.ts:844), so it writes nothing, emits no realtime event, and
        // reuses the motion id this device has already marked as raised. A 60s TTL would
        // therefore strand the delegate waiting on an answer nobody can still give.
        // The chair clears it deliberately instead: Accept, Reject, or the card's x.
        ttlMs: null,
        actions: [
          {
            id: 'accept',
            label: t('notif_accept'),
            tone: 'accept',
            run: () => gslActionsRef.current.approve(motionId, delegateId, country),
          },
          {
            id: 'reject',
            label: t('notif_reject'),
            tone: 'reject',
            run: () => gslActionsRef.current.deny(motionId),
          },
        ],
        // Unreachable while `ttlMs` is null, and kept as the explicit statement of what
        // must happen if anyone ever puts a TTL back: the CARD leaves, the MOTION does
        // not. Deleting the row here would silently deny a delegate who is still waiting
        // for an answer. The same rule governs the card's x — dismissing is not deciding.
        onExpire: () => {},
      });
    }

    // Anything that left the pending list was approved or denied elsewhere — in
    // MotionsModal on this device, in the banner, or by a Commenter over realtime.
    // Pull its card immediately so the stack cannot offer a dead action.
    for (const key of Array.from(raisedGslKeysRef.current)) {
      if (liveKeys.has(key)) continue;
      raisedGslKeysRef.current.delete(key);
      dismissNotification(key);
    }
  }, [pendingMotions, language, t]);

  // Chat → CO-CHAIR ONLY, and never with message content.
  const chatMessages = committee?.messages;
  useEffect(() => {
    const committeeId = committee?.id ?? null;
    if (!committeeId) return;
    // Fresh committee (or first load) — adopt the whole backlog as already seen.
    if (seenChatCommitteeRef.current !== committeeId) {
      seenChatCommitteeRef.current = committeeId;
      seenChatIdsRef.current = new Set((chatMessages ?? []).map((m) => m.id));
      return;
    }
    const seen = seenChatIdsRef.current ?? new Set<string>();
    seenChatIdsRef.current = seen;

    for (const m of chatMessages ?? []) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      // Consumed either way — marking before the guards means closing the chat panel
      // cannot burst cards for messages the chair already had on screen.
      if (!isViewOnly) continue;                       // head chair gets no chat cards
      if (m.sender === '__system__' || m.content.startsWith('__log__:')) continue;
      if (!myChairName || m.sender === myChairName) continue;   // never our own
      // Addressed to this dais: public, to the chairs thread, or a DM to this chair.
      // A group message (`group:<id>`) is resolved below: null unless this chair is a member.
      const forMe = !m.isPrivate || m.recipient === 'Chairs' || m.recipient === myChairName || !!m.recipient?.startsWith('group:');
      if (!forMe) continue;
      // The thread this message lands in. Suppress ONLY when that exact thread is on screen
      // (published by ChatPanel, src/lib/chatViewing.ts). This used to be `if (showChat)`,
      // which silenced a DM while the chair was reading Everyone and still let a card raised
      // a moment before opening the chat sit over the thread it was about.
      const convKey = chatConvKeyForMessage(m, myChairName, true, committee?.chairNames ?? [], chatMessages);
      if (convKey == null) continue;                   // lands in no thread this chair can open
      if (isViewingChatConversation(committeeId, convKey)) continue;

      const found = getCountryByName(m.sender);
      notify({
        key: notifyKey.chat(String(convKey), m.sender),   // one card per sender per thread — a burst collapses
        kind: 'chat',
        flagCode: found?.code,
        title: getCountryDisplayName(m.sender, language),
        // HARD REQUIREMENT: never the message text. The stack is visible to anyone
        // looking at the dais screen; chat is private.
        body: t('notif_chat_sent_message'),
        ttlMs: NOTIFY_TTL.chat,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, committee?.id, isViewOnly, myChairName, language, t]);

  // ── Organiser broadcasts ──────────────────────────────────────────────────
  // Delivery, rendering and effect. Three separate concerns, deliberately not fused:
  //
  //   1. `runBroadcastEffect` — the ONLY place a broadcast writes to the committee.
  //   2. the card effect      — what the chair SEES. Every chair sees every broadcast.
  //   3. the schedule effect  — WHEN the action runs. Armed on every device; gated to one.
  //
  // Splitting 2 from 3 is what makes a dismissed card still take effect: acknowledging an
  // announcement is not the same as cancelling the pause the organiser scheduled.

  // SINGLE EXECUTION. Every chair on the dais receives this identical row over realtime; if
  // each one called endDebateInDB we would get a write storm and a double state change on a
  // committee that is, by definition, about to become unrecoverable. The gate is the gavel:
  // `isViewOnly` is false on exactly one chair identity (the head chair — see AGENTS.md
  // FEATURE: CHAIR ROLES), so only that device writes. Every other chair still gets the card
  // and learns what is happening; it just does not perform it. This is NOT a security claim
  // (isViewOnly never is, MUST NEVER HAPPEN #15) — it is a de-duplication rule, and the
  // idempotence guards below are what make it safe even when it is wrong.
  const runBroadcastEffect = (b: SessionBroadcast) => {
    if (b.kind !== 'actionable' || !b.action) return;
    if (firedBroadcastsRef.current.has(b.id)) return;     // this device, already done
    if (isViewOnlyRef.current) return;                    // a Commenter only watches
    if (!committee) return;
    // Expired between arming and firing — the organiser's window has closed.
    if (b.expiresAt && new Date(b.expiresAt).getTime() <= serverNow()) return;
    // AGENTS.md FEATURE: END DEBATE — `ended_at` is permanent and starts the 1h deletion
    // clock. Never re-write it, and never suspend a committee that has already ended.
    if (committee.endedAt) return;
    if (b.action === 'pause' && committee.suspendedAt) return;   // already suspended
    firedBroadcastsRef.current.add(b.id);

    const code = committee.code;
    const suffix = committee.dbChairJoinSuffix ?? undefined;
    // Optimistic first, DB write fire-and-forget (RULE 5) — exactly the shape MotionsModal
    // uses for the same two transitions, so the two paths cannot drift.
    // The speaker holding the floor spoke too (G-1): log it before the clocks freeze.
    void logFloorSpeech(committee, {
      base: speakerAnchorRef.current.base,
      startedAt: speakerAnchorRef.current.startedAt,
      extraSecs: extraTimeAddedSecsRef.current,
    });
    extraTimeAddedSecsRef.current = 0;
    // An organiser END finishes a Room Order Tour de Table for good (a pause only freezes it).
    if (b.action !== 'pause') void creditRoomOrderTour(committee);
    // ...and then LEAVES the floor, exactly like the Suspend / End motion path. Without this
    // the current_speaker row kept them through the break, and the first Next after a resume
    // logged the same turn again (hours later, so no duplicate window could catch it).
    // Issued after the log so its anchor read is queued ahead of the clear. Conditional and
    // chained: not the blind clear MUST NEVER HAPPEN #5 forbids. Not rolled back with the
    // lifecycle below: the speech is logged and the turn is over either way.
    const floor = committee.currentSpeaker;
    if (floor) {
      updateLocal(setCommittee, (c) => ({ ...c, currentSpeaker: null }), true);
      clearCurrentSpeakerIfUnchanged(committee.id, floor.delegateId, floor.country, code, suffix);
    }
    // Remembered, so a write that still fails after its retries can be rolled back (R-5):
    // otherwise this laptop sits on a suspended / ended screen while the room carries on.
    const before = {
      phase: committee.phase, suspendedAt: committee.suspendedAt ?? null,
      endedAt: committee.endedAt ?? null, expiresAt: committee.expiresAt ?? null,
    };
    const rollback = () => {
      updateLocal(setCommittee, (c) => ({ ...c, ...before }), true);
      setSessionEnded(!!before.endedAt);
      setSessionSuspended(!!before.suspendedAt && !before.endedAt);
      firedBroadcastsRef.current.delete(b.id);
    };
    if (b.action === 'pause') {
      // S4: the caucus keeps its queue but nobody is on its floor (the speaker just left it).
      updateLocal(setCommittee, (c) => ({
        ...c, suspendedAt: serverNowIso(), phase: 'adjourned' as const,
        caucus: c.caucus?.currentSpeaker ? { ...c.caucus, currentSpeaker: null } : c.caucus,
      }), true);
      setSessionSuspended(true);
      // suspendDebate freezes the caucus total and the speaker clock at live values (C-1)
      // and resolves false when it could not suspend (write failed, or already ended).
      void suspendDebateInDB(committee.id, code, suffix).then((ok) => { if (!ok) rollback(); });
    } else {
      const nowMs = serverNow();   // database clock (T-1)
      // Mirrors endDebate()'s own +1h. If one is ever changed, change both.
      const expires = new Date(nowMs + 1 * 60 * 60 * 1000);
      updateLocal(setCommittee, (c) => ({ ...c, endedAt: new Date(nowMs).toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }), true);
      setSessionEnded(true);
      setSessionSuspended(false);
      void endDebateInDB(committee.id, code, suffix).then((ok) => { if (!ok) rollback(); });
    }
    markBroadcastSeen(code, b.id);
    dismissNotification(notifyKey.broadcast(b.id));
  };
  broadcastEffectRef.current = runBroadcastEffect;

  // Card per broadcast. `urgent: true` on purpose: rule 2 holds ordinary notifications back
  // while a speaker's clock runs, which is right for a GSL request and wrong for a message
  // that is about to pause or end the debate — the chair needs it BEFORE the speech it
  // interrupts. Sticky (`ttlMs: null`) for the same reason: an organiser announcement is not
  // clutter that should age off unread, and every card carries its own dismiss control.
  const committeeCode = committee?.code;
  useEffect(() => {
    if (!committeeCode) return;
    const seen = loadSeenBroadcasts(committeeCode);
    const now = serverNow();   // compared with DB timestamps (T-1)
    const liveKeys = new Set<string>();

    for (const b of broadcasts) {
      // Re-checked on the client: a row fetched while live can expire with the page open.
      if (b.expiresAt && new Date(b.expiresAt).getTime() <= now) continue;
      const key = notifyKey.broadcast(b.id);
      liveKeys.add(key);
      if (seen.has(b.id)) continue;                              // dismissed on this device
      if (raisedBroadcastKeysRef.current.has(key)) continue;     // already shown this session
      raisedBroadcastKeysRef.current.add(key);

      const actionable = b.kind === 'actionable' && !!b.action;
      const broadcast = b;
      notify({
        key,
        kind: 'broadcast',
        urgent: true,
        title: t('notif_broadcast_title'),
        body: b.message,
        ttlMs: null,
        actions: [{
          id: actionable ? 'ack' : 'dismiss',
          label: actionable ? t('notif_broadcast_acknowledge') : t('notif_broadcast_dismiss'),
          tone: actionable ? 'accept' : 'neutral',
          run: () => {
            markBroadcastSeen(committeeCode, broadcast.id);
            // With no `action_at` the organiser left the timing to the dais, so the
            // acknowledgement IS the trigger. With one, the schedule effect owns it and
            // acknowledging only clears the card — the pause still lands when promised.
            if (actionable && !broadcast.actionAt) broadcastEffectRef.current(broadcast);
          },
        }],
      });
    }

    // Withdrawn or expired upstream — pull the card so the stack cannot offer an action for
    // a broadcast that no longer exists.
    for (const key of Array.from(raisedBroadcastKeysRef.current)) {
      if (liveKeys.has(key)) continue;
      raisedBroadcastKeysRef.current.delete(key);
      dismissNotification(key);
    }
  }, [broadcasts, committeeCode, t]);

  // Arm the scheduled actions. Runs on every chair device — `runBroadcastEffect` is what
  // decides whether this one is the device that actually writes — so a gavel handover
  // between arming and firing still leaves exactly one executor.
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    // `action_at` is a database timestamp: measure the delay on the database clock (T-1), or
    // a laptop 40 s fast pauses the room 40 s early.
    const now = serverNow();
    for (const b of broadcasts) {
      if (b.kind !== 'actionable' || !b.action) continue;
      if (!b.actionAt) continue;                  // fires on acknowledgement instead
      if (b.expiresAt && new Date(b.expiresAt).getTime() <= now) continue;
      const delay = new Date(b.actionAt).getTime() - now;
      if (delay <= 0) {
        if (-delay > BROADCAST_LATE_FIRE_GRACE_MS) continue;   // stale — never re-suspend
        broadcastEffectRef.current(b);
        continue;
      }
      if (delay > MAX_TIMEOUT_MS) continue;
      timers.push(setTimeout(() => broadcastEffectRef.current(b), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [broadcasts]);

  // Presentation extras for the stack — the attached image, and the live countdown target.
  // The countdown is passed as a TARGET INSTANT plus a template, never as pre-rendered text:
  // re-notifying once a second to advance a clock would restart the notification's own TTL
  // and re-emit to every subscriber. NotificationStack renders it off the interval it
  // already owns, and falls back to `note` once the moment passes.
  const broadcastExtras = useMemo(() => {
    const map: Record<string, NotificationExtra> = {};
    for (const b of broadcasts) {
      const extra: NotificationExtra = {};
      if (b.imageUrl) extra.imageUrl = b.imageUrl;
      if (b.kind === 'actionable' && b.action) {
        const pausing = b.action === 'pause';
        extra.note = pausing ? t('notif_broadcast_pause_now') : t('notif_broadcast_end_now');
        if (b.actionAt) {
          extra.countdownTo = b.actionAt;
          extra.countdownTemplate = pausing ? t('notif_broadcast_pause_in') : t('notif_broadcast_end_in');
        }
      }
      map[notifyKey.broadcast(b.id)] = extra;
    }
    return map;
  }, [broadcasts, t]);

  // A resume latch held by ANOTHER chair is normally a sub-second blink: they claim it and
  // immediately clear it by starting the roll call. If it is still there ~12s later that
  // chair died between the two writes, so offer a take-over rather than leaving every other
  // chair staring at a permanently disabled Resume button.
  // "Another chair" includes a same-name chair on ANOTHER device: the latch stores only a
  // name, so ownership is this device's own claim marker (src/lib/gavelDevice.ts).
  const foreignResumeLatch = !!committee?.suspendedAt && !committee?.endedAt && !!committee?.resumingChair
    && !(committee.resumingChair === (myChairName || committee?.chairNames?.[0] || 'Chair')
      && resumeClaimIsMine(committee.code, committee.suspendedAt));
  useEffect(() => {
    if (!foreignResumeLatch) { setResumeStale(false); return; }
    const id = setTimeout(() => setResumeStale(true), 12_000);
    return () => clearTimeout(id);
  }, [foreignResumeLatch]);

  // Every early return below renders no controls, so no remove-speaker handler may survive
  // from an earlier render (a kicked device kept the pre-kick one). Re-published below the
  // returns, once this render reaches `handleRemoveCurrentSpeaker`.
  removeCurrentSpeakerRef.current = null;

  if (loading || authLoading || accessState === 'checking') return <GavelLoader />;

  if (accessState === 'signin') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>{t('session_signin_title')}</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>{t('session_signin_chair_body')}</p>
          <button
            onClick={() => openAuth()}
            className="font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none gv-lift"
            style={{ backgroundColor: '#1B3828' }}
          >
            {t('session_signin_btn')}
          </button>
        </div>
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>{t('session_denied_title')}</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>{t('session_denied_chair_body')}</p>
          <Link href="/sessions" className="inline-block font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>{t('session_back_home')}</Link>
        </div>
      </div>
    );
  }

  // The access check could not be answered (connection dropped, token expired mid-sleep).
  // Only reachable on a first load: a settled room stays on screen (src/lib/useSessionAccess.ts).
  if (accessState === 'error') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm" role="alert">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>{t('session_access_error_title')}</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>{t('session_access_error_body')}</p>
          <button
            onClick={chairAccess.retry}
            className="font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none gv-lift"
            style={{ backgroundColor: '#1B3828' }}
          >
            {t('delegate_seat_retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!committee && loadFailed) {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm" role="alert">
          <p className="text-[#1C1410] text-xl font-bold mb-6">{t('session_load_failed')}</p>
          <button
            onClick={() => { setLoadFailed(false); setLoading(true); setLoadAttempt((n) => n + 1); }}
            className="font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none gv-lift"
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="text-center">
          <p className="text-[#1C1410] text-xl font-bold mb-4">{t('session_not_found')}</p>
          <Link href="/create" className="bg-[#1B3828] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#2A5A3C] transition-colors">{t('session_create_committee')}</Link>
        </div>
      </div>
    );
  }

  // This account took the committee on another device. Nothing interactive renders, so no
  // panel, autosave or control can write from here. "Use this device instead" moves the
  // account back and, when this chair's name holds the gavel, the gavel with it.
  if (deviceLock.kicked) {
    const takeBackDevice = async () => {
      const ok = await deviceLock.takeBack();
      if (ok && !committee.endedAt && myChairName) {
        const role = deriveGavelRole(committee, myChairName, gavelDeviceId, null);
        if (role.nameHolds && committee.dbHeadChairDevice !== gavelDeviceId) claimGavelForThisDevice(committee, role.head ?? myChairName);
      }
      return ok;
    };
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#EDE7D8' }}>
        <ChairDeviceKickModal
          onUseThisDevice={takeBackDevice}
          onLeave={() => router.push(committee.sessionOrigin === 'conference' ? '/my-conferences' : '/join')}
        />
      </div>
    );
  }

  // A REAL Commenter (another chair's NAME holds the gavel): the Moderator's controls are drawn
  // disabled and a press explains why (commenterLock). A device that is view-only only because
  // the same name holds the gavel elsewhere keeps the old hidden controls and its own banner.
  moderatorNameRef.current = moderatorNameOf(committee);
  const isCommenter = isViewOnly && !sessionEnded && !!myChairName && !deriveGavelRole(committee, myChairName, gavelDeviceId, null).nameHolds;
  const commenterLock: ControlLock | null = isCommenter ? { reason: t('commenter_only_hint'), onAttempt: notifyCommenter } : null;

  const present = committee.delegates.filter((d) => d.status !== 'absent' && !d.isObserver).length;
  const progress = committee.currentSpeaker ? (speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;
  const isPreSession = committee.phase === 'pre-session';

  // ── Quorum enforcement ──────────────────────────────────────────────────────
  // OBSERVERS COUNT HERE (16 Sep 2026). Quorum is the question "is the room full enough to
  // do business", and an observer is in the room: they take the floor, they are on the
  // speakers list, and a chair counting heads counts them. So the sidebar's quorum rings,
  // the quorum pill and the `belowQuorum` gate all read the WHOLE roster, and they read the
  // same numbers as each other by construction (one pair of counts, three readers).
  // Observers stop counting at exactly one place: the final substantive vote on
  // /voting/[code], whose denominators (`liveVotable`, `livePresentAndPv`, the veto roster)
  // still exclude them, because that is where a vote is actually cast. Motion voting counts
  // them too (MotionsModal).
  const settings = getSettings(committee.code);
  const presentCount = committee.delegates.filter((d) => d.status !== 'absent').length;
  const totalCount = committee.delegates.length;
  const quorumMap: Record<string, number> = { 'none': 0, '1-4': 1 / 4, '1-3': 1 / 3, '1-2': 1 / 2 };
  const quorumFraction = quorumMap[settings.quorumThreshold ?? 'none'] ?? 0;
  const belowQuorum = quorumFraction > 0 && totalCount > 0 && (presentCount / totalCount) < quorumFraction;
  /** Delegations the quorum rule needs, for the sidebar masthead. Null = no rule. */
  const quorumNeeded = quorumFraction > 0 && totalCount > 0 ? Math.ceil(quorumFraction * totalCount) : null;
  // Where the full-height roster sidebar shows: the same states it showed in before it moved
  // out of the floor row. Hidden in pre-session (roll call is the centred card) and on the
  // End View / Suspend View tabs. (Chat used to cover the floor; it is a dialog now.)
  const sidebarVisible = showRollCall
    && committee.phase !== 'pre-session'
    && !(sessionEnded && endedTab === 'ended')
    && !(!sessionEnded && sessionSuspended && suspendTab === 'suspend');

  // The committee's identity, stated ONCE at the top of the roster column: emblem, name,
  // topic and the quorum rings (CommitteeIdentityBadge). Used by the full-height sidebar
  // and by the pre-session roll-call card, so RollCallPanel gets `hideIdentity` in both.
  // Match and derive against the RAW stored name: the preset aliases are English, so a
  // localised display name would never match them. A standalone session has no
  // `abbreviation`, so the acronym is derived, or the acronym-plus-full-name UI RULE could
  // never fire outside conferences.
  // Inline topic edit (Moderator, not ended). Optimistic first, then the checked write; a
  // refused write puts the previous topic back (unless something newer replaced it) and the
  // badge says so. `settings.agendaTopicIndex` is never touched (see updateCommitteeTopicInDB).
  const handleTopicSave = async (raw: string): Promise<boolean> => {
    const next = raw.replace(/\s+/g, ' ').trim().slice(0, COMMITTEE_TOPIC_MAX);
    const prev = committee.topic;
    if (!next || next === (prev ?? '').trim()) return true;
    updateLocal(setCommittee, (c) => ({ ...c, topic: next }));
    const ok = await updateCommitteeTopicInDB(committee.id, next, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (!ok) updateLocal(setCommittee, (c) => (c.topic === next ? { ...c, topic: prev } : c));
    return ok;
  };
  const renderIdentityBadge = (inSidebar: boolean) => {
    const rawName = committee.name;
    const fullName = getCommitteeDisplayName(rawName, language);
    const acronym = deriveCommitteeAcronym(rawName, committeeEmblem.abbreviation);
    const primary = committeeDisplayName(fullName, acronym);
    const secondary = primary !== fullName ? fullName : null;
    const logoSrc = committeeEmblem.logoUrl ?? matchPresetEmblem(rawName, committeeEmblem.abbreviation);
    return (
      <CommitteeIdentityBadge
        logoSrc={logoSrc}
        primary={primary}
        secondary={secondary}
        topic={committee.topic}
        topicLabel={t('rollcall_topic')}
        onTopicSave={!isViewOnly && !sessionEnded ? handleTopicSave : undefined}
        topicMaxLength={COMMITTEE_TOPIC_MAX}
        onSwitchAgenda={agenda.canSwitch ? agenda.openPicker : undefined}
        switchAgendaLabel={t('identity_topic_switch')}
        labels={{ edit: t('identity_topic_edit'), add: t('identity_topic_add'), field: t('identity_topic_field'), failed: t('identity_topic_failed') }}
        onCollapse={inSidebar ? () => toggleSidebarCollapsed(true) : undefined}
        collapseLabel={t('sidebar_collapse')}
        present={presentCount}
        total={totalCount}
        quorumNeeded={quorumNeeded}
        // The inline seat field beside the quorum tabs (replaces the + button and its
        // picker). A write, so never for a Commenter or an ended session.
        seatField={!sessionEnded && (!isViewOnly || commenterLock)
          ? <SeatAddField delegates={committee.delegates} onAdd={handleDelegateAdd} large={!inSidebar} locked={commenterLock} />
          : undefined}
      />
    );
  };
  const identityBadge = renderIdentityBadge(false);
  // `gslRequireNextSpeaker` no longer does anything on the floor (owner, 17 Sep 2026): the GSL
  // may always run dry, Start is never blocked on the last name and Finish is always offered.
  // The field stays on CommitteeSettings and in old rows' settings JSONB so they still load.

  // ── Optimistic action handlers ──────────────────────────────────────────────

  const handleNextSpeaker = async () => {
    setTimerRunning(false);
    // G-3: pause in ONE write, at the live value, so the anchor read below sees where the
    // clock really stopped.
    const liveAtNext = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt);
    pauseSpeakerTimerInDB(committeeIdRef.current, liveAtNext, committeeCodeRef.current, chairSuffixRef.current);
    setExtraTimeAdded(false);

    if (committee.currentSpeaker) {
      // T-3: the one speech logger (src/lib/floorSpeech.ts), from the persisted anchor
      // (time_granted - live), which survives a reload and a gavel handover; the extended
      // limit is only the fallback for legacy rows. The clock passed is the anchor BEFORE the
      // pause above (it names this turn); the read is queued between the pause and the Next.
      void logFloorSpeech(committee, {
        base: speakerAnchorRef.current.base,
        startedAt: speakerAnchorRef.current.startedAt,
        extraSecs: extraTimeAddedSecsRef.current,
      });
    }
    extraTimeAddedSecsRef.current = 0;

    const removeDelegateId = committee.speakersList[0]?.delegateId ?? null;
    const [next, ...rest] = committee.speakersList;
    const timeToUse = speakerTimeLimit;

    // nextSpeakerInDB writes { time_remaining: timeToUse, started_at: null } — seat the
    // local anchor to exactly that so this device and every reader agree immediately.
    seatSpeakerClock(timeToUse, null);

    localUpdateTime.current = Date.now();

    // S7: the seat nonce, identical in local state and in the row, names this floor turn.
    const seatedAt = serverNowIso();
    updateLocal(setCommittee, (c) => ({
      ...c,
      currentSpeaker: next ?? null,
      speakerSeatedAt: next ? seatedAt : null,
      speakersList: rest,
      speakerTimeRemaining: timeToUse,
    }));

    await nextSpeakerInDB(
      committee.id,
      timeToUse,
      next?.delegateId ?? null,
      next?.country ?? null,
      removeDelegateId,
      committee.code,
      committee.dbChairJoinSuffix ?? undefined,
      seatedAt,
    );
    localUpdateTime.current = Date.now();
  };

  // Remove the speaker holding the floor, leaving NOBODY on it (the X on the top strip, a
  // click on their sidebar row, or them going
  // absent). GSL and moderated caucus / Tour de Table alike. Moderator only, never ended or
  // suspended. Order on the current_speaker chain, like Next: pause at the live value in ONE
  // write (G-3), log the speech from the persisted anchor (floorSpeech.ts skips a 0 s turn and
  // Room Order placeholders), then the CONDITIONAL clear (not the blind clear MUST NEVER
  // HAPPEN #5 forbids). In a caucus the TOTAL is re-anchored paused at its live value with
  // nobody on its floor, so it neither drains nor expires while the floor is empty.
  // `onlyDelegateId`: act only if that delegate still holds the floor (the absent path).
  const handleRemoveCurrentSpeaker = (onlyDelegateId?: string) => {
    const c = committee;
    if (!c || c.endedAt || c.suspendedAt || sessionEnded || sessionSuspended) return;
    if (isViewOnly || !gavelRoleOf(c).isModerator) return;
    const inModCaucus = c.phase === 'moderated-caucus' && !!c.caucus;
    const floor = c.currentSpeaker;
    const caucusCountry = inModCaucus ? (c.caucus!.currentSpeaker ?? null) : null;
    if (!floor && !caucusCountry) return;
    if (onlyDelegateId && floor?.delegateId !== onlyDelegateId) {
      const d = c.delegates.find((x) => x.id === onlyDelegateId);
      if (!(inModCaucus && d && d.country === caucusCountry)) return;
    }
    const code = c.code;
    const suffix = c.dbChairJoinSuffix ?? undefined;
    const { base, startedAt } = speakerAnchorRef.current;
    const live = speakerRemainingNow(base, startedAt);
    const clock = { base, startedAt, extraSecs: extraTimeAddedSecsRef.current };
    const spoke = floorSpeechSeconds(c, clock) > 0;
    const totalLeft = inModCaucus ? moderatedCaucusRemainingNow(c.caucus!, base, startedAt) : 0;
    setTimerRunning(false);
    setExtraTimeAdded(false);
    if (floor) {
      pauseSpeakerTimerInDB(c.id, live, code, suffix);
      void logFloorSpeech(c, clock);
      clearCurrentSpeakerIfUnchanged(c.id, floor.delegateId, floor.country, code, suffix);
    }
    extraTimeAddedSecsRef.current = 0;
    if (inModCaucus && c.caucus) {
      const prevSpoken = c.caucus.spokenCountries ?? [];
      const spokenCountries = spoke && caucusCountry && !prevSpoken.includes(caucusCountry)
        ? [...prevSpoken, caucusCountry] : prevSpoken;
      const anchored: CaucusState = { ...anchorCaucusClock(c.caucus, totalLeft, false), currentSpeaker: null, spokenCountries };
      seatSpeakerClock(capSpeakerSlot(c.caucus.speakingTime, totalLeft), null);
      updateLocal(setCommittee, (x) => ({
        ...x,
        caucus: x.caucus && x.phase === 'moderated-caucus' ? anchored : x.caucus,
        currentSpeaker: null,
        speakerSeatedAt: null,
      }), true);
      updateCaucusInDB(c.id, anchored, code, suffix);
    } else {
      seatSpeakerClock(speakerTimeLimit, null);
      updateLocal(setCommittee, (x) => ({ ...x, currentSpeaker: null, speakerSeatedAt: null, speakerTimeRemaining: speakerTimeLimit }), true);
    }
  };
  removeCurrentSpeakerRef.current = handleRemoveCurrentSpeaker;

  // G-1: "Finish" for the last GSL speaker. Next is disabled on an empty list, so the last
  // speech of a GSL that runs dry was never logged. This logs it from the anchor (shared,
  // idempotent helper in src/lib/floorSpeech.ts) and leaves the floor empty, exactly like
  // Next with nobody behind them. The log read joins the current_speaker chain before the
  // Next write, so it sees this speaker's clock, not the cleared row.
  const handleYieldFloor = async () => {
    if (!committee?.currentSpeaker) return;
    setTimerRunning(false);
    setExtraTimeAdded(false);
    void logFloorSpeech(committee, {
      base: speakerAnchorRef.current.base,
      startedAt: speakerAnchorRef.current.startedAt,
      extraSecs: extraTimeAddedSecsRef.current,
    });
    extraTimeAddedSecsRef.current = 0;
    const timeToUse = speakerTimeLimit;
    seatSpeakerClock(timeToUse, null);
    localUpdateTime.current = Date.now();
    updateLocal(setCommittee, (c) => ({ ...c, currentSpeaker: null, speakerSeatedAt: null, speakerTimeRemaining: timeToUse }));
    await nextSpeakerInDB(committee.id, timeToUse, null, null, null, committee.code, committee.dbChairJoinSuffix ?? undefined);
    localUpdateTime.current = Date.now();
  };

  // Extra time RE-ANCHORS, and is now PERSISTED.
  //
  // This used to add the seconds to the local atom and nothing else, so no other device
  // ever learned about them: a co-chair's clock, the organiser wall and a chair who simply
  // reloaded all kept counting to the un-extended zero. That was survivable only while the
  // chair's own clock was a private local counter. Now that every surface — including this
  // one — derives from current_speaker.{time_remaining, started_at}, an unpersisted grant
  // would be erased by this device's very next tick, so persisting it is what makes the
  // button work at all. No schema change: the existing two columns carry it.
  const addTimeHasTarget = committee?.phase === 'moderated-caucus'
    ? !!committee.caucus?.currentSpeaker
    : !!committee?.currentSpeaker || (committee?.phase === 'speakers-list' && (committee.speakersList?.length ?? 0) > 0);
  const handleAddExtraTime = (secs: number) => {
    if (secs <= 0) return;
    // GSL with a delegation on deck and nobody seated: hold the grant locally for their
    // slot. No write, no log, no clock (see `onDeckGrant`).
    const deck = committee?.phase === 'speakers-list' && !committee.currentSpeaker ? committee.speakersList[0] ?? null : null;
    if (deck) {
      // The panel stays open after a grant (owner, 17 Sep 2026): only a motion change closes it.
      setExtraTimeSecs('');
      setOnDeckGrant((g) => ({ id: deck.delegateId, secs: (g?.id === deck.delegateId ? g.secs : 0) + secs }));
      return;
    }
    // The panel now stays open when the floor empties (a removed or finished speaker), so a
    // grant with nobody seated and nobody on deck must write nothing.
    if (!addTimeHasTarget) return;
    const running = timerRunning;
    const { base: anchorBase, startedAt: anchorStarted } = speakerAnchorRef.current;
    const live = speakerRemainingNow(anchorBase, anchorStarted);
    setExtraTimeSecs('');
    // In a moderated caucus (and Tour de Table) the total is speaking time, so a speaker can
    // never be given more than the caucus has left: the grant is capped to the room between
    // the live speaker clock and the live total, and the total is never extended. Read both
    // BEFORE the speaker anchor is reseated below.
    const modCaucus = committee?.phase === 'moderated-caucus' && committee.caucus ? committee.caucus : null;
    const totalLeft = modCaucus ? moderatedCaucusRemainingNow(modCaucus, anchorBase, anchorStarted) : 0;
    let grant = secs;
    if (modCaucus) {
      const room = Math.max(0, totalLeft - live);
      if (grant > room) {
        grant = room;
        setExtraTimeCapMsg(totalLeft);
      }
    }
    if (grant <= 0) return;
    if (modCaucus && committee) {
      // Re-anchor the TOTAL first, at the live value read above. If this speaker's clock had
      // already run out, the total may still carry an armed anchor from before the zero
      // (a reload or a gavel handover skipped the stop-at-zero write); reseating only the
      // speaker would then read the total uncapped and drained, and could end the caucus.
      const anchored = anchorCaucusClock(modCaucus, totalLeft, running);
      updateLocal(setCommittee, (c) => (c.caucus && c.phase === 'moderated-caucus' ? { ...c, caucus: anchored } : c), false);
      updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
    const base = live + grant;
    const startedAt = running ? serverNowIso() : null;   // database clock (T-1)
    seatSpeakerClock(base, startedAt);
    extraTimeAddedSecsRef.current += grant;
    setExtraTimeAdded(true);
    // Optimistic-first, fire-and-forget (RULE 5). One write per press, never per second.
    // The grant is persisted with the anchor (current_speaker.time_granted), so the speech
    // is logged with its extra time even after a reload (T-3).
    grantSpeakerTimeInDB(committeeIdRef.current, grant, base, startedAt, committeeCodeRef.current, chairSuffixRef.current);
  };

  const handleToggleTimer = () => {
    if (belowQuorum) return;
    const starting = !timerRunning;
    // The live remainder at the instant of the press — derived, so it is right even if the
    // last repaint was a while ago.
    let live = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt);
    // Starting a clock that is already at zero would arm both anchors only for the tick to
    // stop them again a moment later. Add time or press Next instead.
    if (starting && live <= 0) return;
    // In a moderated caucus a speaker can never be given more than the caucus has left:
    // the last speaker's clock is capped to the remaining total when they start.
    // Read BEFORE the speaker anchor is reseated below, and derived rather than taken from
    // caucusSecondsRef, which is 0 for the first flush after a mount.
    const totalLeft = committee.phase === 'moderated-caucus' && committee.caucus
      ? moderatedCaucusRemainingNow(committee.caucus, speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt)
      : 0;
    if (starting && committee.phase === 'moderated-caucus' && totalLeft > 0 && live > totalLeft) live = totalLeft;
    setTimerRunning(starting);
    if (starting) {
      // ONE anchor, written to the DB and seated locally as the SAME string, and the base
      // is written alongside it. Stamping only `started_at` (as this used to) left the base
      // at whatever a previous sync happened to store, so the chair and its readers started
      // from two different numbers.
      const startedAt = serverNowIso();   // database clock (T-1)
      seatSpeakerClock(live, startedAt);
      startSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current, startedAt, live);
    } else {
      // Pause = ONE write of { started_at: null, time_remaining: live } (G-3). As two writes
      // phones briefly saw the old base, and a failed second write refunded the speaker.
      seatSpeakerClock(live, null);
      pauseSpeakerTimerInDB(committeeIdRef.current, live, committeeCodeRef.current, chairSuffixRef.current);
    }
    // H2 — in a moderated caucus the TOTAL clock advances in lockstep with the speaker
    // clock, so play/pause is also the total clock's anchor point. One write per press,
    // never per second: `remainingTime` is stamped with the live derived value and
    // `totalStartedAt` with now (or null on pause), so delegates and advisors can render a
    // real countdown and a refresh cannot rewind it.
    if (committee.phase === 'moderated-caucus' && committee.caucus) {
      const anchored = anchorCaucusClock(committee.caucus, totalLeft, starting);
      // structural=false: this is the clock the local tick already owns and the timerRunning
      // pin already protects from the realtime echo. Arming the debounce (RULE 4 / MUST
      // NEVER HAPPEN #4) would make this device drop speakers_list events for 3s.
      updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), false);
      updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  };

  const handleRestartTime = () => {
    setTimerRunning(false);
    // ONE current_speaker write per restart: the syncs below carry started_at null with the
    // fresh base and grant (`stop`), instead of a stop followed by a separate sync.
    setExtraTimeAdded(false);
    const extraBeforeRestart = extraTimeAddedSecsRef.current;
    extraTimeAddedSecsRef.current = 0;
    if (committee?.phase === 'moderated-caucus' && committee.caucus) {
      // The current speaker's slot is what they were given when called (capped to the
      // caucus's remaining time for a last speaker), persisted as caucus.speakerTimeRemaining.
      // Refunding against the motion's full speaking time over-credited a capped speaker.
      const slot = committee.caucus.speakerTimeRemaining > 0 ? committee.caucus.speakerTimeRemaining : committee.caucus.speakingTime;
      const extra = extraBeforeRestart;
      const { base: anchorBase, startedAt: anchorStarted } = speakerAnchorRef.current;
      const live = speakerRemainingNow(anchorBase, anchorStarted);
      const spentSeconds = Math.max(0, (slot + extra) - live);
      // Derived total, not caucus.remainingTime (the value AT the anchor, which would refund
      // seconds already burnt) and not caucusSecondsRef (0 for the first flush after mount).
      const newRemainingTime = moderatedCaucusRemainingNow(committee.caucus, anchorBase, anchorStarted) + spentSeconds;
      const speakTime = capSpeakerSlot(committee.caucus.speakingTime, newRemainingTime);
      seatSpeakerClock(speakTime, null);
      syncSpeakerTimeInDB(committee.id, speakTime, committee.code, committee.dbChairJoinSuffix ?? undefined, speakTime, true);   // fresh slot = fresh grant (T-3), clock stopped, one write
      // Ensure current speaker is in spokenCountries so a realtime echo cannot re-add them to the queue
      const currentCountry = committee.currentSpeaker?.country ?? null;
      const prevSpoken = committee.caucus.spokenCountries ?? [];
      const newSpoken = currentCountry && !prevSpoken.includes(currentCountry)
        ? [...prevSpoken, currentCountry]
        : prevSpoken;
      // Restart stops the clock (setTimerRunning(false) above), so the total-clock anchor is
      // released and newRemainingTime becomes the literal truth for every reader.
      const updated = { ...committee.caucus, speakerTimeRemaining: speakTime, remainingTime: newRemainingTime, spokenCountries: newSpoken, totalStartedAt: null };
      updateLocal(setCommittee, (c) => ({ ...c, caucus: updated }), true);
      updateCaucusInDB(committee.id, updated, committee.code, committee.dbChairJoinSuffix ?? undefined);
    } else {
      seatSpeakerClock(speakerTimeLimit, null);
      syncSpeakerTimeInDB(committee.id, speakerTimeLimit, committee.code, committee.dbChairJoinSuffix ?? undefined, speakerTimeLimit, true);   // fresh grant (T-3), clock stopped, one write
    }
  };

  const handleNextCaucusSpeaker = async () => {
    if (!committee.caucus) return;
    setTimerRunning(false);
    // G-3 / T-3: pause at the live value in one write, so the anchor read that logs this
    // speech (queued next on the same chain) sees where the clock stopped.
    pauseSpeakerTimerInDB(
      committeeIdRef.current,
      speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt),
      committeeCodeRef.current, chairSuffixRef.current,
    );
    setExtraTimeAdded(false);

    // Compute everything from current snapshot BEFORE any state updates
    const queue = committee.caucusQueue ?? [];
    const [next, ...rest] = queue;
    const prevCountry = committee.currentSpeaker?.country ?? null;
    // Count against the EXTENDED slot the current speaker was actually given (caucus.
    // speakerTimeRemaining, capped for a last speaker) plus any +time, so extra time never
    // underflows the log and a capped speaker is not credited the motion's full time.
    const { base: anchorBase, startedAt: anchorStarted } = speakerAnchorRef.current;
    // The LIVE total, derived from the anchor — `caucus.remainingTime` is only the value at
    // the anchor instant, so re-anchoring off it here would silently refund the whole
    // speech to the caucus.
    // Derived, not read off `caucusSecondsRef`. That ref mirrors `caucusSeconds`, which is
    // useState(0) raised by an effect — so for the window between mount and the first clock
    // flush it reads 0, and the `newRemaining <= 0` branch below would END THE CAUCUS
    // instead of advancing the speaker. Same root cause as the expiry effect above.
    // Capped at the speaker clock's zero: once the speaker ran out the total stopped too.
    const newRemaining = moderatedCaucusRemainingNow(committee.caucus, anchorBase, anchorStarted);
    // The next speaker gets the motion's speaking time, or what is left if that is less.
    const speakTime = capSpeakerSlot(committee.caucus.speakingTime, newRemaining);
    const newSpoken = prevCountry && !(committee.caucus.spokenCountries ?? []).includes(prevCountry)
      ? [...(committee.caucus.spokenCountries ?? []), prevCountry]
      : (committee.caucus.spokenCountries ?? []);

    // Room-Order Tour de Table speakers are anonymous "Speaker N" placeholders, not real
    // delegations — logging their time would credit a nonexistent country, so no per-turn
    // log for Room Order; the tour credits its roster once when it ends (below).
    // T-3: the one speech logger (src/lib/floorSpeech.ts) skips Room Order itself, reads the
    // persisted anchor, and falls back to the extended slot (caucus.speakerTimeRemaining, capped
    // for a last speaker, plus any +time) only for legacy rows.
    if (prevCountry) {
      void logFloorSpeech(committee, { base: anchorBase, startedAt: anchorStarted, extraSecs: extraTimeAddedSecsRef.current });
    }
    extraTimeAddedSecsRef.current = 0;
    // A Room Order tour ends here when Next runs past the total or past the last placeholder:
    // one speech per delegation on its roster snapshot (idempotent, no-op for other caucuses).
    if (newRemaining <= 0 || (!next && !!prevCountry)) void creditRoomOrderTour(committee);

    // nextSpeakerInDB below writes { time_remaining: speakTime, started_at: null }.
    seatSpeakerClock(speakTime, null);
    localUpdateTime.current = Date.now();

    if (newRemaining <= 0) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        caucus: null,
        phase: 'speakers-list' as const,
        caucusQueue: [],
        currentSpeaker: null,
        speakerTimeRemaining: speakTime,
      }), true);
      setPhaseAndCaucusInDB(committee.id, 'speakers-list', null, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
      await nextSpeakerInDB(committee.id, speakTime, null, null, null, committee.code, committee.dbChairJoinSuffix ?? undefined);
      localUpdateTime.current = Date.now();
      return;
    }

    const updatedCaucus = {
      ...committee.caucus,
      currentSpeaker: next?.country ?? null,
      speakerTimeRemaining: speakTime,
      remainingTime: newRemaining,
      spokenCountries: newSpoken,
      // Advancing stops the clock (setTimerRunning(false) at the top of this handler), so the
      // total-clock anchor is released and newRemaining is the literal truth for every reader
      // until the chair presses play again. This is the per-speaker re-anchor point (H2).
      totalStartedAt: null,
    };

    // S7: one seat nonce for local state and the row.
    const seatedAt = serverNowIso();
    // Pure state update — no DB calls inside
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucusQueue: rest,
      caucus: updatedCaucus,
      currentSpeaker: next ?? null,
      speakerSeatedAt: next ? seatedAt : null,
      speakerTimeRemaining: speakTime,
    }), true);

    // DB calls outside setState
    updateCaucusInDB(committee.id, updatedCaucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
    // Remove the newly-active speaker from the DB caucus queue —
    // nextSpeakerInDB only removes from the GSL, so we must do this separately.
    if (next?.delegateId) {
      removeFromCaucusListInDB(committee.id, next.delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
    await nextSpeakerInDB(
      committee.id,
      speakTime,
      next?.delegateId ?? null,
      next?.country ?? null,
      null,
      committee.code,
      committee.dbChairJoinSuffix ?? undefined,
      seatedAt,
    );
    localUpdateTime.current = Date.now();
  };

  // Start with a delegation ON DECK in a moderated caucus / Tour de Table (the head of the
  // queue drawn on the floor with nobody seated, see ModeratedCaucusMain). One press seats
  // them and starts BOTH clocks, with one anchor string: the caucus JSONB (currentSpeaker,
  // the capped slot, the total re-anchored running at its live value) and ONE current_speaker
  // update that seats and starts together (`nextSpeakerInDB(..., seatedAt, startedAt)`, like
  // the GSL's `handleStartOnDeck`), so a Pause pressed while the seat is in flight can never
  // land between a seat and a separate start. Nobody was on the floor, so nothing is logged.
  const handleStartCaucusOnDeck = async () => {
    const c = committee;
    if (!c || isViewOnly || !gavelRoleOf(c).isModerator) return;
    if (c.phase !== 'moderated-caucus' || !c.caucus || c.caucus.currentSpeaker) return;
    if (belowQuorum || sessionEnded || sessionSuspended || c.endedAt || c.suspendedAt) return;
    const next = (c.caucusQueue ?? [])[0];
    if (!next) return;
    const { base: anchorBase, startedAt: anchorStarted } = speakerAnchorRef.current;
    const totalLeft = moderatedCaucusRemainingNow(c.caucus, anchorBase, anchorStarted);
    if (totalLeft <= 0) return;   // out of time: the expiry effect ends the caucus
    const speakTime = capSpeakerSlot(c.caucus.speakingTime, totalLeft);
    if (speakTime <= 0) return;
    const startedAt = serverNowIso();   // database clock (RULE 6b); also the seat nonce (S7)
    const code = c.code;
    const suffix = c.dbChairJoinSuffix ?? undefined;
    setTimerRunning(true);
    setExtraTimeAdded(false);
    extraTimeAddedSecsRef.current = 0;
    seatSpeakerClock(speakTime, startedAt);
    const updatedCaucus: CaucusState = {
      ...c.caucus,
      currentSpeaker: next.country,
      speakerTimeRemaining: speakTime,
      remainingTime: Math.max(0, Math.round(totalLeft)),
      totalStartedAt: startedAt,
    };
    localUpdateTime.current = Date.now();
    updateLocal(setCommittee, (x) => ({
      ...x,
      caucusQueue: (x.caucusQueue ?? []).filter((s) => s.delegateId !== next.delegateId),
      caucus: updatedCaucus,
      currentSpeaker: next,
      speakerSeatedAt: startedAt,
      speakerTimeRemaining: speakTime,
    }), true);
    updateCaucusInDB(c.id, updatedCaucus, code, suffix);
    removeFromCaucusListInDB(c.id, next.delegateId, code, suffix);
    await nextSpeakerInDB(c.id, speakTime, next.delegateId, next.country, null, code, suffix, startedAt, startedAt);
    localUpdateTime.current = Date.now();
  };

  const handleEndCaucus = () => {
    setTimerRunning(false);
    // The speaker holding the floor when the chair ends the caucus spoke too: log it.
    logFloorSpeechOnCaucusEnd(committee);
    // H4 — clear the current_speaker DB ROW, not just local state. getCommitteeByCode loads
    // current_speaker unconditionally, so leaving it populated resurrects the caucus speaker
    // as the GSL current speaker on the next refresh — someone who was never on the GSL —
    // and the next "Next" logs speaking time for them again. The conditional clear also
    // nulls started_at, so it subsumes stopSpeakerTimer for this row. Conditional +
    // serialised against nextSpeaker(): not the blind clear MUST NEVER HAPPEN #5 forbids.
    if (committee.currentSpeaker) {
      clearCurrentSpeakerIfUnchanged(
        committee.id, committee.currentSpeaker.delegateId, committee.currentSpeaker.country,
        committee.code, committee.dbChairJoinSuffix ?? undefined,
      );
    } else {
      stopSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current);
    }
    setPhaseAndCaucusInDB(committee.id, 'speakers-list', null, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucus: null,
      phase: 'speakers-list' as const,
      caucusQueue: [],
      currentSpeaker: null,
      speakerTimeRemaining: c.speakerTimeLimit,
    }), true);
    seatSpeakerClock(committee.speakerTimeLimit, null);
  };

  const handleSetSpeakerTimeLimit = (seconds: number) => {
    setSpeakerTimeLimitLocal(seconds);
    setSpeakerTimeLimitInput(String(seconds));
    seatSpeakerClock(seconds, null);
    syncSpeakerTimeInDB(committee.id, seconds, committee.code, committee.dbChairJoinSuffix ?? undefined, seconds);   // fresh grant (T-3)
    updateLocal(setCommittee, (c) => ({ ...c, speakerTimeLimit: seconds, speakerTimeRemaining: seconds }));
    updateSpeakerTimeLimit(committee.id, seconds, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  const handleResumeSession = () => {
    try { localStorage.setItem('gavelling_tutorial_seen_' + committee.id, '1'); } catch {}
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' }));
    setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  // Resuming is TWO writes against the one-shot `resuming_chair` latch: claim it, then clear
  // it by starting the roll call. If the second write fails and the latch is left set, the
  // committee can NEVER be resumed again — `claimResumeSession` only writes when the column
  // is null — so delegates sit on the waiting screen forever. Every exit path below therefore
  // either clears the latch or leaves it in a state some chair can still act on.
  const runResumeRollCall = async (claimedName: string) => {
    const prevPhase = committee.phase;
    const prevSuspendedAt = committee.suspendedAt ?? null;
    // Optimistic (RULE 5) — but remembered, so a failed write can put the overlay back
    // instead of leaving the chair on a phantom roll call for a still-suspended committee.
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'pre-session', suspendedAt: null, resumingChair: null }));
    setSessionSuspended(false);
    // S-1: conditional on the committee still being suspended AND the latch still naming us.
    const started = await startResumeRollCallInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined, claimedName);
    if (started) { clearResumeClaim(committee.code); setResumeError(null); return true; }
    // False can mean "another device already resumed" (or took the latch over). Look before
    // rolling back: a committee that is no longer suspended must not be thrown back into
    // the suspended overlay, and must not be told its resume failed.
    const { fresh, stale } = await fetchCommitteeGuarded(committee.code);
    const resync = () => syncRef.current?.catchUp(undefined, { force: true });
    if (fresh && !fresh.suspendedAt) {
      clearResumeClaim(committee.code);
      if (stale) resync();
      else setCommittee((prev) => prev ? { ...prev, phase: fresh.phase, suspendedAt: null, resumingChair: fresh.resumingChair, caucus: fresh.caucus } : prev);
      setSessionSuspended(false);
      setResumeError(null);
      return true;
    }
    if (fresh && fresh.resumingChair && fresh.resumingChair !== claimedName) {
      // Someone took the latch over: show "{name} is resuming…" off the real row.
      clearResumeClaim(committee.code);
      if (stale) resync();
      else updateLocal(setCommittee, (c) => ({ ...c, phase: fresh.phase, suspendedAt: fresh.suspendedAt, resumingChair: fresh.resumingChair }));
      setSessionSuspended(true);
      setResumeError(t('session_resume_lost'));
      return false;
    }
    // Roll the optimistic state back and hand the latch back so this chair (or another) can
    // retry. releaseResumeClaim is a compare-and-swap on our own name, so it cannot stomp a
    // claim someone else has since taken.
    updateLocal(setCommittee, (c) => ({ ...c, phase: prevPhase, suspendedAt: prevSuspendedAt, resumingChair: claimedName }));
    setSessionSuspended(true);
    const released = await releaseResumeClaimInDB(committee.id, claimedName, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (released) { clearResumeClaim(committee.code); updateLocal(setCommittee, (c) => ({ ...c, resumingChair: null })); }
    setResumeError(released
      ? t('session_resume_failed')
      : t('session_resume_failed_locked'));
    return false;
  };

  const handleResumeClick = async () => {
    if (!committee || resumeBusy) return;
    setResumeBusy(true);
    setResumeError(null);
    try {
      try { localStorage.setItem('gavelling_tutorial_seen_' + committee.id, '1'); } catch {}
      const claimedName = myChairName || committee.chairNames[0] || 'Chair';
      // Self-heal: if this device already holds the latch (it claimed, then the roll-call
      // write failed or the page reloaded in between), re-claiming is impossible — the
      // column is no longer null — so go straight to the second write. This does not weaken
      // the latch: only the chair NAMED in it takes this path, and only on the DEVICE that
      // claimed it (a same-name chair on another device has no marker for this suspension).
      const alreadyMine = committee.resumingChair === claimedName && resumeClaimIsMine(committee.code, committee.suspendedAt);
      const claimed = alreadyMine
        || await claimResumeSessionInDB(committee.id, claimedName, committee.code, committee.dbChairJoinSuffix ?? undefined);
      if (claimed) markResumeClaim(committee.code, committee.suspendedAt);
      if (!claimed) {
        // Lost the race (or the latch is stale). Pull the real row so the button stops being
        // a silent no-op and the chair actually sees who is resuming.
        const { fresh, stale } = await fetchCommitteeGuarded(committee.code);
        if (!fresh) {
          setResumeError(t('session_resume_retry'));
          return;
        }
        // R-1: never merge a snapshot that predates a local write; the forced catch-up lands it.
        if (stale) syncRef.current?.catchUp(undefined, { force: true });
        else setCommittee((prev) => prev ? { ...prev, resumingChair: fresh.resumingChair, suspendedAt: fresh.suspendedAt, phase: fresh.phase } : prev);
        // The winner already finished: the committee is out of suspension, nothing to report.
        if (!fresh.suspendedAt) { setSessionSuspended(false); return; }
        // The latch turns out to be ours after all (our own claim landed but the response was
        // lost). Finish the job rather than reporting a failure.
        // Only with this device's marker: a same-name device elsewhere may hold it instead,
        // and then the take-over after 12s is the safe route.
        if (fresh.resumingChair === claimedName && resumeClaimIsMine(committee.code, fresh.suspendedAt)) { await runResumeRollCall(claimedName); return; }
        // Someone else holds it — the "{name} is resuming…" line now renders off the refetched
        // row, so the button is no longer a silent no-op. No extra error needed.
        if (!fresh.resumingChair) setResumeError(t('session_resume_retry'));
        return;
      }
      await runResumeRollCall(claimedName);
    } finally {
      setResumeBusy(false);
    }
  };

  // Offered only after a foreign latch has sat unresolved for ~12s. Compare-and-swap from
  // the stale holder's name to ours, so two chairs racing to take over still produce exactly
  // one winner.
  const handleTakeOverResume = async () => {
    if (!committee || resumeBusy) return;
    const stale = committee.resumingChair;
    if (!stale) return;
    setResumeBusy(true);
    setResumeError(null);
    try {
      const claimedName = myChairName || committee.chairNames[0] || 'Chair';
      const took = await takeOverResumeClaimInDB(committee.id, stale, claimedName, committee.code, committee.dbChairJoinSuffix ?? undefined);
      if (!took) {
        const { fresh, stale } = await fetchCommitteeGuarded(committee.code);
        if (fresh && stale) syncRef.current?.catchUp(undefined, { force: true });
        else if (fresh) setCommittee((prev) => prev ? { ...prev, resumingChair: fresh.resumingChair, suspendedAt: fresh.suspendedAt, phase: fresh.phase } : prev);
        if (fresh && !fresh.suspendedAt) { setSessionSuspended(false); return; }
        setResumeError(t('session_resume_lost'));
        return;
      }
      markResumeClaim(committee.code, committee.suspendedAt);
      await runResumeRollCall(claimedName);
    } finally {
      setResumeBusy(false);
    }
  };

  const handlePhaseChange = (phase: string) => {
    updateLocal(setCommittee, (c) => {
      let updated = { ...c, phase: phase as Committee['phase'] };
      // Begin Session after a resume: a caucus the suspension paused comes back as its own
      // phase, still paused; with none the GSL opens and no caucus data survives into it.
      // Mirrors beginSessionAfterRollCall (committeeService), which RollCallPanel writes.
      if (phase === 'speakers-list' && c.phase === 'pre-session') {
        const kept = c.caucus ? freezeCaucusForBreak(c.caucus, 0, null) : c.caucus;
        if (kept && kept.remainingTime > 0) {
          updated = { ...updated, phase: phaseForCaucus(kept), caucus: kept };
        } else {
          updated = { ...updated, caucus: null, caucusQueue: [] };
        }
      }
      if (phase === 'speakers-list' && c.phase === 'pre-session') {
        const absentIds = new Set(c.delegates.filter((d) => d.status === 'absent').map((d) => d.id));
        const toRemove = c.speakersList.filter((s) => absentIds.has(s.delegateId));
        updated.speakersList = c.speakersList.filter((s) => !absentIds.has(s.delegateId));
        toRemove.forEach((s) => removeFromSpeakersListInDB(c.id, s.delegateId, c.code, c.dbChairJoinSuffix ?? undefined));
      }
      return updated;
    }, true);
  };

  const handleApproveJoinRequest = async (motionId: string, delegateId: string, desiredStatus: 'present' | 'present-voting') => {
    await approveJoinRequest(committee.id, motionId, delegateId, desiredStatus, committee.code, committee.dbChairJoinSuffix ?? undefined);
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status: desiredStatus } : d),
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleDenyJoinRequest = async (motionId: string) => {
    await denyJoinRequest(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleApproveGslRequest = async (motionId: string, delegateId: string, country: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    /* Never seat the same delegation twice. Approve was an unconditional append,
       so a double-click, two Commenters acting on the same card, or an approve
       racing a chair who had already added them by hand put one delegation on
       the GSL more than once — and RULE 2 (currentSpeaker is popped OFF the
       list) assumes each delegateId appears at most once, so the duplicate
       desynced the queue for the whole committee. Clear the motion either way:
       the request HAS been answered, they are on the list. */
    const alreadyQueued = committee.speakersList.some((s) => s.delegateId === delegateId)
      || committee.currentSpeaker?.delegateId === delegateId;
    if (alreadyQueued) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
      }), true);
      void removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
      localUpdateTime.current = Date.now();
      return;
    }
    updateLocal(setCommittee, (c) => ({
      ...c,
      speakersList: [...c.speakersList, { delegateId, country }],
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }), true);
    await approveGslRequest(committee.id, motionId, delegateId, country, committee.code, committee.dbChairJoinSuffix ?? undefined);
    localUpdateTime.current = Date.now();
  };

  const handleDenyGslRequest = async (motionId: string) => {
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }), true);
    await denyGslRequest(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    localUpdateTime.current = Date.now();
  };

  // The notification card reuses these EXACT handlers — no second DB path.
  gslActionsRef.current = { approve: handleApproveGslRequest, deny: handleDenyGslRequest };

  // ── ON DECK (owner, 16 Sep 2026) ──────────────────────────────────────────
  // "Remove the 'no current speaker'. When a delegate gets added, they will automatically be
  // put as speaking first."
  //
  // The FIRST delegate on a GSL with nobody seated is drawn on the floor with their clock
  // ready but not running. Nothing is written for this: they remain an ordinary
  // `speakers_list` row, which is exactly why they cannot be lost. A caucus never touches
  // the GSL (RULE 1), suspend/resume preserves it, and a reload or a catch-up re-derives
  // this from the list, so there is no state a motion, an expiry or another device can drop
  // or duplicate. Nothing is seated, so `logFloorSpeech` has no turn to log and no phantom
  // speech can be written for someone who never spoke.
  //
  // They also stay fully movable and removable while on deck, because they are just the
  // head of the list — the strip's normal drag, the grip keys and the X all apply.
  //
  // Start seats them (`handleStartOnDeck`) and starts the clock in ONE press. From the moment
  // they are seated this is an ordinary `current_speaker` turn with its own `seated_at` nonce.
  //
  // There is no "Call first speaker" any more (owner, 16 Sep 2026: "they are already
  // added"). While a delegation is on deck, Next is shown but unavailable, with a tooltip
  // that says Start gives them the floor. It does NOT skip them: passing over the head of
  // the list would silently drop or reorder a delegation, and the strip already has the X
  // and the drag for that. Add time works on deck (`onDeckGrant`).
  const onDeck = !committee.currentSpeaker ? (committee.speakersList[0] ?? null) : null;
  const onDeckGrantSecs = onDeck && onDeckGrant?.id === onDeck.delegateId ? onDeckGrant.secs : 0;

  // The GSL speaker buttons, rendered with AND without a speaker on the floor (the owner's
  // rule: they never disappear). With nobody seated, Start calls the delegation on deck and
  // Next is unavailable; with a speaker and nobody queued it becomes Finish (G-1).
  const gslHasSpeaker = !!committee.currentSpeaker;
  const toggleGslRtr = () => setPopover('rightToReply', 'toggle');
  // The same reasons the Start button cannot start; the clickable countdown obeys them too.
  const gslStartBlockedReason = belowQuorum ? t('speaker_ctl_below_quorum') : null;
  const gslListLen = committee.speakersList.length;
  // A bare icon and "General Speaker's List" (owner, 16 Sep 2026): no count, no topic.
  const gslStripHeader: StripHeader = {
    icon: <ListOrdered size={18} strokeWidth={2.4} aria-hidden />,
    label: t('gsl_full_name'),
  };
  // Start with a delegation on deck: seat them AND start the clock in ONE current_speaker
  // update (`nextSpeakerInDB(..., seatedAt, startedAt)`). It used to be the seat, an await,
  // then a separate start: a Pause or Next pressed while the seat was in flight queued its
  // write between the two, so the start landed last and the database ran a clock the
  // Moderator's screen showed paused (RULE 6: the Moderator never reads its own row back).
  // `seated_at` is stamped exactly as any other seating, so the turn key (S7) is ordinary
  // and `logFloorSpeech` dedupes it the usual way.
  const handleStartOnDeck = async () => {
    if (isViewOnly || committee.phase !== 'speakers-list') return;
    if (belowQuorum || sessionEnded || sessionSuspended) return;
    const next = committee.speakersList[0];
    if (!next || committee.currentSpeaker) return;
    // Time granted while on deck is part of their slot: `time_granted` starts at it, so the
    // speech is logged against the extended slot (T-3). The local fallback accounting
    // (`startBase` = the time limit + extraSecs) gets the same number.
    const grant = onDeckGrant?.id === next.delegateId ? onDeckGrant.secs : 0;
    const timeToUse = speakerTimeLimit + grant;
    if (timeToUse <= 0) return;
    const startedAt = serverNowIso();          // database clock (RULE 6b)
    setTimerRunning(true);
    setExtraTimeAdded(grant > 0);
    extraTimeAddedSecsRef.current = grant;
    setOnDeckGrant(null);
    seatSpeakerClock(timeToUse, startedAt);
    localUpdateTime.current = Date.now();
    updateLocal(setCommittee, (c) => ({
      ...c,
      currentSpeaker: next,
      speakerSeatedAt: startedAt,
      speakersList: c.speakersList.filter((s) => s.delegateId !== next.delegateId),
      speakerTimeRemaining: timeToUse,
    }));
    await nextSpeakerInDB(
      committee.id, timeToUse, next.delegateId, next.country, next.delegateId,
      committee.code, committee.dbChairJoinSuffix ?? undefined, startedAt, startedAt,
    );
    localUpdateTime.current = Date.now();
  };
  const handleGslToggleTimer = () => {
    if (!committee.currentSpeaker && onDeck) { void handleStartOnDeck(); return; }
    handleToggleTimer();
  };
  // Who the floor is drawn around: the seated speaker, else the delegation on deck.
  const gslFloor = committee.currentSpeaker ?? onDeck;
  // ── Which delegation the comment dock writes about ─────────────────────────
  //
  // 17 Sep 2026 (owner: "currently there is always a speaker on the floor, so always have a
  // chat to type in open"). The dock's writing bubble follows whoever holds the floor, and it
  // used to be handed `caucus.currentSpeaker ?? currentSpeaker?.country` only — both null
  // while a delegation is ON DECK. On deck is now the normal state between speeches, so the
  // Commenter was routinely left with no open note field at all, exactly when the delegation
  // in the middle of their screen is the one they want to write about.
  //
  // So the on-deck delegation counts as the floor here. A note written on them carries no
  // `speech_seconds` (nothing has been spoken), which is the same shape as a note written
  // while a delegate holds the floor, so the orphan repair and the reconcile pass adopt it
  // onto the speech when it is logged. Room Order placeholders are excluded: "Speaker 3" is
  // not a delegation and nothing can ever be filed against it.
  const dockFloorCountry = (() => {
    const lc = liveCaucus(committee);
    if (lc) {
      if (lc.currentSpeaker) return lc.currentSpeaker;
      if (committee.phase !== 'moderated-caucus') return null;
      if (lc.purpose?.includes('Room Order')) return null;
      return committee.caucusQueue?.[0]?.country ?? null;
    }
    return committee.currentSpeaker?.country
      ?? (committee.phase === 'speakers-list' ? committee.speakersList[0]?.country ?? null : null);
  })();
  // The strip shows the floor holder first. With a seated speaker they are prepended (they
  // are not a `speakers_list` row); on deck they already ARE the head of the list.
  const gslDisplayList = committee.currentSpeaker
    ? [{ delegateId: committee.currentSpeaker.delegateId, country: committee.currentSpeaker.country }, ...committee.speakersList]
    : committee.speakersList;
  const gslNext = gslHasSpeaker
    ? (gslListLen === 0
      ? { label: t('gsl_yield'), title: t('gsl_yield_title'), onClick: () => { void handleYieldFloor(); }, finish: true, blockedReason: null }
      : { label: t('gsl_next'), title: t('speaker_ctl_next_title'), onClick: () => { void handleNextSpeaker(); }, blockedReason: gslListLen === 0 ? t('speaker_ctl_list_empty') : null })
    : {
        // Nobody seated: the head of the list is on deck and Start calls them, so Next has
        // nothing to do (see ON DECK above). Kept in place, unavailable, saying why.
        label: t('gsl_next'),
        title: t('speaker_ctl_next_title'),
        onClick: () => {},
        blockedReason: onDeck
          ? t('speaker_ctl_on_deck_start').replace('{country}', getCountryDisplayName(onDeck.country, language))
          : t('speaker_ctl_list_empty'),
      };
  // Not drawn for a Commenter: their comment dock takes the floor's lower half, and a locked
  // button row overlapped the clock. Their attempts are caught on the clock, the strip flags
  // and the add bar instead (commenterLock).
  const gslControls = !sessionEnded && !isViewOnly ? (
    <SpeakerControls
      hasSpeaker={gslHasSpeaker}
      floorReady={gslHasSpeaker || !!onDeck}
      addTimeReady={gslHasSpeaker || !!onDeck}
      timerRunning={timerRunning}
      onToggleTimer={handleGslToggleTimer}
      startBlockedReason={gslStartBlockedReason}
      startTutorial={!gslHasSpeaker && onDeck ? 'call-first-speaker' : undefined}
      onRestart={handleRestartTime}
      next={gslNext}
      onAddTime={() => setPopover('extraTime', 'toggle')}
      addTimeActive={openPopovers.extraTime}
      onRightOfReply={gslHasSpeaker || onDeck ? undefined : toggleGslRtr}
      rightOfReplyActive={openPopovers.rightToReply}
      tutorialTargets
    />
  ) : null;

  // Defensive: a caucus phase with a null caucus object is an inconsistent state
  // (e.g. a legacy session where the caucus ended but the phase change never
  // reached the DB). The caucus <main> branches require a truthy caucus, so this
  // would otherwise blank the whole panel. Treat it as the speakers-list view so
  // the GSL never disappears.
  const caucusPhaseWithoutCaucus =
    (committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && !committee.caucus;
  // An ended room is phase 'adjourned', which no floor branch rendered, so the End screen's
  // Session View tab showed a blank floor. Show the speakers' list there; every control on
  // it is already hidden once sessionEnded is true, so it is read-only.
  const showSpeakersListView = committee.phase === 'speakers-list' || caucusPhaseWithoutCaucus
    || (committee.phase === 'adjourned' && sessionEnded);
  // The delegation the GSL floor draws as "Ready to speak", mirrored in the sidebar at #1
  // (expanded list and collapsed rail). Presentation only: they stay in speakersList.
  const gslReadyDelegateId = showSpeakersListView && onDeck ? onDeck.delegateId : null;
  // The moderated caucus / Tour de Table equivalent: the head of the caucus queue while nobody
  // holds the caucus floor (ModeratedCaucusMain draws them on deck). Presentation only.
  const caucusReadyDelegateId = committee.phase === 'moderated-caucus' && committee.caucus && !committee.caucus.currentSpeaker
    ? (committee.caucusQueue?.[0]?.delegateId ?? null) : null;

  // Blocked modal handler — only allow after roll call
  const handleMotionsClick = () => {
    if (isPreSession) return;
    setShowMotions((v) => !v);
    setShowChat(false);
    setShowRollCall(true);
  };
  const handleDocumentsClick = () => {
    if (isPreSession) return;
    setShowDocuments((v) => !v);
    setShowChat(false);
    setShowRollCall(true);
  };
  // Chat is a dialog over the cockpit now, so opening it no longer hides the roster.
  const handleToggleChat = () => setShowChat((v) => !v);

  return (
    <FitToScreen>
    <SeatArtProvider delegates={committee.delegates}>
    <div data-chair-root className="h-full w-full flex overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      {/* The roster sidebar runs the FULL height of the screen, from the very top, with
          the top bar starting at its edge. ChairSidebarShell owns the slot, the forest panel,
          the collapsed flag column (SidebarFlagRail) and the divider, and animates between
          them with transforms only. Width and collapsed state are per reader (localStorage).
          It shows exactly where it did before: not in pre-session, not while chat covers the
          floor, and not on the End View or Suspend View tabs (sidebarVisible). The floor
          column below MUST stay the shell's next sibling: the shell animates it. */}
      {sidebarVisible && (
        <ChairSidebarShell
          width={sidebarWidth}
          collapsed={sidebarCollapsed}
          onWidthChange={handleSidebarResize}
          onCollapsedChange={toggleSidebarCollapsed}
          resizeLabel={t('rollcall_resize_sidebar')}
          rail={(() => {
            const rawName = committee.name;
            const acronym = deriveCommitteeAcronym(rawName, committeeEmblem.abbreviation);
            const primary = committeeDisplayName(getCommitteeDisplayName(rawName, language), acronym);
            return (
              <SidebarFlagRail
                committee={(caucusPanelLocked || committee.caucus?.type === 'moderated')
                  ? (caucusRollCallCommittee ?? { ...committee, speakersList: committee.caucusQueue ?? [], currentSpeaker: null })
                  : committee}
                emblem={{ src: committeeEmblem.logoUrl ?? matchPresetEmblem(rawName, committeeEmblem.abbreviation), monogram: emblemMonogram(primary), alt: primary }}
                onExpand={() => toggleSidebarCollapsed(false)}
                // Reorder from the collapsed column: the same handler the expanded list uses
                // (none in an unmoderated caucus, whose panel has none either). Moderator only.
                onReorderList={isViewOnly || sessionEnded ? undefined
                  : (caucusPanelLocked || committee.caucus?.type === 'moderated') ? handleReorderCaucusQueue
                  : (committee.phase === 'unmoderated-caucus' && committee.caucus) ? undefined
                  : handleReorderSpeakersList}
                readyDelegateId={(caucusPanelLocked || committee.caucus?.type === 'moderated') ? caucusReadyDelegateId : gslReadyDelegateId}
              />
            );
          })()}
        >
          {renderIdentityBadge(true)}
          {extraTimeCapMsg !== null && (
            <div role="status" className="shrink-0 px-3 py-2 bg-amber-900/20 border-b border-amber-700/40 text-amber-300 text-xs text-center font-semibold">
              {t('caucus_extra_time_capped', { n: extraTimeCapMsg })}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
          {(caucusPanelLocked || committee.caucus?.type === 'moderated') ? (
            <RollCallPanel committee={caucusRollCallCommittee ?? { ...committee, speakersList: committee.caucusQueue ?? [], currentSpeaker: null }}
              isTdT={committee.caucus?.purpose?.startsWith('Tour de Table') ?? false}
              isRoomOrderTdT={committee.caucus?.purpose?.includes('Room Order') ?? false}
              onAddToList={(delegateId) => {
                const delegate = committee.delegates.find((d) => d.id === delegateId);
                if (!delegate) return;
                if (committee.caucus?.currentSpeaker === delegate.country) return;
                // Same capacity rule as the main caucus view, read LIVE at the click
                // (derived total and speaker clock), not off the stale anchor value.
                // One check shared with the absent-row path (canAddToList below).
                if (!canAddToCaucusQueue(delegateId)) return;
                updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
                addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'end');
              }}
              hideIdentity
              speechRunning={timerRunning}
              onJoinRequestResolved={handleJoinRequestResolved}
              canAddToList={canAddToCaucusQueue}
              onListIds={caucusQueueIds}
              onRemoveFromList={(delegateId) => {
                updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
                removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
              }}
              onReorderList={handleReorderCaucusQueue}
              readyDelegateId={caucusReadyDelegateId}
              onRemoveCurrentSpeaker={stableRemoveCurrentSpeaker}
              onCycleStatus={handleCycleStatus}
              onStatusChange={handleStatusChange}
              showStatusSliders={showSliders}
              isReadOnly={sessionEnded}
              isViewOnly={isViewOnly} onCommenterAttempt={isCommenter ? notifyCommenter : undefined} />
          ) : (committee.phase === 'unmoderated-caucus' && committee.caucus) ? (
            <RollCallPanel committee={committee}
              hideIdentity
              onCycleStatus={handleCycleStatus}
              onStatusChange={handleStatusChange}
              showStatusSliders={showSliders}
              isReadOnly={sessionEnded}
              isViewOnly={isViewOnly} onCommenterAttempt={isCommenter ? notifyCommenter : undefined} />
          ) : (
            <RollCallPanel committee={committee}
              hideIdentity
              onAddToList={handleAddToSpeakersList}
              onListIds={gslListIds}
              onRemoveFromList={handleRemoveFromSpeakersList}
              onRemoveCurrentSpeaker={stableRemoveCurrentSpeaker}
              onCycleStatus={handleCycleStatus}
              onStatusChange={handleStatusChange}
              onPhaseChange={handlePhaseChange}
              onReorderList={handleReorderSpeakersList}
              showStatusSliders={showSliders}
              speechRunning={timerRunning}
              readyDelegateId={gslReadyDelegateId}
              onJoinRequestResolved={handleJoinRequestResolved}
              isReadOnly={sessionEnded}
              isViewOnly={isViewOnly} onCommenterAttempt={isCommenter ? notifyCommenter : undefined} />
          )}
          </div>
        </ChairSidebarShell>
      )}
      {/* Everything right of the sidebar: the top bar, the banners and the floor. The
          sidebar runs the full height of the screen, so this column starts at its edge. */}
      <div className="relative flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <header ref={topBarRef} className={`bg-[#FAF8F3] ps-2 pe-3 flex flex-wrap items-center content-start gap-x-1.5 shrink-0${docIntroActive ? ' relative z-[46]' : ''}`}
        style={{ height: topBarTwoRows ? TOP_BAR_ROW_PX * 2 : TOP_BAR_ROW_PX }} data-tutorial="topbar">
        {docIntroActive ? (
          // During a document introduction the tabs step aside (the screen below is the
          // Documents flow); the right-hand cluster stays exactly as it is.
          <div className="flex-1 min-w-0" />
        ) : committee.phase !== 'pre-session' && !sessionEnded ? (
          // Two rows when short of room (useTopBarTwoRows): the tabs drop to a full-width
          // second row under the icon cluster (order-last + basis-full).
          <nav ref={topBarNavRef} aria-label={t('chair_hdr_controls')}
            className={`flex min-w-0 items-center gap-1 py-1 ${topBarTwoRows ? 'order-last basis-full w-full' : 'flex-1'}`}
            style={{ height: TOP_BAR_ROW_PX, boxShadow: topBarTwoRows ? 'inset 0 1px 0 rgba(28,20,16,0.06)' : undefined }}>
            <TopBarTab
              tutorial="tab-rollcall"
              label={t('tab_roll_call')}
              active={showSliders}
              // Roll Call brings the roster back with it (18 Sep 2026, owner: "clicking Roll
              // Call should expand the sidebar if it is collapsed"): with the sidebar folded
              // to the flag rail, a press expands it AND opens the Roll Call tab, never closes it.
              onClick={() => {
                if (sidebarCollapsed) { toggleSidebarCollapsed(false); setShowSliders(true); setShowChat(false); setShowRollCall(true); return; }
                const opening = !showSliders; setShowSliders(opening); if (opening) setShowChat(false); setShowRollCall(true);
              }}
            />
            {(() => {
              const n = (committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length;
              return (
                <TopBarTab tutorial="tab-motions" label={t('tab_motions')} active={showMotions} onClick={handleMotionsClick}
                  count={n} countLabel={t('chair_hdr_tab_count', { label: t('tab_motions'), n })} />
              );
            })()}
            {(() => {
              const n = (committee.documents ?? []).filter((d) => d.status === 'submitted').length;
              return (
                <TopBarTab tutorial="tab-documents" label={t('tab_documents')} active={showDocuments} onClick={handleDocumentsClick}
                  count={n} countLabel={t('chair_hdr_tab_count', { label: t('tab_documents'), n })} />
              );
            })()}
          </nav>
        ) : agenda.canSwitch ? (
          <button type="button" onClick={agenda.openPicker} title={t('agenda_change_title')}
            className="text-[#6A5A4A] text-sm hidden sm:block truncate flex-1 min-w-0 px-2 text-start rounded cursor-pointer transition-colors hover:text-[#1B3828] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]/60">
            {getCommitteeDisplayName(committee.name, language)}: <span className="underline decoration-dotted underline-offset-2">{committee.topic}</span>
          </button>
        ) : (
          <span className="text-[#6A5A4A] text-sm hidden sm:block truncate flex-1 min-w-0 px-2">{getCommitteeDisplayName(committee.name, language)}: {committee.topic}</span>
        )}

        {/* The icon cluster: always in row one, at the inline end. */}
        <div ref={topBarClusterRef} className="ms-auto flex min-w-0 items-center gap-1.5" style={{ height: TOP_BAR_ROW_PX }}>
        {/* The gavel lives here, on the front page, not buried in Settings, and shows for
            EVERY chair in BOTH states, so handover reads as a one-tap switch rather than an
            error. A genuinely solo chair has nobody to hand to, so the affordance stays hidden,
            but a view-only device always gets it, including the organiser's ?chairName=Secretariat
            deep link, whose name may not be in chair_names yet. In the top bar now (`inline`),
            so it no longer floats over the floor view. */}
        {!sessionEnded && ((committee.chairNames?.length ?? 0) > 1 || isViewOnly) && (
          <GavelChip
            inline
            chairNames={committee.chairNames ?? []}
            headChairName={headChairName}
            myChairName={myChairName}
            onlineChairs={onlineChairs}
            headOffline={headOffline}
            heldElsewhere={gavelElsewhere}
            onTakeGavel={() => handleSetHeadChair(myChairName)}
            onHandOver={(name) => handleSetHeadChair(name)}
          />
        )}
        {/* The SESSION code only (never the chair code). A click presents it to the room,
            full screen, growing out of this button; Copy lives inside the presenter. */}
        <button type="button"
          onClick={(e) => setCodePresenterOrigin(e.currentTarget.getBoundingClientRect())}
          data-tutorial="join-code"
          aria-haspopup="dialog"
          aria-expanded={!!codePresenterOrigin}
          aria-label={t('chair_hdr_show_code', { code: committee.code })}
          title={t('chair_hdr_show_code', { code: committee.code })}
          // Never wider than 9.5rem: a long custom code (up to 20 characters) or wide glyphs
          // (WWMMWW) truncate with an ellipsis instead of pushing the icons off the bar. The
          // full code is in the title and aria-label, and on the presenter.
          className="shrink min-w-0 max-w-[9.5rem] inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#EDE7D8] hover:bg-[#E2DAC8] text-[#1C1410] transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.96] ms-1 me-1"
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: '0.08em' }}>
          <Maximize2 size={13} strokeWidth={2.4} aria-hidden className="shrink-0" style={{ opacity: 0.6 }} />
          <span className="tabular-nums truncate min-w-0">{committee.code}</span>
        </button>
        {codePresenterOrigin && (
          <SessionCodePresenter code={committee.code} origin={codePresenterOrigin} onClose={closeCodePresenter} />
        )}
        {committee.phase !== 'pre-session' && !sessionEnded && (() => {
          const totalUnread = showChat ? 0 : chatUnreadTotal(committee.messages, myChairName || 'Chair', true, committee.chairNames ?? [], chatReadCounts);
          return (
            <TopBarIconButton tutorial="tab-chat" onClick={() => { if (!isPreSession) handleToggleChat(); }} active={showChat}
              count={totalUnread}
              label={totalUnread > 0 ? t('chair_hdr_chat_unread', { n: totalUnread }) : t('tab_chat')}>
              <MessageCircle size={21} strokeWidth={2} aria-hidden />
            </TopBarIconButton>
          );
        })()}
        <TopBarIconButton tutorial="tab-scoreboard" onClick={() => setShowScoreboard(true)} label={t('chair_hdr_scoreboard')}>
          <Trophy size={21} strokeWidth={2} aria-hidden />
        </TopBarIconButton>
        {/* Once the gavel has fallen, a conference chair's next job is the award slate: a
            subtle second affordance beside the scoreboard trophy. Conference sessions ONLY;
            never rendered for a standalone session. */}
        {sessionEnded && committee.sessionOrigin === 'conference' && (
          <ChairAwardsCta
            code={committee.code}
            label={t('chair_ended_awards_cta')}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 gv-lift transition-colors"
            style={{ backgroundColor: 'rgba(182,135,31,0.12)', color: '#8B5A20', border: '1px solid rgba(182,135,31,0.35)', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em' }}
          />
        )}
        <TopBarIconButton tutorial="tab-settings" onClick={() => setShowSettings(true)} label={t('chair_hdr_settings')}>
          <Settings size={21} strokeWidth={2} aria-hidden />
        </TopBarIconButton>
        </div>
      </header>
      {!sessionEnded && gavelElsewhere && (
        <GavelDeviceBanner onUseThisDevice={() => committee && claimGavelForThisDevice(committee, headChairName || myChairName)} />
      )}
      {/* R-5: one deduplicated "Not saved" notice for every session write on this device.
          T-1: a hint when this device's clock is more than 5 s off the database. */}
      <SaveStatusToast />
      <ClockSkewHint />
      {/* R-4: Live / Reconnecting / Offline for this device's realtime connection. */}
      <ConnectionPill state={connection} placement="bottom-end" />
      {gavelToast && (
        <GlassToast
          tone={gavelToast.tone}
          text={gavelToast.text}
          // NotificationStack owns the slot directly under the header now and publishes
          // its measured height as `--dgn-stack-shift` on <html> (0 / absent when the
          // stack is empty or suppressed). The toast and the GavelChip both add it, so
          // they slide down out of the way together and keep their spacing.
          style={{ top: 'calc(6.6rem + var(--dgn-stack-shift, 0px))', right: '0.85rem' }}
        />
      )}
      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
          <button onClick={() => setEndedTab('ended')}
            className="flex-1 py-2.5 text-sm font-black transition-colors border-b-2 focus:outline-none tracking-wide"
            style={{ color: endedTab === 'ended' ? '#1B3828' : '#9A8A78', borderBottomColor: endedTab === 'ended' ? '#1B3828' : 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_end_view')}
          </button>
          <button onClick={() => setEndedTab('session')}
            className="flex-1 py-2.5 text-sm font-black transition-colors border-b-2 focus:outline-none tracking-wide"
            style={{ color: endedTab === 'session' ? '#1B3828' : '#9A8A78', borderBottomColor: endedTab === 'session' ? '#1B3828' : 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_view')}
          </button>
        </div>
      )}
      {/* Suspend tab bar */}
      {!sessionEnded && sessionSuspended && (
        <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
          <button onClick={() => setSuspendTab('suspend')}
            className={`flex-1 py-2.5 text-sm font-black transition-colors border-b-2 focus:outline-none tracking-wide`}
            style={{ color: suspendTab === 'suspend' ? '#1B3828' : '#9A8A78', borderBottomColor: suspendTab === 'suspend' ? '#1B3828' : 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_suspend_view')}
          </button>
          <button onClick={() => setSuspendTab('session')}
            className={`flex-1 py-2.5 text-sm font-black transition-colors border-b-2 focus:outline-none tracking-wide`}
            style={{ color: suspendTab === 'session' ? '#1B3828' : '#9A8A78', borderBottomColor: suspendTab === 'session' ? '#1B3828' : 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_session_view')}
          </button>
        </div>
      )}
      {sessionEnded && endedTab === 'session' && (
        <div className="shrink-0 px-4 py-2 text-center text-sm font-bold" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
          {t('session_ended_banner')}
        </div>
      )}
      {!sessionEnded && sessionSuspended && suspendTab === 'session' && (
        <div className="shrink-0 px-4 py-2 text-center text-sm font-bold" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
          {t('session_suspended_banner')}
        </div>
      )}
      {/* Waiting Room — delegates awaiting chair admission (chair-approval gate) */}
      {(() => {
        const joinReqs = (committee.pendingMotions ?? []).filter((m) => m.type === ('join-request' as string));
        if (joinReqs.length === 0) return null;
        const wrLabel = language === 'ar' ? 'غرفة الانتظار' : language === 'fr' ? "Salle d'attente" : language === 'es' ? 'Sala de Espera' : 'Waiting Room';
        return (
          <div className="shrink-0 border-b border-[#1B3828]/40 px-4 py-2 flex flex-wrap items-center gap-3" style={{ backgroundColor: '#F3EEE2' }}>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
              🚪 {wrLabel} · {joinReqs.length}
            </span>
            {joinReqs.map((m) => {
              let delegateId = '';
              let desiredStatus: 'present' | 'present-voting' = 'present';
              try { const parsed = JSON.parse(m.topic); delegateId = parsed.delegateId; desiredStatus = parsed.desiredStatus; } catch {}
              const flagEl = <SeatFlag country={m.proposedBy} size={20} className="object-contain inline-block" fallback={<UnknownSeatIcon size={20} />} />;
              return (
                <div key={m.id} className="flex items-center gap-2.5 text-sm rounded-xl px-2.5 py-1" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <span className="font-mono text-lg">{flagEl}</span>
                  <span className="text-[#1C1410] font-semibold">{getCountryDisplayName(m.proposedBy, language)}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${desiredStatus === 'present-voting' ? 'bg-[#1B3828] text-[#EED98A]' : 'bg-[#1B3828]/15 text-[#1B3828]'}`}>
                    {desiredStatus === 'present-voting' ? 'P+V' : 'P'}
                  </span>
                  <button onClick={() => handleApproveJoinRequest(m.id, delegateId, desiredStatus)}
                    className="ms-1 px-3 py-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-[#EED98A] text-xs rounded-lg font-black transition-colors gv-lift">{t('session_approve')}</button>
                  <button onClick={() => handleDenyJoinRequest(m.id)}
                    className="px-2.5 py-1 bg-transparent hover:bg-[#8B2020]/10 border border-[#8B2020]/40 text-[#8B2020] text-xs rounded-lg font-bold transition-colors">{t('session_deny')}</button>
                </div>
              );
            })}
          </div>
        );
      })()}
      {/* The full-width "GSL REQUEST … ADD TO GSL / DENY" bar used to live here. It was a
          second, redundant presentation of the very same pending `gsl-request` motions the
          NotificationStack already raises a card for, with the same two buttons calling the
          same two handlers. Only the notification remains.

          NOTHING about the motion itself changed: `handleApproveGslRequest` /
          `handleDenyGslRequest` are untouched and are what the card's Accept / Reject run,
          via `gslActionsRef` (see the effect that raises the card). The join-request
          "Waiting Room" bar directly above is a DIFFERENT motion type and stays. */}
      {sessionEnded && endedTab === 'ended' ? (
        <SessionEndedContent committee={committee} hoursRemaining={hoursRemaining} />
      ) : (!sessionEnded && sessionSuspended && suspendTab === 'suspend') ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          {(() => {
            // Same identity expression as claimedName in handleResumeClick — they must agree,
            // or a chair holding the latch under the 'Chair' fallback sees a disabled button
            // and cannot finish their own resume.
            // Mirrors foreignResumeLatch: same name on another device counts as another chair.
            const anotherChairResuming = committee.resumingChair && !(committee.resumingChair === (myChairName || committee.chairNames[0] || 'Chair')
              && resumeClaimIsMine(committee.code, committee.suspendedAt));
            return (
              <>
                <h1 className="text-6xl font-black mb-4 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('session_suspended_title')}</h1>
                <p className="text-xl mb-12" style={{ color: '#6A5A4A' }}>{t('session_suspended_desc')}</p>
                {anotherChairResuming ? (
                  <>
                    <button disabled className="px-12 py-5 rounded-2xl cursor-not-allowed font-black text-xl gv-lift-dark" style={{ backgroundColor: '#DDD4C0', color: '#9A8A78' }}>
                      {t('session_resume_btn')}
                    </button>
                    <p className="text-sm mt-4" style={{ color: '#B8844A' }}>{t('session_resuming_other').replace('{name}', committee.resumingChair ?? '')}</p>
                    {/* The latch normally clears in well under a second. Still held after 12s
                        means that chair never finished — offer a take-over so the committee is
                        not stranded suspended forever. */}
                    {resumeStale && (
                      <button
                        onClick={handleTakeOverResume}
                        disabled={resumeBusy}
                        className="mt-5 px-6 py-3 rounded-xl font-black text-sm transition-colors focus:outline-none disabled:opacity-60 gv-lift-dark"
                        style={{ backgroundColor: '#8B5A20', color: '#EDE7D8', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}>
                        {resumeBusy ? '…' : t('session_resume_takeover')}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleResumeClick}
                    disabled={resumeBusy}
                    className="px-12 py-5 text-white text-xl font-black rounded-2xl transition-colors focus:outline-none disabled:opacity-70 disabled:cursor-wait gv-lift-dark" style={{ backgroundColor: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
                    onMouseEnter={(e) => { if (!resumeBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
                    {t('session_resume_btn')}
                  </button>
                )}
                {resumeError && (
                  <p className="text-sm mt-5 max-w-md" role="alert" style={{ color: '#8B2020' }}>{resumeError}</p>
                )}
                <p className="text-xs mt-8" style={{ color: '#9A8A78' }}>{t('session_adjourned_hint')}</p>
              </>
            );
          })()}
        </div>
      ) : (
      <div className="relative flex-1 flex overflow-hidden min-h-0">
        {/* Chat is a dialog that grows out of the chat icon (src/components/chat/ChatDialog.tsx);
            it portals, so where it sits in this tree does not matter. */}
        {showChat && !sessionEnded && (
          <ChatDialog onClose={() => setShowChat(false)}>
            {(requestClose) => getCommitteeFlags(committee).disableChat ? (
              <ChatDisabledNotice onClose={requestClose} />
            ) : (
              <ChatPanel
                committee={committee}
                senderName={myChairName || 'Chair'}
                isChair={true}
                /* No onClose: ChatDialog draws the close button outside the panel's corner. */
                readOnly={sessionEnded}
                readCounts={chatReadCounts}
                onReadCountsChange={setChatReadCounts}
              />
            )}
          </ChatDialog>
        )}
        {!showChat && committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-5 min-h-0">
            {/* The full-screen roll call: wide and tall enough for projector-sized rows
                (RollCallPanel isRollCallPhase). max-height is 100% of this box, never vh:
                FitToScreen scales the page, so vh would overshoot the scaled layout. */}
            <div className="w-full max-w-2xl rounded-3xl overflow-hidden relative" style={{ maxHeight: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1B3828', border: '1.5px solid #3D7A52', boxShadow: '0 32px 80px rgba(27,56,40,0.40)' }}>
              <div className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }} />
              <div className="relative z-[2] shrink-0">{identityBadge}</div>
              <div className="flex-1 min-h-0">
              <RollCallPanel committee={committee}
                hideIdentity
                onListIds={gslListIds}
                onCycleStatus={handleCycleStatus}
                onStatusChange={handleStatusChange}
                onBulkStatusChange={handleBulkStatusChange}
                onPhaseChange={handlePhaseChange}
                isRollCallPhase={true}
                showBulkActions={true}
                isReadOnly={sessionEnded}
                isViewOnly={isViewOnly} onCommenterAttempt={isCommenter ? notifyCommenter : undefined} />
              </div>
            </div>
          </div>
        )}
        {committee.phase !== 'pre-session' && (
          <>
            {/* relative + isolate: FloorEmblemBackdrop sits at z-index -1 inside this stacking
                context, above the page ground and below every piece of floor content. */}
            <main className="relative isolate flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
              <FloorEmblemBackdrop />
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                caucusLoading ? (() => {
                  const isTdTParent = committee.caucus?.purpose?.startsWith('Tour de Table') ?? false;
                  return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="bg-[#EDE7D8] border border-[#1B3828]/40 rounded-3xl px-12 py-10 max-w-lg w-full shadow-2xl">
                      {isTdTParent ? (
                        <>
                          <p className="text-xs font-mono tracking-widest mb-3 font-bold" style={{ color: '#1B3828' }}>{t('caucus_starting_tdt')}</p>
                          <h1 className="text-5xl font-black mb-2" style={{ color: '#1B3828' }}>{t('caucus_tdt_title')}</h1>
                          <p className="text-[#6A5A4A] text-sm mb-6">
                            {committee.caucus.purpose?.includes('Room Order')
                              ? t('caucus_tdt_room_order')
                              : committee.caucus.purpose?.includes('Z→A') ? t('caucus_tdt_z_to_a') : t('caucus_tdt_a_to_z')}
                          </p>
                          <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">
                                {committee.caucusQueue?.length ?? caucusQueueCapacity(committee.caucus.totalTime, committee.caucus.speakingTime, 0, 0)}
                              </div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_delegates')}</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">{committee.caucus.speakingTime}s</div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_per_speaker')}</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">{formatTime(committee.caucus.totalTime)}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_total_time')}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                            <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                            <span>{t('caucus_setting_up')}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-mono tracking-widest mb-3 font-bold" style={{ color: '#1B3828' }}>{t('caucus_starting_moderated')}</p>
                          <h1 className="text-5xl font-black mb-2" style={{ color: '#1B3828' }}>{committee.caucus.purpose || t('caucus_moderated_title')}</h1>
                          <p className="text-[#6A5A4A] text-sm mb-6">{committee.topic}</p>
                          <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">{formatTime(committee.caucus.totalTime)}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_total_time')}</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">{committee.caucus.speakingTime}s</div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_per_speaker')}</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">{caucusQueueCapacity(committee.caucus.totalTime, committee.caucus.speakingTime, 0, 0)}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_max_speakers')}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                            <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                            <span>{t('caucus_loading_caucus')}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })() : (
                  <ModeratedCaucusMain
                    committee={committee}
                    setCommittee={setCommittee}
                    speakerTimeRemaining={speakerTimeRemaining}
                    timerRunning={timerRunning}
                    caucusSeconds={caucusSeconds}
                    openPopovers={openPopovers}
                    setPopover={setPopover}
                    extraTimeAdded={extraTimeAdded}
                    handleToggleTimer={handleToggleTimer}
                    handleRestartTime={handleRestartTime}
                    handleNextCaucusSpeaker={handleNextCaucusSpeaker}
                    handleStartOnDeck={handleStartCaucusOnDeck}
                    handleEndCaucus={handleEndCaucus}
                    sessionEnded={sessionEnded}
                    isViewOnly={isViewOnly}
                    commenterLock={commenterLock}
                    onRecognise={recogniseAbsentDelegate}
                    onRemoveFloorSpeaker={stableRemoveFloorSpeaker}
                  />
                )
              )}
              {committee.phase === 'unmoderated-caucus' && committee.caucus && (
                unmodLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="bg-[#EDE7D8] border border-[#DDD4C0]/40 rounded-3xl px-12 py-10 max-w-lg w-full shadow-2xl">
                      <p className="text-xs font-mono tracking-widest mb-3 font-bold" style={{ color: '#1B3828' }}>
                        {t('caucus_unmod_starting').replace('{name}', (committee.caucus.motionLabel ?? (language === 'ar' ? 'حوار حر' : language === 'fr' ? 'CAUCUS NON MODÉRÉ' : language === 'es' ? 'CÁUCUS NO MODERADO' : 'UNMODERATED CAUCUS')).toUpperCase())}
                      </p>
                      <h1 className="text-5xl font-black mb-2" style={{ color: '#1B3828' }}>
                        {committee.caucus.motionLabel ?? (language === 'ar' ? 'حوار حر' : language === 'fr' ? 'Caucus non modéré' : language === 'es' ? 'Cáucus No Moderado' : 'Unmoderated Caucus')}
                      </h1>
                      {committee.caucus.purpose && (
                        <p className="text-[#6A5A4A] text-sm mb-6">{committee.caucus.purpose}</p>
                      )}
                      <div className="flex justify-center gap-8 mb-8">
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#1C1410]">{formatTime(committee.caucus.totalTime)}</div>
                          <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_total_time')}</div>
                        </div>
                        <div className="w-px bg-[#DDD4C0]" />
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#1C1410]">{committee.caucus.proposedBy}</div>
                          <div className="text-xs text-[#9A8A78] mt-1">{t('caucus_proposed_by')}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                        <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                        <span>{t('caucus_loading')}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} isViewOnly={isViewOnly} gavelCue={gavelCue} />
                )
              )}

{committee.phase === 'voting' && (
                <VotingInProgressCard committee={committee} isViewOnly={isViewOnly} chairName={myChairName} />
              )}

{showSpeakersListView && (
                <>
                {/* Three-zone flex column: queue locked top, centre shrinks, buttons locked above bottom bar */}
                <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* The floating "GSL" caption is gone: the strip's marker says
                      "General Speaker's List" in full, with the topic beneath (owner). */}
                  {isViewOnly ? (
                    /* A Commenter reads the floor as one ROW: the delegation on the floor big
                       on the inline-start side, the queue beside it (owner, 17 Sep 2026). No
                       strip, no clock, no controls — half the height, so the comment dock
                       underneath gets the room it needs. See CommenterFloor.tsx. */
                    <CommenterFloor
                      header={gslStripHeader}
                      floorCountry={gslFloor?.country ?? null}
                      floorLabel={gslFloor ? (committee.currentSpeaker ? t('view_is_speaking') : t('gsl_on_deck')) : null}
                      upcoming={committee.speakersList.filter((s) => s.delegateId !== gslFloor?.delegateId)}
                      formatName={(c) => getCountryDisplayName(c, language)}
                      onLockedAttempt={commenterLock?.onAttempt}
                      emptyHint={<p className="text-center text-sm font-semibold" style={{ color: '#6A5A4A' }}>{t('gsl_no_speakers_queued')}</p>}
                    />
                  ) : gslFloor ? (
                    <>
                      {/* ZONE 1 — mode marker + queue locked at top */}
                      <div className="shrink-0">
                        <DraggableSpeakersQueue
                          list={gslDisplayList}
                          header={gslStripHeader}
                          currentSpeakerDelegateId={committee.currentSpeaker?.delegateId ?? null}
                          onDeckDelegateId={onDeck?.delegateId ?? null}
                          onReorder={isViewOnly ? undefined : (newList) => handleReorderSpeakersList(newList.filter((s) => s.delegateId !== committee.currentSpeaker?.delegateId))}
                          onRemove={isViewOnly ? undefined : handleRemoveFromSpeakersList}
                          onRemoveCurrent={isViewOnly || sessionEnded || !committee.currentSpeaker ? undefined : () => handleRemoveCurrentSpeaker()}
                          onLockedAttempt={commenterLock?.onAttempt}
                        />
                      </div>
                      {/* ZONE 2 — Flag + name + timer + progress: compresses as viewport shrinks */}
                      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-1">
                        <SeatCircleFlag
                          country={gslFloor.country}
                          size={FLOOR_FLAG_PX}
                          decorative
                          loading="eager"
                          className="floor-emblem-anchor"
                          style={{ boxShadow: FLOOR_FLAG_SHADOW }}
                        />
                        <h1 className="font-black text-[#1C1410] text-center" style={{ fontSize: FLOOR_NAME_REM, margin: '8px 0' }}>{getCountryDisplayName(gslFloor.country, language)}</h1>
                        {isViewOnly ? (
                          <div className={`font-bold text-[#6A5A4A] text-center ${commenterLock ? 'cursor-not-allowed' : ''}`} style={{ fontSize: '1.5rem', marginBottom: '8px' }}
                            title={commenterLock?.reason} onClick={commenterLock?.onAttempt}>
                            {committee.currentSpeaker ? t('view_is_speaking') : t('gsl_on_deck')}
                          </div>
                        ) : (
                          <>
                            <SpeakerClock
                              tutorial="timer"
                              running={timerRunning}
                              onToggle={!sessionEnded ? handleGslToggleTimer : undefined}
                              blockedReason={gslStartBlockedReason}
                              className={`font-black font-mono tabular-nums ${committee.currentSpeaker && speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'}`}
                              style={{ fontSize: '5rem', marginBottom: '4px', lineHeight: 1.15 }}
                            >
                              {/* On deck nothing is seated, so the clock the row still holds may
                                  belong to the last turn: show the slot Start will give them. */}
                              {formatTime(committee.currentSpeaker ? speakerTimeRemaining : speakerTimeLimit + onDeckGrantSecs)}
                              {(committee.currentSpeaker ? extraTimeAdded : onDeckGrantSecs > 0) && <span className="text-base ms-2 font-normal text-[#1C1410]">{t('gsl_plus_time')}</span>}
                            </SpeakerClock>
                            <FloorProgress
                              percent={committee.currentSpeaker ? progress : 100}
                              barClassName={!committee.currentSpeaker || progress > 20 ? 'bg-[#B6871F]' : 'bg-[#B8844A]'}
                              rtr={!sessionEnded ? { onClick: toggleGslRtr, active: openPopovers.rightToReply, tutorial: 'rtr-button' } : null}
                            />
                          </>
                        )}
                      </div>
                      {/* ZONE 3 — Action buttons locked just above bottom bar */}
                      {gslControls}
                    </>
                  ) : (
                    /* Nobody on the list at all. The shouty "No Current Speaker" heading is
                       gone (owner): the marker says where the room is, and the bar below says
                       what to do. The speaker buttons stay put so nothing jumps. */
                    <>
                    <div className="shrink-0">
                      <DraggableSpeakersQueue list={[]} header={gslStripHeader} />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center w-full text-center px-4">
                      <p className="text-center text-sm font-semibold" style={{ color: '#6A5A4A' }}>{t('gsl_add_call_first')}</p>
                    </div>
                    {/* Nobody on the list: Start, Next and Add time wait here, unavailable,
                        each saying why. The first delegation added goes straight on deck. */}
                    {gslControls}
                    </>
                  )}
                </div>
                {!sessionEnded && !isViewOnly && (
                // FloorBarExtent publishes this bar's height: the collapsed sidebar column
                // continues its ground under itself so the bar runs the full page width.
                <FloorBarExtent className="border-t border-[#DDD4C0] px-6 py-2.5 shrink-0" style={{ backgroundColor: '#F6F1E9' }}>
                  {belowQuorum && (
                    <p className="text-xs text-[#8B2020] text-center pb-2">
                      ⚠️ Below quorum: speakers cannot be added until {Math.ceil(quorumFraction * totalCount)} delegates are present.
                    </p>
                  )}
                  {/* ONE row under the Start / Next controls (owner, 16 Sep 2026): the add
                      control runs the width of the floor, the speaking-time presets sit
                      beside it instead of on their own line above. */}
                  {!isViewOnly && (
                  <div className="flex items-center gap-3" data-tutorial="speakers-bottom-bar">
                    <div className="flex-1 min-w-0">
                      <AddSpeakerInput committee={committee} onAdd={belowQuorum ? () => {} : handleAddToSpeakersList} onRecognise={belowQuorum ? undefined : recogniseAbsentDelegate} />
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#9A8A78] shrink-0 me-0.5">{t('gsl_time')}</span>
                      {[45, 60, 75, 90].map((preset) => (
                        <button key={preset} onClick={() => handleSetSpeakerTimeLimit(preset)} title={t('gsl_time_preset_title').replace('{n}', String(preset))}
                          className={`gv-lift h-9 min-w-[2.9rem] px-2 rounded-lg text-xs font-black tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] ${speakerTimeLimit === preset ? 'bg-[#1B3828] text-[#EED98A]' : 'bg-[#E4DCC8] text-[#5A4E3E] hover:bg-[#D8CDB4] hover:text-[#1B3828]'}`}>
                          {preset}s
                        </button>
                      ))}
                      <input type="number" value={speakerTimeLimitInput}
                        aria-label={t('gsl_time_custom')}
                        onChange={(e) => setSpeakerTimeLimitInput(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(speakerTimeLimitInput);
                          if (!isNaN(val) && val > 0) handleSetSpeakerTimeLimit(val);
                          else setSpeakerTimeLimitInput(String(speakerTimeLimit));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(speakerTimeLimitInput);
                            if (!isNaN(val) && val > 0) handleSetSpeakerTimeLimit(val);
                            else setSpeakerTimeLimitInput(String(speakerTimeLimit));
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                        className="w-16 h-9 bg-[#FAF8F3] border border-[#DDD4C0] focus:border-[#1B3828] rounded-lg px-2 text-[#1C1410] text-xs font-bold tabular-nums text-center transition-colors focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                    </div>
                  </div>
                  )}
                </FloorBarExtent>
                )}
                </>
              )}
              {/* Commenter live comment dock — docked under the timer, beside (never over) the
                  roll-call sidebar. Commenters ONLY: the Moderator is running the room and does
                  not comment. Do not add a Moderator affordance for this without being asked. */}
              {/* currentCountry uses liveCaucus, NOT committee.caucus: a leftover caucus JSONB
                  (suspend/end-debate never nulls it, and the two writes that end a caucus land as
                  separate realtime rows) would otherwise name the old caucus speaker as the one
                  holding the floor while the committee is already back on the GSL. */}
              {/* A REAL Commenter only: another chair's name holds the gavel. A device that is
                  view-only because the SAME name holds the gavel on another device (or a page
                  with no ?chairName=) is not a Commenter, and would write notes under the
                  Moderator's own name. */}
              {isViewOnly && !!myChairName && !gavelRoleOf(committee).nameHolds && (
                <FeedbackLogPanel
                  committee={committee}
                  chairName={myChairName || committee.chairNames[0] || 'Chair'}
                  currentCountry={dockFloorCountry}
                  feedbackVersion={feedbackVersion}
                />
              )}
            </main>
          </>
        )}
      </div>
      )}
      {showMotions && !isPreSession && !sessionEnded && (
        <MotionsModal
          committee={committee}
          onClose={() => setShowMotions(false)}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater, true)}
          belowQuorum={belowQuorum}
          isViewOnly={isViewOnly}
          onCommenterAttempt={isCommenter ? notifyCommenter : undefined}
          floorClock={() => ({
            base: speakerAnchorRef.current.base,
            startedAt: speakerAnchorRef.current.startedAt,
            extraSecs: extraTimeAddedSecsRef.current,
          })}
        />
      )}
      {/* "N other motions fell" + Undo, a failed motion save, a blocked proposer. Lives
          outside MotionsModal so it survives the modal closing (M-1, M-2). */}
      {committee && !isViewOnly && <MotionFlightNotice committeeId={committee.id} closed={!!committee.suspendedAt || !!committee.endedAt} />}
      {showDocuments && !isPreSession && !sessionEnded && (
        <DocumentsModal
          committee={committee}
          onClose={() => setShowDocuments(false)}
          onIntroChange={setDocIntroActive}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater, true)}
          isViewOnly={isViewOnly}
          // Carried into /voting/[code] so its "Back to Session" can hand the identity
          // back here — ?chairName= is the only thing that identifies a chair.
          chairName={myChairName}
        />
      )}
      {showSettings && (
        <SettingsPanel
          committee={committee}
          myChairName={myChairName}
          isViewOnly={isViewOnly}
          onlineChairs={onlineChairs}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showScoreboard && (
        <ScoreboardPanel
          committee={committee}
          onClose={() => setShowScoreboard(false)}
          feedbackVersion={feedbackVersion}
          isViewOnly={isViewOnly}
          chairName={myChairName}
        />
      )}
      {/* EXTRA TIME OVERLAY: a movable panel (src/components/DraggablePopover.tsx), Portal +
          fixed, dragged by its handle, position remembered for this tab.
          16 Sep 2026 (owner): deep blue, the clock icon in the header AND on the button that
          grants the time, and it opens ABOVE the Add time button instead of over it. It sits
          BELOW every dialog (DraggablePopover's z-40 vs the dialogs' z-50 and up) and never
          moves when one opens. */}
      {!sessionEnded && !isViewOnly && openPopovers.extraTime && (
        <DraggablePopover
          id="add-time"
          slot="upper"
          anchor="add-time"
          accent={POPOVER_TONES.time.accent}
          tone={POPOVER_TONES.time}
          className="w-72"
          handleLabel={t('popover_drag_handle')}
          closeLabel={t('popover_close')}
          onClose={() => setPopover('extraTime', false)}
          title={
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide">
              <ClockPlus size={16} strokeWidth={2.6} aria-hidden className="shrink-0" />
              {t('gsl_add_time_title')}
            </span>
          }
        >
            <div className="flex gap-2 mb-2">
              {[15, 30, 60].map((s) => (
                <button key={s} onClick={() => { handleAddExtraTime(s); }} disabled={!addTimeHasTarget}
                  style={{ backgroundColor: POPOVER_TONES.time.chip, color: POPOVER_TONES.time.ink }}
                  className="flex-1 py-2 text-xs rounded-lg font-black uppercase tracking-wide transition-transform gv-lift disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3A57]">
                  +{s}s
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={extraTimeSecs}
                onChange={(e) => setExtraTimeSecs(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseInt(extraTimeSecs); if (n > 0) { handleAddExtraTime(n); } } }}
                placeholder={language === 'ar' ? 'ثوانٍ مخصصة...' : language === 'fr' ? 'Sec. personnalisées...' : language === 'es' ? 'Tiempo personalizado...' : 'Custom sec...'}
                style={{ MozAppearance: 'textfield', color: POPOVER_TONES.time.ink } as React.CSSProperties}
                className="flex-1 min-w-0 bg-white/70 border border-[#0E3A57]/25 rounded-lg px-2 py-2 text-xs font-semibold placeholder-[#0A3350]/55 focus:outline-none focus:border-[#0E3A57] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => { const n = parseInt(extraTimeSecs); if (n > 0) { handleAddExtraTime(n); } }}
                disabled={!addTimeHasTarget || !extraTimeSecs || parseInt(extraTimeSecs) <= 0}
                style={{ backgroundColor: POPOVER_TONES.time.btn, color: POPOVER_TONES.time.btnFg }}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-lg font-black transition-transform gv-lift disabled:opacity-40 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3A57] focus-visible:ring-offset-2">
                <ClockPlus size={15} strokeWidth={2.6} aria-hidden className="shrink-0" />
                {t('gsl_add_time_btn')}
              </button>
            </div>
        </DraggablePopover>
      )}
      {/* Exactly ONE per surface — this host owns the interval that advances every
          notification's TTL, so a second mount would halve every countdown. */}
      {agenda.picker}
      {/* One-time Gavelling Conferences invitation: standalone rooms, Moderator only, a plain
          unmoderated caucus that has run 3 minutes (ConferencePromoDialog.tsx). */}
      <ConferencePromoDialog
        code={committee.code}
        caucus={committee.caucus}
        eligible={!isViewOnly && committee.sessionOrigin !== 'conference'
          && committee.phase === 'unmoderated-caucus' && !!committee.caucus && !committee.caucus.isConsultation
          && !unmodLoading && !sessionSuspended && !sessionEnded && !committee.suspendedAt && !committee.endedAt}
        blocked={showMotions || showDocuments || showSettings || showScoreboard || showChat || showTutorial || !!codePresenterOrigin}
      />
      {settingsSync.notice}
      <NotificationStack extras={broadcastExtras} topPx={(topBarTwoRows ? TOP_BAR_ROW_PX * 2 : TOP_BAR_ROW_PX) + 8} />
      {showTutorial && committee && (
        <TutorialOverlay
          committee={committee}
          onEnd={() => setShowTutorial(false)}
        />
      )}
      {/* RTR OVERLAY: a movable panel through Portal (DraggablePopover), completely outside
          document flow, so it never affects the layout of the floor.
          16 Sep 2026 (owner): a soft warm orange, the reply icon in the header AND on Grant,
          opens above its button, and sits BELOW every dialog (Settings, Motions, Documents,
          Chat, Scoreboard...) without moving. */}
      {!isViewOnly && openPopovers.rightToReply && (
        <DraggablePopover
          id="right-of-reply"
          slot="lower"
          anchor="rtr"
          accent={POPOVER_TONES.reply.accent}
          tone={POPOVER_TONES.reply}
          className="w-72"
          handleLabel={t('popover_drag_handle')}
          closeLabel={t('popover_close')}
          onClose={() => {
            setPopover('rightToReply', false);
            setRtrOpen(false);
            setRtrTimerActive(false);
            setRtrCountry('');
            setRtrTimeRemaining(rtrSeconds);
          }}
          title={
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide">
              <MessageSquareReply size={16} strokeWidth={2.6} aria-hidden className="shrink-0" />
              {t('gsl_right_to_reply_popover')}
            </span>
          }
        >
            {!rtrOpen ? (
              // ── Setup view ────────────────────────────────────
              <>
                <RtrCountryInput
                  committee={committee}
                  value={rtrCountry}
                  onChange={(v) => setRtrCountry(v)}
                />
                <div className="flex gap-2 mt-2 mb-2">
                  {[15, 30, 60].map((s) => (
                    <button
                      key={s}
                      onClick={() => setRtrSeconds(s)}
                      aria-pressed={rtrSeconds === s}
                      style={rtrSeconds === s
                        ? { backgroundColor: POPOVER_TONES.reply.chipOn, color: POPOVER_TONES.reply.headerFg }
                        : { backgroundColor: POPOVER_TONES.reply.chip, color: POPOVER_TONES.reply.ink }}
                      className="gv-lift flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wide tabular-nums transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#AD4F18]"
                    >
                      {s}s
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (!rtrCountry) return;
                    logEvent(committee.id, { country: rtrCountry, type: 'right-of-reply', sourceId: 'rightOfReply' }, committee.code, committee.dbChairJoinSuffix ?? undefined);
                    setRtrTimeRemaining(rtrSeconds);
                    setRtrTimerActive(false);
                    setRtrOpen(true);
                  }}
                  disabled={!rtrCountry}
                  style={{ backgroundColor: POPOVER_TONES.reply.btn, color: POPOVER_TONES.reply.btnFg }}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs rounded-lg font-black uppercase tracking-wide transition-transform gv-lift hover:brightness-95 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#AD4F18] focus-visible:ring-offset-2"
                >
                  <MessageSquareReply size={15} strokeWidth={2.6} aria-hidden className="shrink-0" />
                  {t('gsl_grant')}
                </button>
              </>
            ) : (
              // ── Active timer view ──────────────────────────────
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <SeatFlag country={rtrCountry} size={24} className="object-contain inline-block" fallback={<UnknownSeatIcon size={24} />} />
                  <span className="text-sm font-bold flex-1" style={{ color: POPOVER_TONES.reply.ink }}>{getCountryDisplayName(rtrCountry, language)}</span>
                </div>
                <div className={`text-5xl font-black font-mono text-center mb-3 tabular-nums ${
                  rtrTimeRemaining <= 5 ? 'text-[#8B2020]' : rtrTimeRemaining <= 10 ? 'text-[#964313]' : 'text-[#5A2A08]'
                }`}>
                  {Math.floor(rtrTimeRemaining / 60)}:{String(rtrTimeRemaining % 60).padStart(2, '0')}
                </div>
                <div className="w-full h-1.5 bg-[#F7CFA2] rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${rtrTimeRemaining / rtrSeconds > 0.5 ? 'bg-[#AD4F18]' : rtrTimeRemaining / rtrSeconds > 0.2 ? 'bg-[#B6871F]' : 'bg-[#B84A3A]'}`}
                    style={{ width: `${(rtrTimeRemaining / rtrSeconds) * 100}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRtrTimerActive((r) => !r)}
                    className={`gv-lift flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                      rtrTimerActive ? 'bg-[#F2C230] hover:bg-[#E5B21C] text-[#1C1410]' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
                    }`}
                  >
                    {rtrTimerActive ? t('rtr_pause') : t('rtr_start')}
                  </button>
                  <button
                    onClick={() => {
                      setRtrTimerActive(false);
                      setRtrOpen(false);
                      setRtrCountry('');
                      setRtrTimeRemaining(rtrSeconds);
                      setPopover('rightToReply', false);
                    }}
                    style={{ backgroundColor: POPOVER_TONES.reply.chip, color: POPOVER_TONES.reply.ink }}
                    className="px-3 py-2 rounded-lg font-bold text-xs transition-transform gv-lift hover:brightness-95 active:scale-[0.97]"
                  >
                    {t('rtr_done')}
                  </button>
                </div>
              </>
            )}
        </DraggablePopover>
      )}
      </div>
    </div>
    </SeatArtProvider>
    </FitToScreen>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<GavelLoader />}>
      <ChairSessionInner params={params} />
    </Suspense>
  );
}
