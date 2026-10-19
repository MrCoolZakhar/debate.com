/**
 * A Gavelling MUN reference sheet inside a blog post (owner, 19 Oct 2026: the
 * classic phrase lists every beginner has seen, redrawn plainly). The sheets
 * are drawn by scripts/reference-sheets/render.mjs into public/blog/reference/
 * as a 1600px WebP for the page and a 3200px PNG to download and print.
 * Re-running the script can change a sheet's height: update SHEETS below.
 *
 * Server component, no state. A plain <a download> under the picture.
 */

import Image from 'next/image';

const SHEETS = {
  'preambulatory-phrases': { height: 1082, alt: 'List of preambulatory phrases for Model UN resolutions, from Acknowledging to Welcoming' },
  'operative-phrases': { height: 890, alt: 'List of operative phrases for Model UN resolutions, with the verbs only the Security Council may use marked' },
  motions: { height: 970, alt: 'Table of Model UN motions: what each does, the vote needed and what to say' },
  points: { height: 702, alt: 'Table of Model UN points: personal privilege, order, parliamentary inquiry, information and right of reply' },
  'committee-session-flow': { height: 781, alt: 'The order of a Model UN committee session, from roll call to adjournment' },
  'roll-call-and-voting': { height: 916, alt: 'Model UN roll call and voting terms: Present, Present and Voting, abstain, pass, rights and veto' },
} as const;

export type ReferenceSheetId = keyof typeof SHEETS;

export function ReferenceSheet({ id, caption }: { id: ReferenceSheetId; caption?: string }) {
  const s = SHEETS[id];
  return (
    <figure className="gv-figure">
      <Image
        src={`/blog/reference/${id}.webp`}
        alt={s.alt}
        width={1600}
        height={s.height}
        sizes="(min-width: 640px) 544px, 100vw"
        loading="lazy"
        style={{ border: '1px solid #DDD4C0', borderRadius: 8, background: '#FFFFFF' }}
      />
      <figcaption>
        {caption ? <span className="gv-figure-caption">{caption} </span> : null}
        <a href={`/blog/reference/${id}.png`} download className="font-bold underline underline-offset-2" style={{ color: '#1B3828' }}>
          Download the sheet
        </a>
      </figcaption>
    </figure>
  );
}
