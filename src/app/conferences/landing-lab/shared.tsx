'use client';

import Link from 'next/link';
import { formatFeeAmount } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Landing lab · shared primitives
//
// Three variants, three theses (see docs/design/landing-research.md §4):
//   V1 "Stagefront"  , Dice/RA poster-first browse          (delegates)
//   V2 "The Record"  , Eventbrite search × Stripe precision (delegates/advisors)
//   V3 "First Gavel" , Luma supply-side minimalism          (organisers)
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
export const SANS = "'Outfit', sans-serif";
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
  expected_delegates: number;
  logo_url: string | null;
  banner_url: string | null;
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

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
}

/** "12–14 JUN", compact ledger form. */
export function compactRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()].toUpperCase()}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()].toUpperCase()} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()].toUpperCase()}`;
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
  return c.fee_amount === 0 ? 'Free' : `${c.fee_currency} ${formatFeeAmount(c.fee_amount)}`;
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

// ── Fixed glass variant switcher pill (lab mechanic, do not remove) ─────────

export function VariantSwitcher({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div
      className="fixed z-[90] flex items-center gap-1"
      style={{
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1px solid rgba(221,212,192,0.9)',
        borderRadius: '9999px',
        padding: '5px',
        boxShadow: '0 12px 32px rgba(27,56,40,0.18)',
      }}
    >
      <span
        className="pl-3 pr-2"
        style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.18em', color: TAUPE }}
      >
        LAB
      </span>
      {([1, 2, 3] as const).map(v => (
        <Link
          key={v}
          href={`/conferences/landing-lab?v=${v}`}
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '6px 12px',
            borderRadius: '9999px',
            textDecoration: 'none',
            color: current === v ? PALE_GOLD : FOREST,
            backgroundColor: current === v ? FOREST : 'transparent',
            transition: 'background-color 180ms ease, color 180ms ease',
          }}
          onMouseEnter={(e) => {
            if (current !== v) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)';
          }}
          onMouseLeave={(e) => {
            if (current !== v) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          V{v}
        </Link>
      ))}
    </div>
  );
}

// ── Shared ivory footer (design rule: footer bg is always #EDE7D8) ───────────

export function LabFooter() {
  return (
    <footer
      className="relative z-10 border-t px-6 py-8"
      style={{
        borderColor: HAIRLINE,
        backgroundImage: GRAIN,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        backgroundColor: IVORY,
      }}
    >
      <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
        <img
          src="/Conferences.png"
          alt="Gavelling Conferences"
          className="h-7 w-auto"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(27,56,40,0.18))' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.instagram.com/wearegavelling/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            style={{ color: TAUPE, transition: 'color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = FOREST; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = TAUPE; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
            </svg>
          </span>
        </div>
        <p className="text-xs font-semibold md:text-right" style={{ color: FOREST, fontFamily: SANS }}>
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
      </div>
    </footer>
  );
}
