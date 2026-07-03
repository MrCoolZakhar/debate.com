'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, FileText, CreditCard, Zap, type LucideIcon } from 'lucide-react';

// ── Shared constants / types / helpers for the landing lab ──────────────────

export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

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

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

export function shortDate(d: string): string {
  const s = new Date(d + 'T00:00:00');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${String(s.getDate()).padStart(2, '0')} ${months[s.getMonth()]}`;
}

export function feeLabel(c: LabConference): string {
  return c.fee_amount === 0 ? 'FREE' : `${c.fee_currency} ${c.fee_amount.toFixed(0)}`;
}

// ── Urgency / social-proof helpers (conversion mechanics) ────────────────────

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export type TimingTone = 'now' | 'soon' | 'future' | 'past';
export interface ConfTiming { label: string; tone: TimingTone }

export function confTiming(c: LabConference): ConfTiming {
  const start = daysUntil(c.start_date);
  const end = daysUntil(c.end_date);
  if (end < 0) return { label: 'CONCLUDED', tone: 'past' };
  if (start <= 0) return { label: 'HAPPENING NOW', tone: 'now' };
  if (start === 1) return { label: 'STARTS TOMORROW', tone: 'soon' };
  if (start <= 45) return { label: `STARTS IN ${start} DAYS`, tone: 'soon' };
  return { label: `IN ${start} DAYS`, tone: 'future' };
}

export function timingColors(tone: TimingTone): { bg: string; fg: string } {
  switch (tone) {
    case 'now': return { bg: '#B6871F', fg: '#FAF8F3' };
    case 'soon': return { bg: '#1B3828', fg: '#EED98A' };
    case 'future': return { bg: 'rgba(27,56,40,0.08)', fg: '#1B3828' };
    case 'past': return { bg: 'rgba(154,138,120,0.16)', fg: '#9A8A78' };
  }
}

/** Upcoming conferences first; falls back to everything if nothing is upcoming. */
export function upcomingFirst(conferences: LabConference[]): LabConference[] {
  const upcoming = conferences.filter(c => daysUntil(c.end_date) >= 0);
  return upcoming.length > 0 ? upcoming : conferences;
}

export function circuitStats(conferences: LabConference[]) {
  const seats = conferences.reduce((s, c) => s + (c.expected_delegates || 0), 0);
  const countries = new Set(conferences.map(c => c.country)).size;
  return { listed: conferences.length, seats, countries };
}

// ── Production copy (voice preserved from ConferencesClient.tsx) ─────────────

export const COPY = {
  heroLine1: 'Find Your Next',
  heroLine2: 'Conference.',
  searchPlaceholder: 'Search conferences...',
  organiserTitle1: 'Run your conference.',
  organiserTitle2: 'Fee-free.',
  organiserBody:
    'Zero platform fees for organisers. Gavelling handles registration, allocations, document management, session integration, and automated communications.',
  organiserCta: 'START A CONFERENCE →',
  rolesTitle1: 'Looking to chair?',
  rolesTitle2: 'Find your next role.',
  rolesBody:
    'Conferences post open positions for chairs, secretariat, and staff. Apply directly through your Gavelling profile — your MUN CV travels with you.',
  rolesCta: 'FIND YOUR NEXT OPPORTUNITY →',
  globeTitle1: 'MUN Across',
  globeTitle2: 'the Globe.',
  globeBody:
    'From The Hague to Singapore, Tokyo to New York. Explore conferences on every continent and find your next destination.',
  globeCta: 'EXPLORE CONFERENCES WORLDWIDE →',
} as const;

export const ORGANISER_CARDS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Users, title: 'Smart Assignment', desc: 'Preferences + experience scores. One-click auto-assign.' },
  { icon: FileText, title: 'Document Portal', desc: 'Study guides, position papers, feedback — all in one place.' },
  { icon: CreditCard, title: 'Transparent Fees', desc: '5% delegate surcharge, waived with Gavelling Unlimited. You keep 100%.' },
  { icon: Zap, title: 'Automated Comms', desc: 'Acceptance emails, allocation codes, reminders — sent automatically.' },
];

export const ROLES_PILLS = ['CHAIRS', 'SECRETARIAT', 'STAFF'] as const;

// ── Shared search box (filters the fetched public conferences locally) ──────

export function LabSearch({
  conferences,
  appearance,
}: {
  conferences: LabConference[];
  appearance: 'field' | 'underline' | 'glass';
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q
    ? conferences.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.acronym.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const baseInput: React.CSSProperties = {
    width: '100%',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '14px',
    color: '#1C1410',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const inputStyle: React.CSSProperties =
    appearance === 'underline'
      ? {
          ...baseInput,
          padding: '12px 2px',
          border: 'none',
          borderBottom: `1.5px solid ${focused ? '#1B3828' : '#DDD4C0'}`,
          borderRadius: 0,
          backgroundColor: 'transparent',
          fontSize: '16px',
          transition: 'border-color 200ms ease',
        }
      : appearance === 'glass'
      ? {
          ...baseInput,
          padding: '14px 20px',
          borderRadius: '14px',
          border: `1.5px solid ${focused ? '#1B3828' : 'rgba(221,212,192,0.9)'}`,
          backgroundColor: 'rgba(250,248,243,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 10px 32px rgba(27,56,40,0.18)',
        }
      : {
          ...baseInput,
          padding: '14px 20px',
          borderRadius: '14px',
          border: `1.5px solid ${focused ? '#1B3828' : '#DDD4C0'}`,
          backgroundColor: 'rgba(250,248,243,0.92)',
          boxShadow: '0 2px 12px rgba(27,56,40,0.06)',
        };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push('/conferences/explore'); }}
        placeholder={COPY.searchPlaceholder}
        style={inputStyle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {q.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: '#FAF8F3',
            border: '1px solid #DDD4C0',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(27,56,40,0.14)',
            overflow: 'hidden',
          }}
        >
          {results.map(result => (
            <div
              key={result.id}
              onMouseDown={() => router.push(`/conferences/${result.slug}`)}
              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(221,212,192,0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, color: '#1C1410', margin: 0 }}>
                {result.full_name}
              </p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9A8A78', margin: '2px 0 0 0' }}>
                {result.city}, {result.country} · {formatDateRange(result.start_date, result.end_date)}
              </p>
            </div>
          ))}
          <div
            onMouseDown={() => router.push('/conferences/explore')}
            style={{ padding: '10px 16px', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10.5px', letterSpacing: '0.12em', color: '#1B3828', margin: 0 }}>
              SEARCH THE FULL DIRECTORY →
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fixed glass variant switcher pill ────────────────────────────────────────

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
        style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.18em', color: '#9A8A78' }}
      >
        LAB
      </span>
      {([1, 2, 3] as const).map(v => (
        <Link
          key={v}
          href={`/conferences/landing-lab?v=${v}`}
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '6px 12px',
            borderRadius: '9999px',
            textDecoration: 'none',
            color: current === v ? '#EED98A' : '#1B3828',
            backgroundColor: current === v ? '#1B3828' : 'transparent',
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

// ── Shared ivory footer (design rule: footer bg is always #EDE7D8) ──────────

export function LabFooter() {
  return (
    <footer
      className="relative z-10 border-t px-6 py-8"
      style={{
        borderColor: '#DDD4C0',
        backgroundImage: GRAIN,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        backgroundColor: '#EDE7D8',
      }}
    >
      <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
        <img
          src="/GavellingLogo.png"
          alt="Gavelling"
          className="h-7 w-auto"
          style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.instagram.com/wearegavelling/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            style={{ color: '#9A8A78', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}
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
        <p className="text-xs font-semibold md:text-right" style={{ color: '#1B3828' }}>
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
      </div>
    </footer>
  );
}
