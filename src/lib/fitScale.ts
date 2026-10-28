// The ONE definition of FitToScreen's scale, so every reader (FitToScreen itself, the chair
// sidebar's layout width, the roll call's row size) agrees on the scale actually in effect.
// Rect conversions elsewhere (anchorBox, GavelChip, DraggablePopover, TutorialOverlay, ...)
// MEASURE the scale off `#fit-root` (getBoundingClientRect width / offsetWidth), which is the
// same number by construction.
//
// Browser zoom (owner-approved fix, 23 Oct 2026). FitToScreen lays the console out BASE_H px
// tall and scales that to the window. Ctrl/Cmd + used to do nothing: zooming by z makes a CSS
// px z times bigger AND shrinks innerHeight (in CSS px) by z, so innerHeight / BASE_H drops by
// z and the two cancel exactly. We put the zoom back by multiplying by z = dpr / baseDpr:
//
//   scale = innerHeight / BASE_H x z
//
// innerHeight / BASE_H alone keeps the frame the window's height at any zoom; x z then makes it
// z times larger on screen. Counted once: dpr only enters through z, innerHeight only through
// the fit, so this neither cancels (z = 1 forever, the old bug) nor double counts (z^2).
// Zoomed in (z > 1) the frame is taller than the window and FitToScreen lets it scroll;
// zoomed out (z < 1) FitToScreen gives the frame BASE_H / z of layout height so it still fills
// the window instead of leaving an ivory band below.
//
// devicePixelRatio also changes when the window moves to a monitor of another density. That
// is not a zoom, and the screen's own size changes with it, so on a screen change the base is
// re-taken keeping the current zoom (browser zoom is per site and survives the move). Firefox
// reports screen size in zoomed CSS px, so there the zoom always reads as a screen change and
// the console keeps its old (unzoomed) behaviour: never worse than before.
//
// Honest limit: the base is taken on the first read of the page load, so a zoom the browser
// had already applied when the page loaded counts as 100%.

export const FIT_BASE_H = 820;
export const FIT_ZOOM_MIN = 0.5;
export const FIT_ZOOM_MAX = 3;

let baseDpr: number | null = null;
let lastZoom = 1;
let screenKey = '';

function currentScreenKey(): string {
  if (typeof screen === 'undefined') return '';
  return `${screen.width}x${screen.height}`;
}

/** Browser zoom relative to the first read of this page load, clamped to [0.5, 3]. */
export function fitZoomNow(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const key = currentScreenKey();
  if (baseDpr === null) {
    baseDpr = dpr;
    screenKey = key;
    lastZoom = 1;
  } else if (key !== screenKey) {
    // Moved to another screen: keep the zoom, re-take the base at the new density.
    screenKey = key;
    baseDpr = dpr / lastZoom;
  }
  const raw = baseDpr > 0 ? dpr / baseDpr : 1;
  const z = Number.isFinite(raw) ? Math.min(FIT_ZOOM_MAX, Math.max(FIT_ZOOM_MIN, raw)) : 1;
  lastZoom = z;
  return z;
}

/** FitToScreen's scale for the current window (default, non-`fitContent` mode). */
export function fitScaleNow(baseH: number = FIT_BASE_H): number {
  if (typeof window === 'undefined' || !window.innerHeight) return 1;
  return (window.innerHeight / baseH) * fitZoomNow();
}

/** FitToScreen's layout width (design px) for the current window. */
export function fitLayoutWidthNow(): number {
  if (typeof window === 'undefined') return FIT_BASE_H * (16 / 9);
  const s = fitScaleNow();
  return s > 0 ? window.innerWidth / s : FIT_BASE_H * (16 / 9);
}
