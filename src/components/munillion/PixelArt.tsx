'use client';

// Pixel art for MUNillion (/games): the award icons for each score and the
// desk scene where a delegate's hand raises their placard higher the more
// points they have. Drawn as SVG squares from small text grids, so it stays
// crisp at any size and needs no image files.

import type { CSSProperties } from 'react';
import type { TierValue } from '@/lib/munillion';

const PALETTE: Record<string, string> = {
  k: '#1C1410', // outline (ink)
  g: '#EED98A', // gold
  G: '#C9A84A', // deep gold
  w: '#8A6238', // wood
  W: '#5A3C22', // dark wood
  r: '#4C7BB8', // ribbon
  R: '#2F5487', // dark ribbon
  m: '#E6EAEC', // silver
  M: '#9AA4AE', // silver shade
  e: '#7BC9A0', // green
  E: '#3E8F66', // dark green
  p: '#FBF7EC', // paper
  P: '#D8CFB8', // paper shade
  l: '#A99E86', // paper lines
  c: '#9AA3AD', // chair
  C: '#5F6974', // chair shade
  s: '#E7B48A', // skin
  S: '#C08A5E', // skin shade
  b: '#2D3E57', // sleeve
  B: '#1F2C40', // sleeve shade
  u: '#FFFFFF', // cuff
  f: '#1B3828', // forest
};

type Grid = string[];

const GAVEL: Grid = [
  '................',
  '..kkkkkkkk......',
  '.kggggggGGk.....',
  'kggggggggGGk....',
  'kggggggggGGk....',
  '.kggggggGGk.....',
  '..kkkwwkkk......',
  '.....kwWk.......',
  '......kwWk......',
  '.......kwWk.....',
  '........kwWk....',
  '.........kwWk...',
  '..........kkk...',
  '.kkkkkkkkk......',
  'kWwwwwwwwWk.....',
  'kkkkkkkkkkk.....',
];

const TROPHY: Grid = [
  '................',
  '...kkkkkkkkkk...',
  '.kkkggggggggGkk.',
  'kgk.kgggggggGk.k',
  'kgk.kgggggggGkGk',
  '.kgkkgggggggGkk.',
  '..kkkgggggggGk..',
  '....kgggggggk...',
  '.....kgggggk....',
  '......kgGGk.....',
  '......kgGGk.....',
  '.....kggGGGk....',
  '....kkkkkkkkk...',
  '....kWwwwwwWk...',
  '....kWwwwwwWk...',
  '....kkkkkkkkk...',
];

const MEDAL: Grid = [
  '..kkk......kkk..',
  '..krrk....kRRk..',
  '...krrk..kRRk...',
  '....krrkkRRk....',
  '.....krrRRk.....',
  '......kkkk......',
  '.....kmmmmk.....',
  '....kmmmmmMk....',
  '...kmmmmmmmMk...',
  '...kmmmggmmMk...',
  '...kmmggggmMk...',
  '...kmmmggmmMk...',
  '...kmmmmmmMMk...',
  '....kmmmmMMk....',
  '.....kMMMMk.....',
  '......kkkk......',
];

const ROSETTE: Grid = [
  '......kkkk......',
  '....kkeeeekk....',
  '...keeEeeEeek...',
  '..keEeeeeeeEek..',
  '..keeekkkkeeek..',
  '.keeekggggkeeek.',
  '.keEkggggggkEek.',
  '.keekggggggkeek.',
  '.keEkggggggkEek.',
  '.keeekggggkeeek.',
  '..keeekkkkeeek..',
  '..keEeeeeeeEek..',
  '...kkeeEeeekk...',
  '....kEEk.kEEk...',
  '...kEEk...kEEk..',
  '...kkk.....kkk..',
];

const CERTIFICATE: Grid = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kppppppppppppk.',
  '.kpllllllllllpk.',
  '.kppppppppppppk.',
  '.kplllllllllpPk.',
  '.kppppppppppppk.',
  '.kplllllllppPPk.',
  '.kppppppppppppk.',
  '.kpllllpppggpPk.',
  '.kpppppppggggPk.',
  '.kppppppppggPPk.',
  '.kPPPPPPPPPPPPk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];

const EMPTY_CHAIR: Grid = [
  '................',
  '....kkkkkkkk....',
  '....kcccccCk....',
  '....kcccccCk....',
  '....kcccccCk....',
  '....kcccccCk....',
  '...kkkkkkkkkk...',
  '...kccccccccCk..',
  '...kCCCCCCCCCk..',
  '...kkkkkkkkkkk..',
  '...kc......kc...',
  '...kc......kc...',
  '...kc......kc...',
  '...kk......kk...',
  '................',
  '................',
];

const PLUS: Grid = [
  '..kkkk..',
  '..kggk..',
  'kkkggkkk',
  'kggggggk',
  'kggggggk',
  'kkkggkkk',
  '..kggk..',
  '..kkkk..',
];

const FIST: Grid = [
  '..kkkkkkk.',
  '.ksssssssk',
  'ksSsSsSsSk',
  'ksssssssSk',
  'ksssssssSk',
  '.ksssssSSk',
  '..kuuuuuuk',
  '..kuuuuuuk',
];

const TIER_SPRITES: Record<TierValue, Grid> = {
  100: GAVEL,
  85: TROPHY,
  60: MEDAL,
  30: ROSETTE,
  10: CERTIFICATE,
  0: EMPTY_CHAIR,
};

/** Squares for one grid, merged into horizontal runs so a 16x16 icon is a few dozen rects. */
function runs(grid: Grid, ox = 0, oy = 0) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const fill = PALETTE[ch];
      if (!fill) { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      out.push({ x: x + ox, y: y + oy, w, fill });
      x += w;
    }
  });
  return out;
}

function Rects({ grid, x = 0, y = 0 }: { grid: Grid; x?: number; y?: number }) {
  return (
    <>
      {runs(grid, x, y).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </>
  );
}

export function PixelSprite({ grid, size = 48, label, style }: { grid: Grid; size?: number; label?: string; style?: CSSProperties }) {
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', ...style }}
    >
      <Rects grid={grid} />
    </svg>
  );
}

export function TierIcon({ tier, size = 48, label }: { tier: number | null | undefined; size?: number; label?: string }) {
  const t = ((tier ?? 0) in TIER_SPRITES ? tier ?? 0 : 0) as TierValue;
  return <PixelSprite grid={TIER_SPRITES[t]} size={size} label={label} />;
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return <PixelSprite grid={PLUS} size={size} />;
}

// ── The desk scene ──────────────────────────────────────────────────────────
// A wood-panelled hall, a desk, and a delegate's hand holding a placard that
// shows the score. `level` 0..1 lifts the hand; the move steps like pixel art.

const SCENE_W = 64;
const SCENE_H = 140;
const DESK_TOP = 112;
const PLACARD_H = 18;
const MAX_LIFT = 82;

export function DeskScene({
  level,
  points,
  bump = 0,
  className,
  style,
  slice = false,
}: {
  level: number;
  points: number;
  /** Change it to wiggle the placard (a new answer landed). */
  bump?: number;
  className?: string;
  style?: CSSProperties;
  /** Fill a wide box (the phone band) instead of keeping the tall shape. */
  slice?: boolean;
}) {
  const lift = Math.round(Math.max(0, Math.min(1, level)) * MAX_LIFT);
  const restY = DESK_TOP - PLACARD_H;
  const panels = Array.from({ length: SCENE_W / 8 }, (_, i) => i * 8);
  const specks = [
    [9, 18], [51, 11], [40, 34], [14, 52], [56, 60], [6, 78], [33, 6], [47, 86], [21, 30],
  ];
  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio={slice ? 'xMidYMax slice' : 'xMidYMax meet'}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'block', ...style }}
      role="img"
      aria-label={`A delegate raises their placard: ${points} points`}
    >
      {/* the hall */}
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill="#EFE7D4" />
      {panels.map((x) => (
        <rect key={x} x={x} y={0} width={1} height={DESK_TOP} fill="#E4D9C1" />
      ))}
      <rect x={0} y={38} width={SCENE_W} height={1} fill="#D9CCAF" />
      <rect x={0} y={39} width={SCENE_W} height={1} fill="#F7F1E3" />
      {specks.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill="#C9A84A" className="mn-speck" style={{ animationDelay: `${(i % 5) * 0.7}s` }} />
      ))}

      {/* the arm, hand and placard (lifted together) */}
      <g className="mn-lift" style={{ transform: `translateY(${-lift}px)` }}>
        <g key={bump} className={bump ? 'mn-wiggle' : undefined} style={{ transformOrigin: `32px ${restY + PLACARD_H}px` }}>
          {/* sleeve: long enough to reach below the desk at any height */}
          <rect x={28} y={restY + PLACARD_H + 4} width={8} height={MAX_LIFT + 40} fill="#2D3E57" />
          <rect x={28} y={restY + PLACARD_H + 4} width={1} height={MAX_LIFT + 40} fill="#1C1410" />
          <rect x={35} y={restY + PLACARD_H + 4} width={1} height={MAX_LIFT + 40} fill="#1C1410" />
          <rect x={33} y={restY + PLACARD_H + 4} width={2} height={MAX_LIFT + 40} fill="#1F2C40" />
          {/* placard */}
          <rect x={11} y={restY} width={42} height={PLACARD_H} fill="#1C1410" />
          <rect x={12} y={restY + 1} width={40} height={PLACARD_H - 2} fill="#FBF7EC" />
          <rect x={12} y={restY + PLACARD_H - 3} width={40} height={2} fill="#D8CFB8" />
          <rect x={14} y={restY + 3} width={36} height={1} fill="#1B3828" />
          <text
            x={32}
            y={restY + 12.5}
            textAnchor="middle"
            fontSize={8}
            fill="#1C1410"
            style={{ fontFamily: 'var(--font-pixel), monospace' }}
          >
            {points}
          </text>
          {/* the hand gripping the bottom edge */}
          <Rects grid={FIST} x={27} y={restY + PLACARD_H - 4} />
        </g>
      </g>

      {/* the desk, in front of the arm */}
      <rect x={0} y={DESK_TOP} width={SCENE_W} height={1} fill="#1C1410" />
      <rect x={0} y={DESK_TOP + 1} width={SCENE_W} height={2} fill="#A9794A" />
      <rect x={0} y={DESK_TOP + 3} width={SCENE_W} height={3} fill="#8A6238" />
      <rect x={0} y={DESK_TOP + 6} width={SCENE_W} height={1} fill="#1C1410" />
      <rect x={0} y={DESK_TOP + 7} width={SCENE_W} height={SCENE_H - DESK_TOP - 7} fill="#6B4A2B" />
      {[8, 24, 40, 56].map((x) => (
        <rect key={x} x={x} y={DESK_TOP + 10} width={1} height={SCENE_H - DESK_TOP - 13} fill="#5A3C22" />
      ))}
      {/* a little gavel resting on the desk */}
      <g transform={`translate(44 ${DESK_TOP - 8}) scale(0.5)`}>
        <Rects grid={GAVEL} />
      </g>
    </svg>
  );
}
