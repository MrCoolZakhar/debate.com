'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps a short identifying label (an email address) on ONE line by shrinking
 * its font from `max` down to `min` px until it fits its box. Below `min` it
 * wraps anywhere instead, never an ellipsis (CLAUDE.md §8 rule 11).
 * Re-measured on resize only; writes the node's style directly, no React state.
 */
export function useFitOneLine<T extends HTMLElement>(text: string, max: number, min: number) {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.whiteSpace = 'nowrap';
      el.style.overflowWrap = 'normal';
      let size = max;
      el.style.fontSize = `${size}px`;
      while (size > min && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      if (el.scrollWidth > el.clientWidth + 0.5) {
        el.style.whiteSpace = 'normal';
        el.style.overflowWrap = 'anywhere';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [text, max, min]);
  return ref;
}
