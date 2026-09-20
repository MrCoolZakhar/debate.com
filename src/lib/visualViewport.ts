'use client';

// ── Where a fixed-position floating layer may actually be drawn ──────────────
//
// House rule for every portaled menu, typeahead, hint or tooltip: clamp against
// THIS, never against `window.innerWidth` / `window.innerHeight`.
//
// On iOS the window box does not shrink when the software keyboard comes up, so
// a typeahead opened from a focused field was being placed in a band the
// keyboard was covering: the user typed and the matches were underneath it,
// invisible and untappable. `visualViewport` is the part of the page the user
// can actually see, and its `offsetTop` / `offsetLeft` express that band in the
// layout-viewport coordinates that `position: fixed` and
// `getBoundingClientRect()` both use, so the two can be compared directly.
//
// Falls back to the window box wherever `visualViewport` is missing, so nothing
// changes on a browser without it.

import { useEffect } from 'react';

export interface ViewBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  width: number;
}

export function viewBox(): ViewBox {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return {
      top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth,
      height: window.innerHeight, width: window.innerWidth,
    };
  }
  const top = vv.offsetTop;
  const left = vv.offsetLeft;
  return { top, bottom: top + vv.height, left, right: left + vv.width, height: vv.height, width: vv.width };
}

/**
 * Re-run `place` on everything that can move a fixed layer off the visible
 * band: a window resize or scroll (capture, so an inner scroller counts), and
 * the visual viewport's own resize and scroll, which is what fires when the
 * keyboard opens, closes, or the page is nudged to keep a focused field in
 * view.
 *
 * `place` must be stable (a `useCallback`), or the listeners rebind every
 * render.
 */
export function useReposition(active: boolean, place: () => void) {
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [active, place]);
}
