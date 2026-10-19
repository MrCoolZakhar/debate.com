'use client';

// Shared look of the delegation leader card (taste board 1A, 19 Oct 2026):
// white cards that lift like Airbnb (a soft, layered, forest-tinted shadow,
// 20px corners), fine-line Lucide icons in bare ink, round crests and flags.

import { matchPresetEmblem } from '@/lib/presetNames';
import { NEU, OUTFIT } from '@/components/neu';

export const FONT = OUTFIT;
export const INK = NEU.ink;
export const INK_SOFT = NEU.inkSoft;
export const FOREST = NEU.forest;
export const LINE = 'rgba(27,56,40,0.09)';
export const OK_GREEN = '#1F6B45';
export const OWE = '#9A4A12';
export const DANGER = '#A3341F';
/** Fine line, bare ink (icon direction A). */
export const STROKE = 1.5;

export const LIFT_SHADOW = '0 1px 2px rgba(27,56,40,0.08), 0 6px 16px rgba(27,56,40,0.08), 0 18px 44px rgba(27,56,40,0.12)';

export const cardStyle: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW,
};

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 16px',
  borderRadius: 10, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
};
export const primaryBtn: React.CSSProperties = {
  ...BTN_BASE, border: 'none', color: '#FFFFFF', background: 'linear-gradient(180deg, #26503D, #1B3828)',
};
export const secondaryBtn: React.CSSProperties = {
  ...BTN_BASE, border: '1px solid rgba(27,56,40,0.16)', color: '#1B3828', background: '#FFFFFF',
};
export const BTN_CLASS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B6871F]';

export const linkStyle: React.CSSProperties = {
  fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3,
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
};

/** A committee's emblem: its own logo, else the preset that matches its name, else the UN emblem (as on the conference page). */
export function committeeEmblemSrc(logoUrl: string | null | undefined, name: string | null | undefined, abbreviation?: string | null): string {
  return logoUrl || matchPresetEmblem(name ?? '', abbreviation ?? null) || '/logos/un.svg';
}

export function CommitteeDisc({ src, size = 18 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
    />
  );
}

const AVATAR_TINTS = ['#E3EDE6', '#F3E9C9', '#E8E1F0', '#F6E2D8', '#DCE8F0'];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/** A person, or a delegation's crest: the picture in a circle, else initials on a soft tint. */
export function RoundAvatar({ name, url, size = 54, seed }: { name: string; url: string | null; size?: number; seed?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" aria-hidden style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: tintFor(seed ?? name), color: '#1B3828', fontFamily: FONT, fontWeight: 600, fontSize: Math.round(size * 0.32) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** A big number with its word beside it (CLAUDE.md §8: never a count pill). */
export function StatNumber({ n, word }: { n: number; word: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</span>
      <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>{word}</span>
    </div>
  );
}
