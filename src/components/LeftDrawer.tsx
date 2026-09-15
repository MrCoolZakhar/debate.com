'use client';

/**
 * A full-height panel that slides in from the LEFT edge (the inline-start edge, so it mirrors
 * in Arabic) and is dragged back out towards it. Used by SettingsPanel.
 *
 *  - transform only, CSS transitions written straight to the DOM through refs (same model as
 *    GrowDialog): no React state per frame, and parent re-renders never touch the animated
 *    properties. `will-change: transform` is set only while it moves.
 *  - The motion starts two frames after mount, once the content has been painted, so the
 *    first (most expensive) commit never eats animation frames.
 *  - Drag to dismiss with a finger, pen or mouse: a horizontal pull towards the edge follows
 *    the pointer; releasing past a third of the width, or with a quick flick, closes it,
 *    anything less springs back. A vertical move is left to scrolling (touch-action: pan-y),
 *    and nothing starts on a field, slider or other control that needs the pointer.
 *  - Backdrop fades; clicking it, Escape, or the header close button all close. Focus is
 *    trapped inside and returned to the opener.
 *  - prefers-reduced-motion: a plain fade, no slide.
 */
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { portalFrame } from '@/components/chat/chatTokens';
import { useDialogFocusTrap, useEscapeToClose } from '@/components/dialogFocus';

const OPEN_MS = 320;
const CLOSE_MS = 220;
const FADE_MS = 160;
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const DRAG_SLOP = 8;
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-drag], a[href]';

/** Off-screen transform: -100% on the left, +100% in RTL where the edge is on the right. */
function hiddenTransform(rtl: boolean): string {
  return `translate3d(${rtl ? 100 : -100}%, 0, 0)`;
}

type LeftDrawerProps = {
  onClose: () => void;
  ariaLabel?: string;
  panelClassName?: string;
  panelStyle?: Omit<React.CSSProperties, 'transform' | 'transition' | 'willChange' | 'opacity'>;
  children: (requestClose: () => void) => React.ReactNode;
};

export default function LeftDrawer(props: LeftDrawerProps) {
  return <Portal><LeftDrawerInner {...props} /></Portal>;
}

function LeftDrawerInner({ onClose, ariaLabel, panelClassName = '', panelStyle, children }: LeftDrawerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef(false);
  const reducedRef = useRef(false);
  const rtlRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;
    const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    reducedRef.current = reduced;
    rtlRef.current = getComputedStyle(panel).direction === 'rtl';
    // Captured once: StrictMode re-runs this effect after the panel already took focus, and
    // the panel must never be remembered as its own opener.
    const active = document.activeElement as HTMLElement | null;
    if (!openerRef.current && active && active !== document.body && !layerRef.current?.contains(active)) openerRef.current = active;

    panel.style.transition = 'none';
    backdrop.style.transition = 'none';
    backdrop.style.opacity = '0';
    panel.style.transform = reduced ? 'none' : hiddenTransform(rtlRef.current);
    panel.style.opacity = reduced ? '0' : '1';
    panel.style.willChange = reduced ? 'opacity' : 'transform';

    // Fallback: rAF is paused or throttled in a hidden or occluded page; never leave the panel
    // invisible waiting for frames that do not come.
    let started = false;
    let raf2 = 0;
    const start = (fn: () => void) => () => { if (started) return; started = true; fn(); };
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => run());
    });
    const run = start(() => {
      const p = panelRef.current;
      const b = backdropRef.current;
      if (closingRef.current || !p || !b) return;
      p.style.transition = reduced ? `opacity ${FADE_MS}ms ease-out` : `transform ${OPEN_MS}ms ${EASE_OUT}`;
      b.style.transition = `opacity ${reduced ? FADE_MS : 240}ms ease-out`;
      p.style.transform = 'none';
      p.style.opacity = '1';
      b.style.opacity = '1';
      timers.current.push(setTimeout(() => { if (!closingRef.current && panelRef.current) panelRef.current.style.willChange = ''; }, OPEN_MS + 40));
    });
    const fallback = setTimeout(run, 120);
    panel.focus({ preventScroll: true });
    const ts = timers.current;
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(fallback); ts.forEach(clearTimeout); };
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) { onCloseRef.current(); return; }
    const reduced = reducedRef.current;
    const ms = reduced ? FADE_MS : CLOSE_MS;
    panel.style.pointerEvents = 'none';
    panel.style.willChange = reduced ? 'opacity' : 'transform';
    panel.style.transition = reduced ? `opacity ${ms}ms ease-in` : `transform ${ms}ms ${EASE_IN}`;
    backdrop.style.transition = `opacity ${ms}ms ease-in`;
    if (reduced) panel.style.opacity = '0';
    else panel.style.transform = hiddenTransform(rtlRef.current);
    backdrop.style.opacity = '0';
    const opener = openerRef.current;
    timers.current.push(setTimeout(() => {
      onCloseRef.current();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    }, ms));
  }, []);

  useDialogFocusTrap(panelRef, layerRef, closingRef);
  useEscapeToClose(requestClose);

  // ── Drag to dismiss ───────────────────────────────────────────────────────
  const drag = useRef<{
    id: number; x0: number; y0: number; width: number; scale: number;
    active: boolean; offset: number; lastX: number; lastT: number; velocity: number; raf: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (closingRef.current || reducedRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest(NO_DRAG)) return;
    const panel = panelRef.current;
    if (!panel) return;
    drag.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, width: panel.offsetWidth,
      // Portal lives in the scaled #fit-root: pointer px must be divided by its scale.
      scale: portalFrame().scale || 1,
      active: false, offset: 0, lastX: e.clientX, lastT: e.timeStamp, velocity: 0, raf: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!d || d.id !== e.pointerId || !panel || !backdrop) return;
    const sign = rtlRef.current ? 1 : -1;               // direction that closes
    const dx = (e.clientX - d.x0) / d.scale;
    const dy = (e.clientY - d.y0) / d.scale;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      // Vertical first, or pulling the wrong way: not a dismiss. Let it scroll or click.
      if (Math.abs(dy) > Math.abs(dx) || dx * sign <= 0) { drag.current = null; return; }
      d.active = true;
      panel.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
      backdrop.style.transition = 'none';
      panel.style.willChange = 'transform';
      panel.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = ((e.clientX - d.lastX) / d.scale) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    // Only towards the edge; a pull the other way rubber-bands at zero.
    d.offset = Math.max(0, dx * sign);
    if (!d.raf) {
      d.raf = requestAnimationFrame(() => {
        const cur = drag.current;
        if (!cur || !panelRef.current || !backdropRef.current) return;
        cur.raf = 0;
        panelRef.current.style.transform = `translate3d(${cur.offset * sign}px, 0, 0)`;
        backdropRef.current.style.opacity = String(Math.max(0, 1 - cur.offset / cur.width));
      });
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.raf) cancelAnimationFrame(d.raf);
    if (!d.active) return;
    // The click that may follow this pointerup is part of the drag, not a tap on a control.
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;
    panel.style.userSelect = '';
    const sign = rtlRef.current ? 1 : -1;
    const flick = d.velocity * sign > 0.5;
    if (!cancelled && (d.offset > d.width / 3 || flick)) {
      requestClose();
      return;
    }
    panel.style.transition = `transform 260ms ${EASE_OUT}`;
    backdrop.style.transition = 'opacity 260ms ease-out';
    panel.style.transform = 'none';
    backdrop.style.opacity = '1';
    timers.current.push(setTimeout(() => { if (panelRef.current && !closingRef.current) panelRef.current.style.willChange = ''; }, 300));
  };

  return (
    <div ref={layerRef} className="fixed inset-0 z-[60] flex justify-start">
      <div
        ref={backdropRef}
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'rgba(12, 18, 14, 0.42)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`relative h-full focus:outline-none ${panelClassName}`}
        style={{ touchAction: 'pan-y', boxShadow: '0 0 0 0.5px rgba(27,56,40,0.2), 24px 0 60px -20px rgba(5,8,20,0.45)', ...panelStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onClickCapture={(e) => { if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); e.stopPropagation(); } }}
      >
        {/* requestClose only reads refs when it is CALLED (from a handler), never during render. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {children(requestClose)}
        {/* Grab handle on the far edge: says "this pulls away", and is an easy target for a mouse. */}
        <span
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ insetInlineEnd: 6, width: 4, height: 44, borderRadius: 999, background: 'rgba(28,20,16,0.16)' }}
        />
      </div>
    </div>
  );
}
