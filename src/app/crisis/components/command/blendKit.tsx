'use client';
// Gavelling Crisis: the small pieces the blended performance total is drawn with, shared by the character's Performance tab and
// the Statistics pop-up (src/lib/crisis/performance.ts is the maths). In the room is green, out of the room (directives and
// meetings) is red, in the same order everywhere.

import { CK } from '../../crisisKit';
import { fmtPts } from '@/lib/crisis/performance';

export const ROOM_COLOR = CK.forest2;
export const OUT_COLOR = CK.red;

/** One bar split in two. `scale` (0..1) is how much of the track the whole bar fills, so bars can be compared across people. */
export function SplitBar({ room, out, scale = 1, height = 10 }: { room: number; out: number; scale?: number; height?: number }) {
  const r = Math.max(0, room);
  const o = Math.max(0, out);
  const sum = r + o;
  const fill = sum > 0 ? Math.max(0.02, Math.min(1, scale)) : 0;
  return (
    <div
      role="img"
      aria-label={`${fmtPts(room)} points in the room, ${fmtPts(out)} points from directives and meetings`}
      style={{ height, borderRadius: height / 2, background: 'rgba(27,56,40,0.09)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', width: `${fill * 100}%`, height: '100%', transition: 'width 300ms ease' }}>
        <span style={{ width: sum ? `${(r / sum) * 100}%` : 0, background: ROOM_COLOR }} />
        <span style={{ width: sum ? `${(o / sum) * 100}%` : 0, background: OUT_COLOR }} />
      </div>
    </div>
  );
}

/** "12 in the room" / "8 out of the room" as a big number with the word beside it, each with its colour dot. */
export function SplitLegend({ room, out, roomWord = 'in the room', outWord = 'from directives and meetings', size = 18 }: {
  room: number | null; out: number; roomWord?: string; outWord?: string; size?: number;
}) {
  const item = (color: string, n: number | null, word: string) => (
    <span className="inline-flex items-baseline" style={{ gap: 5, whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, alignSelf: 'center', flex: 'none' }} />
      <b style={{ fontSize: size, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{n === null ? 'None' : fmtPts(n)}</b>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>{word}</span>
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-baseline" style={{ gap: '4px 16px' }}>
      {item(ROOM_COLOR, room, roomWord)}
      {item(OUT_COLOR, out, outWord)}
    </span>
  );
}
