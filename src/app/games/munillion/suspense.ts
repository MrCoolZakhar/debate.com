// The climb (owner, 27 Nov 2026: "not enough suspense"). After an answer a marker climbs a ladder
// of the five awards. It speeds through the low rungs, rings each one it passes, and near the end
// it creeps up under the next award, trembles to a drumroll and either pushes over or falls back.
// Sometimes it stalls and still makes it, so a stall never gives the result away. Then a beat of
// silence, then the score. Positions are in rung units: 0 is the floor, 1 Participation
// Certificate, 2 Honourable Mention, 3 Outstanding Delegate, 4 Best Delegate, 5 The Gavel.

export type Seg =
  | { kind: 'move'; to: number; ms: number; ease: 'inOut' | 'out' | 'in' }
  | { kind: 'stall'; ms: number }
  | { kind: 'drop'; to: number; ms: number }
  | { kind: 'hush'; ms: number };

export const RUNG_TIERS = [10, 30, 60, 85, 100] as const;
export const TOP_RUNG = 5;

export function rungFor(tier: number): number {
  return tier >= 100 ? 5 : tier >= 85 ? 4 : tier >= 60 ? 3 : tier >= 30 ? 2 : tier >= 10 ? 1 : 0;
}

/** The climb for a score. `rand` is injectable so the same result never plays twice the same way. */
export function buildClimb(tier: number, rand: () => number = Math.random): Seg[] {
  const t = rungFor(tier);
  const segs: Seg[] = [];
  if (t === 0) {
    // Absent: it tries, stalls just short of the first award, and slides back to the floor
    segs.push({ kind: 'move', to: 0.72, ms: 700, ease: 'out' });
    segs.push({ kind: 'stall', ms: 900 });
    segs.push({ kind: 'drop', to: 0, ms: 520 });
    segs.push({ kind: 'hush', ms: 420 });
    return segs;
  }
  // a stall-and-make-it before the final rung half the time (always before The Gavel)
  const teaseLast = t === 5 || (t >= 2 && rand() < 0.5);
  for (let r = 1; r <= t; r++) {
    // fast at the bottom, slower as it climbs, like falling in reverse
    const ms = 360 + r * 150;
    if (r === t && teaseLast) {
      segs.push({ kind: 'move', to: r - 0.16, ms: ms + 120, ease: 'out' });
      segs.push({ kind: 'stall', ms: 950 + Math.round(rand() * 450) });
      segs.push({ kind: 'move', to: r, ms: 260, ease: 'in' });
    } else {
      segs.push({ kind: 'move', to: r, ms, ease: r === 1 ? 'in' : 'inOut' });
    }
  }
  if (t < TOP_RUNG) {
    // the near miss: it creeps toward the next award, trembles, and falls back
    const reach = 0.62 + rand() * 0.24;
    segs.push({ kind: 'move', to: t + reach, ms: 780 + Math.round(rand() * 260), ease: 'out' });
    segs.push({ kind: 'stall', ms: 900 + Math.round(rand() * 500) });
    segs.push({ kind: 'drop', to: t, ms: 480 });
  }
  segs.push({ kind: 'hush', ms: 450 });
  return segs;
}

export function climbMs(segs: Seg[]): number {
  return segs.reduce((n, s) => n + s.ms, 0);
}

const EASE = {
  inOut: (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  out: (p: number) => 1 - Math.pow(1 - p, 3),
  in: (p: number) => p * p * p,
  // a drop lands with a small bounce
  drop: (p: number) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

export interface ClimbFrame { pos: number; stalling: boolean; hush: boolean; done: boolean; kind: Seg['kind'] | 'done' }

/** Where the marker is `ms` into the climb. */
export function climbAt(segs: Seg[], ms: number): ClimbFrame {
  let t = ms;
  let pos = 0;
  for (const s of segs) {
    if (t <= s.ms) {
      const p = s.ms > 0 ? Math.max(0, Math.min(1, t / s.ms)) : 1;
      if (s.kind === 'move') return { pos: pos + (s.to - pos) * EASE[s.ease](p), stalling: false, hush: false, done: false, kind: 'move' };
      if (s.kind === 'drop') return { pos: pos + (s.to - pos) * EASE.drop(p), stalling: false, hush: false, done: false, kind: 'drop' };
      if (s.kind === 'stall') return { pos, stalling: true, hush: false, done: false, kind: 'stall' };
      return { pos, stalling: false, hush: true, done: false, kind: 'hush' };
    }
    t -= s.ms;
    if (s.kind === 'move' || s.kind === 'drop') pos = s.to;
  }
  return { pos, stalling: false, hush: false, done: true, kind: 'done' };
}
