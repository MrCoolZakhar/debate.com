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
// - Several may be open at once (Add time and Right of Reply, 15 Sep 2026). Each opens in
//   its own default slot (`slot`: two stacked spots on the inline-end edge), a panel that
//   would open on top of another open one (a remembered spot) is moved clear of it, and
//   the one last pressed comes to the front.
// - Default slots sit ABOVE the floor's button row (16 Sep 2026, owner): a panel opened from
//   Add time or Right of Reply must never land on the button that opened it. `BOTTOM_CLEAR`
//   is the height of the controls row plus the bottom add bar.
// - `avoid`: while a centred modal is open (Motions, Documents) the panel is nudged out of
//   that modal's column so it stays usable and never sits under it. The nudge is NOT
//   persisted and the panel returns to exactly where the chair left it when the modal
//   closes, which is what "remember their positions even in motions" means.
// - `tone`: the panel can paint itself (a deep header bar over a tinted body) instead of the
//   default ivory. AA contrast is the caller's to pick; the close button and grip inherit
//   the header foreground.
//
// Purely presentational: it never touches committee state (RULES 3 to 5).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import Portal from '@/components/Portal';

type Pos = { x: number; y: number };
const MARGIN = 8;
const GAP = 12;
/** Room kept free at the bottom of the floor: the speaker button row plus the add bar. */
const BOTTOM_CLEAR = 220;
/** The widest a centred floor modal gets (MotionsModal is max-w-5xl), plus a gutter. */
const MODAL_BAND = 1024 + 48;

export type PopoverTone = {
  /** Panel body. */ surface: string;
  /** Handle bar. */ headerBg: string;
  /** Text and icons on the handle bar. */ headerFg: string;
};
const storageKey = (id: string) => `gavelling-popover-pos:${id}`;
/** Open panels, so a new one can open clear of the others. */
const openPanels = new Map<string, HTMLDivElement>();
/** The pressed panel sits one layer above the other open ones (z 51 vs 50, never higher,
 *  so it can never climb over a modal). Set on the node, outside React's style prop. */
function raise(el: HTMLDivElement | null) {
  if (!el) return;
  for (const other of openPanels.values()) other.style.zIndex = other === el ? '51' : '50';
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function rectOf(el: HTMLDivElement): Rect | null {
  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);
  if (!Number.isFinite(x) || !Number.isFinite(y) || el.style.visibility === 'hidden') return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

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
  slot = 'center',
  tone,
  avoid = false,
  anchor,
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
  /** Default spot on the inline-end edge when nothing is remembered. `lower` sits just above
   *  the floor's button row, `upper` stacks above it; `center` is the old centred default. */
  slot?: 'center' | 'upper' | 'lower';
  /** Deep header over a tinted body. Omitted = the ivory default. */
  tone?: PopoverTone;
  /** A centred modal is open: step out of its column until it closes. Never persisted. */
  avoid?: boolean;
  /** `data-floor-anchor` value of the button that opens it: the default spot sits above it. */
  anchor?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  /** Where it is drawn right now (may be nudged clear of an open modal). */
  const posRef = useRef<Pos | null>(null);
  /** Where the chair put it. The nudge never touches this, so it always comes back. */
  const homeRef = useRef<Pos | null>(null);
  const drag = useRef<{ pointerId: number; sx: number; sy: number; ox: number; oy: number; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const bringToFront = () => raise(panelRef.current);

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

  /**
   * Out of the centred modal's column, to whichever side has room. When neither side has
   * room (1280px: the Motions dialog is 1000px wide), the panel DOCKS: it folds to its handle
   * bar and sits in the bottom inline-end corner under the dialog, stacked beside any other
   * docked panel. It never overlaps the dialog and never loses its place.
   */
  const [docked, setDocked] = useState(false);
  const avoidRef = useRef(avoid);
  useLayoutEffect(() => { avoidRef.current = avoid; }, [avoid]);
  const placeAvoiding = useCallback(() => {
    const el = panelRef.current;
    const home = homeRef.current;
    if (!el || !home) return;
    const { w, h } = space();
    const pw = el.offsetWidth;
    const band = Math.min(MODAL_BAND, w);
    const left = (w - band) / 2;
    const right = left + band;
    const clear = home.x + pw <= left || home.x >= right;
    const rtl = document.documentElement.dir === 'rtl';
    let target: Pos;
    let dock = false;
    if (clear) target = home;
    else if (w - right >= pw + MARGIN) target = { x: w - pw - MARGIN, y: home.y };
    else if (left >= pw + MARGIN) target = { x: MARGIN, y: home.y };
    else {
      dock = true;
      const headerH = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 44;
      // Stable slot per panel id among the open ones, so two docked panels sit side by side.
      const ids = Array.from(openPanels.keys()).sort();
      const i = Math.max(0, ids.indexOf(id));
      const fromEnd = MARGIN + i * (pw + GAP);
      target = { x: rtl ? fromEnd : w - pw - fromEnd, y: h - headerH - MARGIN };
    }
    setDocked(dock);
    const c = clamp(target);
    posRef.current = c;
    setPos(c);
  }, [clamp, id]);

  const apply = useCallback((p: Pos, persist: boolean) => {
    const c = clamp(p);
    homeRef.current = c;
    posRef.current = c;
    setPos(c);
    if (persist) writePos(id, c);
  }, [clamp, id]);

  /** Re-clamp after a resize without ever overwriting the chair's own position. */
  const refit = useCallback(() => {
    if (avoidRef.current) { placeAvoiding(); return; }
    if (homeRef.current) apply(homeRef.current, false);
  }, [apply, placeAvoiding]);

  // A centred modal opened or closed: step aside (or dock), or step back. `homeRef` is
  // untouched, so the remembered position survives the modal exactly as it was.
  useEffect(() => {
    if (!homeRef.current) return;
    // Placement is measured from the DOM (panel size, the modal band), so it has to run after
    // commit; it settles in one extra render and only when `avoid` flips.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (avoid) { placeAvoiding(); return; }
    setDocked(false);
    posRef.current = homeRef.current;
    setPos(homeRef.current);
  }, [avoid, placeAvoiding]);

  // Portal mounts its children one effect later than this component, so placement happens
  // when the panel node itself attaches (a callback ref), not in an effect of ours.
  // First placement: the remembered spot, else 2rem from the inline-end edge, centred. The
  // panel is invisible until placed, so it never paints at 0,0 first.
  const attachPanel = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (panelRef.current && openPanels.get(id) === panelRef.current) openPanels.delete(id);
    panelRef.current = el;
    if (!el) return;
    const { w, h, scale } = space();
    const rtl = document.documentElement.dir === 'rtl';
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    // Above the floor's button row, never on top of the button that opened it (owner, 16 Sep
    // 2026). `lower` clears the row; `upper` stacks a second panel above `lower`.
    // With `anchor`, measure the opening button itself and sit GAP above its top edge: the
    // floor's height varies (strip, banners, a Commenter dock), so a fixed bottom offset
    // still landed on RTR at 1280x800. Screen pixels become fit-root pixels by the scale.
    // The TOPMOST floor anchor is used, not only this panel's own button: Add time opened
    // above its own button still covered Right of Reply, which sits one row higher.
    const anchorEls = anchor && document.querySelector(`[data-floor-anchor="${anchor}"]`)
      ? Array.from(document.querySelectorAll('[data-floor-anchor]')) : [];
    let anchorTop: number | null = null;
    if (anchorEls.length > 0) {
      const root = document.getElementById('fit-root');
      const originTop = root && root.offsetWidth > 0 ? root.getBoundingClientRect().top : 0;
      const top = Math.min(...anchorEls.map((e) => e.getBoundingClientRect().top));
      anchorTop = (top - originTop) / scale;
    }
    const lowerY = anchorTop !== null ? anchorTop - GAP - ph : h - BOTTOM_CLEAR - ph;
    const defaultY = anchorTop !== null ? lowerY
      : slot === 'lower' ? lowerY
      : slot === 'upper' ? lowerY - ph - GAP
      : (h - ph) / 2;
    const remembered = readPos(id);
    let p = remembered ?? { x: rtl ? 32 : w - pw - 32, y: defaultY };
    // Open clear of any panel already on screen. A default spot moves UP past it (moving
    // down would drop it back onto the buttons); a remembered one keeps the old rule.
    for (const [otherId, other] of openPanels) {
      if (otherId === id) continue;
      const r = rectOf(other);
      if (!r || !overlaps({ x: p.x, y: p.y, w: pw, h: ph }, r)) continue;
      const below = r.y + r.h + GAP;
      const above = Math.max(MARGIN, r.y - ph - GAP);
      p = { x: p.x, y: !remembered ? above : below + ph + MARGIN <= h ? below : above };
    }
    openPanels.set(id, el);
    raise(el);
    apply(p, false);
    if (avoidRef.current) placeAvoiding();
    // Keep it on screen when its own content grows (the RTR setup view becomes the timer).
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver(() => refit());
      roRef.current.observe(el);
    }
  }, [apply, id, slot, anchor, placeAvoiding, refit]);

  // Keep it on screen when the window (and so the fit-root) changes size.
  useEffect(() => {
    const onResize = () => refit();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      roRef.current?.disconnect();
      if (panelRef.current && openPanels.get(id) === panelRef.current) openPanels.delete(id);
    };
  }, [refit, id]);

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
        className={`fixed z-50 rounded-2xl overflow-hidden ${className}`}
        onPointerDownCapture={bringToFront}
        onFocusCapture={bringToFront}
        style={{
          left: pos?.x ?? 0,
          top: pos?.y ?? 0,
          backgroundColor: tone?.surface ?? '#EDE7D8',
          visibility: pos ? 'visible' : 'hidden',
          boxShadow: dragging
            ? `0 0 0 1px ${accent}, 0 4px 10px rgba(27,56,40,0.14), 0 22px 48px rgba(27,56,40,0.30)`
            : `0 0 0 1px ${accent}, 0 2px 6px rgba(27,56,40,0.10), 0 14px 34px rgba(27,56,40,0.22)`,
          transition: 'box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div
          className={`flex items-center gap-1 ${tone ? 'ps-1 pe-1 py-1' : 'ps-1 pe-1.5 pt-1.5'}`}
          style={tone ? { backgroundColor: tone.headerBg, color: tone.headerFg } : undefined}
        >
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
            className={`flex-1 min-w-0 flex items-center gap-2 h-9 px-2 rounded-lg select-none focus:outline-none focus-visible:ring-2 transition-colors ${
              tone ? 'hover:bg-white/10 focus-visible:ring-white/70' : 'hover:bg-[#1B3828]/[0.05] focus-visible:ring-[#1B3828]'
            } ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'none' }}
          >
            <GripHorizontal size={16} strokeWidth={2.4} aria-hidden className={`shrink-0 ${tone ? 'opacity-70' : 'text-[#6A5A4A]'}`} />
            <span className="min-w-0 truncate">{title}</span>
          </div>
          <button
            type="button"
            data-popover-close
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 ${
              tone ? 'hover:bg-white/15 focus-visible:ring-white/70' : 'text-[#1C1410] hover:text-[#8B2020] hover:bg-[#8B2020]/[0.08] focus-visible:ring-[#1B3828]'
            }`}
          >
            ✕
          </button>
        </div>
        <div hidden={docked} className={tone ? 'px-3 pb-3 pt-3' : 'px-3 pb-3 pt-1'}>{children}</div>
      </div>
    </Portal>
  );
}
