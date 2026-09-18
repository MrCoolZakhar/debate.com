'use client';

/**
 * The draggable divider between the chair console's roster sidebar and the
 * main floor view. Mounted by ChairSidebarShell, at the inline-end edge of the
 * sidebar slot, in both the expanded and the collapsed state.
 *
 * ── WHY IT NEVER RENDERS DURING THE DRAG ──────────────────────────────────
 * AGENTS.md RULE 3 exists because 1-second timer ticks that went through React
 * state re-rendered the whole 4,000-line chair page. A pointer drag fires far
 * faster than 1 Hz, so routing every pointermove through `setState` would be the
 * same mistake with a worse duty cycle. Instead every move calls `onLive(raw)`,
 * which the shell paints straight onto the DOM, and ONE `onRelease(raw)` lands on
 * pointerup. The raw width is NOT clamped to the minimum: below it the shell
 * previews the fold, and a release below SIDEBAR_COLLAPSE_AT collapses.
 *
 * Nothing here goes anywhere near the committee object: no `updateLocal`, no
 * `setCommittee`, and therefore RULE 4's `localUpdateTime` debounce clock is
 * never touched.
 *
 * ── ACCESSIBILITY ─────────────────────────────────────────────────────────
 * `role="separator"` + `aria-orientation="vertical"` + `aria-valuenow/min/max`,
 * focusable. ←/→ resize by SIDEBAR_KEY_STEP; shrinking at the minimum collapses,
 * growing while collapsed expands. Home = minimum, End = maximum, Enter toggles.
 *
 * ── LAYOUT ────────────────────────────────────────────────────────────────
 * Zero layout width. An 8px strip centred on the edge takes the pointer, and a
 * small grip pill appears just outside the sidebar on hover, focus or drag.
 */

import { useEffect, useRef, useState } from 'react';
import {
  SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_RAIL_WIDTH, SIDEBAR_KEY_STEP, clampSidebarWidth,
} from '@/lib/sidebarWidth';
import { GripVertical } from 'lucide-react';

/** Grabbable width of the edge strip, centred on the sidebar's edge. */
const HIT = 8;

export default function SidebarResizer({
  width,
  maxWidth = SIDEBAR_MAX_WIDTH,
  collapsed,
  onLive,
  onRelease,
  onCommit,
  onCollapsedChange,
  label = 'Resize the delegates sidebar',
}: {
  /** The committed width, in px. Source of truth between drags. */
  width: number;
  /** The largest width this screen allows (ChairSidebarShell's proportional cap). */
  maxWidth?: number;
  /** The sidebar is folded to its flag column. */
  collapsed: boolean;
  /** Every pointer move: the raw width under the pointer (never below the rail width). */
  onLive: (raw: number) => void;
  /** Pointer released: the raw width. The shell decides collapse / snap / commit. */
  onRelease: (raw: number) => void;
  /** A keyboard resize, already clamped. */
  onCommit: (width: number) => void;
  /** A keyboard (or double-click) collapse / expand. */
  onCollapsedChange: (collapsed: boolean) => void;
  label?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Latest width produced by the in-flight drag. A ref, not state, so moving
  // the pointer never renders anything.
  const liveRef = useRef(width);
  const startXRef = useRef(0);
  const startWRef = useRef(width);
  const movedRef = useRef(false);

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shown = collapsed ? SIDEBAR_RAIL_WIDTH : width;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left button / touch / pen only; a right-click must not start a drag.
    if (e.button !== 0) return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* gone */ }
    startXRef.current = e.clientX;
    startWRef.current = shown;
    liveRef.current = shown;
    movedRef.current = false;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    // The divider sits at the sidebar's INLINE-END edge, so in RTL a rightward
    // pointer move must narrow it. Reading the computed direction keeps the
    // gesture correct in both, rather than assuming LTR.
    const rtl = typeof document !== 'undefined'
      && getComputedStyle(document.documentElement).direction === 'rtl';
    const sign = rtl ? -1 : 1;
    // The console is drawn inside FitToScreen's scale(): screen pixels are not layout pixels.
    const root = document.getElementById('fit-root');
    const scale = root ? (root.getBoundingClientRect().height / (root.offsetHeight || 1)) || 1 : 1;

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startXRef.current) / scale;
      if (!movedRef.current && Math.abs(dx) < 3) return;
      movedRef.current = true;
      const next = Math.round(Math.min(maxWidth, Math.max(SIDEBAR_RAIL_WIDTH, startWRef.current + sign * dx)));
      liveRef.current = next;
      onLive(next);
    };
    const up = () => {
      setDragging(false);
      if (movedRef.current) onRelease(liveRef.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // A drag over the whole window must not select the roster text under it.
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [dragging, onLive, onRelease, maxWidth]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = typeof document !== 'undefined'
      && getComputedStyle(document.documentElement).direction === 'rtl';
    const grow = rtl ? 'ArrowLeft' : 'ArrowRight';
    const shrink = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === 'Enter') { e.preventDefault(); onCollapsedChange(!collapsed); return; }
    if (collapsed) {
      if (e.key === grow || e.key === 'End' || e.key === 'Home') {
        e.preventDefault();
        onCollapsedChange(false);
        if (e.key === 'End') onCommit(maxWidth);
        if (e.key === 'Home') onCommit(SIDEBAR_MIN_WIDTH);
      }
      return;
    }
    let next: number | null = null;
    if (e.key === grow) next = width + SIDEBAR_KEY_STEP;
    else if (e.key === shrink) {
      if (width <= SIDEBAR_MIN_WIDTH) { e.preventDefault(); onCollapsedChange(true); return; }
      next = width - SIDEBAR_KEY_STEP;
    }
    else if (e.key === 'Home') next = SIDEBAR_MIN_WIDTH;
    else if (e.key === 'End') next = maxWidth;
    if (next === null) return;
    e.preventDefault();
    onCommit(Math.min(maxWidth, clampSidebarWidth(next)));
  };

  const lit = dragging || focused || hovered;

  return (
    // Zero layout width, pinned to the slot's inline-end edge. The grabbable strip (HIT px,
    // centred on the edge) and the grip pill just OUTSIDE the edge are absolutely positioned
    // over both columns, so neither costs the floor view a pixel.
    <div className="absolute inset-y-0 z-30" style={{ insetInlineEnd: 0, width: 0 }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={shown}
        aria-valuemin={SIDEBAR_RAIL_WIDTH}
        aria-valuemax={maxWidth}
        aria-valuetext={`${shown} pixels`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => (collapsed ? onCollapsedChange(false) : onCommit(clampSidebarWidth(SIDEBAR_MIN_WIDTH)))}
        title={label}
        className="absolute inset-y-0 focus:outline-none"
        style={{
          insetInlineStart: -HIT / 2,
          width: HIT,
          cursor: 'col-resize',
          touchAction: 'none',
        }}
      >
        {/* The edge itself: a 2px rule that lights gold while live. Decoration only. */}
        <span
          aria-hidden
          className="absolute inset-y-0 pointer-events-none"
          style={{
            insetInlineStart: HIT / 2 - 1,
            width: 2,
            backgroundColor: lit ? (collapsed ? 'rgba(27,56,40,0.35)' : '#EED98A') : 'transparent',
            opacity: dragging ? 1 : 0.7,
            transition: reduceMotion ? 'none' : 'background-color 160ms ease, opacity 160ms ease',
          }}
        />
        {/* The grip, just outside the sidebar, on the floor side. Shown while hovered,
            focused or dragging; it is part of the separator, so it can be grabbed too. */}
        <span
          aria-hidden
          className="absolute top-1/2 flex items-center justify-center rounded-full"
          style={{
            insetInlineStart: HIT / 2 + 3,
            width: 16,
            height: 40,
            marginTop: -20,
            backgroundColor: dragging ? '#EED98A' : '#1B3828',
            color: dragging ? '#1B3828' : '#EED98A',
            boxShadow: focused
              ? '0 0 0 2px #EED98A, 0 2px 8px rgba(27,56,40,0.35)'
              : '0 1px 2px rgba(27,56,40,0.3), 0 3px 10px rgba(27,56,40,0.22)',
            opacity: lit ? 1 : 0,
            // Invisible = not there: never swallow a click on the floor's edge.
            pointerEvents: lit ? 'auto' : 'none',
            transform: lit ? 'scale(1)' : 'scale(0.9)',
            transition: reduceMotion ? 'none' : 'opacity 160ms ease, transform 160ms cubic-bezier(0.2,0,0,1), background-color 160ms ease',
          }}
        >
          <GripVertical size={12} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}
