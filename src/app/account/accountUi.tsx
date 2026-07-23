'use client';

// Shared UI primitives for the /account section.
// Design language: ivory bg, glass cream cards, parchment borders, tiny gold
// Outfit eyebrows, Outfit for UI text, lucide icons only.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Medal, Award, Info, X, Star, Trophy, Handshake, Megaphone, ScrollText, type LucideIcon } from 'lucide-react';
import { EXPERIENCE_BANDS } from '@/lib/munExperience';
import Portal from '@/components/Portal';
import { CONFERENCE_COMMITTEE_PRESETS } from '@/components/ConferenceRosterPicker';

export const OUTFIT = "'Outfit', sans-serif";
// No monospace on the conferences side — MONO is an Outfit alias kept only so
// existing importers keep resolving. Nothing renders as monospace anymore.
export const MONO = OUTFIT;

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
// A crafted rank marker for the MUN experience level. Each tier carries its own
// hand-drawn insignia that escalates in prestige (beginner = a single humble
// sprout/chevron; expert = a crowned star), so the level reads at a glance and
// not as a generic coloured dot. Baked into this shared badge so every consumer
// (CV stat tile + entry, profile rank banner, assignment panel) inherits it.

export const LEVEL_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
export const LEVEL_ACCENT: Record<string, string> = {
  beginner:     '#4A7896',
  intermediate: '#2A5A3C',
  advanced:     '#B8844A',
  expert:       '#B6871F',
};

/**
 * The insignia glyph for a tier, drawn on a 24×24 canvas. Escalating shapes:
 *   beginner     → a single chevron (one stripe — the recruit)
 *   intermediate → double chevron   (a corporal's rank)
 *   advanced     → triple chevron   (a sergeant's stripes — senior rank)
 *   expert       → a crowned star   (the top honour)
 * `accent` colours the stroke/fill; the glyph is meant to sit on a light disc.
 */
export function LevelInsignia({ level, size = 16 }: { level: string; size?: number }) {
  const key = (level ?? '').toLowerCase();
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

  if (key === 'expert') {
    // Crowned star — the prestige tier.
    return (
      <svg {...common}>
        <path d="M12 3.2l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.94l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
          fill={accent} stroke={accent} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M6.6 20.4h10.8" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="11.4" r="1.7" fill="#FAF8F3" />
      </svg>
    );
  }
  if (key === 'advanced') {
    // Triple chevron — a sergeant's stripes. Continues the single → double
    // ladder unambiguously, one step below the crowned star.
    return (
      <svg {...common}>
        <path d="M5 9.5l7-6 7 6" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 14.5l7-6 7 6" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19.5l7-6 7 6" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (key === 'intermediate') {
    // Double chevron — a corporal's stripes.
    return (
      <svg {...common}>
        <path d="M5 12l7-6 7 6" fill="none" stroke={accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17l7-6 7 6" fill="none" stroke={accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // beginner — a single chevron / sprout.
  return (
    <svg {...common}>
      <path d="M5 15l7-7 7 7" fill="none" stroke={accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LevelBadge({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' }) {
  const key = (level ?? '').toLowerCase();
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unranked';
  // The insignia disc + glyph are deliberately oversized — the rank star is the
  // hero of the badge, so it reads at a glance rather than as a timid dot.
  const disc = size === 'sm' ? 28 : 36;
  const glyph = size === 'sm' ? 22 : 28;
  const fs = size === 'sm' ? '12.5px' : '14.5px';
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: size === 'sm' ? '7px' : '8px',
        padding: size === 'sm' ? '3px 12px 3px 4px' : '4px 14px 4px 5px',
        borderRadius: '9px',
        backgroundColor: '#FAF8F3',
        border: '1px solid rgba(221,212,192,0.95)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: `${disc}px`,
          height: `${disc}px`,
          borderRadius: '9999px',
          background: `linear-gradient(150deg, ${accent}22, ${accent}12)`,
          border: `1px solid ${accent}55`,
        }}
      >
        <LevelInsignia level={level} size={glyph} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: fs, color: '#1C1410', letterSpacing: '0.01em' }}>
        {label}
      </span>
    </span>
  );
}

// ── ExperienceInfo ('i' explainer) ─────────────────────────────────────────
// A small circular info button that reveals how the MUN experience bands work.
// Bands + thresholds are pulled straight from munExperience.ts (single source),
// so the copy never drifts. Used on the profile rank area and the CV page.

/** Human range string for a band, e.g. "1", "2–4", "9+". */
function bandRange(i: number): string {
  const band = EXPERIENCE_BANDS[i];
  const next = EXPERIENCE_BANDS[i + 1];
  if (!next) return `${band.min}+`;
  const lo = Math.max(1, band.min); // "0-1" reads better as the first conference count
  const hi = next.min - 1;
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

export function ExperienceInfo({
  tone = 'gold',
  align = 'right',
  currentLevel,
}: {
  tone?: 'gold' | 'light';
  align?: 'left' | 'right';
  /** The user's current tier — its row in the ladder is highlighted. */
  currentLevel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'below' | 'above' } | null>(null);

  const POP_W = 288;
  const POP_H = 348; // estimate for edge-flip; popover is a fixed ladder

  // The rank banner and its ancestors set overflow:hidden, which clips an
  // in-flow absolute popover. Render it in a Portal at fixed viewport coords
  // computed from the trigger, flipping near the right/bottom edges so it is
  // NEVER cut off. (Mirrors the applications page PaymentMenu.)
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'right' ? r.right - POP_W : r.left;
    if (left + POP_W > vw - 10) left = vw - 10 - POP_W;
    if (left < 10) left = 10;
    const below = r.bottom + 8;
    const flipUp = below + POP_H > vh - 10 && r.top - POP_H - 8 > 10;
    setPos({
      top: flipUp ? r.top - POP_H - 8 : below,
      left,
      placement: flipUp ? 'above' : 'below',
    });
  }, [align]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, [cancelClose]);

  const show = useCallback(() => { cancelClose(); place(); setOpen(true); }, [cancelClose, place]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    const onReflow = () => place();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  const onGold = tone === 'gold';
  const btnColor = onGold ? '#EED98A' : '#B6871F';
  const btnBorder = onGold ? 'rgba(238,217,138,0.5)' : 'rgba(182,135,31,0.4)';
  const btnBg = onGold ? 'rgba(238,217,138,0.14)' : 'rgba(182,135,31,0.1)';

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={scheduleClose}
        aria-label="How experience levels work"
        aria-expanded={open}
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none transition-colors"
        style={{
          width: '20px', height: '20px', borderRadius: '9999px',
          border: `1px solid ${btnBorder}`, backgroundColor: btnBg,
          color: btnColor, cursor: 'help',
        }}
      >
        <Info size={12} strokeWidth={2.4} />
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            role="dialog"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="rounded-2xl p-4"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: `${POP_W}px`,
              backgroundColor: 'rgba(250,248,243,0.98)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid #DDD4C0',
              boxShadow: '0 18px 46px rgba(27,56,40,0.18)',
              animation: `accFade 150ms cubic-bezier(0.22,1,0.36,1)`,
            }}
          >
            <style>{`@keyframes accFade{from{opacity:0;transform:translateY(${pos.placement === 'above' ? '6px' : '-6px'})}to{opacity:1;transform:translateY(0)}}`}</style>
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <p className="font-bold text-[13px]" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                How experience levels work
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex items-center justify-center flex-shrink-0 focus:outline-none"
                style={{ width: '32px', height: '32px', margin: '-6px', borderRadius: '9999px', border: 'none', background: 'none', color: '#9A8A78', cursor: 'pointer' }}
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {EXPERIENCE_BANDS.map((band, i) => {
                const accent = LEVEL_ACCENT[band.level];
                const isCurrent = (currentLevel ?? '').toLowerCase() === band.level;
                return (
                  <div
                    key={band.level}
                    className="flex items-center gap-2.5"
                    style={{
                      // Very faint tier-tinted wash so the ladder reads as an
                      // escalation; the user's current tier is a touch stronger.
                      padding: '5px 8px',
                      borderRadius: '10px',
                      backgroundColor: isCurrent ? `${accent}24` : `${accent}12`, // ~0.14 / ~0.07
                      border: isCurrent ? `1px solid ${accent}55` : '1px solid transparent',
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '22px', height: '22px', borderRadius: '9999px',
                        background: `linear-gradient(150deg, ${accent}22, ${accent}12)`,
                        border: `1px solid ${accent}55`,
                      }}
                    >
                      <LevelInsignia level={band.level} size={14} />
                    </span>
                    <span className="flex-1" style={{ fontFamily: OUTFIT, fontSize: '13px', fontWeight: isCurrent ? 700 : 600, color: '#1C1410' }}>
                      {band.label}
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: '11px', fontWeight: 600, color: '#B6871F', fontVariantNumeric: 'tabular-nums' }}>
                      {bandRange(i)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] mt-3 pt-2.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0, borderTop: '1px solid rgba(221,212,192,0.6)', lineHeight: 1.55 }}>
              Your level is derived from the number of conferences on your MUN CV.
            </p>
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── Eyebrow ────────────────────────────────────────────────────────────────

export function Eyebrow({ children, color = '#B6871F', className = '', size = 'sm' }: {
  children: React.ReactNode;
  color?: string;
  className?: string;
  /** 'sm' keeps the original tiny eyebrow; 'md'/'lg' make a section heading more prominent. */
  size?: 'sm' | 'md' | 'lg';
}) {
  const fontSize = size === 'lg' ? '11.5px' : size === 'md' ? '10.5px' : '9px';
  const letterSpacing = size === 'lg' ? '0.16em' : '0.14em';
  return (
    <p
      className={className}
      style={{
        fontFamily: OUTFIT,
        fontWeight: size === 'sm' ? 700 : 800,
        fontSize,
        letterSpacing,
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

export function GlassCard({ children, className = '', style = {}, ...rest }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[20px] p-6 md:p-7 ${className}`}
      style={{
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '1.5px solid #D8CDB6',
        boxShadow: '0 1px 3px rgba(27,56,40,0.07), 0 12px 32px rgba(27,56,40,0.08)',
        ...style,
      }}
      {...rest}
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
        className="absolute rounded-full transition-[left] duration-200"
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
  const q = (committee ?? '').trim().toLowerCase();
  if (!q) return null;
  // Prefer the fuller shared committee list used by the conference committee
  // picker (CONFERENCE_COMMITTEE_PRESETS) — it carries the real emblem for
  // bodies the regex list misses or flattens to the generic UN seal (DISEC,
  // SPECPOL, SOCHUM, UNICEF, UNESCO, FAO, IAEA, ICC, ICJ, FIFA, House of
  // Commons, US Senate, Press Corps, …). Exact name/acronym match so a CV
  // committee resolves to its own logo even for a conference never run here.
  const preset = CONFERENCE_COMMITTEE_PRESETS.find(
    (p) => p.name.toLowerCase() === q || p.acronym.toLowerCase() === q,
  );
  if (preset?.logoPath) return preset.logoPath;
  // Fall back to the loose regex presets for free-text committee names.
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

// Ordered by medal tier so the multi-select reads as an escalating ladder:
// GOLD (Best Delegate, Diplomacy Award) → SILVER (Outstanding, Honourable
// Mention) → BRONZE (Verbal Commendation, Best Position Paper). Custom
// free-text honours fall outside this list and render as the green "special"
// tier (see awardTier).
export const AWARD_LIST = [
  'Best Delegate',
  'Diplomacy Award',
  'Outstanding Delegate',
  'Honourable Mention',
  'Verbal Commendation',
  'Best Position Paper',
] as const;

/** True when an award is a custom, free-text honour (not one of the presets). */
export function isCustomAward(name: string): boolean {
  return !AWARD_LIST.some((a) => a.toLowerCase() === name.trim().toLowerCase());
}

export function awardSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Award tiers ──────────────────────────────────────────────────────────────
// Gold    → Best Delegate, Diplomacy Award (the top honours)
// Silver  → Outstanding / Most Outstanding Delegate, Honourable Mention
// Bronze  → Verbal Commendation, Best Position Paper
// Special → any custom, free-text honour the delegate types in — Gavelling
//           forest green, distinct from the metal medals.

export type AwardTier = 'gold' | 'silver' | 'bronze' | 'special';

const AWARD_TIER_STYLE: Record<AwardTier, { bg: string; border: string; text: string; from: string; to: string; medal: string }> = {
  gold:    { bg: 'rgba(238,217,138,0.24)', border: 'rgba(182,135,31,0.45)',  text: '#7A5A20', from: 'rgba(238,217,138,0.7)',  to: 'rgba(182,135,31,0.4)',  medal: '#7A5A20' },
  silver:  { bg: 'rgba(176,184,196,0.24)', border: 'rgba(120,132,150,0.5)',  text: '#4C5563', from: 'rgba(214,220,228,0.85)', to: 'rgba(140,152,168,0.5)', medal: '#4C5563' },
  bronze:  { bg: 'rgba(190,140,100,0.22)', border: 'rgba(150,96,56,0.5)',    text: '#7A4B2B', from: 'rgba(206,150,104,0.8)',  to: 'rgba(150,96,56,0.45)',  medal: '#7A4B2B' },
  // Forest-green special honour. Light glyph on a deep green disc.
  special: { bg: 'rgba(27,56,40,0.12)',    border: 'rgba(42,90,60,0.45)',    text: '#1B3828', from: 'rgba(63,122,82,0.9)',   to: 'rgba(27,56,40,0.7)',    medal: '#FAF8F3' },
};

export function awardTier(name: string): AwardTier {
  const n = name.toLowerCase();
  if (/best delegate|diplomacy/.test(n)) return 'gold';
  if (/outstanding|honou?rable mention/.test(n)) return 'silver';
  if (/verbal commendation|position paper/.test(n)) return 'bronze';
  return 'special'; // custom free-text honour → green
}

// Each award renders a distinct, on-brand lucide glyph on its tier-coloured
// disc — no external artwork (public/awards/ ships no PNGs, so every <img>
// 404'd). Matching is case-insensitive and works off the award name; the tier
// (awardTier) still drives the disc colour and glyph tint.
function awardIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/best delegate/.test(n)) return Trophy;         // gold
  if (/diplomacy/.test(n)) return Handshake;          // gold
  if (/outstanding/.test(n)) return Medal;            // silver
  if (/honou?rable mention/.test(n)) return Award;    // silver (ribbon)
  if (/verbal commendation/.test(n)) return Megaphone; // bronze
  if (/position paper/.test(n)) return ScrollText;    // bronze
  return Star;                                        // custom / special (green)
}

/**
 * Small icon tile for an award: a tier-coloured disc (gold / silver / bronze /
 * green) with a per-award lucide glyph tinted in the tier's medal colour.
 */
export function AwardArtwork({ name, size = 20 }: { name: string; size?: number }) {
  const t = awardTier(name);
  const tier = AWARD_TIER_STYLE[t];
  const Icon = awardIcon(name);
  // "Special" honours use a light glyph on the deep-green disc; the Star reads
  // best filled. Metal tiers keep a crisp stroked glyph in the medal colour.
  const filled = t === 'special';
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
      <Icon
        size={Math.round(size * 0.55)}
        strokeWidth={2.2}
        fill={filled ? tier.medal : 'none'}
        style={{ color: tier.medal }}
      />
    </span>
  );
}

/** Award chip, tier-themed (gold / silver / bronze) with artwork thumbnail.
 *  A slightly raised medallion: larger artwork, bolder/bigger label, a soft
 *  tier-tinted gradient and drop shadow so an award reads as an honour. */
export function AwardChip({ name }: { name: string }) {
  const tier = AWARD_TIER_STYLE[awardTier(name)];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full pl-1 pr-3.5 py-1"
      style={{
        background: `linear-gradient(145deg, ${tier.bg}, ${tier.from})`,
        border: `1px solid ${tier.border}`,
        color: tier.text,
        fontFamily: OUTFIT,
        fontSize: '13px',
        fontWeight: 800,
        letterSpacing: '-0.005em',
        boxShadow: `0 2px 7px rgba(27,56,40,0.12), inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
      <AwardArtwork name={name} size={24} />
      {name}
    </span>
  );
}
