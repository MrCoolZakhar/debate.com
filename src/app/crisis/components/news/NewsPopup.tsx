'use client';
// Gavelling Crisis: the live news pop-up for every crisis page (mounted once in the crisis layout).
// When a news item is published while the page is open, a red card rises from the bottom centre.
// It never shows for news that was already there when the page opened, and the newest one wins.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Newspaper, X } from 'lucide-react';
import type { News } from '@/lib/crisis/types';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK } from '../../crisisKit';
import { useCrisisNews } from './useCrisisNews';

const SHOW_MS = 30_000;

export default function NewsPopup() {
  const v = useCrisis();
  const { items } = useCrisisNews(v.ref);
  const seen = useRef<Set<string> | null>(null);
  const [card, setCard] = useState<News | null>(null);

  useEffect(() => {
    if (!items) return;
    const published = items.filter((n) => n.status === 'published');
    if (seen.current === null) {
      // First successful read: everything here is old news.
      seen.current = new Set(published.map((n) => n.id));
      return;
    }
    const fresh = published.filter((n) => !seen.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current!.add(n.id));
    fresh.sort((a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime());
    setCard(fresh[0]);
  }, [items]);

  useEffect(() => {
    if (!card) return;
    const t = window.setTimeout(() => setCard(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [card]);

  if (!card) return null;
  return (
    <>
      <style>{`
        .crisis-news-pop { position: fixed; left: 50%; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 50; width: min(440px, calc(100vw - 24px)); animation: crisis-news-rise 360ms cubic-bezier(0.22,1,0.36,1); }
        @media (min-width: 768px) { .crisis-news-pop { bottom: 22px; } }
        @keyframes crisis-news-rise { from { opacity: 0; transform: translate(-50%, 24px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .crisis-news-pop { animation: none; } }
      `}</style>
      <div role="status" aria-live="polite" className="crisis-news-pop" style={{ background: CK.redGrad, color: '#FFF4E6', borderRadius: 20, boxShadow: CK.redShadow, padding: '14px 16px', fontFamily: CK.font }}>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setCard(null)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
          style={{ position: 'absolute', top: 8, right: 8, border: 0, background: 'rgba(0,0,0,0.2)', color: '#FFF4E6', borderRadius: 999, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <X size={15} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: CK.gold, paddingRight: 32, overflowWrap: 'anywhere' }}>
          <Newspaper size={14} strokeWidth={1.5} aria-hidden />
          {card.source_label || 'Crisis update'}
        </div>
        <b style={{ display: 'block', margin: '5px 0 3px', fontSize: 16, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{card.title}</b>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: 'rgba(255,240,226,0.88)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {card.body}
        </p>
        <div style={{ marginTop: 10 }}>
          <Link
            href={`${crisisBase(v.ref)}/news`}
            onClick={() => setCard(null)}
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
            style={{ textDecoration: 'none', borderRadius: 11, padding: '7px 14px', fontSize: 13.5, fontWeight: 700, background: `linear-gradient(180deg, ${CK.gold}, #E2C766)`, color: CK.forest, boxShadow: CK.shadowSm }}
          >
            Read
          </Link>
        </div>
      </div>
    </>
  );
}
