// Site tokens for the Faculty Advisor board (CLAUDE.md §8).
export const C = {
  ivory: '#EDE7D8',
  cream: '#FAF8F3',
  surface: '#F0EBDD',
  forest: '#1B3828',
  forestSoft: '#2A5A3C',
  gold: '#EED98A',
  deepGold: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#4A4238',
  hairline: 'rgba(27,56,40,0.10)',
  danger: '#8B2020',
  dangerTint: 'rgba(139,32,32,0.08)',
} as const;

export const FONT = 'var(--font-brand), sans-serif';

export const SHADOW = {
  card: '0 1px 2px rgba(27,56,40,0.06), 0 6px 18px rgba(27,56,40,0.07)',
  lift: '0 2px 4px rgba(27,56,40,0.08), 0 14px 34px rgba(27,56,40,0.16)',
} as const;

/** m:ss for a countdown. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A spoken duration, "1:30" under an hour, "1 h 05" above. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return clock(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** One decimal, dropped when whole: 2, 1.5. */
export function avg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
