'use client';

/**
 * PdfViewer: a paper rendered by pdf.js in our own design, replacing the browser's iframe
 * viewer (17 Sep 2026). Continuous vertical pages on the ivory ground, each with a soft forest
 * shadow, and one slim forest toolbar: page n of N, zoom out / in / fit width, open the
 * original, download.
 *
 * - Pages render lazily: an IntersectionObserver marks pages within about one screen of the
 *   viewport as "near"; only near pages hold a canvas, far ones give theirs back, so a long
 *   paper costs a few canvases, not one per page.
 * - Crisp at any zoom: canvases are drawn at devicePixelRatio x the FitToScreen scale. While
 *   zooming, the old canvas stretches with its page box and is re-drawn 140 ms after the
 *   last step, so a zoom never flashes blank.
 * - Zoom keeps the reader's place: the page and the fraction of it at the top of the viewport
 *   are remembered on every scroll and restored after the new layout.
 * - Stateless about the stage: mount it once and it keeps its scroll and zoom (the zoom is a
 *   prop owned by the caller). Nothing here touches committee state.
 * - Any pdf.js failure (worker, CORS, a broken file) falls back to the browser's iframe.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronDown, ChevronUp, Download, ExternalLink, MoveHorizontal, Minus, Plus } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { loadPdf, outputScale, fitRootScale, PDF_TO_CSS } from './pdfLoader';

export type PdfZoom = 'fit' | number;
export const PDF_ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3] as const;

/** Next zoom step from wherever the reader is now (fit width sits between two steps). */
export function stepPdfZoom(current: number, dir: 1 | -1): number {
  const eps = 0.001;
  if (dir > 0) return PDF_ZOOM_STEPS.find((s) => s > current + eps) ?? PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1];
  return [...PDF_ZOOM_STEPS].reverse().find((s) => s < current - eps) ?? PDF_ZOOM_STEPS[0];
}

const PAGE_GAP = 20;
const PAD_X = 24;
const FIT_MAX_CSS_W = 1200;

type Size = { w: number; h: number };

export default function PdfViewer({
  url, title, fileName, zoom, onZoomChange, compact = false, className = '',
}: {
  url: string; title: string; fileName?: string;
  zoom: PdfZoom; onZoomChange: (z: PdfZoom) => void;
  /** Smaller toolbar and padding, for the doc card and the setup preview. */
  compact?: boolean;
  /** Positioning and size of the viewer box (must include `relative` or `absolute`). */
  className?: string;
}) {
  const t = useT();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [boxW, setBoxW] = useState(0);
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);

  // Load.
  useEffect(() => {
    let cancelled = false;
    setDoc(null); setFailed(false); setSizes([]); setPage(1);
    loadPdf(url)
      .then(async (d) => {
        const vs = await Promise.all(Array.from({ length: d.numPages }, (_, i) =>
          d.getPage(i + 1).then((p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; })));
        if (cancelled) return;
        setSizes(vs);
        setDoc(d);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('pdf.js could not open the paper, using the browser viewer', err);
        setFailed(true);
      });
    return () => { cancelled = true; };
  }, [url]);

  // Width of the reading column (for fit width).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [failed]);

  const padX = compact ? 14 : PAD_X;
  const maxW = useMemo(() => sizes.reduce((m, s) => Math.max(m, s.w), 0), [sizes]);
  const fitScale = maxW > 0 && boxW > 0 ? Math.max(0.1, Math.min(FIT_MAX_CSS_W, boxW - 2 * padX) / maxW) : 1;
  const scale = zoom === 'fit' ? fitScale : zoom * PDF_TO_CSS;
  /** The zoom as a percentage of actual size, also for fit width. */
  const effectiveZoom = scale / PDF_TO_CSS;

  // ── Where the reader is ──────────────────────────────────────────────────────
  const anchor = useRef<{ i: number; frac: number; xFrac: number } | null>(null);
  const rafRef = useRef(0);
  const readPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const els = pageEls.current;
    let i = 0;
    for (let k = 0; k < els.length; k++) {
      const p = els[k];
      if (!p) continue;
      if (p.offsetTop - PAGE_GAP / 2 <= top) i = k; else break;
    }
    const p = els[i];
    if (p) {
      anchor.current = {
        i,
        frac: p.offsetHeight ? (top - p.offsetTop) / p.offsetHeight : 0,
        xFrac: el.scrollWidth > 0 ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5,
      };
    }
    // The page counter follows the page that fills the middle of the view.
    const mid = top + el.clientHeight * 0.45;
    let cur = 0;
    for (let k = 0; k < els.length; k++) {
      const q = els[k];
      if (q && q.offsetTop <= mid) cur = k;
    }
    setPage(cur + 1);
  }, []);
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; readPosition(); });
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Restore the place after a zoom (runs after the new page boxes are laid out).
  const lastScale = useRef(scale);
  useLayoutEffect(() => {
    if (lastScale.current === scale) return;
    lastScale.current = scale;
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    const p = pageEls.current[a.i];
    if (!p) return;
    el.scrollTop = p.offsetTop + a.frac * p.offsetHeight;
    el.scrollLeft = Math.max(0, a.xFrac * el.scrollWidth - el.clientWidth / 2);
  }, [scale]);

  // ── Lazy rendering ───────────────────────────────────────────────────────────
  const near = useRef<Set<number>>(new Set());
  const drawn = useRef<Map<number, number>>(new Map()); // page index -> css scale drawn at
  const tasks = useRef<Map<number, RenderTask>>(new Map());
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const release = (i: number) => {
    tasks.current.get(i)?.cancel();
    tasks.current.delete(i);
    const host = pageEls.current[i]?.querySelector<HTMLElement>('[data-canvas-host]');
    host?.replaceChildren();
    drawn.current.delete(i);
  };

  const draw = useCallback(async (i: number) => {
    if (!doc) return;
    const s = scaleRef.current;
    if (drawn.current.get(i) === s) return;
    tasks.current.get(i)?.cancel();
    try {
      const pg = await doc.getPage(i + 1);
      if (!near.current.has(i) || scaleRef.current !== s) return;
      const cssVp = pg.getViewport({ scale: s });
      const out = outputScale(cssVp.width, cssVp.height);
      const vp = pg.getViewport({ scale: s * out });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      canvas.setAttribute('aria-hidden', 'true');
      const task = pg.render({ canvas, viewport: vp, background: '#FFFFFF' });
      tasks.current.set(i, task);
      await task.promise;
      if (tasks.current.get(i) === task) tasks.current.delete(i);
      if (!near.current.has(i)) return;
      // Swap in only once finished, so the stretched old canvas stays until then.
      pageEls.current[i]?.querySelector<HTMLElement>('[data-canvas-host]')?.replaceChildren(canvas);
      drawn.current.set(i, s);
    } catch (err) {
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') console.warn('pdf page render failed', err);
    }
  }, [doc]);

  const pump = useCallback(() => {
    near.current.forEach((i) => { void draw(i); });
  }, [draw]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!doc || !root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.pageIndex);
        if (e.isIntersecting) { near.current.add(i); void draw(i); }
        else { near.current.delete(i); release(i); }
      }
    }, { root, rootMargin: '100% 50% 100% 50%' });
    pageEls.current.forEach((el) => { if (el) io.observe(el); });
    const taskMap = tasks.current;
    const drawnMap = drawn.current;
    const nearSet = near.current;
    return () => {
      io.disconnect();
      taskMap.forEach((tk) => tk.cancel());
      taskMap.clear();
      drawnMap.clear();
      nearSet.clear();
    };
  }, [doc, sizes, draw]);

  // Re-draw at the new scale shortly after the last zoom step; the page box stretches meanwhile.
  useEffect(() => {
    if (!doc) return;
    const id = setTimeout(pump, 140);
    return () => clearTimeout(id);
  }, [scale, doc, pump]);

  // A window move between screens (devicePixelRatio) or a FitToScreen rescale re-draws too.
  useEffect(() => {
    if (!doc) return;
    let last = (window.devicePixelRatio || 1) * fitRootScale();
    const check = () => {
      const now = (window.devicePixelRatio || 1) * fitRootScale();
      if (Math.abs(now - last) > 0.01) { last = now; drawn.current.clear(); pump(); }
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [doc, pump]);

  // Pinch / ctrl + wheel zooms the paper, not the page.
  const zoomRef = useRef(effectiveZoom);
  zoomRef.current = effectiveZoom;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !doc) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      const dir = acc < 0 ? 1 : -1;
      acc = 0;
      onZoomChange(stepPdfZoom(zoomRef.current, dir));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [doc, onZoomChange]);

  const goTo = (n: number) => {
    const el = scrollRef.current;
    const p = pageEls.current[Math.min(sizes.length, Math.max(1, n)) - 1];
    if (el && p) el.scrollTo({ top: p.offsetTop - (compact ? 10 : 16), behavior: 'smooth' });
  };

  const download = async () => {
    try {
      if (!doc) throw new Error('no doc');
      const bytes = await doc.getData();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName || `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  // ── Fallback: the browser's own viewer ───────────────────────────────────────
  if (failed) {
    const z = zoom === 'fit' ? 1 : zoom;
    const size = `${100 / z}%`;
    return (
      <div className={`overflow-hidden bg-[#E4DCCA] ${className || 'relative'}`}>
        <iframe src={url} title={title}
          style={{ width: size, height: size, border: 0, transform: `scale(${z})`, transformOrigin: '0 0', display: 'block' }} />
      </div>
    );
  }

  const n = sizes.length;
  const btn = compact ? 'w-8 h-8' : 'w-9 h-9';
  const icon = compact ? 15 : 16;
  const toolBtn = `${btn} shrink-0 rounded-full flex items-center justify-center text-[#F3EAD2] hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]`;
  const divider = <span aria-hidden className="w-px h-4 mx-1 shrink-0 bg-white/15" />;

  return (
    <div className={`bg-[#E4DCCA] ${className || 'relative'}`}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={title}
        className="absolute inset-0 overflow-auto focus:outline-none"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            gap: PAGE_GAP,
            paddingTop: compact ? 58 : 72,
            paddingBottom: compact ? 24 : 48,
            paddingInline: padX,
            minWidth: 'min-content',
          }}
        >
          {!doc && (
            <div className="flex flex-col items-center gap-3 pt-16" role="status">
              <span className="w-6 h-6 rounded-full border-2 border-[#1B3828] border-t-transparent animate-spin" aria-hidden />
              <span className="text-xs font-semibold" style={{ color: '#6A5A4A' }}>{t('documents_pdf_loading')}</span>
            </div>
          )}
          {doc && sizes.map((s, i) => (
            <div
              key={i}
              ref={(el) => { pageEls.current[i] = el; }}
              data-page-index={i}
              className="relative shrink-0 bg-white"
              style={{
                width: Math.round(s.w * scale),
                height: Math.round(s.h * scale),
                borderRadius: 3,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(27,56,40,0.10), 0 10px 28px rgba(27,56,40,0.14)',
              }}
            >
              <div data-canvas-host className="absolute inset-0 overflow-hidden" style={{ borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      {/* The toolbar floats over the top of the reading column. */}
      <div className={`absolute inset-x-0 ${compact ? 'top-2.5' : 'top-3'} flex justify-center pointer-events-none px-3`}>
        <div
          role="toolbar"
          aria-label={t('documents_pdf_toolbar')}
          className="pointer-events-auto flex items-center max-w-full overflow-x-auto rounded-full px-1.5 py-1 bg-[#1B3828]"
          style={{
            boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 2px 6px rgba(27,56,40,0.22), 0 10px 24px rgba(27,56,40,0.22)',
            fontFamily: "'Outfit', sans-serif",
            scrollbarWidth: 'none',
          }}
        >
          <button type="button" className={toolBtn} onClick={() => goTo(page - 1)} disabled={!doc || page <= 1}
            aria-label={t('documents_pdf_prev_page')} title={t('documents_pdf_prev_page')}>
            <ChevronUp size={icon} strokeWidth={2.4} aria-hidden />
          </button>
          <label className="flex items-center gap-1 px-1 text-[12.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#F3EAD2' }}>
            <span className="sr-only">{t('documents_pdf_page_input')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={pageDraft ?? String(page)}
              disabled={!doc}
              onFocus={(e) => { setPageDraft(String(page)); e.currentTarget.select(); }}
              onChange={(e) => setPageDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              onBlur={() => setPageDraft(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { const v = Number(pageDraft); if (v) goTo(v); e.currentTarget.blur(); }
                if (e.key === 'Escape') e.currentTarget.blur();
              }}
              className="w-8 h-6 rounded-md text-center bg-white/10 text-[#FFF8E6] focus:outline-none focus:bg-white/20 focus:ring-1 focus:ring-[#EED98A]"
            />
            <span style={{ color: 'rgba(243,234,210,0.7)' }}>{t('documents_pdf_of', { total: String(n || '-') })}</span>
          </label>
          <button type="button" className={toolBtn} onClick={() => goTo(page + 1)} disabled={!doc || page >= n}
            aria-label={t('documents_pdf_next_page')} title={t('documents_pdf_next_page')}>
            <ChevronDown size={icon} strokeWidth={2.4} aria-hidden />
          </button>
          {divider}
          <button type="button" className={toolBtn} onClick={() => onZoomChange(stepPdfZoom(effectiveZoom, -1))}
            disabled={!doc || effectiveZoom <= PDF_ZOOM_STEPS[0] + 0.001}
            aria-label={t('documents_zoom_out')} title={t('documents_zoom_out')}>
            <Minus size={icon} strokeWidth={2.6} aria-hidden />
          </button>
          <button type="button" onClick={() => onZoomChange(1)} disabled={!doc}
            aria-label={t('documents_zoom_reset')} title={t('documents_zoom_reset')}
            className="min-w-[48px] h-7 px-1.5 rounded-full text-[12px] font-semibold tabular-nums text-[#F3EAD2] hover:bg-white/10 disabled:opacity-35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]">
            {Math.round(effectiveZoom * 100)}%
          </button>
          <button type="button" className={toolBtn} onClick={() => onZoomChange(stepPdfZoom(effectiveZoom, 1))}
            disabled={!doc || effectiveZoom >= PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1] - 0.001}
            aria-label={t('documents_zoom_in')} title={t('documents_zoom_in')}>
            <Plus size={icon} strokeWidth={2.6} aria-hidden />
          </button>
          <button type="button" onClick={() => onZoomChange('fit')} disabled={!doc}
            aria-pressed={zoom === 'fit'}
            aria-label={t('documents_pdf_fit_width')} title={t('documents_pdf_fit_width')}
            className={`${btn} shrink-0 rounded-full flex items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] disabled:opacity-35 ${zoom === 'fit' ? 'bg-[#EED98A] text-[#1B3828]' : 'text-[#F3EAD2] hover:bg-white/10'}`}>
            <MoveHorizontal size={icon} strokeWidth={2.4} aria-hidden />
          </button>
          {divider}
          <a href={url} target="_blank" rel="noopener noreferrer" className={toolBtn}
            aria-label={t('documents_pdf_open_original')} title={t('documents_pdf_open_original')}>
            <ExternalLink size={icon - 1} strokeWidth={2.4} aria-hidden />
          </a>
          <button type="button" className={toolBtn} onClick={() => { void download(); }} disabled={!doc}
            aria-label={t('documents_pdf_download')} title={t('documents_pdf_download')}>
            <Download size={icon - 1} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page one of a paper as a small card, for the doc list. Rendered only when it scrolls into
 *  view; on any failure it shows `fallback`. */
export function PdfThumb({ url, width, height, fallback }: { url: string; width: number; height: number; fallback: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const [box, setBox] = useState<Size | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try {
        const d = await loadPdf(url);
        const pg = await d.getPage(1);
        if (cancelled) return;
        const base = pg.getViewport({ scale: 1 });
        const s = Math.min(width / base.width, height / base.height);
        const cssW = Math.round(base.width * s);
        const cssH = Math.round(base.height * s);
        const out = outputScale(cssW, cssH);
        const vp = pg.getViewport({ scale: s * out });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.cssText = 'width:100%;height:100%;display:block';
        canvas.setAttribute('aria-hidden', 'true');
        task = pg.render({ canvas, viewport: vp, background: '#FFFFFF' });
        await task.promise;
        if (cancelled) return;
        setBox({ w: cssW, h: cssH });
        setState('ready');
        requestAnimationFrame(() => hostRef.current?.querySelector('[data-thumb]')?.replaceChildren(canvas));
      } catch {
        if (!cancelled) setState('failed');
      }
    }, { rootMargin: '200px' });
    io.observe(host);
    return () => { cancelled = true; io.disconnect(); task?.cancel(); };
  }, [url, width, height]);

  return (
    <div ref={hostRef} className="flex items-center justify-center" style={{ width, height }}>
      {state === 'failed' ? fallback : (
        <div
          data-thumb
          className="bg-white overflow-hidden"
          style={{
            width: box?.w ?? Math.round(width * 0.8), height: box?.h ?? height,
            borderRadius: 2,
            opacity: state === 'ready' ? 1 : 0.55,
            transition: 'opacity 200ms ease-out',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 1px 2px rgba(27,56,40,0.12), 0 4px 10px rgba(27,56,40,0.14)',
          }}
        />
      )}
    </div>
  );
}
