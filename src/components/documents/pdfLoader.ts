'use client';

/**
 * One pdf.js loader for every paper surface (the introduction viewer, the doc card's inline
 * viewer and its thumbnail). pdf.js is imported lazily, only in the browser, the first time a
 * paper is shown, so it never enters the server bundle or a page that shows no PDF.
 *
 * The worker is served from our own origin: bundled through `new URL(..., import.meta.url)`,
 * never a CDN. A loaded document is cached by URL (a small LRU), so a card's thumbnail, its
 * inline viewer and the introduction screen parse the file once between them.
 *
 * Anything that fails (the worker, a CORS refusal, a corrupt file) rejects, and every caller
 * falls back to the browser's own iframe viewer.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist');

let libPromise: Promise<PdfJs> | null = null;

function loadLib(): Promise<PdfJs> {
  if (!libPromise) {
    libPromise = import('pdfjs-dist').then((lib) => {
      if (!lib.GlobalWorkerOptions.workerPort) {
        lib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' },
        );
      }
      return lib;
    }).catch((err) => {
      libPromise = null; // a later paper may try again (e.g. after a flaky chunk load)
      throw err;
    });
  }
  return libPromise;
}

const CACHE_MAX = 8;
const cache = new Map<string, Promise<PDFDocumentProxy>>();

export function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const hit = cache.get(url);
  if (hit) {
    cache.delete(url);
    cache.set(url, hit); // most recently used last
    return hit;
  }
  const p = loadLib().then((lib) => lib.getDocument({
    url,
    // The file is small and wanted whole; range requests only add round trips here.
    disableRange: true,
    disableStream: true,
  }).promise);
  p.catch(() => { if (cache.get(url) === p) cache.delete(url); });
  cache.set(url, p);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string;
    const dropped = cache.get(oldest);
    cache.delete(oldest);
    void dropped?.then((d) => d.loadingTask.destroy()).catch(() => { /* already gone */ });
  }
  return p;
}

/** CSS pixels per PDF point at 100%: pdf.js viewers treat a point as 96/72 CSS px. */
export const PDF_TO_CSS = 96 / 72;

/** The scale FitToScreen draws `#fit-root` at, so canvases can be rendered for real screen pixels. */
export function fitRootScale(): number {
  if (typeof document === 'undefined') return 1;
  const root = document.getElementById('fit-root');
  if (!root || !root.offsetWidth) return 1;
  const s = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(s) && s > 0.05 ? s : 1;
}

/** Output pixels per CSS pixel for a canvas, capped so one page never exceeds ~16M pixels. */
export function outputScale(cssW: number, cssH: number): number {
  const want = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * fitRootScale();
  const MAX_PIXELS = 16_000_000;
  const area = cssW * cssH * want * want;
  return area > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / (cssW * cssH)) : want;
}
