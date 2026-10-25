'use client';
// Gavelling Crisis: published news, newest first. Used by the news page and the chair home.

import { useState } from 'react';
import { Clock, Landmark, Newspaper, Radio, Users } from 'lucide-react';
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

/** The source, time and audience of a story, each with its icon. */
export function NewsMeta({ n, cabinets, size = 14 }: { n: News; cabinets: Cabinet[]; size?: number }) {
  const AudIcon = n.audience_cabinet_id ? Landmark : Users;
  return (
    <div className="flex items-center flex-wrap" style={{ gap: '3px 12px', fontSize: 12, fontWeight: 700, color: CK.red }}>
      <span className="inline-flex items-center gap-1.5" style={{ overflowWrap: 'anywhere' }}>
        {n.source_label ? <Radio size={size} strokeWidth={1.5} aria-hidden /> : <Newspaper size={size} strokeWidth={1.5} aria-hidden />}
        {n.source_label || 'Crisis update'}
      </span>
      <span className="inline-flex items-center gap-1.5" style={{ color: CK.muted, fontWeight: 600 }}>
        <Clock size={size - 1} strokeWidth={1.5} aria-hidden />{newsTime(n.published_at ?? n.created_at)}
      </span>
      <span className="inline-flex items-center gap-1.5" style={{ color: CK.muted, fontWeight: 600, overflowWrap: 'anywhere' }}>
        <AudIcon size={size - 1} strokeWidth={1.5} aria-hidden />{audienceLabel(n, cabinets)}
      </span>
    </div>
  );
}

export function NewsCard({ n, cabinets, onOpen }: { n: News; cabinets: Cabinet[]; onOpen?: (n: News) => void }) {
  const banner = n.banner_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={n.banner_url} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16 / 6', objectFit: 'cover', borderRadius: '22px 22px 0 0', background: CK.well }} />
  ) : null;
  const body = (
    <>
      <NewsMeta n={n} cabinets={cabinets} />
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
          style={{ border: 0, background: 'transparent', borderRadius: 22, padding: 0, cursor: 'pointer', fontFamily: CK.font }}
        >
          {banner}
          <span style={{ display: 'block', padding: '14px 16px' }}>{body}</span>
        </button>
      ) : <div>{banner}<div style={{ padding: '14px 16px' }}>{body}</div></div>}
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
