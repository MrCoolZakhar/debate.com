'use client';

// ── Organiser dashboard: the one-screen grid ────────────────────────────────
//
// Owner, 21 Sep 2026: "On my laptop screen currently, there is lots of empty
// space and the page is scrollable." The dashboard now FITS the window from
// 1024 px wide and 600 px tall (every laptop: 1280x800, 1440x900, 1536x864 and
// their real, chrome-reduced viewports): the grid takes exactly the height
// under the 56 px top bar and every card spends the height it is given. Only
// the insides of the priorities list, the activity feed and the chart table
// ever scroll. Below that size (tablets, phones, a tiny window) it is an
// ordinary scrolling stack. The rule is written down in
// docs/ui-audit/00-DESIGN-RULEBOOK.md (§9) and CLAUDE.md §8.
//
//   ┌──────────────┬──────────────────────┬──────────────┐
//   │ priorities   │ invites dial         │ traffic      │  row 1: natural height
//   │ (shrinks,    ├──────────────────────┴──────────────┤
//   │  scrolls)    │ participants over time (fills)       │  row 2: the rest
//   ├──────────────┤                                      │
//   │ activity     │                                      │
//   │ (fills)      │                                      │
//   └──────────────┴──────────────────────────────────────┘

import { useEffect, useState } from 'react';
import Link from 'next/link';

/** Scoped CSS for the grid. Plain CSS because the fit mode is a width AND a
 *  height media query, which reads far better here than as Tailwind variants. */
export const DASH_CSS = `
/* Inter weights to match the owner's sample (26 Sep 2026, dashboard only, for
   comparison): every weight one step lighter, so 900 numbers read 800, 800
   titles 700, 700 labels 600, 600 text 500. Remove this block to go back. */
.gv-dash [style*="font-weight: 900"], .gv-dash .font-black { font-weight: 800 !important; }
.gv-dash [style*="font-weight: 800"], .gv-dash .font-extrabold { font-weight: 700 !important; }
.gv-dash [style*="font-weight: 700"], .gv-dash .font-bold { font-weight: 600 !important; }
.gv-dash [style*="font-weight: 600"], .gv-dash .font-semibold { font-weight: 500 !important; }
.gv-dash { display: flex; flex-direction: column; min-height: calc(100vh - 56px); padding: 14px 20px 20px; }
.gv-dash-grid { display: flex; flex-direction: column; gap: 14px; }
.gv-dash-col1 { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.gv-dash-cell { min-width: 0; }
.gv-dash-chart { height: 420px; }
.gv-dash-activity { display: flex; flex-direction: column; min-height: 300px; }
@media (min-width: 1024px) and (min-height: 600px) {
  .gv-dash { height: calc(100dvh - 56px); min-height: 0; padding: 12px 20px 16px; }
  .gv-dash-grid {
    flex: 1; min-height: 0; display: grid;
    grid-template-columns: clamp(280px, 30%, 400px) minmax(0, 1fr) minmax(240px, 27%);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .gv-dash-col1 { grid-column: 1; grid-row: 1 / 3; min-height: 0; }
  .gv-dash-prio { flex: 0 1 auto; min-height: 0; max-height: 62%; }
  .gv-dash-prio-rows { flex: 1 1 auto; min-height: 0; overflow-y: auto; scrollbar-width: thin; margin: 0 -6px; padding: 2px 6px 4px; }
  .gv-dash-activity { flex: 1 1 0; min-height: 170px; display: flex; flex-direction: column; }
  .gv-dash-dial { grid-column: 2; grid-row: 1; }
  .gv-dash-traffic { grid-column: 3; grid-row: 1; }
  .gv-dash-chart { grid-column: 2 / 4; grid-row: 2; height: auto; min-height: 0; }
}
`;

/**
 * The dial's diameter: whatever the card's width leaves beside the 196 px key
 * (roles read "applied · N accepted", so it is wider than the old 150),
 * never more than 200 and never so tall that the chart row starves on a short
 * window. Measured, not guessed, because the middle column is a fraction.
 */
export function useDialSize(): [(el: HTMLElement | null) => void, number] {
  // A callback ref held in state: the card mounts after the loading skeleton,
  // so an object ref read once on mount would never see it.
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState(176);
  useEffect(() => {
    if (!el) return;
    const read = () => {
      const byWidth = el.clientWidth - 22 - 196 - 10;
      const byHeight = window.innerHeight * 0.25;
      const next = Math.round(Math.max(120, Math.min(200, byWidth, byHeight)));
      setSize(prev => (prev === next ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => { ro.disconnect(); window.removeEventListener('resize', read); };
  }, [el]);
  return [setEl, size];
}

/**
 * Accepted delegates still without a committee and country, as a red circle
 * with the number (owner, 21 Sep 2026: "put the delegate numbers that still
 * need to be assigned in a red circle on top to save space"). Links to the
 * assignment board. Nothing at all at zero.
 */
export function UnallocatedBadge({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null;
  const words = `${count} accepted ${count === 1 ? 'delegate needs' : 'delegates need'} a committee and country. Open the assignment board.`;
  return (
    <Link
      href={href}
      title={words}
      aria-label={words}
      className="inline-flex items-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B2020] rounded-full transition-transform hover:scale-[1.04] active:scale-[0.97]"
      style={{ gap: 6, textDecoration: 'none' }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          minWidth: 28, height: 28, padding: '0 7px', borderRadius: 999,
          background: 'linear-gradient(135deg, #C0392B 0%, #9E2A1F 100%)', color: '#FFFFFF',
          fontFamily: "var(--font-brand), sans-serif", fontSize: 13.5, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
          boxShadow: '0 2px 6px -1px rgba(158,42,31,0.35), inset 0 0 0 1px rgba(110,26,18,0.35)',
        }}
      >
        {count > 999 ? '999+' : count}
      </span>
      <span aria-hidden style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: 11, fontWeight: 800, color: '#9E2A1F', whiteSpace: 'nowrap' }}>
        to assign
      </span>
    </Link>
  );
}
