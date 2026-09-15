'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FloorBarExtent: publishes the height of the floor's bottom add bar (time presets +
// "Add to speakers list...") as the CSS variable `--floor-bar-h` on the chair console root
// (`[data-chair-root]`), 15 Sep 2026.
//
// The collapsed sidebar column (SidebarFlagRail) reads it twice: it paints the bar's
// ground under itself, so with the sidebar folded the bar runs the full width of the page,
// and it stops its flags above the bar, so a flag never sits over the bar's controls.
// Nothing in the floor column changes its layout for this, so ChairSidebarShell's FLIP
// (which measures the floor column) still reflows exactly once.
//
// A ResizeObserver writes the variable only when the height changes, straight onto the
// DOM: no React state, nothing per second, never the committee object (RULES 3/4).
// Unmounting (another phase, the session ended, a Commenter) clears it back to 0.
// ─────────────────────────────────────────────────────────────────────────────

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export default function FloorBarExtent({ className, style, children, active = true }: {
  /** Publish the height. Off where the bar is not the last thing on the floor (a Commenter's
   *  comment dock sits under the caucus bar), so the column never paints a misaligned strip. */
  active?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const el = ref.current;
    const root = el?.closest<HTMLElement>('[data-chair-root]');
    if (!el || !root) return;
    let last = -1;
    const publish = () => {
      const h = el.offsetHeight;
      if (h === last) return;
      last = h;
      root.style.setProperty('--floor-bar-h', `${h}px`);
    };
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--floor-bar-h');
    };
  }, [active]);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
