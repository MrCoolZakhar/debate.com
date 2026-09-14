'use client';

// ── NotificationStack ──────────────────────────────────────────────────────
//
// The chair-facing notification surface: frosted-glass banners in the manner of
// iOS / macOS notifications, stacked at the TOP-RIGHT of the viewport (top, full
// width on a phone). Renderer only — every rule about what appears,
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

// ── The look (Sep 2026) ────────────────────────────────────────────────────
//
// • Material: `./glass.ts` — light translucent ivory, blur(28px) saturate(180%),
//   a lit hairline edge and a layered forest-tinted shadow, with a solid fallback
//   where backdrop-filter is unsupported. Dark ink on it, contrast worked out there.
// • Anatomy: an app-icon seat (a squircle of forest / gold / outcome colour with a
//   Lucide glyph, or a RECTANGULAR flag with a small kind badge), a bold title, a
//   secondary body, a relative timestamp ("now", "2 min ago", via
//   Intl.RelativeTimeFormat so no strings are added per locale).
// • Two groups, ACTIONABLE above PASSIVE.
//   - Actionable = any card with actions (a GSL request, any Accept / Reject). These
//     are NEVER folded into the deck: each is its own card, urgent first, then in
//     ARRIVAL order (oldest on top, store insertion order, which a re-notify does not
//     change). A new request is appended BELOW the existing ones, so it can never
//     slide into the slot under the chair's cursor and take the click meant for the
//     request that was there. Folding them used to hide older requests with their
//     buttons unreachable while their TTL ran out, and swap the front card mid-click.
//   - Passive = chat, broadcasts, success / error. Urgent first, then newest first,
//     and with more than one they collapse into the glass deck: the newest is drawn
//     with up to two slabs peeking out beneath it; tapping the deck, its slabs or the
//     "+N more" capsule fans it out, "Show less" folds it back.
// • Hover freeze. While the pointer is over the stack (and for LEAVE_GRACE_MS after
//   it leaves, so crossing the gap between two cards does not thaw it) the layout is
//   frozen: cards keep their order, new arrivals only append to the end of their
//   group, and a card that leaves (answered, dismissed, expired, actioned by another
//   chair) keeps its slot as an invisible, non-interactive ghost of the same size.
//   So neither an arrival nor a departure can move a button under the pointer, and a
//   double click on Accept cannot land on the next request. It reflows on leave.
// • Overflow: every actionable card is always rendered, so a long run of requests can
//   outgrow the viewport; the column then scrolls instead of pushing buttons off screen.
// • Motion: drops in from the top (and slightly from the anchored edge on wide
//   screens) on a spring; expanded cards unfold with a short stagger; swipe toward
//   the anchored edge or the x dismisses. prefers-reduced-motion removes every
//   animation and transition but keeps swipe, which is a control.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, X, Hand, MessageCircle, Megaphone, Info, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { getFlagUrl } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import {
  useNotifications, dismiss, setPending, tickNotifications,
  type NotificationKind, type NotificationLevel, type NotificationTone,
} from '@/lib/sessionNotifications';
import { GLASS, GLASS_SAFE, glassFallbackCss, SPRING_BEZIER, SPRING_LINEAR } from './glass';

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
/** How far each slab of a collapsed deck peeks out below the one in front of it. */
const PEEK_PX = 7;
/** Slabs drawn behind the front card. iOS shows two; more reads as clutter. */
const MAX_SLABS = 2;

/* Swipe-to-dismiss thresholds. Either one is enough: a long deliberate drag, or
   a short fast flick. */
const DISMISS_FRACTION = 0.4;          // of the card width
const FLICK_MIN_PX = 24;               // ignore jitter on a tap
const FLICK_MIN_SPEED = 0.6;           // px per ms, toward the anchored edge
/** Below this the gesture is a TAP, not a drag (it may expand the deck). */
const TAP_SLOP_PX = 4;
/** Drag against the anchored edge is damped and always springs back. */
const COUNTER_DRAG_DAMPING = 0.35;
/** Time the fly-out takes; matches the `transform` transition on `.dgn-card`. */
const EXIT_MS = 190;
/** How long the hover freeze outlives the pointer. Bridges the 8px gaps between cards. */
const LEAVE_GRACE_MS = 500;
/** Space kept below the stack when it has to scroll. */
const BOTTOM_PX = 12;

const LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES', fr: 'fr-FR', ar: 'ar' };

const KIND_ICON: Record<NotificationKind, typeof Hand> = {
  'gsl-request': Hand,
  chat: MessageCircle,
  broadcast: Megaphone,
  motion: Info,
  info: Info,
};

/**
 * The app-icon seat, per kind. Forest with a gold glyph is "the dais"; gold with a
 * forest glyph is "the organisers" — a broadcast is the one card that comes from
 * outside the room, and it should look it at a glance.
 */
const KIND_SEAT: Record<NotificationKind, { bg: string; ink: string }> = {
  'gsl-request': { bg: 'linear-gradient(160deg, #3D7A52 0%, #1B3828 100%)', ink: '#EED98A' },
  chat: { bg: 'linear-gradient(160deg, #3D7A52 0%, #1B3828 100%)', ink: '#EED98A' },
  broadcast: { bg: 'linear-gradient(160deg, #F4E3A1 0%, #D9B452 55%, #B6871F 100%)', ink: '#1B3828' },
  motion: { bg: 'linear-gradient(160deg, #2A5A3C 0%, #1B3828 100%)', ink: '#FAF8F3' },
  info: { bg: 'linear-gradient(160deg, #2A5A3C 0%, #1B3828 100%)', ink: '#FAF8F3' },
};

/**
 * Outcome colour, applied to the ICON SEAT only.
 *
 * The organiser bars this stack replaced said "good" or "bad" with their tint,
 * and a card that reports "Couldn't save" must not look like one reporting
 * "Reminder sent". The glass body is untouched — recolouring that would give
 * the stack two visual identities. Every colour here is a fill behind a glyph,
 * never text, so nothing readable changes contrast. `null` = use the kind seat.
 */
const LEVEL: Record<NotificationLevel, { seat: { bg: string; ink: string } | null; glyph: typeof Info | null }> = {
  neutral: { seat: null, glyph: null },
  ok: { seat: { bg: 'linear-gradient(160deg, #4E9A68 0%, #2A5A3C 100%)', ink: '#FFFFFF' }, glyph: Check },
  error: { seat: { bg: 'linear-gradient(160deg, #C0463F 0%, #8B2020 100%)', ink: '#FFFFFF' }, glyph: AlertTriangle },
};

/* Buttons on light glass. Accept is the one filled control, so the eye lands on the
   decision; reject and neutral are tinted washes. Reject text is the weakest, 5.7:1 over
   forest-backed glass; see ./glass.ts for the numbers. */
const TONE: Record<NotificationTone, { bg: string; fg: string; border: string; shadow: string }> = {
  accept: {
    bg: 'linear-gradient(180deg, #2A5A3C 0%, #1B3828 100%)', fg: '#FAF8F3',
    border: '1px solid rgba(27,56,40,0.9)',
    shadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(27,56,40,0.25)',
  },
  reject: {
    bg: 'rgba(139,32,32,0.08)', fg: '#8B2020',
    border: '1px solid rgba(139,32,32,0.18)', shadow: 'none',
  },
  neutral: {
    bg: 'rgba(27,56,40,0.07)', fg: '#1B3828',
    border: '1px solid rgba(27,56,40,0.14)', shadow: 'none',
  },
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
 * "now" under a minute, then "N min ago" / "N hr ago", in the viewer's locale.
 * Intl does the words, so no translation keys are needed for any of the four locales.
 */
function formatAgo(rtf: Intl.RelativeTimeFormat | null, createdAt: number): string {
  if (!rtf) return '';
  const secs = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (secs < 60) return rtf.format(0, 'second');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  return rtf.format(-Math.floor(mins / 60), 'hour');
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

type LiveItem = ReturnType<typeof useNotifications>['items'][number];

/** Any card the chair can answer. These are never folded into the deck. */
function isActionable(n: LiveItem): boolean {
  return !!n.actions?.length;
}

/** The hover-frozen layout. Orders only ever grow (arrivals append); nothing is re-sorted. */
interface Frozen {
  /** Actionable keys in the order they were on screen, then arrivals. */
  act: string[];
  /** Passive keys likewise. */
  passive: string[];
  /** The deck's front card when the freeze began, kept in front while it lives. */
  front: string | null;
  /** Last payload seen for each remembered key, drawn as the ghost once it has left. */
  snap: Record<string, LiveItem>;
}

interface Slot {
  n: LiveItem;
  group: 'act' | 'passive';
  /** Left the store during the freeze; holds its slot invisibly. */
  ghost: boolean;
  /** Front card of the collapsed passive deck. */
  front?: boolean;
}

interface CardProps {
  n: LiveItem;
  extra?: NotificationExtra;
  /** Glass slabs to draw peeking out beneath this card (collapsed deck only). */
  behind: number;
  /** Tapping the card body (not a button, not a drag). Expands a collapsed deck. */
  onTap?: () => void;
  /** Mount-time entrance: a fresh arrival drops in, a card revealed by expanding unfolds. */
  entrance: 'drop' | 'unfold';
  /** Stagger slot for the unfold. */
  index: number;
  rtf: Intl.RelativeTimeFormat | null;
  dismissLabel: string;
  /**
   * Hover-freeze placeholder: the card has left the store but keeps its slot, invisible
   * and inert, so nothing below it moves under the pointer. Same component and key as
   * the live card, so it is the same instance (no remount, no replayed entrance).
   */
  ghost?: boolean;
}

/** The app-icon seat: a coloured squircle with a glyph, or a rectangular flag with a kind badge. */
function Seat({ n }: { n: LiveItem }) {
  const level = LEVEL[n.level ?? 'neutral'];
  const seat = level.seat ?? KIND_SEAT[n.kind];
  const Glyph = level.glyph ?? KIND_ICON[n.kind];
  const KindGlyph = KIND_ICON[n.kind];

  if (n.flagCode) {
    return (
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(237,231,216,0.9))',
          boxShadow: 'inset 0 0 0 0.5px rgba(27,56,40,0.16), 0 1px 2px rgba(27,56,40,0.12)',
        }}
      >
        {/* Rectangular, never cropped to a circle (CLAUDE.md §8: rectangular flags only). */}
        <img
          src={getFlagUrl(n.flagCode)}
          alt=""
          draggable={false}
          style={{
            width: 28, height: 19, borderRadius: 3, objectFit: 'cover', display: 'block',
            outline: '0.5px solid rgba(28,20,16,0.18)', outlineOffset: -0.5,
          }}
        />
        <span
          style={{
            position: 'absolute', insetInlineEnd: -4, bottom: -4, width: 17, height: 17,
            borderRadius: 999, display: 'grid', placeItems: 'center',
            background: seat.bg, color: seat.ink,
            /* A ring of the glass colour cuts the badge out of the seat, like an iOS avatar badge. */
            boxShadow: '0 0 0 2px #F6F2E8, 0 1px 2px rgba(27,56,40,0.25)',
          }}
        >
          <KindGlyph size={9} strokeWidth={2.8} />
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: seat.bg, color: seat.ink,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 3px rgba(27,56,40,0.22)',
      }}
    >
      <Glyph size={18} strokeWidth={2.3} />
    </span>
  );
}

/**
 * One card. Split out of the stack so the drag lives in component state:
 * the host re-renders four times a second to advance the TTL hairlines, and a
 * drag offset held up there would be recreated on every one of those ticks.
 */
function NotificationCard({ n, extra, behind, onTap, entrance, index, rtf, dismissLabel, ghost }: CardProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number; startX: number; lastX: number; lastT: number; velocity: number;
  } | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /* Captured once: changing the wrapper's animation class after mount would replay it. */
  const [entranceClass] = useState(entrance === 'unfold' ? 'dgn-unfold' : 'dgn-drop');

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
    if (e.type === 'pointerup' && Math.abs(d.lastX - d.startX) < TAP_SLOP_PX) {
      setDragging(false);
      setDx(0);
      onTap?.();
      return;
    }
    const sign = anchorSign();
    const along = dx * sign;                    // travelled toward the anchored edge
    const speed = d.velocity * sign;            // px/ms toward the anchored edge
    const past = along > CARD_W * DISMISS_FRACTION;
    const flicked = along > FLICK_MIN_PX && speed > FLICK_MIN_SPEED;
    if (past || flicked) { flyOutAndDismiss(); return; }
    setDragging(false);
    setDx(0);                                   // spring back
  };

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
  const slabs = Math.min(MAX_SLABS, Math.max(0, behind));

  return (
    <div
      className={entranceClass}
      aria-hidden={ghost || undefined}
      style={{
        position: 'relative', isolation: 'isolate',
        /* `visibility: hidden` also drops it from the tab order and the a11y tree. */
        visibility: ghost ? 'hidden' : undefined,
        pointerEvents: ghost ? 'none' : undefined,
        paddingBottom: slabs * PEEK_PX,
        transition: `padding-bottom 260ms ${EASE}`,
        ['--dgn-i' as string]: index,
      } as React.CSSProperties}
    >
      {/* Collapsed deck: glass slabs the same size as the front card, pushed down and
          narrowed so a sliver of each shows. Shapes only — no content to read, and they
          are the tap target that fans the deck out. */}
      {Array.from({ length: slabs }, (_, i) => {
        const k = i + 1;
        return (
          <div
            key={`slab-${k}`}
            aria-hidden="true"
            className="dgn-slab"
            onClick={onTap}
            style={{
              position: 'absolute', insetInline: 0, top: 0, bottom: slabs * PEEK_PX,
              zIndex: -k, pointerEvents: 'auto', cursor: 'pointer',
              transform: `translateY(${k * PEEK_PX}px) scale(${1 - k * 0.05})`,
              transformOrigin: '50% 100%',
              borderRadius: GLASS.radius,
              background: GLASS.fill,
              backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
              border: GLASS.border,
              boxShadow: '0 0 0 0.5px rgba(27,56,40,0.12), 0 6px 16px rgba(27,56,40,0.10)',
              opacity: 1 - k * 0.22,
            }}
          />
        );
      })}

      <div
        ref={elRef}
        className={`dgn-card${dragging ? ' dgn-dragging' : ''}${onTap ? ' dgn-tappable' : ''}`}
        role={n.actions?.length ? 'group' : undefined}
        aria-label={n.actions?.length ? n.title : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          ['--dgn-dx' as string]: `${dx}px`,
          opacity: leaving ? 0 : 1,
          pointerEvents: 'auto', position: 'relative', overflow: 'hidden',
          borderRadius: GLASS.radius, padding: '11px 12px 12px',
          /* Frosted light glass (./glass.ts). The shadow lives in the stylesheet, not
             here — an inline one would out-specify the hover lift. */
          background: GLASS.fill,
          backdropFilter: GLASS.blur,
          WebkitBackdropFilter: GLASS.blur,
          border: GLASS.border,
          color: GLASS.ink,
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <Seat n={n} />

          <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <p
                className="dgn-title"
                style={{
                  margin: 0, flex: 1, minWidth: 0, fontFamily: OUTFIT, fontSize: 13.5,
                  fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.005em', color: GLASS.ink,
                }}
              >
                {n.title}
              </p>
              {/* Timestamp and x share one slot on pointer devices: the time rests there
                  and the x replaces it on hover or keyboard focus, as on macOS. On touch
                  both show, since there is no hover to reveal the x. */}
              <span className="dgn-end">
                <span
                  className="dgn-time dgn-ink-faint"
                  suppressHydrationWarning
                  style={{
                    fontFamily: OUTFIT, fontSize: 11, fontWeight: 500, color: GLASS.inkFaint,
                    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatAgo(rtf, n.createdAt)}
                </span>
                {/* EVERY card gets an x, including actionable ones. It used to render only on
                    cards with no actions, which left a GSL request with no way off the screen
                    short of answering it.

                    This is a DISMISSAL, NOT A DECISION: it clears the card from this chair's
                    screen and nothing else. The motion stays pending in the DB, the delegate
                    is still waiting, and any other chair still sees it. Never wire an accept
                    or a reject in here. */}
                <button
                  type="button"
                  onClick={flyOutAndDismiss}
                  aria-label={dismissLabel}
                  title={dismissLabel}
                  className="dgn-x dgn-ink-soft focus:outline-none"
                  style={{
                    width: 22, height: 22, borderRadius: 999, cursor: 'pointer',
                    display: 'grid', placeItems: 'center', padding: 0,
                    background: 'rgba(27,56,40,0.08)', color: GLASS.inkSoft,
                    border: '0.5px solid rgba(27,56,40,0.12)',
                  }}
                >
                  <X size={11} strokeWidth={2.8} />
                </button>
              </span>
            </div>

            {n.body && (
              <p
                className="dgn-ink-soft"
                style={{
                  margin: '2px 0 0', fontFamily: OUTFIT, fontSize: 12.5,
                  fontWeight: 400, lineHeight: 1.35, color: GLASS.inkSoft,
                  overflowWrap: 'anywhere',
                }}
              >
                {n.body}
              </p>
            )}

            {noteLine && (
              <p
                className="dgn-ink-gold"
                style={{
                  margin: '5px 0 0', fontFamily: OUTFIT, fontSize: 12,
                  fontWeight: 700, lineHeight: 1.3, color: GLASS.goldInk,
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
                  outline: '0.5px solid rgba(27,56,40,0.16)', outlineOffset: -0.5,
                }}
              />
            )}
          </div>
        </div>

        {!!n.actions?.length && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {n.actions.map((a) => {
              const tone = TONE[a.tone];
              const busy = !!n.pending;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  className="dgn-act focus:outline-none"
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
                    background: tone.bg, color: tone.fg, border: tone.border, boxShadow: tone.shadow,
                    fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 650,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {a.tone === 'accept' && <Check size={13} strokeWidth={2.8} />}
                  {a.tone === 'reject' && <X size={13} strokeWidth={2.8} />}
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
              background: 'linear-gradient(90deg, rgba(182,135,31,0.6), rgba(182,135,31,0.18))',
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
  const t = useT();
  const { language } = useLanguage();
  const rtf = useMemo(() => {
    try {
      return new Intl.RelativeTimeFormat(LOCALES[language] ?? 'en-GB', { numeric: 'auto', style: 'short' });
    } catch { return null; }
  }, [language]);
  /* Value is never read — the state exists only to re-render the progress
     hairlines each tick. The authoritative countdown lives in the store. */
  const [, bumpTick] = useState(0);
  /* STATE, not a ref: `Portal` renders nothing on its first pass (it resolves its
     target in an effect), so a plain ref is still null when a `[hidden]`-keyed
     effect fires and the measurement below would silently never run. A callback
     ref that sets state re-runs that effect the moment the node really attaches. */
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  /* Deck state. Fanned out only on request; folds itself back when there is nothing
     left to fan (see the effect below), so the next burst arrives as a deck again. */
  const [expanded, setExpanded] = useState(false);
  /* Keys that were in the deck when it last expanded — those UNFOLD, anything newer
     DROPS in. Only read at a card's mount (the card captures it once). */
  const [expandedFrom, setExpandedFrom] = useState<Set<string>>(() => new Set());
  /* Hover freeze (see the header note). `null` = live layout. */
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const thawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Keyboard focus freezes the layout exactly like the pointer does. */
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  /* The inner column, measured against the host so the stack scrolls only when it must
     (an always-on scroller would clip the card shadows, the slabs and the fly-out). */
  const [column, setColumn] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  /* One interval for the whole stack; a second mounted host would advance
     every TTL at double speed. */
  useEffect(() => {
    const id = setInterval(() => {
      tickNotifications(TICK_MS);
      bumpTick((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { if (thawTimer.current) clearTimeout(thawTimer.current); }, []);

  const hidden = suppressed || items.length === 0;

  /* An unmounted stack gets no pointerleave / blur, so forget both when it goes away. */
  useEffect(() => {
    if (!hidden) return;
    hoverRef.current = false;
    focusRef.current = false;
  }, [hidden]);

  /* Actionable cards are never folded; only passive ones form the deck. */
  const actionable = items
    .filter(isActionable)
    /* Stable sort over store order, which is arrival order and survives a re-notify. */
    .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  /* Urgent first (an organiser broadcast that pauses debate outranks everything), then
     newest first. `createdAt` is reset by a re-notify, so a card that just updated rises. */
  const passive = items
    .filter((n) => !isActionable(n))
    .sort((a, b) => (Number(!!b.urgent) - Number(!!a.urgent)) || (b.createdAt - a.createdAt));

  /* Fold the deck back once there is nothing left to fan, so the next burst arrives as a
     deck again. Adjusted during render (React's "derived state" pattern), not in an effect. */
  if (passive.length <= 1 && expanded) setExpanded(false);

  /* The pointer cannot still be over a stack that is not on screen, and `pointerleave`
     never fires on an unmounted node, so drop the freeze with it. */
  if (hidden && frozen) setFrozen(null);

  /* While frozen, remember every card that shows up (appended to the END of its group)
     together with a snapshot to draw its ghost from if it leaves before the thaw. Same
     derived-state pattern; it converges because a second pass finds nothing new. */
  if (frozen && !hidden) {
    const freshAct = actionable.filter((n) => !frozen.act.includes(n.key));
    const freshPassive = passive.filter((n) => !frozen.passive.includes(n.key));
    if (freshAct.length || freshPassive.length) {
      const snap = { ...frozen.snap };
      for (const n of [...freshAct, ...freshPassive]) if (!snap[n.key]) snap[n.key] = n;
      setFrozen({
        ...frozen,
        act: [...frozen.act, ...freshAct.map((n) => n.key)],
        passive: [...frozen.passive, ...freshPassive.map((n) => n.key)],
        snap,
      });
    }
  }

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

  /* Scroll only when the column is taller than the room the host has. */
  useEffect(() => {
    if (!host || !column) return;
    const measure = () => setOverflowing(column.offsetHeight > host.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(column);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host, column]);

  if (hidden) return null;

  const deck = passive.length > 1 && !expanded;
  const actByKey = new Map(actionable.map((n) => [n.key, n]));
  const passiveByKey = new Map(passive.map((n) => [n.key, n]));

  /* ── Layout. Live: the natural order. Frozen: the remembered order, ghosts in the
     slots of cards that have left, arrivals appended. ── */
  const slots: Slot[] = [];
  const actOrder = frozen ? frozen.act : actionable.map((n) => n.key);
  for (const key of actOrder) {
    const live = actByKey.get(key);
    if (live) slots.push({ n: live, group: 'act', ghost: false });
    else if (frozen?.snap[key]) slots.push({ n: frozen.snap[key], group: 'act', ghost: true });
  }

  let passiveShown = 0;
  if (deck) {
    /* No front at freeze time (no passive card then, or the deck was fanned out): hold
       the oldest remembered one that is still live, not the newest arrival. */
    const frontKey = frozen
      ? frozen.front ?? frozen.passive.find((k) => passiveByKey.has(k)) ?? null
      : null;
    const heldFront = frontKey ? passiveByKey.get(frontKey) : undefined;
    if (heldFront) {
      slots.push({ n: heldFront, group: 'passive', ghost: false, front: true });
    } else {
      if (frontKey && frozen?.snap[frontKey]) slots.push({ n: frozen.snap[frontKey], group: 'passive', ghost: true });
      slots.push({ n: passive[0], group: 'passive', ghost: false, front: true });
    }
    passiveShown = 1;
  } else {
    const order = frozen ? frozen.passive : passive.map((n) => n.key);
    for (const key of order) {
      const live = passiveByKey.get(key);
      if (live) {
        if (passiveShown >= MAX_VISIBLE) continue;
        slots.push({ n: live, group: 'passive', ghost: false });
        passiveShown += 1;
      } else if (frozen?.snap[key]) {
        slots.push({ n: frozen.snap[key], group: 'passive', ghost: true });
      }
    }
  }
  const hiddenCount = passive.length - passiveShown;

  const expand = () => {
    setExpandedFrom(new Set(passive.map((n) => n.key)));
    setExpanded(true);
  };
  const collapse = () => setExpanded(false);

  const freeze = (via: 'pointer' | 'focus') => {
    (via === 'pointer' ? hoverRef : focusRef).current = true;
    if (thawTimer.current) { clearTimeout(thawTimer.current); thawTimer.current = null; }
    if (frozen) return;
    const snap: Record<string, LiveItem> = {};
    for (const n of items) snap[n.key] = n;
    setFrozen({
      act: actionable.map((n) => n.key),
      passive: passive.map((n) => n.key),
      /* The card drawn where the deck's front is, deck or lone card alike, so a second
         chat arriving does not replace the one under the pointer. */
      front: !expanded ? passive[0]?.key ?? null : null,
      snap,
    });
  };
  const thawSoon = (via: 'pointer' | 'focus') => {
    (via === 'pointer' ? hoverRef : focusRef).current = false;
    if (thawTimer.current) clearTimeout(thawTimer.current);
    thawTimer.current = setTimeout(() => {
      thawTimer.current = null;
      /* Answering a card hides its focused button, which blurs it while the pointer is
         still resting on the stack. Only thaw once neither the pointer nor focus is here. */
      if (hoverRef.current || focusRef.current) return;
      setFrozen(null);
    }, LEAVE_GRACE_MS);
  };

  return (
    <Portal>
      <style>{`
        /* Enter: drop from the top on a spring, nudged in from the anchored edge on wide
           screens. The ANIMATION owns the wrapper, not the card: the card's own transform
           is the live drag offset, and a filled-forwards animation on the same element
           would pin it to \`none\` the moment it finished. */
        @keyframes dgn-drop {
          from { opacity: 0; transform: translate3d(var(--dgn-slide-x), -18px, 0) scale(0.94) }
          60%  { opacity: 1 }
          to   { opacity: 1; transform: none }
        }
        @keyframes dgn-unfold {
          from { opacity: 0; transform: translate3d(0, -22px, 0) scale(0.95) }
          to   { opacity: 1; transform: none }
        }
        .dgn-drop, .dgn-unfold { --dgn-slide-x: 0px }
        @media (min-width: 640px) {
          .dgn-drop { --dgn-slide-x: 12px }
          [dir="rtl"] .dgn-drop { --dgn-slide-x: -12px }
        }
        .dgn-drop {
          animation: dgn-drop 560ms ${SPRING_BEZIER} both;
          animation-timing-function: ${SPRING_LINEAR};
        }
        .dgn-unfold {
          animation: dgn-unfold 440ms ${SPRING_BEZIER} both;
          animation-timing-function: ${SPRING_LINEAR};
          animation-delay: calc(var(--dgn-i, 0) * 32ms);
        }
        .dgn-card {
          --dgn-dx: 0px;
          --dgn-lift: 0px;
          transform: translate3d(var(--dgn-dx), var(--dgn-lift), 0);
          transition: transform 320ms ${EASE}, box-shadow 220ms ${EASE}, opacity ${EXIT_MS}ms linear;
          /* Vertical gestures still scroll; the horizontal axis is ours. */
          touch-action: pan-y;
          box-shadow: ${GLASS.shadow};
          -webkit-font-smoothing: antialiased;
        }
        .dgn-tappable { cursor: pointer }
        .dgn-slab { transition: transform 260ms ${EASE}, opacity 260ms ${EASE} }
        ${glassFallbackCss('.dgn-card, .dgn-slab, .dgn-pill, .dgn-pill-note')}
        /* Text colours are color-mix() too; without it the inline colour is dropped.
           Restore the pre-mixed values (see ./glass.ts) rather than inheriting. */
        @supports not (color: color-mix(in srgb, red 50%, blue)) {
          .dgn-ink-soft { color: ${GLASS_SAFE.inkSoft} !important }
          .dgn-ink-faint { color: ${GLASS_SAFE.inkFaint} !important }
          .dgn-ink-gold { color: ${GLASS_SAFE.goldInk} !important }
        }
        /* While the finger is down the card must track it exactly — easing here
           would make the drag feel like it is lagging behind the pointer. */
        .dgn-dragging { transition: none }
        .dgn-end { display: grid; align-items: center; justify-items: end; flex-shrink: 0 }
        .dgn-end > * { grid-area: 1 / 1 }
        .dgn-time { transition: opacity 140ms ${EASE} }
        .dgn-x { opacity: 0; pointer-events: none; transition: opacity 140ms ${EASE}, background-color 140ms ${EASE}, transform 120ms ${EASE} }
        .dgn-card:hover .dgn-x, .dgn-card:focus-within .dgn-x { opacity: 1; pointer-events: auto }
        .dgn-card:hover .dgn-time, .dgn-card:focus-within .dgn-time { opacity: 0 }
        .dgn-x:hover { background-color: rgba(27,56,40,0.14) !important }
        .dgn-x:focus-visible, .dgn-act:focus-visible, .dgn-pill:focus-visible {
          box-shadow: 0 0 0 2px #FAF8F3, 0 0 0 4px rgba(27,56,40,0.55) !important;
        }
        /* Touch: no hover to reveal the x, so it always shows beside the time. */
        @media (hover: none) {
          .dgn-end { display: flex; gap: 6px }
          .dgn-x { opacity: 1; pointer-events: auto }
          .dgn-card:focus-within .dgn-time { opacity: 1 }
        }
        /* Pointer devices only. On touch there is no hover, and a sticky
           :hover after a tap would leave the card lifted for good. */
        @media (hover: hover) and (pointer: fine) {
          .dgn-card:hover { --dgn-lift: -1px; box-shadow: ${GLASS.shadowHover} }
          .dgn-act:hover:not(:disabled) { filter: brightness(1.06) saturate(1.05) }
          .dgn-pill:hover { color: #1B3828 !important }
        }
        .dgn-act { transition: transform 120ms ${EASE}, filter 120ms ${EASE} }
        .dgn-act:active:not(:disabled), .dgn-x:active, .dgn-pill:active { transform: scale(0.96) }
        .dgn-act:disabled { opacity: 0.55; cursor: progress }
        .dgn-pill { transition: transform 120ms ${EASE}, color 140ms ${EASE} }
        @media (prefers-reduced-motion: reduce) {
          /* The DRAG survives — it is a control, not decoration. What goes is the
             easing: entrance, unfold, spring-back and fly-out all become instant. */
          .dgn-drop, .dgn-unfold { animation: none }
          .dgn-card, .dgn-slab, .dgn-act, .dgn-x, .dgn-time, .dgn-pill { transition: none }
        }
      `}</style>

      <div
        ref={setHost}
        aria-live="polite"
        onPointerEnter={() => freeze('pointer')}
        onPointerLeave={() => thawSoon('pointer')}
        onFocus={() => freeze('focus')}
        onBlur={() => thawSoon('focus')}
        style={{
          position: 'fixed', top: topPx, insetInlineEnd: EDGE_PX, zIndex: 900,
          width: `min(${CARD_W}px, calc(100vw - ${EDGE_PX * 2}px))`,
          /* Percent of the containing block: the viewport, or the scaled #fit-root. */
          maxHeight: `calc(100% - ${topPx + BOTTOM_PX}px)`,
          /* Only a scrolling stack takes pointer events itself (so its scrollbar works);
             otherwise the gaps between cards stay click-through to the session. */
          overflowY: overflowing ? 'auto' : 'visible',
          overflowX: overflowing ? 'hidden' : 'visible',
          overscrollBehavior: 'contain',
          pointerEvents: overflowing ? 'auto' : 'none',
        }}
      >
        <div
          ref={setColumn}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {(() => {
            const liveKeys = new Set(items.map((n) => n.key));
            const seen = new Set<string>();
            let passiveIndex = 0;
            return slots.map((sl) => {
              const { n } = sl;
              /* A key reclassified during the freeze (actions added or removed by a
                 re-notify) must not render twice: the live card wins over its ghost. */
              if (seen.has(n.key) || (sl.ghost && liveKeys.has(n.key))) return null;
              seen.add(n.key);
              const i = sl.group === 'passive' ? passiveIndex++ : 0;
              const isFront = !!sl.front && deck;
              return (
                <NotificationCard
                  key={n.key}
                  n={n}
                  ghost={sl.ghost}
                  extra={extras?.[n.key]}
                  behind={isFront ? passive.length - 1 : 0}
                  onTap={isFront ? expand : undefined}
                  entrance={
                    sl.group === 'passive' && expanded && i > 0 && expandedFrom.has(n.key) ? 'unfold' : 'drop'
                  }
                  index={i}
                  rtf={rtf}
                  dismissLabel={t('notif_dismiss')}
                />
              );
            });
          })()}

          {passive.length > 1 && (
            <button
              type="button"
              className="dgn-pill dgn-ink-soft focus:outline-none"
              onClick={deck ? expand : collapse}
              aria-expanded={!deck}
              style={{
                pointerEvents: 'auto', alignSelf: 'flex-end', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: deck ? 2 : 0, padding: '4px 10px 4px 11px', borderRadius: 999,
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600,
                color: GLASS.inkSoft, fontVariantNumeric: 'tabular-nums',
                background: GLASS.fill, backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
                border: GLASS.border,
                boxShadow: '0 0 0 0.5px rgba(27,56,40,0.14), 0 4px 12px rgba(27,56,40,0.12)',
              }}
            >
              {deck
                ? <>{t('notif_more_count', { n: hiddenCount })}<ChevronDown size={12} strokeWidth={2.6} aria-hidden="true" /></>
                : <>{t('notif_show_less')}<ChevronUp size={12} strokeWidth={2.6} aria-hidden="true" /></>}
            </button>
          )}

          {!deck && hiddenCount > 0 && (
            /* On its own glass capsule: bare text here would sit on whatever is behind the
               stack, which on the pre-session card is forest. */
            <p
              className="dgn-pill-note dgn-ink-soft"
              style={{
                margin: 0, alignSelf: 'flex-end', padding: '3px 10px', borderRadius: 999,
                fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: GLASS.inkSoft,
                background: GLASS.fill, backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
                border: GLASS.border,
              }}
            >
              {t('notif_more_count', { n: hiddenCount })}
            </p>
          )}
        </div>
      </div>
    </Portal>
  );
}
