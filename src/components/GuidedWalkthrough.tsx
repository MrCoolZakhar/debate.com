'use client';

/**
 * GuidedWalkthrough — a small, generic, Gavin-flavoured product tour.
 *
 * WHY THIS EXISTS INSTEAD OF REUSING `TutorialOverlay`
 * ----------------------------------------------------
 * `src/components/TutorialOverlay.tsx` is the sessions-side tour and cannot be
 * reused here:
 *   • it takes a non-nullable `Committee` and reads committee state for its
 *     auto-advance conditions — the conferences layer has no such object;
 *   • its steps are hardcoded inside the file with no injection point;
 *   • it auto-skips a step 700 ms after its target vanishes, which would
 *     fast-forward straight through any tab transition;
 *   • it measures in `#fit-root` design units, because every surface it runs on
 *     is wrapped in `FitToScreen`. `/manage/*` is NOT — the only `FitToScreen`
 *     mounts are `/chair`, `/delegate`-adjacent, `/advisor`, `/voting`,
 *     `/create` and `/join` — so there is no `#fit-root` on this page and plain
 *     viewport pixels are correct here.
 *
 * So this is a new component that deliberately copies TutorialOverlay's *visual*
 * language (Gavin portrait bottom-right, ivory speech bubble with a rotated
 * tail, SVG-mask spotlight, forest/gold nav pill) while being driven entirely by
 * the steps its host page hands it.
 *
 * Coordinates: this portals into `document.body` directly rather than through
 * `@/components/Portal` (which prefers `#fit-root`), so `position: fixed` here
 * always means real viewport pixels. No `toDesign()` scaling.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OUTFIT, NEU, EASE } from '@/components/neu';

// ── Public types ─────────────────────────────────────────────────────────────

export interface WalkthroughStep {
  /** Stable id — also used for the SVG mask id, so keep it unique per tour. */
  id: string;
  /** Gavin portrait for this step. Defaults to the mid-tour pose. */
  image?: string;
  /** Bubble copy. Rich nodes are fine. */
  text: ReactNode;
  /**
   * `data-tutorial` attribute values to punch out of the scrim. Omit for a
   * centred, spotlight-free slide (intro / outro).
   */
  targets?: string[];
  /** Corner radius of the punched hole. Capped at half the target height. */
  radius?: number;
  /**
   * Runs once, before this step is measured. This is how the host page is put
   * into the state the step describes (e.g. `setActiveTab('inbox')`). The
   * overlay then waits for the step's targets to actually appear.
   */
  before?: () => void;
}

interface Props {
  steps: WalkthroughStep[];
  /** `finish` = walked to the end, `skip` = escaped / skipped out. */
  onClose: (reason: 'finish' | 'skip') => void;
  /** Accessible name for the dialog. */
  label?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const OTTER_INTRO = '/Otter.Tutorial.Intro.webp';
const OTTER_MID = '/Otter.Tutorial.webp';
const OTTER_OUTRO = '/Otter.Tutorial.Outro.webp';

/**
 * How long to wait for a step's target to appear before giving up and showing a
 * centred bubble with no spotlight. Deliberately far longer than
 * TutorialOverlay's 700 ms — a tab switch here remounts a whole panel, and the
 * failure mode we must never have is "fast-forwarded past the step".
 */
const TARGET_TIMEOUT_MS = 3000;

/** Layout read throttle for the tracking loop (~33fps). */
const MEASURE_MIN_MS = 30;

const SCRIM = 'rgba(0,0,0,0.48)';
const BUBBLE_BG = '#FAF8F3';
const BUBBLE_BORDER = '1.5px solid rgba(27,56,40,0.18)';

interface Rect { left: number; top: number; width: number; height: number }

type Mode = 'none' | 'waiting' | 'ready' | 'degraded';

// ── Keyframes ────────────────────────────────────────────────────────────────
// Inline <style> keyframes are global in this repo and `neuFadeIn` / `gvRise`
// already collide across files, so everything here is prefixed `gvcw`
// (Gavelling Communications Walkthrough) and injected exactly once.
const STYLE_ID = 'gvcw-walkthrough-style';
const STYLE_TEXT = `
@keyframes gvcwFadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes gvcwPopIn { from { opacity: 0; transform: translateY(10px) scale(0.985) } to { opacity: 1; transform: none } }
@keyframes gvcwPulse {
  0%, 100% { box-shadow: 0 0 0 2px #EED98A, 0 0 8px rgba(238,217,138,0.25) }
  50%      { box-shadow: 0 0 0 4px rgba(238,217,138,0.6), 0 0 20px rgba(238,217,138,0.35) }
}
.gvcw-scroll::-webkit-scrollbar { width: 6px }
.gvcw-scroll::-webkit-scrollbar-thumb { background: rgba(27,56,40,0.25); border-radius: 3px }
`;

function useInjectedStyle() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLE_TEXT;
    document.head.appendChild(el);
  }, []);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return reduced;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GuidedWalkthrough({ steps, onClose, label = 'Guided tour' }: Props) {
  useInjectedStyle();
  const reduced = usePrefersReducedMotion();

  const [idx, setIdx] = useState(0);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  // Tracking result, stamped with the step index it belongs to. Stamping is what
  // lets the *render* derive the current mode without an effect having to reset
  // state on every step change: a result from a stale index simply reads as
  // "still waiting".
  const [tracked, setTracked] = useState<{ idx: number; mode: Mode; rects: (Rect | null)[] }>(
    { idx: -1, mode: 'none', rects: [] },
  );

  // Steps arrive as an inline array from the host page, so its identity changes
  // on every host render. Keep it in a ref and key every effect off `idx` only —
  // otherwise `before()` (which calls the host's setState) would re-run forever.
  const stepsRef = useRef(steps);
  const onCloseRef = useRef(onClose);
  useEffect(() => { stepsRef.current = steps; onCloseRef.current = onClose; });

  const step = steps[Math.min(idx, steps.length - 1)];
  const isLast = idx >= steps.length - 1;

  const hasTargets = (step?.targets?.length ?? 0) > 0;
  const fresh = tracked.idx === idx;
  const mode: Mode = !hasTargets ? 'none' : fresh ? tracked.mode : 'waiting';
  const rects = hasTargets && fresh ? tracked.rects : [];

  const finish = useCallback(() => onCloseRef.current('finish'), []);
  const skip = useCallback(() => onCloseRef.current('skip'), []);
  const advance = useCallback(() => {
    setIdx(i => (i >= stepsRef.current.length - 1 ? i : i + 1));
  }, []);
  const goBack = useCallback(() => setIdx(i => (i <= 0 ? 0 : i - 1)), []);

  // Preload the portraits so a step change never flashes an empty frame.
  useEffect(() => {
    [OTTER_INTRO, OTTER_MID, OTTER_OUTRO].forEach(src => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  // Viewport size for the mask geometry.
  useEffect(() => {
    const apply = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // ── Per-step: run `before()`, then wait for the targets, then track them ───
  //
  // A single rAF loop covers both phases. While waiting we look for any target
  // with a non-zero box; once one appears we flip to `ready` and keep measuring
  // so the hole follows layout. If nothing shows up inside TARGET_TIMEOUT_MS we
  // flip to `degraded` — a centred bubble, no spotlight. We never auto-advance
  // or auto-skip: a missing target must not move the user through the tour.
  useEffect(() => {
    const current = stepsRef.current[Math.min(idx, stepsRef.current.length - 1)];
    if (!current) return;

    current.before?.();

    // No targets: the render already derives `mode: 'none'` from the step itself,
    // so there is nothing to measure and nothing to reset.
    const targets = current.targets ?? [];
    if (targets.length === 0) return;

    let raf = 0;
    let stopped = false;
    let last = 0;
    let start = 0;
    let found = false;
    let sig = '';

    const tick = (now: number) => {
      if (!stopped) raf = requestAnimationFrame(tick);
      if (!start) start = now;
      if (now - last < MEASURE_MIN_MS) return;
      last = now;

      const measured: (Rect | null)[] = targets.map(name => {
        const el = document.querySelector(`[data-tutorial="${name}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // Present but not laid out (collapsed panel, display:contents parent):
        // treat as absent rather than punching a degenerate hole.
        if (r.width <= 0 || r.height <= 0) return null;
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });

      const anyPresent = measured.some(Boolean);

      if (!anyPresent) {
        // Only give up while we have never seen the target. Once it has been
        // shown, a transient disappearance keeps the last known geometry rather
        // than yanking the user into a degraded slide.
        if (!found && now - start > TARGET_TIMEOUT_MS) {
          setTracked({ idx, mode: 'degraded', rects: [] });
          stopped = true;
          cancelAnimationFrame(raf);
        }
        return;
      }

      if (!found) {
        found = true;
        const first = targets.map(n => document.querySelector(`[data-tutorial="${n}"]`)).find(Boolean);
        first?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      }

      const nextSig = measured
        .map(r => (r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : 'x'))
        .join(';');
      if (nextSig !== sig) {
        sig = nextSig;
        setTracked({ idx, mode: 'ready', rects: measured });
      }
    };

    raf = requestAnimationFrame(tick);
    const invalidate = () => { sig = ''; };
    window.addEventListener('scroll', invalidate, true);
    window.addEventListener('resize', invalidate);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', invalidate, true);
      window.removeEventListener('resize', invalidate);
    };
  }, [idx, reduced]);

  // ── Focus management ──────────────────────────────────────────────────────
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = restoreRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, []);

  useEffect(() => {
    // Focus the primary control on every step so keyboard users stay oriented.
    const id = window.setTimeout(() => nextBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [idx]);

  // Escape closes; arrows / Enter / Space navigate; Tab is trapped inside the
  // overlay because it is `aria-modal`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); skip(); return; }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault(); lastEl.focus();
        } else if (!e.shiftKey && (active === lastEl || !root.contains(active))) {
          e.preventDefault(); first.focus();
        }
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isLast) finish(); else advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, goBack, finish, skip, isLast]);

  // No `mounted` flag needed: the host only ever renders this from an effect or a
  // click, so it never appears in the server-rendered tree.
  if (typeof document === 'undefined' || !step) return null;

  const anim = (name: string, ms: number) => (reduced ? undefined : `${name} ${ms}ms ${EASE} both`);
  const portrait = step.image ?? OTTER_MID;
  const spotlit = mode === 'ready' && rects.some(Boolean);
  const radius = step.radius ?? 12;

  // ── Pieces ────────────────────────────────────────────────────────────────

  const bubbleBody = (
    <div
      className="gvcw-scroll"
      style={{
        padding: '14px 20px', borderRadius: 16, fontSize: 14, fontWeight: 500,
        lineHeight: 1.5, color: NEU.ink, textAlign: 'center', fontFamily: OUTFIT,
        backgroundColor: BUBBLE_BG, border: BUBBLE_BORDER,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 380,
        maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain',
        pointerEvents: 'auto',
      }}
    >
      {step.text}
    </div>
  );

  const nav = (
    <div
      style={{
        position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100002, display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 12, fontFamily: OUTFIT,
        backgroundColor: BUBBLE_BG, border: BUBBLE_BORDER,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)', pointerEvents: 'auto',
        animation: anim('gvcwFadeIn', 220),
      }}
    >
      <button
        type="button"
        onClick={goBack}
        disabled={idx <= 0}
        style={{
          ...NAV_BTN,
          backgroundColor: 'transparent',
          color: idx <= 0 ? '#C8BAA8' : NEU.forest,
          cursor: idx <= 0 ? 'default' : 'pointer',
        }}
      >
        ‹ Back
      </button>
      <span className="tabular-nums" style={{ fontSize: 11, color: NEU.muted, fontWeight: 700 }}>
        {idx + 1}/{steps.length}
      </span>
      <button
        ref={nextBtnRef}
        type="button"
        onClick={isLast ? finish : advance}
        style={{ ...NAV_BTN, backgroundColor: NEU.forest, color: NEU.gold }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = NEU.forest; }}
      >
        {isLast ? 'Finish' : 'Next'} ›
      </button>
    </div>
  );

  const skipBtn = (
    <button
      type="button"
      onClick={skip}
      style={{
        position: 'fixed', top: 14, right: 16, zIndex: 100002,
        padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13,
        fontFamily: OUTFIT, backgroundColor: NEU.forest, color: NEU.gold,
        border: 'none', cursor: 'pointer', pointerEvents: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
        animation: anim('gvcwFadeIn', 220),
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = NEU.forest; }}
    >
      Skip tour
    </button>
  );

  // Centred slide: intro/outro, and the graceful degradation when a target
  // never showed up.
  const centred = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'auto',
        background: 'rgba(27,56,40,0.86)',
        backdropFilter: reduced ? undefined : 'blur(4px)',
        animation: anim('gvcwFadeIn', 220),
      }}
    >
      <div
        className="gvcw-scroll"
        style={{
          backgroundColor: '#F6F1E9', borderRadius: 24, padding: '32px 40px',
          maxWidth: 460, width: '100%', textAlign: 'center', fontFamily: OUTFIT,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          border: '2px solid rgba(27,56,40,0.2)', boxShadow: NEU.out,
          maxHeight: '92%', overflowY: 'auto',
          animation: anim('gvcwPopIn', 320),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portrait}
          alt="Gavin the otter"
          style={{ width: 220, height: 220, objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ fontSize: 15, lineHeight: 1.55, color: NEU.ink, fontWeight: 500 }}>
          {step.text}
        </div>
      </div>
    </div>
  );

  // Spotlight slide: scrim with holes + Gavin bottom-right with a bubble.
  const spotlight = (
    <>
      {vp.w > 0 && (
        <svg
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 100000, pointerEvents: 'none' }}
          width={vp.w}
          height={vp.h}
          viewBox={`0 0 ${vp.w} ${vp.h}`}
          aria-hidden="true"
        >
          <defs>
            <mask id={`gvcw-mask-${step.id}`}>
              <rect x={0} y={0} width={vp.w} height={vp.h} fill="white" />
              {rects.map((r, i) => {
                if (!r) return null;
                const cr = Math.min(radius, r.height / 2);
                return (
                  <rect key={i} x={r.left} y={r.top} width={r.width} height={r.height} rx={cr} ry={cr} fill="black" />
                );
              })}
            </mask>
          </defs>
          <rect x={0} y={0} width={vp.w} height={vp.h} fill={SCRIM} mask={`url(#gvcw-mask-${step.id})`} />
        </svg>
      )}

      {/* Gold ring around each hole. */}
      {rects.map((r, i) => {
        if (!r) return null;
        const cr = Math.min(radius, r.height / 2);
        return (
          <div
            key={`ring-${i}`}
            style={{
              position: 'fixed', top: r.top, left: r.left, width: r.width, height: r.height,
              borderRadius: cr, zIndex: 100001, pointerEvents: 'none',
              boxShadow: '0 0 0 2px #EED98A, 0 0 8px rgba(238,217,138,0.25)',
              animation: reduced ? undefined : 'gvcwPulse 1.8s ease-in-out infinite',
            }}
          />
        );
      })}

      {/* Click-anywhere-to-advance catcher; also blocks the page beneath. */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 100000, cursor: 'pointer', pointerEvents: 'auto' }}
        onClick={isLast ? finish : advance}
        aria-hidden="true"
      />

      {/*
        Gavin, bottom-right. The portrait PNG is 2000×2000 with ~528px of
        transparent header; rendered 440 wide inside a 660-tall box and
        bottom-anchored, the first real otter pixel lands ~324px above the
        bottom, so the bubble sits at 334px.
      */}
      <div
        style={{
          position: 'fixed', bottom: 0, right: -20, zIndex: 100001,
          width: 440, height: 660, pointerEvents: 'none',
          animation: anim('gvcwFadeIn', 260),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portrait}
          alt="Gavin the otter"
          style={{
            position: 'absolute', bottom: 0, left: 0, width: 440, height: 660,
            objectFit: 'contain', objectPosition: 'bottom center', display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: 334, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          {bubbleBody}
          <div
            style={{
              width: 14, height: 14, marginTop: -1, backgroundColor: BUBBLE_BG,
              borderRight: BUBBLE_BORDER, borderBottom: BUBBLE_BORDER,
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      </div>
    </>
  );

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, pointerEvents: 'none' }}
    >
      {/* `waiting` shows the plain scrim only — no hole, no jump — until the
          target lands or the timeout demotes us to `degraded`. */}
      {mode === 'waiting' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100000, background: SCRIM,
            pointerEvents: 'auto', animation: anim('gvcwFadeIn', 160),
          }}
          aria-hidden="true"
        />
      )}
      {spotlit ? spotlight : mode === 'waiting' ? null : centred}
      {nav}
      {skipBtn}
    </div>,
    document.body,
  );
}

const NAV_BTN: CSSProperties = {
  padding: '5px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4,
  fontFamily: OUTFIT,
};

/** Gold emphasis, matching TutorialOverlay's bubble idiom. */
export const TourGold = ({ children }: { children: ReactNode }) => (
  <span style={{ color: NEU.deepGold, fontWeight: 700 }}>{children}</span>
);

/** Forest emphasis, matching TutorialOverlay's bubble idiom. */
export const TourGreen = ({ children }: { children: ReactNode }) => (
  <span style={{ color: '#2A5A3C', fontWeight: 700 }}>{children}</span>
);

export { OTTER_INTRO, OTTER_MID, OTTER_OUTRO };
