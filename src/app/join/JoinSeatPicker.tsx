'use client';

// ─────────────────────────────────────────────────────────────────────────────
// JoinSeatPicker — the delegate's seat list on /join.
//
// It replaces a native <select> of up to 200 country names. A delegate looking
// for "Türkiye" in a General Assembly roster had to scroll a system dropdown
// with no flags and a " · Taken" suffix glued onto the label; now the seat is a
// row with its round flag (or its crest), its name in the reader's language,
// and its state as a chip.
//
// CONTRACT. This component decides NOTHING about who may sit where. The caller
// passes each seat's `state` ('open' | 'taken' | 'reserved' | 'removed' | 'mine')
// already resolved from `seatClaims` + the conference's reserved list, and a blocked
// seat is simply not selectable here. /delegate still claims the seat and is
// the authority for races (AGENTS.md, JOIN PAGE).
//
// KEYBOARD. A combobox: the search field keeps focus, ArrowUp/ArrowDown move
// the active row (skipping blocked seats), Home/End jump, Enter takes the seat,
// Escape clears the search. Rows are `option`s announced through
// `aria-activedescendant`, so a screen reader follows without a focus trap.
//
// 200 SEATS. The list is one scroll container of plain rows; each row carries
// `content-visibility: auto` with a reserved intrinsic height, so off-screen
// rows cost nothing to lay out and the flags below the fold are never fetched
// (CircleFlag loads lazily). Filtering is one memo over a pre-folded index.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Lock, Megaphone, Search, UserRound, UserX, X } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { countryMatchRank, getCountryDisplayName } from '@/lib/countries';
import { C, OUTFIT } from './joinUi';

/** 'removed' = a chair removed this device from this seat in the last 10 minutes. */
export type SeatTone = 'open' | 'taken' | 'reserved' | 'removed' | 'mine';

export interface JoinSeatRow {
  /** The roster value, exactly as `delegates.country` stores it. */
  country: string;
  logoUrl?: string | null;
  isObserver?: boolean;
  state: SeatTone;
}

export interface SeatPickerLabels {
  search: string;
  taken: string;
  reserved: string;
  removed: string;
  yours: string;
  observer: string;
  empty: string;
  clear: string;
  rosterEmpty: string;
  /** "12 of 189 seats open" — already interpolated by the caller. */
  counter: string;
}

const ROW_H = 46;

/** Diacritic- and case-insensitive, like `countries.ts` does internally. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function JoinSeatPicker({
  seats, value, onChange, language, labels, blockedNote, onReservedPick, reservedPicked,
}: {
  seats: JoinSeatRow[];
  value: string;
  onChange: (country: string) => void;
  language: string;
  labels: SeatPickerLabels;
  /** One line under the list (e.g. why some seats read Taken). */
  blockedNote?: React.ReactNode;
  /** When given, a RESERVED seat can be pointed at (never taken): the page then
   *  says who the seat is held for and offers sign in / sign up. */
  onReservedPick?: (country: string) => void;
  /** The reserved seat currently pointed at, drawn with a gold outline. */
  reservedPicked?: string;
}) {
  const [query, setQuery] = useState('');
  // The keyboard cursor is only drawn while the search field has focus, so a
  // resting list never shows a highlight that looks like a choice.
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<string>(value);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Pre-folded once per roster, so typing never re-normalises 200 strings.
  const index = useMemo(
    () => seats.map((s, i) => {
      const label = getCountryDisplayName(s.country, language);
      return { seat: s, label, at: i, hay: `${fold(s.country)} ${fold(label)}` };
    }),
    [seats, language],
  );

  const rows = useMemo(() => {
    const q = query.trim();
    if (!q) return index;
    const folded = fold(q);
    return index
      .map((row) => {
        // Countries rank through the shared matcher (aliases, localized names,
        // "uk" → United Kingdom). Custom seats fall back to a substring hit.
        const rank = countryMatchRank(row.seat.country, q, language);
        if (rank !== null) return { row, rank };
        if (folded && row.hay.includes(folded)) return { row, rank: 3 };
        return null;
      })
      .filter((r): r is { row: typeof index[number]; rank: number } => r !== null)
      .sort((a, b) => a.rank - b.rank || a.row.at - b.row.at)
      .map((r) => r.row);
  }, [index, query, language]);

  const selectable = (s: JoinSeatRow) => s.state === 'open' || s.state === 'mine';
  const pointable = (s: JoinSeatRow) => selectable(s) || (!!onReservedPick && s.state === 'reserved');
  const pick = (s: JoinSeatRow) => {
    if (selectable(s)) onChange(s.country);
    else if (onReservedPick && s.state === 'reserved') onReservedPick(s.country);
  };

  // Keep the active row inside the filtered list (derived, never an effect).
  const current = rows.some((r) => r.seat.country === active)
    ? active
    : ((rows.find((r) => pointable(r.seat)) ?? rows[0])?.seat.country ?? '');
  const currentAt = index.find((r) => r.seat.country === current)?.at ?? -1;

  // Follow the active row with the scroll container, never the page.
  useEffect(() => {
    if (!current || !listRef.current) return;
    const list = listRef.current;
    const el = list.querySelector<HTMLElement>(`[data-seat="${CSS.escape(current)}"]`);
    if (!el) return;
    // Scroll the list only. scrollIntoView would also scroll the page on a phone.
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop + 6) list.scrollTop = top - 6;
    else if (bottom > list.scrollTop + list.clientHeight - 6) list.scrollTop = bottom - list.clientHeight + 6;
  }, [current]);

  const move = (delta: number) => {
    const pool = rows.filter((r) => pointable(r.seat));
    if (pool.length === 0) return;
    const at = pool.findIndex((r) => r.seat.country === current);
    const next = at === -1
      ? (delta > 0 ? 0 : pool.length - 1)
      : (at + delta + pool.length) % pool.length;
    setActive(pool[next].seat.country);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Home') {
      const first = rows.find((r) => pointable(r.seat));
      if (first) { e.preventDefault(); setActive(first.seat.country); }
      return;
    }
    if (e.key === 'End') {
      const pool = rows.filter((r) => pointable(r.seat));
      if (pool.length) { e.preventDefault(); setActive(pool[pool.length - 1].seat.country); }
      return;
    }
    if (e.key === 'Enter') {
      const row = rows.find((r) => r.seat.country === current);
      if (row && pointable(row.seat)) { e.preventDefault(); pick(row.seat); }
      return;
    }
    if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); }
  };

  // Seat state as an icon and plain words, never a pill (CLAUDE.md §8).
  const stateText = (icon: ReactNode, text: string, color: string) => (
    <span className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color }}>
      {icon}{text}
    </span>
  );
  const chipFor = (s: JoinSeatRow) => {
    if (s.state === 'mine') return stateText(<Check size={12} strokeWidth={3} />, labels.yours, C.moss);
    if (s.state === 'reserved') return stateText(<Lock size={11} strokeWidth={2.6} />, labels.reserved, '#8A6414');
    if (s.state === 'removed') return stateText(<UserX size={12} strokeWidth={2.6} />, labels.removed, '#9B2C22');
    if (s.state === 'taken') return stateText(<UserRound size={12} strokeWidth={2.6} />, labels.taken, C.inkSoft);
    return null;
  };

  return (
    // `gv-join-picker` / `gv-join-picker-list` are hooks for the desktop one-screen
    // fit in page.tsx (JOIN_FIT_CSS): there the list takes the flexible space of the
    // stage instead of its fixed height. Presentation only.
    <div className="gv-join-picker">
      {/* Search + counter */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 flex items-center"
            style={{ insetInlineStart: 12, color: C.muted }}
          >
            <Search size={16} strokeWidth={2.4} />
          </span>
          <input
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={currentAt >= 0 ? `${listId}-o${currentAt}` : undefined}
            aria-label={labels.search}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={labels.search}
            className="w-full focus:outline-none"
            style={{
              height: 44, borderRadius: 14, paddingInlineStart: 36, paddingInlineEnd: query ? 36 : 12,
              backgroundColor: C.surfaceAlt, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.12)',
              fontFamily: OUTFIT, fontSize: 14.5, color: C.ink,
            }}
            onFocus={(e) => { setFocused(true); e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${C.forest}`; }}
            onBlur={(e) => { setFocused(false); e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(27,56,40,0.12)'; }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={labels.clear}
              className="absolute inset-y-0 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
              style={{ insetInlineEnd: 4, width: 36, color: C.inkSoft, cursor: 'pointer' }}
            >
              <X size={15} strokeWidth={2.6} />
            </button>
          )}
        </div>
        <span
          className="hidden flex-shrink-0 sm:block"
          style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: C.muted, fontVariantNumeric: 'tabular-nums' }}
        >
          {labels.counter}
        </span>
      </div>

      {/* The list. Fixed height in every state, so the card never resizes. */}
      <div
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={labels.search}
        className="gv-join-picker-list relative h-[272px] overflow-y-auto overscroll-contain sm:h-[300px]"
        style={{
          borderRadius: 18,
          backgroundColor: C.surfaceAlt,
          boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)',
          padding: 6,
        }}
      >
        {seats.length === 0 ? (
          <EmptyState text={labels.rosterEmpty} />
        ) : rows.length === 0 ? (
          <EmptyState text={labels.empty} action={{ label: labels.clear, onClick: () => setQuery('') }} />
        ) : (
          rows.map(({ seat, label, at }) => {
            const picked = value === seat.country;
            const isActive = focused && current === seat.country;
            const can = selectable(seat);
            const point = pointable(seat);
            const pointed = !can && point && reservedPicked === seat.country;
            return (
              <div
                key={seat.country}
                id={`${listId}-o${at}`}
                data-seat={seat.country}
                role="option"
                aria-selected={picked}
                aria-disabled={!point}
                tabIndex={-1}
                onClick={() => { if (point) { setActive(seat.country); pick(seat); } }}
                className="flex items-center gap-2.5"
                style={{
                  height: ROW_H,
                  contentVisibility: 'auto',
                  containIntrinsicSize: `0 ${ROW_H}px`,
                  paddingInline: 10,
                  borderRadius: 12,
                  cursor: point ? 'pointer' : 'default',
                  opacity: point ? 1 : 0.55,
                  backgroundColor: picked ? C.forest : pointed ? 'rgba(238,217,138,0.40)' : isActive && point ? 'rgba(27,56,40,0.07)' : 'transparent',
                  boxShadow: picked
                    ? `inset 0 0 0 1.5px ${C.gold}, 0 4px 12px rgba(27,56,40,0.22)`
                    : pointed ? 'inset 0 0 0 1.5px rgba(182,135,31,0.7)'
                    : isActive && point ? 'inset 0 0 0 1px rgba(27,56,40,0.14)' : 'none',
                  transitionProperty: 'background-color, box-shadow, opacity',
                  transitionDuration: '140ms',
                }}
              >
                <CircleFlag
                  country={seat.country}
                  logoUrl={seat.logoUrl ?? null}
                  size={30}
                  decorative
                  ring={picked ? 'rgba(238,217,138,0.5)' : true}
                />
                <span className="min-w-0 flex-1 truncate" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: picked ? 700 : 600, color: picked ? C.page : C.ink }}>
                  {label}
                </span>
                {seat.isObserver && (
                  <span role="img" aria-label={labels.observer} title={labels.observer} className="flex flex-shrink-0" style={{ color: picked ? C.gold : '#8A6414' }}>
                    <Megaphone size={15} strokeWidth={2.2} />
                  </span>
                )}
                {picked ? <Check size={17} strokeWidth={3} color={C.gold} /> : chipFor(seat)}
              </div>
            );
          })
        )}
      </div>

      {blockedNote && (
        <div className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5, color: C.inkSoft, textWrap: 'pretty' }}>
          {blockedNote}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        className="flex items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest }}
      >
        <Search size={19} strokeWidth={2.2} />
      </span>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: C.inkSoft, textWrap: 'pretty', maxWidth: 260 }}>{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 active:scale-[0.96]"
          style={{
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.forest,
            minHeight: 44, cursor: 'pointer',
            padding: '8px 14px', borderRadius: 12, backgroundColor: 'rgba(27,56,40,0.06)',
            boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.12)',
            transitionProperty: 'background-color, transform', transitionDuration: '150ms',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
