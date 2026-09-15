'use client';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { getFlagUrl, getCountryDisplayName, UN_COUNTRIES, matchesCountryQuery, startsWithCountryQuery, compareCountryNames } from '@/lib/countries';
import { SeatCircleFlag, SIDEBAR_MONOGRAM } from '@/components/CircleFlag';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import {
  beginSessionAfterRollCall,
  setDelegateObserver as setDelegateObserverInDB,
  resolveJoinRequestsOnAdmit,
} from '@/lib/committeeService';
import { liveCaucus } from '@/components/FeedbackLogPanel';
import { GripVertical, Megaphone, Mic } from 'lucide-react';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';

// ── FlagCircle ────────────────────────────────────────────────────────────────
export function FlagCircle({ country, size = 'md' }: { country: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' }) {
  // Seat crest, then the round flag, then a monogram: <SeatCircleFlag> fills
  // the whole circle (square artwork, see src/components/CircleFlag.tsx).
  const px: Record<string, number> = { xs: 28, sm: 36, md: 48, lg: 56, xl: 80, hero: 240 };
  return <SeatCircleFlag country={country} size={px[size]} decorative />;
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

// ── Recognising an absent delegate ───────────────────────────────────────────
// The status a recognised delegate gets: the one their waiting-room request asked for,
// never Present-and-Voting for an observer, Present otherwise. Shared by this panel's row
// click and the chair page's typed add bars, so both paths answer a request identically.
export function recognisedStatus(
  pendingMotions: Committee['pendingMotions'] | undefined,
  country: string,
  isObserver: boolean,
): DelegateStatus {
  if (isObserver) return 'present';
  const joinReq = (pendingMotions ?? []).find(
    (m) => (m.type as string) === 'join-request' && m.proposedBy === country,
  );
  if (!joinReq) return 'present';
  try { if (JSON.parse(joinReq.topic)?.desiredStatus === 'present-voting') return 'present-voting'; } catch { /* keep present */ }
  return 'present';
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
      <div className="flex items-center rounded-xl overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-[#EED98A]/60" style={{ backgroundColor: 'rgba(255,255,255,0.09)' }}>
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
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[15px] focus:outline-none placeholder:text-[rgba(237,231,216,0.55)]" style={{ color: '#EDE7D8' }}
        />
        {query && (topKnown || trimmed) && (
          <span className="text-[11px] px-2 truncate max-w-[96px]" style={{ color: 'rgba(237,231,216,0.7)' }}>
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
              <UnknownSeatIcon size={20} />
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
  onBulkStatusChange,
  onPhaseChange,
  onDelegateAdd,
  onReorderList,
  isRollCallPhase = false,
  showStatusSliders = false,
  showBulkActions = false,
  isReadOnly = false,
  isViewOnly = false,
  isTdT = false,
  isRoomOrderTdT = false,
  hideIdentity = false,
  speechRunning = false,
  onJoinRequestResolved,
  canAddToList,
  onRemoveCurrentSpeaker,
}: {
  /**
   * Take the speaker holding the floor off it (a click on their row; there is no X on the
   * row any more, 15 Sep 2026: the floor's speaker strip keeps its own X).
   * The chair page logs the speech, pauses and clears the floor. Must be a STABLE callback:
   * it is part of the memo comparator. Omitted = the speaker's row does nothing.
   */
  onRemoveCurrentSpeaker?: (delegateId: string) => void;
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
  /**
   * Bulk roll call (All present / All P+V / Clear) as ONE parent write. When given, the
   * bulk buttons call this once instead of onStatusChange per delegate (PERF-2: 190 writes
   * and 190 realtime events for a General Assembly).
   */
  onBulkStatusChange?: (status: DelegateStatus, delegateIds: string[]) => void;
  onPhaseChange?: (phase: string) => void;
  onDelegateAdd?: (country: string) => void;
  onReorderList?: (newList: { delegateId: string; country: string }[]) => void;
  isRollCallPhase?: boolean;
  showStatusSliders?: boolean;
  showBulkActions?: boolean;
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
  /**
   * The chair's speaker clock is running (`timerRunning`). A state flip on press, never a
   * per-second value. Together with the speaker at the top of the queue it is the signal
   * that a speech started, which scrolls the list back to the top.
   */
  speechRunning?: boolean;
  /**
   * An absent delegate was recognised from this panel (clicked onto a list). The parent
   * drops that country's pending join-request motions from local state; the DB delete is
   * done here, after the status write lands (see handleRowClick).
   */
  onJoinRequestResolved?: (country: string) => void;
  /**
   * Asked BEFORE an absent delegate is recognised: can the list take them right now? The
   * caucus queue answers with caucusQueueCapacity and shows `caucus_queue_no_time` itself
   * when it cannot. Without it a click marked the delegate Present and then the add was
   * silently refused. Omitted = the list always has room (the GSL).
   */
  canAddToList?: (delegateId: string) => boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  const [search, setSearch] = useState('');
  const [showFullList, setShowFullList] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, DelegateStatus>>({});
  const [localObservers, setLocalObservers] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  // ── Queue reorder (pointer drag on the grip, or arrow keys on it) ──────────
  // `drag` renders the lifted row and the drop line; it changes only when the drag starts,
  // ends, or the drop SLOT changes. Per-move work (the row following the pointer) writes the
  // DOM directly through dragRef, never React state, and never committee state (RULES 3/4).
  const [drag, setDrag] = useState<{ id: string; slot: number } | null>(null);
  const dragRef = useRef<{
    id: string; pointerId: number; startY: number; startScroll: number; lastY: number;
    active: boolean; slot: number; el: HTMLElement | null; raf: number;
    /** Screen px per layout px (FitToScreen's scale). */ scale: number;
    /** Pointer travel before the row lifts: 4 on the grip, 6 on the row (a click stays a click). */ slop: number;
  } | null>(null);
  // A drag must never end in a row click (add / remove / recognise): true for 400 ms after one.
  const justDraggedRef = useRef(false);
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
    if (onBulkStatusChange) onBulkStatusChange(status, committee.delegates.map((d) => d.id));
    else committee.delegates.forEach((d) => onStatusChange?.(d.id, status));
  };

  const handleAllPresent = () => setAllStatuses('present');
  const handleAllPresentVoting = () => setAllStatuses('present-voting');
  const handleClear = () => setAllStatuses('absent');

  const handleBeginSession = () => {
    // The chair page restores a caucus that a suspension paused (or opens the GSL); the DB
    // write decides from the stored row and clears any caucus data when there is none (C-1).
    onPhaseChange?.('speakers-list');
    void beginSessionAfterRollCall(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
  };

  const handleAddDelegate = (country: string) => {
    onDelegateAdd?.(country);
  };

  // ONE ordering, no toggle. The A-Z / QUEUE switch was removed: chairs left the A-Z
  // roll-call sort on for whole sessions and the queue was unreadable.
  // - Roll call (isRollCallPhase: pre-session and the resume roll call) and the
  //   mid-session Roll Call tab (showStatusSliders): plain A-Z.
  // - Everywhere else: the speaker holding the floor (#1), then the list in order, then
  //   every delegate NOT on the list, A-Z (absent ones included, in their A-Z place).
  const alphabetical = [...committee.delegates].sort((a, b) => compareCountryNames(a.country, b.country, language));

  const inQueue = (committee.speakersList ?? [])
    .map((s) => committee.delegates.find((d) => d.id === s.delegateId))
    .filter(Boolean) as typeof committee.delegates;
  const inQueueIds = new Set(inQueue.map((d) => d.id));
  const queueOrdered = [...inQueue, ...alphabetical.filter((d) => !inQueueIds.has(d.id))];

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

  // The mid-session Roll Call tab (showStatusSliders) is taking roll too, so it reads A-Z
  // exactly like pre-session. Any speech start closes that tab on the chair page, which
  // switches this back to the queue and the effect below scrolls to the top.
  const isQueueView = !isRollCallPhase && !showStatusSliders;
  // When searching: show all, but grey out non-matches so the filter is visible
  const filtered = isQueueView ? finalQueueOrdered : alphabetical;

  // A speech started → back to the top of the list, where the speaker now sits as #1.
  // The signal is the speaker at the top (GSL Next / call first speaker, moderated caucus
  // and Tour de Table advance) plus the clock being started (Start, including a resume
  // after a pause). Both change on a press only, never per second, and this effect only
  // scrolls a DOM node: no committee state, no updateLocal, no localUpdateTime (RULES 3/4).
  // Right of Reply is not a queue speech and touches neither value.
  const speechSignal = isQueueView ? `${speakerAtTop?.id ?? ''}|${speechRunning ? 1 : 0}` : null;
  const prevSpeechSignalRef = useRef(speechSignal);
  useEffect(() => {
    const prev = prevSpeechSignalRef.current;
    prevSpeechSignalRef.current = speechSignal;
    if (speechSignal === null || prev === speechSignal) return;
    // Coming back from the A-Z Roll Call tab: the order just changed wholesale, so start
    // at the top (the speaker, if any, is #1 there).
    if (prev === null) { listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const [id, running] = speechSignal.split('|');
    const [prevId, prevRunning] = (prev ?? '|0').split('|');
    const newSpeaker = id !== '' && id !== prevId;
    const clockStarted = running === '1' && prevRunning !== '1' && id !== '';
    if (newSpeaker || clockStarted) listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [speechSignal]);

  // Auto-scroll to first match when search changes
  useEffect(() => {
    if (!search || !listRef.current) return;
    const firstMatch = listRef.current.querySelector('[data-matches="true"]') as HTMLElement | null;
    firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [search]);

  // ── Scroll edge fade ────────────────────────────────────────────────────────
  // The scrollbar is hidden; a soft fade at an edge that has more rows beyond it says the
  // list scrolls. CSS variables written straight to the node on scroll: no React render.
  const updateFade = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const top = Math.max(0, Math.min(28, el.scrollTop));
    const bottom = Math.max(0, Math.min(28, el.scrollHeight - el.clientHeight - el.scrollTop));
    el.style.setProperty('--fade-top', `${top}px`);
    el.style.setProperty('--fade-bottom', `${bottom}px`);
  }, []);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateFade();
    el.addEventListener('scroll', updateFade, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateFade) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', updateFade); ro?.disconnect(); };
  }, [updateFade]);
  // Rows added or removed change the scroll height without resizing the box.
  useEffect(() => { updateFade(); });

  // ── Queue reorder ───────────────────────────────────────────────────────────
  // Only the queued delegations behind the floor: the speaker at #1 is never draggable and
  // never a drop target (slot 0 is directly beneath them). Only in the queue view, with a
  // reorder handler, for a chair who can write.
  const canReorder = !!onReorderList && isQueueView && !isViewOnly && !isReadOnly && !committee.endedAt;
  const delegateIds = new Set(committee.delegates.map((d) => d.id));
  const reorderIds = canReorder
    ? (committee.speakersList ?? []).map((s) => s.delegateId).filter((id) => id !== speakerAtTop?.id && delegateIds.has(id))
    : [];
  const reorderable = new Set(reorderIds);

  // The full list with `id` placed in front of `beforeId` (or after the last reorderable row
  // when null). Null when the order would not change.
  const reorderedList = (id: string, beforeId: string | null) => {
    const list = committee.speakersList ?? [];
    const moved = list.find((s) => s.delegateId === id);
    if (!moved) return null;
    const rest = list.filter((s) => s.delegateId !== id);
    let at: number;
    if (beforeId) {
      at = rest.findIndex((s) => s.delegateId === beforeId);
      if (at < 0) return null;
    } else {
      const others = reorderIds.filter((x) => x !== id);
      const last = others.length ? rest.findIndex((s) => s.delegateId === others[others.length - 1]) : -1;
      at = last >= 0 ? last + 1 : rest.length;
    }
    const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
    return next.every((s, i) => s.delegateId === list[i]?.delegateId) ? null : next;
  };

  // ── Pointer drag ─────────────────────────────────────────────────────────────
  // A queued row can be picked up from ANYWHERE on it with a mouse or pen (it lifts after
  // ROW_SLOP px, so a plain click still adds / removes), and from the grip with any pointer,
  // touch included (the grip is touch-action: none; the row is not, so a finger still
  // scrolls the list). Moves and the release are read from WINDOW listeners, so the drag
  // never depends on pointer capture or on the pointer staying over the row it started on.
  // That dependency is why the queue "was not draggable" (15 Sep 2026): only the faint
  // 28px grip could start a drag, and nothing on the row itself did.
  // The console is drawn inside FitToScreen's scale(), so every screen distance is divided
  // by the list's scale before it is compared with layout offsets.
  const latestRef = useRef({ reorderIds, reorderedList, onReorderList });
  useEffect(() => { latestRef.current = { reorderIds, reorderedList, onReorderList }; });

  const paintDrag = useCallback(() => {
    const st = dragRef.current;
    const list = listRef.current;
    if (!st || !st.active || !list) return;
    if (st.el) st.el.style.transform = `translateY(${(st.lastY - st.startY) / st.scale + (list.scrollTop - st.startScroll)}px)`;
    const y = (st.lastY - list.getBoundingClientRect().top) / st.scale + list.scrollTop;
    let slot = 0;
    for (const id of latestRef.current.reorderIds) {
      if (id === st.id) continue;
      const row = list.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(id)}"]`);
      if (row && y > row.offsetTop + row.offsetHeight / 2) slot++;
    }
    if (slot !== st.slot) { st.slot = slot; setDrag({ id: st.id, slot }); }
  }, []);

  // The pointer id of a pointerdown that may become a drag. While set, window listeners
  // are attached (layout effect: attached in the same flush as the pointerdown, so even a
  // very fast click's pointerup is seen). Cleared by endDrag.
  const [armedPointer, setArmedPointer] = useState<number | null>(null);

  const endDrag = useCallback((commit: boolean) => {
    const st = dragRef.current;
    dragRef.current = null;
    setArmedPointer(null);
    if (!st) return;
    cancelAnimationFrame(st.raf);
    if (st.el) st.el.style.transform = '';
    if (!st.active) return;
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 400);
    setDrag(null);
    const { reorderIds: ids, reorderedList: build, onReorderList: commitList } = latestRef.current;
    if (!commit || !commitList) return;
    const others = ids.filter((x) => x !== st.id);
    const next = build(st.id, others[st.slot] ?? null);
    // Optimistic + chained write, owned by the parent (reorderSpeakersList).
    if (next) commitList(next);
  }, []);

  useLayoutEffect(() => {
    if (armedPointer === null) return;
    const onMove = (e: PointerEvent) => {
      const st = dragRef.current;
      const list = listRef.current;
      if (!st || st.pointerId !== e.pointerId || !list) return;
      st.lastY = e.clientY;
      if (!st.active) {
        if (Math.abs(e.clientY - st.startY) / st.scale < st.slop) return;
        st.active = true;
        window.getSelection()?.removeAllRanges();
        st.el = list.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(st.id)}"]`);
        st.slot = latestRef.current.reorderIds.indexOf(st.id);
        setDrag({ id: st.id, slot: st.slot });
        // Edge auto-scroll while held near the top or bottom of the list.
        const tick = () => {
          const cur = dragRef.current;
          const l = listRef.current;
          if (!cur || !l) return;
          const r = l.getBoundingClientRect();
          const edge = 44 * cur.scale;
          const dy = cur.lastY < r.top + edge ? -Math.ceil((r.top + edge - cur.lastY) / 4)
            : cur.lastY > r.bottom - edge ? Math.ceil((cur.lastY - (r.bottom - edge)) / 4) : 0;
          if (dy !== 0) { l.scrollTop += dy; paintDrag(); }
          cur.raf = requestAnimationFrame(tick);
        };
        st.raf = requestAnimationFrame(tick);
      }
      if (e.cancelable) e.preventDefault();
      paintDrag();
    };
    const onUp = (e: PointerEvent) => { if (dragRef.current?.pointerId === e.pointerId) endDrag(true); };
    const onCancel = (e: PointerEvent) => { if (dragRef.current?.pointerId === e.pointerId) endDrag(false); };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [armedPointer, paintDrag, endDrag]);

  // While a row is lifted the whole page shows the grabbing cursor and selects no text; the
  // cleanup also covers an unmount mid-drag.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const body = document.body;
    const prevCursor = body.style.cursor;
    const prevSelect = body.style.userSelect;
    body.style.cursor = 'grabbing';
    body.style.userSelect = 'none';
    return () => { body.style.cursor = prevCursor; body.style.userSelect = prevSelect; };
  }, [dragging]);
  // Unmount mid-drag: stop the auto-scroll loop (the layout effect removes the listeners).
  useEffect(() => () => { const st = dragRef.current; if (st) cancelAnimationFrame(st.raf); }, []);

  const startPointerDrag = (e: React.PointerEvent<HTMLElement>, id: string, fromGrip: boolean) => {
    if (e.button !== 0 || !listRef.current || dragRef.current) return;
    if (!fromGrip) {
      // The row: mouse and pen only (a finger scrolls), and never from a button inside it.
      if (e.pointerType === 'touch') return;
      const hit = (e.target as HTMLElement).closest('button, input, a, [role="switch"]');
      if (hit && hit !== e.currentTarget) return;
    } else {
      e.stopPropagation();
      e.preventDefault();
    }
    const list = listRef.current;
    const scale = (list.getBoundingClientRect().height / (list.offsetHeight || 1)) || 1;
    dragRef.current = {
      id, pointerId: e.pointerId, startY: e.clientY, lastY: e.clientY,
      startScroll: list.scrollTop, active: false, slot: -1, el: null, raf: 0,
      scale, slop: fromGrip ? 4 : 6,
    };
    setArmedPointer(e.pointerId);
  };

  // Keyboard: ArrowUp / ArrowDown on the grip moves the delegation one place.
  const gripKeyDown = (e: React.KeyboardEvent<HTMLElement>, id: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    if (!onReorderList) return;
    const i = reorderIds.indexOf(id);
    if (i < 0) return;
    const others = reorderIds.filter((x) => x !== id);
    const slot = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (slot < 0 || slot > others.length) return;
    const next = reorderedList(id, others[slot] ?? null);
    if (next) onReorderList(next);
  };

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
      {/* hideIdentity: the surface above already states the committee AND owns the quorum
          rings (CommitteeIdentityBadge, in the chair sidebar and the pre-session card), so
          this block keeps only the roll-call bulk actions. No divider: the masthead's own
          tone ends where the list begins. */}
      {(!hideIdentity || showBulkActions) && (
      <div className={`px-4 ${hideIdentity ? 'pt-2.5' : 'pt-4'} pb-2.5 shrink-0 relative z-10`}>
        {!hideIdentity && (
          <>
            <p className="text-lg font-black leading-tight truncate mb-0.5" style={{ color: '#EED98A' }}>{getCommitteeDisplayName(committee.name, language)}</p>
            {committee.topic && (
              <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: 'rgba(238,217,138,0.85)' }}>
                <span className="font-semibold">{t('rollcall_topic')} </span>{committee.topic}
              </p>
            )}
            <div className="flex gap-1.5">
              <MajorityPie arcFill={1} color="#2A5A3C" label={`${present}`} />
              <MajorityPie arcFill={2 / 3} color="#B6871F" label={`${Math.ceil(present * 2 / 3)}`} />
              <MajorityPie arcFill={0.5} color="#8A7A6A" label={`${Math.floor(present / 2) + 1}`} />
            </div>
          </>
        )}
        {showBulkActions && (
          <div className={`grid grid-cols-3 gap-2 ${hideIdentity ? '' : 'mt-2'}`}>
            <button onClick={handleClear} className="text-[11px] font-bold uppercase tracking-wide px-2 py-2 rounded-lg transition-colors gv-lift-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70" style={{ backgroundColor: 'rgba(139,32,32,0.30)', color: '#F6B4B4' }}>{t('rollcall_clear_all')}</button>
            <button onClick={handleAllPresent} className="text-[11px] font-bold uppercase tracking-wide px-2 py-2 rounded-lg transition-colors gv-lift-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70" style={{ backgroundColor: 'rgba(61,122,82,0.40)', color: '#EDE7D8' }}>{t('rollcall_all_present')}</button>
            <button onClick={handleAllPresentVoting} className="text-[11px] font-bold uppercase tracking-wide px-2 py-2 rounded-lg transition-colors gv-lift-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70" style={{ backgroundColor: 'rgba(182,135,31,0.30)', color: '#EED98A' }}>{t('rollcall_all_pv')}</button>
          </div>
        )}
      </div>
      )}

      {/* Scrollbar hidden in every engine (scrollbar-width, ::-webkit-scrollbar); wheel, touch
          and keyboard still scroll. Generous bottom padding so the last row never sits flush
          against the add bar, and an edge fade (updateFade) where more rows are hidden. */}
      <div
        ref={listRef}
        tabIndex={0}
        aria-label={t('rollcall_list_label')}
        className="relative flex-1 overflow-y-auto overscroll-contain px-2 pt-1.5 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#EED98A]/50"
        style={{
          paddingBottom: 48,
          msOverflowStyle: 'none',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 var(--fade-top, 0px), #000 calc(100% - var(--fade-bottom, 0px)), transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 var(--fade-top, 0px), #000 calc(100% - var(--fade-bottom, 0px)), transparent 100%)',
        } as React.CSSProperties}
      >
        {filtered.map((d) => {
          const effectiveStatus = localStatuses[d.id] ?? d.status;
          const isOnList = onListIds?.has(d.id) ?? false;
          const isAbsent = effectiveStatus === 'absent';
          const isObserver = (localObservers[d.id] ?? d.isObserver) === true;
          const queuePos = queuePositionMap.get(d.id) ?? null;
          const matchesSearch = !search || matchesCountryQuery(d.country, search, language);
          const isReorderable = reorderable.has(d.id);
          const isLifted = drag?.id === d.id;
          // Drop line: before this row, or after it when it is the last reorderable row. Never
          // shown for the slot the row came from (dropping there changes nothing).
          let dropLine: 'before' | 'after' | null = null;
          if (drag && isReorderable && !isLifted) {
            const others = reorderIds.filter((x) => x !== drag.id);
            const mine = others.indexOf(d.id);
            const origin = reorderIds.indexOf(drag.id);
            if (drag.slot !== origin) {
              if (drag.slot === mine) dropLine = 'before';
              else if (mine === others.length - 1 && drag.slot === others.length) dropLine = 'after';
            }
          }
          const isCurrentSpeaker = committee.currentSpeaker?.delegateId === d.id;
          const isCurrentSpeakerInPanel = queuePos === 1 && (
            committee.currentSpeaker?.delegateId === d.id ||
            caucus?.currentSpeaker === d.country
          );
          const isUpNext = isQueueView && isCurrentSpeakerInPanel;
          // Removable from the floor from this row (chair page, onRemoveCurrentSpeaker).
          const holdsFloor = !isRollCallPhase && !showStatusSliders && !isReadOnly && !isViewOnly && !committee.endedAt
            && (isCurrentSpeaker || (!!caucus?.currentSpeaker && caucus.currentSpeaker === d.country));
          // Recognising an absent delegate: clicking them onto a list marks them Present
          // in the same action. Not in roll call and not in the mid-session Roll Call tab
          // (showStatusSliders): the slider owns status there, so an absent row is a status
          // row only and never lands on a list. Not when read-only or ended.
          const canRecognise = !!onAddToList && !isRollCallPhase && !showStatusSliders && !isReadOnly && !committee.endedAt;

          const handleRowClick = () => {
            if (isViewOnly) return;
            if (drag || justDraggedRef.current) return;
            if (!onAddToList) return;
            // The speaker holding the floor: a click takes them OFF it (the parent logs the
            // speech, pauses and clears the floor), even when nobody else is queued.
            if (holdsFloor && onRemoveCurrentSpeaker) { onRemoveCurrentSpeaker(d.id); return; }
            if (!isAbsent) {
              if (!isOnList) onAddToList(d.id);
              else if (onRemoveFromList) onRemoveFromList(d.id);
              return;
            }
            if (!canRecognise) return;
            // Room first, status second: if the list cannot take them (a caucus with no
            // time left), leave the status alone. canAddToList shows the reason.
            if (!isOnList && canAddToList && !canAddToList(d.id)) return;
            // A waiting-room request from this delegation is answered by this click, the
            // same way Approve answers it: the status they asked for (never PV for an
            // observer), then the motion goes. Best effort on reading the desired status,
            // since this panel can hold a slightly older pendingMotions snapshot.
            const desired = recognisedStatus(committee.pendingMotions, d.country, isObserver);
            // 1) Status, optimistic: localStatuses here, updateLocal + setDelegateStatusInDB
            //    in the parent's onStatusChange. Must precede the add, because the parent's
            //    absent handling strips absent delegates from both lists.
            applyStatus(d.id, desired);
            // 2) The list add, optimistic then fire-and-forget, owned by the parent.
            if (!isOnList) onAddToList(d.id);
            // 3) Any pending join-request for this country: dropped locally now, deleted in
            //    the DB only AFTER a status write lands, so the delegate's phone never sees
            //    the request vanish while it still reads absent (it would show "denied").
            onJoinRequestResolved?.(d.country);
            resolveJoinRequestsOnAdmit(committee.id, d.id, d.country, desired, committee.code, committee.dbChairJoinSuffix ?? undefined);
          };

          // The row is the button: keyboard users get the same add / remove / recognise
          // action as a click. Only when the click would do something for this chair.
          const rowActionable = !!onAddToList && !isViewOnly && (!isAbsent || canRecognise);
          // The speaker holding the floor, in the queue view (#1) or the A-Z views.
          const isSpeakingRow = isUpNext || isCurrentSpeaker;
          // The status slider (roll call, Roll Call tab) takes ~120px of the row, so that mode
          // runs a size down to keep names readable at the sidebar's minimum width.
          const sliderMode = isRollCallPhase || showStatusSliders;
          // Present vs Present-and-Voting is colour-coded ONLY while taking roll (sliderMode).
          // Outside it both read the same neutral tint; absent stays clear and says so.
          const rowBg = !matchesSearch ? 'transparent'
            : isLifted ? '#24503A'
            : isSpeakingRow ? 'rgba(238,217,138,0.14)'
            : isAbsent ? 'transparent'
            : !sliderMode ? 'rgba(237,231,216,0.07)'
            : effectiveStatus === 'present' ? 'rgba(61,122,82,0.26)'
            : 'rgba(182,135,31,0.20)';
          const rowBgHover = !matchesSearch ? 'transparent'
            : isLifted ? '#24503A'
            : isSpeakingRow ? 'rgba(238,217,138,0.20)'
            : isAbsent ? 'rgba(237,231,216,0.06)'
            : !sliderMode ? 'rgba(237,231,216,0.12)'
            : effectiveStatus === 'present' ? 'rgba(61,122,82,0.40)'
            : 'rgba(182,135,31,0.32)';
          // Round flags, 5% up from 48 / 34 / 40 (15 Sep 2026).
          const flagPx = isUpNext ? 50 : sliderMode ? 36 : 42;

          return (
            <div
              key={d.id}
              data-reorder-id={isReorderable ? d.id : undefined}
              className="relative"
              style={isLifted ? { zIndex: 20, willChange: 'transform' } : undefined}
            >
              {dropLine && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1.5 flex items-center"
                  style={dropLine === 'before' ? { top: -3.5, height: 3 } : { bottom: -3.5, height: 3 }}
                >
                  <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: '#EED98A', marginInlineStart: -1 }} />
                  <span className="flex-1 h-[2.5px] rounded-full" style={{ backgroundColor: '#EED98A' }} />
                </div>
              )}
              <div
                data-matches={matchesSearch ? 'true' : 'false'}
                onClick={handleRowClick}
                onPointerDown={isReorderable ? (e) => startPointerDrag(e, d.id, false) : undefined}
                role={rowActionable ? 'button' : undefined}
                tabIndex={rowActionable ? 0 : undefined}
                aria-current={isSpeakingRow ? 'true' : undefined}
                onKeyDown={rowActionable ? (e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); }
                } : undefined}
                className={`group/seat flex items-center ${sliderMode ? 'gap-2' : 'gap-3'} px-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/80 transition-[background-color,box-shadow,opacity] duration-150 motion-reduce:transition-none bg-[var(--row-bg)] hover:bg-[var(--row-bg-hover)] ${
                  !matchesSearch ? 'opacity-25' : ''
                } ${
                  (!isRollCallPhase && !showStatusSliders && onAddToList && (!isAbsent || (canRecognise && !isViewOnly))) || isRollCallPhase || showStatusSliders
                    ? 'cursor-pointer'
                    : isAbsent && !isRollCallPhase && !showStatusSliders
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                style={{
                  ['--row-bg' as string]: rowBg,
                  ['--row-bg-hover' as string]: rowBgHover,
                  minHeight: isUpNext ? 64 : sliderMode ? 48 : 54,
                  paddingBlock: 6,
                  // A lit edge, not a border: the speaker's row reads at a distance.
                  boxShadow: isLifted
                    ? '0 10px 28px rgba(0,0,0,0.38), 0 2px 6px rgba(0,0,0,0.25), inset 0 0 0 1.5px rgba(238,217,138,0.55)'
                    : matchesSearch && isSpeakingRow ? 'inset 0 0 0 1.5px rgba(238,217,138,0.6)' : undefined,
                } as React.CSSProperties}
              >
                <div className="relative shrink-0">
                  {isRoomOrderTdT && queuePos !== null ? (
                    <div className="rounded-full bg-[#DDD4C0] flex items-center justify-center" style={{ width: flagPx, height: flagPx }}>
                      <span className={`font-black text-[#8B5A20] tabular-nums ${isUpNext ? 'text-xl' : 'text-base'}`}>{queuePos}</span>
                    </div>
                  ) : (
                    <SeatCircleFlag
                      country={d.country}
                      size={flagPx}
                      decorative
                      // A custom seat with no crest shows its initials here, not the glyph.
                      fallback="initials"
                      monogramColors={SIDEBAR_MONOGRAM}
                      ring={isSpeakingRow ? false : 'rgba(255,255,255,0.18)'}
                      style={{
                        // A soft lift so the disc sits above the forest ground, not in it.
                        boxShadow: isSpeakingRow
                          ? '0 0 0 2.5px #EED98A, 0 2px 6px rgba(0,0,0,0.32)'
                          : '0 1px 2px rgba(0,0,0,0.30), 0 2px 7px rgba(0,0,0,0.22)',
                        opacity: isAbsent ? 0.5 : 1,
                        filter: isAbsent ? 'grayscale(0.7)' : undefined,
                      }}
                    />
                  )}
                  {/* Observer placard toggle (the megaphone), a small badge touching the flag at its
                      bottom inline-end edge (15 Sep 2026; it used to sit at the row's end). Its own
                      button: the click stops at it, and a pointerdown on a button never starts the
                      row drag (startPointerDrag). Gold when the delegation is an observer; faint
                      until the row is hovered otherwise, always shown while taking roll. A
                      Commenter or an ended session sees it as a plain badge on observer rows only. */}
                  {!(isReadOnly || isViewOnly) ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleObserver(d.id, isObserver); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      title={isObserver ? t('rollcall_observer_remove') : t('rollcall_observer_make')}
                      aria-label={isObserver ? t('rollcall_observer_remove') : t('rollcall_observer_make')}
                      aria-pressed={isObserver}
                      className={`absolute -bottom-1 -end-1.5 w-[21px] h-[21px] rounded-full flex items-center justify-center transition-[opacity,transform,background-color] duration-150 active:scale-[0.9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:opacity-100 before:absolute before:-inset-1.5 before:content-[''] ${
                        isObserver || sliderMode ? '' : 'opacity-45 group-hover/seat:opacity-100 [@media(hover:none)]:opacity-80'
                      }`}
                      style={{
                        backgroundColor: isObserver ? '#EED98A' : '#2A5A3C',
                        color: isObserver ? '#1B3828' : 'rgba(237,231,216,0.85)',
                        boxShadow: '0 0 0 1.5px #1B3828, 0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Megaphone size={11} strokeWidth={2.5} aria-hidden />
                    </button>
                  ) : (!sliderMode && isObserver) ? (
                    <span
                      role="img"
                      aria-label={t('rollcall_observer')}
                      title={t('rollcall_observer')}
                      className="absolute -bottom-1 -end-1.5 w-[21px] h-[21px] rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#EED98A', color: '#1B3828', boxShadow: '0 0 0 1.5px #1B3828, 0 1px 3px rgba(0,0,0,0.3)' }}
                    >
                      <Megaphone size={11} strokeWidth={2.5} aria-hidden />
                    </span>
                  ) : null}
                  {/* Queue position, or a microphone for the speaker holding the floor. Omitted
                      for a Room Order Tour de Table, where the number already IS the disc. */}
                  {queuePos !== null && !isRoomOrderTdT && (
                    <div
                      className="absolute -top-1 -end-1.5 min-w-[21px] h-[21px] px-1 rounded-full flex items-center justify-center font-black leading-none text-[11.5px] tabular-nums"
                      style={{ backgroundColor: isCurrentSpeakerInPanel ? '#EED98A' : '#EDE7D8', color: '#1B3828', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      aria-label={isCurrentSpeakerInPanel ? t('rollcall_speaking') : t('rollcall_queue_position', { n: queuePos })}
                      role="img"
                    >
                      {isCurrentSpeakerInPanel ? <Mic size={11} strokeWidth={3} aria-hidden /> : queuePos <= 99 ? queuePos : '99+'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span
                    className="truncate"
                    style={{
                      fontSize: isUpNext ? 19.5 : sliderMode ? 15.5 : 17,
                      fontWeight: isUpNext ? 800 : isAbsent ? 500 : 600,
                      lineHeight: 1.2,
                      color: isAbsent ? 'rgba(237,231,216,0.72)' : '#F4EFE3',
                    }}
                  >
                    {getCountryDisplayName(d.country, language)}
                  </span>
                  {isSpeakingRow && matchesSearch && !sliderMode && (
                    <span className="truncate uppercase" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1.3, color: '#EED98A' }}>
                      {t('rollcall_speaking')}
                    </span>
                  )}
                </div>
                {isObserver && sliderMode && (
                  <span className="text-[10.5px] shrink-0 font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(238,217,138,0.16)', color: '#EED98A' }}>{t('rollcall_observer')}</span>
                )}
                {/* Absent says so in words outside roll call. Present and Present-and-Voting are
                    deliberately NOT told apart here (no PV tag, no tint): the slider carries that
                    distinction while taking roll. */}
                {!sliderMode && matchesSearch && isAbsent && (
                  <span className="text-[11px] shrink-0 font-bold uppercase tracking-wider" style={{ color: 'rgba(237,231,216,0.72)' }}>{t('rollcall_absent')}</span>
                )}
                {/* Reorder grip: drag with a mouse, finger or pen, or ArrowUp / ArrowDown. Faint
                    until the row is hovered; always visible on touch screens (no hover). */}
                {isReorderable && (
                  <button
                    type="button"
                    aria-label={t('rollcall_reorder_handle', { country: getCountryDisplayName(d.country, language) })}
                    title={t('rollcall_reorder_hint')}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => gripKeyDown(e, d.id)}
                    onPointerDown={(e) => startPointerDrag(e, d.id, true)}
                    className={`shrink-0 -me-1 w-7 h-9 flex items-center justify-center rounded-md transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70 focus-visible:opacity-100 group-hover/seat:opacity-100 [@media(hover:none)]:opacity-80 ${
                      isLifted ? 'opacity-100 cursor-grabbing' : 'opacity-45 cursor-grab'
                    }`}
                    style={{ color: '#EDE7D8', touchAction: 'none' }}
                  >
                    <GripVertical size={17} aria-hidden />
                  </button>
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

      <div className="px-3 py-3 space-y-2 shrink-0 overflow-visible relative z-10" style={{ backgroundColor: 'rgba(0,0,0,0.14)' }}>
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
    // The caucus speaker at #1 and the join requests an absent-row click resolves.
    prev.committee.caucus?.currentSpeaker === next.committee.caucus?.currentSpeaker &&
    prev.committee.pendingMotions === next.committee.pendingMotions &&
    prev.committee.endedAt === next.committee.endedAt &&
    prev.isRollCallPhase === next.isRollCallPhase &&
    prev.showStatusSliders === next.showStatusSliders &&
    prev.showBulkActions === next.showBulkActions &&
    prev.speechRunning === next.speechRunning &&
    prev.canAddToList === next.canAddToList &&
    prev.isReadOnly === next.isReadOnly &&
    prev.isViewOnly === next.isViewOnly &&
    prev.isTdT === next.isTdT &&
    prev.isRoomOrderTdT === next.isRoomOrderTdT &&
    prev.onListIds === next.onListIds &&
    prev.onReorderList === next.onReorderList &&
    prev.onRemoveCurrentSpeaker === next.onRemoveCurrentSpeaker
  );
});

export default RollCallPanel;
