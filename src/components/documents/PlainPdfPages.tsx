'use client';

/**
 * PlainPdfPages (prompt 141): a position paper drawn by pdf.js on a plain
 * white area, just the pages stacked. No grey frame, no thumbnails, no browser
 * toolbar: the zoom lives with the caller (the paper page's card header).
 *
 * - `zoom` is a share of the COLUMN width (prompt 37): 1 = the page fits the
 *   column, 0.5 = half of that, 2 = twice. No cap: a page wider than the
 *   column makes the box scroll sideways (never the whole page), and the
 *   reading position is kept, in proportion, when the zoom changes.
 * - Pages are drawn lazily: only the ones near the view hold a canvas.
 * - Anything that fails (the worker, CORS, a broken file) calls `onFailed`, and
 *   the caller shows its sentence with Download still working.
 * Only files in this project's storage are opened, public or signed (`isPdfJsUrl`, the same test PdfViewer uses).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { acquirePdf, isPdfJsUrl, outputScale, PDF_TO_CSS } from './pdfLoader';

interface PageSize { w: number; h: number }

export default function PlainPdfPages({ url, zoom, onFailed, className, style }: {
  url: string;
  zoom: number;
  onFailed: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  // The scroll box as state (a callback ref): the pages observe it as their root.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[] | null>(null);
  const [width, setWidth] = useState(0);
  // Where the reader is, as shares of the scroll box (the centre of the view),
  // kept on every scroll so a zoom change can put them back in proportion.
  const posRef = useRef({ x: 0.5, y: 0 });
  const failedRef = useRef(onFailed);
  useEffect(() => { failedRef.current = onFailed; }, [onFailed]);

  // Load the document (shared and reference-counted by pdfLoader).
  useEffect(() => {
    if (!isPdfJsUrl(url)) { failedRef.current(); return; }
    let alive = true;
    const handle = acquirePdf(url);
    handle.promise.then(async (d) => {
      const list: PageSize[] = [];
      for (let i = 1; i <= d.numPages; i += 1) {
        const p = await d.getPage(i);
        const v = p.getViewport({ scale: 1 });
        list.push({ w: v.width, h: v.height });
      }
      if (!alive) return;
      setDoc(d);
      setSizes(list);
    }).catch(() => { if (alive) failedRef.current(); });
    return () => { alive = false; handle.release(); };
  }, [url]);

  // Keep the reading position when the zoom changes (after the new layout).
  useLayoutEffect(() => {
    const el = box;
    if (!el) return;
    const { x, y } = posRef.current;
    el.scrollTop = Math.max(0, y * el.scrollHeight - el.clientHeight / 2);
    el.scrollLeft = Math.max(0, x * el.scrollWidth - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);
  const remember = () => {
    const el = box;
    if (!el || el.scrollHeight === 0) return;
    posRef.current = {
      x: el.scrollWidth > 0 ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5,
      y: el.scrollTop > 0 ? (el.scrollTop + el.clientHeight / 2) / el.scrollHeight : 0,
    };
  };

  // The column's width: 100% zoom is a page that fits it.
  useEffect(() => {
    const el = box;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);

  const pad = 24;
  return (
    <div ref={setBox} onScroll={remember} className={className} style={{ overflow: 'auto', background: '#FFFFFF', ...style }}>
      {doc && sizes && width > 0 && (
        // max-content with a 100% floor: a page wider than the box makes the box
        // scroll right instead of spilling left; below 100% the pages stay centred.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: `${pad}px ${pad / 2}px`, width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
          {sizes.map((sz, i) => {
            const natural = sz.w * PDF_TO_CSS;
            const fit = (width - pad) / natural;
            const scale = fit * zoom * PDF_TO_CSS;
            return <PdfPage key={i} doc={doc} n={i + 1} cssW={sz.w * scale} cssH={sz.h * scale} scale={scale} root={box} />;
          })}
        </div>
      )}
      {!doc && <div aria-busy="true" style={{ height: 240 }} />}
    </div>
  );
}

function PdfPage({ doc, n, cssW, cssH, scale, root }: {
  doc: PDFDocumentProxy; n: number; cssW: number; cssH: number; scale: number; root: HTMLElement | null;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Only pages within a screen of the view hold a canvas.
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { root, rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    void doc.getPage(n).then((page) => {
      if (cancelled) return;
      const out = outputScale(cssW, cssH);
      const viewport = page.getViewport({ scale: scale * out });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport, canvas } as unknown as Parameters<typeof page.render>[0]);
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [near, doc, n, scale, cssW, cssH]);

  return (
    <div ref={holderRef} style={{ width: cssW, height: cssH, flexShrink: 0, boxShadow: '0 1px 3px rgba(27,56,40,0.12), 0 8px 24px -16px rgba(27,56,40,0.35)', background: '#FFFFFF' }}>
      {near && <canvas ref={canvasRef} style={{ width: cssW, height: cssH, display: 'block' }} aria-label={`Page ${n}`} />}
    </div>
  );
}
