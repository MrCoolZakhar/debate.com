'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LogoCropModal, drag-to-fit crop step for conference logo uploads.
//
// Shown when an organiser picks a logo file, BEFORE the upload happens. The
// image is draggable inside a large circular preview (the exact LogoDisc look:
// near-white backdrop, soft forest shadow) with a zoom slider and a dashed
// safe-margin ring at the 6%-inset boundary, whatever sits inside the ring
// is what ships.
//
// SMART AUTO-FIT: on load the image is scanned on a small offscreen canvas to
// find the artwork's REAL bounding box, alpha bounds for transparent images;
// for fully opaque files (JPEGs) the 4 corners are sampled for the background
// colour and near-background border pixels are treated as padding. That
// content box (not the file's frame) is what gets placed, so logos with
// baked-in whitespace land correctly sized instead of tiny.
//
// Roughly square content (ratio 0.8–1.25) defaults to FILL, the artwork
// covers the safe circle, corners get cut, the classic seal/square-logo look.
// Clearly rectangular content defaults to FIT, fully contained inside the
// dashed ring. Two chips re-apply either placement instantly; dragging and
// zooming afterwards stay free.
//
// On SAVE the chosen offset/scale is composited client-side onto a 512×512
// TRANSPARENT canvas (clipped to the circle, so artwork can never poke past
// LogoDisc's rim at render time (with a slim 6% margin), the disc backdrop is applied by
// LogoDisc, never baked into the asset) and handed back via onSave(blob).
// No schema changes, the crop is flattened into the uploaded asset.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

const DISC = 280;              // preview disc diameter (px)
const SAFE = DISC * 0.88;      // safe-area diameter, 6% margin each side (crop less)
const OUT = 512;               // exported square canvas (px)
const MIN_ZOOM = 0.5;
const BASE_MAX_ZOOM = 3;       // slider ceiling; extended when content box is small
const HARD_MAX_ZOOM = 10;      // absolute ceiling even for tiny content boxes
const MIN_OVERLAP = 24;        // px of image that must stay over the safe area
const SCAN_MAX = 256;          // analysis downscale, plenty for a bounding box
const ALPHA_MIN = 16;          // alpha above this counts as content
const BG_TOLERANCE = 12;       // per-channel distance from corner-sampled background

type Box = { x: number; y: number; w: number; h: number };
type FitMode = 'fit' | 'fill';
type Placement = { zoom: number; offset: { x: number; y: number } };
type Fits = { fit: Placement; fill: Placement; maxZoom: number };

// ── Pure analysis helpers (mirrored 1:1 in the crop-math sanity script) ──────

/** Find the artwork's bounding box in raw RGBA data. */
function contentBoxFromRGBA(data: Uint8ClampedArray, w: number, h: number): Box {
  const full: Box = { x: 0, y: 0, w, h };

  // Does the image use transparency at all?
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) { hasAlpha = true; break; }
  }

  let isContent: (i: number) => boolean;
  if (hasAlpha) {
    isContent = (i) => data[i + 3] > ALPHA_MIN;
  } else {
    // Opaque file (JPEG etc.), sample the 4 corners for the background
    // colour; near-background pixels count as padding.
    const corner = (x: number, y: number): number[] => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
    const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4);
    // Corners that disagree = edge-to-edge artwork (photo, full-bleed seal) —
    // trimming against an averaged "background" would eat real content.
    const cornersAgree = corners.every((p) => p.every((v, c) => Math.abs(v - bg[c]) <= BG_TOLERANCE * 2));
    if (!cornersAgree) return full;
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
  if (maxX < 0) return full; // blank image, keep the full frame
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Roughly square content fills the circle; rectangular content fits inside. */
function pickMode(box: Box): FitMode {
  const r = box.w / box.h;
  return r >= 0.8 && r <= 1.25 ? 'fill' : 'fit';
}

/** Screen scale (natural px → preview px) that realises a mode for a content box. */
function scaleFor(mode: FitMode, box: Box): number {
  return mode === 'fill'
    ? Math.max(SAFE / box.w, SAFE / box.h)   // cover: content spans the safe circle, corners cut
    : SAFE / Math.hypot(box.w, box.h);       // contain: content diagonal inside the ring
}

/** Scan the loaded image on a small offscreen canvas → content box in natural px. */
function analyzeImage(img: HTMLImageElement, nw: number, nh: number): Box {
  const full: Box = { x: 0, y: 0, w: nw, h: nh };
  try {
    const ds = Math.min(1, SCAN_MAX / Math.max(nw, nh));
    const cw = Math.max(1, Math.round(nw * ds));
    const ch = Math.max(1, Math.round(nh * ds));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return full;
    ctx.drawImage(img, 0, 0, cw, ch);
    const box = contentBoxFromRGBA(ctx.getImageData(0, 0, cw, ch).data, cw, ch);
    if (box.x === 0 && box.y === 0 && box.w === cw && box.h === ch) return full;
    // Back to natural px, with a 1-scan-px pad so anti-aliased edges survive.
    const pad = 1;
    const x = Math.max(0, (box.x - pad) / ds);
    const y = Math.max(0, (box.y - pad) / ds);
    return {
      x,
      y,
      w: Math.min(nw - x, (box.w + pad * 2) / ds),
      h: Math.min(nh - y, (box.h + pad * 2) / ds),
    };
  } catch {
    return full; // decode/CORS oddity, behave exactly like the pre-scan modal
  }
}

export function LogoCropModal({
  file,
  onCancel,
  onSave,
}: {
  /** The image file the organiser picked. */
  file: File;
  onCancel: () => void;
  /** Receives the flattened 512×512 transparent PNG. */
  onSave: (blob: Blob) => void;
}) {
  // Modal: freeze the page behind while the crop tool is open.
  useScrollLock(true);

  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fits, setFits] = useState<Fits | null>(null);
  const [mode, setMode] = useState<FitMode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const maxZoom = fits?.maxZoom ?? BASE_MAX_ZOOM;

  // Contain-fit the artwork's FRAME into the safe area at zoom 1 (the zoom
  // slider's reference point, auto-fit then picks the zoom that places the
  // detected content box).
  const baseFit = natural ? Math.min(SAFE / natural.w, SAFE / natural.h) : 0;
  const drawnW = natural ? natural.w * baseFit * zoom : 0;
  const drawnH = natural ? natural.h * baseFit * zoom : 0;

  function clampOffset(x: number, y: number, w: number, h: number) {
    // The image can always be dragged, but some of it must remain over the
    // safe area so the composition stays sane. The bound also unions with the
    // FIT/FILL placements so the overlap rule can never fight cover mode.
    const reach = Math.max(
      0,
      fits ? Math.max(Math.abs(fits.fit.offset.x), Math.abs(fits.fill.offset.x), Math.abs(fits.fit.offset.y), Math.abs(fits.fill.offset.y)) : 0,
    );
    const maxX = Math.max(0, SAFE / 2 + w / 2 - MIN_OVERLAP, reach);
    const maxY = Math.max(0, SAFE / 2 + h / 2 - MIN_OVERLAP, reach);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function handleZoom(next: number) {
    const z = Math.min(maxZoom, Math.max(MIN_ZOOM, next));
    setZoom(z);
    setMode(null); // manual zoom, chips release
    if (natural) {
      const w = natural.w * baseFit * z;
      const h = natural.h * baseFit * z;
      setOffset((prev) => clampOffset(prev.x, prev.y, w, h));
    }
  }

  /** Snap to a stored FIT/FILL placement, exact, no clamping. */
  function applyMode(m: FitMode) {
    if (!fits) return;
    const p = fits[m];
    setZoom(p.zoom);
    setOffset({ ...p.offset });
    setMode(m);
  }

  function onImageLoad(el: HTMLImageElement) {
    // SVGs without intrinsic dimensions report 0, fall back square.
    const nw = el.naturalWidth || 512;
    const nh = el.naturalHeight || 512;
    setNatural({ w: nw, h: nh });

    // Smart auto-fit: place the detected CONTENT box, not the file's frame.
    const box = analyzeImage(el, nw, nh);
    const bf = Math.min(SAFE / nw, SAFE / nh);
    const zFillRaw = scaleFor('fill', box) / bf;
    const ceiling = Math.min(
      HARD_MAX_ZOOM,
      Math.max(BASE_MAX_ZOOM, Math.ceil(zFillRaw * 1.25 * 100) / 100),
    );
    const place = (m: FitMode): Placement => {
      const z = Math.min(ceiling, Math.max(MIN_ZOOM, scaleFor(m, box) / bf));
      const s = z * bf;
      return {
        zoom: z,
        // Centre the content box (not the frame) on the disc centre.
        offset: {
          x: -(box.x + box.w / 2 - nw / 2) * s,
          y: -(box.y + box.h / 2 - nh / 2) * s,
        },
      };
    };
    const nextFits: Fits = { fit: place('fit'), fill: place('fill'), maxZoom: ceiling };
    setFits(nextFits);
    const initial = pickMode(box);
    setMode(initial);
    setZoom(nextFits[initial].zoom);
    setOffset({ ...nextFits[initial].offset });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = dragStart.current;
    if (!s || !natural) return;
    setMode(null); // manual drag, chips release
    setOffset(clampOffset(s.ox + (e.clientX - s.px), s.oy + (e.clientY - s.py), drawnW, drawnH));
  }

  function onPointerUp() {
    dragStart.current = null;
    setDragging(false);
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !natural || saving) return;
    setSaving(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setSaving(false); return; }
    // Map the preview's SAFE circle onto the full canvas: LogoDisc re-applies
    // the 6% margin at render time, so what's inside the ring lands exactly
    // where the preview shows it. Clip to the circle so no corner of the
    // artwork can ever reach the disc rim.
    const k = OUT / SAFE;
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      OUT / 2 + offset.x * k - (drawnW * k) / 2,
      OUT / 2 + offset.y * k - (drawnH * k) / 2,
      drawnW * k,
      drawnH * k,
    );
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onSave(blob);
      },
      'image/png',
    );
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={() => { if (!saving) onCancel(); }}
      />
      <div
        className="relative rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 'min(400px, 92vw)', boxShadow: '0 24px 64px rgba(27,56,40,0.28)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
            Position Your Logo
          </p>
          <button
            onClick={() => { if (!saving) onCancel(); }}
            className="focus:outline-none"
            style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Circular preview, exactly how the logo will look inside LogoDisc */}
        <div className="flex justify-center">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: 'relative',
              width: `${DISC}px`,
              height: `${DISC}px`,
              borderRadius: '9999px',
              backgroundColor: '#FDFCF9',
              border: '1px solid rgba(221,212,192,0.6)',
              boxShadow: '0 4px 12px rgba(27,56,40,0.15)',
              overflow: 'hidden',
              touchAction: 'none',
              cursor: dragging ? 'grabbing' : 'grab',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={(e) => onImageLoad(e.currentTarget)}
              style={{
                position: 'absolute',
                left: `${DISC / 2 + offset.x - drawnW / 2}px`,
                top: `${DISC / 2 + offset.y - drawnH / 2}px`,
                width: `${drawnW}px`,
                height: `${drawnH}px`,
                maxWidth: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: natural ? 1 : 0,
              }}
            />
            {/* Safe-margin ring, the 6%-inset boundary the artwork ships inside */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: '6%',
                borderRadius: '9999px',
                border: '1px dashed rgba(27,56,40,0.28)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Fit / Fill quick actions, content-box based, drag stays free after */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {(['fit', 'fill'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => applyMode(m)}
                disabled={!fits}
                className="rounded-full px-4 py-1 text-[11px] font-bold focus:outline-none"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.08em',
                  border: `1.5px solid ${active ? '#1B3828' : '#DDD4C0'}`,
                  backgroundColor: active ? '#1B3828' : 'transparent',
                  color: active ? '#EED98A' : '#6B5F52',
                  cursor: fits ? 'pointer' : 'default',
                  opacity: fits ? 1 : 0.6,
                }}
                title={m === 'fit' ? 'Whole artwork inside the ring' : 'Artwork covers the circle, corners get cut'}
              >
                {m === 'fit' ? 'FIT' : 'FILL'}
              </button>
            );
          })}
        </div>

        <p
          className="flex items-center justify-center gap-1.5 mt-2 text-[11.5px]"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 500, margin: '8px 0 0 0' }}
        >
          <Move size={12} strokeWidth={2.2} />
          Drag to position, keep your artwork inside the dashed ring
        </p>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mt-4">
          <ZoomOut size={15} strokeWidth={2.2} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <input
            type="range"
            min={MIN_ZOOM}
            max={maxZoom}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(parseFloat(e.target.value))}
            className="flex-1"
            style={{ accentColor: '#1B3828', cursor: 'pointer' }}
            aria-label="Zoom"
          />
          <ZoomIn size={15} strokeWidth={2.2} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span
            className="text-[12px] text-right"
            style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: '42px', flexShrink: 0 }}
          >
            {zoomPct}%
          </span>
        </div>

        {/* Actions, house modal recipe */}
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
            {saving ? 'SAVING...' : 'SAVE LOGO'}
          </button>
        </div>
      </div>
    </div>
  );
}
