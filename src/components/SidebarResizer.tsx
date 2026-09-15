'use client';

/**
 * The draggable divider between the chair console's roster sidebar and the
 * main floor view.
 *
 * ── WHY IT WRITES TO THE DOM DURING THE DRAG ──────────────────────────────
 * AGENTS.md RULE 3 exists because 1-second timer ticks that went through React
 * state re-rendered the whole 4,000-line chair page. A pointer drag fires far
 * faster than 1 Hz, so routing every mousemove through `setState` would be the
 * same mistake with a worse duty cycle. Instead the drag mutates
 * `asideRef.current.style.width` directly and commits ONE `setState` on
 * pointerup.
 *
 * Nothing here goes anywhere near the committee object: no `updateLocal`, no
 * `setCommittee`, and therefore RULE 4's `localUpdateTime` debounce clock is
 * never touched. A resize must never be mistaken for a structural write, or
 * delegate views would stop seeing the head chair's changes for 3 s.
 *
 * ── ACCESSIBILITY ─────────────────────────────────────────────────────────
 * `role="separator"` + `aria-orientation="vertical"` + `aria-valuenow/min/max`,
 * focusable, and driven by ←/→ (plus Home/End for the two extremes). The
 * keyboard path commits state per keypress — that is a handful of renders on
 * deliberate input, not a per-frame stream.
 *
 * `prefers-reduced-motion` removes the settle transition entirely; the width
 * still changes, it just does not animate.
 *
 * ── LAYOUT ────────────────────────────────────────────────────────────────
 * Zero layout width (15 Sep 2026). It used to be a 10px forest gutter between the
 * aside and the floor. Now an 8px strip centred on the edge takes the pointer, and a
 * small grip pill appears just outside the sidebar on hover, focus or drag.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_KEY_STEP, clampSidebarWidth,
} from '@/lib/sidebarWidth';
import { GripVertical } from 'lucide-react';

/** Grabbable width of the edge strip, centred on the sidebar's edge. */
const HIT = 8;

export default function SidebarResizer({
  width,
  targetRef,
  onCommit,
  label = 'Resize the delegates sidebar',
}: {
  /** The committed width, in px. Source of truth between drags. */
  width: number;
  /** The <aside> being resized. Mutated directly while dragging. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Called once per gesture with the final clamped width. */
  onCommit: (width: number) => void;
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

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const paint = useCallback((px: number) => {
    const el = targetRef.current;
    if (el) el.style.width = `${px}px`;
  }, [targetRef]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left button / touch / pen only; a right-click must not start a drag.
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startXRef.current = e.clientX;
    startWRef.current = width;
    liveRef.current = width;
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

    const move = (e: PointerEvent) => {
      const next = clampSidebarWidth(startWRef.current + sign * (e.clientX - startXRef.current));
      liveRef.current = next;
      paint(next);
    };
    const up = () => {
      setDragging(false);
      onCommit(liveRef.current);
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
  }, [dragging, onCommit, paint]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = typeof document !== 'undefined'
      && getComputedStyle(document.documentElement).direction === 'rtl';
    const grow = rtl ? 'ArrowLeft' : 'ArrowRight';
    const shrink = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: number | null = null;
    if (e.key === grow) next = width + SIDEBAR_KEY_STEP;
    else if (e.key === shrink) next = width - SIDEBAR_KEY_STEP;
    else if (e.key === 'Home') next = SIDEBAR_MIN_WIDTH;
    else if (e.key === 'End') next = SIDEBAR_MAX_WIDTH;
    if (next === null) return;
    e.preventDefault();
    onCommit(clampSidebarWidth(next));
  };

  const lit = dragging || focused || hovered;

  return (
    // Zero layout width: the floor starts flush at the sidebar's edge. The grabbable strip
    // (HIT px, centred on the edge) and the grip pill just OUTSIDE the edge are absolutely
    // positioned over both columns, so neither costs the floor view a pixel.
    <div className="shrink-0 self-stretch relative z-30" style={{ width: 0 }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuetext={`${width} pixels`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => onCommit(clampSidebarWidth(SIDEBAR_MIN_WIDTH))}
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
            backgroundColor: lit ? '#EED98A' : 'transparent',
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
