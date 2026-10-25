'use client';
// Gavelling Crisis: published news, newest first. Used by the news page and the chair home.

import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import type { Cabinet, News } from '@/lib/crisis/types';
import { CK, Card } from '../../crisisKit';
import NewsDetailDialog from './NewsDetailDialog';

export function newsTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function audienceLabel(n: Pick<News, 'audience_cabinet_id'>, cabinets: Cabinet[]): string {
  if (!n.audience_cabinet_id) return 'Every room';
  return cabinets.find((c) => c.id === n.audience_cabinet_id)?.name ?? 'One room';
}

export function NewsCard({ n, cabinets, onOpen }: { n: News; cabinets: Cabinet[]; onOpen?: (n: News) => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, fontWeight: 700, color: CK.red }}>
        <Newspaper size={14} strokeWidth={1.5} aria-hidden />
        <span style={{ overflowWrap: 'anywhere' }}>{n.source_label || 'Crisis update'}</span>
        <span style={{ color: CK.muted, fontWeight: 600 }}>{newsTime(n.published_at ?? n.created_at)}</span>
        <span style={{ color: CK.muted, fontWeight: 600 }}>{audienceLabel(n, cabinets)}</span>
      </div>
      <h3 style={{ margin: '6px 0 4px', fontSize: 16, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</p>
      <span style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 700, color: CK.forest, textDecoration: 'underline' }}>Read the full story</span>
    </>
  );
  return (
    <Card style={{ padding: 0 }}>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(n)}
          className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ border: 0, background: 'transparent', borderRadius: 22, padding: '14px 16px', cursor: 'pointer', fontFamily: CK.font }}
        >
          {body}
        </button>
      ) : <div style={{ padding: '14px 16px' }}>{body}</div>}
    </Card>
  );
}

/** `onOpen` lets a dialog that already holds the list show the story itself (with a back button);
 *  without it a click opens the news dialog from this list. */
export function NewsHistory({ items, cabinets, columns, onOpen }: { items: News[] | null; cabinets: Cabinet[]; columns?: boolean; onOpen?: (n: News) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items === null) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => <Card key={i}><div className="animate-pulse" style={{ height: 70, borderRadius: 10, background: 'rgba(110,30,30,0.08)' }} /></Card>)}
      </div>
    );
  }
  const published = items
    .filter((n) => n.status === 'published')
    .sort((a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime());
  if (!published.length) {
    return <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No news yet. It shows up here as soon as it is published.</p></Card>;
  }
  return (
    <>
      <div className={`grid gap-3 ${columns ? 'xl:grid-cols-2' : ''}`}>
        {published.map((n) => <NewsCard key={n.id} n={n} cabinets={cabinets} onOpen={onOpen ?? ((x) => setOpenId(x.id))} />)}
      </div>
      {!onOpen && openId && (() => {
        const n = published.find((x) => x.id === openId);
        return n ? <NewsDetailDialog n={n} onClose={() => setOpenId(null)} /> : null;
      })()}
    </>
  );
}
