'use client';

// One small document tile in "Your Seat" (owner, 21 Oct 2026): the study guide
// and the position paper. Compact and on ONE row (owner, 21 Oct 2026: "the
// action is one big button right next to the text"): a thin Lucide icon, the
// name with the date small beneath, then ONE big button to the right on the
// same row (Open for the guide, Upload or Submitted for the paper). Drawn by
// SeatCard's GuideTile and PositionPaperCard's tile variant.

import type { LucideIcon } from 'lucide-react';
import { BTN_CLASS, FONT, INK, INK_SOFT, STROKE } from '../leaderKit';

const TILE_LINE = 'color-mix(in srgb, var(--gv-main) 12%, transparent)';

/** The tile's one action: a big button in the conference's colour, icon first. */
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
      className={`${BTN_CLASS} inline-flex items-center justify-center gap-2 rounded-[10px] text-left [overflow-wrap:anywhere]`}
      style={{
        minHeight: 44, minWidth: 112, padding: '0 16px', border: done ? '1px solid color-mix(in srgb, #1F6B45 28%, transparent)' : 'none',
        background: done ? '#FFFFFF' : 'var(--gv-main)', color: done ? '#1F6B45' : 'var(--gv-on-main)',
        fontFamily: FONT, fontSize: 15, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
      }}
    >
      {Icon && <Icon size={18} strokeWidth={STROKE} aria-hidden />}
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
      className="flex items-center gap-3 min-w-0"
      style={{ padding: '10px 10px 10px 14px', borderRadius: 14, border: `1px solid ${TILE_LINE}`, background: '#FFFFFF', minHeight: 64 }}
    >
      <Icon size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
          {title}
        </span>
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: lineColor ?? INK_SOFT, lineHeight: 1.35 }}>
          {line}
        </span>
      </div>
      {action && <div className="flex-none flex flex-col items-end gap-1.5">{action}</div>}
    </div>
  );
}
