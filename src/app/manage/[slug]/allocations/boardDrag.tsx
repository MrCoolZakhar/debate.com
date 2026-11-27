'use client';

// ── Pointer drag for the Assignment board ────────────────────────────────────
// Owner, 21 Oct 2026: "the unassigned delegates and the draggability don't work
// well anymore". The board used HTML5 drag and drop, which never works on touch,
// starts a text selection instead of a drag on a name, gives a browser-drawn
// ghost, and only scrolls the window when the pointer is pressed against its
// very edge (under a 56px fixed header). With twenty committees below the rail
// the organiser could not reach the bottom of the board while holding a card.
//
// This is one pointer-events controller instead:
//   • mouse and pen drag from anywhere on a source (not from its buttons or
//     inputs); touch drags only from an element marked `data-drag-grip`, so a
//     finger on the card still scrolls the page;
//   • the ghost is our own pill, portalled, moved by a direct style write;
//   • drop targets are plain elements with `data-drop="<target>"`, found by
//     elementFromPoint, so they work wherever they are on the page;
//   • the window AND whatever scroll box is under the pointer scroll when the
//     pointer nears their edges, every frame, faster the closer it gets;
//   • Escape or a cancelled pointer ends the drag with nothing dropped, and
//     the click that follows a real drag is swallowed so a card is never
//     "selected" by being dropped.
// React state changes only when the drag starts, ends, or the target under the
// pointer changes. Click a card, then click a committee stays the keyboard and
// no-drag way to do the same thing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';

export type BoardDragPayload =
  | { kind: 'app'; id: string }
  | { kind: 'society'; id: string }
  | { kind: 'alloc'; id: string; committeeId: string; slotKey: string };

/** Parsed `data-drop` value. */
export type BoardDropTarget =
  | { kind: 'committee'; committeeId: string }
  | { kind: 'slot'; committeeId: string; slotId: string; seat: number }
  | { kind: 'rail' };

export function dropAttr(t: BoardDropTarget): string {
  if (t.kind === 'committee') return `committee:${t.committeeId}`;
  if (t.kind === 'slot') return `slot:${t.committeeId}:${t.slotId}:${t.seat}`;
  return 'rail';
}

function parseDrop(raw: string | null | undefined): BoardDropTarget | null {
  if (!raw) return null;
  if (raw === 'rail') return { kind: 'rail' };
  const parts = raw.split(':');
  if (parts[0] === 'committee' && parts[1]) return { kind: 'committee', committeeId: parts[1] };
  if (parts[0] === 'slot' && parts.length === 4) {
    const seat = Number(parts[3]);
    if (parts[1] && parts[2] && Number.isFinite(seat)) return { kind: 'slot', committeeId: parts[1], slotId: parts[2], seat };
  }
  return null;
}

const MOUSE_THRESHOLD = 6;
const TOUCH_THRESHOLD = 4;
/** Distance from an edge where auto-scroll starts, and its top speed (px a frame). */
const EDGE = 64;
const MAX_SPEED = 22;
/** The manage layout's fixed header: the window's usable top edge sits under it. */
const HEADER_PX = 56;

interface Pending {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  payload: BoardDragPayload;
  label: string;
}

export interface BoardDragState {
  payload: BoardDragPayload;
  label: string;
  /** The `data-drop` string under the pointer, when it accepts this payload. */
  over: string | null;
}

export function useBoardDrag({
  canDrop, onDrop,
}: {
  canDrop: (payload: BoardDragPayload, target: BoardDropTarget) => boolean;
  onDrop: (payload: BoardDragPayload, target: BoardDropTarget) => void;
}) {
  const [drag, setDrag] = useState<BoardDragState | null>(null);
  const pending = useRef<Pending | null>(null);
  const started = useRef(false);
  const overRef = useRef<string | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  // Latest callbacks, so the window listeners never hold stale closures.
  const canDropRef = useRef(canDrop);
  const onDropRef = useRef(onDrop);
  useEffect(() => { canDropRef.current = canDrop; onDropRef.current = onDrop; });

  const placeGhost = useCallback(() => {
    const g = ghostRef.current;
    if (g) g.style.transform = `translate3d(${pos.current.x + 14}px, ${pos.current.y + 12}px, 0)`;
  }, []);

  const hitTest = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    const el = document.elementFromPoint(pos.current.x, pos.current.y) as HTMLElement | null;
    const host = el?.closest<HTMLElement>('[data-drop]') ?? null;
    const raw = host?.dataset.drop ?? null;
    const target = parseDrop(raw);
    const accepted = target && canDropRef.current(p.payload, target) ? raw : null;
    if (accepted !== overRef.current) {
      overRef.current = accepted;
      setDrag(d => (d ? { ...d, over: accepted } : d));
    }
  }, []);

  // The scroll loop re-arms itself through this ref (a callback cannot name itself).
  const autoScrollRef = useRef<() => void>(() => {});
  /** One frame of edge scrolling: the scroll box under the pointer first, then the window. */
  const autoScroll = useCallback(() => {
    raf.current = null;
    if (!started.current) return;
    const { x, y } = pos.current;
    const speed = (dist: number) => Math.ceil(MAX_SPEED * Math.min(1, (EDGE - dist) / EDGE));
    let moved = false;

    let box = (document.elementFromPoint(x, y) as HTMLElement | null);
    while (box && box !== document.body && box !== document.documentElement) {
      const cs = getComputedStyle(box);
      if (/(auto|scroll)/.test(cs.overflowY) && box.scrollHeight > box.clientHeight + 1) {
        const r = box.getBoundingClientRect();
        const edge = Math.min(EDGE, r.height / 4);
        if (y < r.top + edge && box.scrollTop > 0) {
          box.scrollTop -= speed(y - r.top);
          moved = true;
        } else if (y > r.bottom - edge && box.scrollTop + box.clientHeight < box.scrollHeight) {
          box.scrollTop += speed(r.bottom - y);
          moved = true;
        }
        if (moved) break;
      }
      box = box.parentElement;
    }

    if (!moved) {
      const top = HEADER_PX;
      const bottom = window.innerHeight;
      if (y < top + EDGE && window.scrollY > 0) {
        window.scrollBy(0, -speed(Math.max(0, y - top)));
        moved = true;
      } else if (y > bottom - EDGE && window.scrollY + window.innerHeight < document.documentElement.scrollHeight) {
        window.scrollBy(0, speed(bottom - y));
        moved = true;
      }
    }

    // Content moved under a still pointer: the target may have changed.
    if (moved) hitTest();
    raf.current = requestAnimationFrame(() => autoScrollRef.current());
  }, [hitTest]);
  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);

  const cleanup = useCallback(() => {
    pending.current = null;
    started.current = false;
    overRef.current = null;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('-webkit-user-select');
    document.body.style.removeProperty('cursor');
    setDrag(null);
  }, []);

  // Window listeners live for the whole drag, from pointerdown to its end.
  const listeners = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: () => void; key: (e: KeyboardEvent) => void } | null>(null);

  const detach = useCallback(() => {
    const l = listeners.current;
    if (!l) return;
    window.removeEventListener('pointermove', l.move);
    window.removeEventListener('pointerup', l.up);
    window.removeEventListener('pointercancel', l.cancel);
    window.removeEventListener('keydown', l.key, true);
    listeners.current = null;
  }, []);

  /** The click that follows a real drag lands on whatever was under the pointer:
   *  swallow exactly that one. */
  const swallowNextClick = useCallback(() => {
    const stop = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
  }, []);

  const begin = useCallback((e: React.PointerEvent, payload: BoardDragPayload, label: string) => {
    if (pending.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (e.pointerType === 'touch') {
      // A finger on the card scrolls; only the grip drags.
      if (!target.closest('[data-drag-grip]')) return;
    } else if (target.closest('button, input, textarea, select, [data-no-drag]') && !target.closest('[data-drag-grip]')) {
      return;
    }
    pending.current = { pointerId: e.pointerId, pointerType: e.pointerType, startX: e.clientX, startY: e.clientY, payload, label };
    pos.current = { x: e.clientX, y: e.clientY };

    const move = (ev: PointerEvent) => {
      const p = pending.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      pos.current = { x: ev.clientX, y: ev.clientY };
      if (!started.current) {
        const dist = Math.hypot(ev.clientX - p.startX, ev.clientY - p.startY);
        if (dist < (p.pointerType === 'touch' ? TOUCH_THRESHOLD : MOUSE_THRESHOLD)) return;
        started.current = true;
        window.getSelection()?.removeAllRanges();
        document.body.style.setProperty('user-select', 'none');
        document.body.style.setProperty('-webkit-user-select', 'none');
        document.body.style.setProperty('cursor', 'grabbing');
        setDrag({ payload: p.payload, label: p.label, over: null });
        if (raf.current == null) raf.current = requestAnimationFrame(() => autoScrollRef.current());
      }
      if (ev.cancelable) ev.preventDefault();
      placeGhost();
      hitTest();
    };
    const up = (ev: PointerEvent) => {
      const p = pending.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      detach();
      if (started.current) {
        pos.current = { x: ev.clientX, y: ev.clientY };
        hitTest();
        const target = parseDrop(overRef.current);
        swallowNextClick();
        cleanup();
        if (target) onDropRef.current(p.payload, target);
        return;
      }
      cleanup();
    };
    const cancel = () => { detach(); cleanup(); };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !started.current) return;
      ev.stopPropagation();
      ev.preventDefault();
      swallowNextClick();
      detach();
      cleanup();
    };
    listeners.current = { move, up, cancel, key };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
  }, [cleanup, detach, hitTest, placeGhost, swallowNextClick]);

  useEffect(() => () => { detach(); if (raf.current != null) cancelAnimationFrame(raf.current); }, [detach]);

  /** Spread on a drag source. */
  const sourceProps = useCallback((payload: BoardDragPayload, label: string) => ({
    onPointerDown: (e: React.PointerEvent) => begin(e, payload, label),
    // A native drag (an image, a link) would fight ours.
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  }), [begin]);

  const ghost = drag && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={el => { ghostRef.current = el; if (el) placeGhost(); }}
          aria-hidden
          style={{
            position: 'fixed', left: 0, top: 0, zIndex: 9999, pointerEvents: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px 8px 10px', borderRadius: 999, maxWidth: 280,
            backgroundColor: '#FFFFFF', color: '#1C1410',
            boxShadow: drag.over
              ? '0 0 0 2px #1B3828, 0 14px 32px rgba(27,56,40,0.28)'
              : '0 14px 32px rgba(27,56,40,0.24)',
            fontFamily: 'var(--font-brand), sans-serif', fontSize: 13, fontWeight: 700,
            willChange: 'transform',
          }}
        >
          <GripVertical size={14} strokeWidth={1.5} style={{ flexShrink: 0, color: '#1B3828' }} />
          <span style={{ overflowWrap: 'anywhere', lineHeight: 1.2 }}>{drag.label}</span>
        </div>,
        document.body,
      )
    : null;

  return { drag, sourceProps, ghost };
}

/** The touch handle on a drag source. Mouse and pen drag the whole card; a
 *  finger drags from here only, so the rail still scrolls under a thumb. */
export function DragGrip({ label, size = 14 }: { label: string; size?: number }) {
  return (
    <span
      data-drag-grip=""
      aria-hidden
      title={`Drag ${label}`}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: 28, height: 36, marginLeft: -6, touchAction: 'none', cursor: 'grab', color: '#6B5E4E' }}
    >
      <GripVertical size={size} strokeWidth={1.5} />
    </span>
  );
}
