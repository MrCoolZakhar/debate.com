// Gavelling Crisis: small shared formatters.

import type { Directive } from './types';

/** The directive number people see: per cabinet (falls back to the crisis-wide number for old rows). */
export function dirNumber(d: Pick<Directive, 'no' | 'cabinet_no'>): number {
  return d.cabinet_no ?? d.no;
}

/**
 * Real-world time as a relative phrase ("just now", "12 min ago", "3 h ago", "2 days ago").
 * Never a calendar date: the crisis has its own in-world date, so a real date next to it confuses.
 */
export function timeAgo(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** 1190 -> "1,190" (resource amounts everywhere, including pickers). */
export function amount(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(n);
}
