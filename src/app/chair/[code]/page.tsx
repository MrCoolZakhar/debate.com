'use client';
import { use, useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import FitToScreen from '@/components/FitToScreen';
import SessionsHeaderLogo from '@/components/SessionsHeaderLogo';
import GavelChip from '@/components/GavelChip';
import CommitteeIdentityBadge from '@/components/CommitteeIdentityBadge';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CaucusState, Committee, Delegate, DelegateStatus } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import DocumentsModal from '@/components/DocumentsModal';
import { getFlagUrl, getCountryByName, getCountryDisplayName, UN_COUNTRIES, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { getCommitteeDisplayName, committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Emoji } from '@/components/Emoji';
import { SettingsPanel } from '@/components/SettingsPanel';
import ScoreboardPanel from '@/components/ScoreboardPanel';
import FeedbackLogPanel, { liveCaucus } from '@/components/FeedbackLogPanel';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import { useSettingsStore, type CommitteeSettings } from '@/lib/settingsStore';
import { useAuth } from '@/components/AuthProvider';
import { detectConferenceSession, verifyConferenceAccess } from '@/lib/conferenceAccess';
import { resolveChairAwardsHref } from '@/lib/sessionAwardsLink';
import { supabase } from '@/lib/supabase';
import ChatPanel from '@/components/ChatPanel';
import ChatDisabledNotice from '@/components/ChatDisabledNotice';
import { getCommitteeFlags } from '@/lib/committeeFlags';
import { chatUnreadTotal, mergeMessagesById } from '@/lib/chatConversations';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import SidebarResizer from '@/components/SidebarResizer';
import { SIDEBAR_DEFAULT_WIDTH, loadSidebarWidth, saveSidebarWidth } from '@/lib/sidebarWidth';
import { catchUpMessages, useChatCatchUp, useReSubscribeCatchUp } from '@/lib/useChatCatchUp';
import TutorialOverlay from '@/components/TutorialOverlay';
import NotificationStack, { type NotificationExtra } from '@/components/notifications/NotificationStack';
import {
  notify,
  dismiss as dismissNotification,
  setNotificationsSuppressed,
  notifyKey,
  NOTIFY_TTL,
} from '@/lib/sessionNotifications';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  getCurrentSpeakerRow,
  logEvent,
  setPhase as setPhaseInDB,
  setDelegateStatus as setDelegateStatusInDB,
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
  clearCurrentSpeakerIfUnchanged,
  caucusRemainingNow,
  speakerRemainingNow,
  anchorCaucusClock,
  approveJoinRequest,
  denyJoinRequest,
  approveGslRequest,
  denyGslRequest,
  logSpeakingTime,
  resumeSession as resumeSessionInDB,
  claimResumeSession as claimResumeSessionInDB,
  startResumeRollCall as startResumeRollCallInDB,
  releaseResumeClaim as releaseResumeClaimInDB,
  takeOverResumeClaim as takeOverResumeClaimInDB,
  removePendingMotion as removePendingMotionInDB,
  updateSpeakerTimeLimit,
  updateCommitteeHeadChairInDB,
  getActiveBroadcasts,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
  type SessionBroadcast,
} from '@/lib/committeeService';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
      <p className="text-[#9A8A78] text-sm font-mono tracking-widest">LOADING…</p>
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

const localUpdateTime = { current: 0 };

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

function updateLocal(setCommittee: CommitteeSetter, updater: (c: Committee) => Committee, structural = false) {
  if (structural) localUpdateTime.current = Date.now();
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
function AddSpeakerInput({ committee, onAdd }: { committee: Committee; onAdd: (id: string) => void }) {
  const { language } = useLanguage();
  const t = useT();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set([
    ...committee.speakersList.map((s) => s.delegateId),
    ...(committee.currentSpeaker ? [committee.currentSpeaker.delegateId] : []),
  ]);
  const eligible = committee.delegates.filter(
    (d) => d.status !== 'absent' && d.id !== committee.currentSpeaker?.delegateId
  );
  const q = resolveQuery(query).toLowerCase();
  const matches = q
    ? eligible.filter((d) => startsWithCountryQuery(d.country, q, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, q, language) && matchesCountryQuery(d.country, q, language)))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id)) return; onAdd(d.id); setQuery(''); };
  return (
    <div className="relative" data-tutorial="speakers-input">
      <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder={t('gsl_add_to_list')} autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {getCountryDisplayName(topNotOnList.country, language)}</span>}
      </div>
      {query && matches.length > 0 && (
        <div data-tutorial="speakers-autocomplete" className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
                  <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                  <span className="text-sm flex-1 text-[#9A8A78]">{getCountryDisplayName(d.country, language)}</span>
                  <span className="text-xs text-[#9A8A78]">already on list</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                <span className="text-sm">{getCountryDisplayName(d.country, language)}</span>
                {isFirst && <span className="ms-auto text-xs text-[#9A8A78]">Enter ↵</span>}
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
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const q = resolveQuery(query).toLowerCase();
  const matches = q
    ? eligible.filter((d) => startsWithCountryQuery(d.country, q, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, q, language) && matchesCountryQuery(d.country, q, language)))
    : [];
  const topMatch = matches[0] ?? null;

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
      {query && matches.length > 0 && !value && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10">
          {matches.slice(0, 5).map((d, i) => {
            const found = getCountryByName(d.country);
            return (
              <button
                key={d.id}
                onMouseDown={(e) => { e.preventDefault(); setQuery(d.country); onChange(d.country); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-start text-xs transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}
              >
                <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
                {found
                  ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-4 h-4 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <Emoji size="0.875rem">🌐</Emoji>}
              </span>
                <span className="flex-1">{getCountryDisplayName(d.country, language)}</span>
                {i === 0 && <span className="text-[#9A8A78] shrink-0">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Flags that are square (non-rectangular) — no border/shadow
const SQUARE_FLAGS = new Set(['CH', 'NP']);

// ── Draggable GSL Speakers Queue ──────────────────────────────────────────────
function DraggableSpeakersQueue({ list, onReorder, onRemove, lastSpeakerDelegateId, currentSpeakerDelegateId, isRoomOrderTdT }: {
  list: { delegateId: string; country: string }[];
  onReorder?: (newList: { delegateId: string; country: string }[]) => void;
  onRemove?: (delegateId: string) => void;
  lastSpeakerDelegateId?: string | null;
  currentSpeakerDelegateId?: string | null;
  isRoomOrderTdT?: boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  const dragIndexRef = useRef<number | null>(null);
  const qLen = list.length;
  const displayItems = list.slice(0, 7);
  const overflow = qLen > 7 ? qLen - 7 : 0;
  return (
    <div className="flex flex-col items-center w-full mb-1 shrink-0 pt-2" data-tutorial="speakers-queue">
      <div className="flex flex-nowrap items-start gap-2 justify-center min-w-0 px-1">
        {displayItems.map((s, i) => {
          const isCurrent = currentSpeakerDelegateId && s.delegateId === currentSpeakerDelegateId;
          const flagCountry = getCountryByName(s.country);
          return (
            <div key={`${s.delegateId}-${i}`} className="flex flex-col items-center gap-1 relative group cursor-grab shrink-0"
              draggable={!isCurrent && !!onReorder}
              onDragStart={() => { if (!isCurrent && onReorder) dragIndexRef.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragIndexRef.current;
                if (from === null || from === i || !onReorder) return;
                const newList = [...list];
                const [moved] = newList.splice(from, 1);
                newList.splice(i, 0, moved);
                onReorder(newList);
                dragIndexRef.current = null;
              }}>
              {isRoomOrderTdT ? (
                <div className={`w-14 h-14 rounded-full bg-[#DDD4C0] border border-[#C8BAA8] flex items-center justify-center ${isCurrent ? 'ring-4 ring-[#1B3828]' : ''}`}>
                  <span className="text-2xl font-black" style={{ color: '#1B3828' }}>{i + 2}</span>
                </div>
              ) : (
                <div style={{ width: '60px', height: '45px', borderRadius: '8px', position: 'relative', boxShadow: flagCountry && SQUARE_FLAGS.has(flagCountry.code) ? 'none' : '0 0 0 1.5px rgba(28,20,16,0.20)', backgroundColor: '#F0EBE1', flexShrink: 0 }}>
                  {flagCountry ? <img src={getFlagUrl(flagCountry.code)} alt={s.country} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.5rem" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌐</Emoji>}
                </div>
              )}
              {!isRoomOrderTdT && (
                <span className="line-clamp-2 break-words whitespace-normal leading-tight max-w-[64px] text-xs font-semibold text-center" style={{ color: '#1C1410' }}>{abbrevCountry(getCountryDisplayName(s.country, language))}</span>
              )}
              {isCurrent && <span className="text-sm font-semibold" style={{ color: '#B8844A' }}>{t('gsl_speaking')}</span>}
              {!isCurrent && i === 0 && <span className="text-xs font-semibold" style={{ color: '#B8844A' }}>{t('gsl_up_next')}</span>}
              {!isCurrent && lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && i !== 0 && (
                <span className="text-xs font-bold text-[#9A8A78] bg-[#DDD4C0] px-1.5 py-0.5 rounded">{t('gsl_last')}</span>
              )}
              {!isCurrent && onRemove && (
                <button onClick={() => onRemove(s.delegateId)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-[#EDE7D8] border border-[#DDD4C0] rounded-full text-[#1C1410] text-[10px] font-black hidden group-hover:flex items-center justify-center shadow-sm">✕</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center h-10 flex items-start justify-center pt-1">
        {overflow > 0 && (
          <span className="text-xs font-medium" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>{t('gsl_more_in_queue').replace('{n}', String(overflow))}</span>
        )}
      </div>
    </div>
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
            const found = getCountryByName(s.country);
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
                {found
                  ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <Emoji size="1.125rem">🌐</Emoji>}
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

// ── Caucus Add Speaker Input ──────────────────────────────────────────────────
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd, onAddFirst, onAddLast, maxSpeakers, currentQueueLength, currentSpeakerCountry, onEndCaucus }: {
  committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void;
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
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const isFull = maxSpeakers !== undefined && currentQueueLength !== undefined && currentQueueLength >= maxSpeakers;
  const cq = resolveQuery(query).toLowerCase();
  const matches = cq
    ? eligible.filter((d) => startsWithCountryQuery(d.country, cq, language))
        .concat(eligible.filter((d) => !startsWithCountryQuery(d.country, cq, language) && matchesCountryQuery(d.country, cq, language)))
    : [];
  const isCurrentSpeaker = (d: { country: string }) => !!currentSpeakerCountry && d.country === currentSpeakerCountry;
  const topNotOnList = matches.find((d) => !onList.has(d.id) && !isCurrentSpeaker(d)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id) || isFull || isCurrentSpeaker(d)) return; onAdd(d.id); setQuery(''); };
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
      {isFull ? (
        <div className="pointer-events-none flex items-center justify-center px-4 py-3 bg-[#FAF8F3] border border-[#B6871F]/30 rounded-xl">
          <p className="text-sm text-amber-400 font-semibold text-center">
            Queue full: {maxSpeakers} speaker{maxSpeakers !== 1 ? 's' : ''} fit in remaining time
          </p>
        </div>
      ) : (
      <>
      <div className="flex items-center bg-[#FAF8F3] border rounded-xl transition-colors border-[#DDD4C0] focus-within:border-[#1B3828]">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder={t('gsl_add_to_list')}
          className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {getCountryDisplayName(topNotOnList.country, language)}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            const spoke = spokenCountries.includes(d.country);
            const isCurrent = isCurrentSpeaker(d);
            if (isCurrent || alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
                  <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                  <span className="text-sm flex-1 text-[#9A8A78]">{getCountryDisplayName(d.country, language)}</span>
                  <span className="text-xs text-[#9A8A78]">{isCurrent ? 'currently speaking' : 'already on list'}</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                <span className="text-sm flex-1">{getCountryDisplayName(d.country, language)}</span>
                {spoke && <span className="text-[10px] text-[#B6871F] shrink-0">already spoke</span>}
                {isFirst && !spoke && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onAddFirst && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddFirst(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors gv-lift">
                        ↑ First
                      </button>
                    )}
                    {onAddLast && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddLast(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors gv-lift">
                        ↓ Last
                      </button>
                    )}
                    <span className="text-xs text-[#9A8A78]">Enter ↵</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      </>
      )}
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
function UnmoderatedCaucusView({ committee, setCommittee, isViewOnly = false }: { committee: Committee; setCommittee: CommitteeSetter; isViewOnly?: boolean }) {
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
  const remainingRef = useRef(liveTotal);
  remainingRef.current = liveTotal;
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

  // CoW open-floor speaker tracking — set who holds the floor by tapping a flag.
  const cowSpeakerStartRef = useRef<number>(Date.now());
  const handleCowTap = (countryName: string) => {
    const prev = caucus.currentSpeaker;
    if (prev === countryName) return;
    const now = Date.now();
    if (prev) {
      const secs = Math.max(0, Math.round((now - cowSpeakerStartRef.current) / 1000));
      if (secs > 0) logEvent(committee.id, { country: prev, type: 'speech', context: 'unmoderated-caucus', topic: caucus.purpose ?? committee.topic, seconds: secs }, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
    cowSpeakerStartRef.current = now;
    const spoken = prev && !(caucus.spokenCountries ?? []).includes(prev)
      ? [...(caucus.spokenCountries ?? []), prev]
      : (caucus.spokenCountries ?? []);
    const updated = { ...caucus, currentSpeaker: countryName, spokenCountries: spoken };
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
    const anchored = anchorCaucusClock(committee.caucus, remainingRef.current, nowRunning);
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), false);
    updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  // Extending RE-ANCHORS: the added seconds go onto the live remaining, and the anchor is
  // restamped to now so the elapsed time already burnt is not charged twice.
  const handleExtendUnmod = (addSecs: number) => {
    if (addSecs <= 0 || !committee.caucus) return;
    // remainingRef is the LIVE derived value, so the elapsed time is already subtracted —
    // never use committee.caucus.remainingTime here, which is the value at the anchor and
    // would hand back every second the caucus had already burnt.
    const extended = { ...committee.caucus, totalTime: committee.caucus.totalTime + addSecs };
    const anchored = anchorCaucusClock(extended, remainingRef.current + addSecs, running);
    updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), true);
    updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setShowExtendUnmod(false);
  };

  const handleEndCaucus = () => {
    setRunning(false);
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
    setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
    updateCaucusInDB(committee.id, null, committee.code, committee.dbChairJoinSuffix ?? undefined);
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
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${liveTotal <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>
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
                aria-label="Set custom time"
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
  activePopover, setActivePopover, extraTimeAdded,
  handleToggleTimer, handleRestartTime, handleNextCaucusSpeaker, handleEndCaucus,
  sessionEnded, isViewOnly = false,
}: {
  committee: Committee; setCommittee: CommitteeSetter;
  /** Live seconds on the TOTAL caucus clock, derived from the anchor by the page. */
  caucusSeconds: number;
  speakerTimeRemaining: number; timerRunning: boolean;
  activePopover: 'extraTime' | 'rightToReply' | null;
  setActivePopover: (v: 'extraTime' | 'rightToReply' | null) => void;
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

  const speakTime2 = speakerTime > 0 ? speakerTime : 1;
  const maxByTime = Math.floor(liveRemaining / speakTime2);
  const totalProgress = caucus.totalTime > 0 ? (liveRemaining / caucus.totalTime) * 100 : 0;
  const caucusProgress = speakerTime > 0 ? (speakerTimeRemaining / speakerTime) * 100 : 0;

  const handleCaucusAddToQueue = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (committee.caucus?.currentSpeaker === delegate.country) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const nextPosition = queue.length + 1;
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, nextPosition);
  };

  const handleCaucusAddFirst = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const newList = [{ delegateId, country: delegate.country }, ...queue];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 0);
    reorderSpeakersListInDB(committee.id, newList, committee.code, committee.dbChairJoinSuffix ?? undefined, 'caucus');
  };

  const handleCaucusAddLast = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const nextPosition = queue.length + 1;
    const newList = [...queue, { delegateId, country: delegate.country }];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, nextPosition);
  };

  const handleCaucusRemoveFromQueue = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
    removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  const handleCaucusReorderQueue = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, committee.code, committee.dbChairJoinSuffix ?? undefined, 'caucus');
  };

  return (
    <>
      {committee.caucus?.currentSpeaker ? (
        <>
          {/* ZONE 1 — Queue locked at top */}
          {queue.length > 0 && (
            <div className="shrink-0">
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
                isRoomOrderTdT={isRoomOrderTdT}
              />
            </div>
          )}
          {/* ZONE 2 — Flag + name + timer + progress: compresses as viewport shrinks */}
          <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 max-w-[160px] ps-4 pointer-events-none select-none">
              <span className="text-[#1C1410] font-black text-lg leading-tight uppercase">
                {committee.caucus?.motionLabel ?? caucusTitle}
              </span>
              {committee.caucus?.purpose && (
                <span className="text-[#1C1410]/70 text-sm font-medium leading-snug">
                  {committee.caucus.purpose.replace(/^Tour de Table\s*[\(\-]?\s*/i, '').replace(/^\(/, '').replace(/\)$/, '') || committee.caucus.purpose}
                </span>
              )}
              {spokenCountries.length > 0 && (
                <span className="text-sm font-medium leading-snug" style={{ color: '#1C1410' }}>
                  {spokenCountries.length} delegate{spokenCountries.length !== 1 ? 's' : ''} spoke
                </span>
              )}
            </div>
            {isRoomOrderTdT ? (
              <div className="relative w-36 h-36 rounded-full bg-[#DDD4C0] shrink-0 flex items-center justify-center">
                <span className="text-6xl font-black" style={{ color: '#1B3828' }}>{(() => {
                  const match = committee.caucus!.currentSpeaker?.match(/(\d+)$/);
                  return match ? match[1] : '1';
                })()}</span>
              </div>
            ) : (
              <div style={{ width: '165px', height: '110px', borderRadius: '12px', boxShadow: '0 0 0 2.5px rgba(28,20,16,0.22)', flexShrink: 0, position: 'relative' }}>
                {(() => {
                  const f = getCountryByName(committee.caucus!.currentSpeaker!);
                  return f
                    ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="5rem" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌐</Emoji>;
                })()}
              </div>
            )}
            <h1 className="font-black text-[#1C1410] text-center" style={{ fontSize: '1.8rem', margin: '8px 0' }}>{getCountryDisplayName(committee.caucus!.currentSpeaker!, language)}</h1>
            <div className={`font-black font-mono tabular-nums ${speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'}`} style={{ fontSize: '5rem', margin: '8px 0' }}>
              {formatTime(speakerTimeRemaining)}
              {extraTimeAdded && <span className="text-base ms-2 font-normal text-[#1C1410]">{t('gsl_plus_time')}</span>}
            </div>
            <div className="w-full max-w-2xl h-2 bg-[#DDD4C0] rounded-full overflow-hidden" style={{ marginBottom: '6px' }}>
              <div className={`h-full rounded-full transition-all ${caucusProgress > 50 ? 'bg-[#B6871F]' : caucusProgress > 20 ? 'bg-[#B6871F]' : 'bg-red-500'}`} style={{ width: `${caucusProgress}%` }} />
            </div>
          </div>
          {/* ZONE 3 — Action buttons locked just above bottom bar */}
          {!sessionEnded && !isViewOnly && (
            <div className="shrink-0 flex gap-2 w-full max-w-sm flex-wrap justify-center px-4 pb-3 mx-auto">
              <button onClick={handleRestartTime} title="Restart speaker time"
                className="px-3 py-3 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#C8BAA8] hover:border-[#1B3828] rounded-xl font-bold text-sm text-[#6A5A4A] transition-colors gv-lift">
                ↺
              </button>
              <button onClick={handleToggleTimer}
                className={`gv-lift flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none ${timerRunning ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}>
                {timerRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="flex gap-[3px] items-center">
                      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
                      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
                    </span>
                    <span>{t('gsl_pause')}</span>
                  </span>
                ) : t('gsl_start')}
              </button>
              <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] disabled:opacity-40 text-[#1C1410] py-3 px-4 rounded-xl font-bold transition-colors focus:outline-none whitespace-nowrap gv-lift" style={{ fontSize: '14px' }}>
                {t('gsl_next')}
              </button>
              <button onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')} title="Add time"
                className="px-2 py-2 border rounded-xl font-black uppercase tracking-wide transition-colors bg-[#EDE7D8] hover:bg-[#DDD4C0] border-[#DDD4C0] text-[#1B3828] leading-tight text-center gv-lift" style={{ fontSize: '8px', minWidth: '52px' }}>
                {t('gsl_add_time').split('\n')[0]}<br />{t('gsl_add_time').split('\n')[1]}
              </button>
              {!isTdT && (
                <button onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                  className="px-3 py-3 border rounded-xl font-black text-xs uppercase tracking-wide transition-colors bg-[#B8844A]/15 hover:bg-[#B8844A]/25 border-[#B8844A]/30 text-[#B8844A] gv-lift">
                  {t('gsl_right_to_reply')}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* No-speaker branch */
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-3 overflow-hidden">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 max-w-[160px] ps-4 pointer-events-none select-none">
            <span className="text-[#1C1410] font-black text-lg leading-tight uppercase">
              {committee.caucus?.motionLabel ?? caucusTitle}
            </span>
            {committee.caucus?.purpose && (
              <span className="text-[#1C1410]/70 text-sm font-medium leading-snug">
                {committee.caucus.purpose.replace(/^Tour de Table\s*[\(\-]?\s*/i, '').replace(/^\(/, '').replace(/\)$/, '') || committee.caucus.purpose}
              </span>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
            {queue.length > 0 && (
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
                isRoomOrderTdT={isRoomOrderTdT}
              />
            )}
            <h2 className="text-5xl font-black mb-3 text-center" style={{ color: '#1B3828' }}>{t('gsl_no_current_speaker')}</h2>
            {/* A Commenter cannot call a speaker, so neither the instruction nor the
                (previously disabled-looking but still rendered) button belong on their screen. */}
            {!isViewOnly && <p className="mb-4 text-center text-sm" style={{ color: '#9A8A78' }}>{t('gsl_add_call_first')}</p>}
            {!sessionEnded && !isViewOnly && (
              <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white px-8 py-3 rounded-xl font-bold transition-colors focus:outline-none gv-lift">
                {t('gsl_call_first')}
              </button>
            )}
          </div>
        </div>
      )}

      {!sessionEnded && (
        <div className="border-t border-[#DDD4C0] px-6 py-2" style={{ backgroundColor: '#F6F1E9' }}>
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
          />}
        </div>
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
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied' | 'signin'>('checking');
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);

  // Conference-session access guard (Phase 2 #8). Standalone sessions stay anonymous
  // ('allowed'); a conference session requires a signed-in user who is a chair of THIS
  // committee, so a crafted /chair/CODE url can't drop a non-chair into the chair view.
  useEffect(() => {
    let cancelled = false;
    async function guard() {
      if (authLoading) return;
      const isConf = await detectConferenceSession(code);
      if (cancelled) return;
      if (!isConf) { setAccessState('allowed'); return; }
      if (!session || !user) { setAccessState('signin'); return; }
      const access = await verifyConferenceAccess(code, session.access_token, user.id);
      if (cancelled) return;
      setAccessState(access.kind === 'chair' || access.kind === 'organizer' ? 'allowed' : 'denied');
    }
    setAccessState('checking');
    guard();
    return () => { cancelled = true; };
  }, [code, authLoading, session?.access_token, user?.id]);

  // Committee emblem for the sidebar. The sessions `committees` table has no logo column,
  // so the artwork is resolved in this order:
  //   1. conference_committees.logo_url — a CONFERENCE-created session, where the organiser
  //      uploaded custom artwork for this committee. Matched by session_code and readable to
  //      anyone associated with it.
  //   2. matchPresetEmblem(name) — the committee's OWN emblem, derived from the name the
  //      chair typed. This is what makes a standalone "UN Security Council" session wear the
  //      real UN mark; before this the fetch below was the only source, so every standalone
  //      session fell through to a monogram no matter what it was called.
  //   3. null → the monogram fallback, so there is never a broken image or an empty gap.
  const [committeeEmblem, setCommitteeEmblem] = useState<{ logoUrl: string | null; abbreviation: string | null }>({ logoUrl: null, abbreviation: null });
  useEffect(() => {
    let cancelled = false;
    const token = session?.access_token;
    if (!token) { setCommitteeEmblem({ logoUrl: null, abbreviation: null }); return; }
    (async () => {
      try {
        const sb = getAuthedClient(token);
        const { data } = await sb
          .from('conference_committees')
          .select('logo_url, abbreviation')
          .eq('session_code', code.toUpperCase())
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as { logo_url: string | null; abbreviation: string | null };
        setCommitteeEmblem({ logoUrl: row.logo_url ?? null, abbreviation: row.abbreviation ?? null });
      } catch { /* standalone session, or no read access — monogram fallback */ }
    })();
    return () => { cancelled = true; };
  }, [code, session?.access_token]);
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
   * itself does not even come through here — SidebarResizer paints
   * `sidebarRef.current.style.width` per frame and commits once on release.
   */
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [showSliders, setShowSliders] = useState(false);
  const [gslListView, setGslListView] = useState<'az' | 'queue'>('az');
  const [showMotions, setShowMotions] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const [activePopover, setActivePopover] = useState<'extraTime' | 'rightToReply' | null>(null);
  const [extraTimeSecs, setExtraTimeSecs] = useState('');
  const [extraTimeAdded, setExtraTimeAdded] = useState(false);
  const [caucusMaxReachedMsg, setCaucusMaxReachedMsg] = useState(false);
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
  }, []);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [headChairName, setHeadChairName] = useState<string | null>(null);
  // Gavel chip: live presence dots + the transient handover toast.
  const [onlineChairs, setOnlineChairs] = useState<Set<string>>(new Set());
  const [headOffline, setHeadOffline] = useState(false);
  const [gavelToast, setGavelToast] = useState<{ tone: 'lost' | 'gained'; text: string } | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRunningRef = useRef(false);
  const isViewOnlyRef = useRef(false);
  // Serialises concurrent getCommitteeByCode results inside the realtime subscription.
  // Two rapid writes produce two echoes and two in-flight refetches; without this an OLDER
  // snapshot resolving last would overwrite the newer one with stale rows. Each fetch takes
  // a ticket and only applies if it is still the newest.
  const fetchSeq = useRef(0);
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

  // Realtime does not replay events missed while the socket was down. The chair's outbox now
  // outlives chat closing, so it needs the same catch-up as the delegate view.
  const onRealtimeStatus = useReSubscribeCatchUp(setCommittee);
  useChatCatchUp(committee?.id, setCommittee);

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} - Gavelling Session`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code);
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
          const { chairJoinSuffix: _cjs, separateChairCode: _scc, headChair: _hc, ...rest } = found.dbSettings as Record<string, unknown>;
          void _cjs; void _scc; void _hc;
          hydrateSettings(found.code, rest as Partial<CommitteeSettings>);
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
      if (found) {
        // A chair who joins late, or reloads mid-session, still gets any live organiser
        // broadcast — realtime only ever delivers what arrives AFTER the socket opens.
        // Fire-and-forget: nothing about the session waits on an announcement.
        getActiveBroadcasts(found.id).then(setBroadcasts);
        unsubscribe = subscribeToCommittee(found.id, async (table) => {
          // Broadcasts first, and outside the debounce entirely. They are organiser-owned:
          // this device never writes the table, so there is no optimistic state to protect,
          // and swallowing one because the chair happened to press Next three seconds ago
          // would drop the message that pauses the committee.
          if (table === 'session_broadcasts') {
            setBroadcasts(await getActiveBroadcasts(found.id));
            return;
          }

          // Chair notes + factor ratings, also outside the debounce. This device may well
          // have written the row, but `feedback` is not optimistic speaker/timer/caucus
          // state, so RULE 4 does not apply and swallowing the echo would only make a
          // second chair's note invisible until a remount. We bump a counter rather than
          // refetch here: the two readers (the comment dock and the scoreboard) each own
          // their own query and neither is always mounted, so a fetch here would usually
          // be thrown away.
          if (table === 'feedback') {
            setFeedbackVersion((v) => v + 1);
            return;
          }

          // The Moderator owns current_speaker (writes it on start/pause/next) — it must
          // ignore its own echoes. But co-chairs (view-only) don't own it, so they DO need
          // these events to show the current speaker promptly. Patch with a lightweight
          // single-row fetch instead of the full committee refetch.
          if (table === 'current_speaker') {
            if (!isViewOnlyRef.current) return;
            // Two rapid Next clicks by the Moderator race two of these fetches on this
            // device; ticket them so an older row can never land last (same seq as the
            // committee refetches — any newer fetch supersedes this one).
            const seq = ++fetchSeq.current;
            const cs = await getCurrentSpeakerRow(found.id);
            if (seq !== fetchSeq.current) return;
            if (!cs) return;
            setCommittee((prev) => {
              if (!prev) return prev;
              const patched: Committee = {
                ...prev,
                currentSpeaker: cs.currentSpeaker,
                speakerStartedAt: cs.speakerStartedAt,
                // Drop the new speaker from the local GSL list to avoid a transient duplicate
                // before the speakers_list delete event arrives.
                speakersList: cs.currentSpeaker
                  ? prev.speakersList.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
                  : prev.speakersList,
              };
              // In a moderated caucus (incl. Tour de Table) the visible speaker comes from
              // caucus.currentSpeaker (a country string), advanced via the same nextSpeaker
              // write. Patch it here too so the caucus view updates on this lightweight event
              // instead of waiting for the heavier committees refetch.
              if (prev.caucus && prev.caucus.type === 'moderated') {
                patched.caucus = { ...prev.caucus, currentSpeaker: cs.currentSpeaker?.country ?? null };
                patched.caucusQueue = cs.currentSpeaker
                  ? prev.caucusQueue.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
                  : prev.caucusQueue;
              }
              return patched;
            });
            // Anchor base is the row's own time_remaining, NOT the committee speaker limit:
            // a moderated-caucus speaker is seated with the CAUCUS speaking time, and a
            // paused-then-resumed speaker carries their true remainder (H5).
            seatSpeakerClock(cs.speakerTimeRemaining, cs.speakerStartedAt);
            return;
          }

          // Chat + speech-log rows are append-only and belong to no optimistic state. Patch
          // them with one scoped query instead of the 8-query getCommitteeByCode, and merge by
          // id so two unsequenced refetches can only ADD rows, never drop one.
          if (table === 'messages') {
            await catchUpMessages(found.id, setCommittee);
            return;
          }

          // The debounce protects the ACTING chair's optimistic state from its own realtime
          // echo. A Commenter owns no session state and writes none, so it must never
          // debounce: doing so silently drops phase/caucus changes it can only learn remotely
          // (e.g. the Moderator ending a caucus), leaving the Commenter — and the feedback dock
          // it renders — stuck on a caucus the committee has already left.
          const withinDebounce = !isViewOnlyRef.current && Date.now() - localUpdateTime.current < 3000;

          // Within debounce: speakers_list is skipped outright — the chair just wrote it and
          // its optimistic state is truth (RULE 4). `delegates` is NOT skipped: delegates and
          // Commenters write that table too (roster membership and status), and it feeds the
          // present count, the quorum gate and the majority pie — dropping those events leaves
          // this device with a silently wrong count and no way back from its own traffic.
          // Instead the refetch is ticketed (an older snapshot resolving last is discarded) and
          // every row this chair has just written stays pinned to the optimistic value until DB
          // truth confirms it — otherwise a snapshot predating the write repaints the roll-call
          // slider with the pre-click status.
          // Anything else here is a motion/session/document event another actor may have written.
          if (withinDebounce) {
            if (table === 'speakers_list') return;
            if (table === 'delegates') {
              const seq = ++fetchSeq.current;
              const updated = await getCommitteeByCode(code);
              if (!updated || seq !== fetchSeq.current) return;   // a newer refetch already applied
              setCommittee((prev) => prev ? { ...prev, delegates: applyPinnedStatuses(updated.delegates) } : prev);
              return;
            }
            const seq = ++fetchSeq.current;
            const updated = await getCommitteeByCode(code);
            if (!updated || seq !== fetchSeq.current) return;   // a newer refetch already applied
            setCommittee((prev) => {
              if (!prev) return prev;
              // messages (speech log + chat) are append-only and NOT part of the optimistic
              // speaker/timer/caucus state, so refresh them even inside the debounce — otherwise
              // the acting chair's own just-logged speech is missing from scoring/scoreboard/stats.
              // The gavel arrives as exactly ONE `committees` event and is never re-delivered.
              // Dropping it inside the debounce meant that if the acting chair had made any
              // structural write in the preceding 3s, the handover was silently discarded and
              // this device kept acting as Moderator forever. Neither field is optimistic
              // speaker/timer/caucus state, so merging them does not weaken RULE 4.
              let next = {
                ...prev,
                pendingMotions: updated.pendingMotions,
                messages: mergeMessagesById(prev.messages, updated.messages),
                dbHeadChair: updated.dbHeadChair,
                chairNames: updated.chairNames,
                // The resume latch is DB-owned, never optimistic speaker/timer/caucus state,
                // so merging it here does not weaken RULE 4. Previously it rode along only
                // when suspendedAt changed, which meant a chair who lost the resume race
                // inside the debounce window never learned who was resuming.
                resumingChair: updated.resumingChair,
              };
              if (updated.endedAt) next = { ...next, endedAt: updated.endedAt, expiresAt: updated.expiresAt };
              if (updated.suspendedAt !== prev.suspendedAt) next = { ...next, suspendedAt: updated.suspendedAt, resumingChair: updated.resumingChair, phase: updated.phase };
              return next;
            });
            if (updated.endedAt) { setSessionEnded(true); setSessionSuspended(false); }
            else if (updated.suspendedAt) { setSessionSuspended(true); }
            else { setSessionSuspended(false); }
            return;
          }

          // Outside debounce: full update — another actor (delegate, Commenter) changed something.
          const seq = ++fetchSeq.current;
          const updated = await getCommitteeByCode(code);
          if (!updated || seq !== fetchSeq.current) return;   // a newer refetch already applied
          if (updated.endedAt) {
            setSessionEnded(true);
          } else if (updated.suspendedAt) {
            setSessionSuspended(true);
          } else {
            setSessionEnded(false);
            setSessionSuspended(false);
          }
          // A foreign event (delegate GSL request, Commenter write) must never disturb the
          // live speaker/timer/caucus state owned by the running chair. Merge non-timer fields
          // and preserve the live ones while the timer is running. A Commenter owns
          // none of this — pinning phase/caucus there would freeze it on a stale caucus — so
          // it always takes the fresh row.
          if (timerRunningRef.current && !isViewOnlyRef.current) {
            setCommittee((prev) => prev ? {
              ...updated,
              currentSpeaker: prev.currentSpeaker,
              speakerStartedAt: prev.speakerStartedAt,
              speakerTimeLimit: prev.speakerTimeLimit,
              speakerTimeRemaining: prev.speakerTimeRemaining,
              caucus: prev.caucus,
              phase: prev.phase,
              messages: mergeMessagesById(prev.messages, updated.messages),
              delegates: applyPinnedStatuses(updated.delegates),
            } : updated);
          } else {
            // The unmoderated countdown no longer needs carrying across a refetch. It used
            // to: the clock lived only in local state, so a fresh row would rewind it, and
            // `caucusClockRunning` pinned the local value to stop that. Now the clock IS the
            // persisted anchor — the fresh row carries it — and pinning would be actively
            // wrong, holding a stale base over a co-chair's extend.
            setCommittee((prev) => prev
              ? { ...updated, messages: mergeMessagesById(prev.messages, updated.messages), delegates: applyPinnedStatuses(updated.delegates) }
              : updated);
            // Sync isolated timer atom only when local timer is not running. Anchor base is
            // current_speaker.time_remaining, not the committee limit — see H5 above.
            seatSpeakerClock(updated.speakerTimeRemaining, updated.speakerStartedAt);
          }
        }, (status) => onRealtimeStatus(found.id, status));
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code, onRealtimeStatus, seatSpeakerClock]);

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
  const [roleFlip, setRoleFlip] = useState<{ lost: boolean; at: number } | null>(null);
  useEffect(() => {
    const head = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
    setHeadChairName(head);
    const next = !!myChairName && !!head && head !== myChairName;
    setIsViewOnly(next);
    if (!committee?.id) return;                       // not loaded yet — no baseline to diff
    const prev = roleRef.current;
    roleRef.current = next;
    if (prev === null || prev === next) return;       // first settle, or nothing changed
    setRoleFlip({ lost: next, at: Date.now() });
  }, [committee?.dbHeadChair, committee?.chairNames, committee?.id, myChairName]);

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
    setActivePopover(null);
    setRtrOpen(false);
    setRtrTimerActive(false);
    setCaucusLoading(false);
    setUnmodLoading(false);
    // Release the debounce immediately — whatever this device wrote is no longer the truth.
    localUpdateTime.current = 0;

    const newHead = committee?.dbHeadChair || committee?.chairNames?.[0] || '';
    setGavelToast({
      tone: lost ? 'lost' : 'gained',
      // Routed through translations: this fires at the exact moment control changes
      // hands, so it is the worst possible place to fall back to English.
      text: lost
        ? t('gavel_toast_lost', { name: newHead || t('gavel_another_chair') })
        : t('gavel_toast_gained'),
    });

    // ONE clean resync, then recompute the timer from current_speaker.started_at exactly
    // the way the initial load path does — so the new chair inherits a live countdown.
    let cancelled = false;
    (async () => {
      const fresh = await getCommitteeByCode(code);
      if (cancelled || !fresh) return;
      // Keep the gavel value we already hold. On the GAINING side it is our optimistic
      // claim, and this fetch can easily outrun the settings write — taking fresh here would
      // bounce the role back and re-fire the whole transition. On the LOSING side prev
      // already carries the incoming value that caused this flip, so it is identical.
      setCommittee((prev) => prev ? { ...fresh, dbHeadChair: prev.dbHeadChair } : fresh);
      setSpeakerTimeLimitLocal(fresh.speakerTimeLimit);
      // Anchor base is current_speaker.time_remaining, not the committee limit — see H5.
      const remaining = speakerRemainingNow(fresh.speakerTimeRemaining, fresh.speakerStartedAt);
      seatSpeakerClock(fresh.speakerTimeRemaining, fresh.speakerStartedAt);
      if (fresh.speakerStartedAt && !lost && remaining > 0) setTimerRunning(true);
    })();
    return () => { cancelled = true; };
  // committee/code are read, not tracked: this must run on the ROLE flip only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFlip]);

  // Handover toast — transient, 6s, same flash pattern as caucusMaxReachedMsg.
  useEffect(() => {
    if (!gavelToast) return;
    const t = setTimeout(() => setGavelToast(null), 6000);
    return () => clearTimeout(t);
  }, [gavelToast]);

  // The ONLY gavel write: settings.headChair, read-merged so chairJoinSuffix survives.
  // Nothing else is touched — not current_speaker, not speakers_list, not caucus, not
  // phase. The session keeps running and delegates see nothing at all. Last writer wins
  // on simultaneous claims; every client converges on the realtime `committees` event.
  const handleSetHeadChair = useCallback((name: string) => {
    if (!committee || !name) return;
    updateLocal(setCommittee, (c) => ({ ...c, dbHeadChair: name }));
    updateCommitteeHeadChairInDB(committee.id, name, committee.code, committee.dbChairJoinSuffix ?? undefined);
  }, [committee?.id, committee?.code, committee?.dbChairJoinSuffix]);

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
        if (next === 0) setTimerRunning(false);
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
    const read = () => caucusRemainingNow(
      caucusAnchoredRemaining === null
        ? null
        : ({ remainingTime: caucusAnchoredRemaining, totalStartedAt: caucusAnchor } as CaucusState),
    );
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
    const headNow = committee?.dbHeadChair || committee?.chairNames?.[0] || myChairName || null;
    const amCommenter = !!myChairName && !!headNow && headNow !== myChairName;
    if (amCommenter || caucusExpiredRef.current) return;
    if (committee?.phase !== 'moderated-caucus' || !committee.caucus) return;
    if (!committee.caucus.totalStartedAt) return;   // paused — a paused clock never expires
    if (caucusRemainingNow(committee.caucus) > 0) return;
    caucusExpiredRef.current = true;
    setTimerRunning(false);
    // This IS a structural write (unlike the tick that used to live here), so it arms the
    // debounce itself: the two separate DB updates below must not flicker back in.
    localUpdateTime.current = Date.now();
    updateLocal(setCommittee, (prev) => {
      if (!prev?.caucus || prev.phase !== 'moderated-caucus') return prev;
      // H4 — clear the current_speaker DB ROW as well as local state. Without this the row
      // still holds the caucus speaker (with started_at set), so the next chair refresh
      // resurrects them as the GSL current speaker — a delegate who was never on the GSL —
      // and the following "Next" logs their speaking time a second time. Conditional and
      // serialised against nextSpeaker(), so it is not the blind clear MUST NEVER HAPPEN
      // #5 forbids.
      if (prev.currentSpeaker) {
        clearCurrentSpeakerIfUnchanged(
          prev.id, prev.currentSpeaker.delegateId, prev.currentSpeaker.country,
          prev.code, prev.dbChairJoinSuffix ?? undefined,
        );
      }
      updateCaucusInDB(prev.id, null, prev.code, prev.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(prev.id, 'speakers-list', prev.code, prev.dbChairJoinSuffix ?? undefined);
      // Auto-expiry must mirror the manual End button: clear the caucus and its speaker but
      // NEVER prepend the current caucus speaker (or a Room-Order "Speaker N" placeholder)
      // into the permanent GSL. The GSL is returned exactly as it was before the caucus.
      return { ...prev, caucus: null, phase: 'speakers-list' as const, caucusQueue: [], currentSpeaker: null, speakersList: prev.speakersList };
    }, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caucusSeconds, committee?.phase, isViewOnly]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [committee?.caucusQueue, committee?.delegates, committee?.phase]
  );

  const caucusMaxSpeakers = useMemo(() => {
    if (!committee?.caucus) return null;
    const speakTime = committee.caucus.speakingTime > 0 ? committee.caucus.speakingTime : 1;
    return Math.floor(committee.caucus.remainingTime / speakTime);
  }, [committee?.caucus?.remainingTime, committee?.caucus?.speakingTime]);

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
    setDelegateStatusInDB(delegateId, status, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (status === 'absent' && committee.phase !== 'pre-session') {
      removeFromSpeakersListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
      removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.phase]);

  const handleDelegateAdd = useCallback(async (country: string) => {
    if (!committee) return;
    const { addDelegate: addDelegateInDB } = await import('@/lib/committeeService');
    const realId = await addDelegateInDB(committee.id, country, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (realId) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        delegates: [...c.delegates, { id: realId, country, status: 'absent' }],
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

  useEffect(() => {
    if (committee?.endedAt) {
      setSessionEnded(true);
      setSessionSuspended(false);
      localStorage.removeItem('gavelling-rejoin');
    } else if (committee?.suspendedAt) {
      setSessionSuspended(true);
      setSessionEnded(false);
    }
  }, [committee?.endedAt, committee?.suspendedAt]);

  useEffect(() => {
    if (sessionSuspended) setSuspendTab('suspend');
  }, [sessionSuspended]);

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
      const ms = new Date(committee!.expiresAt!).getTime() - Date.now();
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
      if (showChat) continue;                          // panel is open over the session
      if (m.sender === '__system__' || m.content.startsWith('__log__:')) continue;
      if (!myChairName || m.sender === myChairName) continue;   // never our own
      // Addressed to this dais: public, to the chairs thread, or a DM to this chair.
      const forMe = !m.isPrivate || m.recipient === 'Chairs' || m.recipient === myChairName;
      if (!forMe) continue;

      const found = getCountryByName(m.sender);
      notify({
        key: notifyKey.chat(m.sender),   // one card per sender — a burst collapses
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
  }, [chatMessages, committee?.id, isViewOnly, showChat, myChairName, language, t]);

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
    if (b.expiresAt && new Date(b.expiresAt).getTime() <= Date.now()) return;
    // AGENTS.md FEATURE: END DEBATE — `ended_at` is permanent and starts the 1h deletion
    // clock. Never re-write it, and never suspend a committee that has already ended.
    if (committee.endedAt) return;
    if (b.action === 'pause' && committee.suspendedAt) return;   // already suspended
    firedBroadcastsRef.current.add(b.id);

    const code = committee.code;
    const suffix = committee.dbChairJoinSuffix ?? undefined;
    // Optimistic first, DB write fire-and-forget (RULE 5) — exactly the shape MotionsModal
    // uses for the same two transitions, so the two paths cannot drift.
    if (b.action === 'pause') {
      updateLocal(setCommittee, (c) => ({ ...c, suspendedAt: new Date().toISOString(), phase: 'adjourned' as const }), true);
      setSessionSuspended(true);
      suspendDebateInDB(committee.id, code, suffix);
    } else {
      const now = new Date();
      // Mirrors endDebate()'s own +1h. If one is ever changed, change both.
      const expires = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      updateLocal(setCommittee, (c) => ({ ...c, endedAt: now.toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }), true);
      setSessionEnded(true);
      setSessionSuspended(false);
      endDebateInDB(committee.id, code, suffix);
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
    const now = Date.now();
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
    const now = Date.now();
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
  const foreignResumeLatch = !!committee?.suspendedAt && !committee?.endedAt && !!committee?.resumingChair
    && committee.resumingChair !== (myChairName || committee?.chairNames?.[0] || 'Chair');
  useEffect(() => {
    if (!foreignResumeLatch) { setResumeStale(false); return; }
    const id = setTimeout(() => setResumeStale(true), 12_000);
    return () => clearTimeout(id);
  }, [foreignResumeLatch]);

  if (loading || authLoading || accessState === 'checking') return <GavelLoader />;

  if (accessState === 'signin') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>Sign in to join this session</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>This is a conference session. Sign in to verify you chair this committee.</p>
          <button
            onClick={() => router.push('/auth/signin?next=' + encodeURIComponent('/join?code=' + code))}
            className="font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none gv-lift"
            style={{ backgroundColor: '#1B3828' }}
          >
            SIGN IN
          </button>
        </div>
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>You don&apos;t chair this committee</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>This session is not associated with your account as a chair. Please try again, or contact your conference organisers.</p>
          <Link href="/sessions" className="inline-block font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>BACK TO HOME</Link>
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

  const present = committee.delegates.filter((d) => d.status !== 'absent' && !d.isObserver).length;
  const progress = committee.currentSpeaker ? (speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;
  const isPreSession = committee.phase === 'pre-session';

  // ── Quorum enforcement ──────────────────────────────────────────────────────
  // Observers are excluded from the voting body — they don't count toward quorum.
  const settings = getSettings(committee.code);
  const presentCount = committee.delegates.filter((d) => d.status !== 'absent' && !d.isObserver).length;
  const totalCount = committee.delegates.filter((d) => !d.isObserver).length;
  const quorumMap: Record<string, number> = { 'none': 0, '1-4': 1 / 4, '1-3': 1 / 3, '1-2': 1 / 2 };
  const quorumFraction = quorumMap[settings.quorumThreshold ?? 'none'] ?? 0;
  const belowQuorum = quorumFraction > 0 && totalCount > 0 && (presentCount / totalCount) < quorumFraction;
  const gslRequireNextSpeaker = settings.gslRequireNextSpeaker;

  // ── Optimistic action handlers ──────────────────────────────────────────────

  const handleNextSpeaker = async () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current);
    setExtraTimeAdded(false);

    if (committee.currentSpeaker) {
      // Count elapsed time against the EXTENDED limit (base + any +time granted) so a speaker
      // given extra time who yields early still logs their real speech instead of underflowing
      // to a negative value that gets silently dropped from scoring/stats.
      const secondsSpoken = Math.max(0, (committee.speakerTimeLimit + extraTimeAddedSecsRef.current) - speakerTimeRemaining);
      if (secondsSpoken > 0) {
        const ctx = committee.phase === 'moderated-caucus' ? 'moderated-caucus' : 'speakers-list';
        const topic = committee.phase === 'moderated-caucus'
          ? (committee.caucus?.purpose ?? committee.topic)
          : committee.topic;
        logSpeakingTime(committee.id, committee.currentSpeaker.country, secondsSpoken, ctx, topic, committee.code, committee.dbChairJoinSuffix ?? undefined);
      }
    }
    extraTimeAddedSecsRef.current = 0;

    const removeDelegateId = committee.speakersList[0]?.delegateId ?? null;
    const [next, ...rest] = committee.speakersList;
    const timeToUse = speakerTimeLimit;

    // nextSpeakerInDB writes { time_remaining: timeToUse, started_at: null } — seat the
    // local anchor to exactly that so this device and every reader agree immediately.
    seatSpeakerClock(timeToUse, null);

    localUpdateTime.current = Date.now();

    updateLocal(setCommittee, (c) => ({
      ...c,
      currentSpeaker: next ?? null,
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
    );
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
  const handleAddExtraTime = (secs: number) => {
    if (secs <= 0) return;
    const running = timerRunning;
    const base = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt) + secs;
    const startedAt = running ? new Date().toISOString() : null;
    seatSpeakerClock(base, startedAt);
    extraTimeAddedSecsRef.current += secs;
    setExtraTimeAdded(true);
    setActivePopover(null);
    setExtraTimeSecs('');
    // Optimistic-first, fire-and-forget (RULE 5). One write per press, never per second.
    if (running) {
      startSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current, startedAt!, base);
    } else {
      syncSpeakerTimeInDB(committeeIdRef.current, base, committeeCodeRef.current, chairSuffixRef.current);
    }
  };

  const handleToggleTimer = () => {
    if (belowQuorum) return;
    const starting = !timerRunning;
    setTimerRunning(starting);
    // The live remainder at the instant of the press — derived, so it is right even if the
    // last repaint was a while ago.
    const live = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt);
    if (starting) {
      // ONE anchor, written to the DB and seated locally as the SAME string, and the base
      // is written alongside it. Stamping only `started_at` (as this used to) left the base
      // at whatever a previous sync happened to store, so the chair and its readers started
      // from two different numbers.
      const startedAt = new Date().toISOString();
      seatSpeakerClock(live, startedAt);
      startSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current, startedAt, live);
    } else {
      // Sync current remaining time to DB on pause (S2 — no per-second writes)
      seatSpeakerClock(live, null);
      stopSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current);
      syncSpeakerTimeInDB(committeeIdRef.current, live, committeeCodeRef.current, chairSuffixRef.current);
    }
    // H2 — in a moderated caucus the TOTAL clock advances in lockstep with the speaker
    // clock, so play/pause is also the total clock's anchor point. One write per press,
    // never per second: `remainingTime` is stamped with the live derived value and
    // `totalStartedAt` with now (or null on pause), so delegates and advisors can render a
    // real countdown and a refresh cannot rewind it.
    if (committee.phase === 'moderated-caucus' && committee.caucus) {
      const anchored = anchorCaucusClock(committee.caucus, caucusSecondsRef.current, starting);
      // structural=false: this is the clock the local tick already owns and the timerRunning
      // pin already protects from the realtime echo. Arming the debounce (RULE 4 / MUST
      // NEVER HAPPEN #4) would make this device drop speakers_list events for 3s.
      updateLocal(setCommittee, (c) => (c.caucus ? { ...c, caucus: anchored } : c), false);
      updateCaucusInDB(committee.id, anchored, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  };

  const handleRestartTime = () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current);
    setExtraTimeAdded(false);
    extraTimeAddedSecsRef.current = 0;
    if (committee?.phase === 'moderated-caucus' && committee.caucus) {
      const speakTime = committee.caucus.speakingTime;
      const live = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt);
      const spentSeconds = Math.max(0, speakTime - live);
      // caucusSecondsRef, not caucus.remainingTime: the stored field is the value AT the
      // anchor, so adding to it would refund seconds against a stale base and hand the
      // caucus back time it had already burnt.
      const newRemainingTime = caucusSecondsRef.current + spentSeconds;
      seatSpeakerClock(speakTime, null);
      syncSpeakerTimeInDB(committee.id, speakTime, committee.code, committee.dbChairJoinSuffix ?? undefined);
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
      syncSpeakerTimeInDB(committee.id, speakerTimeLimit, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  };

  const handleNextCaucusSpeaker = async () => {
    if (!committee.caucus) return;
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current, committeeCodeRef.current, chairSuffixRef.current);
    setExtraTimeAdded(false);

    // Compute everything from current snapshot BEFORE any state updates
    const queue = committee.caucusQueue ?? [];
    const [next, ...rest] = queue;
    const speakTime = committee.caucus.speakingTime;
    const prevCountry = committee.currentSpeaker?.country ?? null;
    // Count against the EXTENDED per-speaker limit (base + any +time) so extra time never
    // underflows the log and drops a real caucus speech (mirrors the GSL Next fix).
    const liveSpeaker = speakerRemainingNow(speakerAnchorRef.current.base, speakerAnchorRef.current.startedAt);
    const spentOnCurrent = Math.max(0, (speakTime + extraTimeAddedSecsRef.current) - liveSpeaker);
    // The LIVE total, derived from the anchor — `caucus.remainingTime` is only the value at
    // the anchor instant, so re-anchoring off it here would silently refund the whole
    // speech to the caucus.
    // Derived, not read off `caucusSecondsRef`. That ref mirrors `caucusSeconds`, which is
    // useState(0) raised by an effect — so for the window between mount and the first clock
    // flush it reads 0, and the `newRemaining <= 0` branch below would END THE CAUCUS
    // instead of advancing the speaker. Same root cause as the expiry effect above.
    const newRemaining = caucusRemainingNow(committee.caucus);
    const newSpoken = prevCountry && !(committee.caucus.spokenCountries ?? []).includes(prevCountry)
      ? [...(committee.caucus.spokenCountries ?? []), prevCountry]
      : (committee.caucus.spokenCountries ?? []);

    // Room-Order Tour de Table speakers are anonymous "Speaker N" placeholders, not real
    // delegations — logging their time would credit a nonexistent country, so skip logging
    // entirely for Room Order (do not log to anyone).
    const isRoomOrder = committee.caucus.purpose?.includes('Room Order') ?? false;
    if (prevCountry && spentOnCurrent > 0 && !isRoomOrder) {
      logSpeakingTime(
        committee.id,
        prevCountry,
        spentOnCurrent,
        'moderated-caucus',
        committee.caucus.purpose ?? committee.topic,
        committee.code,
        committee.dbChairJoinSuffix ?? undefined,
      );
    }
    extraTimeAddedSecsRef.current = 0;

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
      updateCaucusInDB(committee.id, null, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
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

    // Pure state update — no DB calls inside
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucusQueue: rest,
      caucus: updatedCaucus,
      currentSpeaker: next ?? null,
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
    );
    localUpdateTime.current = Date.now();
  };

  const handleEndCaucus = () => {
    setTimerRunning(false);
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
    setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
    updateCaucusInDB(committee.id, null, committee.code, committee.dbChairJoinSuffix ?? undefined);
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
    syncSpeakerTimeInDB(committee.id, seconds, committee.code, committee.dbChairJoinSuffix ?? undefined);
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
    const started = await startResumeRollCallInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (started) { setResumeError(null); return true; }
    // Roll the optimistic state back and hand the latch back so this chair (or another) can
    // retry. releaseResumeClaim is a compare-and-swap on our own name, so it cannot stomp a
    // claim someone else has since taken.
    updateLocal(setCommittee, (c) => ({ ...c, phase: prevPhase, suspendedAt: prevSuspendedAt, resumingChair: claimedName }));
    setSessionSuspended(true);
    const released = await releaseResumeClaimInDB(committee.id, claimedName, committee.code, committee.dbChairJoinSuffix ?? undefined);
    if (released) updateLocal(setCommittee, (c) => ({ ...c, resumingChair: null }));
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
      // the latch: only the chair NAMED in it takes this path.
      const alreadyMine = committee.resumingChair === claimedName;
      const claimed = alreadyMine
        || await claimResumeSessionInDB(committee.id, claimedName, committee.code, committee.dbChairJoinSuffix ?? undefined);
      if (!claimed) {
        // Lost the race (or the latch is stale). Pull the real row so the button stops being
        // a silent no-op and the chair actually sees who is resuming.
        const fresh = await getCommitteeByCode(committee.code);
        if (!fresh) {
          setResumeError(t('session_resume_retry'));
          return;
        }
        setCommittee((prev) => prev ? { ...prev, resumingChair: fresh.resumingChair, suspendedAt: fresh.suspendedAt, phase: fresh.phase } : prev);
        // The winner already finished: the committee is out of suspension, nothing to report.
        if (!fresh.suspendedAt) { setSessionSuspended(false); return; }
        // The latch turns out to be ours after all (our own claim landed but the response was
        // lost). Finish the job rather than reporting a failure.
        if (fresh.resumingChair === claimedName) { await runResumeRollCall(claimedName); return; }
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
        const fresh = await getCommitteeByCode(committee.code);
        if (fresh) setCommittee((prev) => prev ? { ...prev, resumingChair: fresh.resumingChair, suspendedAt: fresh.suspendedAt, phase: fresh.phase } : prev);
        if (fresh && !fresh.suspendedAt) { setSessionSuspended(false); return; }
        setResumeError(t('session_resume_lost'));
        return;
      }
      await runResumeRollCall(claimedName);
    } finally {
      setResumeBusy(false);
    }
  };

  const handlePhaseChange = (phase: string) => {
    updateLocal(setCommittee, (c) => {
      let updated = { ...c, phase: phase as Committee['phase'] };
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

  const isLastGSLSpeaker = committee.speakersList.length === 0;

  // Defensive: a caucus phase with a null caucus object is an inconsistent state
  // (e.g. a legacy session where the caucus ended but the phase change never
  // reached the DB). The caucus <main> branches require a truthy caucus, so this
  // would otherwise blank the whole panel. Treat it as the speakers-list view so
  // the GSL never disappears.
  const caucusPhaseWithoutCaucus =
    (committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && !committee.caucus;
  const showSpeakersListView = committee.phase === 'speakers-list' || caucusPhaseWithoutCaucus;

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
  const handleToggleChat = () => {
    const newShow = !showChat;
    setShowChat(newShow);
    if (!newShow) {
      setShowRollCall(true);
    }
    if (newShow) {
      setShowRollCall(false);
      setShowSliders(false);
    }
  };

  return (
    <FitToScreen>
    <div className="h-full w-full flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-2" data-tutorial="topbar">
        <SessionsHeaderLogo />

        {committee.phase !== 'pre-session' && !sessionEnded ? (
          <div className="flex flex-1 min-w-0 h-full items-center" style={{ overflow: 'visible' }}>
            <button data-tutorial="tab-rollcall" onClick={() => { const opening = !showSliders; setShowSliders(opening); if (opening) { setShowChat(false); setGslListView('az'); } else { setGslListView('queue'); } setShowRollCall(true); }}
              className="flex-1 text-[18px] font-bold px-3 relative h-full transition-all duration-200"
              style={{ color: showSliders ? '#1B3828' : '#1C1410', backgroundColor: showSliders ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showSliders ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showSliders) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showSliders) { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              {t('tab_roll_call')}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showSliders ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button data-tutorial="tab-motions" onClick={handleMotionsClick}
              className="flex-1 text-[18px] font-bold px-3 relative h-full transition-all duration-200"
              style={{ color: showMotions ? '#1B3828' : '#1C1410', backgroundColor: showMotions ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showMotions ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showMotions) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showMotions) { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              {t('tab_motions')}
              {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length > 0 && (
                <span className="absolute top-1 right-1 z-10 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">
                  {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length}
                </span>
              )}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showMotions ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button data-tutorial="tab-documents" onClick={handleDocumentsClick}
              className="flex-1 text-[18px] font-bold px-3 relative h-full transition-all duration-200"
              style={{ color: showDocuments ? '#1B3828' : '#1C1410', backgroundColor: showDocuments ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showDocuments ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showDocuments) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showDocuments) { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              {t('tab_documents')}
              {(() => { const n = (committee.documents ?? []).filter((d) => d.status === 'submitted').length; return n > 0 ? <span className="absolute top-1 right-1 z-10 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">{n}</span> : null; })()}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showDocuments ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button data-tutorial="tab-chat" onClick={() => { if (!isPreSession) handleToggleChat(); }}
              className="flex-1 text-[18px] font-bold px-3 relative h-full transition-all duration-200"
              style={{ color: showChat ? '#1B3828' : '#1C1410', backgroundColor: showChat ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showChat ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showChat) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showChat) { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              {t('tab_chat')}
              {(() => {
                const totalUnread = chatUnreadTotal(committee.messages, myChairName || 'Chair', true, committee.chairNames ?? [], chatReadCounts);
                return totalUnread > 0 && !showChat
                  ? <span className="absolute top-1 right-1 z-10 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">{totalUnread}</span>
                  : null;
              })()}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showChat ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
          </div>
        ) : (
          <span className="text-[#9A8A78] text-xs hidden sm:block truncate flex-1">{getCommitteeDisplayName(committee.name, language)}: {committee.topic}</span>
        )}


        <button onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          data-tutorial="join-code"
          className="text-xs font-mono bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] px-2.5 py-1 rounded-lg transition-colors shrink-0 gv-lift">
          {copied ? '✓' : committee.code}
        </button>
        <button onClick={() => setShowScoreboard(true)} title={t('chair_hdr_scoreboard')}
          className="text-[#9A8A78] hover:text-[#1C1410] transition-colors shrink-0"
          style={{ lineHeight: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
        </button>
        {/* Once the gavel has fallen, a conference chair's next job is the award slate — a
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
        <button data-tutorial="tab-settings" onClick={() => setShowSettings(true)} title={t('chair_hdr_settings')}
          className="text-[#9A8A78] hover:text-[#1C1410] transition-colors shrink-0"
          style={{ lineHeight: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>
      {/* The gavel lives here, on the front page — not buried in Settings — and shows for
          EVERY chair in BOTH states, so handover reads as a one-tap switch rather than an
          error. A genuinely solo chair has nobody to hand to, so the affordance stays hidden —
          but a view-only device always gets it, including the organiser's ?chairName=Secretariat
          deep link, whose name may not be in chair_names yet. */}
      {!sessionEnded && ((committee.chairNames?.length ?? 0) > 1 || isViewOnly) && (
        <GavelChip
          chairNames={committee.chairNames ?? []}
          headChairName={headChairName}
          myChairName={myChairName}
          onlineChairs={onlineChairs}
          headOffline={headOffline}
          onTakeGavel={() => handleSetHeadChair(myChairName)}
          onHandOver={(name) => handleSetHeadChair(name)}
        />
      )}
      {gavelToast && (
        <div
          className="fixed z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl"
          style={{
            // NotificationStack owns the slot directly under the header now and publishes
            // its measured height as `--dgn-stack-shift` on <html> (0 / absent when the
            // stack is empty or suppressed). The toast and the GavelChip both add it, so
            // they slide down out of the way together and keep their spacing.
            top: 'calc(6.6rem + var(--dgn-stack-shift, 0px))', right: '0.85rem', maxWidth: '19rem',
            transition: 'top 240ms cubic-bezier(0.22,1,0.36,1)',
            backgroundColor: gavelToast.tone === 'lost' ? '#F6EEE0' : '#1B3828',
            border: gavelToast.tone === 'lost' ? '1px solid rgba(184,132,74,0.45)' : '1px solid rgba(238,217,138,0.28)',
            boxShadow: '0 12px 30px rgba(27,56,40,0.22)',
            color: gavelToast.tone === 'lost' ? '#8A5A2E' : '#EED98A',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <span className="text-xs font-bold leading-snug">{gavelToast.text}</span>
        </div>
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
              const found = getCountryByName(m.proposedBy);
              const flagEl = found
                ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : <Emoji size="1.125rem">🌐</Emoji>;
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
            const anotherChairResuming = committee.resumingChair && committee.resumingChair !== (myChairName || committee.chairNames[0] || 'Chair');
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
        {showChat && !sessionEnded && (
          <div className="absolute inset-0 z-40 flex overflow-hidden min-h-0" style={{ backgroundColor: '#EDE7D8' }}>
            {getCommitteeFlags(committee).disableChat ? (
              <ChatDisabledNotice onClose={() => { setShowChat(false); setShowRollCall(true); }} />
            ) : (
              <ChatPanel
                committee={committee}
                senderName={myChairName || 'Chair'}
                isChair={true}
                onClose={() => { setShowChat(false); setShowRollCall(true); }}
                readOnly={sessionEnded}
                readCounts={chatReadCounts}
                onReadCountsChange={setChatReadCounts}
              />
            )}
          </div>
        )}
        {!showChat && committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={{ maxHeight: '680px', display: 'flex', flexDirection: 'column', backgroundColor: '#1B3828', border: '1.5px solid #3D7A52', boxShadow: '0 32px 80px rgba(27,56,40,0.40)' }}>
              <div className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }} />
              <RollCallPanel committee={committee}
                onListIds={gslListIds}
                onCycleStatus={handleCycleStatus}
                onStatusChange={handleStatusChange}
                onPhaseChange={handlePhaseChange}
                onDelegateAdd={handleDelegateAdd}
                isRollCallPhase={true}
                showBulkActions={true}
                showViewToggle={false}
                isReadOnly={sessionEnded}
                isViewOnly={isViewOnly} />
            </div>
          </div>
        )}
        {committee.phase !== 'pre-session' && (
          <>
            {/* Sidebar width is now inline and user-set (was w-[22rem] = 352px,
                which is still the default and the SSR value). `borderRight`
                moved to SidebarResizer below: the divider IS the border now, so
                keeping both would draw two rules side by side. The main column
                is flex-1, so it reflows as this narrows or widens. */}
            {showRollCall && (
              <aside
                ref={sidebarRef}
                data-tutorial="speakers-sidebar"
                className="flex flex-col overflow-hidden shrink-0"
                style={{ width: sidebarWidth, backgroundColor: '#1B3828' }}
              >
                {/* The committee's identity, stated ONCE for this whole column. RollCallPanel
                    below gets `hideIdentity` so it no longer prints the name and topic a
                    second time, one line down and behind its own border. Compact on purpose:
                    the badge is SHORTER than the two headings it replaced, so the speakers
                    list beneath it gained height rather than losing it.
                    Long names collapse to the acronym with the full name small beneath
                    (UI RULE), via committeeDisplayName. */}
                {(() => {
                  // Match and derive against the RAW stored name: the preset aliases are
                  // English, so a localised display name would never match them.
                  const rawName = committee.name;
                  const fullName = getCommitteeDisplayName(rawName, language);
                  // A standalone session has no `abbreviation` column, so without a derived
                  // acronym committeeDisplayName would always fall back to the full name and
                  // the acronym-plus-subtitle UI RULE could never fire outside conferences.
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
                    />
                  );
                })()}
                {caucusMaxReachedMsg && (
                  <div className="shrink-0 px-3 py-2 bg-amber-900/20 border-b border-amber-700/40 text-amber-300 text-xs text-center font-semibold">
                    Maximum speakers reached. Add more delegates if time remains after current speakers.
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
                      if (caucusMaxSpeakers !== null && (committee.caucusQueue ?? []).length >= caucusMaxSpeakers) {
                        setCaucusMaxReachedMsg(true);
                        setTimeout(() => setCaucusMaxReachedMsg(false), 6000);
                        return;
                      }
                      const inlinePos = (committee.caucusQueue ?? []).length + 1;
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
                      addToCaucusListInDB(committee.id, delegateId, delegate.country, committee.code, committee.dbChairJoinSuffix ?? undefined, inlinePos);
                    }}
                    hideIdentity
                    onListIds={caucusQueueIds}
                    onRemoveFromList={(delegateId) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
                      removeFromCaucusListInDB(committee.id, delegateId, committee.code, committee.dbChairJoinSuffix ?? undefined);
                    }}
                    onReorderList={(newList) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
                      reorderSpeakersListInDB(committee.id, newList, committee.code, committee.dbChairJoinSuffix ?? undefined, 'caucus');
                    }}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    showStatusSliders={showSliders}
                    isReadOnly={sessionEnded}
                    isViewOnly={isViewOnly} />
                ) : (committee.phase === 'unmoderated-caucus' && committee.caucus) ? (
                  <RollCallPanel committee={committee}
                    hideIdentity
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    showStatusSliders={showSliders}
                    showViewToggle={false}
                    isReadOnly={sessionEnded}
                    isViewOnly={isViewOnly} />
                ) : (
                  <RollCallPanel committee={committee}
                    hideIdentity
                    onAddToList={handleAddToSpeakersList}
                    onListIds={gslListIds}
                    onRemoveFromList={handleRemoveFromSpeakersList}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onPhaseChange={handlePhaseChange}
                    onDelegateAdd={handleDelegateAdd}
                    onReorderList={handleReorderSpeakersList}
                    showStatusSliders={showSliders}
                    listView={gslListView}
                    onListViewChange={setGslListView}
                    isReadOnly={sessionEnded}
                    isViewOnly={isViewOnly} />
                )}
                </div>
              </aside>
            )}
            {showRollCall && (
              <SidebarResizer
                width={sidebarWidth}
                targetRef={sidebarRef}
                onCommit={handleSidebarResize}
                label={t('rollcall_resize_sidebar')}
              />
            )}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                caucusLoading ? (() => {
                  const isTdTParent = committee.caucus?.purpose?.startsWith('Tour de Table') ?? false;
                  return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="bg-[#EDE7D8] border border-[#1B3828]/40 rounded-3xl px-12 py-10 max-w-lg w-full shadow-2xl">
                      {isTdTParent ? (
                        <>
                          <p className="text-xs font-mono tracking-widest mb-3 font-bold" style={{ color: '#1B3828' }}>{t('caucus_starting_tdt')}</p>
                          <h1 className="text-5xl font-black mb-2" style={{ color: '#1B3828' }}>Tour de Table</h1>
                          <p className="text-[#6A5A4A] text-sm mb-6">
                            {committee.caucus.purpose?.includes('Room Order')
                              ? t('caucus_tdt_room_order')
                              : committee.caucus.purpose?.includes('Z→A') ? t('caucus_tdt_z_to_a') : t('caucus_tdt_a_to_z')}
                          </p>
                          <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#1C1410]">
                                {committee.caucusQueue?.length ?? Math.floor(committee.caucus.totalTime / (committee.caucus.speakingTime || 1))}
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
                          <h1 className="text-5xl font-black mb-2" style={{ color: '#1B3828' }}>{committee.caucus.purpose || 'Moderated Caucus'}</h1>
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
                              <div className="text-2xl font-black text-[#1C1410]">{Math.floor(committee.caucus.totalTime / (committee.caucus.speakingTime || 1))}</div>
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
                    activePopover={activePopover}
                    setActivePopover={setActivePopover}
                    extraTimeAdded={extraTimeAdded}
                    handleToggleTimer={handleToggleTimer}
                    handleRestartTime={handleRestartTime}
                    handleNextCaucusSpeaker={handleNextCaucusSpeaker}
                    handleEndCaucus={handleEndCaucus}
                    sessionEnded={sessionEnded}
                    isViewOnly={isViewOnly}
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
                  <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} isViewOnly={isViewOnly} />
                )
              )}

{showSpeakersListView && (
                <>
                {/* Three-zone flex column: queue locked top, centre shrinks, buttons locked above bottom bar */}
                <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
                  <span className="absolute top-2 left-3 z-10 text-lg font-black tracking-widest"
                    style={{ color: '#1C1410', fontFamily: "'Poppins', sans-serif" }}>GSL</span>
                  {committee.currentSpeaker ? (
                    <>
                      {/* ZONE 1 — Queue locked at top */}
                      <div className="shrink-0">
                        {(() => {
                          const gslDisplayList = [
                            { delegateId: committee.currentSpeaker.delegateId, country: committee.currentSpeaker.country },
                            ...committee.speakersList,
                          ];
                          return (
                            <DraggableSpeakersQueue
                              list={gslDisplayList}
                              currentSpeakerDelegateId={committee.currentSpeaker.delegateId}
                              onReorder={isViewOnly ? undefined : (newList) => handleReorderSpeakersList(newList.filter((s) => s.delegateId !== committee.currentSpeaker!.delegateId))}
                              onRemove={isViewOnly ? undefined : handleRemoveFromSpeakersList}
                            />
                          );
                        })()}
                      </div>
                      {/* ZONE 2 — Flag + name + timer + progress: compresses as viewport shrinks */}
                      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-1">
                        <div style={{ width: '165px', height: '110px', borderRadius: '12px', boxShadow: '0 0 0 2.5px rgba(28,20,16,0.22)', flexShrink: 0, position: 'relative' }}>
                          {(() => {
                            const f = getCountryByName(committee.currentSpeaker.country);
                            return f
                              ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <Emoji size="5rem" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌐</Emoji>;
                          })()}
                        </div>
                        <h1 className="font-black text-[#1C1410] text-center" style={{ fontSize: '1.8rem', margin: '8px 0' }}>{getCountryDisplayName(committee.currentSpeaker.country, language)}</h1>
                        {isViewOnly ? (
                          <div className="font-bold text-[#6A5A4A] text-center" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                            {t('view_is_speaking')}
                          </div>
                        ) : (
                          <>
                            <div data-tutorial="timer" className={`font-black font-mono tabular-nums ${speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'}`} style={{ fontSize: '5rem', marginBottom: '8px' }}>
                              {formatTime(speakerTimeRemaining)}
                              {extraTimeAdded && <span className="text-base ms-2 font-normal text-[#1C1410]">{t('gsl_plus_time')}</span>}
                            </div>
                            <div className="w-full max-w-2xl h-2 bg-[#DDD4C0] rounded-full overflow-hidden" style={{ marginBottom: '6px' }}>
                              <div className={`h-full rounded-full transition-all ${progress > 20 ? 'bg-[#B6871F]' : 'bg-[#B8844A]'}`} style={{ width: `${progress}%` }} />
                            </div>
                          </>
                        )}
                        {gslRequireNextSpeaker && isLastGSLSpeaker && (
                          <div className="mb-1 px-4 py-1.5 bg-[#B6871F]/10 border border-[#B6871F]/30 rounded-lg text-[#B6871F] text-xs text-center">
                            {t('gsl_never_empty_warning')}
                          </div>
                        )}
                      </div>
                      {/* ZONE 3 — Action buttons locked just above bottom bar */}
                      {!sessionEnded && !isViewOnly && (
                        <div className="shrink-0 flex gap-2 w-full max-w-sm flex-wrap justify-center px-4 pb-3 mx-auto">
                          <button onClick={handleRestartTime} title="Restart time"
                            className="px-3 py-3 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#C8BAA8] hover:border-[#1B3828] rounded-xl font-bold text-sm text-[#6A5A4A] transition-colors gv-lift">
                            ↺
                          </button>
                          <button onClick={handleToggleTimer}
                            data-tutorial="timer-toggle"
                            disabled={gslRequireNextSpeaker && isLastGSLSpeaker}
                            className={`gv-lift flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none ${
                              timerRunning ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' :
                              (gslRequireNextSpeaker && isLastGSLSpeaker) ? 'bg-[#DDD4C0] text-[#9A8A78] cursor-not-allowed' :
                              'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
                            }`}>
                            {timerRunning ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="flex gap-[3px] items-center">
                                  <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
                                  <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
                                </span>
                                <span>{t('gsl_pause')}</span>
                              </span>
                            ) : t('gsl_start')}
                          </button>
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length === 0}
                            className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] disabled:opacity-40 text-[#1C1410] py-3 px-4 rounded-xl font-bold transition-colors focus:outline-none whitespace-nowrap gv-lift" style={{ fontSize: '14px' }}>
                            {t('gsl_next')}
                          </button>
                          <button
                            onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')}
                            data-tutorial="add-time-button"
                            title="Add time"
                            className="px-2 py-2 border rounded-xl font-black uppercase tracking-wide transition-colors bg-[#EDE7D8] hover:bg-[#DDD4C0] border-[#DDD4C0] text-[#1B3828] leading-tight text-center gv-lift" style={{ fontSize: '8px', minWidth: '52px' }}>
                            {t('gsl_add_time').split('\n')[0]}<br />{t('gsl_add_time').split('\n')[1]}
                          </button>
                          <button
                            onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                            data-tutorial="rtr-button"
                            className="px-3 py-3 border rounded-xl font-black text-xs uppercase tracking-wide transition-colors bg-[#B8844A]/15 hover:bg-[#B8844A]/25 border-[#B8844A]/30 text-[#B8844A] gv-lift">
                            {t('gsl_right_to_reply')}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* No-current-speaker state — simple centred layout */
                    <div className="flex-1 flex flex-col items-center justify-center w-full text-center px-4">
                      {committee.speakersList.length > 0 && (
                        <DraggableSpeakersQueue
                          list={committee.speakersList}
                          onReorder={isViewOnly ? undefined : handleReorderSpeakersList}
                          onRemove={isViewOnly ? undefined : handleRemoveFromSpeakersList}
                        />
                      )}
                      <h2 className="text-5xl font-black mb-3 text-center" style={{ color: '#1B3828' }}>{t('gsl_no_current_speaker')}</h2>
                      <p className="mb-4 text-center text-sm" style={{ color: '#9A8A78' }}>{t('gsl_add_call_first')}</p>
                      {committee.speakersList.length === 1 && (
                        <div className="mb-4 px-4 py-2 bg-[#B6871F]/10 border border-[#B6871F]/30 rounded-lg text-[#B6871F] text-xs text-center">
                          {t('gsl_one_delegate_warning')}
                        </div>
                      )}
                      {!sessionEnded && !isViewOnly && (
                        <button data-tutorial="call-first-speaker" onClick={handleNextSpeaker} disabled={committee.speakersList.length < 2}
                          className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white px-8 py-3 rounded-xl font-bold transition-colors focus:outline-none gv-lift">
                          {t('gsl_call_first')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!sessionEnded && !isViewOnly && (
                <div className="border-t border-[#DDD4C0] px-6 py-2 shrink-0" style={{ backgroundColor: '#F6F1E9' }}>
                  {!isViewOnly && <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-[#9A8A78] font-mono shrink-0">{t('gsl_time')}</span>
                    <div className="flex gap-1.5">
                      {[45, 60, 75, 90].map((preset) => (
                        <button key={preset} onClick={() => handleSetSpeakerTimeLimit(preset)}
                          className={`gv-lift text-xs px-2.5 py-1 rounded-lg transition-colors font-semibold ${speakerTimeLimit === preset ? 'bg-[#1B3828] text-white' : 'bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {preset}s
                        </button>
                      ))}
                      <input type="number" value={speakerTimeLimitInput}
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
                        className="w-14 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-xs focus:outline-none" />
                    </div>
                  </div>}
                  {belowQuorum && (
                    <p className="text-xs text-[#8B2020] text-center py-2">
                      ⚠️ Below quorum: speakers cannot be added until {Math.ceil(quorumFraction * totalCount)} delegates are present.
                    </p>
                  )}
                  {!isViewOnly && (
                  <div data-tutorial="speakers-bottom-bar">
                    <AddSpeakerInput committee={committee} onAdd={belowQuorum ? () => {} : handleAddToSpeakersList} />
                  </div>
                  )}
                </div>
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
              {isViewOnly && (
                <FeedbackLogPanel
                  committee={committee}
                  chairName={myChairName || committee.chairNames[0] || 'Chair'}
                  currentCountry={liveCaucus(committee)?.currentSpeaker ?? committee.currentSpeaker?.country ?? null}
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
        />
      )}
      {showDocuments && !isPreSession && !sessionEnded && (
        <DocumentsModal
          committee={committee}
          onClose={() => setShowDocuments(false)}
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
          onClose={() => setShowSettings(false)}
        />
      )}
      {showScoreboard && (
        <ScoreboardPanel
          committee={committee}
          onClose={() => setShowScoreboard(false)}
          feedbackVersion={feedbackVersion}
          isViewOnly={isViewOnly}
        />
      )}
      {/* EXTRA TIME OVERLAY — fixed position, same anchor as RTR overlay */}
      {!sessionEnded && !isViewOnly && activePopover === 'extraTime' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#EDE7D8] border border-[#3D7A52]/40 rounded-xl p-3 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#1B3828' }}>{t('gsl_add_time_title')}</span>
              <button onClick={() => setActivePopover(null)} className="text-[#1C1410] hover:text-[#8B2020] text-sm font-bold">✕</button>
            </div>
            <div className="flex gap-2 mb-2">
              {[15, 30, 60].map((s) => (
                <button key={s} onClick={() => { handleAddExtraTime(s); setActivePopover(null); }}
                  className="flex-1 py-2 bg-[#EDE7D8] hover:bg-[#1B3828] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1B3828] hover:text-[#EED98A] text-xs rounded-lg font-black uppercase tracking-wide transition-colors gv-lift">
                  +{s}s
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={extraTimeSecs}
                onChange={(e) => setExtraTimeSecs(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseInt(extraTimeSecs); if (n > 0) { handleAddExtraTime(n); setActivePopover(null); } } }}
                placeholder={language === 'ar' ? 'ثوانٍ مخصصة...' : language === 'fr' ? 'Sec. personnalisées...' : language === 'es' ? 'Tiempo personalizado...' : 'Custom sec...'}
                style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-[#1C1410] text-xs focus:outline-none focus:border-[#1B3828] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => { const n = parseInt(extraTimeSecs); if (n > 0) { handleAddExtraTime(n); setActivePopover(null); } }}
                disabled={!extraTimeSecs || parseInt(extraTimeSecs) <= 0}
                className="px-2 py-1.5 bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 text-[#EED98A] text-xs rounded-lg font-black transition-colors gv-lift">
                {t('gsl_add_time_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RTR OVERLAY — fixed position, completely outside document flow.
          Never render this inside any flex/grid container — it must not
          affect the layout of the GSL centre column in any way. */}
      {/* Exactly ONE per surface — this host owns the interval that advances every
          notification's TTL, so a second mount would halve every countdown. */}
      <NotificationStack extras={broadcastExtras} />
      {showTutorial && committee && (
        <TutorialOverlay
          committee={committee}
          onEnd={() => setShowTutorial(false)}
          onStepId={(id) => {
            if (id === 'sidebar-view-toggle') {
              // Ensure sidebar is visible and in AZ view so the toggle can be clicked
              setShowChat(false);
              setShowRollCall(true);
              setGslListView('az');
            }
          }}
        />
      )}
      {!isViewOnly && activePopover === 'rightToReply' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#EDE7D8] border border-[#B8844A]/30 rounded-xl p-4 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#B8844A' }}>{t('gsl_right_to_reply_popover')}</span>
              <button onClick={() => {
                setActivePopover(null);
                setRtrOpen(false);
                setRtrTimerActive(false);
                setRtrCountry('');
                setRtrTimeRemaining(rtrSeconds);
              }} className="text-[#1C1410] hover:text-[#8B2020] text-sm font-bold">✕</button>
            </div>
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
                      className={`gv-lift flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors border ${
                        rtrSeconds === s
                          ? 'bg-[#B8844A] border-[#B8844A] text-[#1C1410]'
                          : 'bg-[#EDE7D8] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#B8844A]/50'
                      }`}
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
                  className="w-full py-2 bg-[#B8844A] hover:bg-[#B8844A]/80 disabled:opacity-40 disabled:cursor-not-allowed text-[#1C1410] text-xs rounded-lg font-black uppercase tracking-wide transition-colors gv-lift"
                >
                  {t('gsl_grant')}
                </button>
              </>
            ) : (
              // ── Active timer view ──────────────────────────────
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  {(() => {
                    const f = getCountryByName(rtrCountry);
                    return f
                      ? <img src={getFlagUrl(f.code)} alt={f.code} className="w-6 h-6 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <Emoji size="1.25rem">🌐</Emoji>;
                  })()}
                  <span className="text-sm text-[#1C1410] font-bold flex-1">{rtrCountry}</span>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#B8844A' }}>{t('gsl_right_to_reply_popover')}</span>
                </div>
                <div className={`text-5xl font-black font-mono text-center mb-3 tabular-nums ${
                  rtrTimeRemaining <= 5 ? 'text-red-500' : rtrTimeRemaining <= 10 ? 'text-[#B6871F]' : 'text-[#B8844A]'
                }`}>
                  {Math.floor(rtrTimeRemaining / 60)}:{String(rtrTimeRemaining % 60).padStart(2, '0')}
                </div>
                <div className="w-full h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${rtrTimeRemaining / rtrSeconds > 0.5 ? 'bg-[#B8844A]' : rtrTimeRemaining / rtrSeconds > 0.2 ? 'bg-[#B6871F]' : 'bg-red-500'}`}
                    style={{ width: `${(rtrTimeRemaining / rtrSeconds) * 100}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRtrTimerActive((r) => !r)}
                    className={`gv-lift flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                      rtrTimerActive ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
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
                      setActivePopover(null);
                    }}
                    className="px-3 py-2 rounded-lg font-bold text-xs bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#6A5A4A] transition-colors gv-lift"
                  >
                    {t('rtr_done')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
