'use client';

// ============================================================
// src/components/UnknownSeatIcon.tsx
//
// What a seat that is not a country draws when it has no crest: a custom
// speaker ("John Speaker"), a press seat, a cabinet post. A neutral
// unknown-user glyph, never the blue 🌐 emoji it replaced (15 Sep 2026), which
// read as "the world" rather than "a person we have no flag for".
//
// Two shapes, matching the two flag shapes (CLAUDE.md §8):
//   <UnknownSeatIcon size={20} />          a round badge, sized like a flag box
//   <UnknownSeatIcon size={20} bare />     the glyph only, for inside an
//                                          existing disc (CircleFlag's fallback)
// ============================================================

import type { CSSProperties } from 'react';
import { UserRound } from 'lucide-react';

export function UnknownSeatIcon({
  size = 24,
  bare = false,
  className = '',
  style,
  title,
}: {
  /** Box size in px (the flag box it stands in for). */
  size?: number;
  /** Glyph only, no disc (the caller already draws the circle). */
  bare?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const px = Math.max(10, Math.round(size));
  if (bare) {
    return <UserRound size={Math.round(px * 0.58)} strokeWidth={2.25} aria-hidden className={className} style={{ color: '#5F6F64', ...style }} />;
  }
  return (
    <span
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      title={title}
      className={`inline-flex items-center justify-center shrink-0 rounded-full align-middle ${className}`}
      style={{ width: px, height: px, backgroundColor: '#E6DFCE', color: '#5F6F64', boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.12)', ...style }}
    >
      <UserRound size={Math.round(px * 0.6)} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

export default UnknownSeatIcon;
