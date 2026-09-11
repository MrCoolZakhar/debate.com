'use client';

import { useState } from 'react';

// A committee topic that shows at most `max` characters, cut at a word
// boundary with an ellipsis, and a small inline toggle that expands it in
// place. Topics can be up to 150 characters in the editor (and older ones are
// longer still), which is too much for a 298px card.
//
// Renders inline so it can sit inside the caller's own text span and inherit
// its font, size and colour. Only the toggle is styled here.

/** Cut `text` to at most `max` characters at the last word boundary, then add
 *  an ellipsis. Falls back to a hard cut when the only boundary would throw
 *  away most of the text (one very long word). Trailing punctuation is dropped
 *  so the ellipsis never follows a comma or a colon. */
export function truncateAtWord(text: string, max: number): string {
  // Code points, not UTF-16 units, so a hard cut never splits an emoji in half.
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  // One extra character, so a word that ends exactly at `max` is kept whole.
  const window = chars.slice(0, max + 1).join('');
  const lastSpace = window.lastIndexOf(' ');
  const cut = lastSpace >= Math.floor(max * 0.6) ? window.slice(0, lastSpace) : chars.slice(0, max).join('');
  return `${cut.replace(/[\s.,;:!?\-–—(]+$/, '')}…`;
}

export function TruncatedTopic({ text, max = 75 }: { text: string; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (Array.from(text).length <= max) return <>{text}</>;
  // Collapsed, the full topic is still in the HTML (screen-reader only): the public
  // conference page is an SEO landing page and the cut text is presentation.
  return (
    <>
      {expanded ? text : (
        <>
          <span aria-hidden="true">{truncateAtWord(text, max)}</span>
          <span className="sr-only">{text}</span>
        </>
      )}{' '}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline whitespace-nowrap rounded-sm align-baseline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[color:var(--gv-main,#1B3828)]"
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '11.5px',
          fontWeight: 700,
          color: 'var(--gv-main, #1B3828)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationColor: 'color-mix(in srgb, var(--gv-main, #1B3828) 35%, transparent)',
          textUnderlineOffset: 3,
        }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </>
  );
}

export default TruncatedTopic;
