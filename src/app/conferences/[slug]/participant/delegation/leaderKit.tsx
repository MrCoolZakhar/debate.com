'use client';

// Shared look of the delegation leader card (taste board 1A, 19 Oct 2026):
// white cards that lift like Airbnb (a soft, layered, forest-tinted shadow,
// 20px corners), fine-line Lucide icons in bare ink, round crests and flags.

import { matchPresetEmblem } from '@/lib/presetNames';
import { NEU, OUTFIT } from '@/components/neu';
import ProfileLink from '@/components/ProfileLink';

export const FONT = OUTFIT;
export const INK = NEU.ink;
export const INK_SOFT = NEU.inkSoft;
/** The conference's own main colour (never Gavelling forest on /conferences/[slug]). */
export const FOREST = 'var(--gv-main)';
export const LINE = 'color-mix(in srgb, var(--gv-main) 9%, transparent)';
export const OK_GREEN = '#1F6B45';
export const OWE = '#9A4A12';
export const DANGER = '#A3341F';
/** Fine line, bare ink (icon direction A). */
export const STROKE = 1.5;

export const LIFT_SHADOW = '0 1px 2px color-mix(in srgb, var(--gv-main) 8%, transparent), 0 6px 16px color-mix(in srgb, var(--gv-main) 8%, transparent), 0 18px 44px color-mix(in srgb, var(--gv-main) 12%, transparent)';

export const cardStyle: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW,
};

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 16px',
  borderRadius: 10, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
};
export const primaryBtn: React.CSSProperties = {
  ...BTN_BASE, border: 'none', color: 'var(--gv-on-main)', background: 'linear-gradient(180deg, var(--gv-main-mid), var(--gv-main))',
};
export const secondaryBtn: React.CSSProperties = {
  ...BTN_BASE, border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)', color: 'var(--gv-main)', background: '#FFFFFF',
};
export const BTN_CLASS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--gv-accent)]';

export const linkStyle: React.CSSProperties = {
  fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3,
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
      style={{ width: size, height: size, borderRadius: '50%', background: tintFor(seed ?? name), color: 'var(--gv-main)', fontFamily: FONT, fontWeight: 600, fontSize: Math.round(size * 0.32) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** A person's avatar that opens their public MUN CV (/cv/<id>) wherever we
 *  know who they are (CLAUDE.md §8). No user id, no link: the bare avatar.
 *  `nested` stops the click reaching a clickable row underneath. */
export function CvAvatar({ userId, name, url, size = 40, seed, nested = true }: {
  userId: string | null | undefined;
  name: string;
  url: string | null;
  size?: number;
  seed?: string;
  nested?: boolean;
}) {
  const avatar = <RoundAvatar name={name} url={url} size={size} seed={seed} />;
  if (!userId) return avatar;
  return (
    <ProfileLink
      userId={userId}
      name={name}
      nested={nested}
      className="inline-flex flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] focus-visible:ring-offset-2"
      style={{ lineHeight: 0 }}
    >
      {avatar}
    </ProfileLink>
  );
}

/** Faculty advisors first, then head delegates, then delegates (CLAUDE.md §8). */
export const ROLE_RANK: Record<string, number> = { 'faculty-advisor': 0, 'head-delegate': 1, delegate: 2 };
export const roleRank = (role: string | null | undefined) => ROLE_RANK[role ?? ''] ?? 3;

/** A big number with its word beside it (CLAUDE.md §8: never a count pill). */
export function StatNumber({ n, word }: { n: number; word: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</span>
      <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>{word}</span>
    </div>
  );
}
