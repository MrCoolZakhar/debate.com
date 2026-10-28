'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FloorModeHeader: the mode marker at the top of the chair's floor (Oct 2026, owner).
//
// ONE component for the General Speakers' List and all four caucus kinds (moderated,
// unmoderated, Consultation of the Whole, Tour de Table), on the Moderator's floor and the
// Commenter's floor alike, so they are drawn identically and only the values differ:
//   line 1: the bare icon, the motion's name at the GSL size, then who raised it (the round
//           flag only, 22 Oct 2026, owner; the name is the flag's tooltip);
//   line 2: the motion's topic, much larger, wrapping to at most two lines. The topic is
//           clipped after two lines, never given an ellipsis; the full topic is its title.
//           Up to 84rem wide (22 Oct 2026, owner): most topics take one line, which gives the
//           floor below its height back.
// The GSL passes no `detail`, so it keeps its one line exactly as before.
// Presentational only: no state, no writes.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

/** Where the floor is right now: the mode marker above the flags, a plain icon and a name. */
export type StripHeader = {
  /** Lucide glyph drawn bare beside the name (no disc). */
  icon?: ReactNode;
  /** "General Speaker's List", or the motion's own name. */
  label: string;
  /** The motion's topic, drawn large on its own line under the name. Omitted on the GSL. */
  detail?: string | null;
  /** On the same line after the name: who raised the caucus (CaucusProposer, Oct 2026).
   *  Never truncated: the motion name gives way first. */
  trailing?: ReactNode;
};

/** Two lines of the topic at TOPIC_LINE_HEIGHT; anything past them is clipped, not ellipsised. */
const TOPIC_LINE_HEIGHT = 1.2;

export default function FloorModeHeader({ header, className = '' }: { header: StripHeader; className?: string }) {
  const detail = header.detail?.trim() || null;
  return (
    <div className={`flex flex-col items-center mb-1.5 px-4 max-w-full ${className}`} style={{ color: '#1B3828' }}>
      <div className="flex items-center justify-center gap-2 max-w-full">
        {header.icon && <span aria-hidden className="shrink-0 inline-flex">{header.icon}</span>}
        <span className="min-w-0 truncate text-[15px] tracking-tight font-black" title={header.label}>
          {header.label}
        </span>
        {header.trailing && <span className="shrink-0 max-w-[50%] flex items-center gap-2"><span aria-hidden style={{ color: '#9A8A78' }}>·</span>{header.trailing}</span>}
      </div>
      {detail && (
        <p
          title={detail}
          className="mt-1 text-center font-semibold tracking-tight [overflow-wrap:anywhere]"
          style={{
            color: '#1C1410',
            fontSize: 'clamp(22px, 2vw, 32px)',
            lineHeight: TOPIC_LINE_HEIGHT,
            maxHeight: `${TOPIC_LINE_HEIGHT * 2}em`,
            overflow: 'hidden',
            maxWidth: 'min(100%, 84rem)',
            textWrap: 'balance',
          }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
