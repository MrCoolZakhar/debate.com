'use client';

// Small pieces shared by the delegate's You page sections (5A Committee, 5B
// Delegation): the card title, the soft inset panel and the row hairline.
// Card look, icons and avatars come from ../leaderKit.

import { FONT, INK, INK_SOFT } from '../leaderKit';

/** The ivory inset inside a white card ("You represent", the counts). */
export const SOFT_PANEL = '#F7F3EB';
/** A row of the viewer's own delegation. */
export const MINE_TINT = '#F2F7F3';
export const ROW_LINE = '1px solid #F3EFE6';

/** A card's own title: Title Case, plain sans in ink (CLAUDE.md §8 rule 6). */
export function CardTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h3 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.3, ...style }}>
      {children}
    </h3>
  );
}

/** A small plain label above a block ("Topics", "You represent"). */
export function SmallLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: INK_SOFT }}>{children}</span>;
}
