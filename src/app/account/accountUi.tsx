'use client';

// Shared UI primitives for the /account section.
// Design language: ivory bg, glass cream cards, parchment borders, tiny gold
// DM Mono eyebrows, Outfit for UI text, lucide icons only.

import { useState } from 'react';
import { Medal } from 'lucide-react';

export const OUTFIT = "'Outfit', sans-serif";
export const MONO = "'DM Mono', monospace";

// ── Eyebrow ────────────────────────────────────────────────────────────────

export function Eyebrow({ children, color = '#B6871F', className = '' }: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <p
      className={className}
      style={{
        fontFamily: MONO,
        fontSize: '9px',
        letterSpacing: '0.26em',
        color,
        margin: 0,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </p>
  );
}

// ── GlassCard ──────────────────────────────────────────────────────────────

export function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[20px] p-6 md:p-7 ${className}`}
      style={{
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(221,212,192,0.9)',
        boxShadow: '0 1px 3px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── PillToggle (matches src/app/manage/[slug]/settings/page.tsx) ───────────

export function PillToggle({ value, onChange, size = 'md' }: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'md' | 'sm';
}) {
  const w = size === 'md' ? 40 : 32;
  const h = size === 'md' ? 22 : 18;
  const thumb = size === 'md' ? 18 : 14;
  const onLeft = size === 'md' ? 20 : 16;

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: `${w}px`, height: `${h}px`,
        borderRadius: '9999px',
        backgroundColor: value ? '#1B3828' : '#DDD4C0',
        transition: 'background-color 200ms ease',
        border: 'none', cursor: 'pointer',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: `${thumb}px`, height: `${thumb}px`,
          backgroundColor: 'white',
          top: '2px',
          left: value ? `${onLeft}px` : '2px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// ── Committee logo presets ─────────────────────────────────────────────────
// Maps common committee / organ names to the assets in public/logos/.
// Order matters: specific bodies first, the generic UN system match last.

const COMMITTEE_LOGO_PRESETS: [RegExp, string][] = [
  [/\bWHO\b|WORLD HEALTH/i, '/logos/who.png'],
  [/UNHRC|HUMAN RIGHTS/i, '/logos/UNHRC.png'],
  [/UNEP|ENVIRONMENT(AL)? (PROGRAMME|ASSEMBLY)/i, '/logos/UNEP.png'],
  [/\bNATO\b|NORTH ATLANTIC/i, '/logos/nato.png'],
  [/\bEU\b|EUROPEAN (UNION|COUNCIL|PARLIAMENT|COMMISSION)/i, '/logos/eu.png'],
  [/WORLD BANK/i, '/logos/worldbank.png'],
  [/\bIMF\b|MONETARY FUND/i, '/logos/IMF.png'],
  [/AFRICAN UNION|\bAU\b/i, '/logos/AU.png'],
  [/\bASEAN\b/i, '/logos/asean.png'],
  [/ARAB LEAGUE|LEAGUE OF ARAB/i, '/logos/arab-league.png'],
  [/\bG20\b/i, '/logos/g20.png'],
  [/UNSC|SECURITY COUNCIL|UNGA|GENERAL ASSEMBLY|DISEC|SOCHUM|SPECPOL|ECOFIN|ECOSOC|UNICEF|UNESCO|UNDP|UNODC|UNCSW|UN ?WOMEN|\bWFP\b|\bILO\b|\bIAEA\b|\bICJ\b|UNITED NATIONS|\bUN\b/i, '/logos/un.svg'],
];

export function getCommitteeLogo(committee: string): string | null {
  for (const [pattern, path] of COMMITTEE_LOGO_PRESETS) {
    if (pattern.test(committee)) return path;
  }
  return null;
}

/** Clean monogram tile fallback when no logo resolves. */
export function monogramFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ── Awards ─────────────────────────────────────────────────────────────────

export const AWARD_LIST = [
  'Best Delegate',
  'Outstanding Delegate',
  'Honourable Mention',
  'Best Position Paper',
  'Verbal Commendation',
  'Diplomacy',
] as const;

export function awardSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function awardArtworkPath(name: string): string {
  return `/awards/${awardSlug(name)}.png`;
}

/**
 * Small artwork tile for an award. Tries /awards/<kebab-slug>.png first,
 * falls back to a styled medal disc when the artwork is not present yet.
 */
export function AwardArtwork({ name, size = 20 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: 'linear-gradient(135deg, rgba(238,217,138,0.65), rgba(182,135,31,0.35))',
          border: '1px solid rgba(182,135,31,0.45)',
        }}
      >
        <Medal size={Math.round(size * 0.55)} strokeWidth={2.2} style={{ color: '#7A5A20' }} />
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={awardArtworkPath(name)}
      alt={name}
      onError={() => setFailed(true)}
      className="flex-shrink-0"
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', borderRadius: '50%' }}
    />
  );
}

/** Vibrant translucent award chip with 1px border and artwork thumbnail. */
export function AwardChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-[3px]"
      style={{
        backgroundColor: 'rgba(238,217,138,0.22)',
        border: '1px solid rgba(182,135,31,0.4)',
        color: '#7A5A20',
        fontFamily: OUTFIT,
        fontSize: '11px',
        fontWeight: 600,
      }}
    >
      <AwardArtwork name={name} size={18} />
      {name}
    </span>
  );
}
