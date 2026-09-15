// ── Positioning helper ──────────────────────────────────────────────────────
// Portal renders into `#fit-root` when FitToScreen is mounted. That element is
// `transform: scale(...)`, which makes it the containing block for `position:
// fixed` children — so raw getBoundingClientRect() screen pixels would be off by
// the scale factor. Convert the trigger box (and the usable bounds) into the
// same space the portalled fixed layer lives in.
export function anchorBox(el: HTMLElement) {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  const r = el.getBoundingClientRect();
  if (!root) {
    return {
      top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      viewW: window.innerWidth, viewH: window.innerHeight,
    };
  }
  const rr = root.getBoundingClientRect();
  const scale = root.offsetWidth > 0 && rr.width > 0 ? rr.width / root.offsetWidth : 1;
  const s = scale || 1;
  return {
    top: (r.top - rr.top) / s,
    bottom: (r.bottom - rr.top) / s,
    left: (r.left - rr.left) / s,
    right: (r.right - rr.left) / s,
    viewW: root.offsetWidth,
    viewH: root.offsetHeight,
  };
}

/** Clamp a floating layer into view, flipping above the trigger when it would
 *  overflow the bottom edge. */
export function place(box: ReturnType<typeof anchorBox>, w: number, h: number, align: 'start' | 'end') {
  const M = 8;
  const rawLeft = align === 'end' ? box.right - w : box.left;
  const left = Math.min(Math.max(M, rawLeft), Math.max(M, box.viewW - w - M));
  const below = box.bottom + 8;
  const flip = below + h > box.viewH - M && box.top - 8 - h > M;
  return { left, top: flip ? box.top - 8 - h : below };
}
