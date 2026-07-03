'use client';

// Shared UI primitives for the /account section.
// Design language: ivory bg, glass cream cards, parchment borders, tiny gold
// DM Mono eyebrows, Outfit for UI text, lucide icons only.

import { useState } from 'react';
import { Medal } from 'lucide-react';

export const OUTFIT = "'Outfit', sans-serif";
export const MONO = "'DM Mono', monospace";

// ── Pill / Tag ───────────────────────────────────────────────────────────────
// The crafted replacement for the old DM-Mono / UPPERCASE / letter-spaced grey
// pill. This one uses Outfit in normal case, a warm tint tied to meaning, a soft
// border and a small leading dot. Use this everywhere a small status/level chip
// is needed in the account area.

export type PillTone = 'neutral' | 'forest' | 'gold' | 'amber' | 'sky' | 'rose' | 'plum';

const PILL_TONES: Record<PillTone, { bg: string; border: string; text: string; dot: string }> = {
  // Warm parchment default — no more cold grey.
  neutral: { bg: 'rgba(221,212,192,0.30)', border: 'rgba(154,138,120,0.42)', text: '#6E5F4E', dot: '#9A8A78' },
  forest:  { bg: 'rgba(27,56,40,0.10)',    border: 'rgba(27,56,40,0.30)',    text: '#1B3828', dot: '#2A5A3C' },
  gold:    { bg: 'rgba(238,217,138,0.30)',  border: 'rgba(182,135,31,0.45)',  text: '#7A5A20', dot: '#B6871F' },
  amber:   { bg: 'rgba(184,132,74,0.16)',   border: 'rgba(184,132,74,0.42)',  text: '#8A5A2C', dot: '#B8844A' },
  sky:     { bg: 'rgba(74,120,150,0.14)',   border: 'rgba(74,120,150,0.40)',  text: '#365A72', dot: '#4A7896' },
  rose:    { bg: 'rgba(139,32,32,0.10)',    border: 'rgba(139,32,32,0.32)',   text: '#8B2020', dot: '#A83A3A' },
  plum:    { bg: 'rgba(108,74,120,0.14)',   border: 'rgba(108,74,120,0.40)',  text: '#57406A', dot: '#8A6BA0' },
};

/** Difficulty / experience levels map to a warm tint ramp (beginner→expert). */
export const LEVEL_TONE: Record<string, PillTone> = {
  beginner:     'sky',
  intermediate: 'forest',
  advanced:     'amber',
  expert:       'gold',
};

/**
 * A small, human-feeling tag. Outfit, normal case, soft warm fill, optional
 * leading dot or icon. Deliberately NOT monospace/uppercase/letter-spaced —
 * that generic pill is the thing we are replacing.
 */
export function Pill({
  children,
  tone = 'neutral',
  dot = true,
  icon,
  size = 'md',
  title,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  tone?: PillTone;
  dot?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = PILL_TONES[tone] ?? PILL_TONES.neutral;
  const pad = size === 'sm' ? '2px 9px 2px 8px' : '3px 11px 3px 10px';
  const fs = size === 'sm' ? '11px' : '12px';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full ${className}`}
      style={{
        padding: pad,
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        color: t.text,
        fontFamily: OUTFIT,
        fontSize: fs,
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: '0.005em',
        ...style,
      }}
    >
      {icon
        ? <span className="inline-flex items-center" style={{ marginLeft: '-1px' }}>{icon}</span>
        : (dot && (
            <span
              aria-hidden
              style={{
                width: size === 'sm' ? '5px' : '6px',
                height: size === 'sm' ? '5px' : '6px',
                borderRadius: '9999px',
                backgroundColor: t.dot,
                flexShrink: 0,
              }}
            />
          ))}
      <span style={{ display: 'inline-block' }}>{children}</span>
    </span>
  );
}

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
  'Diplomacy Award',
] as const;

export function awardSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Some award labels changed over time but their artwork asset did not. Older CV
// rows may still store the previous label — map both to the same file so the
// artwork keeps resolving. The owner ships /awards/diplomacy.png for both.
const AWARD_ARTWORK_SLUG_ALIASES: Record<string, string> = {
  'diplomacy-award': 'diplomacy',
};

export function awardArtworkPath(name: string): string {
  const slug = awardSlug(name);
  return `/awards/${AWARD_ARTWORK_SLUG_ALIASES[slug] ?? slug}.png`;
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
