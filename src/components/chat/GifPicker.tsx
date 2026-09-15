'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { fetchGifs, type GifItem } from '@/lib/gifClient';
import type { TFn } from './chatTokens';

/** Hard cap on how many GIFs one picker holds (five pages). Keeps memory and decode work flat. */
const MAX_ITEMS = 120;
const GAP = 6;

/**
 * GIF picker, opened from the composer. It sits INSIDE the thread column, directly above the
 * composer, sized to the room the column actually has, so it can never be clipped by the chat
 * dialog's rounded overflow.
 *
 * Smoothness: search is debounced 300 ms and stale requests are aborted; tiles are placed in a
 * JS masonry by their known heights (no reflow as images arrive); each tile is a sized skeleton
 * until an IntersectionObserver on the scroll container brings it within 300 px, and only then
 * gets its small animated WebP; pages load from a sentinel and stop at MAX_ITEMS.
 */
function GifPicker({ onPick, onClose, lang, t }: {
  onPick: (g: GifItem) => void;
  onClose: () => void;
  lang: string;
  t: TFn;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [height, setHeight] = useState(360);
  const [width, setWidth] = useState(360);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<GifItem[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(true); // true from the start: no "No GIFs" flash before the first page
  const [error, setError] = useState(false);
  const reqRef = useRef<AbortController | null>(null);

  // Size to the column once on open (and on resize): at most 380 px, never taller than the room above the composer.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const column = el?.parentElement?.parentElement; // picker → composer wrapper → thread column
    if (!el || !column) return;
    const measure = () => {
      const composer = el.parentElement as HTMLElement;
      const room = column.offsetHeight - composer.offsetHeight - 16;
      setHeight(Math.max(180, Math.min(380, room)));
      setWidth(el.offsetWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(column);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async (q: string, offset: number, replace: boolean) => {
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setLoading(true);
    setError(false);
    try {
      const d = await fetchGifs(q, offset, lang, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (d.error && d.items.length === 0) { setError(true); setNext(null); return; }
      setItems((prev) => {
        const base = replace ? [] : prev;
        const seen = new Set(base.map((g) => g.id));
        return [...base, ...d.items.filter((g) => !seen.has(g.id))].slice(0, MAX_ITEMS);
      });
      setNext(d.next);
    } catch {
      if (!ctrl.signal.aborted) { setError(true); setNext(null); }
    } finally {
      if (reqRef.current === ctrl) { setLoading(false); reqRef.current = null; }
    }
  }, [lang]);

  // A new query starts over at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setItems([]);
    setNext(0);
    void load(debounced, 0, true);
  }, [debounced, load]);
  useEffect(() => () => reqRef.current?.abort(), []);

  // Next page when the sentinel comes near.
  const canMore = next != null && next > 0 && !loading && !error && items.length < MAX_ITEMS;
  useEffect(() => {
    const root = scrollRef.current;
    const s = sentinelRef.current;
    if (!root || !s || !canMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && next != null) void load(debounced, next, false);
    }, { root, rootMargin: '300px' });
    io.observe(s);
    return () => io.disconnect();
  }, [canMore, next, debounced, load]);

  // One shared observer for every tile.
  const [visible, setVisible] = useState<Set<string>>(() => new Set());
  const ioRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const add: string[] = [];
      for (const e of entries) {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).dataset.gif;
          if (id) add.push(id);
          io.unobserve(e.target);
        }
      }
      if (add.length) setVisible((prev) => { const n = new Set(prev); add.forEach((x) => n.add(x)); return n; });
    }, { root, rootMargin: '300px' });
    ioRef.current = io;
    return () => { io.disconnect(); ioRef.current = null; };
  }, []);
  const observe = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (ioRef.current) ioRef.current.observe(el);
    else { const id = el.dataset.gif; if (id) setVisible((prev) => (prev.has(id) ? prev : new Set(prev).add(id))); }
  }, []);

  // Masonry by known heights: each tile goes to the currently shortest column.
  const cols = width >= 420 ? 3 : 2;
  const colW = Math.max(60, Math.floor((width - 16 - GAP * (cols - 1)) / cols));
  const columns = useMemo(() => {
    const out: { g: GifItem; h: number }[][] = Array.from({ length: cols }, () => []);
    const heights = new Array(cols).fill(0);
    for (const g of items) {
      const h = Math.max(50, Math.round(colW * (g.preview.height / g.preview.width)));
      let c = 0;
      for (let i = 1; i < cols; i++) if (heights[i] < heights[c]) c = i;
      out[c].push({ g, h });
      heights[c] += h + GAP;
    }
    return out;
  }, [items, cols, colW]);

  const skeletons = loading && items.length === 0;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('chat_gif')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
      className="absolute flex flex-col"
      style={{
        insetInline: 8, bottom: 'calc(100% + 6px)', height, zIndex: 20,
        borderRadius: 18, overflow: 'hidden',
        background: '#FFFDF8',
        boxShadow: '0 0 0 0.5px rgba(27,56,40,0.18), 0 12px 32px -8px rgba(5,8,20,0.35)',
      }}
    >
      <div className="shrink-0 flex items-center gap-2 px-2 pt-2 pb-1.5">
        <label className="flex-1 flex items-center gap-2 px-3" style={{ height: 38, borderRadius: 12, backgroundColor: 'rgba(28,20,16,0.06)' }}>
          <Search size={16} strokeWidth={2.2} aria-hidden style={{ color: NEU.inkSoft, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat_gif_search')}
            aria-label={t('chat_gif_search')}
            maxLength={50}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 16, color: NEU.ink, border: 'none' }}
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('chat_gif_close')}
          className="shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.07)] active:scale-[0.96]"
          style={{ width: 36, height: 36, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
        >
          <X size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2" style={{ overscrollBehavior: 'contain' }}>
        {error && items.length === 0 && (
          <p className="py-8 text-center" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>{t('chat_gif_failed')}</p>
        )}
        {!error && !loading && items.length === 0 && (
          <p className="py-8 text-center" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>{t('chat_gif_empty')}</p>
        )}
        <div className="flex items-start" style={{ gap: GAP }}>
          {skeletons
            ? Array.from({ length: cols }, (_, c) => (
              <div key={c} className="flex flex-col" style={{ gap: GAP, width: colW }}>
                {[90, 130, 70, 110].map((h, i) => (
                  <div key={i} className="animate-pulse" style={{ height: h + ((c * 17 + i * 23) % 30), borderRadius: 10, background: 'rgba(27,56,40,0.08)' }} />
                ))}
              </div>
            ))
            : columns.map((col, c) => (
              <div key={c} className="flex flex-col" style={{ gap: GAP, width: colW }}>
                {col.map(({ g, h }) => (
                  <button
                    key={g.id}
                    type="button"
                    ref={observe}
                    data-gif={g.id}
                    onClick={() => onPick(g)}
                    aria-label={g.title || 'GIF'}
                    title={g.title || undefined}
                    className="block p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] active:scale-[0.97]"
                    style={{
                      width: colW, height: h, borderRadius: 10, overflow: 'hidden', border: 'none', cursor: 'pointer',
                      background: 'rgba(27,56,40,0.08)', transitionProperty: 'transform', transitionDuration: '120ms',
                    }}
                  >
                    {visible.has(g.id) && (
                      // eslint-disable-next-line @next/next/no-img-element -- GIPHY CDN media, already the smallest rendition
                      <img
                        src={g.preview.url}
                        alt=""
                        width={colW}
                        height={h}
                        decoding="async"
                        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            ))}
        </div>
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loading && items.length > 0 && (
          <div className="py-2 flex justify-center" aria-hidden>
            <span className="animate-pulse" style={{ width: 40, height: 6, borderRadius: 999, background: 'rgba(27,56,40,0.15)' }} />
          </div>
        )}
      </div>

      <div className="shrink-0 flex justify-end px-3 py-1.5" style={{ boxShadow: 'inset 0 1px 0 rgba(28,20,16,0.07)' }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: NEU.inkSoft }}>
          Powered by GIPHY
        </span>
      </div>
    </div>
  );
}

export default memo(GifPicker);
