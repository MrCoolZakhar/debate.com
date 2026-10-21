'use client';

// One small document tile in "Your Seat" (owner, 21 Oct 2026: the study guide
// and the position paper side by side in ONE line, two small equal tiles):
// a thin Lucide icon, the name, the date small beneath, one action. Drawn by
// SeatCard's GuideTile and PositionPaperCard's tile variant; two of them sit in
// a two-column grid, so they are always the same width and height.

import type { LucideIcon } from 'lucide-react';
import { BTN_CLASS, FONT, INK, INK_SOFT, STROKE } from '../leaderKit';

const TILE_LINE = 'color-mix(in srgb, var(--gv-main) 12%, transparent)';

/** The tile's one action: a small button in the conference's colour, icon first. */
export function TileAction({ Icon, label, onClick, busy, tone = 'main' }: {
  Icon?: LucideIcon;
  label: string;
  onClick: () => void;
  busy?: boolean;
  /** 'done' reads as a state (Submitted) yet still opens the paper. */
  tone?: 'main' | 'done';
}) {
  const done = tone === 'done';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className={`${BTN_CLASS} inline-flex items-center gap-1.5 rounded-lg text-left [overflow-wrap:anywhere]`}
      style={{
        minHeight: 34, padding: '0 12px', border: done ? '1px solid color-mix(in srgb, #1F6B45 28%, transparent)' : 'none',
        background: done ? '#FFFFFF' : 'var(--gv-main)', color: done ? '#1F6B45' : 'var(--gv-on-main)',
        fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
      }}
    >
      {Icon && <Icon size={15} strokeWidth={STROKE} aria-hidden />}
      {label}
    </button>
  );
}

export default function DocTile({ Icon, title, line, lineColor, action }: {
  Icon: LucideIcon;
  title: string;
  /** The deadline or release date, small beneath the name. */
  line: React.ReactNode;
  lineColor?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 min-w-0 h-full"
      style={{ padding: '14px 14px 12px', borderRadius: 14, border: `1px solid ${TILE_LINE}`, background: '#FFFFFF' }}
    >
      <Icon size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK }} />
      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK, marginTop: 6, lineHeight: 1.3 }}>
        {title}
      </span>
      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: lineColor ?? INK_SOFT, lineHeight: 1.4, minHeight: 17 }}>
        {line}
      </span>
      {action && <div className="mt-auto pt-2 flex flex-wrap gap-1.5">{action}</div>}
    </div>
  );
}
