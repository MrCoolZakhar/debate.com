'use client';

import { useEffect, type RefObject } from 'react';

/**
 * The conference page's right rail is `position: sticky` from 768px. Its
 * class gives it a fixed `top` (12px, 84px from 1024px so it clears the
 * floating nav pill), which is only right while the rail FITS the window.
 * At 1280x800 the Overview rail (apply card plus price card, about 740px)
 * did not: stuck at 84px, its last 40px sat below the bottom edge and could
 * only be read once the whole page had been scrolled to its end (owner,
 * 12 Oct 2026: "some things scroll slightly weird").
 *
 * When the rail is taller than the room under the pill, this moves `top` up
 * by exactly the difference, so the rail scrolls with the page until its
 * bottom is 16px above the window's edge and sticks there: every part of it
 * is reachable and nothing is cut off. When it fits, the class's own top is
 * left alone. Written straight to the node (no state, nothing per scroll);
 * re-measured only when the rail or the window changes size.
 */
export function useFitSticky(ref: RefObject<HTMLElement | null>, mounted: boolean) {
  useEffect(() => {
    // `mounted`: the page early-returns a skeleton while loading, so the rail
    // (and the ref) only exist once that clears.
    const el = ref.current;
    if (!mounted || !el || typeof window === 'undefined') return;
    const md = window.matchMedia('(min-width: 768px)');
    const lg = window.matchMedia('(min-width: 1024px)');
    let last = '';
    const fit = () => {
      let next = '';
      if (md.matches) {
        const base = lg.matches ? 84 : 12;
        const room = window.innerHeight - base - 16;
        const h = el.offsetHeight;
        if (h > room) next = `${Math.round(window.innerHeight - h - 16)}px`;
      }
      if (next !== last) {
        el.style.top = next;
        last = next;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      el.style.top = '';
    };
  }, [ref, mounted]);
}
