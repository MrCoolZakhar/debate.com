'use client';

/**
 * A modal that GROWS out of the control that opened it into the centre of the screen, and
 * settles back towards it when it closes. Used by MotionsModal, DocumentsModal, the chat and
 * the scoreboard.
 *
 * Why it is built this way:
 *  - Nothing here waits on the network. The shell renders on the first commit with whatever
 *    the caller already holds in memory (the committee object), so a slow connection changes
 *    nothing about how fast or how smoothly it opens.
 *  - transform + opacity only, driven by CSS TRANSITIONS written straight to the DOM through
 *    refs. Transitions retarget from wherever they are, so closing half way through the open
 *    reverses smoothly instead of jumping. No React state changes per frame, and parent
 *    re-renders (realtime updates while it animates) never touch the animated properties,
 *    because those keys are never part of the style props React owns.
 *  - One measurement at open (the trigger's rect and the panel's rect), in a layout effect,
 *    so the start frame is set before the browser paints: no flash at full size first.
 *  - Portal mounts into the scaled `#fit-root`, so pixel deltas are divided by its scale.
 *  - prefers-reduced-motion: a plain fade, no movement.
 *
 * The caller calls `onClose` only after the exit has played, through `requestClose` (the
 * render-prop argument). An unmount for any other reason (session ended) is instant.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { portalFrame } from '@/components/chat/chatTokens';
import { useDialogFocusTrap, useEscapeToClose } from '@/components/dialogFocus';

const OPEN_MS = 280;
const CLOSE_MS = 180;
const FADE_MS = 160;
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const START_SCALE = 0.18;
function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

type GrowDialogProps = {
  /** CSS selector of the control that opens this dialog (e.g. its data-tutorial target).
   *  Falls back to the focused element, then to a plain centre grow. */
  originSelector?: string;
  onClose: () => void;
  panelClassName: string;
  panelStyle?: Omit<React.CSSProperties, 'transform' | 'opacity' | 'transition' | 'willChange'>;
  backdropStyle?: Omit<React.CSSProperties, 'opacity' | 'transition'>;
  ariaLabel?: string;
  children: (requestClose: () => void) => React.ReactNode;
  /** Filled with the animated close while mounted (null otherwise), for callers that close
   *  from handlers outside the render prop. */
  closeRef?: React.MutableRefObject<(() => void) | null>;
  /** Called once the open animation has finished (at once under reduced motion). Callers use
   *  it to hold back work that would re-render a large tree mid-animation (a fetched result). */
  onOpened?: () => void;
};

/** Portal renders nothing on its first pass, so the measuring layout effect has to live in a
 *  component that mounts INSIDE the portal, when the nodes really exist. */
export default function GrowDialog(props: GrowDialogProps) {
  return <Portal><GrowDialogInner {...props} /></Portal>;
}

function GrowDialogInner({
  originSelector, onClose, panelClassName, panelStyle, backdropStyle, ariaLabel, children, closeRef, onOpened,
}: GrowDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  /** Where the panel starts (and returns to), in fit-root local px, relative to its resting place. */
  const fromRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const reducedRef = useRef(false);
  const closingRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const onOpenedRef = useRef(onOpened);
  useLayoutEffect(() => { onOpenedRef.current = onOpened; }, [onOpened]);
  // Captured at the moment of opening, before the dialog takes focus.
  const openerRef = useRef<HTMLElement | null>(null);

  const later = (fn: () => void, ms: number) => { timersRef.current.push(setTimeout(fn, ms)); };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;
    const reduced = prefersReducedMotion();
    reducedRef.current = reduced;

    const active = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
    const origin = (originSelector ? document.querySelector<HTMLElement>(originSelector) : null)
      // Never the dialog itself: StrictMode re-runs this effect after the panel took focus.
      ?? (active && active !== document.body && !layerRef.current?.contains(active) ? active : null);
    openerRef.current = origin;

    // Measure the panel at rest: a previous run (React StrictMode re-runs layout effects in
    // development) may have left it mid-transition, and getBoundingClientRect includes transforms.
    panel.style.transition = 'none';
    panel.style.transform = 'none';
    fromRef.current = { dx: 0, dy: 0 };
    if (!reduced && origin) {
      const o = origin.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const scale = portalFrame().scale || 1;
      fromRef.current = {
        dx: ((o.left + o.width / 2) - (p.left + p.width / 2)) / scale,
        dy: ((o.top + o.height / 2) - (p.top + p.height / 2)) / scale,
      };
    }
    const { dx, dy } = fromRef.current;

    // Start frame, no transition.
    panel.style.transition = 'none';
    backdrop.style.transition = 'none';
    panel.style.opacity = '0';
    backdrop.style.opacity = '0';
    panel.style.transform = reduced ? 'none' : `translate3d(${dx}px, ${dy}px, 0) scale(${START_SCALE})`;
    panel.style.willChange = 'transform, opacity';

    // Start the motion only once the content has been painted (two frames later). The first
    // commit of a dialog is its most expensive frame: every child mounts, lays out and
    // rasterises. Starting the transition in that same frame is what made the grow stutter
    // on first open (its opening frames were eaten by that work). Waiting two rAFs puts the
    // cost BEFORE the motion (the panel is invisible meanwhile), so every animated frame
    // after it only composites an already-rasterised layer.
    // Fallback: rAF is paused or throttled in a hidden or occluded page; never leave the panel
    // invisible waiting for frames that do not come.
    let started = false;
    let raf2 = 0;
    const start = (fn: () => void) => () => { if (started) return; started = true; fn(); };
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => run());
    });
    const run = start(() => {
      if (closingRef.current || !panelRef.current || !backdropRef.current) return;
      const p = panelRef.current;
      const b = backdropRef.current;
      p.style.transition = reduced
        ? `opacity ${FADE_MS}ms ease-out`
        : `transform ${OPEN_MS}ms ${EASE_OUT}, opacity ${FADE_MS}ms ease-out`;
      b.style.transition = `opacity ${reduced ? FADE_MS : 220}ms ease-out`;
      p.style.transform = 'none';
      p.style.opacity = '1';
      b.style.opacity = '1';
      later(() => {
        if (closingRef.current || !panelRef.current) return;
        panelRef.current.style.willChange = '';
        onOpenedRef.current?.();
      }, reduced ? FADE_MS : OPEN_MS + 40);
    });
    const fallback = setTimeout(run, 120);

    panel.focus({ preventScroll: true });

    const timers = timersRef.current;
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(fallback); timers.forEach(clearTimeout); };
  // Runs once per mount: the origin is where it was opened from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) { onCloseRef.current(); return; }
    const reduced = reducedRef.current;
    const { dx, dy } = fromRef.current;
    const ms = reduced ? FADE_MS : CLOSE_MS;
    // Exits are softer than entries: a short drift back towards the opener, not all the way.
    panel.style.willChange = 'transform, opacity';
    panel.style.pointerEvents = 'none';
    panel.style.transition = reduced
      ? `opacity ${ms}ms ease-in`
      : `transform ${ms}ms ${EASE_IN}, opacity ${ms}ms ease-in`;
    backdrop.style.transition = `opacity ${ms}ms ease-in`;
    if (!reduced) panel.style.transform = `translate3d(${dx * 0.3}px, ${dy * 0.3}px, 0) scale(0.92)`;
    panel.style.opacity = '0';
    backdrop.style.opacity = '0';
    const opener = openerRef.current;
    later(() => {
      onCloseRef.current();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    }, ms);
  }, []);

  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = requestClose;
    return () => { closeRef.current = null; };
  }, [closeRef, requestClose]);

  // Focus trap and Escape: shared with LeftDrawer (src/components/dialogFocus.ts).
  useDialogFocusTrap(panelRef, layerRef, closingRef);
  useEscapeToClose(requestClose);

  // An unmount that skipped the animated close (session ended, parent unmounted) still hands
  // focus back to the opener, when focus was in the dialog or has fallen to the body.
  useLayoutEffect(() => () => {
    const opener = openerRef.current;
    const active = document.activeElement;
    if (!opener || !opener.isConnected) return;
    if (!active || active === document.body || layerRef.current?.contains(active)) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  return (
    <>
      <div ref={layerRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={backdropRef}
          aria-hidden
          className="absolute inset-0"
          /* No backdrop-filter: a blur under a layer whose opacity animates is recomputed over
             the whole cockpit on every frame of the open and the close. */
          style={{ background: 'rgba(5, 8, 20, 0.88)', ...backdropStyle }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`relative focus:outline-none ${panelClassName}`}
          style={panelStyle}
        >
          {children(requestClose)}
        </div>
      </div>
    </>
  );
}
