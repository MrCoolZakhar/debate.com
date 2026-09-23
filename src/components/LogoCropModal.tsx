'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LogoCropModal, the circle crop for every round picture an organiser or a
// delegation uploads: conference logos, committee emblems, delegation logos.
//
// Owner, 23 Sep 2026: "I want them to crop, but within a circle." The earlier
// version previewed a small 280px disc, started square artwork on FILL (the
// corners cut off), mapped a dashed ring 6% inside the disc onto the export and
// then LogoDisc added another 7% margin on top, so what shipped was both small
// and tightly cropped. Now:
//
//   · The CIRCLE on screen is exactly what ships. The square stage around it
//     shows the rest of the picture dimmed, so the organiser sees what the
//     circle leaves out. There is no inner "safe ring" any more.
//   · It OPENS on "Whole logo": the artwork's real outline (alpha for a
//     transparent file, the flat corner colour for a JPEG) is measured, and the
//     picture is scaled so every pixel of it sits inside the circle. A round
//     seal therefore fills the circle; a square or wide logo fits by its
//     corners.
//   · Zoom goes down to 50% of that fit (more empty room around the logo) and
//     up to well past "Fill circle". Zoom keeps the point under the circle's
//     centre still. Drag, pinch, the wheel, the slider and the keyboard
//     (arrows move, + and - zoom) all work.
//   · On save the circle is drawn onto a 768 x 768 TRANSPARENT PNG, clipped to
//     the circle. Empty room around a zoomed-out logo stays transparent: the
//     white disc behind a conference logo comes from LogoDisc, and an emblem
//     (`bare`) floats on its surface. LogoDisc draws a square picture edge to
//     edge, so the export's circle is the disc's circle.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useModalEscape } from '@/components/ModalOverlay';

const STAGE_MAX = 340;         // square preview stage (px), shrinks on phones
const CIRCLE_RATIO = 0.84;     // circle diameter as a share of the stage
const OUT = 768;               // exported square canvas (px)
const MIN_ZOOM = 0.5;          // of "whole logo"
const MAX_ZOOM_FLOOR = 4;
const MAX_ZOOM_CEIL = 12;
const MIN_OVERLAP = 24;        // px of picture that must stay over the circle
const SCAN_MAX = 256;          // analysis downscale
const ALPHA_MIN = 16;          // alpha above this counts as content
const BG_TOLERANCE = 12;       // per-channel distance from the corner colour

/** The artwork's centre and the radius that encloses all of it, in natural px. */
type Content = { cx: number; cy: number; r: number; w: number; h: number };
/** s = preview px per natural px; x, y = picture centre offset from the circle centre. */
type View = { s: number; x: number; y: number };
type Mode = 'fit' | 'fill';

function fullFrame(nw: number, nh: number): Content {
  return { cx: nw / 2, cy: nh / 2, r: Math.hypot(nw, nh) / 2, w: nw, h: nh };
}

/** Scan the picture on a small canvas and find where the artwork really is. */
function analyzeImage(img: HTMLImageElement, nw: number, nh: number): Content {
  const full = fullFrame(nw, nh);
  try {
    const ds = Math.min(1, SCAN_MAX / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * ds));
    const h = Math.max(1, Math.round(nh * ds));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return full;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) { hasAlpha = true; break; }
    }
    let isContent: (i: number) => boolean;
    if (hasAlpha) {
      isContent = (i) => data[i + 3] > ALPHA_MIN;
    } else {
      const px = (x: number, y: number) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
      const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
      const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4);
      // Corners that disagree = edge-to-edge artwork (a photo, a full-bleed
      // seal): the whole frame is the artwork.
      const agree = corners.every((p) => p.every((v, c) => Math.abs(v - bg[c]) <= BG_TOLERANCE * 2));
      if (!agree) return full;
      isContent = (i) =>
        Math.abs(data[i] - bg[0]) > BG_TOLERANCE ||
        Math.abs(data[i + 1] - bg[1]) > BG_TOLERANCE ||
        Math.abs(data[i + 2] - bg[2]) > BG_TOLERANCE;
    }

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isContent((y * w + x) * 4)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return full; // blank picture
    // Centre on the bounding box, then find the farthest content pixel from it:
    // that radius is what "the whole logo inside the circle" has to hold.
    const ccx = (minX + maxX + 1) / 2;
    const ccy = (minY + maxY + 1) / 2;
    let r2 = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isContent((y * w + x) * 4)) continue;
        // The pixel's far corner, so anti-aliased edges are never shaved.
        const dx = Math.abs(x + 0.5 - ccx) + 0.5;
        const dy = Math.abs(y + 0.5 - ccy) + 0.5;
        const d = dx * dx + dy * dy;
        if (d > r2) r2 = d;
      }
    }
    return {
      cx: ccx / ds,
      cy: ccy / ds,
      r: Math.min(full.r, (Math.sqrt(r2) + 1) / ds),
      w: (maxX - minX + 1) / ds,
      h: (maxY - minY + 1) / ds,
    };
  } catch {
    return full;
  }
}

export function LogoCropModal({
  file,
  onCancel,
  onSave,
  bare = false,
}: {
  /** The image file that was picked. */
  file: File;
  onCancel: () => void;
  /** Receives the 768 x 768 transparent PNG, the circle clipped. */
  onSave: (blob: Blob) => void;
  /**
   * Preview the way the picture really ships on its surface. Conference and
   * delegation logos sit on LogoDisc's near-white disc, so the circle is white
   * behind them. Committee emblems float on their surface (`LogoDisc bare`,
   * CommitteeEmblem), so the circle shows the transparency checks instead.
   */
  bare?: boolean;
}) {
  useScrollLock(true);

  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  // Stage size is fixed per open: the modal is never resized mid-crop in practice,
  // and every offset below is in these px.
  const [stage] = useState(() =>
    typeof window === 'undefined' ? STAGE_MAX : Math.max(220, Math.min(STAGE_MAX, window.innerWidth - 72)),
  );
  const D = Math.round(stage * CIRCLE_RATIO);

  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fits, setFits] = useState<{ fit: View; fill: View; sFit: number; maxZoom: number } | null>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [mode, setMode] = useState<Mode | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refs mirror the state for the native wheel listener and for gestures that
  // compute from the latest value; they are written together with the state.
  const viewRef = useRef(view);
  const fitsRef = useRef(fits);
  const naturalRef = useRef(natural);
  function commit(v: View) {
    viewRef.current = v;
    setView(v);
  }

  function clamp(v: View): View {
    const n = naturalRef.current;
    if (!n) return v;
    const w = n.w * v.s;
    const h = n.h * v.s;
    const mx = Math.max(0, D / 2 + w / 2 - MIN_OVERLAP);
    const my = Math.max(0, D / 2 + h / 2 - MIN_OVERLAP);
    return { s: v.s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }

  /** Zoom to an absolute level (1 = whole logo), keeping the circle's centre still. */
  function zoomTo(z: number) {
    const f = fitsRef.current;
    if (!f) return;
    const nz = Math.min(f.maxZoom, Math.max(MIN_ZOOM, z));
    const prev = viewRef.current;
    const s = nz * f.sFit;
    const k = s / prev.s;
    commit(clamp({ s, x: prev.x * k, y: prev.y * k }));
    setMode(null);
  }

  function applyMode(m: Mode) {
    if (!fits) return;
    commit({ ...fits[m] });
    setMode(m);
  }

  function onImageLoad(el: HTMLImageElement) {
    // SVGs without an intrinsic size report 0: treat them as square.
    const nw = el.naturalWidth || 512;
    const nh = el.naturalHeight || 512;
    setNatural({ w: nw, h: nh });
    naturalRef.current = { w: nw, h: nh };
    const c = analyzeImage(el, nw, nh);
    const sFit = D / 2 / c.r;
    const sFill = Math.max(D / c.w, D / c.h);
    const place = (s: number): View => ({ s, x: -(c.cx - nw / 2) * s, y: -(c.cy - nh / 2) * s });
    const maxZoom = Math.min(MAX_ZOOM_CEIL, Math.max(MAX_ZOOM_FLOOR, (sFill / sFit) * 2));
    const next = { fit: place(sFit), fill: place(Math.max(sFit, sFill)), sFit, maxZoom };
    fitsRef.current = next;
    setFits(next);
    commit(next.fit);
    setMode('fit');
  }

  // ── Pointer: one finger drags, two fingers pinch ─────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ px: number; py: number; vx: number; vy: number; dist: number; s: number } | null>(null);

  function startGesture() {
    const pts = [...pointers.current.values()];
    const v = viewRef.current;
    if (pts.length === 1) {
      gesture.current = { px: pts[0].x, py: pts[0].y, vx: v.x, vy: v.y, dist: 0, s: v.s };
    } else if (pts.length >= 2) {
      gesture.current = {
        px: (pts[0].x + pts[1].x) / 2,
        py: (pts[0].y + pts[1].y) / 2,
        vx: v.x,
        vy: v.y,
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        s: v.s,
      };
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const f = fitsRef.current;
    if (!g || !f) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const z = Math.min(f.maxZoom, Math.max(MIN_ZOOM, (g.s * dist) / g.dist / f.sFit));
      const s = z * f.sFit;
      const k = s / g.s;
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      commit(clamp({ s, x: g.vx * k + (mx - g.px), y: g.vy * k + (my - g.py) }));
    } else {
      commit(clamp({ s: g.s, x: g.vx + (e.clientX - g.px), y: g.vy + (e.clientY - g.py) }));
    }
    setMode(null);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) startGesture();
    else { gesture.current = null; setDragging(false); }
  }

  // Wheel / trackpad pinch zoom. Native and non-passive so the page never scrolls.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const f = fitsRef.current;
      if (!f) return;
      e.preventDefault();
      const cur = viewRef.current.s / f.sFit;
      zoomTo(cur * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // zoomTo reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes (not while saving), through the shared stack so it never
  // also closes the editor or dialog the crop tool opened over.
  useModalEscape(() => { if (!saving) onCancel(); });

  function onStageKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!fits) return;
    const step = e.shiftKey ? 12 : 3;
    const v = viewRef.current;
    const move = (dx: number, dy: number) => { e.preventDefault(); commit(clamp({ s: v.s, x: v.x + dx, y: v.y + dy })); setMode(null); };
    if (e.key === 'ArrowLeft') move(-step, 0);
    else if (e.key === 'ArrowRight') move(step, 0);
    else if (e.key === 'ArrowUp') move(0, -step);
    else if (e.key === 'ArrowDown') move(0, step);
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo((v.s / fits.sFit) * 1.1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo((v.s / fits.sFit) / 1.1); }
  }

  const drawnW = natural ? natural.w * view.s : 0;
  const drawnH = natural ? natural.h * view.s : 0;

  function handleSave() {
    const img = imgRef.current;
    if (!img || !natural || saving) return;
    setSaving(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setSaving(false); return; }
    const k = OUT / D;
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      OUT / 2 + view.x * k - (drawnW * k) / 2,
      OUT / 2 + view.y * k - (drawnH * k) / 2,
      drawnW * k,
      drawnH * k,
    );
    canvas.toBlob((blob) => {
      setSaving(false);
      if (blob) onSave(blob);
    }, 'image/png');
  }

  const zoom = fits ? view.s / fits.sFit : 1;
  const zoomPct = Math.round(zoom * 100);
  const noun = bare ? 'emblem' : 'logo';
  const checks = 'repeating-conic-gradient(#E6DFCF 0% 25%, #F5F1E8 0% 50%) 50% / 16px 16px';
  const circleInset = (stage - D) / 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Position your ${noun}`}>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={() => { if (!saving) onCancel(); }}
      />
      <div
        className="relative rounded-2xl p-5"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: `min(${stage + 40}px, 94vw)`, boxShadow: '0 24px 64px rgba(27,56,40,0.28)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
            Position your {noun}
          </p>
          <button
            onClick={() => { if (!saving) onCancel(); }}
            className="focus:outline-none flex items-center justify-center"
            style={{ color: '#6B5F52', background: 'none', border: 'none', cursor: 'pointer', width: 32, height: 32, marginRight: -6 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* The stage: the whole picture, dimmed outside the circle that ships. */}
        <div className="flex justify-center">
          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label={`Crop area. Drag or use the arrow keys to move the ${noun}, plus and minus to zoom.`}
            onKeyDown={onStageKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{
              position: 'relative',
              width: `${stage}px`,
              height: `${stage}px`,
              borderRadius: 16,
              background: checks,
              overflow: 'hidden',
              touchAction: 'none',
              cursor: dragging ? 'grabbing' : 'grab',
            }}
          >
            {/* What sits behind the logo once it ships (LogoDisc's white disc). */}
            {!bare && (
              <div
                aria-hidden
                style={{ position: 'absolute', inset: circleInset, borderRadius: '9999px', backgroundColor: '#FDFCF9' }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={(e) => onImageLoad(e.currentTarget)}
              style={{
                position: 'absolute',
                left: `${stage / 2 + view.x - drawnW / 2}px`,
                top: `${stage / 2 + view.y - drawnH / 2}px`,
                width: `${drawnW}px`,
                height: `${drawnH}px`,
                maxWidth: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: natural ? 1 : 0,
              }}
            />
            {/* Dim everything outside the circle; a light rim marks its edge. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: circleInset,
                borderRadius: '9999px',
                boxShadow: '0 0 0 9999px rgba(28,20,16,0.55), inset 0 0 0 1.5px rgba(255,255,255,0.9)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Whole logo / Fill circle */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {(['fit', 'fill'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => applyMode(m)}
                disabled={!fits}
                className="rounded-full px-4 py-1.5 text-[12px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  border: `1.5px solid ${active ? '#1B3828' : '#DDD4C0'}`,
                  backgroundColor: active ? '#1B3828' : 'transparent',
                  color: active ? '#EED98A' : '#4A3F33',
                  cursor: fits ? 'pointer' : 'default',
                  opacity: fits ? 1 : 0.6,
                }}
                aria-pressed={active}
              >
                {m === 'fit' ? `Whole ${noun}` : 'Fill circle'}
              </button>
            );
          })}
        </div>

        <p
          className="flex items-center justify-center gap-1.5 text-[12px]"
          style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500, margin: '10px 0 0 0', textAlign: 'center' }}
        >
          <Move size={12} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          Drag to move. What is inside the circle is what people see.
        </p>

        {/* Zoom: 100% = the whole logo inside the circle */}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => zoomTo(zoom / 1.15)}
            disabled={!fits}
            aria-label="Zoom out"
            className="focus:outline-none flex items-center justify-center"
            style={{ color: '#6B5F52', background: 'none', border: 'none', cursor: 'pointer', width: 28, height: 28, flexShrink: 0 }}
          >
            <ZoomOut size={16} strokeWidth={2.2} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={fits?.maxZoom ?? MAX_ZOOM_FLOOR}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomTo(parseFloat(e.target.value))}
            disabled={!fits}
            className="flex-1"
            style={{ accentColor: '#1B3828', cursor: 'pointer', minWidth: 0 }}
            aria-label="Zoom"
            aria-valuetext={`${zoomPct}%`}
          />
          <button
            type="button"
            onClick={() => zoomTo(zoom * 1.15)}
            disabled={!fits}
            aria-label="Zoom in"
            className="focus:outline-none flex items-center justify-center"
            style={{ color: '#6B5F52', background: 'none', border: 'none', cursor: 'pointer', width: 28, height: 28, flexShrink: 0 }}
          >
            <ZoomIn size={16} strokeWidth={2.2} />
          </button>
          <span
            className="text-[12px] text-right"
            style={{ color: '#4A3F33', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: '42px', flexShrink: 0 }}
          >
            {zoomPct}%
          </span>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => { if (!saving) onCancel(); }}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !natural}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
            style={{
              backgroundColor: saving || !natural ? '#DDD4C0' : '#1B3828',
              color: saving || !natural ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              border: 'none',
              cursor: saving || !natural ? 'default' : 'pointer',
            }}
          >
            {saving ? 'SAVING...' : `SAVE ${noun.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
