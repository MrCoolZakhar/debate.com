/**
 * A Gavelling MUN reference sheet inside a blog post (owner, 19 Oct 2026: the
 * classic phrase lists every beginner has seen, redrawn plainly). The sheets
 * are drawn by scripts/reference-sheets/render-styled.mjs (the website style,
 * a big word with fitted small words, in public/blog/reference/styled/, as
 * `<id>-stack` for long big words and `<id>-side` for short ones): a 1600px WebP for the page and a 3200px PNG
 * to download. Re-running a script can change a sheet's height: update the
 * heights below.
 *
 * STYLE TEST (19 to 26 Oct 2026), RESULT: the website style won and is now
 * used everywhere; the plain set and its script were deleted. Styled posts
 * got 4 downloads per 98 blog views against 1 per 74 for plain, and in Google
 * Images the styled posts went from 2 clicks / 901 impressions to 4 / 771
 * (clause phrases moved from position 43 to 16), while the plain posts fell
 * from 0 / 108 to 0 / 64. See docs/conferences/growth-loops.md.
 *
 * Server component apart from the download link.
 */

import Image from 'next/image';
import SheetDownloadLink from './SheetDownloadLink';

const SHEETS = {
  'preambulatory-phrases': { stack: 1168, side: 1116, alt: 'List of preambulatory phrases for Model UN resolutions, from Acknowledging to Welcoming' },
  'operative-phrases': { stack: 959, side: 918, alt: 'List of operative phrases for Model UN resolutions, with the verbs only the Security Council may use marked' },
  motions: { stack: 1067, side: 1032, alt: 'Table of Model UN motions: what each does, the vote needed and what to say' },
  points: { stack: 758, side: 727, alt: 'Table of Model UN points: personal privilege, order, parliamentary inquiry, information and right of reply' },
  'committee-session-flow': { stack: 764, side: 721, alt: 'Timeline of a Model UN committee session, from roll call to adjournment' },
  'roll-call-and-voting': { stack: 981, side: 949, alt: 'Model UN roll call and voting terms: Present, Present and Voting, abstain, pass, rights and veto' },
} as const;

export type ReferenceSheetId = keyof typeof SHEETS;
export type ReferenceSheetStyle = 'stack' | 'side';

export function ReferenceSheet({ id, caption, variant }: { id: ReferenceSheetId; caption?: string; variant: ReferenceSheetStyle }) {
  const s = SHEETS[id];
  const base = `/blog/reference/styled/${id}-${variant}`;
  return (
    <figure className="gv-figure">
      <Image
        src={`${base}.webp`}
        alt={s.alt}
        width={1600}
        height={s[variant]}
        sizes="(min-width: 640px) 544px, 100vw"
        loading="lazy"
        style={{ border: '1px solid #DDD4C0', borderRadius: 8, background: '#FFFFFF' }}
      />
      <figcaption>
        {caption ? <span className="gv-figure-caption">{caption} </span> : null}
        <SheetDownloadLink href={`${base}.png`} style="styled" sheet={id} />
      </figcaption>
    </figure>
  );
}
