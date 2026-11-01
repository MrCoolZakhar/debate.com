'use client';
// Gavelling Crisis: the still and animated change maps (MapSnapshot, ChangesReplay) can be zoomed and moved: scroll or
// pinch to zoom around the pointer, drag to move, and + / - / Fit buttons in the corner. The picture is drawn once in
// "picture pixels"; this component only keeps a zoom (k) and a shift (tx, ty) and hands them to the drawing, which puts its
// land and shapes in a group with that transform (strokes stay the same width on screen) and moves each token to
// its zoomed spot WITHOUT scaling it, so icons and labels stay small and readable however far you zoom in.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { CK } from '../../crisisKit';

export interface Zoom { k: number; tx: number; ty: number }
export const NO_ZOOM: Zoom = { k: 1, tx: 0, ty: 0 };
export const MAX_ZOOM = 14;
/** The drawing reaches this many pictures beyond the frame on every side, so moving the map never shows an empty edge. */
export const ZOOM_MARGIN = 1;

/** The group transform that zooms the land and shapes. */
export const zoomTransform = (z: Zoom): string => `translate(${z.tx.toFixed(2)} ${z.ty.toFixed(2)}) scale(${z.k.toFixed(4)})`;
/** Where a point of the picture is on screen after the zoom (tokens use it so they are moved, never scaled). */
export const zoomPt = (z: Zoom, p: [number, number]): [number, number] => [p[0] * z.k + z.tx, p[1] * z.k + z.ty];

function clampZoom(z: Zoom, w: number, h: number): Zoom {
  const k = Math.max(1, Math.min(MAX_ZOOM, z.k));
  // The drawing spans [-margin, 1 + margin] pictures; the frame must stay inside it.
  const m = ZOOM_MARGIN;
  const tx = Math.max(w - (1 + m) * w * k, Math.min(m * w * k, z.tx));
  const ty = Math.max(h - (1 + m) * h * k, Math.min(m * h * k, z.ty));
  return { k, tx, ty };
}

export default function ZoomSvg({ w, h, label, style, children }: {
  w: number; h: number; label: string; style?: CSSProperties;
  /** The drawing, given the current zoom. */
  children: (z: Zoom) => ReactNode;
}) {
  const [z, setZ] = useState<Zoom>(NO_ZOOM);
  const [dragging, setDragging] = useState(false);
  const zRef = useRef<Zoom>(NO_ZOOM);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null);

  const apply = useCallback((next: Zoom) => {
    const c = clampZoom(next, w, h);
    zRef.current = c; setZ(c);
  }, [w, h]);
  /** Client pixels to picture pixels. */
  const local = useCallback((cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return { x: w / 2, y: h / 2, sx: 1, sy: 1 };
    return { x: ((cx - r.left) * w) / r.width, y: ((cy - r.top) * h) / r.height, sx: w / r.width, sy: h / r.height };
  }, [w, h]);
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    const cur = zRef.current;
    const k = Math.max(1, Math.min(MAX_ZOOM, cur.k * factor));
    const f = k / cur.k;
    apply({ k, tx: px - (px - cur.tx) * f, ty: py - (py - cur.ty) * f });
  }, [apply]);

  // The wheel needs a listener that may stop the page from scrolling; it lets the page scroll when there is nothing left to zoom out of.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (zRef.current.k <= 1.0001 && e.deltaY > 0) return;
      e.preventDefault();
      const p = local(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)), p.x, p.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [local, zoomAt]);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button > 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* an old browser */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const p = local(mx, my); const q = local(pinch.current.mx, pinch.current.my);
      const cur = zRef.current;
      const k = Math.max(1, Math.min(MAX_ZOOM, cur.k * (d / pinch.current.d)));
      const f = k / cur.k;
      apply({ k, tx: p.x - (q.x - cur.tx) * f, ty: p.y - (q.y - cur.ty) * f });
      pinch.current = { d, mx, my };
      return;
    }
    const s = local(e.clientX, e.clientY);
    const cur = zRef.current;
    apply({ ...cur, tx: cur.tx + (e.clientX - prev.x) * s.sx, ty: cur.ty + (e.clientY - prev.y) * s.sy });
  };
  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) setDragging(false);
  };
  const center = () => ({ x: w / 2, y: h / 2 });
  const moved = z.k !== 1 || z.tx !== 0 || z.ty !== 0;

  const btn: CSSProperties = {
    width: 28, height: 28, borderRadius: 9, border: 0, background: 'rgba(255,255,255,0.94)', color: CK.ink, cursor: 'pointer', display: 'grid', placeItems: 'center',
    boxShadow: '0 0 0 1px rgba(27,56,40,0.1), 0 1px 4px rgba(27,56,40,0.18)', padding: 0,
  };
  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', ...style }}
      >
        {children(z)}
      </svg>
      <div className="flex flex-col" style={{ position: 'absolute', top: 8, right: 8, gap: 5 }}>
        <button type="button" aria-label="Zoom in" title="Zoom in" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424]" style={btn} onClick={() => { const c = center(); zoomAt(1.6, c.x, c.y); }}><Plus size={15} strokeWidth={1.5} /></button>
        <button type="button" aria-label="Zoom out" title="Zoom out" disabled={z.k <= 1.0001} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424]" style={{ ...btn, opacity: z.k <= 1.0001 ? 0.5 : 1, cursor: z.k <= 1.0001 ? 'default' : 'pointer' }} onClick={() => { const c = center(); zoomAt(1 / 1.6, c.x, c.y); }}><Minus size={15} strokeWidth={1.5} /></button>
        {moved && <button type="button" aria-label="Fit the changes" title="Fit the changes" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424]" style={btn} onClick={() => apply(NO_ZOOM)}><Maximize2 size={14} strokeWidth={1.5} /></button>}
      </div>
    </div>
  );
}
