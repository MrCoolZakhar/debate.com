'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { getFlagUrl, getCountryByName, getCountryDisplayName, UN_COUNTRIES, matchesCountryQuery, startsWithCountryQuery, compareCountryNames } from '@/lib/countries';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import {
  setPhase as setPhaseInDB,
  setDelegateObserver as setDelegateObserverInDB,
} from '@/lib/committeeService';
import { liveCaucus } from '@/components/FeedbackLogPanel';
import { Megaphone } from 'lucide-react';
import { useLanguage, useT } from '@/contexts/LanguageContext';

// ── FlagCircle ────────────────────────────────────────────────────────────────
export function FlagCircle({ country, size = 'md' }: { country: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' }) {
  const found = getCountryByName(country);
  const dim: Record<string, string> = {
    xs:   'w-7 h-7',
    sm:   'w-9 h-9',
    md:   'w-12 h-12',
    lg:   'w-14 h-14',
    xl:   'w-20 h-20',
    hero: 'w-60 h-60',
  };
  const box = dim[size];
  return (
    <div className={`relative ${box} rounded-full overflow-hidden shrink-0 flex items-center justify-center`} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      {found
        ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-[85%] h-[85%] object-contain" style={{ border: '1.5px solid rgba(28,20,16,0.10)', borderRadius: 'inherit' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
    </div>
  );
}

// ── 3-state slider ────────────────────────────────────────────────────────────
function StatusSlider({ status, onCycle, isObserver = false }: { status: DelegateStatus; onCycle: () => void; isObserver?: boolean }) {
  // Observers can only be Absent or Present, no present-voting (PV) segment.
  if (isObserver) {
    const thumbStart = status === 'absent' ? '2px' : '32px';
    const thumbColor = status === 'absent' ? 'bg-[#8B2020]' : 'bg-[#3D7A52]';
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onCycle(); }}
        className="relative w-[60px] h-[30px] rounded-full cursor-pointer shrink-0 select-none transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}
        title="Tap to cycle: Absent → Present"
      >
        <div className="absolute inset-0 grid grid-cols-2 items-center pointer-events-none">
          <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-white' : 'text-white/40'}`}>A</span>
          <span className={`text-[10px] font-bold text-center ${status !== 'absent' ? 'text-white' : 'text-white/40'}`}>P</span>
        </div>
        <div className={`absolute top-[2px] w-[26px] h-[22px] rounded-full transition-all duration-200 shadow-sm ${thumbColor}`} style={{ insetInlineStart: thumbStart }} />
      </button>
    );
  }
  const thumbStart = status === 'absent' ? '2px' : status === 'present' ? '32px' : '62px';
  const thumbColor = status === 'absent' ? 'bg-[#8B2020]' : status === 'present' ? 'bg-[#3D7A52]' : 'bg-[#B6871F]';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className="relative w-[90px] h-[30px] rounded-full cursor-pointer shrink-0 select-none transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}
      title="Tap to cycle: Absent → Present → PV"
    >
      <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
        <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-white' : 'text-white/40'}`}>A</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-white' : 'text-white/40'}`}>P</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-white' : 'text-white/40'}`}>PV</span>
      </div>
      <div className={`absolute top-[2px] w-[26px] h-[22px] rounded-full transition-all duration-200 shadow-sm ${thumbColor}`} style={{ insetInlineStart: thumbStart }} />
    </button>
  );
}

// ── A-Z / QUEUE view toggle slider ────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: 'az' | 'queue'; onChange: (v: 'az' | 'queue') => void }) {
  const t = useT();
  const isQueue = view === 'queue';
  return (
    <button
      data-tutorial="sidebar-view-toggle"
      data-current-view={view}
      onClick={() => onChange(isQueue ? 'az' : 'queue')}
      className="relative w-[104px] h-[28px] rounded-full cursor-pointer select-none shrink-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
      title="Toggle A-Z / Queue view"
    >
      <div className="absolute top-[1px] w-[51px] h-[26px] rounded-full transition-all duration-200"
        style={{ insetInlineStart: isQueue ? '51px' : '1px', backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <div className="absolute inset-0 flex items-center pointer-events-none z-10">
        <span className={`w-[52px] text-[10px] font-bold text-center leading-none ${!isQueue ? 'text-white' : 'text-white/40'}`}>{t('rollcall_az')}</span>
        <span className={`w-[52px] text-[10px] font-bold text-center leading-none ${isQueue ? 'text-white' : 'text-white/40'}`}>{t('rollcall_queue')}</span>
      </div>
    </button>
  );
}

// ── Add country input ─────────────────────────────────────────────────────────
function AddCountryInput({ committee, onAdd, onQueryChange }: { committee: Committee; onAdd: (country: string) => void; onQueryChange?: (q: string) => void }) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const existingNames = new Set(committee.delegates.map((d) => d.country.toLowerCase()));

  const updateQuery = (q: string) => { setQuery(q); onQueryChange?.(q); };

  const rq = query.trim().toLowerCase();
  const knownMatches = rq
    ? UN_COUNTRIES.filter((c) => startsWithCountryQuery(c.name, rq, language))
        .concat(UN_COUNTRIES.filter((c) =>
          !startsWithCountryQuery(c.name, rq, language) &&
          matchesCountryQuery(c.name, rq, language)))
    : [];

  const topKnown = knownMatches.find((c) => !existingNames.has(c.name.toLowerCase())) ?? null;
  const trimmed = query.trim();
  const isCustom = trimmed.length > 0 && !existingNames.has(trimmed.toLowerCase());
  const showCustomOption = isCustom && (!topKnown || topKnown.name.toLowerCase() !== trimmed.toLowerCase());

  const commit = (name: string) => {
    const normalised = name.trim();
    if (!normalised || existingNames.has(normalised.toLowerCase())) return;
    onAdd(normalised);
    updateQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center rounded-xl overflow-hidden transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (topKnown) commit(topKnown.name);
              else if (trimmed) commit(trimmed);
            }
            if (e.key === 'Escape') updateQuery('');
          }}
          placeholder={t('rollcall_filter_placeholder')}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-white/30" style={{ color: '#EDE7D8' }}
        />
        {query && (topKnown || trimmed) && (
          <span className="text-[10px] text-[#9A8A78] px-2 truncate max-w-[80px]">
            ↵ {topKnown ? getCountryDisplayName(topKnown.name, language) : trimmed}
          </span>
        )}
      </div>

      {query && (knownMatches.length > 0 || showCustomOption) && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-30 shadow-xl max-h-52 overflow-y-auto">
          {knownMatches
            .filter((c) => !existingNames.has(c.name.toLowerCase()))
            .slice(0, showCustomOption ? 5 : 8)
            .map((c, i) => (
              <button
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); commit(c.name); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-start transition-colors ${
                  i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'
                }`}
              >
                <img src={getFlagUrl(c.code)} alt={c.code} className="w-5 h-5 object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-sm flex-1">{getCountryDisplayName(c.name, language)}</span>
                {i === 0 && <span className="text-[10px] text-[#9A8A78] shrink-0">Enter ↵</span>}
              </button>
            ))}
          {showCustomOption && (
            <button
              onMouseDown={(e) => { e.preventDefault(); commit(trimmed); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-start transition-colors text-[#1C1410] hover:bg-[#DDD4C0] border-t border-[#DDD4C0]"
            >
              <span className="text-base">🌐</span>
              <span className="text-sm flex-1">{trimmed}</span>
              <span className="text-[10px] text-[#1B3828] shrink-0 font-semibold">Add custom</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Full speakers list popup ──────────────────────────────────────────────────
function FullListPopup({
  list,
  title,
  onClose,
  onRemove,
}: {
  list: { delegateId: string; country: string }[];
  title: string;
  onClose: () => void;
  onRemove?: (delegateId: string) => void;
}) {
  const { language } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5, 8, 20, 0.80)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* #fit-root scaling trap: FitToScreen wraps this page in a `transform: scale()`d
          box of FIXED height (820px). A transformed ancestor is the containing block for
          `position: fixed` descendants, so the overlay above is 820px tall — but `vh`
          still resolves against the REAL viewport. On any window taller than 820px a
          `max-h-[..vh]` card is sized LARGER than the box it lives in and, being a centred
          flex item, overflows equally top and bottom — pushing the header and close button
          off the top of the screen. Always size against the containing block with a
          PERCENTAGE here, never vh (matches DocumentsModal / ScoreboardPanel). */}
      <div className="bg-[#EDE7D8] border-2 border-[#C8BAA8] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[92%] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD4C0] shrink-0">
          <h3 className="font-black text-[#1C1410] text-base">{title}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#9A8A78] font-mono">{list.length} speakers</span>
            <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] text-xl leading-none">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {list.length === 0 ? (
            <div className="px-5 py-8 text-center text-[#9A8A78] text-sm">No speakers queued</div>
          ) : (
            list.map((s, i) => (
              <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/40 group hover:bg-[#DDD4C0]/30 transition-colors">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.25)' }}>
                  {i + 1}
                </span>
                <FlagCircle country={s.country} size="xs" />
                <span className="text-sm text-[#1C1410] flex-1 truncate">{getCountryDisplayName(s.country, language)}</span>
                {onRemove && (
                  <button
                    onClick={() => onRemove(s.delegateId)}
                    className="text-[#9A8A78] hover:text-[#8B2020] transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
                  >✕</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── MajorityPie ───────────────────────────────────────────────────────────────
// arcFill: fixed fraction 0–1 for the arc shape (never changes per chart).
// label:   live-computed number shown next to the arc.
// color:   always active, these are informational thresholds, not pass/fail.
export function MajorityPie({ arcFill, color, label }: {
  arcFill: number; color: string; label: string;
}) {
  const r = 13; const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-1">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(arcFill, 1))}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
      <span className="text-xs font-bold" style={{ color: '#EDE7D8' }}>{label}</span>
    </div>
  );
}

// How long an optimistic status override survives without the committee row
// confirming it. Long enough to cover a slow write, short enough that a failed
// write cannot mask another chair's change for the rest of the session.
const OPTIMISTIC_TTL_MS = 8000;

// ── Roll Call Panel ───────────────────────────────────────────────────────────
function RollCallPanelInner({
  committee,
  onAddToList,
  onListIds,
  onRemoveFromList,
  onCycleStatus,
  onStatusChange,
  onPhaseChange,
  onDelegateAdd,
  onReorderList,
  isRollCallPhase = false,
  showStatusSliders = false,
  showBulkActions = false,
  showViewToggle = true,
  isReadOnly = false,
  isViewOnly = false,
  isTdT = false,
  isRoomOrderTdT = false,
  hideIdentity = false,
  listView: listViewProp,
  onListViewChange,
}: {
  committee: Committee;
  onAddToList?: (delegateId: string) => void;
  onListIds?: Set<string>;
  onRemoveFromList?: (delegateId: string) => void;
  /**
   * @deprecated Never called. Rapid-click safety now lives in this panel
   * (pendingStatusRef), which is also the only place that knows an observer
   * cycles absent → present → absent with no PV step — the parent's cycle
   * handler does not, so wiring this up would break observer placards.
   * The parent should drop the prop and its handler.
   */
  onCycleStatus?: (delegateId: string) => void;
  onStatusChange?: (delegateId: string, status: DelegateStatus) => void;
  onPhaseChange?: (phase: string) => void;
  onDelegateAdd?: (country: string) => void;
  onReorderList?: (newList: { delegateId: string; country: string }[]) => void;
  isRollCallPhase?: boolean;
  showStatusSliders?: boolean;
  showBulkActions?: boolean;
  showViewToggle?: boolean;
  isReadOnly?: boolean;
  isViewOnly?: boolean;
  isTdT?: boolean;
  isRoomOrderTdT?: boolean;
  /**
   * Drop this panel's own committee name + topic heading, because the surface
   * around it already states the committee's identity. The chair sidebar sets
   * it: CommitteeIdentityBadge sits directly above and owns that identity, so
   * leaving the heading in printed the committee twice, one line apart, with a
   * border between the two. The full-screen pre-session roll call has no badge
   * above it and keeps the heading (the default).
   */
  hideIdentity?: boolean;
  listView?: 'az' | 'queue';
  onListViewChange?: (v: 'az' | 'queue') => void;
}) {
  const { language } = useLanguage();
  const t = useT();
  const [search, setSearch] = useState('');
  const [listViewInternal, setListViewInternal] = useState<'az' | 'queue'>('az');
  const listView = listViewProp !== undefined ? listViewProp : listViewInternal;
  const setListView = (v: 'az' | 'queue') => { setListViewInternal(v); onListViewChange?.(v); };
  const [showFullList, setShowFullList] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, DelegateStatus>>({});
  const [localObservers, setLocalObservers] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Every optimistic status override, with the value we set and when we set it.
  // Mutated synchronously on click so rapid taps cycle off the latest value
  // rather than the one baked into the last render.
  const pendingStatusRef = useRef<Record<string, { value: DelegateStatus; at: number }>>({});
  const [reconcileTick, setReconcileTick] = useState(0);

  useEffect(() => {
    pendingStatusRef.current = {};
    setLocalStatuses({});
    setLocalObservers({});
  }, [committee.id]);

  // ── Optimistic status reconciliation ────────────────────────────────────────
  // `localStatuses` exists only so the slider moves the instant it is tapped. It
  // MUST expire: an override that lives until the committee changes makes this
  // device ignore every later change another chair makes to that delegate, so the
  // present count, the majority pies and the quorum warning silently diverge on a
  // two-laptop dais.
  // Rule: drop an override as soon as the incoming committee row reports the same
  // value we optimistically set (our write landed — hand control back to the
  // authoritative value), or after OPTIMISTIC_TTL_MS if it never lands (backstop
  // for a failed write). Either way a genuine remote change becomes visible again.
  useEffect(() => {
    const pending = pendingStatusRef.current;
    const ids = Object.keys(pending);
    if (ids.length === 0) return;
    const now = Date.now();
    const statusById = new Map(committee.delegates.map((d) => [d.id, d.status]));
    let changed = false;
    let nextCheckIn = Infinity;
    for (const id of ids) {
      const entry = pending[id];
      const dbStatus = statusById.get(id);
      if (dbStatus === undefined || dbStatus === entry.value || now - entry.at >= OPTIMISTIC_TTL_MS) {
        delete pending[id];
        changed = true;
      } else {
        nextCheckIn = Math.min(nextCheckIn, OPTIMISTIC_TTL_MS - (now - entry.at));
      }
    }
    if (changed) {
      const rebuilt: Record<string, DelegateStatus> = {};
      for (const [id, entry] of Object.entries(pending)) rebuilt[id] = entry.value;
      setLocalStatuses(rebuilt);
    }
    // No committee update will arrive if the write failed — self-schedule the backstop.
    if (nextCheckIn !== Infinity) {
      const timer = setTimeout(() => setReconcileTick((n) => n + 1), nextCheckIn + 50);
      return () => clearTimeout(timer);
    }
  }, [committee.delegates, reconcileTick]);

  const present = committee.delegates.filter((d) => (localStatuses[d.id] ?? d.status) !== 'absent').length;
  const total = committee.delegates.length;
  const caucus = liveCaucus(committee);

  // Build a map: delegateId → position in GSL (1-indexed)
  // Current speaker is always #1; queue starts at 2 if there's a current speaker.
  const queuePositionMap = new Map<string, number>();
  if (committee.currentSpeaker?.delegateId) {
    queuePositionMap.set(committee.currentSpeaker.delegateId, 1);
  }
  const queueOffset = committee.currentSpeaker ? 2 : 1;
  (committee.speakersList ?? []).forEach((s, i) => {
    queuePositionMap.set(s.delegateId, i + queueOffset);
  });
  // Caucus current speaker, only when committee.currentSpeaker is null (caucus mode).
  // Guarded by liveCaucus: a leftover caucus JSONB (suspend/end-debate, or the gap
  // between the two writes that end a caucus) would otherwise badge the OLD caucus
  // speaker as position 1 while the committee is already back on the GSL.
  if (!committee.currentSpeaker && caucus?.currentSpeaker) {
    const caucusCurrent = committee.delegates.find((d) => d.country === caucus.currentSpeaker);
    if (caucusCurrent) queuePositionMap.set(caucusCurrent.id, 1);
  }

  // Optimistic write, one DB round trip owned by the parent.
  // The panel NEVER calls committeeService for a status — the parent's
  // onStatusChange already writes it (and handles the GSL/caucus-queue removal
  // when a delegate goes absent mid-session). Writing here too doubled every
  // request: ~380 on "All Present" for a 190-seat GA.
  const applyStatus = (id: string, next: DelegateStatus) => {
    pendingStatusRef.current[id] = { value: next, at: Date.now() };
    setLocalStatuses((prev) => ({ ...prev, [id]: next }));
    onStatusChange?.(id, next);
  };

  const cycleStatus = (id: string, current: DelegateStatus) => {
    const delegate = committee.delegates.find((d) => d.id === id);
    const isObserver = (localObservers[id] ?? delegate?.isObserver) === true;
    // Rapid clicks: the ref holds the value set by the previous click, which the
    // render that produced `current` has not necessarily seen yet.
    const base = pendingStatusRef.current[id]?.value ?? current;
    // Observers cycle absent → present → absent (no present-voting).
    const next: DelegateStatus = isObserver
      ? (base === 'absent' ? 'present' : 'absent')
      : (base === 'absent' ? 'present' : base === 'present' ? 'present-voting' : 'absent');
    applyStatus(id, next);
  };

  const toggleObserver = (id: string, current: boolean) => {
    const next = !current;
    setLocalObservers((prev) => ({ ...prev, [id]: next }));   // instant visual
    setDelegateObserverInDB(id, next, committee.code, committee.dbChairJoinSuffix ?? undefined); // fire-and-forget
    // Becoming an observer downgrades present-voting → present.
    if (next) {
      const delegate = committee.delegates.find((d) => d.id === id);
      const cur = localStatuses[id] ?? delegate?.status;
      if (cur === 'present-voting') applyStatus(id, 'present');
    }
  };

  // Bulk set: localStatuses is flushed ATOMICALLY (one setState, one render) and
  // the parent owns the writes — one per delegate, not two.
  const setAllStatuses = (status: DelegateStatus) => {
    const newStatuses: Record<string, DelegateStatus> = {};
    const at = Date.now();
    committee.delegates.forEach((d) => { newStatuses[d.id] = status; pendingStatusRef.current[d.id] = { value: status, at }; });
    setLocalStatuses(newStatuses);
    committee.delegates.forEach((d) => onStatusChange?.(d.id, status));
  };

  const handleAllPresent = () => setAllStatuses('present');
  const handleAllPresentVoting = () => setAllStatuses('present-voting');
  const handleClear = () => setAllStatuses('absent');

  const handleBeginSession = () => {
    onPhaseChange?.('speakers-list');
    setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  const handleAddDelegate = (country: string) => {
    onDelegateAdd?.(country);
  };

  // A-Z view: pure alphabetical, no status separation
  const alphabetical = [...committee.delegates].sort((a, b) => compareCountryNames(a.country, b.country, language));
  // allAlpha shared base for queueOrdered (alphabetical among non-queue delegates)
  const allAlpha = alphabetical;

  // Queue view: GSL delegates first (in order), then present/PV alphabetically, then absent
  const inQueue = (committee.speakersList ?? [])
    .map((s) => committee.delegates.find((d) => d.id === s.delegateId))
    .filter(Boolean) as typeof committee.delegates;
  const inQueueIds = new Set(inQueue.map((d) => d.id));
  const notInQueue = allAlpha.filter((d) => !inQueueIds.has(d.id));
  const notInQueuePresent = notInQueue.filter((d) => d.status !== 'absent');
  const notInQueueAbsent = notInQueue.filter((d) => d.status === 'absent');
  const queueOrdered = [...inQueue, ...notInQueuePresent, ...notInQueueAbsent];

  const currentSpeakerDelegate = committee.currentSpeaker?.delegateId
    ? committee.delegates.find((d) => d.id === committee.currentSpeaker!.delegateId) ?? null
    : null;
  const caucusCurrentDelegate = (!committee.currentSpeaker && caucus?.currentSpeaker)
    ? committee.delegates.find((d) => d.country === caucus.currentSpeaker) ?? null
    : null;
  const speakerAtTop = currentSpeakerDelegate ?? caucusCurrentDelegate;
  const finalQueueOrdered = speakerAtTop
    ? [speakerAtTop, ...queueOrdered.filter((d) => d.id !== speakerAtTop.id)]
    : queueOrdered;

  const baseList = listView === 'queue' ? finalQueueOrdered : alphabetical;
  // When searching: show all, but grey out non-matches so the filter is visible
  const filtered = baseList;

  // Auto-scroll to first match when search changes
  useEffect(() => {
    if (!search || !listRef.current) return;
    const firstMatch = listRef.current.querySelector('[data-matches="true"]') as HTMLElement | null;
    firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [search]);

  return (
    <div className="flex flex-col h-full overflow-hidden"
      onWheel={(e) => {
        // Forward wheel events from the header/footer into the list,
        // since those areas have no scroll container of their own.
        if (listRef.current && !listRef.current.contains(e.target as Node)) {
          listRef.current.scrollBy({ top: e.deltaY });
        }
      }}
    >
      {/* hideIdentity: the surface above already states the committee (the chair
          sidebar's CommitteeIdentityBadge). Repeating it here printed the name
          twice, one line apart. The heading goes; the bottom border STAYS, and
          it becomes the single seam under the whole masthead — badge and stats
          row now sit inside one block instead of two bordered cards. */}
      <div
        className={`px-4 ${hideIdentity ? 'pt-1.5' : 'pt-4'} pb-3 shrink-0 relative z-10`}
        style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}
      >
        {!hideIdentity && (
          <>
            <p className="text-lg font-black leading-tight truncate mb-0.5" style={{ color: '#EED98A' }}>{getCommitteeDisplayName(committee.name, language)}</p>
            {committee.topic && (
              <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: 'rgba(238,217,138,0.55)' }}>
                <span className="font-semibold" style={{ color: 'rgba(238,217,138,0.7)' }}>{t('rollcall_topic')} </span>{committee.topic}
              </p>
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <MajorityPie arcFill={1} color="#2A5A3C" label={`${present}`} />
            <MajorityPie arcFill={2 / 3} color="#B6871F" label={`${Math.ceil(present * 2 / 3)}`} />
            <MajorityPie arcFill={0.5} color="#8A7A6A" label={`${Math.floor(present / 2) + 1}`} />
          </div>
          {showViewToggle && <ViewToggle view={listView} onChange={setListView} />}
        </div>
        {showBulkActions && (
          <div className="flex gap-1.5 mt-2">
            <button onClick={handleClear} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors gv-lift-dark" style={{ backgroundColor: 'rgba(139,32,32,0.25)', color: '#F4A0A0', border: '1px solid rgba(139,32,32,0.4)' }}>{t('rollcall_clear_all')}</button>
            <button onClick={handleAllPresent} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors gv-lift-dark" style={{ backgroundColor: 'rgba(61,122,82,0.3)', color: '#EDE7D8', border: '1px solid rgba(61,122,82,0.4)' }}>{t('rollcall_all_present')}</button>
            <button onClick={handleAllPresentVoting} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors gv-lift-dark" style={{ backgroundColor: 'rgba(182,135,31,0.25)', color: '#EED98A', border: '1px solid rgba(182,135,31,0.35)' }}>{t('rollcall_all_pv')}</button>
          </div>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((d, idx) => {
          const effectiveStatus = localStatuses[d.id] ?? d.status;
          const isOnList = onListIds?.has(d.id) ?? false;
          const isAbsent = effectiveStatus === 'absent';
          const isObserver = (localObservers[d.id] ?? d.isObserver) === true;
          const queuePos = queuePositionMap.get(d.id) ?? null;
          const matchesSearch = !search || matchesCountryQuery(d.country, search, language);
          const isDraggable = listView === 'queue' && !isRollCallPhase && queuePositionMap.has(d.id);
          const isCurrentSpeaker = committee.currentSpeaker?.delegateId === d.id;
          const isCurrentSpeakerInPanel = queuePos === 1 && (
            committee.currentSpeaker?.delegateId === d.id ||
            caucus?.currentSpeaker === d.country
          );
          const isUpNext = listView === 'queue' && isCurrentSpeakerInPanel;

          const handleRowClick = () => {
            if (isViewOnly) return;
            if (onAddToList && !isAbsent) {
              if (!isOnList) onAddToList(d.id);
              else if (onRemoveFromList) onRemoveFromList(d.id);
            }
          };

          return (
            <div key={d.id}>
              {dragOverIndex === idx && dragOverIndex !== dragIndexRef.current && (
                <div className="h-0.5 bg-[#1B3828] rounded-full mx-2 -mb-0.5" />
              )}
              <div
                data-matches={matchesSearch ? 'true' : 'false'}
                onClick={handleRowClick}
                draggable={isDraggable}
                onDragStart={() => { if (isDraggable) dragIndexRef.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (listView === 'queue' && !isRollCallPhase) setDragOverIndex(idx); }}
                onDrop={() => {
                  const from = dragIndexRef.current;
                  const to = idx;
                  if (from === null || from === to || !onReorderList) { setDragOverIndex(null); return; }
                  const gslItems = (committee.speakersList ?? []);
                  const fromDelegateId = filtered[from]?.id;
                  const toDelegateId = d.id;
                  const fromIdx = gslItems.findIndex(s => s.delegateId === fromDelegateId);
                  const toIdx = gslItems.findIndex(s => s.delegateId === toDelegateId);
                  if (fromIdx < 0 || toIdx < 0) { setDragOverIndex(null); return; }
                  const newList = [...gslItems];
                  const [moved] = newList.splice(fromIdx, 1);
                  newList.splice(toIdx, 0, moved);
                  onReorderList(newList);
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                  !matchesSearch
                    ? 'opacity-20'
                    : isCurrentSpeaker
                    ? 'border-2'
                    : isAbsent
                    ? 'opacity-35'
                    : effectiveStatus === 'present'
                    ? 'border'
                    : 'border'
                } ${
                  (!isRollCallPhase && !showStatusSliders && onAddToList && !isAbsent) || isRollCallPhase || showStatusSliders
                    ? 'cursor-pointer'
                    : isAbsent && !isRollCallPhase && !showStatusSliders
                    ? 'cursor-not-allowed'
                    : ''
                } ${isDraggable ? 'cursor-grab' : ''}`}
                style={{
                  backgroundColor: !matchesSearch ? 'transparent'
                    : isCurrentSpeaker ? 'rgba(238,217,138,0.12)'
                    : isAbsent ? 'transparent'
                    : effectiveStatus === 'present' ? 'rgba(61,122,82,0.22)'
                    : 'rgba(182,135,31,0.18)',
                  borderColor: !matchesSearch ? 'transparent'
                    : isCurrentSpeaker ? 'rgba(238,217,138,0.5)'
                    : isAbsent ? 'transparent'
                    : effectiveStatus === 'present' ? 'rgba(61,122,82,0.4)'
                    : 'rgba(182,135,31,0.4)',
                }}
                onMouseEnter={(e) => { if (!isAbsent) (e.currentTarget as HTMLElement).style.backgroundColor = effectiveStatus === 'present' ? 'rgba(61,122,82,0.38)' : effectiveStatus === 'present-voting' ? 'rgba(182,135,31,0.32)' : 'rgba(238,217,138,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = !matchesSearch ? 'transparent' : isCurrentSpeaker ? 'rgba(238,217,138,0.12)' : isAbsent ? 'transparent' : effectiveStatus === 'present' ? 'rgba(61,122,82,0.22)' : 'rgba(182,135,31,0.18)'; }}
              >
                <div className="relative shrink-0">
                  {isRoomOrderTdT && queuePos !== null ? (
                    <div className={`${isUpNext ? 'w-12 h-12' : 'w-9 h-9'} rounded-full bg-[#DDD4C0] border border-[#C8BAA8] flex items-center justify-center`}>
                      <span className={`font-black text-[#B6871F] ${isUpNext ? 'text-xl' : 'text-sm'}`}>{queuePos}</span>
                    </div>
                  ) : (
                    <FlagCircle country={d.country} size={isUpNext ? 'md' : 'sm'} />
                  )}
                  {/* Queue position bubble, omitted when isRoomOrderTdT since position is already the primary display */}
                  {queuePos !== null && !isRoomOrderTdT && (
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full flex items-center justify-center font-black leading-none text-[10px]"
                      style={{ backgroundColor: '#EDE7D8', color: '#1B3828', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      {isCurrentSpeakerInPanel ? '★' : queuePos <= 99 ? queuePos : '99+'}
                    </div>
                  )}
                </div>
                <span className={`flex-1 truncate ${isUpNext ? 'text-lg font-bold' : 'text-base'} ${!isAbsent ? 'font-medium' : 'opacity-50'}`} style={{ color: '#EDE7D8' }}>
                  {getCountryDisplayName(d.country, language)}
                </span>
                {isObserver && (
                  <span className="text-[9px] shrink-0 font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: 'rgba(238,217,138,0.85)', border: '1px solid rgba(238,217,138,0.3)' }}>{t('rollcall_observer')}</span>
                )}
                {/* Observer placard toggle, available during roll call and mid-session */}
                {(isRollCallPhase || showStatusSliders) && !(isReadOnly || isViewOnly) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleObserver(d.id, isObserver); }}
                    title={isObserver ? t('rollcall_observer_remove') : t('rollcall_observer_make')}
                    aria-pressed={isObserver}
                    className="shrink-0 p-1 rounded-md transition-transform active:scale-90"
                    style={{ color: isObserver ? 'rgba(238,217,138,0.9)' : 'rgba(237,231,216,0.4)' }}
                  >
                    <Megaphone size={15} />
                  </button>
                )}
                {isAbsent && !(isRollCallPhase || showStatusSliders) && (
                  <span className="text-[10px] shrink-0 font-mono ms-auto uppercase tracking-wide" style={{ color: 'rgba(237,231,216,0.35)' }}>{t('rollcall_absent')}</span>
                )}
                {(isRollCallPhase || showStatusSliders) && (
                  <div onClick={(e) => e.stopPropagation()} className={`shrink-0 ${(isReadOnly || isViewOnly) ? 'pointer-events-none opacity-50' : ''}`}>
                    <StatusSlider status={effectiveStatus} onCycle={() => cycleStatus(d.id, effectiveStatus)} isObserver={isObserver} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-3 space-y-2 shrink-0 overflow-visible relative z-10" style={{ borderTop: '1px solid rgba(61,122,82,0.3)' }}>
        <AddCountryInput committee={committee} onAdd={handleAddDelegate} onQueryChange={setSearch} />
        {(committee.phase === 'pre-session' || committee.phase === 'roll-call') && (
          <button
            onClick={handleBeginSession}
            disabled={present < 1}
            className="w-full disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl text-sm font-black uppercase tracking-widest gv-lift-dark" style={{ backgroundColor: '#EDE7D8', color: '#1B3828' }} onMouseEnter={(e) => { if ((e.currentTarget as HTMLButtonElement).disabled) return; (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
          >
            {/* With delegates in the room but none marked present, the blocker is the
                roll call, not the roster — "Add at least 1 delegate" was simply wrong. */}
            {present >= 1 ? t('rollcall_begin_session') : total === 0 ? t('rollcall_add_delegate') : t('voting_mark_present')}
          </button>
        )}
      </div>

      {showFullList && (
        <FullListPopup
          list={committee.speakersList}
          title="General Speakers List"
          onClose={() => setShowFullList(false)}
          onRemove={onRemoveFromList ? (id) => { onRemoveFromList(id); } : undefined}
        />
      )}
    </div>
  );
}

const RollCallPanel = React.memo(RollCallPanelInner, (prev, next) => {
  return (
    prev.committee.delegates === next.committee.delegates &&
    prev.committee.speakersList === next.committee.speakersList &&
    prev.committee.phase === next.committee.phase &&
    prev.committee.currentSpeaker === next.committee.currentSpeaker &&
    prev.committee.caucusQueue === next.committee.caucusQueue &&
    prev.isRollCallPhase === next.isRollCallPhase &&
    prev.showStatusSliders === next.showStatusSliders &&
    prev.showBulkActions === next.showBulkActions &&
    prev.showViewToggle === next.showViewToggle &&
    prev.isReadOnly === next.isReadOnly &&
    prev.isViewOnly === next.isViewOnly &&
    prev.isTdT === next.isTdT &&
    prev.isRoomOrderTdT === next.isRoomOrderTdT &&
    prev.onListIds === next.onListIds &&
    prev.listView === next.listView &&
    prev.onReorderList === next.onReorderList
  );
});

export default RollCallPanel;
