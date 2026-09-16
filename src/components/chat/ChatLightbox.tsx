'use client';

/**
 * The in-app photo viewer for chat images and GIFs.
 *
 * A picture sent in a committee used to open in a new browser tab, which on a phone means
 * leaving the session: the delegate loses the thread, the chair loses the dais. This opens it
 * over the app instead, and closing it puts them back exactly where they were.
 *
 * What it does: dark backdrop, the photo fitted to the screen, pinch or scroll to zoom, drag
 * to pan when zoomed, swipe (touch) or the arrow keys to move through the images of THAT
 * conversation, Escape or a tap on the backdrop to close. "Open original" is still there for
 * anyone who wants the raw file.
 *
 * Positioning: this portals to `document.body`, NOT through `@/components/Portal`. Portal
 * prefers `#fit-root`, which FitToScreen scales, and on the delegate page the chat lives in a
 * `Sheet` that is itself a body child at z-index 1000 — a layer inside fit-root would render
 * underneath it. At body level the coordinates are plain viewport pixels, so the gesture maths
 * needs no scale correction either.
 *
 * Session rules: it reads props only. No committee state, no `updateLocal`, no
 * `localUpdateTime`, no database write (AGENTS.md rules 3 to 5).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, X } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import type { TFn } from './chatTokens';

export interface LightboxItem {
  /** The message (or outbox) id the photo came from — the viewer's identity for this thread. */
  id: string;
  kind: 'image' | 'gif';
  /** The full-size file. Also what "Open original" points at. */
  url: string;
  /** GIF only: the small animated rendition, shown until the original has decoded. */
  previewUrl?: string;
  name: string;
  /** "France · 14:05" under the title. */
  caption?: string;
  width?: number;
  height?: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_SCALE = 2.6;
/** Touch drag distances at rest: past these a swipe changes photo / closes the viewer. */
const SWIPE_X = 64;
const SWIPE_CLOSE_Y = 120;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View { scale: number; x: number; y: number }
const REST: View = { scale: 1, x: 0, y: 0 };

export default function ChatLightbox({
  items,
  openId,
  onOpenId,
  onClose,
  t,
}: {
  /** Every photo in the open conversation, oldest first. */
  items: LightboxItem[];
  /** Which one is showing. */
  openId: string;
  onOpenId: (id: string) => void;
  onClose: () => void;
  t: TFn;
}) {
  const index = useMemo(() => items.findIndex((i) => i.id === openId), [items, openId]);
  const item = index >= 0 ? items[index] : null;

  // The photo was deleted or its thread changed underneath the viewer: step out rather than
  // showing an empty stage.
  useEffect(() => { if (!item) onClose(); }, [item, onClose]);

  // Only ever opened from a click, so it never renders on the server; the check is the guard.
  if (!item || typeof document === 'undefined') return null;
  return createPortal(
    <Viewer
      items={items}
      index={index}
      item={item}
      onOpenId={onOpenId}
      onClose={onClose}
      t={t}
    />,
    document.body,
  );
}

function Viewer({
  items, index, item, onOpenId, onClose, t,
}: {
  items: LightboxItem[];
  index: number;
  item: LightboxItem;
  onOpenId: (id: string) => void;
  onClose: () => void;
  t: TFn;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const [view, setView] = useState<View>(REST);
  const viewRef = useRef(view);
  /** Every view change goes through here, so a gesture's release (which can arrive before React
   *  has rendered the last move) always reads the view the user actually sees. */
  const commit = useCallback((v: View) => { viewRef.current = v; setView(v); }, []);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Set while a drag is in progress so the release is not read as a backdrop tap. */
  const draggedRef = useRef(false);
  const reduced = useRef(false);
  const [animate, setAnimate] = useState(false);

  const many = items.length > 1;
  const go = useCallback((delta: number) => {
    if (items.length < 2) return;
    const next = items[(index + delta + items.length) % items.length];
    if (next) onOpenId(next.id);
  }, [items, index, onOpenId]);

  // ── Focus: take it on open, hand it back on close ────────────────────────
  useLayoutEffect(() => {
    reduced.current = reducedMotion();
    const active = document.activeElement as HTMLElement | null;
    openerRef.current = active && active !== document.body ? active : null;
    layerRef.current?.focus({ preventScroll: true });
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Reset zoom whenever the photo changes.
  useEffect(() => { commit(REST); setLoaded(false); setFailed(false); }, [item.id, commit]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  // CAPTURE phase with stopPropagation: the chair's chat sits inside GrowDialog and the
  // delegate's inside Sheet, and both close themselves on a bubbling Escape. The viewer opened
  // last, so it must consume the key before either of them sees it.
  useEffect(() => {
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      let handled = true;
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': go(rtl ? 1 : -1); break;
        case 'ArrowRight': go(rtl ? -1 : 1); break;
        case '+': case '=': zoomBy(1.4); break;
        case '-': case '_': zoomBy(1 / 1.4); break;
        case '0': setAnimated(REST); break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, onClose]);

  // ── Focus trap ───────────────────────────────────────────────────────────
  // Tab cycles inside the viewer; focus that escapes to the chat underneath is pulled back.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const layer = layerRef.current;
      const target = e.target as Node | null;
      if (!layer || !target || target === document.body || layer.contains(target)) return;
      layer.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const layer = layerRef.current;
      if (!layer) return;
      const items_ = Array.from(layer.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'))
        .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
      if (items_.length === 0) { e.preventDefault(); layer.focus({ preventScroll: true }); return; }
      const first = items_[0];
      const last = items_[items_.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !layer.contains(active) || active === layer) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus({ preventScroll: true });
      }
      e.stopPropagation();
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // ── Zoom and pan maths ───────────────────────────────────────────────────
  /** How far the picture may be pushed before its edge leaves the stage. */
  const bounds = useCallback((scale: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return { x: 0, y: 0 };
    // offsetWidth/Height are the LAID-OUT size, before the wrapper's transform.
    return {
      x: Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2),
      y: Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2),
    };
  }, []);

  const settle = useCallback((v: View): View => {
    const scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
    const b = bounds(scale);
    return { scale, x: clamp(v.x, -b.x, b.x), y: clamp(v.y, -b.y, b.y) };
  }, [bounds]);

  /** Change with a short transition (buttons, keys, double tap). Instant under reduced motion. */
  const setAnimated = useCallback((next: View) => {
    if (!reduced.current) {
      setAnimate(true);
      window.setTimeout(() => setAnimate(false), 200);
    }
    commit(settle(next));
  }, [settle, commit]);

  /** Zoom about the centre of the stage. */
  const zoomBy = useCallback((factor: number) => {
    const v = viewRef.current;
    const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const k = scale / v.scale;
    setAnimated({ scale, x: v.x * k, y: v.y * k });
  }, [setAnimated]);

  /** Zoom about a point given in viewport pixels, keeping that point under the finger. */
  const zoomAt = useCallback((factor: number, clientX: number, clientY: number, animated = false) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const px = clientX - (r.left + r.width / 2);
    const py = clientY - (r.top + r.height / 2);
    const v = viewRef.current;
    const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const k = scale / v.scale;
    const next = { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    if (animated) setAnimated(next);
    else commit(settle(next));
  }, [settle, setAnimated, commit]);

  // Wheel and trackpad pinch (which arrives as a wheel event with ctrlKey).
  // Attached natively, not through React's onWheel, because React's is passive and
  // preventDefault is what stops the page behind from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.ctrlKey ? 0.012 : 0.0035;
      zoomAt(Math.exp(-e.deltaY * step), e.clientX, e.clientY);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ── Pointers: drag to pan, two fingers to pinch, swipe at rest ───────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startView: View; startX: number; startY: number; startDist: number; touch: boolean;
    /** Two fingers were down at some point: its end is never a swipe. */
    multi: boolean;
  } | null>(null);
  const lastTap = useRef(0);

  const pointsOf = () => Array.from(pointers.current.values());
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    // The prev / next buttons live inside the stage: capturing their pointer would retarget
    // the click to the stage and the button would never fire.
    if ((e.target as HTMLElement).closest('button, a')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Capture keeps a drag alive when the finger leaves the stage. It throws for a pointer the
    // browser no longer considers active; the gesture must still start without it.
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* no capture */ }
    const pts = pointsOf();
    draggedRef.current = false;
    gesture.current = {
      startView: viewRef.current,
      startX: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      startY: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      startDist: pts.length === 2 ? dist(pts[0], pts[1]) : 0,
      touch: e.pointerType === 'touch',
      multi: pts.length > 1 || !!gesture.current?.multi,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = pointsOf();
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dx = cx - g.startX;
    const dy = cy - g.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;

    if (pts.length === 2 && g.startDist > 0) {
      const scale = clamp(g.startView.scale * (dist(pts[0], pts[1]) / g.startDist), MIN_SCALE, MAX_SCALE);
      const k = scale / g.startView.scale;
      commit(settle({ scale, x: g.startView.x * k + dx, y: g.startView.y * k + dy }));
      return;
    }
    if (g.startView.scale > 1) {
      commit(settle({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }));
      return;
    }
    // At rest a touch drag is a swipe: the picture follows the finger, and the release decides.
    if (g.touch && !g.multi) commit({ scale: 1, x: dx, y: Math.max(0, dy) });
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // A finger lifted mid-pinch: re-anchor the gesture on what is left.
      const pts = pointsOf();
      gesture.current = {
        startView: viewRef.current,
        startX: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        startY: pts.reduce((s, p) => s + p.y, 0) / pts.length,
        startDist: pts.length === 2 ? dist(pts[0], pts[1]) : 0,
        touch: g?.touch ?? false,
        multi: true,
      };
      return;
    }
    gesture.current = null;
    if (!g) return;

    if (g.startView.scale <= 1 && g.touch && !g.multi) {
      const v = viewRef.current;
      if (v.y > SWIPE_CLOSE_Y) { onClose(); return; }
      if (v.x <= -SWIPE_X && items.length > 1) { commit(REST); go(1); return; }
      if (v.x >= SWIPE_X && items.length > 1) { commit(REST); go(-1); return; }
      setAnimated(REST);
      return;
    }
    commit(settle(viewRef.current));
  };

  const onStageClick = (e: React.MouseEvent) => {
    // A tap on the empty backdrop closes; a tap that ended a drag does not.
    if (draggedRef.current) { draggedRef.current = false; return; }
    if (e.target === e.currentTarget) onClose();
  };

  const onImageClick = (e: React.MouseEvent) => {
    if (draggedRef.current) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      if (viewRef.current.scale > 1) setAnimated(REST);
      else zoomAt(DOUBLE_SCALE, e.clientX, e.clientY, true);
      return;
    }
    lastTap.current = now;
  };

  const src = item.url;
  const poster = item.kind === 'gif' ? item.previewUrl : undefined;
  const zoomed = view.scale > 1;

  const chip: React.CSSProperties = {
    width: 42, height: 42, borderRadius: 999, border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,253,248,0.14)', color: '#FFFDF8',
    boxShadow: 'inset 0 0 0 1px rgba(255,253,248,0.26)',
    transitionProperty: 'background-color, transform', transitionDuration: '150ms',
  };

  return (
    <div
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('chat_image_viewer')}
      tabIndex={-1}
      className="gv-lightbox fixed inset-0 flex flex-col focus:outline-none"
      style={{
        zIndex: 2000,
        background: 'rgba(5,8,20,0.94)',
        // Never let the page behind scroll or rubber-band under the viewer.
        overscrollBehavior: 'contain',
        touchAction: 'none',
      }}
    >
      <style>{'@keyframes gvLightboxIn{from{opacity:0}to{opacity:1}}.gv-lightbox{animation:gvLightboxIn 160ms ease-out}@media (prefers-reduced-motion: reduce){.gv-lightbox{animation:none}}'}</style>

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))', paddingBottom: 10 }}>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, color: '#FFFDF8' }}>{item.name}</p>
          {item.caption && (
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: 'rgba(255,253,248,0.66)', fontVariantNumeric: 'tabular-nums' }}>
              {item.caption}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.5)}
          disabled={!zoomed}
          aria-label={t('chat_image_zoom_out')}
          title={t('chat_image_zoom_out')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] enabled:hover:bg-[rgba(255,253,248,0.26)] enabled:active:scale-[0.94]"
          style={{ ...chip, opacity: zoomed ? 1 : 0.4, cursor: zoomed ? 'pointer' : 'default' }}
        >
          <Minus size={20} strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.5)}
          aria-label={t('chat_image_zoom_in')}
          title={t('chat_image_zoom_in')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.26)] active:scale-[0.94]"
          style={chip}
        >
          <Plus size={20} strokeWidth={2.4} aria-hidden />
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('chat_image_open_original')}
          title={t('chat_image_open_original')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.26)] active:scale-[0.94]"
          style={{ ...chip, textDecoration: 'none' }}
        >
          <ExternalLink size={19} strokeWidth={2.2} aria-hidden />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('chat_image_close')}
          title={t('chat_image_close')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.26)] active:scale-[0.94]"
          style={chip}
        >
          <X size={22} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onClick={onStageClick}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ cursor: zoomed ? 'grab' : 'default' }}
      >
        <div
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
            transition: animate ? 'transform 190ms cubic-bezier(0.32,0.72,0,1)' : 'none',
            willChange: 'transform',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'flex',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user media on Supabase storage / GIPHY; next/image would proxy it through our server */}
          <img
            ref={imgRef}
            src={src}
            alt={item.name}
            draggable={false}
            // Double tap / double click toggles zoom. A tap on the picture is not a backdrop
            // tap: the stage closes only when the click lands on the stage itself.
            onClick={onImageClick}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              display: 'block',
              maxWidth: '96vw',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              opacity: loaded || failed ? 1 : 0,
              transition: 'opacity 160ms ease-out',
              userSelect: 'none',
              // A GIF still decoding shows its small rendition rather than a hole.
              backgroundImage: poster && !loaded ? `url("${poster}")` : undefined,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />
        </div>

        {failed && (
          <p role="alert" className="absolute px-6 text-center" style={{ fontFamily: OUTFIT, fontSize: 14.5, color: 'rgba(255,253,248,0.8)' }}>
            {t('chat_image_failed')}
          </p>
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label={t('chat_image_prev')}
              title={t('chat_image_prev')}
              className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.26)] active:scale-[0.94]"
              style={{ ...chip, insetInlineStart: 8, width: 46, height: 46 }}
            >
              <ChevronLeft size={26} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label={t('chat_image_next')}
              title={t('chat_image_next')}
              className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] hover:bg-[rgba(255,253,248,0.26)] active:scale-[0.94]"
              style={{ ...chip, insetInlineEnd: 8, width: 46, height: 46 }}
            >
              <ChevronRight size={26} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />
            </button>
          </>
        )}
      </div>

      {/* Counter */}
      {many && (
        <div className="shrink-0 flex justify-center" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))', paddingTop: 4 }}>
          <span style={{
            padding: '4px 12px', borderRadius: 999, background: 'rgba(255,253,248,0.12)',
            fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 650, color: 'rgba(255,253,248,0.82)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {t('chat_image_counter', { i: index + 1, n: items.length })}
          </span>
        </div>
      )}
    </div>
  );
}
