'use client';

// One small document tile in "Your Seat" (owner, 21 Oct 2026): the study guide
// and the position paper, drawn SIDE BY SIDE in two columns (stacked on a
// narrow card). Compact: a thin Lucide icon, the name with the date small
// beneath, then a QUIET action on the right (owner, 21 Oct 2026: "not a big
// green button"): its icon with a small grey word right under it (Open for the
// guide, Upload or Submitted for the paper). Drawn by SeatCard's GuideTile and
// PositionPaperCard's tile variant.

import type { LucideIcon } from 'lucide-react';
import { BTN_CLASS, FONT, INK, INK_SOFT, STROKE } from '../leaderKit';

const TILE_LINE = 'color-mix(in srgb, var(--gv-main) 12%, transparent)';

/** The tile's one action, quiet: the icon with a small grey word beneath. */
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
      className={`${BTN_CLASS} inline-flex flex-col items-center justify-center gap-0.5 rounded-[10px] text-center [overflow-wrap:anywhere]`}
      style={{
        minHeight: 44, minWidth: 48, maxWidth: 96, padding: '4px 6px', border: 'none', background: 'transparent',
        cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
      }}
    >
      {Icon && <Icon size={20} strokeWidth={STROKE} aria-hidden style={{ color: done ? '#1F6B45' : 'var(--gv-main)' }} />}
      <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, color: done ? '#1F6B45' : INK_SOFT, lineHeight: 1.2 }}>{label}</span>
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
      className="flex items-center gap-2.5 min-w-0"
      style={{ padding: '6px 6px 6px 12px', borderRadius: 14, border: `1px solid ${TILE_LINE}`, background: '#FFFFFF', minHeight: 56 }}
    >
      <Icon size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.25 }}>
          {title}
        </span>
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: lineColor ?? INK_SOFT, lineHeight: 1.35 }}>
          {line}
        </span>
      </div>
      {action && <div className="flex-none flex flex-col items-center">{action}</div>}
    </div>
  );
}
