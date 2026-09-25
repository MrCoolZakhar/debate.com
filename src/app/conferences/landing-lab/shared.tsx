'use client';

import { delegatePriceLabel, TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';
import { formatConferenceDates } from '@/lib/conferenceDates';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives for the "Stagefront" landing composition.
//
// THIS IS PRODUCTION CODE. The `/conferences/landing-lab` design-lab route and
// its two unshipped variants (V2 "The Record", V3 "First Gavel") were deleted;
// V1 "Stagefront" had already been promoted to the real homepage. This file and
// VariantStagefront.tsx are imported by ../StagefrontClient.tsx, which renders
// `/`. Editing either one edits the production landing page.
// Original design rationale: docs/design/landing-research.md §4.
// ─────────────────────────────────────────────────────────────────────────────

export const INK = '#1C1410';
export const FOREST = '#1B3828';
export const IVORY = '#EDE7D8';
export const CREAM = '#FAF8F3';
export const GOLD = '#B6871F';
export const PALE_GOLD = '#EED98A';
export const TAUPE = '#9A8A78';
export const HAIRLINE = '#DDD4C0';

// Monospace is eliminated on the conferences side (docs/ui-audit/70-typography-rule.md):
// MONO now resolves to Outfit so nothing renders in a code face. Kept as an export
// so the lab variants that import it inherit the change automatically.
export const SANS = "var(--font-brand), sans-serif";
export const MONO = SANS;

export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Data types ───────────────────────────────────────────────────────────────

export interface LabConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  /** The public delegate price (publicFees.displayDelegatePrice); TBD when absent. */
  delegate_price?: DelegatePrice;
  expected_delegates: number;
  logo_url: string | null;
  banner_url: string | null;
  is_verified?: boolean;
  dates_tbd?: boolean;
  format?: string;
  /** Delegate application window (listedConferences.ts), for the near-you row. */
  window?: 'open' | 'not_open' | 'closed' | 'disabled';
}

export interface LabReview {
  conference_id: string;
  rating: number;
  review_text: string;
  display_name: string;
}

export interface RatingSummary {
  avg: number;
  count: number;
}

/** Per-conference average rating from the public conference_reviews rows. */
export function ratingMap(reviews: LabReview[]): Record<string, RatingSummary> {
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const r of reviews) {
    const slot = (acc[r.conference_id] ??= { sum: 0, count: 0 });
    slot.sum += r.rating;
    slot.count += 1;
  }
  const out: Record<string, RatingSummary> = {};
  for (const [id, { sum, count }] of Object.entries(acc)) {
    out[id] = { avg: Math.round((sum / count) * 10) / 10, count };
  }
  return out;
}

// ── Date / fee helpers ───────────────────────────────────────────────────────

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** "30 Aug 2026" · "12–14 Jun 2026" · "30 Jun – 2 Jul 2026". */
export function formatDateRange(start: string, end: string): string {
  return formatConferenceDates(start, end, { style: 'dmy-end-year' });
}

/** "12–14 JUN", compact ledger form. Collapses a one-day run to "12 JUN". */
export function compactRange(start: string, end: string): string {
  return formatConferenceDates(start, end, { style: 'dm-upper' });
}

/** "February 2027", month bucket label for season grouping. */
export function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function isConcluded(c: LabConference): boolean {
  return daysUntil(c.end_date) < 0;
}

export function feeLabel(c: LabConference): string {
  return delegatePriceLabel(c.delegate_price ?? TBD_PRICE);
}

/** "In 231 days" / "Happening now" / "Concluded", honest urgency (RA/Meetup register). */
export function timingLabel(c: LabConference): string {
  const start = daysUntil(c.start_date);
  const end = daysUntil(c.end_date);
  if (end < 0) return 'Concluded';
  if (start <= 0) return 'Happening now';
  if (start === 1) return 'Starts tomorrow';
  return `In ${start} days`;
}

/** The headliner: first upcoming conference that has real imagery, else first upcoming. */
export function pickHeadliner(conferences: LabConference[]): LabConference | null {
  const upcoming = conferences.filter(c => !isConcluded(c));
  return upcoming.find(c => c.banner_url) ?? upcoming[0] ?? conferences.find(c => c.banner_url) ?? conferences[0] ?? null;
}

export function circuitStats(conferences: LabConference[]) {
  const seats = conferences.reduce((s, c) => s + (c.expected_delegates || 0), 0);
  const countries = new Set(conferences.map(c => c.country)).size;
  return { listed: conferences.length, seats, countries };
}

// ── Star row (used by V1 headliner + V3 proof caption) ───────────────────────

export function Stars({ avg, size = 13, color = GOLD }: { avg: number; size?: number; color?: string }) {
  const filled = Math.round(avg);
  return (
    <span aria-label={`${avg} out of 5 stars`} style={{ letterSpacing: '0.1em', fontSize: `${size}px`, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= filled ? color : 'rgba(154,138,120,0.4)' }}>★</span>
      ))}
    </span>
  );
}

// The grain footer (LabFooter) that lived here is gone: there is ONE site
// footer, src/components/SiteFooter.tsx.
