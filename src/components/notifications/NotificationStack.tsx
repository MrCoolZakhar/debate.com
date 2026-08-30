'use client';

// ── NotificationStack ──────────────────────────────────────────────────────
//
// The chair-facing notification surface: tinted liquid-glass cards stacked at
// the TOP-RIGHT of the viewport. Renderer only — every rule about what appears,
// how long it lives and what may coexist lives in `@/lib/sessionNotifications`.
//
// Mount ONE of these per surface. It owns the single interval that advances
// every TTL, so a second mounted host would double-speed every countdown.
//
// Positioning note: portaled through `@/components/Portal`, which mounts into
// `#fit-root` when one exists. On the chair page that node carries a CSS
// `transform`, which makes it the containing block for `position: fixed` — so
// these coordinates are in the scaled frame, not raw viewport pixels. That is
// correct and intended here: the stack should scale with the cockpit it
// belongs to, unlike a popover that must align to a real on-screen trigger.
//
// The inset is LOGICAL (`insetInlineEnd`), so in the `ar` RTL locale the stack
// anchors to the left edge along with everything else. The enter animation has
// to mirror with it — a card that flies away from its own anchor reads as a
// glitch — so the slide distance is a custom property flipped under
// `[dir="rtl"]` rather than a hardcoded physical `translateX`. Swipe-to-dismiss
// mirrors for the same reason: a card leaves toward whichever edge it is
// anchored to.
//
// ── Vertical position, and how the collision is resolved ───────────────────
//
// The stack sits directly under the header row (`h-11`, 44px in the same
// scaled frame) — TOP_PX is 52, i.e. the header plus 8px of breath. Two other
// fixed layers live in that same top-inline-end column and used to be cleared
// by simply starting the stack below them:
//   • `GavelChip` (fixed, top 3.75rem = 60px, inset-inline-end 0.85rem)
//   • the gavel handover toast (fixed, top 6.6rem = 105.6px, same end inset)
// Both are far too narrow-column to dodge horizontally — a card is ~314px wide
// and the toast is up to 304px, so any horizontal escape would drag the stack
// into the middle of the session view. So the stack takes the slot and the
// other two are PUSHED DOWN while it is on screen: this component publishes
// its own measured height as `--dgn-stack-shift` on `<html>`, and both layers
// add that variable to their resting `top`. When the stack is empty (or
// suppressed) the variable is removed and they snap back to 3.75rem / 6.6rem.
// The measurement is `offsetHeight` — unscaled layout px, the same space
// `top: 3.75rem` resolves in — so the two never disagree about units.
// If you move the stack or the chip, change BOTH constants below and the
// `calc()` in `GavelChip.tsx` / the chair page's `gavelToast`.

import { useEffect, useRef, useState } from 'react';
import { Check, X, Hand, MessageCircle, Megaphone, Info, AlertTriangle } from 'lucide-react';
import Portal from '@/components/Portal';
import { getFlagUrl } from '@/lib/countries';
import {
  useNotifications, dismiss, setPending, tickNotifications,
  type NotificationKind, type NotificationLevel, type NotificationTone,
} from '@/lib/sessionNotifications';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const TICK_MS = 250;
const MAX_VISIBLE = 4;
/** Header row (44px) + 8px. See the header note for how the chip collision is resolved. */
const TOP_PX = 52;
const EDGE_PX = 14;
/** Gap left between the bottom of the stack and whatever it pushes down. */
const STACK_GAP_PX = 10;
/** `GavelChip`'s resting `top: 3.75rem`. Mirrored there — keep the two in step. */
const CHIP_TOP_PX = 60;
/** Card width. 5% down from the original 330 — real px, never `transform: scale`. */
const CARD_W = 314;

/* Swipe-to-dismiss thresholds. Either one is enough: a long deliberate drag, or
   a short fast flick. */
const DISMISS_FRACTION = 0.4;          // of the card width
const FLICK_MIN_PX = 24;               // ignore jitter on a tap
const FLICK_MIN_SPEED = 0.6;           // px per ms, toward the anchored edge
/** Drag against the anchored edge is damped and always springs back. */
const COUNTER_DRAG_DAMPING = 0.35;
/** Time the fly-out takes; matches the `transform` transition on `.dgn-card`. */
const EXIT_MS = 170;

const KIND_ICON: Record<NotificationKind, typeof Hand> = {
  'gsl-request': Hand,
  chat: MessageCircle,
  broadcast: Megaphone,
  motion: Info,
  info: Info,
};

/**
 * Outcome colour, applied to the ICON SEAT only.
 *
 * The organiser bars this stack replaced said "good" or "bad" with their tint,
 * and a card that reports "Couldn't save" must not look like one reporting
 * "Reminder sent". The glass body is untouched — recolouring that would give
 * the stack two visual identities and make the session cards look wrong beside
 * an error. Every colour here is a fill behind a glyph, never text: the words
 * stay #FFFFFF on the same glass, so nothing readable changes contrast.
 */
const LEVEL: Record<NotificationLevel, { seat: string; ink: string; glyph: typeof Info | null }> = {
  neutral: { seat: 'rgba(238,217,138,0.18)', ink: '#EED98A', glyph: null },
  ok: { seat: 'rgba(126,214,160,0.22)', ink: '#9BE7BC', glyph: Check },
  error: { seat: 'rgba(255,138,138,0.22)', ink: '#FFB4B4', glyph: AlertTriangle },
};

const TONE: Record<NotificationTone, { bg: string; fg: string; border: string }> = {
  accept: { bg: 'rgba(61,122,82,0.92)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.28)' },
  reject: { bg: 'rgba(139,32,32,0.86)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.24)' },
  neutral: { bg: 'rgba(255,255,255,0.16)', fg: '#F3EFE3', border: 'rgba(255,255,255,0.28)' },
};

/**
 * Per-notification presentation extras, keyed by notification key.
 *
 * These deliberately do NOT live on `SessionNotification`. That payload is the store's
 * contract — it is snapshotted at `notify()` time and only changes when a producer
 * re-notifies, which is exactly wrong for a value that has to change every second. A
 * countdown re-notified once a second would restart its own TTL and re-emit to every
 * subscriber; here the renderer derives it from a fixed target instant on the interval it
 * already runs.
 *
 * The image rides along for the same reason it is not a store concern: it is pure
 * presentation, and the store must stay drawable by anything.
 */
export interface NotificationExtra {
  /** Rendered inline, height-capped, with an empty alt — the body carries the meaning. */
  imageUrl?: string;
  /** ISO instant. While it is in the future the card shows a live countdown. */
  countdownTo?: string;
  /** Countdown copy containing a `{time}` placeholder, pre-translated by the producer. */
  countdownTemplate?: string;
  /** Static line — shown when there is no countdown, or once the countdown has elapsed. */
  note?: string;
}

/** mm:ss, or h:mm:ss past an hour. Never negative. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Live scale of the FitToScreen root (1 when not inside one).
 *
 * Pointer coordinates arrive in REAL viewport px, but the card is translated
 * inside fit-root's scaled space. Without dividing by this the card drifts away
 * from the finger by exactly the scale factor. Same reasoning as `GavelChip`.
 */
function fitScale(): number {
  if (typeof document === 'undefined') return 1;
  const root = document.getElementById('fit-root');
  if (!root || !root.offsetWidth) return 1;
  const s = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface CardProps {
  n: ReturnType<typeof useNotifications>['items'][number];
  extra?: NotificationExtra;
}

/**
 * One card. Split out of the stack so the drag lives in component state:
 * the host re-renders four times a second to advance the TTL hairlines, and a
 * drag offset held up there would be recreated on every one of those ticks.
 */
function NotificationCard({ n, extra }: CardProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number; startX: number; lastX: number; lastT: number; velocity: number;
  } | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  /** +1 when the stack is anchored to the right (LTR), -1 in RTL. */
  const anchorSign = (): number => {
    const el = elRef.current;
    if (!el) return 1;
    return getComputedStyle(el).direction === 'rtl' ? -1 : 1;
  };

  /**
   * Fly the card out toward its anchored edge, then drop it from the store.
   *
   * SWIPE AND THE "x" ARE DISMISSALS, NOT DECISIONS. Both land here, and `dismiss()`
   * only removes the card from THIS chair's screen — it never approves, never denies,
   * never touches the motion row. A swiped-away GSL request is still pending in the
   * DB for the dais to action. Only the Accept / Reject buttons below run `a.run()`.
   */
  const flyOutAndDismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setDragging(false);
    if (prefersReducedMotion()) { dismiss(n.key); return; }
    setDx(anchorSign() * (CARD_W + 60));
    exitTimer.current = setTimeout(() => dismiss(n.key), EXIT_MS);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    // Never steal a press aimed at Accept / Reject / the x — those must click cleanly.
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const scaled = e.clientX / fitScale();
    dragRef.current = {
      pointerId: e.pointerId, startX: scaled, lastX: scaled, lastT: e.timeStamp, velocity: 0,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const scaled = e.clientX / fitScale();
    const raw = scaled - d.startX;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (scaled - d.lastX) / dt;
    d.lastX = scaled;
    d.lastT = e.timeStamp;
    // Toward the anchor tracks the pointer 1:1; away from it is damped, because that
    // direction can never dismiss and should feel like a wall.
    const towardAnchor = raw * anchorSign() >= 0;
    setDx(towardAnchor ? raw : raw * COUNTER_DRAG_DAMPING);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const sign = anchorSign();
    const along = dx * sign;                    // travelled toward the anchored edge
    const speed = d.velocity * sign;            // px/ms toward the anchored edge
    const past = along > CARD_W * DISMISS_FRACTION;
    const flicked = along > FLICK_MIN_PX && speed > FLICK_MIN_SPEED;
    if (past || flicked) { flyOutAndDismiss(); return; }
    setDragging(false);
    setDx(0);                                   // spring back
  };

  const level = LEVEL[n.level ?? 'neutral'];
  const Icon = level.glyph ?? KIND_ICON[n.kind];
  const pct = n.ttlMs == null ? 0 : Math.min(1, n.elapsedMs / n.ttlMs);
  /* Recomputed on the same 250ms tick that advances the TTLs — no second
     interval, and no re-notify (which would restart the TTL every second). */
  const remainingMs = extra?.countdownTo
    ? new Date(extra.countdownTo).getTime() - Date.now()
    : null;
  const counting = remainingMs != null && remainingMs > 0 && !!extra?.countdownTemplate;
  const noteLine = counting
    ? extra!.countdownTemplate!.replace('{time}', formatCountdown(remainingMs!))
    : extra?.note;

  return (
    <div className="dgn-enter">
      <div
        ref={elRef}
        className={`dgn-card${dragging ? ' dgn-dragging' : ''}`}
        role={n.actions?.length ? 'group' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          ['--dgn-dx' as string]: `${dx}px`,
          opacity: leaving ? 0 : 1,
          pointerEvents: 'auto', position: 'relative', overflow: 'hidden',
          borderRadius: 17, padding: '10px 11px 11px',
          /* Tinted liquid glass: a forest wash over whatever is behind,
             blurred and saturated so the tint reads as glass rather than
             as a flat scrim, with a bright top hairline for the lit edge
             and a dark ambient below to seat it. The shadow lives in the
             stylesheet, not here — an inline one would out-specify the
             hover lift. */
          background: 'linear-gradient(180deg, rgba(27,56,40,0.82), rgba(18,40,28,0.88))',
          backdropFilter: 'blur(18px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: '#F3EFE3',
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          {n.flagCode ? (
            <img
              src={getFlagUrl(n.flagCode)}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                objectFit: 'cover', outline: '1px solid rgba(255,255,255,0.22)',
                outlineOffset: -1,
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: level.seat, color: level.ink,
              }}
            >
              <Icon size={15} strokeWidth={2.4} />
            </span>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0, fontFamily: OUTFIT, fontSize: 12.8, fontWeight: 800,
                lineHeight: 1.25, color: '#FFFFFF',
              }}
            >
              {n.title}
            </p>
            {n.body && (
              <p
                style={{
                  margin: '2px 0 0', fontFamily: OUTFIT, fontSize: 11,
                  fontWeight: 500, lineHeight: 1.3, color: 'rgba(243,239,227,0.76)',
                }}
              >
                {n.body}
              </p>
            )}

            {noteLine && (
              <p
                style={{
                  margin: '5px 0 0', fontFamily: OUTFIT, fontSize: 11,
                  fontWeight: 800, lineHeight: 1.3, color: '#EED98A',
                  /* Tabular figures so a ticking countdown does not jitter its
                     own line width once a second. */
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {noteLine}
              </p>
            )}

            {extra?.imageUrl && (
              /* Height-capped and cropped: an organiser can attach anything, and a
                 tall upload must not push the acknowledge button off screen. Empty
                 alt — the message text above carries the meaning. */
              <img
                src={extra.imageUrl}
                alt=""
                draggable={false}
                style={{
                  display: 'block', marginBlockStart: 8, width: '100%',
                  maxHeight: 110, objectFit: 'cover', borderRadius: 10,
                  outline: '1px solid rgba(255,255,255,0.18)', outlineOffset: -1,
                }}
              />
            )}
          </div>

          {/* EVERY card gets an x, including actionable ones. It used to render only on
              cards with no actions, which left a GSL request with no way off the screen
              short of answering it — a chair who wants the dais clear had to approve or
              deny something they had not decided on yet.

              This is a DISMISSAL, NOT A DECISION: it clears the card from this chair's
              screen and nothing else. The motion stays pending in the DB, the delegate
              is still waiting, and any other chair still sees it. Never wire an accept
              or a reject in here. */}
          <button
            type="button"
            onClick={flyOutAndDismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="dgn-act"
            style={{
              flexShrink: 0, width: 25, height: 25, borderRadius: 999,
              border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
              background: 'rgba(255,255,255,0.12)', color: '#F3EFE3',
            }}
          >
            <X size={12} strokeWidth={2.6} />
          </button>
        </div>

        {!!n.actions?.length && (
          <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
            {n.actions.map((a) => {
              const tone = TONE[a.tone];
              const busy = !!n.pending;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  className="dgn-act"
                  onClick={async () => {
                    setPending(n.key, a.id);
                    try {
                      await a.run();
                    } finally {
                      /* Dismiss regardless: the action either succeeded,
                         or it failed and its own error path owns telling
                         the chair. Leaving a dead card that reruns a DB
                         write on a second click is worse. */
                      dismiss(n.key);
                    }
                  }}
                  style={{
                    flex: 1, minHeight: 32, borderRadius: 10, cursor: busy ? 'progress' : 'pointer',
                    background: tone.bg, color: tone.fg,
                    border: `1px solid ${tone.border}`,
                    fontFamily: OUTFIT, fontSize: 11.4, fontWeight: 800,
                    letterSpacing: '0.02em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {a.tone === 'accept' && <Check size={12} strokeWidth={3} />}
                  {a.tone === 'reject' && <X size={12} strokeWidth={3} />}
                  {a.label}
                </button>
              );
            })}
          </div>
        )}

        {n.ttlMs != null && (
          /* Hairline countdown — tells the chair the card is going to
             leave on its own, so an unanswered request does not read as
             a thing they failed to clear. */
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', insetInlineStart: 0, bottom: 0, height: 2,
              width: `${(1 - pct) * 100}%`,
              background: 'linear-gradient(90deg, rgba(238,217,138,0.85), rgba(238,217,138,0.35))',
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function NotificationStack({
  extras,
  topPx = TOP_PX,
}: {
  extras?: Record<string, NotificationExtra>;
  /**
   * Distance from the top of the containing block to the first card.
   *
   * Defaults to the chair cockpit's 52px (its 44px header plus breath). Any
   * OTHER surface that mounts a stack has a different header and must say so —
   * `/manage` is 56px, for instance. This is the ONLY thing about this renderer
   * that was ever tied to the session: the store (`@/lib/sessionNotifications`)
   * is headless and surface-agnostic, `Portal` falls back to `document.body`
   * when there is no `#fit-root`, and `fitScale()` returns 1 outside one.
   *
   * The `--dgn-stack-shift` publication below is chair-only in EFFECT, not in
   * code: nothing outside the chair page reads the variable, so a stack mounted
   * elsewhere simply sets a variable no one consumes.
   */
  topPx?: number;
}) {
  const { items, suppressed } = useNotifications();
  /* Value is never read — the state exists only to re-render the progress
     hairlines each tick. The authoritative countdown lives in the store. */
  const [, bumpTick] = useState(0);
  /* STATE, not a ref: `Portal` renders nothing on its first pass (it resolves its
     target in an effect), so a plain ref is still null when a `[hidden]`-keyed
     effect fires and the measurement below would silently never run. A callback
     ref that sets state re-runs that effect the moment the node really attaches. */
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  /* One interval for the whole stack; a second mounted host would advance
     every TTL at double speed. */
  useEffect(() => {
    const id = setInterval(() => {
      tickNotifications(TICK_MS);
      bumpTick((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hidden = suppressed || items.length === 0;

  /* Publish how far the GavelChip and the gavel handover toast have to move so
     the stack can own the slot under the header. See the header note. Removed
     entirely when there is nothing on screen, so they sit at their own resting
     tops the rest of the time. */
  useEffect(() => {
    const root = document.documentElement;
    if (!host) { root.style.removeProperty('--dgn-stack-shift'); return; }
    const apply = () => {
      const shift = Math.max(0, topPx + host.offsetHeight + STACK_GAP_PX - CHIP_TOP_PX);
      root.style.setProperty('--dgn-stack-shift', `${Math.round(shift)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => { ro.disconnect(); root.style.removeProperty('--dgn-stack-shift'); };
  }, [host, topPx]);

  if (hidden) return null;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;

  return (
    <Portal>
      <style>{`
        @keyframes dgn-in {
          from { opacity: 0; transform: translateX(var(--dgn-slide)) scale(0.97) }
          to   { opacity: 1; transform: none }
        }
        /* Slides in from the anchored edge. Mirrored in RTL, where
           insetInlineEnd puts the stack on the LEFT of the screen. The enter
           animation owns the WRAPPER, not the card: the card's own transform is
           the live drag offset, and a filled-forwards animation on the same
           element would pin it to \`none\` the moment it finished. */
        .dgn-enter { --dgn-slide: ${EDGE_PX}px; animation: dgn-in 260ms ${EASE} both }
        [dir="rtl"] .dgn-enter { --dgn-slide: -${EDGE_PX}px }
        .dgn-card {
          --dgn-dx: 0px;
          --dgn-lift: 0px;
          transform: translate3d(var(--dgn-dx), var(--dgn-lift), 0);
          transition: transform 260ms ${EASE}, box-shadow 220ms ${EASE}, opacity ${EXIT_MS}ms linear;
          /* Vertical gestures still scroll; the horizontal axis is ours. */
          touch-action: pan-y;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.20), 0 12px 32px rgba(12,24,18,0.42);
        }
        /* While the finger is down the card must track it exactly — easing here
           would make the drag feel like it is lagging behind the pointer. */
        .dgn-dragging { transition: none }
        /* Pointer devices only. On touch there is no hover, and a sticky
           :hover after a tap would leave the card lifted for good. */
        @media (hover: hover) and (pointer: fine) {
          .dgn-card:hover {
            --dgn-lift: -2px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 18px 40px rgba(12,24,18,0.52);
          }
        }
        .dgn-act { transition: transform 120ms ${EASE}, filter 120ms ${EASE} }
        .dgn-act:active { transform: scale(0.96) }
        .dgn-act:disabled { opacity: 0.55; cursor: progress }
        @media (prefers-reduced-motion: reduce) {
          /* The DRAG survives — it is a control, not decoration. What goes is the
             easing: entrance, spring-back and fly-out all become instant. */
          .dgn-enter { animation: none }
          .dgn-card { transition: none }
          .dgn-act { transition: none }
        }
      `}</style>

      <div
        ref={setHost}
        aria-live="polite"
        style={{
          position: 'fixed', top: topPx, insetInlineEnd: EDGE_PX, zIndex: 900,
          display: 'flex', flexDirection: 'column', gap: 9,
          width: `min(${CARD_W}px, calc(100vw - ${EDGE_PX * 2}px))`, pointerEvents: 'none',
        }}
      >
        {visible.map((n) => (
          <NotificationCard key={n.key} n={n} extra={extras?.[n.key]} />
        ))}

        {overflow > 0 && (
          <p
            style={{
              margin: 0, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700,
              /* Anchored edge is now the inline-end one, so the overflow count
                 hangs off that side rather than floating away from the stack. */
              color: 'rgba(27,56,40,0.62)', paddingInlineEnd: 6, textAlign: 'end',
            }}
          >
            +{overflow} more
          </p>
        )}
      </div>
    </Portal>
  );
}
