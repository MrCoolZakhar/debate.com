'use client';

// ─────────────────────────────────────────────────────────────────────────────
// <SeatName>: a delegation or character name in a session, never cut off (CLAUDE.md §8).
//
// A short name renders once, exactly as the surface always drew it. A long one ("General
// Charles de Gaulle", "Minister of Foreign Affairs of the Russian Federation") renders as
// TWO rows: the short form at the surface's own size, and the full name smaller beneath
// it, wrapping (`overflow-wrap: anywhere`), never truncated. The short form comes from
// `splitSeatName` (src/lib/seatName.ts), the one rule.
//
// `className` / `style` style the name (font, colour, weight) and are applied to the
// wrapper, so the second row inherits them and is drawn at `subScale` of the size (em).
// Screen readers hear the full name once: the short row is aria-hidden when split.
// Presentation only: no state, no effects, no writes.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { splitSeatName, SEAT_NAME_MAX } from '@/lib/seatName';

export default function SeatName({
  name,
  max = SEAT_NAME_MAX,
  className = '',
  style,
  splitStyle,
  subStyle,
  subClassName = '',
  subScale = 0.74,
  align = 'start',
  block = false,
  title,
}: {
  /** The name as the surface shows it (already localized). */
  name: string;
  /** Names up to this many characters are never split. */
  max?: number;
  className?: string;
  style?: CSSProperties;
  /** Extra wrapper style used only when the name is split (e.g. a tighter line height). */
  splitStyle?: CSSProperties;
  subStyle?: CSSProperties;
  subClassName?: string;
  /** Size of the full-name row relative to the name (em). */
  subScale?: number;
  align?: 'start' | 'center' | 'end';
  /** A block-level box (fills its line) instead of an inline one. */
  block?: boolean;
  /** Tooltip; defaults to the full name when split. */
  title?: string;
}) {
  const { language } = useLanguage();
  const parts = splitSeatName(name, { max, language });
  const wrap: CSSProperties = { overflowWrap: 'anywhere' };

  if (!parts.split) {
    return (
      <span className={className} style={{ ...wrap, ...style }} title={title}>
        {parts.full}
      </span>
    );
  }

  return (
    <span
      className={`min-w-0 ${className}`}
      style={{
        ...wrap,
        ...style,
        ...splitStyle,
        display: block ? 'flex' : 'inline-flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start',
        textAlign: align,
      }}
      title={title ?? parts.full}
    >
      <span aria-hidden style={{ ...wrap, maxWidth: '100%' }}>{parts.short}</span>
      <span
        className={subClassName}
        style={{
          ...wrap,
          maxWidth: '100%',
          fontSize: `${subScale}em`,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: 0,
          textTransform: 'none',
          opacity: 0.82,
          marginTop: 1,
          ...subStyle,
        }}
      >
        {parts.full}
      </span>
    </span>
  );
}
