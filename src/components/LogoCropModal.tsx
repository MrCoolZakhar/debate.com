'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LogoCropModal — drag-to-fit crop step for conference logo uploads.
//
// Shown when an organiser picks a logo file, BEFORE the upload happens. The
// image is draggable inside a large circular preview (the exact LogoDisc look:
// near-white backdrop, soft forest shadow) with a zoom slider and a dashed
// safe-margin ring at the 12%-inset boundary — whatever sits inside the ring
// is what ships.
//
// On SAVE the chosen offset/scale is composited client-side onto a 512×512
// TRANSPARENT canvas (clipped to the circle, so artwork can never poke past
// LogoDisc's rim at render time — the disc backdrop itself is applied by
// LogoDisc, never baked into the asset) and handed back via onSave(blob).
// No schema changes — the crop is flattened into the uploaded asset.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';

const DISC = 280;              // preview disc diameter (px)
const SAFE = DISC * 0.76;      // safe-area diameter — 12% margin each side
const OUT = 512;               // exported square canvas (px)
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const MIN_OVERLAP = 24;        // px of image that must stay over the safe area

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
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Contain-fit the artwork into the safe area at zoom 1.
  const baseFit = natural ? Math.min(SAFE / natural.w, SAFE / natural.h) : 0;
  const drawnW = natural ? natural.w * baseFit * zoom : 0;
  const drawnH = natural ? natural.h * baseFit * zoom : 0;

  function clampOffset(x: number, y: number, w: number, h: number) {
    // The image can always be dragged, but some of it must remain over the
    // safe area so the composition stays sane.
    const maxX = Math.max(0, SAFE / 2 + w / 2 - MIN_OVERLAP);
    const maxY = Math.max(0, SAFE / 2 + h / 2 - MIN_OVERLAP);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function handleZoom(next: number) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom(z);
    if (natural) {
      const w = natural.w * baseFit * z;
      const h = natural.h * baseFit * z;
      setOffset(prev => clampOffset(prev.x, prev.y, w, h));
    }
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
    // the 12% margin at render time, so what's inside the ring lands exactly
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

        {/* Circular preview — exactly how the logo will look inside LogoDisc */}
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
              border: '1px solid rgba(221,212,192,0.8)',
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
              onLoad={(e) => {
                const el = e.currentTarget;
                // SVGs without intrinsic dimensions report 0 — fall back square.
                setNatural({ w: el.naturalWidth || 512, h: el.naturalHeight || 512 });
              }}
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
            {/* Safe-margin ring — the 12%-inset boundary the artwork ships inside */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: '12%',
                borderRadius: '9999px',
                border: '1.5px dashed rgba(27,56,40,0.35)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        <p
          className="flex items-center justify-center gap-1.5 mt-3 text-[11.5px]"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 500, margin: '12px 0 0 0' }}
        >
          <Move size={12} strokeWidth={2.2} />
          Drag to position — keep your artwork inside the dashed ring
        </p>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mt-4">
          <ZoomOut size={15} strokeWidth={2.2} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
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

        {/* Actions — house modal recipe */}
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
