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

// ── The delegate's arm ──────────────────────────────────────────────────────
// A fist gripping the bottom of the placard, a white cuff and a suit sleeve
// running down out of frame. The placard itself is HTML above it (crisp text).

const ARM: Grid = [
  '..kkkkkkkkkk..',
  '.kssssssssssk.',
  'ksSssSssSssSsk',
  'kssssssssssssk',
  'ksSssssssssSSk',
  'kssssssssssSSk',
  '.kssssssssSSk.',
  '..kssssssSSk..',
  '..kuuuuuuuuk..',
  '..kuuuuuuuuk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
  '..kbbbbbbbBk..',
];

export function ArmSprite({ size = 84 }: { size?: number }) {
  return <PixelSprite grid={ARM} size={size} />;
}
