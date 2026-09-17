'use client';

/**
 * FloorEmblemBackdrop: the Gavelling mark (the gavel over the laurel wreath), very large and
 * very faint, pressed into the ivory floor behind the speaker.
 *
 * The look is a soft emboss in the EXACT outline of the logo. The mark's alpha channel
 * (`/gavelling-mark.png`, a clean RGBA cut-out) is used as a CSS mask, never drawn as a
 * picture, so no wood or leaf colour ever reaches the floor:
 *  - a highlight rim: the mark minus itself nudged down-right, i.e. the shape's top-left inner
 *    edge, in warm white;
 *  - a shadow rim: the mark nudged down-right minus the mark, i.e. just outside its
 *    bottom-right edge, in a forest tint (our shadows are never neutral);
 *  - a barely-there face so the silhouette reads as one raised form.
 * A small blur softens both rims, which is what makes it read as neumorphic instead of drawn.
 *
 * Strength (17 Sep 2026, owner: "make it even more subtle, literally barely visible"): about
 * a third of the first version (face 0.035, shadow 0.024, highlight 0.17). It should be found
 * on a close look, never noticed while chairing. Do not raise these without being asked.
 *
 * Placement: centred on the element carrying the `floor-emblem-anchor` class inside the same
 * parent (the speaker flag on the GSL and in a moderated caucus / Tour de Table, the number
 * disc in a Room Order tour, the unmoderated countdown), or on the parent's centre when there
 * is none. The parent must be `relative isolate`: the layer sits at z-index -1 inside that
 * stacking context, so it paints above the page ground and below every piece of floor content
 * (text contrast is untouched), and `pointer-events: none` keeps it out of every click.
 *
 * Static by design. Nothing animates, nothing is React state: position and size are written
 * straight to the node, measured again only when the floor resizes or its DOM changes
 * (ResizeObserver + MutationObserver, coalesced into one animation frame). A timer tick
 * changes a text node's data, which neither observer watches, so the clock never moves it
 * (RULES 3 and 4). Measurements are divided by the live FitToScreen scale.
 */
import { useLayoutEffect, useRef } from 'react';

const MARK_URL = '/gavelling-mark.png';
/** Share of the floor's height (and width) the mark may take. */
const HEIGHT_SHARE = 0.94;
const WIDTH_SHARE = 0.9;
const MAX_PX = 920;
const MIN_PX = 240;
/** Emboss depth in px at the maximum size; scaled with the mark so a small floor stays crisp. */
const DEPTH_AT_MAX = 5;

function maskLayers(offset: number, order: 'shape-minus-shifted' | 'shifted-minus-shape'): React.CSSProperties {
  const shifted = `calc(50% + ${offset}px) calc(50% + ${offset}px)`;
  const images = `url(${MARK_URL}), url(${MARK_URL})`;
  // Layer one is composited over layer two: "subtract" keeps layer one where layer two is not.
  const positions = order === 'shape-minus-shifted' ? `center, ${shifted}` : `${shifted}, center`;
  return {
    WebkitMaskImage: images,
    maskImage: images,
    WebkitMaskPosition: positions,
    maskPosition: positions,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskComposite: 'source-out',
    maskComposite: 'subtract',
    maskMode: 'alpha',
  } as React.CSSProperties;
}

export default function FloorEmblemBackdrop({ anchorSelector = '.floor-emblem-anchor' }: { anchorSelector?: string }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const mark = markRef.current;
    const host = layer?.parentElement;
    if (!layer || !mark || !host) return;

    let frame = 0;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    let observedAnchor: Element | null = null;
    let lastKey = '';

    const place = () => {
      if (frame) cancelAnimationFrame(frame);
      if (fallback) clearTimeout(fallback);
      frame = 0;
      fallback = null;
      const w = layer.offsetWidth;
      const h = layer.offsetHeight;
      if (w === 0 || h === 0) return;
      const box = layer.getBoundingClientRect();
      const scale = box.width / w || 1;
      const anchor = host.querySelector(anchorSelector);
      if (anchor !== observedAnchor) {
        if (observedAnchor) resize.unobserve(observedAnchor);
        if (anchor) resize.observe(anchor);
        observedAnchor = anchor;
      }
      let cx = w / 2;
      let cy = h / 2;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          cx = (r.left + r.width / 2 - box.left) / scale;
          cy = (r.top + r.height / 2 - box.top) / scale;
        }
      }
      const size = Math.round(Math.max(MIN_PX, Math.min(MAX_PX, h * HEIGHT_SHARE, w * WIDTH_SHARE)));
      const left = Math.round(cx - size / 2);
      const top = Math.round(cy - size / 2);
      const key = `${left}|${top}|${size}`;
      if (key === lastKey) return;
      lastKey = key;
      mark.style.width = `${size}px`;
      mark.style.height = `${size}px`;
      mark.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      const depth = Math.max(2, Math.round((DEPTH_AT_MAX * size) / MAX_PX));
      if (highlightRef.current) Object.assign(highlightRef.current.style, maskLayers(depth, 'shape-minus-shifted'));
      if (shadowRef.current) Object.assign(shadowRef.current.style, maskLayers(depth, 'shifted-minus-shape'));
      mark.style.visibility = 'visible';
    };
    // One rAF, with a timer behind it: rAF does not run in a hidden or occluded page, and the
    // mark must already be in place when the page is shown again.
    const schedule = () => {
      if (frame || fallback) return;
      frame = requestAnimationFrame(place);
      fallback = setTimeout(place, 120);
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(layer);
    const mutations = new MutationObserver(schedule);
    // childList only: a clock tick rewrites a text node (characterData) and is ignored.
    mutations.observe(host, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    // ResizeObserver and rAF are paused in a hidden page: re-place when it is shown again.
    const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    place();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (fallback) clearTimeout(fallback);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [anchorSelector]);

  return (
    <div
      ref={layerRef}
      aria-hidden
      data-floor-emblem
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      <div ref={markRef} className="absolute left-0 top-0" style={{ visibility: 'hidden', width: 0, height: 0 }}>
        {/* Face: the whole silhouette, a whisper lighter than the floor. */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: `url(${MARK_URL})`,
            maskImage: `url(${MARK_URL})`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            backgroundColor: 'rgba(255, 252, 244, 0.035)',
          }}
        />
        {/* Shadow rim, outside the bottom-right edge. */}
        <div ref={shadowRef} className="absolute inset-0" style={{ backgroundColor: 'rgba(27, 56, 40, 0.024)', filter: 'blur(1.6px)' }} />
        {/* Highlight rim, the top-left inner edge. */}
        <div ref={highlightRef} className="absolute inset-0" style={{ backgroundColor: 'rgba(255, 253, 247, 0.17)', filter: 'blur(1.4px)' }} />
      </div>
    </div>
  );
}
