// Gavelling Crisis map: a request to fly the real map to one item (a row of the "N changes to the map" pop-up) and
// pulse it. `n` is a counter so asking for the same item twice flies twice.

export interface FocusRequest {
  n: number;
  unit?: string;
  region?: string;
  /** A drawn area or line. */
  shape?: string;
  bbox?: [number, number, number, number];
}

/** Milliseconds a fly takes (nothing for reduced motion). */
export const FLY_MS = 1000;
