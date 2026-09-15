'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SidebarFlagRail: the chair sidebar, collapsed (15 Sep 2026).
//
// No panel and no rail background: a narrow column that floats on the page ground with
// the committee emblem at the top, then the round flags of the queue in speaking order,
// the delegation holding the floor first (gold ring + microphone), then the list with
// small order numbers. Every item is a button that reopens the sidebar, and so is the
// emblem; the divider beside the column (SidebarResizer) drags it back open too.
//
// Reads the SAME committee object the expanded RollCallPanel is given (the GSL, or the
// caucus queue with `currentSpeaker: null` and the caucus speaker in `caucus`), so the two
// views can never disagree about the order. Memoised on the fields it reads, so a timer
// tick on the chair page does not re-render it.
//
// ── REORDER (15 Sep 2026) ────────────────────────────────────────────────────
// With `onReorderList` (the Moderator, session not ended) the QUEUED flags can be dragged
// up and down, exactly like the expanded list: the speaker holding the floor is never
// draggable and never a drop target. A mouse or pen lifts a flag after ROW_SLOP px; a
// finger lifts it after a LONG_PRESS_MS hold (moving first scrolls instead). A click with
// no movement still reopens the sidebar. ArrowUp / ArrowDown on a focused flag moves it one
// place. The drop is committed through the SAME `onReorderList` the expanded list uses
// (handleReorderSpeakersList / handleReorderCaucusQueue -> updateLocal + the chained
// reorderSpeakersList RPC), with the full list built the same way. Per-move work writes
// the DOM through a ref; React state changes only when the drop slot changes. Nothing here
// touches the committee object directly, updateLocal or localUpdateTime (RULES 3/4).
//
// The column stops above the floor's bottom add bar: its bottom padding reads
// `--floor-bar-h`, which the chair page publishes, and while collapsed it paints that
// bar's ground under itself so the bar reads as running the full width of the page.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import type { Committee } from '@/lib/types';
import { getCountryDisplayName } from '@/lib/countries';
import { SeatCircleFlag, RAIL_MONOGRAM } from '@/components/CircleFlag';
import { CommitteeEmblem } from '@/components/CommitteeIdentityBadge';
import { liveCaucus } from '@/components/FeedbackLogPanel';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { SIDEBAR_RAIL_WIDTH } from '@/lib/sidebarWidth';

const FLAG = 40;
const SPEAKER_FLAG = 44;
/** Flags drawn before the column says "+N more": keeps it inside an 820px-tall console. */
const MAX_FLAGS = 12;
/** Mouse / pen movement before a flag lifts (below it, the press is a click). */
const ROW_SLOP = 5;
/** Touch: hold this long without moving to lift a flag. */
const LONG_PRESS_MS = 350;
/** Touch: moving further than this before the hold completes scrolls instead. */
const TOUCH_CANCEL = 8;
/** How far a lifted flag moves toward the floor, clear of the drop line. 10 keeps it and its
 *  number badge inside the column, which clips (overflow-y: auto). */
const LIFT_NUDGE = 10;
/** The chair page's paper grain (the same SVG noise the console root draws). */
const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

type ListEntry = { delegateId: string; country: string };

interface DragState {
  id: string;
  pointerId: number;
  touch: boolean;
  startY: number;
  startX: number;
  lastY: number;
  active: boolean;
  slot: number;
  el: HTMLElement | null;
  scale: number;
  timer: number | null;
  /** Horizontal offset of the lifted flag, toward the inline end (px). */
  nudge: number;
}

function SidebarFlagRailInner({
  committee,
  emblem,
  onExpand,
  onReorderList,
}: {
  committee: Committee;
  emblem: { src: string | null; monogram: string; alt: string };
  onExpand: () => void;
  /** The expanded list's reorder handler. Omit for a Commenter, an ended session, or a
   *  list that is not reorderable (the unmoderated caucus). Must be stable (memo key). */
  onReorderList?: (next: ListEntry[]) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  // The latest onExpand without making it a memo key: the chair page passes an inline arrow
  // and re-renders every second while a clock runs.
  const expandRef = useRef(onExpand);
  useEffect(() => { expandRef.current = onExpand; });
  const expand = () => expandRef.current();
  const caucus = liveCaucus(committee);
  const byId = new Map(committee.delegates.map((d) => [d.id, d]));
  const speaker = committee.currentSpeaker?.delegateId
    ? byId.get(committee.currentSpeaker.delegateId) ?? null
    : (caucus?.currentSpeaker ? committee.delegates.find((d) => d.country === caucus.currentSpeaker) ?? null : null);
  const queue = (committee.speakersList ?? [])
    .map((s) => byId.get(s.delegateId))
    .filter((d): d is NonNullable<typeof d> => !!d && d.id !== speaker?.id);
  const entries = [
    ...(speaker ? [{ d: speaker, speaking: true }] : []),
    ...queue.map((d) => ({ d, speaking: false })),
  ];
  const shown = entries.slice(0, MAX_FLAGS);
  const more = entries.length - shown.length;
  const expandLabel = t('sidebar_expand');

  // ── Reorder ────────────────────────────────────────────────────────────────
  const canReorder = !!onReorderList;
  // Every queued delegation behind the floor, in order (the drop maths), and the ones drawn.
  const reorderIds = canReorder ? queue.map((d) => d.id) : [];
  const shownReorderIds = new Set(shown.filter((e) => !e.speaking).map((e) => e.d.id));

  /** The full list with `id` placed in front of `beforeId` (or after the last queued
   *  delegation when null), built exactly like RollCallPanel's. Null when nothing changes. */
  const buildList = (id: string, beforeId: string | null, ids: string[]): ListEntry[] | null => {
    const list = committee.speakersList ?? [];
    const moved = list.find((s) => s.delegateId === id);
    if (!moved) return null;
    const rest = list.filter((s) => s.delegateId !== id);
    let at: number;
    if (beforeId) {
      at = rest.findIndex((s) => s.delegateId === beforeId);
      if (at < 0) return null;
    } else {
      const others = ids.filter((x) => x !== id);
      const last = others.length ? rest.findIndex((s) => s.delegateId === others[others.length - 1]) : -1;
      at = last >= 0 ? last + 1 : rest.length;
    }
    const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
    return next.every((s, i) => s.delegateId === list[i]?.delegateId) ? null : next;
  };

  const listRef = useRef<HTMLOListElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);
  const [drag, setDrag] = useState<{ id: string; slot: number } | null>(null);
  const [armedPointer, setArmedPointer] = useState<number | null>(null);
  const latestRef = useRef({ reorderIds, buildList, onReorderList });
  useEffect(() => { latestRef.current = { reorderIds, buildList, onReorderList }; });

  // Every drag step lives inside this effect, attached while a press may become a drag
  // (layout effect: attached in the same flush as the pointerdown, so even a very fast
  // click's pointerup is seen). It reads the latest list through latestRef.
  useLayoutEffect(() => {
    if (armedPointer === null) return;
    const paint = () => {
      const st = dragRef.current;
      const list = listRef.current;
      if (!st || !st.active || !list) return;
      // Nudged toward the floor while lifted, so the flag never hides the drop line or the
      // flag it would land in front of (the column is only one flag wide).
      if (st.el) st.el.style.transform = `translate(${st.nudge}px, ${(st.lastY - st.startY) / st.scale}px)`;
      // Slot = how many other queued flags (drawn ones) have their centre above the pointer.
      let slot = 0;
      for (const id of latestRef.current.reorderIds) {
        if (id === st.id) continue;
        const li = list.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(id)}"]`);
        if (!li) break; // not drawn (beyond MAX_FLAGS): nothing below can be a target
        const r = li.getBoundingClientRect();
        if (st.lastY > r.top + r.height / 2) slot++;
      }
      if (slot !== st.slot) { st.slot = slot; setDrag({ id: st.id, slot }); }
    };
    const lift = (st: DragState) => {
      const list = listRef.current;
      if (!list) return;
      st.active = true;
      window.getSelection()?.removeAllRanges();
      st.el = list.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(st.id)}"]`);
      st.slot = latestRef.current.reorderIds.indexOf(st.id);
      setDrag({ id: st.id, slot: st.slot });
      if (st.touch && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(8); } catch {}
      }
    };
    const endDrag = (commit: boolean) => {
      const st = dragRef.current;
      dragRef.current = null;
      setArmedPointer(null);
      if (!st) return;
      if (st.timer !== null) window.clearTimeout(st.timer);
      if (st.el) st.el.style.transform = '';
      if (!st.active) return;
      // A lifted flag never ends in a click (which would reopen the sidebar).
      justDraggedRef.current = true;
      window.setTimeout(() => { justDraggedRef.current = false; }, 400);
      setDrag(null);
      const { reorderIds: ids, buildList: build, onReorderList: commitList } = latestRef.current;
      if (!commit || !commitList) return;
      const others = ids.filter((x) => x !== st.id);
      const next = build(st.id, others[st.slot] ?? null, ids);
      // Optimistic + chained write, owned by the chair page (reorderSpeakersList).
      if (next) commitList(next);
    };

    const pressed = dragRef.current;
    if (pressed?.touch && pressed.timer === null && !pressed.active) {
      pressed.timer = window.setTimeout(() => {
        if (dragRef.current !== pressed) return;
        pressed.timer = null;
        lift(pressed);
        paint();
      }, LONG_PRESS_MS);
    }

    const onMove = (e: PointerEvent) => {
      const st = dragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      st.lastY = e.clientY;
      if (!st.active) {
        const dist = Math.hypot(e.clientX - st.startX, e.clientY - st.startY) / st.scale;
        if (st.touch) {
          // Moved before the hold completed: this is a scroll, not a drag.
          if (dist > TOUCH_CANCEL) endDrag(false);
          return;
        }
        if (dist < ROW_SLOP) return;
        lift(st);
      }
      if (e.cancelable) e.preventDefault();
      paint();
    };
    // A lifted touch must not pan the column: without this the browser takes the gesture
    // and sends pointercancel.
    const onTouchMove = (e: TouchEvent) => { if (dragRef.current?.active && e.cancelable) e.preventDefault(); };
    const onUp = (e: PointerEvent) => { if (dragRef.current?.pointerId === e.pointerId) endDrag(true); };
    const onCancel = (e: PointerEvent) => { if (dragRef.current?.pointerId === e.pointerId) endDrag(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && dragRef.current) endDrag(false); };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedPointer]);

  // While a flag is lifted the page shows the grabbing cursor and selects no text.
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
  // Unmount mid-press (the sidebar reopened, the phase changed): drop the hold timer and
  // any transform left on a lifted flag.
  useEffect(() => () => {
    const st = dragRef.current;
    if (st?.timer) window.clearTimeout(st.timer);
    if (st?.el) st.el.style.transform = '';
  }, []);

  const startPress = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (!canReorder || e.button !== 0 || dragRef.current || !listRef.current) return;
    const list = listRef.current;
    const scale = (list.getBoundingClientRect().height / (list.offsetHeight || 1)) || 1;
    dragRef.current = {
      id, pointerId: e.pointerId, touch: e.pointerType === 'touch',
      startY: e.clientY, startX: e.clientX, lastY: e.clientY,
      active: false, slot: -1, el: null, scale, timer: null,
      nudge: getComputedStyle(list).direction === 'rtl' ? -LIFT_NUDGE : LIFT_NUDGE,
    };
    setArmedPointer(e.pointerId);
  };

  const keyMove = (e: React.KeyboardEvent<HTMLElement>, id: string) => {
    if (!canReorder || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const i = reorderIds.indexOf(id);
    if (i < 0) return;
    const others = reorderIds.filter((x) => x !== id);
    const slot = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (slot < 0 || slot > others.length) return;
    const next = buildList(id, others[slot] ?? null, reorderIds);
    if (next) onReorderList?.(next);
  };

  // Drop indicator, same look as the expanded list (gold dot + line): before the flag the
  // slot points at, or after the last drawn queued flag.
  const dropBefore = (() => {
    if (!drag) return null;
    const origin = reorderIds.indexOf(drag.id);
    if (drag.slot === origin) return null;
    const others = reorderIds.filter((x) => x !== drag.id);
    const target = others[drag.slot];
    if (target && shownReorderIds.has(target)) return { id: target, where: 'before' as const };
    const lastShown = [...others].reverse().find((x) => shownReorderIds.has(x));
    return lastShown ? { id: lastShown, where: 'after' as const } : null;
  })();

  return (
    <nav
      aria-label={t('sidebar_rail_label')}
      className="relative h-full flex flex-col items-center"
      style={{ width: SIDEBAR_RAIL_WIDTH, paddingTop: 12, paddingBottom: 'calc(var(--floor-bar-h, 0px) + 12px)' }}
    >
      {/* The floor's bottom add bar, continued under this column so it runs the full page
          width. Height and presence follow the bar itself (--floor-bar-h, 0 when absent). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: 'var(--floor-bar-h, 0px)', backgroundColor: '#F6F1E9', boxShadow: 'inset 0 1px 0 #DDD4C0' }}
      >
        {/* The page's paper grain sits BELOW this column (the slot is stacked above it), so
            the strip carries the same grain itself, or it reads lighter than the bar. */}
        <span className="absolute inset-0" style={{ backgroundImage: PAPER_GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      </span>
      <button
        type="button"
        onClick={expand}
        aria-label={expandLabel}
        title={expandLabel}
        aria-expanded={false}
        className="shrink-0 rounded-full p-1 transition-transform duration-150 hover:scale-[1.04] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
      >
        <CommitteeEmblem src={emblem.src} monogram={emblem.monogram} alt="" size={46} onLight />
      </button>
      <ol ref={listRef} className="m-0 p-0 list-none flex flex-col items-center gap-2.5 mt-4 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBlock: 6, paddingInline: 8 }}>
        {shown.map(({ d, speaking }, i) => {
          // Same numbering as the expanded list: the floor is #1, the queue follows.
          const n = i + 1;
          const name = getCountryDisplayName(d.country, language);
          const draggable = canReorder && !speaking;
          const baseLabel = speaking ? `${name}, ${t('rollcall_speaking')}` : t('sidebar_rail_item', { country: name, n });
          const label = draggable ? `${baseLabel}. ${t('rollcall_reorder_hint')}` : baseLabel;
          const px = speaking ? SPEAKER_FLAG : FLAG;
          const lifted = drag?.id === d.id;
          const line = dropBefore?.id === d.id ? dropBefore.where : null;
          return (
            <li
              key={d.id}
              data-rail-id={draggable ? d.id : undefined}
              className="relative shrink-0"
              style={lifted ? { zIndex: 20, willChange: 'transform' } : undefined}
            >
              {line && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute flex items-center"
                  style={{ insetInline: -10, height: 3, zIndex: 30, ...(line === 'before' ? { top: -7 } : { bottom: -7 }) }}
                >
                  <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: '#B6871F', marginInlineStart: -1 }} />
                  <span className="flex-1 h-[2.5px] rounded-full" style={{ backgroundColor: '#B6871F' }} />
                </span>
              )}
              <button
                type="button"
                onClick={() => { if (justDraggedRef.current || drag) return; expand(); }}
                onPointerDown={draggable ? (e) => startPress(e, d.id) : undefined}
                onKeyDown={draggable ? (e) => keyMove(e, d.id) : undefined}
                // A long-press lifts the flag; the touch context menu must not open over it.
                onContextMenu={draggable ? (e) => { if (dragRef.current) e.preventDefault(); } : undefined}
                aria-label={`${label}. ${expandLabel}`}
                title={label}
                className={`relative block rounded-full transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8] [-webkit-touch-callout:none] ${
                  lifted ? 'scale-[1.08] cursor-grabbing' : `hover:scale-[1.06] active:scale-[0.96] ${draggable ? 'cursor-grab' : ''}`
                }`}
              >
                <SeatCircleFlag
                  country={d.country}
                  size={px}
                  decorative
                  fallback="initials"
                  monogramColors={RAIL_MONOGRAM}
                  ring={speaking ? false : 'rgba(28,20,16,0.14)'}
                  style={{
                    boxShadow: speaking
                      ? '0 0 0 2.5px #EED98A, 0 0 0 4px #1B3828, 0 3px 10px rgba(27,56,40,0.35)'
                      : lifted
                        ? '0 0 0 2px #B6871F, 0 8px 18px rgba(27,56,40,0.38)'
                        : '0 1px 2px rgba(27,56,40,0.28), 0 3px 9px rgba(27,56,40,0.20)',
                    opacity: d.status === 'absent' ? 0.55 : 1,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute -top-1 -end-1.5 min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center font-black leading-none text-[10.5px] tabular-nums"
                  style={{ backgroundColor: speaking ? '#EED98A' : '#1B3828', color: speaking ? '#1B3828' : '#EDE7D8', boxShadow: '0 0 0 1.5px #EDE7D8, 0 1px 3px rgba(0,0,0,0.25)' }}
                >
                  {speaking ? <Mic size={10} strokeWidth={3} /> : n}
                </span>
              </button>
            </li>
          );
        })}
        {more > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={expand}
              aria-label={`${t('sidebar_rail_more', { n: more })}. ${expandLabel}`}
              className="rounded-full px-2 py-1 tabular-nums transition-colors hover:bg-[rgba(27,56,40,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
              style={{ fontSize: 11, fontWeight: 800, color: '#1B3828' }}
            >
              {t('sidebar_rail_more', { n: more })}
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}

const SidebarFlagRail = React.memo(SidebarFlagRailInner, (a, b) =>
  a.committee.delegates === b.committee.delegates
  && a.committee.speakersList === b.committee.speakersList
  && a.committee.currentSpeaker === b.committee.currentSpeaker
  && a.committee.caucus?.currentSpeaker === b.committee.caucus?.currentSpeaker
  && a.committee.phase === b.committee.phase
  && a.onReorderList === b.onReorderList
  && a.emblem.src === b.emblem.src
  && a.emblem.monogram === b.emblem.monogram,
);

export default SidebarFlagRail;
