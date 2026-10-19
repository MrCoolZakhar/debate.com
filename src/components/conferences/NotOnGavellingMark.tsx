// "Not on Gavelling yet": the one mark a Gavelling listing carries (a conference we list from its
// own public website, `conferences.listed_by = 'gavelling'`; src/lib/listings.ts). An icon and
// words, never a pill (CLAUDE.md §8 rule 9). Pure presentation, safe on the server and the client.

import { CircleDashed } from 'lucide-react';

const FONT = "var(--font-brand), sans-serif";

export const NOT_ON_GAVELLING = 'Not on Gavelling yet';

export function NotOnGavellingMark({ tone = 'light', size = 'sm', style }: {
  /** The ground it sits on: 'dark' over a photo or the hero scrim. */
  tone?: 'light' | 'dark';
  /** xs: the quiet line on cards and list rows; sm: lists; md: the conference page. */
  size?: 'xs' | 'sm' | 'md';
  style?: React.CSSProperties;
}) {
  const fs = size === 'xs' ? 10.5 : size === 'sm' ? 11.5 : 13;
  const icon = size === 'xs' ? 11 : size === 'sm' ? 12 : 14;
  return (
    <span
      title="Listed by Gavelling from the conference's public website. Applications happen on their website."
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: FONT, fontWeight: 600, fontSize: fs, lineHeight: 1.2, whiteSpace: 'nowrap',
        color: tone === 'dark' ? 'rgba(255,255,255,0.88)' : '#5A4E44',
        ...style,
      }}
    >
      <CircleDashed size={icon} strokeWidth={2.2} aria-hidden />
      {NOT_ON_GAVELLING}
    </span>
  );
}
