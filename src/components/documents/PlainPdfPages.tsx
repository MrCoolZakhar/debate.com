'use client';

/**
 * PlainPdfPages (prompt 141): a position paper drawn by pdf.js on a plain
 * white area, just the pages stacked. No grey frame, no thumbnails, no browser
 * toolbar: the zoom lives with the caller (the paper page's card header).
 *
 * - `zoom` is a share of the page's natural width (1 = 100%); when that would
 *   overflow the column the pages fit the column instead.
 * - Pages are drawn lazily: only the ones near the view hold a canvas.
 * - Anything that fails (the worker, CORS, a broken file) calls `onFailed`, and
 *   the caller shows its sentence with Download still working.
 * Only files in this project's storage are opened, public or signed (`isPdfJsUrl`, the same test PdfViewer uses).
 */

import { useEffect, useRef, useState } from 'react';
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

  // The column's width, so a zoom that would overflow fits it instead.
  useEffect(() => {
    const el = box;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);

  const pad = 24;
  return (
    <div ref={setBox} className={className} style={{ overflow: 'auto', background: '#FFFFFF', ...style }}>
      {doc && sizes && width > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: `${pad}px ${pad / 2}px` }}>
          {sizes.map((sz, i) => {
            const natural = sz.w * PDF_TO_CSS;
            const scale = Math.min(zoom, (width - pad) / natural) * PDF_TO_CSS;
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
