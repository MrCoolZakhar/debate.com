'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DUOTONE ICONS FOR ORGANISER PAGES (owner, 11 Oct 2026: no Fluent 3D emoji on
// any organiser page). A Lucide glyph drawn as a forest line over a gold fill,
// either bare (`DuoGlyph`, where an emoji sat inline beside a word) or seated
// in a soft tinted disc (`DuoIconDisc`, where an emoji sat in a disc).
// `DuoIcon` in manage/[slug]/communications/commsKit.tsx is the reference look.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType, CSSProperties } from 'react';

/** Any Lucide icon (kept structural so local `LucideIcon` aliases fit too). */
export type DuoIconComponent = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;

const FOREST = '#1B3828';
const GOLD = '#EED98A';

/** A bare duotone glyph. `onDark` flips it for a forest ground (gold line,
 *  faint gold fill), e.g. inside an active forest chip. */
export function DuoGlyph({ icon: Icon, size = 18, onDark = false, style }: {
  icon: DuoIconComponent; size?: number; onDark?: boolean; style?: CSSProperties;
}) {
  return (
    <span aria-hidden className="inline-flex flex-shrink-0" style={{ lineHeight: 0 }}>
      <Icon
        size={size}
        strokeWidth={2}
        style={{ color: onDark ? GOLD : FOREST, fill: onDark ? 'rgba(238,217,138,0.28)' : GOLD, ...style }}
      />
    </span>
  );
}

/** A duotone glyph in a soft tinted disc. */
export function DuoIconDisc({ icon, size = 40, tone = 'gold', style }: {
  icon: DuoIconComponent; size?: number; tone?: 'gold' | 'green'; style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.max(10, Math.round(size * 0.32)),
        backgroundColor: tone === 'gold' ? 'rgba(238,217,138,0.45)' : 'rgba(61,122,82,0.14)',
        ...style,
      }}
    >
      <DuoGlyph icon={icon} size={Math.round(size * 0.52)} />
    </span>
  );
}
