'use client';

// Shared UI primitives for the /account section.
// Design language: ivory bg, glass cream cards, parchment borders, tiny gold
// DM Mono eyebrows, Outfit for UI text, lucide icons only.

import { useState } from 'react';
import { Medal, Award } from 'lucide-react';

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
 * A small, human-feeling tag. Editorial, not a generic status pill: Outfit,
 * normal case, a quiet warm fill, thin border, gentle rounded-corners (not a
 * full "candy" capsule) and NO default coloured dot — that dot + capsule combo
 * is the AI-dashboard tell we are moving away from. Pass an `icon` for meaning.
 */
export function Pill({
  children,
  tone = 'neutral',
  dot = false,
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
  const pad = size === 'sm' ? '2px 9px' : '3px 11px';
  const fs = size === 'sm' ? '11px' : '12px';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        padding: pad,
        borderRadius: '7px',
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        color: t.text,
        fontFamily: OUTFIT,
        fontSize: fs,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '0.005em',
        ...style,
      }}
    >
      {icon && <span className="inline-flex items-center" style={{ marginLeft: '-1px' }}>{icon}</span>}
      {!icon && dot && (
        <span aria-hidden style={{ width: '5px', height: '5px', borderRadius: '9999px', backgroundColor: t.dot, flexShrink: 0 }} />
      )}
      <span style={{ display: 'inline-block' }}>{children}</span>
    </span>
  );
}

// ── LevelBadge ───────────────────────────────────────────────────────────────
// A crafted rank marker for the MUN experience level — replaces the generic
// coloured "• Beginner" pill. Shows a small four-bar rank meter that fills to
// match the tier (beginner=1 … expert=4), so it reads as an insignia, not a
// status chip.

const LEVEL_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
const LEVEL_ACCENT: Record<string, string> = {
  beginner:     '#4A7896',
  intermediate: '#2A5A3C',
  advanced:     '#B8844A',
  expert:       '#B6871F',
};

export function LevelBadge({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' }) {
  const key = (level ?? '').toLowerCase();
  const rank = LEVEL_RANK[key] ?? 1;
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unranked';
  const barH = size === 'sm' ? [7, 9, 11, 13] : [8, 11, 14, 17];
  const fs = size === 'sm' ? '12px' : '13.5px';
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        padding: size === 'sm' ? '3px 10px 3px 9px' : '4px 12px 4px 10px',
        borderRadius: '9px',
        backgroundColor: '#FAF8F3',
        border: '1px solid rgba(221,212,192,0.95)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      <span className="inline-flex items-end" style={{ gap: '2px', height: `${barH[3]}px` }} aria-hidden>
        {barH.map((h, i) => (
          <span
            key={i}
            style={{
              width: size === 'sm' ? '3px' : '3.5px',
              height: `${h}px`,
              borderRadius: '1.5px',
              backgroundColor: i < rank ? accent : 'rgba(154,138,120,0.3)',
            }}
          />
        ))}
      </span>
      <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: fs, color: '#1C1410', letterSpacing: '0.01em' }}>
        {label}
      </span>
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

// ── Award tiers ──────────────────────────────────────────────────────────────
// Gold   → Best Delegate, Diplomacy Award (the top honours)
// Silver → Outstanding / Most Outstanding Delegate, Honourable Mention
// Bronze → Verbal Commendation, Best Position Paper, and anything else.

export type AwardTier = 'gold' | 'silver' | 'bronze';

const AWARD_TIER_STYLE: Record<AwardTier, { bg: string; border: string; text: string; from: string; to: string; medal: string }> = {
  gold:   { bg: 'rgba(238,217,138,0.24)', border: 'rgba(182,135,31,0.45)',  text: '#7A5A20', from: 'rgba(238,217,138,0.7)',  to: 'rgba(182,135,31,0.4)',  medal: '#7A5A20' },
  silver: { bg: 'rgba(176,184,196,0.24)', border: 'rgba(120,132,150,0.5)',  text: '#4C5563', from: 'rgba(214,220,228,0.85)', to: 'rgba(140,152,168,0.5)', medal: '#4C5563' },
  bronze: { bg: 'rgba(190,140,100,0.22)', border: 'rgba(150,96,56,0.5)',    text: '#7A4B2B', from: 'rgba(206,150,104,0.8)',  to: 'rgba(150,96,56,0.45)',  medal: '#7A4B2B' },
};

export function awardTier(name: string): AwardTier {
  const n = name.toLowerCase();
  if (/best delegate|diplomacy/.test(n)) return 'gold';
  if (/outstanding|honou?rable mention/.test(n)) return 'silver';
  return 'bronze'; // verbal commendation, best position paper, anything else
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
  const tier = AWARD_TIER_STYLE[awardTier(name)];

  if (failed) {
    return (
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: `linear-gradient(135deg, ${tier.from}, ${tier.to})`,
          border: `1px solid ${tier.border}`,
        }}
      >
        {awardTier(name) === 'bronze' && /position paper/i.test(name)
          ? <Award size={Math.round(size * 0.55)} strokeWidth={2.2} style={{ color: tier.medal }} />
          : <Medal size={Math.round(size * 0.55)} strokeWidth={2.2} style={{ color: tier.medal }} />}
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

/** Award chip, tier-themed (gold / silver / bronze) with artwork thumbnail. */
export function AwardChip({ name }: { name: string }) {
  const tier = AWARD_TIER_STYLE[awardTier(name)];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-[3px]"
      style={{
        backgroundColor: tier.bg,
        border: `1px solid ${tier.border}`,
        color: tier.text,
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
