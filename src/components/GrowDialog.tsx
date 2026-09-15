'use client';

/**
 * A modal that GROWS out of the control that opened it into the centre of the screen, and
 * settles back towards it when it closes. Used by MotionsModal and DocumentsModal.
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

const OPEN_MS = 280;
const CLOSE_MS = 180;
const FADE_MS = 160;
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const START_SCALE = 0.18;
const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'summary',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[inert]'));
}

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
};

/** Portal renders nothing on its first pass, so the measuring layout effect has to live in a
 *  component that mounts INSIDE the portal, when the nodes really exist. */
export default function GrowDialog(props: GrowDialogProps) {
  return <Portal><GrowDialogInner {...props} /></Portal>;
}

function GrowDialogInner({
  originSelector, onClose, panelClassName, panelStyle, backdropStyle, ariaLabel, children, closeRef,
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
      ?? (active && active !== document.body ? active : null);
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
    // Commit the start frame, then transition to rest.
    void panel.offsetWidth;
    panel.style.transition = reduced
      ? `opacity ${FADE_MS}ms ease-out`
      : `transform ${OPEN_MS}ms ${EASE_OUT}, opacity ${FADE_MS}ms ease-out`;
    backdrop.style.transition = `opacity ${reduced ? FADE_MS : 220}ms ease-out`;
    panel.style.transform = 'none';
    panel.style.opacity = '1';
    backdrop.style.opacity = '1';
    later(() => { if (!closingRef.current && panelRef.current) panelRef.current.style.willChange = ''; }, OPEN_MS + 40);

    panel.focus({ preventScroll: true });

    const timers = timersRef.current;
    return () => { timers.forEach(clearTimeout); };
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

  // Focus trap. Tab and Shift+Tab cycle inside the panel, and focus that lands on the page
  // underneath is pulled back in. A floating layer opened FROM the dialog (DatePicker, a
  // tooltip, a typeahead) portals into the same root AFTER this dialog, so anything that
  // follows the dialog's layer in document order counts as part of it and is left alone.
  useEffect(() => {
    const inDialogLayer = (el: Node | null) => {
      const layer = layerRef.current;
      if (!layer || !el) return false;
      if (layer.contains(el)) return true;
      return !!(layer.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented || closingRef.current) return;
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement as HTMLElement | null;
      // Inside a nested floating layer: that layer owns its own Tab order.
      if (active && !panel.contains(active) && inDialogLayer(active)) return;
      const items = focusablesIn(panel);
      if (items.length === 0) { e.preventDefault(); panel.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (closingRef.current) return;
      const panel = panelRef.current;
      const target = e.target as Node | null;
      if (!panel || !target || target === document.body || inDialogLayer(target)) return;
      panel.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

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

  // Escape closes, unless a field or a nested control already used the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  return (
    <>
      <div ref={layerRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={backdropRef}
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)', ...backdropStyle }}
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
