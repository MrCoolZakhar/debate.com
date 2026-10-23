'use client';

// A seat's party in a live room (custom committees, owner 23 Oct 2026): a small disc in the
// party's colour and its short name ("EPP"), shown beside the seat's name on the chair
// sidebar, the roll call and the delegate phone. Presentational only; nothing here writes.
// Reads `Delegate.groupColor` / `groupShort` (delegates.group_color / group_short, seeded
// with the room). Renders nothing for a seat without a party.

import type { CSSProperties } from 'react';

export default function SeatGroupTag({ short, color, onDark = false, size = 12, style }: {
  short: string | null | undefined;
  color?: string | null;
  /** True on the forest sidebar: the text is light. */
  onDark?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  const label = (short ?? '').trim();
  if (!label) return null;
  const dot = Math.max(7, Math.round(size * 0.75));
  return (
    <span
      className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]"
      style={{ fontSize: size, fontWeight: 700, lineHeight: 1.25, color: onDark ? 'rgba(244,239,227,0.82)' : '#5A5046', ...style }}
    >
      {color && (
        <span
          aria-hidden
          style={{
            width: dot, height: dot, borderRadius: 999, backgroundColor: color, flexShrink: 0,
            boxShadow: onDark ? '0 0 0 1px rgba(255,255,255,0.35)' : '0 0 0 1px rgba(28,20,16,0.14)',
          }}
        />
      )}
      {label}
    </span>
  );
}
