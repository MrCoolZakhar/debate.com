'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ChairSidebarShell: the chair console's full-height roster sidebar, its collapsed flag
// column and the divider between them and the floor (15 Sep 2026).
//
// ── STRUCTURE ────────────────────────────────────────────────────────────────
//   slot   (in flow, shrink-0)   its width is the only thing the floor lays out against:
//                                the sidebar width when open, SIDEBAR_RAIL_WIDTH folded
//   ├ aside (absolute)           the forest panel, FIXED width, moved with a transform
//   ├ rail  (absolute)           SidebarFlagRail, faded in when folded
//   └ SidebarResizer             the divider at the slot's inline-end edge
// The floor column MUST be the slot's next element sibling: it is animated from here.
//
// ── WHY THE ANIMATION DOES NOT LAG ──────────────────────────────────────────
// Animating `width` would re-lay-out the whole roster AND the floor on every frame. So the
// slot's width is written ONCE, at the start, and everything else is a compositor-only
// transform (a FLIP):
//   • the aside keeps its width and slides out (translateX) or back in;
//   • the floor is snapped back to where it was with translateX(old - new) and animated
//     to 0, so it glides into its new place instead of jumping;
//   • the rail fades (opacity).
// Every style this component animates is written imperatively, never through React props,
// so a re-render can never fight an animation in flight, and nothing here calls
// setState per frame. A drag on the divider paints the same properties live
// (below the minimum the panel slides away under the pointer) and releases into the same
// settle(). Reduced motion = no transitions at all.
//
// Nothing here touches the committee object, updateLocal or localUpdateTime (RULES 3/4).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import SidebarResizer from '@/components/SidebarResizer';
import {
  SIDEBAR_ANIM_MS, SIDEBAR_COLLAPSE_AT, SIDEBAR_MIN_WIDTH, SIDEBAR_RAIL_WIDTH, clampSidebarWidth,
} from '@/lib/sidebarWidth';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Drop a FLIP transform from the floor column. */
function clearFlip(el: HTMLElement) {
  el.style.transition = '';
  el.style.transform = '';
  el.style.willChange = '';
}

interface Paint {
  /** Layout width of the slot (what the floor sees). */
  slotW: number;
  /** Width of the forest panel. */
  asideW: number;
  /** How far the panel is pushed toward the inline start, in px (0 = fully open). */
  shift: number;
  /** Opacity of the flag column. */
  rail: number;
}

export default function ChairSidebarShell({
  width,
  collapsed,
  onWidthChange,
  onCollapsedChange,
  rail,
  children,
  resizeLabel,
}: {
  width: number;
  collapsed: boolean;
  onWidthChange: (width: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The collapsed column (SidebarFlagRail). */
  rail: ReactNode;
  /** The expanded sidebar's contents. */
  children: ReactNode;
  resizeLabel: string;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const paintedRef = useRef<Paint | null>(null);
  const settledKeyRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  // The first ~600 ms after mount adopt the stored state (localStorage, read in an effect
  // on the chair page) without animating: a page load must not play the fold.
  const readyRef = useRef(false);
  // The width React renders on first paint only. After that every width is written by
  // settle() / onLive(): a changing React style prop would overwrite the slot BEFORE the
  // layout effect measures the floor, and the FLIP would read a zero distance.
  const [initialWidth] = useState(width);

  const isRtl = () => typeof document !== 'undefined' && getComputedStyle(document.documentElement).direction === 'rtl';
  const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Write a paint. `transition` = the CSS transition to use for the panel and rail, or null. */
  const write = useCallback((p: Paint, transition: string | null) => {
    const slot = slotRef.current;
    const panel = panelRef.current;
    const railEl = railRef.current;
    if (!slot || !panel || !railEl) return;
    const dir = isRtl() ? 1 : -1;
    slot.style.width = `${p.slotW}px`;
    panel.style.width = `${p.asideW}px`;
    panel.style.transition = transition ?? 'none';
    panel.style.transform = p.shift ? `translate3d(${dir * p.shift}px,0,0)` : '';
    railEl.style.transition = transition ? `opacity ${Math.round(SIDEBAR_ANIM_MS * 0.7)}ms ease ${p.rail > 0.5 ? Math.round(SIDEBAR_ANIM_MS * 0.35) : 0}ms` : 'none';
    railEl.style.opacity = String(p.rail);
    paintedRef.current = p;
  }, []);

  /** Move to a resting state, animated (FLIP on the floor) unless told otherwise. */
  const settle = useCallback((toCollapsed: boolean, toWidth: number, animate: boolean) => {
    const slot = slotRef.current;
    const panel = panelRef.current;
    const railEl = railRef.current;
    if (!slot || !panel || !railEl) return;
    settledKeyRef.current = `${toCollapsed ? 1 : 0}:${toWidth}`;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    const doAnimate = animate && readyRef.current && !reduced();
    const floor = slot.nextElementSibling as HTMLElement | null;
    const rtl = isRtl();
    const edge = (el: HTMLElement) => {
      // Where the floor's near edge is DRAWN right now, including a FLIP still in flight.
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
      return (rtl ? el.offsetLeft + el.offsetWidth : el.offsetLeft) + m.m41;
    };
    const before = doAnimate && floor ? edge(floor) : 0;

    const prev = paintedRef.current;
    // Folding keeps the panel at the width it is drawn at (no reflow, no edge jump) and
    // restores the stored width once it is out of sight.
    const asideW = toCollapsed ? (prev?.asideW ?? toWidth) : toWidth;
    const target: Paint = toCollapsed
      ? { slotW: SIDEBAR_RAIL_WIDTH, asideW, shift: asideW + 12, rail: 1 }
      : { slotW: toWidth, asideW: toWidth, shift: 0, rail: 0 };

    // Opening: visible and interactive before it moves. Folding: stays visible until it is gone.
    if (!toCollapsed) { panel.style.visibility = 'visible'; panel.inert = false; }
    railEl.style.visibility = 'visible';
    railEl.inert = !toCollapsed;
    railEl.style.pointerEvents = toCollapsed ? 'auto' : 'none';

    write(target, doAnimate ? `transform ${SIDEBAR_ANIM_MS}ms ${EASE}` : null);

    if (floor) {
      if (doAnimate) {
        // Reading offsetLeft after the width write forces ONE layout, the only one.
        const dx = before - (rtl ? floor.offsetLeft + floor.offsetWidth : floor.offsetLeft);
        if (Math.abs(dx) > 0.5) {
          floor.style.transition = 'none';
          floor.style.transform = `translate3d(${dx}px,0,0)`;
          floor.style.willChange = 'transform';
          void floor.offsetWidth;
          floor.style.transition = `transform ${SIDEBAR_ANIM_MS}ms ${EASE}`;
          floor.style.transform = 'translate3d(0,0,0)';
        }
      } else {
        floor.style.transition = '';
        floor.style.transform = '';
        floor.style.willChange = '';
      }
    }

    const finish = () => {
      timerRef.current = null;
      if (floor) { clearFlip(floor); }
      panel.style.transition = 'none';
      if (toCollapsed) {
        panel.style.visibility = 'hidden';
        panel.inert = true;
        if (panel.style.width !== `${toWidth}px`) {
          panel.style.width = `${toWidth}px`;
          panel.style.transform = `translate3d(${(isRtl() ? 1 : -1) * (toWidth + 12)}px,0,0)`;
          paintedRef.current = { slotW: SIDEBAR_RAIL_WIDTH, asideW: toWidth, shift: toWidth + 12, rail: 1 };
        }
      } else {
        railEl.style.visibility = 'hidden';
      }
    };
    if (doAnimate) timerRef.current = window.setTimeout(finish, SIDEBAR_ANIM_MS + 40);
    else finish();
  }, [write]);

  // Resting state follows the props. Skipped when a release already settled into it.
  useLayoutEffect(() => {
    const key = `${collapsed ? 1 : 0}:${width}`;
    if (settledKeyRef.current === key) return;
    settle(collapsed, width, true);
  }, [collapsed, width, settle]);

  useEffect(() => {
    const t = window.setTimeout(() => { readyRef.current = true; }, 600);
    const slot = slotRef.current;
    return () => {
      window.clearTimeout(t);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      // Unmounted mid-animation: never leave the floor translated.
      const floor = slot?.nextElementSibling as HTMLElement | null;
      if (floor) { clearFlip(floor); }
    };
  }, []);

  // ── Divider drag ───────────────────────────────────────────────────────────
  const onLive = useCallback((raw: number) => {
    const panel = panelRef.current;
    const railEl = railRef.current;
    if (!panel || !railEl) return;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    settledKeyRef.current = null;
    panel.style.visibility = 'visible';
    panel.inert = false;
    railEl.style.visibility = 'visible';
    const floor = slotRef.current?.nextElementSibling as HTMLElement | null;
    if (floor) { clearFlip(floor); }
    const fold = Math.min(1, Math.max(0, (SIDEBAR_MIN_WIDTH - raw) / (SIDEBAR_MIN_WIDTH - SIDEBAR_RAIL_WIDTH)));
    write(raw >= SIDEBAR_MIN_WIDTH
      ? { slotW: raw, asideW: raw, shift: 0, rail: 0 }
      : { slotW: raw, asideW: SIDEBAR_MIN_WIDTH, shift: SIDEBAR_MIN_WIDTH - raw, rail: fold }, null);
  }, [write]);

  const onRelease = useCallback((raw: number) => {
    if (raw < SIDEBAR_COLLAPSE_AT) {
      settle(true, width, true);
      if (!collapsed) onCollapsedChange(true);
      return;
    }
    const w = clampSidebarWidth(raw);
    settle(false, w, true);
    if (w !== width) onWidthChange(w);
    if (collapsed) onCollapsedChange(false);
  }, [collapsed, width, settle, onCollapsedChange, onWidthChange]);

  return (
    <div
      ref={slotRef}
      className="relative shrink-0 self-stretch z-30"
      // SSR / first paint: the expanded width; the layout effect corrects it before paint.
      style={{ width: initialWidth }}
    >
      <aside
        ref={panelRef}
        data-tutorial={collapsed ? undefined : 'speakers-sidebar'}
        aria-hidden={collapsed || undefined}
        className="absolute inset-y-0 start-0 flex flex-col overflow-hidden"
        // No `contain`: it would make the panel the containing block of position:fixed
        // descendants. The transform is only set while folded or moving, for the same reason.
        style={{ width: initialWidth, backgroundColor: '#1B3828' }}
      >
        {children}
      </aside>
      <div
        ref={railRef}
        data-tutorial={collapsed ? 'speakers-sidebar' : undefined}
        aria-hidden={!collapsed || undefined}
        className="absolute inset-y-0 start-0"
        style={{ width: SIDEBAR_RAIL_WIDTH, opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {rail}
      </div>
      <SidebarResizer
        width={width}
        collapsed={collapsed}
        onLive={onLive}
        onRelease={onRelease}
        onCommit={onWidthChange}
        onCollapsedChange={onCollapsedChange}
        label={resizeLabel}
      />
    </div>
  );
}
