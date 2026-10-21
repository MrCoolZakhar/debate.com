'use client';

// ── AppNotifyPills ─────────────────────────────────────────────────────────
//
// The renderer for `notifyOk` / `notifyErr` (`@/lib/appNotify`) outside the
// sessions runtime: Apple-style liquid glass pills rising from the BOTTOM CENTRE
// of the screen (owner, 21 Oct 2026: "Focus on liquid glass like Apple does it.
// Or the notifications that come up from the bottom as a pill.").
//
// Renderer only. The store (`@/lib/sessionNotifications`) still owns the queue,
// the one-card-per-key dedupe, the TTLs and the hold; `NotificationStack` still
// owns the ONE interval that ages them and hands the app cards over here. On the
// session routes it keeps them in its own corner stack, so the chair console and
// the delegate phone are untouched.
//
// • Stack: newest at the bottom, older ones shift up, shrink a hair and fade;
//   at most MAX_VISIBLE on screen (a fourth is kept, invisible, until room frees).
// • Hold: while the pointer or keyboard focus is on any pill, every pill's TTL is
//   on hold (`holdNotification`), so nothing leaves or shifts under the pointer.
// • Leave: a card that left the store (TTL, the x, `clearErr`) is kept as a
//   snapshot for EXIT_MS so it can slide down and fade instead of vanishing.
// • One drawn set: a surface can end up with two mounted stacks (a page's own
//   plus the root layout's), and two pill sets would overlap pixel for pixel, so
//   only the first mounted instance draws.
// • Look and motion live in `./appNotifyPills.css`.

import './appNotifyPills.css';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, CircleAlert, X } from 'lucide-react';
import { dismiss, holdNotification, type useNotifications } from '@/lib/sessionNotifications';

type LiveItem = ReturnType<typeof useNotifications>['items'][number];

/** Pills on screen at once; older ones wait, invisible, until room frees. */
const MAX_VISIBLE = 3;
const GAP_PX = 8;
/** Used until a pill has been measured (the one-line height). */
const DEFAULT_H = 52;
/** Matches `gvp-out` in the stylesheet. */
const EXIT_MS = 240;
/** Bridges the 8px gaps, so moving from one pill to the next keeps the hold. */
const LEAVE_GRACE_MS = 300;
const OPACITY = [1, 0.82, 0.64];
const SCALE = [1, 0.97, 0.94];

interface Placed {
  n: LiveItem;
  offset: number;
  depth: number;
}

// ── One drawn instance per page ────────────────────────────────────────────
const owners: string[] = [];
const ownerListeners = new Set<() => void>();
function emitOwners() { for (const l of ownerListeners) l(); }
function subscribeOwners(cb: () => void) {
  ownerListeners.add(cb);
  return () => { ownerListeners.delete(cb); };
}
function firstOwner(): string { return owners[0] ?? ''; }

function useIsDrawingInstance(): boolean {
  const id = useId();
  useEffect(() => {
    owners.push(id);
    emitOwners();
    return () => {
      const i = owners.indexOf(id);
      if (i >= 0) owners.splice(i, 1);
      emitOwners();
    };
  }, [id]);
  return useSyncExternalStore(subscribeOwners, firstOwner, () => '') === id;
}

function sameLayout(a: Record<string, Placed>, b: Record<string, Placed>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    const x = a[k];
    const y = b[k];
    if (!y || x.offset !== y.offset || x.depth !== y.depth
      || x.n.createdAt !== y.n.createdAt || x.n.title !== y.n.title || x.n.body !== y.n.body) return false;
  }
  return true;
}

export default function AppNotifyPills({ items, dismissLabel }: { items: LiveItem[]; dismissLabel: string }) {
  const drawing = useIsDrawingInstance();
  const [mounted, setMounted] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});
  /* The last live layout, and the cards that have left it and are on their way out. */
  const [shown, setShown] = useState<Record<string, Placed>>({});
  const [leaving, setLeaving] = useState<Placed[]>([]);
  const [holding, setHolding] = useState(false);
  const thawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldKeys = useRef<Set<string>>(new Set());
  const exitTimers = useRef<Map<Placed, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) setMounted(true); });
    return () => { alive = false; };
  }, []);

  /* Oldest first, so the newest is last and sits at the bottom. A re-notify resets
     `createdAt`, so a card raised again comes back to the bottom as the newest. */
  const live = useMemo(
    () => (drawing ? [...items].sort((a, b) => a.createdAt - b.createdAt) : []),
    [items, drawing],
  );
  const liveKeys = useMemo(() => new Set(live.map((n) => n.key)), [live]);

  const layout = useMemo(() => {
    const out: Record<string, Placed> = {};
    let offset = 0;
    for (let i = live.length - 1, depth = 0; i >= 0; i -= 1, depth += 1) {
      const n = live[i];
      out[n.key] = { n, offset, depth };
      /* Pills past the visible ones stack at the last visible slot, hidden. */
      if (depth < MAX_VISIBLE - 1) offset += (heights[n.key] ?? DEFAULT_H) + GAP_PX;
    }
    return out;
  }, [live, heights]);

  /* Derived state, adjusted during render: a key that was on screen and is no longer
     live starts leaving from where it was; the layout snapshot follows the live one. */
  const departed = Object.values(shown).filter(
    (p) => !liveKeys.has(p.n.key) && !leaving.some((l) => l.n.key === p.n.key),
  );
  if (departed.length || !sameLayout(shown, layout)) {
    if (departed.length) {
      setLeaving([
        ...leaving.filter((l) => !liveKeys.has(l.n.key)),
        ...departed.filter((p) => p.depth < MAX_VISIBLE),
      ]);
    }
    setShown(layout);
  }

  /* Each leaving snapshot is dropped once its exit has played. */
  useEffect(() => {
    const timers = exitTimers.current;
    for (const p of leaving) {
      if (timers.has(p)) continue;
      timers.set(p, setTimeout(() => {
        timers.delete(p);
        setLeaving((prev) => prev.filter((x) => x !== p));
      }, EXIT_MS));
    }
  }, [leaving]);
  useEffect(() => () => {
    for (const t of exitTimers.current.values()) clearTimeout(t);
    exitTimers.current.clear();
    if (thawTimer.current) clearTimeout(thawTimer.current);
    for (const k of heldKeys.current) holdNotification(k, false);
    heldKeys.current.clear();
  }, []);

  /* The hold covers every pill, arrivals included, while the pointer or focus is here. */
  const liveKeyList = live.map((n) => n.key).join('\n');
  useEffect(() => {
    const keys = liveKeyList ? liveKeyList.split('\n') : [];
    if (holding) {
      for (const k of keys) { holdNotification(k, true); heldKeys.current.add(k); }
    } else {
      for (const k of heldKeys.current) holdNotification(k, false);
      heldKeys.current.clear();
    }
  }, [holding, liveKeyList]);

  const hold = () => {
    if (thawTimer.current) { clearTimeout(thawTimer.current); thawTimer.current = null; }
    setHolding(true);
  };
  const thawSoon = () => {
    if (thawTimer.current) clearTimeout(thawTimer.current);
    thawTimer.current = setTimeout(() => {
      thawTimer.current = null;
      setHolding(false);
    }, LEAVE_GRACE_MS);
  };
  /* Nothing left to point at: no pointerleave will come, so let go now. */
  if (live.length === 0 && holding) setHolding(false);

  const onHeight = useCallback((key: string, h: number) => {
    setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);

  if (!drawing || !mounted) return null;

  const placed: Array<Placed & { out: boolean }> = [
    ...live.map((n) => ({ ...layout[n.key], out: false })),
    ...leaving.filter((p) => !liveKeys.has(p.n.key)).map((p) => ({ ...p, out: true })),
  ];
  if (placed.length === 0) return null;

  return createPortal(
    <div className="gvp-host">
      {placed.map((p) => (
        <Pill
          key={p.n.key}
          p={p}
          leaving={p.out}
          dismissLabel={dismissLabel}
          onHeight={onHeight}
          onHold={hold}
          onThaw={thawSoon}
        />
      ))}
    </div>,
    document.body,
  );
}

function Pill({
  p, leaving, dismissLabel, onHeight, onHold, onThaw,
}: {
  p: Placed;
  leaving: boolean;
  dismissLabel: string;
  onHeight: (key: string, h: number) => void;
  onHold: () => void;
  onThaw: () => void;
}) {
  const { n, offset, depth } = p;
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const isError = n.level === 'error';
  const hidden = depth >= MAX_VISIBLE;
  const quiet = hidden || leaving;

  useEffect(() => {
    if (!el || leaving) return;
    const ro = new ResizeObserver(() => onHeight(n.key, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, leaving, n.key, onHeight]);

  const d = Math.min(depth, MAX_VISIBLE - 1);
  const Glyph = isError ? CircleAlert : CircleCheck;

  return (
    <div
      className="gvp-slot"
      aria-hidden={quiet || undefined}
      style={{ transform: `translate3d(0, ${-offset}px, 0) scale(${SCALE[d]})` }}
    >
      <div
        ref={setEl}
        className={`gvp-pill${leaving ? ' gvp-leaving' : ''}`}
        role={quiet ? undefined : isError ? 'alert' : 'status'}
        aria-live={quiet ? undefined : isError ? 'assertive' : 'polite'}
        aria-atomic={quiet ? undefined : true}
        onPointerEnter={onHold}
        onPointerLeave={onThaw}
        onFocus={onHold}
        onBlur={onThaw}
        style={{
          ['--gvp-o' as string]: hidden ? 0 : OPACITY[d],
          pointerEvents: quiet ? 'none' : undefined,
        } as React.CSSProperties}
      >
        <span className={`gvp-glyph ${isError ? 'gvp-glyph-error' : 'gvp-glyph-ok'}`} aria-hidden="true">
          <Glyph size={20} strokeWidth={1.75} />
        </span>
        <div className="gvp-text">
          <p className="gvp-msg">{n.title}</p>
          {n.body ? <p className="gvp-body">{n.body}</p> : null}
        </div>
        <button
          type="button"
          className="gvp-x focus:outline-none"
          aria-label={dismissLabel}
          tabIndex={quiet ? -1 : undefined}
          onClick={() => dismiss(n.key)}
        >
          <span className="gvp-x-dot">
            <X size={15} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  );
}
