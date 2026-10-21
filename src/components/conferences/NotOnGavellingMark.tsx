// "Added by Gavelling": the one mark a Gavelling listing carries (a conference we list from its
// own public website, `conferences.listed_by = 'gavelling'`; src/lib/listings.ts). The gavel mark
// and words, never a pill (CLAUDE.md §8 rule 9); owner, 21 Oct 2026, in place of "Not on
// Gavelling yet". Pure presentation, safe on the server and the client.

const FONT = "var(--font-brand), sans-serif";

export const NOT_ON_GAVELLING = 'Added by Gavelling';

export function NotOnGavellingMark({ tone = 'light', size = 'sm', style }: {
  /** The ground it sits on: 'dark' over a photo or the hero scrim. */
  tone?: 'light' | 'dark';
  /** xs: the quiet line on cards and list rows; sm: lists; md: the conference page. */
  size?: 'xs' | 'sm' | 'md';
  style?: React.CSSProperties;
}) {
  const fs = size === 'xs' ? 10.5 : size === 'sm' ? 11.5 : 13;
  const mark = size === 'xs' ? 15 : size === 'sm' ? 17 : 20;
  const dark = tone === 'dark';
  return (
    <span
      title="Added by Gavelling from the conference's public website. Applications happen on their website."
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: FONT, fontWeight: 600, fontSize: fs, lineHeight: 1.2, whiteSpace: 'nowrap',
        color: dark ? 'rgba(255,255,255,0.92)' : '#5A4E44',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: mark + (dark ? 4 : 0), height: mark + (dark ? 4 : 0), borderRadius: '50%',
          background: dark ? 'rgba(255,255,255,0.92)' : 'transparent',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static brand mark, also rendered on the server */}
        <img src="/gavelling-mark.png" alt="" width={mark} height={mark} style={{ display: 'block', width: mark, height: mark }} />
      </span>
      {NOT_ON_GAVELLING}
    </span>
  );
}
