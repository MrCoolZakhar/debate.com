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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_KEY_STEP, clampSidebarWidth,
} from '@/lib/sidebarWidth';

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
      className="shrink-0 self-stretch relative focus:outline-none"
      style={{
        // 10px of grabbable width so it is a real target (the visible hairline
        // inside it is 2px). Sits between the aside and <main>, so widening the
        // handle costs the floor view 10px once, not per state.
        width: 10,
        cursor: 'col-resize',
        touchAction: 'none',
        backgroundColor: '#1B3828',
        borderInlineEnd: '1px solid #3D7A52',
        transition: reduceMotion ? 'none' : 'background-color 180ms ease',
      }}
    >
      {/* The grip. Gold when live, otherwise a faint rule — decoration only,
          never the sole carrier of information, so the 4.5:1 rule does not
          bind it. */}
      <span
        aria-hidden
        className="absolute top-1/2"
        style={{
          insetInlineStart: 4, width: 2, height: 34, marginTop: -17, borderRadius: 2,
          backgroundColor: lit ? '#EED98A' : 'rgba(237,231,216,0.28)',
          transition: reduceMotion ? 'none' : 'background-color 180ms ease',
        }}
      />
      {/* A visible focus ring for keyboard users — the grip alone is too subtle
          to serve as one. */}
      {focused && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ boxShadow: 'inset 0 0 0 2px #EED98A' }}
        />
      )}
    </div>
  );
}
