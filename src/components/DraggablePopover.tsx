'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DraggablePopover: a floating panel the chair can move by its handle (the Right of Reply
// and Add time popovers on the floor).
//
// - Rendered through Portal at fixed coordinates, so no ancestor can clip it (UI RULES).
// - The Portal target is FitToScreen's `#fit-root`, which is scaled with a CSS transform.
//   A fixed element inside a transformed ancestor is positioned in that ancestor's LOCAL
//   (unscaled) space, so pointer deltas are divided by the live scale and the bounds are
//   the fit-root's own size, not the window's.
// - Pointer events (mouse, pen, finger) on the handle; Arrow keys on the focused handle
//   move it 16px (Shift: 64px).
// - The position is remembered per popover id for this browser tab (sessionStorage), so
//   reopening it puts it back where the chair left it. Wrapped in try/catch: storage can be
//   blocked, and the popover then simply opens in its default place.
// - Always clamped inside the viewport, on open, on drag and on resize.
//
// Purely presentational: it never touches committee state (RULES 3 to 5).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import Portal from '@/components/Portal';

type Pos = { x: number; y: number };
const MARGIN = 8;
const storageKey = (id: string) => `gavelling-popover-pos:${id}`;

function readPos(id: string): Pos | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return Number.isFinite(p?.x) && Number.isFinite(p?.y) ? { x: p.x, y: p.y } : null;
  } catch { return null; }
}
function writePos(id: string, p: Pos) {
  try { sessionStorage.setItem(storageKey(id), JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) })); } catch { /* storage blocked */ }
}

/** The local coordinate space the fixed panel lives in, and its scale on screen. */
function space() {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  if (root && root.offsetWidth > 0) {
    const r = root.getBoundingClientRect();
    return { w: root.offsetWidth, h: root.offsetHeight, scale: r.width / root.offsetWidth || 1 };
  }
  return { w: window.innerWidth, h: window.innerHeight, scale: 1 };
}

export default function DraggablePopover({
  id,
  title,
  handleLabel,
  onClose,
  closeLabel,
  accent,
  className = '',
  children,
}: {
  /** Stable id; the remembered position is keyed on it. */
  id: string;
  /** Rendered inside the handle bar. */
  title: ReactNode;
  /** Accessible name of the handle ("Drag to move"). */
  handleLabel: string;
  onClose: () => void;
  closeLabel: string;
  /** Hairline colour of the panel edge. */
  accent: string;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const drag = useRef<{ pointerId: number; sx: number; sy: number; ox: number; oy: number; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((p: Pos): Pos => {
    const el = panelRef.current;
    const { w, h } = space();
    const pw = el?.offsetWidth ?? 0;
    const ph = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, w - pw - MARGIN)),
      y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, h - ph - MARGIN)),
    };
  }, []);

  const apply = useCallback((p: Pos, persist: boolean) => {
    const c = clamp(p);
    posRef.current = c;
    setPos(c);
    if (persist) writePos(id, c);
  }, [clamp, id]);

  // Portal mounts its children one effect later than this component, so placement happens
  // when the panel node itself attaches (a callback ref), not in an effect of ours.
  // First placement: the remembered spot, else 2rem from the inline-end edge, centred. The
  // panel is invisible until placed, so it never paints at 0,0 first.
  const attachPanel = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    panelRef.current = el;
    if (!el) return;
    const { w, h } = space();
    const rtl = document.documentElement.dir === 'rtl';
    apply(readPos(id) ?? { x: rtl ? 32 : w - el.offsetWidth - 32, y: (h - el.offsetHeight) / 2 }, false);
    // Keep it on screen when its own content grows (the RTR setup view becomes the timer).
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver(() => { if (posRef.current) apply(posRef.current, false); });
      roRef.current.observe(el);
    }
  }, [apply, id]);

  // Keep it on screen when the window (and so the fit-root) changes size.
  useEffect(() => {
    const onResize = () => { if (posRef.current) apply(posRef.current, false); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); roRef.current?.disconnect(); };
  }, [apply]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !posRef.current) return;
    if ((e.target as HTMLElement).closest('[data-popover-close]')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
    drag.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, scale: space().scale };
    setDragging(true);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    apply({ x: d.ox + (e.clientX - d.sx) / d.scale, y: d.oy + (e.clientY - d.sy) / d.scale }, false);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = null;
    setDragging(false);
    if (posRef.current) writePos(id, posRef.current);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!posRef.current) return;
    const step = e.shiftKey ? 64 : 16;
    const delta: Record<string, Pos> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    const m = delta[e.key];
    if (!m) return;
    e.preventDefault();
    apply({ x: posRef.current.x + m.x, y: posRef.current.y + m.y }, true);
  };

  return (
    <Portal>
      <div
        ref={attachPanel}
        className={`fixed z-50 rounded-2xl bg-[#EDE7D8] ${className}`}
        style={{
          left: pos?.x ?? 0,
          top: pos?.y ?? 0,
          visibility: pos ? 'visible' : 'hidden',
          boxShadow: dragging
            ? `0 0 0 1px ${accent}, 0 4px 10px rgba(27,56,40,0.14), 0 22px 48px rgba(27,56,40,0.30)`
            : `0 0 0 1px ${accent}, 0 2px 6px rgba(27,56,40,0.10), 0 14px 34px rgba(27,56,40,0.22)`,
          transition: 'box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div className="flex items-center gap-1 ps-1 pe-1.5 pt-1.5">
          <div
            role="button"
            tabIndex={0}
            aria-label={handleLabel}
            title={handleLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className={`flex-1 min-w-0 flex items-center gap-2 h-9 px-2 rounded-lg select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] hover:bg-[#1B3828]/[0.05] transition-colors ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'none' }}
          >
            <GripHorizontal size={16} strokeWidth={2.4} aria-hidden className="shrink-0 text-[#6A5A4A]" />
            <span className="min-w-0 truncate">{title}</span>
          </div>
          <button
            type="button"
            data-popover-close
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#1C1410] hover:text-[#8B2020] hover:bg-[#8B2020]/[0.08] text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          >
            ✕
          </button>
        </div>
        <div className="px-3 pb-3 pt-1">{children}</div>
      </div>
    </Portal>
  );
}
