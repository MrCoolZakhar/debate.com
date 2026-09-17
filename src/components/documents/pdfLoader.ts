'use client';

/**
 * One pdf.js loader for every paper surface (the introduction viewer, the doc card's inline
 * viewer and its thumbnail). pdf.js is imported lazily, only in the browser, the first time a
 * paper is shown, so it never enters the server bundle or a page that shows no PDF.
 *
 * The worker is served from our own origin: bundled through `new URL(..., import.meta.url)`,
 * never a CDN, and shared by every document (see `loadLib`). A loaded document is cached by URL (a small LRU), so a card's thumbnail, its
 * inline viewer and the introduction screen parse the file once between them. Holders
 * reference-count it (`acquirePdf` / `release`), so an eviction never destroys a paper still
 * on screen.
 *
 * Anything that fails (the worker, a CORS refusal, a corrupt file) rejects, and every caller
 * falls back to the browser's own iframe viewer.
 */
import type { PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';
import { SUPABASE_URL } from '@/lib/supabase';

type PdfJs = typeof import('pdfjs-dist');

let libPromise: Promise<{ lib: PdfJs; worker: PDFWorker }> | null = null;

/**
 * pdf.js plus ONE worker shared by every document. The worker is created explicitly and
 * passed to `getDocument`, so destroying a document never touches it: with
 * `GlobalWorkerOptions.workerPort` each loading task adopted the shared port's worker as its
 * own and destroying ANY document terminated it, after which every paper failed to open
 * ("PDFWorker.create - the worker is being destroyed").
 */
function loadLib(): Promise<{ lib: PdfJs; worker: PDFWorker }> {
  if (!libPromise) {
    libPromise = import('pdfjs-dist').then((lib) => {
      const port = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' },
      );
      // pdfjs-dist's generated typings say `port?: null`; at runtime a Worker is accepted.
      const worker = new lib.PDFWorker({ port } as unknown as ConstructorParameters<PdfJs['PDFWorker']>[0]);
      return { lib, worker };
    }).catch((err) => {
      libPromise = null; // a later paper may try again (e.g. after a flaky chunk load)
      throw err;
    });
  }
  return libPromise;
}

const CACHE_MAX = 8;

/** One loaded (or loading) paper. `refs` counts the mounted viewers and thumbnails using it. */
type Entry = { url: string; p: Promise<PDFDocumentProxy>; refs: number; inCache: boolean };

/** Most recently used last. */
const cache = new Map<string, Entry>();
/** Pushed out of the LRU while still on screen somewhere: destroyed on its last release. */
const evicted = new Map<string, Entry>();

function destroyEntry(e: Entry) {
  void e.p.then((d) => d.loadingTask.destroy()).catch(() => { /* never opened, or already gone */ });
}

function trimCache() {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string;
    const e = cache.get(oldest)!;
    cache.delete(oldest);
    e.inCache = false;
    // Never pull a document out from under a viewer that is still drawing it.
    if (e.refs === 0) destroyEntry(e);
    else evicted.set(oldest, e);
  }
}

export type PdfHandle = { promise: Promise<PDFDocumentProxy>; release: () => void };

/**
 * Open a paper and hold it until `release()` (call it on unmount). The document is shared
 * between every holder of the same URL; it is destroyed only when it has left the LRU AND
 * nobody holds it any more.
 */
export function acquirePdf(url: string): PdfHandle {
  let e = cache.get(url);
  if (e) {
    cache.delete(url);
    cache.set(url, e);
  } else if ((e = evicted.get(url))) {
    evicted.delete(url);
    e.inCache = true;
    cache.set(url, e);
  } else {
    const p = loadLib().then(({ lib, worker }) => lib.getDocument({
      url,
      worker,
      // The file is small and wanted whole; range requests only add round trips here.
      disableRange: true,
      disableStream: true,
    }).promise);
    const entry: Entry = { url, p, refs: 0, inCache: true };
    p.catch(() => {
      if (cache.get(url) === entry) cache.delete(url);
      if (evicted.get(url) === entry) evicted.delete(url);
    });
    cache.set(url, entry);
    e = entry;
  }
  const entry = e;
  entry.refs += 1;
  trimCache();
  let released = false;
  return {
    promise: entry.p,
    release: () => {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (entry.refs === 0 && !entry.inCache) {
        if (evicted.get(url) === entry) evicted.delete(url);
        destroyEntry(entry);
      }
    },
  };
}

/** pdf.js itself (for TextLayer), loaded once. */
export function loadPdfLib(): Promise<PdfJs> {
  return loadLib().then(({ lib }) => lib);
}

/**
 * Only papers stored in this project's public storage are opened with pdf.js (fetched by
 * script, so the origin matters). Anything else keeps the browser's own viewer.
 */
export function isPdfJsUrl(u: string): boolean {
  if (!u) return false;
  let parsed: URL;
  let origin: string;
  try { parsed = new URL(u); origin = new URL(SUPABASE_URL).origin; } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username || parsed.password) return false;
  const raw = u.split('#')[0].split('?')[0];
  if (raw.includes('\\') || /%2e|%2f|%5c/i.test(raw) || /(^|\/)\.{1,2}(\/|$)/.test(parsed.pathname)) return false;
  if (raw !== origin + parsed.pathname) return false;
  return parsed.pathname.startsWith('/storage/v1/object/public/');
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
