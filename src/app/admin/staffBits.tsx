'use client';

// Small pieces shared by the two halves of the staff Users section (UsersTab
// and PendingTab). They exist here rather than in either tab so the second one
// never becomes a copy of the first: the chip, the two date formatters and the
// tabular-numbers style were already duplicated three times across the admin
// console before this file.
//
// Everything reads from the neu token set (src/components/neu.tsx) — no local
// palette constants, so a themed surface repaints these with everything else.

import { NEU, OUTFIT } from '@/components/neu';

export const MONO = 'ui-monospace, monospace';
export const RED = '#8B2020';

/** Columns of numbers only line up when the digits are the same width. */
export const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export const int = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-GB');

export function fmtDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 'never';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** Label pill. Tint plus a word, never hue on its own — the same rule the Data
 *  tab's attention rows follow, so a chip still reads in greyscale. */
export function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: fg, backgroundColor: bg, padding: '3px 7px', borderRadius: 999,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {text}
    </span>
  );
}

/** Section eyebrow, the small uppercase label above a block. */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: NEU.inkSoft, ...style,
      }}
    >
      {children}
    </p>
  );
}
