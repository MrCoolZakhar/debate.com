/**
 * GuidePlate: the cover drawing on a blog card, and the hero of an article.
 *
 * WHY A DRAWING AND NOT A PHOTOGRAPH
 *
 * The rulebook (docs/ui-audit/00-DESIGN-RULEBOOK.md §1) wants imagery and calls
 * a page with no pictures a failure, and §8 names the blog's missing images as
 * the second-worst thing on the public site. But a stock photo of a lecture
 * hall is not imagery, it is filler: it carries a licence, a credit line, a few
 * hundred kilobytes and somebody else's colour grading, and 34 posts would need
 * 34 of them, with 50 more coming. So the cover is DRAWN, from the product's
 * own vocabulary: a gavel and its knock, the motion ladder, a delegation at the
 * podium, a floor of committee rooms, two software panels, a tally, a draft
 * resolution and its seal.
 *
 * Consequences worth knowing: no network request, no licence, no attribution,
 * about 1 KB of inline SVG, it repaints with a themed conference's colours
 * because it is drawn in the shelf accent, and it is legible at 320 px wide.
 *
 * Every drawing varies with the post's slug (`seedFor`) so a shelf of twelve
 * guides is twelve pictures and not one picture twelve times, and the variation
 * is a hash, never a random, so the server and the client draw the same thing.
 *
 * Purely presentational: props in, SVG out, no state, no effect, no request.
 */

import { articles, type BlogCategory } from '@/app/blog/posts';
import { SHELVES, seedFor, motifFor } from './blogTaxonomy';

type Tone = 'light' | 'deep';

const GOLD = '#EED98A';
const GOLD_DEEP = '#B6871F';
const FOREST = '#1B3828';
const FOREST_MID = '#2A5A3C';
const CREAM = '#F6F1E7';

interface Ink {
  /** The ground the drawing sits on. */
  ground: string;
  /** Primary line work. */
  line: string;
  /** Quiet line work: the things that recede. */
  faint: string;
  /** The one element that is the focal point. */
  focus: string;
  /** Fill behind the focal point. */
  focusFill: string;
}

/** Hex to rgba. Deliberately NOT `color-mix()`: these values land in SVG
 *  presentation attributes (`stroke`, `fill`), where CSS colour functions are
 *  not reliably parsed, and a paint the browser cannot read draws BLACK. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function inkFor(accent: string, tone: Tone): Ink {
  return tone === 'deep'
    ? {
        ground: FOREST,
        line: alpha(GOLD, 0.62),
        faint: alpha(GOLD, 0.24),
        focus: GOLD,
        focusFill: alpha(GOLD, 0.2),
      }
    : {
        ground: CREAM,
        line: accent,
        faint: alpha(accent, 0.32),
        focus: GOLD_DEEP,
        focusFill: alpha(GOLD_DEEP, 0.16),
      };
}

// ── The motifs ──────────────────────────────────────────────────────────────
// Each draws inside a 400 x 250 box and reads down to about 150 px wide.

/** Chairing: the gavel and the knock it makes. */
function Gavel({ ink, seed }: { ink: Ink; seed: number }) {
  const rings = 2 + (seed % 3); // 2, 3 or 4 rings of sound
  const tilt = -28 + (seed % 2) * 8;
  return (
    <g>
      {/* the block the gavel strikes */}
      <rect x="150" y="176" width="100" height="16" rx="6" fill={ink.focusFill} stroke={ink.focus} strokeWidth="2.5" />
      {/* the knock */}
      {Array.from({ length: rings }, (_, i) => (
        <path
          key={i}
          d={`M ${186 - i * 26} ${162 - i * 16} Q 200 ${150 - i * 22} ${214 + i * 26} ${162 - i * 16}`}
          fill="none"
          stroke={ink.faint}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      <g transform={`rotate(${tilt} 200 120)`}>
        {/* head */}
        <rect x="150" y="96" width="100" height="42" rx="13" fill="none" stroke={ink.line} strokeWidth="3" />
        <line x1="176" y1="96" x2="176" y2="138" stroke={ink.line} strokeWidth="2.5" />
        <line x1="224" y1="96" x2="224" y2="138" stroke={ink.line} strokeWidth="2.5" />
        {/* handle */}
        <rect x="194" y="138" width="13" height="74" rx="6" fill="none" stroke={ink.line} strokeWidth="3" />
      </g>
    </g>
  );
}

/** Procedure: the motion ladder, most disruptive on top. */
function Ladder({ ink, seed }: { ink: Ink; seed: number }) {
  const rows = 5 + (seed % 2);
  const hot = seed % rows;
  return (
    <g>
      {Array.from({ length: rows }, (_, i) => {
        const y = 58 + i * (150 / rows);
        const w = 232 - i * 22;
        const on = i === hot;
        return (
          <g key={i}>
            <circle
              cx="88"
              cy={y}
              r="9"
              fill={on ? ink.focusFill : 'none'}
              stroke={on ? ink.focus : ink.faint}
              strokeWidth="2.5"
            />
            <rect
              x="110"
              y={y - 9}
              width={w}
              height="18"
              rx="9"
              fill={on ? ink.focusFill : 'none'}
              stroke={on ? ink.focus : ink.faint}
              strokeWidth={on ? 2.5 : 2}
            />
          </g>
        );
      })}
      <line x1="88" y1="44" x2="88" y2="214" stroke={ink.line} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/**
 * Delegates: a delegation on the floor, the rest of the room behind.
 *
 * This is the drawing that repeats most (the delegate shelf is the biggest), so
 * it varies the most: the room sits above or below, the speaker moves along the
 * floor and changes size, and the number of seats and of voice arcs both shift.
 * Four bits out of one hash, which is enough that two of these never read as
 * the same picture at card size.
 */
function Podium({ ink, seed }: { ink: Ink; seed: number }) {
  const behind = 4 + (seed % 3);
  const roomOnTop = seed % 2 === 0;
  const arcs = 2 + (seed % 3);
  const r = 36 + (seed % 3) * 5;
  const cx = 130 + (seed % 4) * 16;
  const cy = roomOnTop ? 152 : 112;
  const roomY = roomOnTop ? 66 : 206;
  const daisY = roomOnTop ? 214 : 176;
  return (
    <g>
      {/* the room, receding */}
      {Array.from({ length: behind }, (_, i) => (
        <circle key={i} cx={64 + i * 44} cy={roomY} r="17" fill="none" stroke={ink.faint} strokeWidth="2.5" />
      ))}
      {/* the one holding the floor */}
      <circle cx={cx} cy={cy} r={r} fill={ink.focusFill} stroke={ink.focus} strokeWidth="3" />
      <circle cx={cx} cy={cy - 12} r="12" fill="none" stroke={ink.focus} strokeWidth="2.5" />
      <path
        d={`M ${cx - 19} ${cy + 20} Q ${cx} ${cy + 4} ${cx + 19} ${cy + 20}`}
        fill="none"
        stroke={ink.focus}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* the voice */}
      {Array.from({ length: arcs }, (_, i) => (
        <path
          key={i}
          d={`M ${cx + r + 16 + i * 20} ${cy - 20 - i * 12} Q ${cx + r + 30 + i * 20} ${cy} ${cx + r + 16 + i * 20} ${cy + 20 + i * 12}`}
          fill="none"
          stroke={i === 0 ? ink.line : ink.faint}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {/* the dais rule */}
      <line x1="48" y1={daisY} x2="352" y2={daisY} stroke={ink.line} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** Organisers: a floor of committee rooms, one of them live. */
function Rooms({ ink, seed }: { ink: Ink; seed: number }) {
  const hot = seed % 6;
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const on = i === hot;
        return (
          <g key={i}>
            <rect
              x={66 + col * 96}
              y={64 + row * 84}
              width="80"
              height="68"
              rx="12"
              fill={on ? ink.focusFill : 'none'}
              stroke={on ? ink.focus : ink.faint}
              strokeWidth={on ? 3 : 2}
            />
            <line
              x1={80 + col * 96}
              y1={86 + row * 84}
              x2={116 + col * 96}
              y2={86 + row * 84}
              stroke={on ? ink.focus : ink.faint}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={96 + col * 96} cy={112 + row * 84} r="9" fill="none" stroke={on ? ink.focus : ink.faint} strokeWidth="2.5" />
            <circle cx={120 + col * 96} cy={112 + row * 84} r="9" fill="none" stroke={on ? ink.focus : ink.faint} strokeWidth="2.5" />
          </g>
        );
      })}
      <line x1="40" y1="40" x2="360" y2="40" stroke={ink.line} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={40 + (seed % 5) * 20} cy="40" r="7" fill={ink.focus} />
    </g>
  );
}

/** Software: two panels, one of them ours. */
function Panels({ ink, seed }: { ink: Ink; seed: number }) {
  const rows = 4;
  const hot = seed % rows;
  return (
    <g>
      {/* the other one, behind */}
      <rect x="44" y="46" width="180" height="150" rx="16" fill="none" stroke={ink.faint} strokeWidth="2" />
      {Array.from({ length: rows }, (_, i) => (
        <line
          key={i}
          x1="66"
          y1={82 + i * 30}
          x2={184 - (i % 2) * 34}
          y2={82 + i * 30}
          stroke={ink.faint}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      {/* ours, in front */}
      <rect x="176" y="72" width="180" height="150" rx="16" fill={ink.ground} stroke={ink.line} strokeWidth="3" />
      {Array.from({ length: rows }, (_, i) => {
        const on = i === hot;
        return (
          <g key={i}>
            <circle cx="202" cy={108 + i * 30} r="7" fill={on ? ink.focus : 'none'} stroke={on ? ink.focus : ink.faint} strokeWidth="2.5" />
            <line
              x1="220"
              y1={108 + i * 30}
              x2={330 - (i % 2) * 30}
              y2={108 + i * 30}
              stroke={on ? ink.focus : ink.line}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}

/** Procedure: the count. Three bars, one of them decisive. */
function Ballot({ ink, seed }: { ink: Ink; seed: number }) {
  // Heights that add up differently per post, so no two tallies look alike.
  const shapes = [
    [128, 86, 46],
    [96, 128, 58],
    [142, 70, 96],
    [72, 112, 134],
  ][seed % 4];
  const hot = shapes.indexOf(Math.max(...shapes));
  return (
    <g>
      {shapes.map((h, i) => {
        const on = i === hot;
        return (
          <rect
            key={i}
            x={112 + i * 66}
            y={206 - h}
            width="48"
            height={h}
            rx="10"
            fill={on ? ink.focusFill : 'none'}
            stroke={on ? ink.focus : ink.faint}
            strokeWidth={on ? 3 : 2}
          />
        );
      })}
      <line x1="86" y1="206" x2="330" y2="206" stroke={ink.line} strokeWidth="2.5" strokeLinecap="round" />
      {/* the placard raised above the winning column */}
      <rect
        x={118 + hot * 66}
        y={206 - shapes[hot] - 42}
        width="36"
        height="26"
        rx="7"
        fill="none"
        stroke={ink.focus}
        strokeWidth="2.5"
      />
      <line
        x1={136 + hot * 66}
        y1={206 - shapes[hot] - 16}
        x2={136 + hot * 66}
        y2={206 - shapes[hot] - 6}
        stroke={ink.focus}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Papers: a draft resolution, clause by clause, with its seal. */
function Paper({ ink, seed }: { ink: Ink; seed: number }) {
  const clauses = 5 + (seed % 2);
  const tilt = (seed % 3) - 1;
  return (
    <g transform={`rotate(${tilt * 2.5} 200 125)`}>
      {/* the sheet behind */}
      <rect x="96" y="34" width="176" height="186" rx="14" fill="none" stroke={ink.faint} strokeWidth="2" />
      {/* the sheet in front */}
      <rect x="126" y="46" width="176" height="186" rx="14" fill={ink.ground} stroke={ink.line} strokeWidth="3" />
      {/* the preamble, italic-looking: a short indented run */}
      <line x1="150" y1="78" x2="236" y2="78" stroke={ink.line} strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: clauses }, (_, i) => (
        <g key={i}>
          <circle cx="152" cy={108 + i * 21} r="3.5" fill={ink.faint} />
          <line
            x1="166"
            y1={108 + i * 21}
            x2={278 - (i % 3) * 26}
            y2={108 + i * 21}
            stroke={ink.faint}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* the seal */}
      <circle cx="268" cy="206" r="21" fill={ink.focusFill} stroke={ink.focus} strokeWidth="2.5" />
      <path d="M 259 206 l 6 7 l 12 -14" fill="none" stroke={ink.focus} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

const MOTIF = {
  gavel: Gavel,
  ladder: Ladder,
  podium: Podium,
  rooms: Rooms,
  panels: Panels,
  ballot: Ballot,
  paper: Paper,
};

export default function GuidePlate({
  category,
  slug,
  tone = 'light',
  bare = false,
  className,
  style,
}: {
  category: BlogCategory;
  /** Decides the variation. Same slug, same drawing, every time and everywhere. */
  slug: string;
  tone?: Tone;
  /**
   * Skip the ground and draw only the line work.
   *
   * For the lead card, whose own gradient runs across the WHOLE card: painting
   * a second gradient here restarted it at the drawing's edge and left a hard
   * vertical seam down the middle of the card. Bare, the card's gradient simply
   * continues under the drawing.
   */
  bare?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shelf = SHELVES[category];
  const ink = inkFor(shelf.accent, tone);
  // WHICH drawing comes from the post's position on its shelf (so a shelf
  // alternates cleanly), HOW it varies comes from a hash of the slug (so two
  // posts with the same drawing still differ). See motifFor() for why the
  // choice is not hashed as well.
  const seed = seedFor(slug, 12);
  const Motif = MOTIF[motifFor({ slug, category }, articles)];
  const gid = `gp-${category}-${tone}`;

  return (
    <svg
      viewBox="0 0 400 250"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          {tone === 'deep' ? (
            <>
              <stop offset="0%" stopColor={FOREST_MID} />
              <stop offset="100%" stopColor={FOREST} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={CREAM} />
              <stop offset="100%" stopColor={shelf.wash} />
            </>
          )}
        </linearGradient>
      </defs>
      {!bare && <rect width="400" height="250" fill={`url(#${gid})`} />}
      {/* a quiet corner arc, the editorial detail that stops it reading as clip art */}
      <path d="M 400 0 A 150 150 0 0 1 250 150" fill="none" stroke={ink.faint} strokeWidth="1.5" opacity="0.7" />
      <Motif ink={ink} seed={seed} />
    </svg>
  );
}
