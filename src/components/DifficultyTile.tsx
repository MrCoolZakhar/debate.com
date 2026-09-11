'use client';

import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { NEU, OUTFIT } from '@/components/neu';

// The committee level marker: the canonical rank insignia (same glyph the CV
// and profile use) in a plain accent-tinted circle, with the level named
// underneath. Shared by the organiser committees page and the public
// conference page so the two can never drift apart.
//
// It used to sit inside a neu tile (surface fill + NEU.outSm) laid out
// horizontally, which made a 20px glyph the small half of a wide pill. The
// bubble is gone: the insignia IS the marker, so it gets the size (20 → 30 at
// `sm`, 23 → 34 at `md`, glyph 14 → 21 and 16 → 24, holding the ~0.7
// glyph-to-disc ratio) and the label drops beneath it at the same font size it
// always had. Stacking also makes the tile NARROWER: "Intermediate" used to
// need ~105px on one line, the column needs ~75. At `sm` the tile is 47px tall
// (30 disc + 4 gap + 13 label). Callers budget their layout around both.
//
// Returns null for an empty level. An unknown level still renders, in the
// muted accent with the beginner glyph (LevelInsignia's fallback).
export function DifficultyTile({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' }) {
  const key = (level ?? '').toLowerCase();
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
  if (!label) return null;
  const accent = LEVEL_ACCENT[key] ?? NEU.muted;
  const disc = size === 'sm' ? 30 : 34;
  const glyph = size === 'sm' ? 21 : 24;
  return (
    <span
      className="inline-flex flex-col items-center flex-shrink-0"
      style={{ gap: 4 }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: disc, height: disc, borderRadius: 9999,
          background: `linear-gradient(150deg, ${accent}26, ${accent}12)`,
          border: `1px solid ${accent}55`,
        }}
      >
        <LevelInsignia level={key} size={glyph} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 700, color: NEU.ink, letterSpacing: '0.01em', lineHeight: '13px' }}>
        {label}
      </span>
    </span>
  );
}

/** The accent of a known level (beginner, intermediate, advanced, expert), or
 *  null for an empty or unrecognised one. For surfaces that tint something
 *  else (a card shadow, a border) in the same hue as the marker. */
export function levelAccent(level: string | null | undefined): string | null {
  return LEVEL_ACCENT[(level ?? '').toLowerCase()] ?? null;
}

export default DifficultyTile;
