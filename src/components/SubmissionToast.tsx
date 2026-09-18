'use client';

// ── SubmissionToast ────────────────────────────────────────────────────────
//
// A fourth surface in the notification-glass family (see
// src/components/notifications/glass.ts), for the one organizer-written
// message a role may show once, right after someone submits an application
// for it. It borrows the stack's look and its swipe/hover-pause mechanics but
// stays outside the stack's store entirely, the same way GlassToast does for
// the chair page's gavel handover notice — this is a single fixed card the
// confirmation screen owns directly.
//
// Positioning is fixed, top-right (insetInlineEnd, so it mirrors under the
// `ar` RTL locale along with everything else). Auto-dismisses after 20s,
// pauses while the pointer or focus is inside it, and can be swiped or
// X-dismissed early. No browser storage: it shows once per confirmation page
// view, and a resubmit is meant to show it again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { GLASS, glassFallbackCss, SPRING_BEZIER, SPRING_LINEAR } from './notifications/glass';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';

/** Far longer than Toast.tsx's DISMISS_MS (2200ms) — long enough to read a
 *  sentence and reach for the button. */
const AUTO_DISMISS_MS = 20000;
const EXIT_MS = 220;
const CARD_W = 320;
const TAP_SLOP_PX = 4;
const COUNTER_DRAG_DAMPING = 0.35;
const DISMISS_FRACTION = 0.4;
const FLICK_MIN_PX = 24;
const FLICK_MIN_SPEED = 0.6;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface SubmissionToastProps {
  /** The conference's own display name, for "Message from {name}". */
  conferenceName: string;
  message: string;
  /** Both present, or both absent — the caller enforces the shape rule. */
  linkLabel?: string | null;
  linkUrl?: string | null;
}

export default function SubmissionToast({ conferenceName, message, linkLabel, linkUrl }: SubmissionToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const elRef = useRef<HTMLDivElement | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the current countdown segment started, and how much was left in it
   *  — together these let pause/resume pick up where it left off rather than
   *  restarting the full 20s every time the pointer passes over the card. */
  const segmentStart = useRef(0);
  const remaining = useRef(AUTO_DISMISS_MS);
  const pointerOn = useRef(false);
  const focusOn = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; lastX: number; lastT: number; velocity: number } | null>(null);

  const flyOutAndDismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setDragging(false);
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    if (prefersReducedMotion()) {
      // Fade only — no transform. The transition below covers opacity
      // unconditionally, so leaving dx at 0 is what makes this a fade.
      exitTimer.current = setTimeout(() => setDismissed(true), EXIT_MS);
      return;
    }
    const el = elRef.current;
    const sign = el && getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    setDx(sign * (CARD_W + 60));
    exitTimer.current = setTimeout(() => setDismissed(true), EXIT_MS);
  }, [leaving]);

  const startAutoTimer = useCallback((ms: number) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    segmentStart.current = Date.now();
    remaining.current = ms;
    autoTimer.current = setTimeout(flyOutAndDismiss, ms);
  }, [flyOutAndDismiss]);

  // Mount: start the 20s countdown.
  useEffect(() => {
    startAutoTimer(AUTO_DISMISS_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Pause while the pointer or focus is inside the card; resume with
   *  whatever time was left, not a fresh 20s. */
  const syncPause = useCallback(() => {
    if (leaving) return;
    const held = pointerOn.current || focusOn.current;
    if (held) {
      if (!autoTimer.current) return; // already paused
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
      remaining.current = Math.max(0, remaining.current - (Date.now() - segmentStart.current));
    } else if (!autoTimer.current) {
      startAutoTimer(remaining.current > 0 ? remaining.current : AUTO_DISMISS_MS);
    }
  }, [leaving, startAutoTimer]);

  const anchorSign = (): number => {
    const el = elRef.current;
    if (!el) return 1;
    return getComputedStyle(el).direction === 'rtl' ? -1 : 1;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    // Never steal a press aimed at the link button or the x — those must
    // click cleanly, exactly like the stack's own rule.
    if ((e.target as Element).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported pointer type */ }
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const raw = e.clientX - d.startX;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    // Toward the anchor tracks the pointer 1:1; away from it is damped —
    // that direction can never dismiss and should feel like a wall.
    const towardAnchor = raw * anchorSign() >= 0;
    setDx(towardAnchor ? raw : raw * COUNTER_DRAG_DAMPING);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* unsupported pointer type */ }
    if (e.type === 'pointerup' && Math.abs(d.lastX - d.startX) < TAP_SLOP_PX) {
      setDragging(false);
      setDx(0);
      return;
    }
    const sign = anchorSign();
    const along = dx * sign;
    const speed = d.velocity * sign;
    const past = along > CARD_W * DISMISS_FRACTION;
    const flicked = along > FLICK_MIN_PX && speed > FLICK_MIN_SPEED;
    if (past || flicked) { flyOutAndDismiss(); return; }
    setDragging(false);
    setDx(0);
  };

  if (dismissed) return null;

  return (
    <div
      ref={elRef}
      role="status"
      aria-live="polite"
      className={`dgs-toast${dragging ? ' dgs-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => { pointerOn.current = true; syncPause(); }}
      onPointerLeave={() => { pointerOn.current = false; syncPause(); }}
      onFocus={() => { focusOn.current = true; syncPause(); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { focusOn.current = false; syncPause(); } }}
      style={{
        position: 'fixed',
        top: 20,
        insetInlineEnd: 20,
        zIndex: 100,
        width: CARD_W,
        maxWidth: 'calc(100vw - 32px)',
        padding: '16px 16px 16px 18px',
        borderRadius: GLASS.radius,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: GLASS.border,
        boxShadow: GLASS.shadow,
        color: GLASS.ink,
        fontFamily: OUTFIT,
        opacity: leaving ? 0 : 1,
        ['--dgs-dx' as string]: `${dx}px`,
      } as React.CSSProperties}
    >
      <style>{`
        @keyframes dgs-in {
          from { opacity: 0; transform: translate3d(var(--dgs-slide-x, 10px), -8px, 0) scale(0.96) }
          60%  { opacity: 1 }
          to   { opacity: 1; transform: none }
        }
        @keyframes dgs-in-reduced {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        .dgs-toast {
          --dgs-slide-x: 10px;
          transform: translate3d(var(--dgs-dx), 0, 0);
          transition: transform 320ms ${EASE}, opacity ${EXIT_MS}ms linear;
          animation: dgs-in 560ms ${SPRING_BEZIER} both;
          animation-timing-function: ${SPRING_LINEAR};
          touch-action: pan-y;
          -webkit-font-smoothing: antialiased;
        }
        [dir="rtl"] .dgs-toast { --dgs-slide-x: -10px }
        .dgs-dragging { transition: none }
        ${glassFallbackCss('.dgs-toast')}
        .dgs-x {
          transition: background-color 140ms ${EASE}, transform 120ms ${EASE};
        }
        .dgs-x:hover { background-color: rgba(27,56,40,0.14) }
        .dgs-x:active { transform: scale(0.94) }
        .dgs-x:focus-visible, .dgs-link:focus-visible {
          box-shadow: 0 0 0 2px var(--gv-surface, #FAF8F3), 0 0 0 4px rgba(27,56,40,0.55);
        }
        .dgs-link { transition: transform 120ms ${EASE}, filter 120ms ${EASE} }
        .dgs-link:active { transform: scale(0.97) }
        @media (hover: hover) and (pointer: fine) {
          .dgs-link:hover { filter: brightness(1.06) }
        }
        @media (prefers-reduced-motion: reduce) {
          /* The drag survives — it is a control, not decoration. What goes
             is the spring: entrance becomes a plain fade, and the fly-out
             above already skips the transform for the same reason. */
          .dgs-toast { animation: dgs-in-reduced 200ms linear both; transition: opacity ${EXIT_MS}ms linear }
        }
      `}</style>

      <div className="flex items-start justify-between gap-3">
        <p
          style={{
            fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: GLASS.inkFaint, margin: 0,
          }}
        >
          Message from {conferenceName}
        </p>
        <button
          type="button"
          onClick={flyOutAndDismiss}
          aria-label="Dismiss"
          className="dgs-x flex-shrink-0"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 999, marginTop: -2, marginInlineEnd: -4,
            border: 'none', background: 'transparent', color: GLASS.inkFaint, cursor: 'pointer', padding: 0,
          }}
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      </div>

      <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: GLASS.ink, margin: '8px 0 0 0' }}>
        {message}
      </p>

      {linkLabel && linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dgs-link inline-flex items-center justify-center"
          style={{
            marginTop: 12,
            padding: '8px 16px',
            borderRadius: 999,
            backgroundColor: 'var(--gv-main, #1B3828)',
            color: 'var(--gv-on-main, #EED98A)',
            fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, letterSpacing: '0.04em',
            textDecoration: 'none', cursor: 'pointer',
          }}
        >
          {linkLabel}
        </a>
      )}
    </div>
  );
}
