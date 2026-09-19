'use client';

/**
 * ResultBackdrop: a muted GIF behind the result card on /voting/[code] (owner, 17 Sep 2026:
 * "Add 3 different GIFs to the final voting page, from GIPHY. Not cringe, funny and slightly
 * serious. In the background of the Failed and Approved rectangle. A different one for
 * Approved, Failed and Vetoed.").
 *
 * The three were picked once through the GIPHY search API (rating g) and are hardcoded here,
 * so the page never calls the API and never needs the key:
 *   passed  3fiimcA0K0ifzoL7FF  a standing ovation (Film Independent Spirit Awards)
 *   failed  jPFrxnj14Wv5IKV12T  Abraham Lincoln shaking his head: no (owner, 17 Sep 2026:
 *                               "change the GIF of a failed vote". It replaced SpongeBob's
 *                               "back to the drawing board", xTeV7ycHGuPnKX92cE)
 *   vetoed  ur8pcK1C73Lqw       Schoolhouse Rock's Bill, the classic civics lesson in a bill
 *                               that does not become law
 *   unanimous VCkClTdwnFRqAIPl2r a TV judge (Hot Bench) taking off his glasses: "It's
 *                               unanimous." (owner, 18 Sep 2026: a different GIF and screen
 *                               when the vote is unanimous; picked the same way, rating g)
 *
 * Rendering: the animated WebP drawn `object-fit: cover` at GIF_OPACITY (0.58), desaturated, under a wash
 * of the card's own colour so the verdict, the counts and the notes stay readable (the text
 * sits above in its own layer). Under prefers-reduced-motion the `<picture>` source serves the
 * STILL frame instead, so nothing moves. "Powered by GIPHY" sits small in the corner, as
 * GIPHY's terms require. Decorative: empty alt, aria-hidden.
 *
 * PRIVACY: the files load from GIPHY's CDN (media.giphy.com) in the viewer's browser, so the
 * viewer's IP address and user agent reach GIPHY whenever a result is on screen. The request
 * is sent with no referrer. See AGENTS.md FEATURE: VOTING PAGE.
 */

export type ResultKind = 'passed' | 'failed' | 'vetoed' | 'unanimous';

const MEDIA = 'https://media.giphy.com/media';
/** 0.5 until 18 Sep 2026 (owner: "slightly less transparent, ever so slightly"). */
const GIF_OPACITY = 0.58;

export const RESULT_GIFS: Record<ResultKind, { id: string; animated: string; still: string }> = {
  passed: { id: '3fiimcA0K0ifzoL7FF', animated: `${MEDIA}/3fiimcA0K0ifzoL7FF/giphy.webp`, still: `${MEDIA}/3fiimcA0K0ifzoL7FF/480w_s.jpg` },
  failed: { id: 'jPFrxnj14Wv5IKV12T', animated: `${MEDIA}/jPFrxnj14Wv5IKV12T/giphy.webp`, still: `${MEDIA}/jPFrxnj14Wv5IKV12T/480w_s.jpg` },
  vetoed: { id: 'ur8pcK1C73Lqw', animated: `${MEDIA}/ur8pcK1C73Lqw/giphy.webp`, still: `${MEDIA}/ur8pcK1C73Lqw/480w_s.jpg` },
  unanimous: { id: 'VCkClTdwnFRqAIPl2r', animated: `${MEDIA}/VCkClTdwnFRqAIPl2r/giphy.webp`, still: `${MEDIA}/VCkClTdwnFRqAIPl2r/480w_s.jpg` },
};

export function ResultBackdrop({ kind, tint }: { kind: ResultKind; /** The card's colour, washed over the GIF. */ tint: string }) {
  const gif = RESULT_GIFS[kind];
  return (
    <>
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet={gif.still} />
          {/* A plain <img>: a third-party animated WebP that next/image would proxy and re-encode. */}
          <img
            key={gif.id}
            src={gif.animated}
            alt=""
            referrerPolicy="no-referrer"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: GIF_OPACITY, filter: 'saturate(0.55) contrast(0.95)' }}
          />
        </picture>
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${tint}D9 0%, ${tint}B8 45%, ${tint}E6 100%)` }}
        />
      </div>
      <span
        className="absolute bottom-2 end-3 text-[10px] font-semibold tracking-[0.02em] pointer-events-none select-none"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        Powered by GIPHY
      </span>
    </>
  );
}
