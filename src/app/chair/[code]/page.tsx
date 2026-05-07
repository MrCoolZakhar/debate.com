'use client';
import { use, useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Committee, DelegateStatus } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import DocumentsModal from '@/components/DocumentsModal';
import { getFlagUrl, getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import ChatPanel from '@/components/ChatPanel';
import {
  getCommitteeByCode,
  subscribeToCommittee,
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
  approveJoinRequest,
  denyJoinRequest,
  approveGslRequest,
  denyGslRequest,
  logSpeakingTime,
  resumeSession as resumeSessionInDB,
  claimResumeSession as claimResumeSessionInDB,
  startResumeRollCall as startResumeRollCallInDB,
  removePendingMotion as removePendingMotionInDB,
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
    ? eligible.filter((d) => d.country.trim().toLowerCase().startsWith(q))
        .concat(eligible.filter((d) => !d.country.trim().toLowerCase().startsWith(q) && d.country.trim().toLowerCase().includes(q)))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id)) return; onAdd(d.id); setQuery(''); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list..." autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {topNotOnList.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
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
                  <span className="text-sm flex-1 text-[#9A8A78]">{d.country}</span>
                  <span className="text-xs text-[#9A8A78]">already on list</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                <span className="text-sm">{d.country}</span>
                {isFirst && <span className="ml-auto text-xs text-[#9A8A78]">Enter ↵</span>}
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
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const q = resolveQuery(query).toLowerCase();
  const matches = q
    ? eligible
        .filter((d) => d.country.trim().toLowerCase().startsWith(q))
        .concat(eligible.filter((d) =>
          !d.country.trim().toLowerCase().startsWith(q) &&
          d.country.trim().toLowerCase().includes(q)
        ))
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
          placeholder="Type country…"
          className="flex-1 bg-transparent px-3 py-1.5 text-[#1C1410] text-xs placeholder-[#9A8A78] focus:outline-none"
        />
        {topMatch && query && !value && query.toLowerCase() !== topMatch.country.toLowerCase() && (
          <span className="text-[10px] text-[#9A8A78] px-2 truncate max-w-[90px]">↵ {topMatch.country}</span>
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
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}
              >
                <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
                {found
                  ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-4 h-4 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <Emoji size="0.875rem">🌐</Emoji>}
              </span>
                <span className="flex-1">{d.country}</span>
                {i === 0 && <span className="text-[#9A8A78] shrink-0">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Draggable GSL Speakers Queue ──────────────────────────────────────────────
function DraggableSpeakersQueue({ list, onReorder, onRemove, lastSpeakerDelegateId, currentSpeakerDelegateId, isRoomOrderTdT }: {
  list: { delegateId: string; country: string }[];
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  onRemove: (delegateId: string) => void;
  lastSpeakerDelegateId?: string | null;
  currentSpeakerDelegateId?: string | null;
  isRoomOrderTdT?: boolean;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const qLen = list.length;
  const displayItems = list.slice(0, 7);
  const overflow = qLen > 7 ? qLen - 7 : 0;
  return (
    <div className="flex flex-col items-center w-full mb-1">
      <div className="flex flex-nowrap items-start gap-4 pt-2 pb-1 justify-center">
        {displayItems.map((s, i) => {
          const isCurrent = currentSpeakerDelegateId && s.delegateId === currentSpeakerDelegateId;
          return (
            <div key={s.delegateId} className="flex flex-col items-center gap-1 relative group cursor-grab shrink-0"
              draggable={!isCurrent}
              onDragStart={() => { if (!isCurrent) dragIndexRef.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragIndexRef.current;
                if (from === null || from === i) return;
                const newList = [...list];
                const [moved] = newList.splice(from, 1);
                newList.splice(i, 0, moved);
                onReorder(newList);
                dragIndexRef.current = null;
              }}>
              {isRoomOrderTdT ? (
                <div className={`w-20 h-20 rounded-full bg-[#DDD4C0] border border-[#C8BAA8] flex items-center justify-center ${isCurrent ? 'ring-4 ring-[#1B3828]' : ''}`}>
                  <span className="text-3xl font-black text-[#B6871F]">{i + 2}</span>
                </div>
              ) : (
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(28,20,16,0.12)' }}>
                  <FlagCircle country={s.country} size="xl" />
                </div>
              )}
              {!isRoomOrderTdT && (
                <span className="line-clamp-2 break-words whitespace-normal leading-tight max-w-[80px] text-xs font-semibold text-center" style={{ color: '#1C1410' }}>{abbrevCountry(s.country)}</span>
              )}
              {isCurrent && <span className="text-sm font-semibold" style={{ color: '#B8844A' }}>Speaking</span>}
              {!isCurrent && i === 0 && <span className="text-xs font-semibold" style={{ color: '#B8844A' }}>Up next</span>}
              {!isCurrent && lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && i !== 0 && (
                <span className="text-xs font-bold text-[#9A8A78] bg-[#DDD4C0] px-1.5 py-0.5 rounded">Last</span>
              )}
              {!isCurrent && (
                <button onClick={() => onRemove(s.delegateId)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-[#EDE7D8] border border-[#DDD4C0] rounded-full text-[#1C1410] text-[10px] font-black hidden group-hover:flex items-center justify-center shadow-sm">✕</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center h-5 flex items-center justify-center">
        {overflow > 0 && (
          <span className="text-xs font-medium" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>+{overflow} more in queue</span>
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
  const dragIndexRef = useRef<number | null>(null);
  const queue = committee.caucusQueue ?? [];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#DDD4C0] shrink-0">
        <span className="text-sm font-bold text-[#1C1410]">Speaker Queue</span>
        <span className="text-xs text-[#9A8A78] ml-2 font-mono">{queue.length} speakers</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#9A8A78] text-sm">No speakers queued</div>
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
                <span className="text-xs text-[#9A8A78] font-mono w-5 text-right shrink-0">{i + 1}</span>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                {found
                  ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <Emoji size="1.125rem">🌐</Emoji>}
              </span>
                <span className="flex-1 text-sm text-[#1C1410] line-clamp-2 break-words whitespace-normal leading-tight">{s.country}</span>
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
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set((committee.caucusQueue ?? committee.speakersList).map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const isFull = maxSpeakers !== undefined && currentQueueLength !== undefined && currentQueueLength >= maxSpeakers;
  const cq = resolveQuery(query).toLowerCase();
  const matches = cq
    ? eligible.filter((d) => d.country.trim().toLowerCase().startsWith(cq))
        .concat(eligible.filter((d) => !d.country.trim().toLowerCase().startsWith(cq) && d.country.trim().toLowerCase().includes(cq)))
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
            Queue full — {maxSpeakers} speaker{maxSpeakers !== 1 ? 's' : ''} fit in remaining time
          </p>
        </div>
      ) : (
      <>
      <div className="flex items-center bg-[#FAF8F3] border rounded-xl transition-colors border-[#DDD4C0] focus-within:border-[#1B3828]">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list…"
          className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {topNotOnList.country}</span>}
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
                  <span className="text-sm flex-1 text-[#9A8A78]">{d.country}</span>
                  <span className="text-xs text-[#9A8A78]">{isCurrent ? 'currently speaking' : 'already on list'}</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isFirst ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                <span className="shrink-0 w-6 h-6 inline-flex items-center justify-center">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Emoji size="1.125rem">🌐</Emoji>}
                </span>
                <span className="text-sm flex-1">{d.country}</span>
                {spoke && <span className="text-[10px] text-[#B6871F] shrink-0">already spoke</span>}
                {isFirst && !spoke && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onAddFirst && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddFirst(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors">
                        ↑ First
                      </button>
                    )}
                    {onAddLast && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddLast(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#B6871F] font-bold border border-[#C8BAA8] transition-colors">
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
          className="shrink-0 px-5 py-3 rounded-xl font-black text-sm bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors">
          End Caucus
        </button>
      )}
    </div>
  );
}

// ── Unmoderated Caucus View ───────────────────────────────────────────────────
function UnmoderatedCaucusView({ committee, setCommittee }: { committee: Committee; setCommittee: CommitteeSetter }) {
  const { getSettings } = useSettingsStore();
  const unmoderatedName = getSettings(committee.code).motionNames?.unmoderated ?? 'Unmoderated Caucus';
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;
  const remainingRef = useRef(caucus.remainingTime);
  remainingRef.current = caucus.remainingTime;
  const [showExtendUnmod, setShowExtendUnmod] = useState(false);
  const [extendMinsUnmod, setExtendMinsUnmod] = useState(5);

  useEffect(() => {
    if (running) {
      const tick = () => {
        if (remainingRef.current <= 0) { setRunning(false); return; }
        updateLocal(setCommittee, (c) => {
          if (!c.caucus) return c;
          const newTotal = Math.max(0, c.caucus.remainingTime - 1);
          return { ...c, caucus: newTotal === 0 ? null : { ...c.caucus, remainingTime: newTotal } };
        });
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleEndCaucus = () => {
    setRunning(false);
    setPhaseInDB(committee.id, 'speakers-list');
    updateCaucusInDB(committee.id, null);
    updateLocal(setCommittee, (c) => {
      const preCaucusSpeaker = c.currentSpeaker;
      const newSpeakersList = preCaucusSpeaker
        ? [preCaucusSpeaker, ...c.speakersList.filter((s) => s.delegateId !== preCaucusSpeaker.delegateId)]
        : c.speakersList;
      if (preCaucusSpeaker) {
        reorderSpeakersListInDB(c.id, newSpeakersList, 'gsl');
      }
      return {
        ...c,
        caucus: null,
        phase: 'speakers-list' as const,
        caucusQueue: [],
        currentSpeaker: null,
        speakersList: newSpeakersList,
        speakerTimeRemaining: c.speakerTimeLimit,
      };
    }, true);
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 py-12">
      {/* Absolute overlay: motion name + topic — does not affect centred layout */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 max-w-[200px] pl-4 pointer-events-none select-none">
        <span className="text-[#1C1410] font-black text-2xl leading-tight uppercase">
          {caucus.motionLabel ?? unmoderatedName}
        </span>
        {caucus.purpose && (
          <span className="text-[#1C1410]/70 text-lg font-medium leading-snug">
            {caucus.purpose}
          </span>
        )}
      </div>
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${caucus.remainingTime <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>
        {formatTime(caucus.remainingTime)}
      </div>
      <div className="w-full max-w-sm h-2 bg-[#DDD4C0] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-[#B6871F] rounded-full transition-all" style={{ width: `${caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0}%` }} />
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={() => setRunning((r) => !r)} className={`px-8 py-3 rounded-xl font-bold transition-colors ${running ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}>
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button onClick={() => setShowExtendUnmod((v) => !v)} className="px-4 py-3 rounded-xl font-bold bg-[#DDD4C0] hover:bg-[#3D7A52]/60 text-[#6A5A4A] hover:text-[#EED98A] transition-colors border border-[#DDD4C0] hover:border-[#3D7A52]/40">
          Extend
        </button>
        <button onClick={handleEndCaucus} className="px-8 py-3 rounded-xl font-black bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors">
          End Caucus
        </button>
      </div>
      {showExtendUnmod && (
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <span className="text-xs text-[#EED98A] font-semibold shrink-0">Extend by</span>
          {(() => {
            const halfMins = caucus.totalTime / 120;
            const rawSuggestions = [5, 10, halfMins];
            const suggestions = [...new Set(
              rawSuggestions
                .filter((m) => m > 0)
                .map((m) => Math.round(m * 2) / 2)
            )].sort((a, b) => a - b);
            return suggestions.map((m) => (
              <button key={m} onClick={() => {
                const addSecs = m * 60;
                updateLocal(setCommittee, (c) => {
                  if (!c.caucus) return c;
                  const newRemaining = c.caucus.remainingTime + addSecs;
                  const newTotal = c.caucus.totalTime + addSecs;
                  const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
                  updateCaucusInDB(committee.id, updated);
                  return { ...c, caucus: updated };
                }, true);
                setShowExtendUnmod(false);
              }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#2A5A3C]/60 hover:bg-[#3D7A52]/60 border border-[#3D7A52]/40 text-[#EED98A] transition-colors">
                {m % 1 === 0 ? `${m}m` : `${m}m`}
              </button>
            ));
          })()}
          <input type="number" min={1} value={extendMinsUnmod} onChange={(e) => setExtendMinsUnmod(parseInt(e.target.value) || 1)}
            className="w-12 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-xs focus:outline-none" />
          <button onClick={() => {
            const addSecs = extendMinsUnmod * 60;
            updateLocal(setCommittee, (c) => {
              if (!c.caucus) return c;
              const newRemaining = c.caucus.remainingTime + addSecs;
              const newTotal = c.caucus.totalTime + addSecs;
              const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
              updateCaucusInDB(committee.id, updated);
              return { ...c, caucus: updated };
            }, true);
            setShowExtendUnmod(false);
          }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#2A5A3C]/60 hover:bg-[#3D7A52]/60 border border-[#3D7A52]/40 text-[#EED98A] transition-colors">
            + custom
          </button>
        </div>
      )}
    </div>
  );
}

// ── Moderated Caucus Main ─────────────────────────────────────────────────────
function ModeratedCaucusMain({
  committee, setCommittee,
  speakerTimeRemaining, timerRunning,
  activePopover, setActivePopover, extraTimeAdded,
  handleToggleTimer, handleRestartTime, handleNextCaucusSpeaker, handleEndCaucus,
  sessionEnded,
}: {
  committee: Committee; setCommittee: CommitteeSetter;
  speakerTimeRemaining: number; timerRunning: boolean;
  activePopover: 'extraTime' | 'rightToReply' | null;
  setActivePopover: (v: 'extraTime' | 'rightToReply' | null) => void;
  extraTimeAdded: boolean;
  handleToggleTimer: () => void;
  handleRestartTime: () => void;
  handleNextCaucusSpeaker: () => Promise<void>;
  handleEndCaucus: () => void;
  sessionEnded: boolean;
}) {
  const { getSettings } = useSettingsStore();
  const caucus = committee.caucus!;
  const queue = committee.caucusQueue ?? [];
  const speakerTime = caucus.speakingTime;
  const isTdT = caucus.purpose?.startsWith('Tour de Table') ?? false;
  const isRoomOrderTdT = isTdT && (caucus.purpose?.includes('Room Order') ?? false);
  const caucusTitle = isTdT ? 'TOUR DE TABLE' : (getSettings(committee.code).motionNames?.moderated ?? 'Moderated Caucus').toUpperCase();
  const spokenCountries = caucus.spokenCountries ?? [];

  // Extend-time UI state
  const [showExtendMod, setShowExtendMod] = useState(false);
  const [extendMinsMod, setExtendMinsMod] = useState(1);
  const extendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExtendMod) return;
    const handler = (e: MouseEvent) => {
      if (extendRef.current && !extendRef.current.contains(e.target as Node)) setShowExtendMod(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExtendMod]);

  // Local live remaining-time — ticks in lockstep with speakerTimeRemaining.
  const [liveRemaining, setLiveRemaining] = useState(caucus.remainingTime);
  const liveRemainingRef = useRef(caucus.remainingTime);

  // Resync when DB remainingTime jumps by more than 2s (extend / external write).
  useEffect(() => {
    const drift = Math.abs(caucus.remainingTime - liveRemainingRef.current);
    if (drift > 2) {
      liveRemainingRef.current = caucus.remainingTime;
      setLiveRemaining(caucus.remainingTime);
    }
  }, [caucus.remainingTime]);

  // Tick total in lockstep with the speaker atom — one decrement per speaker tick.
  const lastSpeakerTickRef = useRef(speakerTimeRemaining);
  useEffect(() => {
    if (!timerRunning) { lastSpeakerTickRef.current = speakerTimeRemaining; return; }
    const delta = lastSpeakerTickRef.current - speakerTimeRemaining;
    lastSpeakerTickRef.current = speakerTimeRemaining;
    if (delta > 0) {
      setLiveRemaining((prev) => {
        const next = Math.max(0, prev - delta);
        liveRemainingRef.current = next;
        return next;
      });
    }
  }, [speakerTimeRemaining, timerRunning]);

  const speakTime2 = speakerTime > 0 ? speakerTime : 1;
  const remainingForMax = committee.caucus?.remainingTime ?? liveRemaining;
  const maxByTime = Math.floor(remainingForMax / speakTime2);
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
    addToCaucusListInDB(committee.id, delegateId, delegate.country, nextPosition);
  };

  const handleCaucusAddFirst = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const newList = [{ delegateId, country: delegate.country }, ...queue];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, 0);
    reorderSpeakersListInDB(committee.id, newList, 'caucus');
  };

  const handleCaucusAddLast = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const nextPosition = queue.length + 1;
    const newList = [...queue, { delegateId, country: delegate.country }];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, nextPosition);
  };

  const handleCaucusRemoveFromQueue = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
    removeFromCaucusListInDB(committee.id, delegateId);
  };

  const handleCaucusReorderQueue = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, 'caucus');
  };

  return (
    <>
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-3 overflow-hidden">
        {committee.caucus?.currentSpeaker ? (
          <>
            {/* Absolute overlay: motion name + topic — does not affect centred layout */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 max-w-[200px] pl-4 pointer-events-none select-none">
              <span className="text-[#1C1410] font-black text-2xl leading-tight uppercase">
                {committee.caucus?.motionLabel ?? caucusTitle}
              </span>
              {committee.caucus?.purpose && (
                <span className="text-[#1C1410]/70 text-lg font-medium leading-snug">
                  {committee.caucus.purpose}
                </span>
              )}
              {spokenCountries.length > 0 && (
                <span className="text-[#B6871F] text-lg font-medium leading-snug">
                  {spokenCountries.length} delegate{spokenCountries.length !== 1 ? 's' : ''} spoke
                </span>
              )}
            </div>
            {queue.length > 0 && (
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
                isRoomOrderTdT={isRoomOrderTdT}
              />
            )}
            <div className="flex flex-col items-center">
              {isRoomOrderTdT ? (
                <div className="relative w-36 h-36 rounded-full bg-[#DDD4C0] shrink-0 flex items-center justify-center">
                  <span className="text-6xl font-black text-[#B6871F]">{(() => {
                    const match = committee.caucus!.currentSpeaker?.match(/(\d+)$/);
                    return match ? match[1] : '?';
                  })()}</span>
                </div>
              ) : (
                <div className="relative shrink-0" style={{ width: '168px', height: '168px', borderRadius: '16px', overflow: 'hidden' }}>
                  {(() => {
                    const f = getCountryByName(committee.caucus!.currentSpeaker!);
                    return f
                      ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <Emoji size="5rem" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌐</Emoji>;
                  })()}
                </div>
              )}
              <h1 className="text-5xl font-black text-[#1C1410] mt-2 mb-1 text-center">{committee.caucus!.currentSpeaker}</h1>
              <div className={`text-8xl font-black font-mono mt-2 mb-3 tabular-nums ${
                speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'
              }`}>
                {formatTime(speakerTimeRemaining)}
                {extraTimeAdded && <span className="text-base ml-2 font-normal text-[#1C1410]">+time</span>}
              </div>
              <div className="w-full max-w-2xl h-2 bg-[#DDD4C0] rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${caucusProgress > 50 ? 'bg-[#B6871F]' : caucusProgress > 20 ? 'bg-[#B6871F]' : 'bg-red-500'}`} style={{ width: `${caucusProgress}%` }} />
              </div>
            </div>
            {!sessionEnded && (
              <div className="flex gap-2 w-full max-w-sm mt-1 flex-wrap justify-center">
                <button onClick={handleRestartTime} title="Restart speaker time"
                  className="px-3 py-3 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#C8BAA8] hover:border-[#1B3828] rounded-xl font-bold text-sm text-[#6A5A4A] transition-colors">
                  ↺
                </button>
                <button onClick={handleToggleTimer}
                  className={`flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none ${timerRunning ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}>
                  {timerRunning ? (
  <span className="flex items-center justify-center gap-2">
    <span className="flex gap-[3px] items-center">
      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
    </span>
    <span>PAUSE</span>
  </span>
) : '▶ START'}
                </button>
                <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                  className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] disabled:opacity-40 text-[#1C1410] py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none">
                  NEXT →
                </button>
                <button onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')} title="Add time"
                  className="px-3 py-2 border rounded-xl font-black text-[9px] uppercase tracking-wide transition-colors bg-[#EDE7D8] hover:bg-[#DDD4C0] border-[#DDD4C0] text-[#1B3828] leading-tight text-center w-[52px]">
                  ADD<br />TIME
                </button>
                {!isTdT && (
                  <button onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                    className="px-3 py-3 border rounded-xl font-black text-xs uppercase tracking-wide transition-colors bg-[#B8844A]/15 hover:bg-[#B8844A]/25 border-[#B8844A]/30 text-[#B8844A]">
                    Right to Reply
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Absolute overlay: motion name + topic — does not affect centred layout */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 max-w-[200px] pl-4 pointer-events-none select-none">
              <span className="text-[#1C1410] font-black text-2xl leading-tight uppercase">
                {committee.caucus?.motionLabel ?? caucusTitle}
              </span>
              {committee.caucus?.purpose && (
                <span className="text-[#1C1410]/70 text-lg font-medium leading-snug">
                  {committee.caucus.purpose}
                </span>
              )}
            </div>
            {queue.length > 0 && (
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
                isRoomOrderTdT={isRoomOrderTdT}
              />
            )}
            <h2 className="text-5xl font-black mb-3 text-center" style={{ color: '#1B3828' }}>No Current Speaker</h2>
            <p className="mb-4 text-center text-sm" style={{ color: '#9A8A78' }}>Add delegates below, then call the first speaker.</p>
            {!sessionEnded && (
              <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                CALL FIRST SPEAKER
              </button>
            )}
          </>
        )}
      </div>

      {!sessionEnded && (
        <div className="border-t border-[#DDD4C0] px-6 py-2" style={{ backgroundColor: '#F6F1E9' }}>
          {/* Total timer bar — hidden for Tour de Table */}
          {!isTdT && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-[#9A8A78] font-mono shrink-0">TOTAL</span>
              <p className={`text-lg font-black font-mono shrink-0 ${liveRemaining <= 30 ? 'text-red-500' : 'text-[#1C1410]'}`}>{formatTime(liveRemaining)}</p>
              <div className="flex-1 h-2 bg-[#DDD4C0] rounded-full overflow-hidden">
                <div className="h-full bg-[#B6871F]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
              </div>
              <div className="relative" ref={extendRef}>
                <button onClick={() => setShowExtendMod((v) => !v)}
                  className="px-3 py-2 rounded-lg font-bold text-xs bg-amber-900/30 hover:bg-amber-800/40 text-amber-400 hover:text-amber-300 transition-colors border border-amber-700/30 hover:border-amber-600/40">
                  Extend
                </button>
                {showExtendMod && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-3 shadow-xl flex items-center gap-2 flex-wrap z-20">
                    <span className="text-xs text-amber-400 font-semibold shrink-0">Add</span>
                    {(() => {
                      const halfMins = caucus.totalTime / 120;
                      const rawSuggestions = [5, 10, halfMins];
                      const suggestions = [...new Set(
                        rawSuggestions
                          .filter((m) => m > 0)
                          .map((m) => Math.round(m * 2) / 2)
                      )].sort((a, b) => a - b);
                      return suggestions.map((m) => (
                        <button key={m} onClick={() => {
                          const addSecs = m * 60;
                          updateLocal(setCommittee, (c) => {
                            if (!c.caucus) return c;
                            const newRemaining = c.caucus.remainingTime + addSecs;
                            const newTotal = c.caucus.totalTime + addSecs;
                            const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
                            updateCaucusInDB(committee.id, updated);
                            return { ...c, caucus: updated };
                          }, true);
                          setShowExtendMod(false);
                        }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900/30 hover:bg-amber-800/40 border border-amber-700/30 text-amber-300 transition-colors">
                          {m % 1 === 0 ? `${m}m` : `${m}m`}
                        </button>
                      ));
                    })()}
                    <input type="number" min={1} value={extendMinsMod} onChange={(e) => setExtendMinsMod(parseInt(e.target.value) || 1)}
                      className="w-10 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-xs text-center focus:outline-none" />
                    <span className="text-xs text-[#9A8A78]">m</span>
                    <button onClick={() => {
                      const addSecs = extendMinsMod * 60;
                      if (addSecs <= 0) return;
                      updateLocal(setCommittee, (c) => {
                        if (!c.caucus) return c;
                        const newRemaining = c.caucus.remainingTime + addSecs;
                        const newTotal = c.caucus.totalTime + addSecs;
                        const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
                        updateCaucusInDB(committee.id, updated);
                        return { ...c, caucus: updated };
                      }, true);
                      setShowExtendMod(false);
                    }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900/30 hover:bg-amber-800/40 border border-amber-700/30 text-amber-300 transition-colors shrink-0">
                      + Add
                    </button>
                  </div>
                )}
              </div>
              <button onClick={handleEndCaucus}
                className="px-8 py-3 rounded-lg font-black text-sm bg-[#8B2020] hover:bg-[#7A1C1C] text-white transition-colors">
                End Caucus
              </button>
            </div>
          )}
          <CaucusAddSpeakerInput
            committee={committee}
            spokenCountries={spokenCountries}
            onAdd={handleCaucusAddToQueue}
            onAddFirst={handleCaucusAddFirst}
            onAddLast={handleCaucusAddLast}
            maxSpeakers={maxByTime}
            currentQueueLength={queue.length}
            currentSpeakerCountry={committee.currentSpeaker?.country ?? null}
            onEndCaucus={isTdT ? handleEndCaucus : undefined}
          />
        </div>
      )}
    </>
  );
}

// ── Session Ended Content ─────────────────────────────────────────────────────
function SessionEndedContent({ committee, hoursRemaining }: { committee: Committee; hoursRemaining: number | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="mb-6"><Emoji size="3rem">🏁</Emoji></div>
      <h1 className="text-5xl font-black text-[#1C1410] mb-4">This committee has ended.</h1>
      <p className="text-xl text-[#6A5A4A] mb-2">{committee.name}</p>
      <p className="text-lg text-[#9A8A78] mb-8">{committee.topic}</p>
      {hoursRemaining !== null && (
        <p className="text-base text-[#9A8A78]">{hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''} until committee is deleted</p>
      )}
      <p className="text-xs text-[#9A8A78] mt-8">Press ESC to return to main menu</p>
    </div>
  );
}

// ── Main Chair Session ────────────────────────────────────────────────────────
function ChairSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { updateSetting, getSettings } = useSettingsStore();
  const searchParams = useSearchParams();
  const myChairName = searchParams.get('chairName') ?? '';
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [suspendTab, setSuspendTab] = useState<'suspend' | 'session'>('suspend');
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRollCall, setShowRollCall] = useState(true);
  const [showSliders, setShowSliders] = useState(false);
  const [showMotions, setShowMotions] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speakerTimeLimit, setSpeakerTimeLimitLocal] = useState(90);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatReadCount, setChatReadCount] = useState(0);
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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRunningRef = useRef(false);
  const committeeIdRef = useRef('');
  const committeePhaseRef = useRef('');
  const speakerTimeLimitRef = useRef(speakerTimeLimit);
  // Mutable map of delegateId → current status — updated immediately on each cycle
  // so rapid clicks read the post-click status, not the pre-re-render (stale) status.
  const delegateStatusRef = useRef<Map<string, DelegateStatus>>(new Map());
  timerRunningRef.current = timerRunning;
  speakerTimeLimitRef.current = speakerTimeLimit;
  committeePhaseRef.current = committee?.phase ?? '';

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} — Gavelling Session`;
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
          staleMotions.forEach((m) => removePendingMotionInDB(m.id));
          found.pendingMotions = (found.pendingMotions ?? []).filter(
            (m) => m.type !== 'suspend-debate' && m.type !== 'end-debate'
          );
        }
      }
      setCommittee(found ?? null);
      if (found) {
        setSpeakerTimeLimitLocal(found.speakerTimeLimit);
        setSpeakerTimeRemaining(found.speakerTimeRemaining);
        committeeIdRef.current = found.id;
        if (found.dbChairJoinSuffix) {
          updateSetting(found.code, 'chairJoinSuffix', found.dbChairJoinSuffix);
        }
        if (found.dbSeparateChairCode !== undefined) {
          updateSetting(found.code, 'separateChairCode', found.dbSeparateChairCode);
        }
      }
      setLoading(false);
      if (found) {
        unsubscribe = subscribeToCommittee(found.id, async (table) => {
          // Timer writes current_speaker every second — chair owns this entirely, never re-fetch.
          if (table === 'current_speaker') return;

          const withinDebounce = Date.now() - localUpdateTime.current < 3000;

          // Within debounce: structural tables (speakers_list, delegates) changed because
          // the chair just wrote them. Skip the fetch entirely — optimistic state is truth.
          // Only fetch for motion/session/document events where another actor may have written.
          if (withinDebounce) {
            if (table === 'speakers_list' || table === 'delegates') return;
            const updated = await getCommitteeByCode(code);
            if (!updated) return;
            setCommittee((prev) => {
              if (!prev) return prev;
              let next = { ...prev, pendingMotions: updated.pendingMotions };
              if (updated.endedAt) next = { ...next, endedAt: updated.endedAt, expiresAt: updated.expiresAt };
              if (updated.suspendedAt !== prev.suspendedAt) next = { ...next, suspendedAt: updated.suspendedAt, resumingChair: updated.resumingChair, phase: updated.phase };
              return next;
            });
            if (updated.endedAt) { setSessionEnded(true); setSessionSuspended(false); }
            else if (updated.suspendedAt) { setSessionSuspended(true); }
            else { setSessionSuspended(false); }
            return;
          }

          // Outside debounce: full update — another actor (delegate, co-chair) changed something.
          const updated = await getCommitteeByCode(code);
          if (!updated) return;
          if (updated.endedAt) {
            setSessionEnded(true);
          } else if (updated.suspendedAt) {
            setSessionSuspended(true);
          } else {
            setSessionEnded(false);
            setSessionSuspended(false);
          }
          setCommittee(updated);
          // Sync isolated timer atom only when local timer is not running
          if (!timerRunningRef.current) {
            if (updated.speakerStartedAt) {
              const elapsed = Math.round((Date.now() - new Date(updated.speakerStartedAt).getTime()) / 1000);
              setSpeakerTimeRemaining(Math.max(0, updated.speakerTimeLimit - elapsed));
            } else {
              setSpeakerTimeRemaining(updated.speakerTimeRemaining);
            }
          }
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  // Timer — isolated: only updates the speakerTimeRemaining atom, never the committee object.
  // This prevents whole-tree re-renders every second (S1).
  // tickSpeakerTimerInDB removed — DB is synced only at pause/next/expire (S2).
  useEffect(() => {
    if (timerRunning) {
      const tick = () => {
        setSpeakerTimeRemaining((prev) => {
          const next = Math.max(0, prev - 1);
          if (next === 0) setTimerRunning(false);
          return next;
        });
      };
      // Fire once immediately (fixes 1-second delay), then every 1000ms
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [timerRunning]);

  // Seed speaker timer atom to caucus speaking time on entry.
  useEffect(() => {
    if (committee?.phase === 'moderated-caucus' && committee.caucus) {
      setSpeakerTimeRemaining(committee.caucus.speakingTime);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.phase, committee?.caucus?.speakingTime]);

  // Sync caucus total timer with speaker atom — one tick per second while running.
  useEffect(() => {
    if (!timerRunning) return;
    if (committee?.phase !== 'moderated-caucus' || !committee.caucus) return;
    setCommittee((prev) => {
      if (!prev?.caucus || prev.phase !== 'moderated-caucus') return prev;
      const next = Math.max(0, prev.caucus.remainingTime - 1);
      if (next === 0) {
        updateCaucusInDB(prev.id, null);
        const preCaucusSpeaker = prev.currentSpeaker;
        const newSpeakersList = preCaucusSpeaker
          ? [preCaucusSpeaker, ...prev.speakersList.filter((s) => s.delegateId !== preCaucusSpeaker.delegateId)]
          : prev.speakersList;
        if (preCaucusSpeaker) reorderSpeakersListInDB(prev.id, newSpeakersList, 'gsl');
        return { ...prev, caucus: null, phase: 'speakers-list' as const, caucusQueue: [], currentSpeaker: null, speakersList: newSpeakersList };
      }
      return { ...prev, caucus: { ...prev.caucus, remainingTime: next } };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerTimeRemaining]);

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
    setDelegateStatusInDB(delegateId, next);
    if (next === 'absent' && committeePhaseRef.current !== 'pre-session') {
      removeFromSpeakersListInDB(committeeIdRef.current, delegateId);
      removeFromCaucusListInDB(committeeIdRef.current, delegateId);
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
    // Pass position from local state to skip the SELECT round-trip in the DB function,
    // keeping the write under the debounce window (Bug 1 fix)
    const nextPosition = committee.speakersList.length + 1;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: [...c.speakersList, { delegateId, country: delegate.country }] }), true);
    addToSpeakersListInDB(committee.id, delegateId, delegate.country, nextPosition);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.delegates, committee?.speakersList, committee?.currentSpeaker]);

  const handleRemoveFromSpeakersList = useCallback((delegateId: string) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId) }), true);
    removeFromSpeakersListInDB(committee.id, delegateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleReorderSpeakersList = useCallback((newList: { delegateId: string; country: string }[]) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, 'gsl');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleStatusChange = useCallback((delegateId: string, status: DelegateStatus) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status } : d),
      ...(status === 'absent' && c.phase !== 'pre-session' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, status);
    if (status === 'absent' && committee.phase !== 'pre-session') {
      removeFromSpeakersListInDB(committee.id, delegateId);
      removeFromCaucusListInDB(committee.id, delegateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.phase]);

  const handleDelegateAdd = useCallback(async (country: string) => {
    if (!committee) return;
    const { addDelegate: addDelegateInDB } = await import('@/lib/committeeService');
    const realId = await addDelegateInDB(committee.id, country);
    if (realId) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        delegates: [...c.delegates, { id: realId, country, status: 'absent' }],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  useEffect(() => {
    if (!sessionEnded && !sessionSuspended) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionEnded, sessionSuspended, router]);

  useEffect(() => {
    if (committee?.endedAt) {
      setSessionEnded(true);
      setSessionSuspended(false);
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
      setHoursRemaining(Math.max(0, Math.floor(ms / (1000 * 60 * 60))));
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [committee?.expiresAt]);

  if (loading) return <GavelLoader />;

  if (!committee) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="text-center">
          <p className="text-[#1C1410] text-xl font-bold mb-4">Committee not found</p>
          <Link href="/create" className="bg-[#1B3828] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#2A5A3C] transition-colors">Create Committee</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const progress = committee.currentSpeaker ? (speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;
  const isPreSession = committee.phase === 'pre-session';

  // ── Quorum enforcement ──────────────────────────────────────────────────────
  const settings = getSettings(committee.code);
  const presentCount = committee.delegates.filter((d) => d.status !== 'absent').length;
  const totalCount = committee.delegates.length;
  const quorumMap: Record<string, number> = { 'none': 0, '1-4': 1 / 4, '1-3': 1 / 3, '1-2': 1 / 2 };
  const quorumFraction = quorumMap[settings.quorumThreshold ?? 'none'] ?? 0;
  const belowQuorum = quorumFraction > 0 && totalCount > 0 && (presentCount / totalCount) < quorumFraction;

  // ── Optimistic action handlers ──────────────────────────────────────────────

  const handleNextSpeaker = async () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);

    if (committee.currentSpeaker) {
      const secondsSpoken = committee.speakerTimeLimit - speakerTimeRemaining;
      if (secondsSpoken > 0) {
        const ctx = committee.phase === 'moderated-caucus' ? 'moderated-caucus' : 'speakers-list';
        const topic = committee.phase === 'moderated-caucus'
          ? (committee.caucus?.purpose ?? committee.topic)
          : committee.topic;
        logSpeakingTime(committee.id, committee.currentSpeaker.country, secondsSpoken, ctx, topic);
      }
    }

    const removeDelegateId = committee.speakersList[0]?.delegateId ?? null;
    const [next, ...rest] = committee.speakersList;
    const timeToUse = speakerTimeLimit;

    setSpeakerTimeRemaining(timeToUse);

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
    );
    localUpdateTime.current = Date.now();
  };

  const handleAddExtraTime = (secs: number) => {
    setSpeakerTimeRemaining((prev) => prev + secs);
    setExtraTimeAdded(true);
    setActivePopover(null);
    setExtraTimeSecs('');
  };

  const handleToggleTimer = () => {
    if (belowQuorum) return;
    const starting = !timerRunning;
    setTimerRunning(starting);
    if (starting) {
      startSpeakerTimerInDB(committeeIdRef.current);
    } else {
      // Sync current remaining time to DB on pause (S2 — no per-second writes)
      stopSpeakerTimerInDB(committeeIdRef.current);
      syncSpeakerTimeInDB(committeeIdRef.current, speakerTimeRemaining);
    }
  };

  const handleRestartTime = () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);
    if (committee?.phase === 'moderated-caucus' && committee.caucus) {
      const speakTime = committee.caucus.speakingTime;
      const spentSeconds = Math.max(0, speakTime - speakerTimeRemaining);
      const newRemainingTime = committee.caucus.remainingTime + spentSeconds;
      setSpeakerTimeRemaining(speakTime);
      // Ensure current speaker is in spokenCountries so a realtime echo cannot re-add them to the queue
      const currentCountry = committee.currentSpeaker?.country ?? null;
      const prevSpoken = committee.caucus.spokenCountries ?? [];
      const newSpoken = currentCountry && !prevSpoken.includes(currentCountry)
        ? [...prevSpoken, currentCountry]
        : prevSpoken;
      const updated = { ...committee.caucus, speakerTimeRemaining: speakTime, remainingTime: newRemainingTime, spokenCountries: newSpoken };
      updateLocal(setCommittee, (c) => ({ ...c, caucus: updated }), true);
      updateCaucusInDB(committee.id, updated);
    } else {
      setSpeakerTimeRemaining(speakerTimeLimit);
    }
  };

  const handleNextCaucusSpeaker = async () => {
    if (!committee.caucus) return;
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);

    // Compute everything from current snapshot BEFORE any state updates
    const queue = committee.caucusQueue ?? [];
    const [next, ...rest] = queue;
    const speakTime = committee.caucus.speakingTime;
    const prevCountry = committee.currentSpeaker?.country ?? null;
    const spentOnCurrent = Math.max(0, speakTime - speakerTimeRemaining);
    const newRemaining = committee.caucus.remainingTime;
    const newSpoken = prevCountry && !(committee.caucus.spokenCountries ?? []).includes(prevCountry)
      ? [...(committee.caucus.spokenCountries ?? []), prevCountry]
      : (committee.caucus.spokenCountries ?? []);

    if (prevCountry && spentOnCurrent > 0) {
      logSpeakingTime(
        committee.id,
        prevCountry,
        spentOnCurrent,
        'moderated-caucus',
        committee.caucus.purpose ?? committee.topic,
      );
    }

    setSpeakerTimeRemaining(speakTime);
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
      updateCaucusInDB(committee.id, null);
      await nextSpeakerInDB(committee.id, speakTime, null, null, null);
      localUpdateTime.current = Date.now();
      return;
    }

    const updatedCaucus = {
      ...committee.caucus,
      currentSpeaker: next?.country ?? null,
      speakerTimeRemaining: speakTime,
      remainingTime: newRemaining,
      spokenCountries: newSpoken,
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
    updateCaucusInDB(committee.id, updatedCaucus);
    await nextSpeakerInDB(
      committee.id,
      speakTime,
      next?.delegateId ?? null,
      next?.country ?? null,
      null,
    );
    localUpdateTime.current = Date.now();
  };

  const handleEndCaucus = () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    updateCaucusInDB(committee.id, null);
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucus: null,
      phase: 'speakers-list' as const,
      caucusQueue: [],
      currentSpeaker: null,
      speakerTimeRemaining: c.speakerTimeLimit,
    }), true);
    setSpeakerTimeRemaining(committee.speakerTimeLimit);
  };

  const handleSetSpeakerTimeLimit = (seconds: number) => {
    setSpeakerTimeLimitLocal(seconds);
    setSpeakerTimeRemaining(seconds);
    updateLocal(setCommittee, (c) => ({ ...c, speakerTimeLimit: seconds, speakerTimeRemaining: seconds }));
  };

  const handleResumeSession = () => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' }));
    setPhaseInDB(committee.id, 'speakers-list');
  };

  const handleResumeClick = async () => {
    if (!committee) return;
    const claimedName = myChairName || committee.chairNames[0] || 'Chair';
    const claimed = await claimResumeSessionInDB(committee.id, claimedName);
    if (!claimed) return;
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'pre-session', suspendedAt: null }));
    setSessionSuspended(false);
    await startResumeRollCallInDB(committee.id);
  };

  const handlePhaseChange = (phase: string) => {
    updateLocal(setCommittee, (c) => {
      let updated = { ...c, phase: phase as Committee['phase'] };
      if (phase === 'speakers-list' && c.phase === 'pre-session') {
        const absentIds = new Set(c.delegates.filter((d) => d.status === 'absent').map((d) => d.id));
        const toRemove = c.speakersList.filter((s) => absentIds.has(s.delegateId));
        updated.speakersList = c.speakersList.filter((s) => !absentIds.has(s.delegateId));
        toRemove.forEach((s) => removeFromSpeakersListInDB(c.id, s.delegateId));
      }
      return updated;
    }, true);
  };

  const handleApproveJoinRequest = async (motionId: string, delegateId: string, desiredStatus: 'present' | 'present-voting') => {
    await approveJoinRequest(committee.id, motionId, delegateId, desiredStatus);
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status: desiredStatus } : d),
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleDenyJoinRequest = async (motionId: string) => {
    await denyJoinRequest(motionId);
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleApproveGslRequest = async (motionId: string, delegateId: string, country: string) => {
    await approveGslRequest(committee.id, motionId, delegateId, country);
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    updateLocal(setCommittee, (c) => ({
      ...c,
      speakersList: [...c.speakersList, { delegateId, country }],
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleDenyGslRequest = async (motionId: string) => {
    await denyGslRequest(motionId);
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const isLastGSLSpeaker = committee.speakersList.length === 0;

  // Blocked modal handler — only allow after roll call
  const handleMotionsClick = () => {
    if (isPreSession) return;
    setShowMotions((v) => !v);
  };
  const handleDocumentsClick = () => {
    if (isPreSession) return;
    setShowDocuments((v) => !v);
  };
  const handleToggleChat = () => {
    const newShow = !showChat;
    setShowChat(newShow);
    if (newShow) setChatReadCount(committee?.messages.filter(m => !m.content.startsWith('__log__:')).length ?? 0);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-2">
        <Link href="/">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[14vw] h-auto max-h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>

        {committee.phase !== 'pre-session' && !sessionEnded ? (
          <div className="flex flex-1 min-w-0 h-full items-center">
            <button onClick={() => setShowSliders((v) => !v)}
              className="flex-1 text-[18px] px-3 relative h-full transition-all duration-200"
              style={{ color: showSliders ? '#1B3828' : 'rgba(28,20,16,0.55)', backgroundColor: showSliders ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showSliders ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showSliders) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showSliders) { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(28,20,16,0.55)'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              Roll Call
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showSliders ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button onClick={handleMotionsClick}
              className="flex-1 text-[18px] px-3 relative h-full transition-all duration-200"
              style={{ color: showMotions ? '#1B3828' : 'rgba(28,20,16,0.55)', backgroundColor: showMotions ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showMotions ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showMotions) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showMotions) { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(28,20,16,0.55)'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              Motions
              {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">
                  {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length}
                </span>
              )}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showMotions ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button onClick={handleDocumentsClick}
              className="flex-1 text-[18px] px-3 relative h-full transition-all duration-200"
              style={{ color: showDocuments ? '#1B3828' : 'rgba(28,20,16,0.55)', backgroundColor: showDocuments ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showDocuments ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showDocuments) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showDocuments) { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(28,20,16,0.55)'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              Documents
              {(() => { const n = (committee.documents ?? []).filter((d) => d.status === 'submitted').length; return n > 0 ? <span className="absolute top-1 right-1 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">{n}</span> : null; })()}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showDocuments ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(28,20,16,0.2)', margin: '0 2px', flexShrink: 0 }} />
            <button onClick={() => { if (!isPreSession) handleToggleChat(); }}
              className="flex-1 text-[18px] px-3 relative h-full transition-all duration-200"
              style={{ color: showChat ? '#1B3828' : 'rgba(28,20,16,0.55)', backgroundColor: showChat ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: showChat ? 900 : 700 }}
              onMouseEnter={(e) => { if (!showChat) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { if (!showChat) { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(28,20,16,0.55)'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
              Chat
              {(() => { const unread = committee.messages.filter((m) => !m.content.startsWith('__log__:')).length - chatReadCount; return unread > 0 && !showChat ? <span className="absolute top-1 right-1 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">{unread}</span> : null; })()}
              <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: showChat ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
            </button>
          </div>
        ) : (
          <span className="text-[#9A8A78] text-xs hidden sm:block truncate flex-1">{committee.name} — {committee.topic}</span>
        )}


        <button onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] px-2.5 py-1 rounded-lg transition-colors shrink-0">
          {copied ? '✓' : committee.code}
        </button>
        <button onClick={() => setShowSettings(true)} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors shrink-0 text-3xl">⚙</button>
      </header>
      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
          <button onClick={() => setEndedTab('ended')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'ended' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            🏁 End View
          </button>
          <button onClick={() => setEndedTab('session')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'session' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            👁 Session View
          </button>
        </div>
      )}
      {/* Suspend tab bar */}
      {!sessionEnded && sessionSuspended && (
        <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
          <button onClick={() => setSuspendTab('suspend')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${suspendTab === 'suspend' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            ⏸ Suspend View
          </button>
          <button onClick={() => setSuspendTab('session')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${suspendTab === 'session' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            🪑 Session View
          </button>
        </div>
      )}
      {sessionEnded && endedTab === 'session' && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-700/40 px-4 py-2 text-center text-amber-300 text-sm font-semibold">
          Session has ended — view only
        </div>
      )}
      {!sessionEnded && sessionSuspended && suspendTab === 'session' && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-700/40 px-4 py-2 text-center text-amber-300 text-sm font-semibold">
          Session is suspended — delegates cannot see this view
        </div>
      )}
      {/* Join request banner */}
      {(committee.pendingMotions ?? []).filter((m) => m.type === ('join-request' as string)).length > 0 && (
        <div className="shrink-0 bg-[#EDE7D8] border-b border-[#1B3828]/40 px-4 py-2 flex flex-wrap gap-4">
          {(committee.pendingMotions ?? [])
            .filter((m) => m.type === ('join-request' as string))
            .map((m) => {
              let delegateId = '';
              let desiredStatus: 'present' | 'present-voting' = 'present';
              try { const parsed = JSON.parse(m.topic); delegateId = parsed.delegateId; desiredStatus = parsed.desiredStatus; } catch {}
              const found = getCountryByName(m.proposedBy);
              const flagEl = found
                ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : <Emoji size="1.125rem">🌐</Emoji>;
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#B6871F] font-bold shrink-0">🚪 Join Request</span>
                  <span className="font-mono text-lg">{flagEl}</span>
                  <span className="text-[#1C1410] font-semibold">{m.proposedBy}</span>
                  <span className="text-[#6A5A4A] text-xs">wants to join as</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${desiredStatus === 'present-voting' ? 'bg-[#1B3828]/40 text-[#EED98A]' : 'bg-[#1B3828]/50 text-[#EED98A]'}`}>
                    {desiredStatus === 'present-voting' ? 'P+V' : 'P'}
                  </span>
                  <button onClick={() => handleApproveJoinRequest(m.id, delegateId, desiredStatus)}
                    className="ml-2 px-3 py-1 bg-[#1B3828]/50 hover:bg-[#2A5A3C]/60 border border-[#3D7A52]/40 text-[#EED98A] text-xs rounded-lg font-semibold transition-colors">Approve</button>
                  <button onClick={() => handleDenyJoinRequest(m.id)}
                    className="px-3 py-1 bg-[#8B2020]/20 hover:bg-[#7A1C1C]/40 border border-[#8B2020]/40 text-[#8B2020] text-xs rounded-lg font-semibold transition-colors">Deny</button>
                </div>
              );
            })}
        </div>
      )}
      {/* GSL speak request banner */}
      {(committee.pendingMotions ?? []).filter((m) => (m.type as string) === 'gsl-request').length > 0 && (
        <div className="shrink-0 bg-[#1B3828] border-b border-[#3D7A52]/40 px-4 py-2 flex flex-wrap gap-4">
          {(committee.pendingMotions ?? [])
            .filter((m) => (m.type as string) === 'gsl-request')
            .map((m) => {
              let delegateId = '';
              try { const parsed = JSON.parse(m.topic); delegateId = parsed.delegateId; } catch {}
              const found = getCountryByName(m.proposedBy);
              const flagEl = found
                ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : <Emoji size="1.125rem">🌐</Emoji>;
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#EED98A] font-bold shrink-0">🎙️ GSL Request</span>
                  <span className="font-mono text-lg">{flagEl}</span>
                  <span className="text-[#1C1410] font-semibold">{m.proposedBy}</span>
                  <span className="text-[#6A5A4A] text-xs">wants to speak</span>
                  <button onClick={() => handleApproveGslRequest(m.id, delegateId, m.proposedBy)}
                    className="ml-2 px-3 py-1 bg-[#1B3828]/50 hover:bg-[#2A5A3C]/60 border border-[#3D7A52]/40 text-[#EED98A] text-xs rounded-lg font-semibold transition-colors">Add to GSL</button>
                  <button onClick={() => handleDenyGslRequest(m.id)}
                    className="px-3 py-1 bg-[#8B2020]/20 hover:bg-[#7A1C1C]/40 border border-[#8B2020]/40 text-[#8B2020] text-xs rounded-lg font-semibold transition-colors">Deny</button>
                </div>
              );
            })}
        </div>
      )}
      {sessionEnded && endedTab === 'ended' ? (
        <SessionEndedContent committee={committee} hoursRemaining={hoursRemaining} />
      ) : (!sessionEnded && sessionSuspended && suspendTab === 'suspend') ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          {(() => {
            const anotherChairResuming = committee.resumingChair && committee.resumingChair !== (myChairName || committee.chairNames[0]);
            return (
              <>
                <div className="text-5xl mb-6">⏸️</div>
                <h1 className="text-5xl font-black text-[#1C1410] mb-4">Session Adjourned</h1>
                <p className="text-xl text-[#6A5A4A] mb-12">This session has been temporarily suspended.</p>
                {anotherChairResuming ? (
                  <>
                    <button disabled className="px-12 py-5 bg-[#DDD4C0] text-[#9A8A78] text-xl font-black rounded-2xl cursor-not-allowed">
                      Resume Session
                    </button>
                    <p className="text-sm text-[#B6871F] mt-4">{committee.resumingChair} is resuming the session…</p>
                  </>
                ) : (
                  <button
                    onClick={handleResumeClick}
                    className="px-12 py-5 bg-[#1B3828] hover:bg-[#2A5A3C] text-white text-xl font-black rounded-2xl transition-colors">
                    Resume Session
                  </button>
                )}
                <p className="text-xs text-[#9A8A78] mt-8">Press ESC to return to main menu</p>
              </>
            );
          })()}
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {showChat && !sessionEnded && (
          <ChatPanel
            committee={committee}
            senderName={committee.chairNames[0] ?? 'Chair'}
            isChair={true}
            onClose={() => setShowChat(false)}
            readOnly={sessionEnded}
          />
        )}
        {!showChat && committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md rounded-2xl overflow-hidden relative" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1B3828', border: '1.5px solid #3D7A52', boxShadow: '0 32px 80px rgba(27,56,40,0.40)' }}>
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
                isReadOnly={sessionEnded} />
            </div>
          </div>
        )}
        {!showChat && committee.phase !== 'pre-session' && (
          <>
            {showRollCall && (
              <aside className="w-[22rem] flex flex-col overflow-hidden shrink-0" style={{ backgroundColor: '#1B3828', borderRight: '1px solid #3D7A52' }}>
                {caucusMaxReachedMsg && (
                  <div className="shrink-0 px-3 py-2 bg-amber-900/20 border-b border-amber-700/40 text-amber-300 text-xs text-center font-semibold">
                    Maximum speakers reached — add more delegates if time remains after current speakers.
                  </div>
                )}
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
                      addToCaucusListInDB(committee.id, delegateId, delegate.country, inlinePos);
                    }}
                    onListIds={caucusQueueIds}
                    onRemoveFromList={(delegateId) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
                      removeFromCaucusListInDB(committee.id, delegateId);
                    }}
                    onReorderList={(newList) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
                      reorderSpeakersListInDB(committee.id, newList, 'caucus');
                    }}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={showSliders}
                    isReadOnly={sessionEnded} />
                ) : (committee.phase === 'unmoderated-caucus' && committee.caucus) ? (
                  <RollCallPanel committee={committee}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={showSliders}
                    showViewToggle={false}
                    isReadOnly={sessionEnded} />
                ) : (
                  <RollCallPanel committee={committee}
                    onAddToList={handleAddToSpeakersList}
                    onListIds={gslListIds}
                    onRemoveFromList={handleRemoveFromSpeakersList}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onPhaseChange={handlePhaseChange}
                    onDelegateAdd={handleDelegateAdd}
                    onReorderList={handleReorderSpeakersList}
                    isRollCallPhase={showSliders}
                    isReadOnly={sessionEnded} />
                )}
              </aside>
            )}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                caucusLoading ? (() => {
                  const isTdTParent = committee.caucus?.purpose?.startsWith('Tour de Table') ?? false;
                  return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="bg-[#EDE7D8] border border-[#1B3828]/40 rounded-3xl px-12 py-10 max-w-lg w-full shadow-2xl">
                      {isTdTParent ? (
                        <>
                          <div className="mb-5"><Emoji size="3rem">🔄</Emoji></div>
                          <p className="text-xs font-mono text-[#9A8A78] tracking-widest mb-3">TOUR DE TABLE STARTING</p>
                          <h1 className="text-3xl font-black text-[#1C1410] mb-2">Tour de Table</h1>
                          <p className="text-[#6A5A4A] text-sm mb-6">
                            {committee.caucus.purpose?.includes('Room Order')
                              ? 'Room Order — chair calls each speaker'
                              : committee.caucus.purpose?.includes('Z→A') ? 'Z → A order' : 'A → Z order, proposer speaks first'}
                          </p>
                          <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">
                                {committee.caucusQueue?.length ?? Math.floor(committee.caucus.totalTime / (committee.caucus.speakingTime || 1))}
                              </div>
                              <div className="text-xs text-[#9A8A78] mt-1">Delegates</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">{committee.caucus.speakingTime}s</div>
                              <div className="text-xs text-[#9A8A78] mt-1">Per Speaker</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">{formatTime(committee.caucus.totalTime)}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">Total Time</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                            <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                            <span>Setting up speakers...</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-5"><Emoji size="3rem">🎙️</Emoji></div>
                          <p className="text-xs font-mono text-[#9A8A78] tracking-widest mb-3">MODERATED CAUCUS STARTING</p>
                          <h1 className="text-3xl font-black text-[#1C1410] mb-2">{committee.caucus.purpose || 'Moderated Caucus'}</h1>
                          <p className="text-[#6A5A4A] text-sm mb-6">{committee.topic}</p>
                          <div className="flex justify-center gap-8 mb-8">
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">{formatTime(committee.caucus.totalTime)}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">Total Time</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">{committee.caucus.speakingTime}s</div>
                              <div className="text-xs text-[#9A8A78] mt-1">Per Speaker</div>
                            </div>
                            <div className="w-px bg-[#DDD4C0]" />
                            <div className="text-center">
                              <div className="text-2xl font-black text-[#B6871F]">{Math.floor(committee.caucus.totalTime / (committee.caucus.speakingTime || 1))}</div>
                              <div className="text-xs text-[#9A8A78] mt-1">Max Speakers</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                            <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                            <span>Loading caucus...</span>
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
                    activePopover={activePopover}
                    setActivePopover={setActivePopover}
                    extraTimeAdded={extraTimeAdded}
                    handleToggleTimer={handleToggleTimer}
                    handleRestartTime={handleRestartTime}
                    handleNextCaucusSpeaker={handleNextCaucusSpeaker}
                    handleEndCaucus={handleEndCaucus}
                    sessionEnded={sessionEnded}
                  />
                )
              )}
              {committee.phase === 'unmoderated-caucus' && committee.caucus && (
                unmodLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="bg-[#EDE7D8] border border-[#DDD4C0]/40 rounded-3xl px-12 py-10 max-w-lg w-full shadow-2xl">
                      <div className="text-5xl mb-5">
                        {committee.caucus.motionLabel?.includes('Consultation') ? '🤝' : '💬'}
                      </div>
                      <p className="text-xs font-mono text-[#9A8A78] tracking-widest mb-3">
                        {(committee.caucus.motionLabel ?? 'UNMODERATED CAUCUS').toUpperCase()} STARTING
                      </p>
                      <h1 className="text-3xl font-black text-[#1C1410] mb-2">
                        {committee.caucus.motionLabel ?? 'Unmoderated Caucus'}
                      </h1>
                      {committee.caucus.purpose && (
                        <p className="text-[#6A5A4A] text-sm mb-6">{committee.caucus.purpose}</p>
                      )}
                      <div className="flex justify-center gap-8 mb-8">
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#B6871F]">{formatTime(committee.caucus.totalTime)}</div>
                          <div className="text-xs text-[#9A8A78] mt-1">Total Time</div>
                        </div>
                        <div className="w-px bg-[#DDD4C0]" />
                        <div className="text-center">
                          <div className="text-2xl font-black text-[#B6871F]">{committee.caucus.proposedBy}</div>
                          <div className="text-xs text-[#9A8A78] mt-1">Proposed by</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-[#9A8A78] text-sm">
                        <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                        <span>Starting caucus...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} />
                )
              )}

{committee.phase === 'speakers-list' && (
                <>
                <div className="flex-1 flex flex-row overflow-hidden">
                  {/* GSL content area — overflow-hidden is intentional. Never use overflow-y-auto here:
                      it creates a scroll context that causes browser scrollbars to appear, cutting off
                      the flag queue at top and the Right of Reply button at bottom. */}
                  <div className="flex-1 flex flex-col items-center justify-center px-4 pt-2 pb-16 overflow-hidden">
                    {committee.currentSpeaker ? (
                      <>
                        {(() => {
                          const gslDisplayList = [
                            { delegateId: committee.currentSpeaker.delegateId, country: committee.currentSpeaker.country },
                            ...committee.speakersList,
                          ];
                          return (
                            <DraggableSpeakersQueue
                              list={gslDisplayList}
                              currentSpeakerDelegateId={committee.currentSpeaker.delegateId}
                              onReorder={(newList) => handleReorderSpeakersList(newList.filter((s) => s.delegateId !== committee.currentSpeaker!.delegateId))}
                              onRemove={handleRemoveFromSpeakersList}
                            />
                          );
                        })()}
                        <div className="flex flex-col items-center">
                          {/* Current speaker flag */}
                          <div className="relative shrink-0" style={{ width: '168px', height: '168px', borderRadius: '16px', overflow: 'hidden' }}>
                            {(() => {
                              const f = getCountryByName(committee.currentSpeaker.country);
                              return f
                                ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                : <Emoji size="5rem" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌐</Emoji>;
                            })()}
                          </div>
                          <h1 className="text-5xl font-black text-[#1C1410] mt-2 mb-1 text-center">{committee.currentSpeaker.country}</h1>
                          <div className={`text-8xl font-black font-mono mt-2 mb-3 tabular-nums ${
                            speakerTimeRemaining <= 10 ? 'text-[#B8844A]' : 'text-[#1C1410]'
                          }`}>
                            {formatTime(speakerTimeRemaining)}
                            {extraTimeAdded && <span className="text-base ml-2 font-normal text-[#1C1410]">+time</span>}
                          </div>
                          <div className="w-full max-w-2xl h-2 bg-[#DDD4C0] rounded-full overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all ${progress > 20 ? 'bg-[#B6871F]' : 'bg-[#B8844A]'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        {isLastGSLSpeaker && (
                          <div className="mb-2 px-4 py-2 bg-[#B6871F]/10 border border-[#B6871F]/30 rounded-lg text-[#B6871F] text-xs text-center">
                            Add at least one more delegate before starting — the GSL can never be empty.
                          </div>
                        )}
                        {!sessionEnded && (
                        <div className="flex gap-2 w-full max-w-sm mt-1 flex-wrap justify-center">
                          {/* Restart button */}
                          <button onClick={handleRestartTime}
                            title="Restart time"
                            className="px-3 py-3 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#C8BAA8] hover:border-[#1B3828] rounded-xl font-bold text-sm text-[#6A5A4A] transition-colors">
                            ↺
                          </button>
                          {/* Start/Pause */}
                          <button onClick={handleToggleTimer}
                            disabled={isLastGSLSpeaker}
                            className={`flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none ${
                              timerRunning ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' :
                              isLastGSLSpeaker ? 'bg-[#DDD4C0] text-[#9A8A78] cursor-not-allowed' :
                              'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
                            }`}>
                            {timerRunning ? (
  <span className="flex items-center justify-center gap-2">
    <span className="flex gap-[3px] items-center">
      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
      <span className="w-[3px] h-[13px] rounded-sm bg-current inline-block" />
    </span>
    <span>PAUSE</span>
  </span>
) : '▶ START'}
                          </button>
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length === 0}
                            className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] disabled:opacity-40 text-[#1C1410] py-3 px-6 rounded-xl font-bold text-base transition-colors focus:outline-none">
                            NEXT →
                          </button>
                          {/* Add Time button */}
                          <button
                            onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')}
                            title="Add time"
                            className="px-3 py-2 border rounded-xl font-black text-[9px] uppercase tracking-wide transition-colors bg-[#EDE7D8] hover:bg-[#DDD4C0] border-[#DDD4C0] text-[#1B3828] leading-tight text-center w-[52px]">
                            ADD<br />TIME
                          </button>
                          {/* Right of Reply button */}
                          <button
                            onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                            className="px-3 py-3 border rounded-xl font-black text-xs uppercase tracking-wide transition-colors bg-[#B8844A]/15 hover:bg-[#B8844A]/25 border-[#B8844A]/30 text-[#B8844A]">
                            Right to Reply
                          </button>
                        </div>
                        )}
                      </>
                    ) : (
                      <>
                        {committee.speakersList.length > 0 && (
                          <DraggableSpeakersQueue
                            list={committee.speakersList}
                            onReorder={handleReorderSpeakersList}
                            onRemove={handleRemoveFromSpeakersList}
                          />
                        )}
                        <h2 className="text-5xl font-black mb-3 text-center" style={{ color: '#1B3828' }}>No Current Speaker</h2>
                        <p className="mb-4 text-center text-sm" style={{ color: '#9A8A78' }}>Add delegates below, then call the first speaker.</p>
                        {committee.speakersList.length === 1 && (
                          <div className="mb-4 px-4 py-2 bg-[#B6871F]/10 border border-[#B6871F]/30 rounded-lg text-[#B6871F] text-xs text-center">
                            Only 1 delegate on the list — add more before starting.
                          </div>
                        )}
                        {!sessionEnded && (
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length < 2}
                            className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                            CALL FIRST SPEAKER
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>{/* end flex-row */}
                {!sessionEnded && (
                <div className="border-t border-[#DDD4C0] px-6 py-2" style={{ backgroundColor: '#F6F1E9' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-[#9A8A78] font-mono shrink-0">TIME</span>
                    <div className="flex gap-1.5">
                      {[30, 60, 90, 120, 180].map((t) => (
                        <button key={t} onClick={() => handleSetSpeakerTimeLimit(t)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-semibold ${speakerTimeLimit === t ? 'bg-[#1B3828] text-white' : 'bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                      <input type="number" value={speakerTimeLimit}
                        onChange={(e) => handleSetSpeakerTimeLimit(parseInt(e.target.value) || 90)}
                        className="w-14 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-xs focus:outline-none" />
                    </div>
                  </div>
                  {belowQuorum && (
                    <p className="text-xs text-[#8B2020] text-center py-2">
                      ⚠️ Below quorum — speakers cannot be added until {Math.ceil(quorumFraction * totalCount)} delegates are present.
                    </p>
                  )}
                  <AddSpeakerInput committee={committee} onAdd={belowQuorum ? () => {} : handleAddToSpeakersList} />
                </div>
                )}
                </>
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
        />
      )}
      {showDocuments && !isPreSession && !sessionEnded && (
        <DocumentsModal
          committee={committee}
          onClose={() => setShowDocuments(false)}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater, true)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          committee={committee}
          onClose={() => setShowSettings(false)}
        />
      )}
      {/* EXTRA TIME OVERLAY — fixed position, same anchor as RTR overlay */}
      {!sessionEnded && activePopover === 'extraTime' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#EDE7D8] border border-[#3D7A52]/40 rounded-xl p-3 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#1B3828' }}>ADD TIME</span>
              <button onClick={() => setActivePopover(null)} className="text-[#1C1410] hover:text-[#8B2020] text-sm font-bold">✕</button>
            </div>
            <div className="flex gap-2 mb-2">
              {[15, 30, 60].map((s) => (
                <button key={s} onClick={() => { handleAddExtraTime(s); setActivePopover(null); }}
                  className="flex-1 py-2 bg-[#EDE7D8] hover:bg-[#1B3828] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1B3828] hover:text-[#EED98A] text-xs rounded-lg font-black uppercase tracking-wide transition-colors">
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
                placeholder="Custom sec…"
                style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 text-[#1C1410] text-xs focus:outline-none focus:border-[#1B3828] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => { const n = parseInt(extraTimeSecs); if (n > 0) { handleAddExtraTime(n); setActivePopover(null); } }}
                disabled={!extraTimeSecs || parseInt(extraTimeSecs) <= 0}
                className="px-3 py-1.5 bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 text-[#EED98A] text-xs rounded-lg font-black transition-colors">
                ADD
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RTR OVERLAY — fixed position, completely outside document flow.
          Never render this inside any flex/grid container — it must not
          affect the layout of the GSL centre column in any way. */}
      {activePopover === 'rightToReply' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#EDE7D8] border border-[#B8844A]/30 rounded-xl p-4 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#B8844A' }}>RIGHT TO REPLY</span>
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
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors border ${
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
                    setRtrTimeRemaining(rtrSeconds);
                    setRtrTimerActive(false);
                    setRtrOpen(true);
                  }}
                  disabled={!rtrCountry}
                  className="w-full py-2 bg-[#B8844A] hover:bg-[#B8844A]/80 disabled:opacity-40 disabled:cursor-not-allowed text-[#1C1410] text-xs rounded-lg font-black uppercase tracking-wide transition-colors"
                >
                  GRANT
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
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#B8844A' }}>RIGHT TO REPLY</span>
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
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                      rtrTimerActive ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
                    }`}
                  >
                    {rtrTimerActive ? '⏸ Pause' : '▶ Start'}
                  </button>
                  <button
                    onClick={() => {
                      setRtrTimerActive(false);
                      setRtrOpen(false);
                      setRtrCountry('');
                      setRtrTimeRemaining(rtrSeconds);
                      setActivePopover(null);
                    }}
                    className="px-3 py-2 rounded-lg font-bold text-xs bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#6A5A4A] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<GavelLoader />}>
      <ChairSessionInner params={params} />
    </Suspense>
  );
}
