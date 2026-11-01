// Gavelling Crisis map: characters glide from their old spot to their new one, the way units do (mapAnimate.ts
// moveUnits: the same easing, the same time, the same trail and the same pulse on arrival).
//
// A character's SAVED spot (crisis_characters.location_lng/lat) is what delegates and the other staff see, so a change
// of the saved spot is the moment to glide. This file holds the small controller (batches, "this screen already
// showed it", the final spots) and the hook that watches the saved spots. Nothing here is React state: frames move
// markers with setLngLat, and the marker effect in WarMap always lands the marker on its real spot at the end.

import { useEffect, useRef } from 'react';
import type { Marker as MLMarker } from 'maplibre-gl';
import type { Character } from '@/lib/crisis/types';
import { MOVE_MS, TRAIL_FADE_MS, prefersReducedMotion, type createMapAnimator } from './mapAnimate';

type LL = [number, number];
export interface CharMove { id: string; from: LL; to: LL; still?: boolean }
type Runner = (moves: CharMove[], done: () => void) => boolean;

const SAME = 1e-5;
export const sameSpot = (a: LL, b: LL): boolean => Math.abs(a[0] - b[0]) < SAME && Math.abs(a[1] - b[1]) < SAME;
/** An "already shown" note is good for this long. */
const EXPECT_MS = 15000;

/**
 * Owns which characters are gliding. `start` batches the moves asked for in the same tick into one animation (they
 * share one trail layer); `expect` says "this screen already shows or plays that move, do not play it again when the
 * saved spot catches up" (the sender of a move).
 */
export function createCharGlider() {
  const active = new Set<string>();
  const expected = new Map<string, { to: LL; at: number; mode: 'ran' | 'still' }>();
  /** Where each character marker belongs now (the marker effect writes it, the glide ends there). */
  const targets = new Map<string, LL>();
  let run: Runner | null = null;
  let queue: CharMove[] = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const batch = queue; queue = [];
    if (!batch.length) return;
    const ids = batch.map((m) => m.id);
    const release = () => { for (const id of ids) active.delete(id); };
    // Whatever happens, no marker stays "gliding" for ever: the glide cannot take longer than this.
    const safety = window.setTimeout(release, MOVE_MS + TRAIL_FADE_MS + 600);
    const started = run ? run(batch, () => { window.clearTimeout(safety); release(); }) : false;
    if (!started) { window.clearTimeout(safety); release(); }
  };

  return {
    targets,
    setRunner: (fn: Runner | null) => { run = fn; },
    isActive: (id: string): boolean => active.has(id),
    /** Starts gliding. Nothing for reduced motion or a hidden tab: the marker just lands on its real spot. */
    start: (moves: CharMove[]) => {
      if (!moves.length || prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)) return;
      for (const m of moves) {
        active.add(m.id);
        queue = queue.filter((q) => q.id !== m.id);
        queue.push(m);
      }
      if (!scheduled) { scheduled = true; queueMicrotask(flush); }
    },
    /** This screen already shows (`still`: the marker is there, only the trail is left to draw) or plays (`ran`) the move to `to`. */
    expect: (id: string, to: LL, mode: 'ran' | 'still') => { expected.set(id, { to, at: Date.now(), mode }); },
    /** Is the saved spot that just arrived one this screen expected? Answers how, and forgets it. */
    take: (id: string, now: LL): 'ran' | 'still' | null => {
      const e = expected.get(id);
      if (!e) return null;
      if (Date.now() - e.at > EXPECT_MS) { expected.delete(id); return null; }
      if (!sameSpot(e.to, now)) return null;
      expected.delete(id);
      return e.mode;
    },
  };
}
export type CharGlider = ReturnType<typeof createCharGlider>;

/**
 * Plays the glide of every character whose SAVED spot changed (a send by anyone, a move saved live, a restore). The first
 * time a character is seen it is not animated. A staff screen that is showing a different unsent spot for that character
 * keeps it where the unsent changes put it.
 */
export function useCharGlide(args: {
  glider: CharGlider;
  characters: Character[];
  animator: ReturnType<typeof createMapAnimator>;
  markers: { current: Map<string, { marker: MLMarker; el: HTMLElement }> };
  /** The colour of the trail: the character's cabinet. */
  colorOf: (c: Character | undefined) => string;
  /** The spot the unsent changes put a character on, if they do. */
  draftAt: (id: string) => LL | undefined;
  onDone: () => void;
}): void {
  const { glider, characters, animator, markers } = args;
  const latest = useRef(args);
  useEffect(() => { latest.current = args; });

  // How the glider plays a batch: through the map animator, on its own trail layer.
  useEffect(() => {
    glider.setRunner((moves, done) => {
      const live = moves.filter((m) => markers.current.has(m.id));
      if (!live.length) return false;
      const byId = new Map(latest.current.characters.map((c) => [c.id, c]));
      animator.moveUnits(
        live,
        (id) => markers.current.get(id),
        (id) => glider.targets.get(id),
        (id) => latest.current.colorOf(byId.get(id)),
        { channel: 'chars', onDone: () => { done(); latest.current.onDone(); } },
      );
      return true;
    });
    return () => glider.setRunner(null);
  }, [glider, animator, markers]);

  const savedPrev = useRef(new Map<string, LL>());
  useEffect(() => {
    const moves: CharMove[] = [];
    const seen = new Set<string>();
    for (const c of characters) {
      if (typeof c.location_lng !== 'number' || typeof c.location_lat !== 'number') continue;
      const now: LL = [c.location_lng, c.location_lat];
      seen.add(c.id);
      const was = savedPrev.current.get(c.id);
      savedPrev.current.set(c.id, now);
      if (!was || sameSpot(was, now)) continue;
      const mine = glider.take(c.id, now);
      if (mine === 'ran') continue;
      const unsent = latest.current.draftAt(c.id);
      if (unsent && !sameSpot(unsent, now)) continue;
      moves.push({ id: c.id, from: was, to: now, still: mine === 'still' });
    }
    for (const id of [...savedPrev.current.keys()]) if (!seen.has(id)) savedPrev.current.delete(id);
    glider.start(moves);
  }, [characters, glider]);
}
