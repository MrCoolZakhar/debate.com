'use client';

// Dragging a seat onto another person's row in the People table. Pointer
// events only (never HTML5 draggable): a mouse or pen drags the seat block
// itself past a small threshold, a finger drags from the grip only (the block
// keeps scrolling the page). The lifted seat follows the pointer through a
// direct style.transform on a Portal ghost; React state changes only when the
// drag starts, when the row under the pointer changes and when it ends. A row
// is a target when it carries data-seat-target and canDropOn says yes. Escape
// cancels. A drag never ends in a click (wasJustDragged).

import { useCallback, useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { FONT, INK, LIFT_SHADOW } from '../leaderKit';

export interface DragGhost { code: string | null; logoUrl: string | null; label: string; committee: string }

interface Live {
  from: string;
  ghost: DragGhost;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  over: string | null;
  overEl: HTMLElement | null;
}

const THRESHOLD = 6;

export function useSeatDrag({ canDragFrom, canDropOn, onDrop }: {
  canDragFrom: (id: string) => boolean;
  canDropOn: (from: string, to: string) => boolean;
  onDrop: (from: string, to: string, target: HTMLElement) => void;
}) {
  const [drag, setDrag] = useState<{ from: string; over: string | null; ghost: DragGhost } | null>(null);
  const live = useRef<Live | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const lastDragEnd = useRef(0);
  const detach = useRef<(() => void) | null>(null);
  // The callers' latest rules, read at event time.
  const rules = useRef({ canDragFrom, canDropOn, onDrop });
  useEffect(() => { rules.current = { canDragFrom, canDropOn, onDrop }; }, [canDragFrom, canDropOn, onDrop]);
  useEffect(() => () => { detach.current?.(); }, []);

  const moveGhost = useCallback(() => {
    const g = ghostRef.current;
    const l = live.current;
    if (!g || !l) return;
    g.style.transform = `translate(${l.x + 14}px, ${l.y + 10}px)`;
  }, []);

  const setGhostNode = useCallback((node: HTMLDivElement | null) => {
    ghostRef.current = node;
    moveGhost();
  }, [moveGhost]);

  const start = useCallback((e: React.PointerEvent, id: string, ghost: DragGhost, fromGrip: boolean) => {
    if (e.button !== 0 || live.current) return;
    if (e.pointerType === 'touch' && !fromGrip) return;
    if (!fromGrip && (e.target as HTMLElement).closest('button, a, input, label')) return;
    if (!rules.current.canDragFrom(id)) return;
    if (fromGrip) e.preventDefault();
    live.current = { from: id, ghost, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, over: null, overEl: null };

    const end = (drop: boolean) => {
      const l = live.current;
      detach.current?.();
      detach.current = null;
      live.current = null;
      if (!l?.active) return;
      lastDragEnd.current = Date.now();
      document.body.style.userSelect = '';
      setDrag(null);
      if (drop && l.over && l.overEl) rules.current.onDrop(l.from, l.over, l.overEl);
    };
    const onMove = (ev: PointerEvent) => {
      const l = live.current;
      if (!l || ev.pointerId !== l.pointerId) return;
      l.x = ev.clientX;
      l.y = ev.clientY;
      if (!l.active) {
        if (Math.hypot(l.x - l.startX, l.y - l.startY) < THRESHOLD) return;
        l.active = true;
        document.body.style.userSelect = 'none';
        setDrag({ from: l.from, over: null, ghost: l.ghost });
      }
      ev.preventDefault();
      moveGhost();
      const el = (document.elementFromPoint(l.x, l.y) as HTMLElement | null)?.closest<HTMLElement>('[data-seat-target]') ?? null;
      const to = el?.getAttribute('data-seat-target') ?? null;
      const ok = !!to && to !== l.from && rules.current.canDropOn(l.from, to);
      const over = ok ? to : null;
      if (over !== l.over) {
        l.over = over;
        l.overEl = ok ? el : null;
        setDrag(d => (d ? { ...d, over } : d));
      }
    };
    const onUp = (ev: PointerEvent) => { if (live.current && ev.pointerId === live.current.pointerId) end(true); };
    const onCancel = () => end(false);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(false); };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    detach.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
    };
  }, [moveGhost]);

  /** True for a moment after a drag ended, so the release is never a click. */
  const wasJustDragged = useCallback(() => Date.now() - lastDragEnd.current < 300, []);

  const ghost = drag ? (
    <Portal>
      <div
        ref={setGhostNode}
        aria-hidden
        className="flex items-center gap-2"
        style={{
          position: 'fixed', top: 0, left: 0, zIndex: 90, pointerEvents: 'none', transform: 'translate(-9999px, -9999px)',
          padding: '8px 12px 8px 8px', borderRadius: 999, background: '#FFFFFF', boxShadow: LIFT_SHADOW,
          fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap',
        }}
      >
        <CircleFlag code={drag.ghost.code} logoUrl={drag.ghost.logoUrl} label={drag.ghost.label} size={32} decorative />
        {drag.ghost.label} · {drag.ghost.committee}
      </div>
    </Portal>
  ) : null;

  return { drag, start, ghost, wasJustDragged };
}
