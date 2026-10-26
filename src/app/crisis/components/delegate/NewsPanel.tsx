'use client';
// Gavelling Crisis: the compact news block at the top of the delegate's right column. The latest three
// stories, each with its big number for this delegate's cabinet, the source and the title. A click opens
// the story; "All news" opens the list.

import { Newspaper, Radio } from 'lucide-react';
import type { News } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, Skeleton } from '../../crisisKit';
import { newsTime } from '../news/NewsList';

const SHOWN = 3;

export default function NewsPanel({ items, cabinetId, onOpen, onAll }: {
  items: News[] | null; cabinetId: string | null; onOpen: (n: News) => void; onAll: () => void;
}) {
  const latest = (items ?? [])
    .filter((n) => n.status === 'published')
    .sort((a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime())
    .slice(0, SHOWN);
  return (
    <Card style={{ padding: '12px 14px 6px' }}>
      <CardTitle
        icon={<Newspaper size={17} strokeWidth={1.5} />}
        right={<Btn tone="ghost" size="sm" onClick={onAll}>All news</Btn>}
      >
        News
      </CardTitle>
      {items === null ? (
        <div className="grid gap-2" style={{ paddingBottom: 8 }}><Skeleton h={48} r={12} /><Skeleton h={48} r={12} /></div>
      ) : latest.length === 0 ? (
        <p style={{ margin: '0 0 10px', fontSize: 13.5, color: CK.inkSoft }}>No news yet. It shows up here as soon as it is published.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {latest.map((n, i) => {
            const no = cabinetId ? n.numbers?.[cabinetId] : undefined;
            return (
              <li key={n.id} style={{ boxShadow: i === 0 ? 'none' : `inset 0 1px 0 ${CK.hair}` }}>
                <button
                  type="button"
                  onClick={() => onOpen(n)}
                  className="flex w-full text-left items-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ gap: 12, border: 0, background: 'transparent', padding: '9px 2px', cursor: 'pointer', fontFamily: CK.font, borderRadius: 10 }}
                >
                  <span aria-label={no !== undefined ? `News ${no}` : undefined} style={{ width: 46, flexShrink: 0, textAlign: 'center', fontSize: 30, lineHeight: 1.05, fontWeight: 800, color: CK.red, fontVariantNumeric: 'tabular-nums' }}>
                    {no !== undefined ? no : <Newspaper size={24} strokeWidth={1.5} aria-hidden style={{ margin: '4px auto 0' }} />}
                  </span>
                  <span className="min-w-0" style={{ flex: 1 }}>
                    <span className="flex items-center flex-wrap" style={{ gap: '0 10px', fontSize: 11.5, fontWeight: 700, color: CK.red }}>
                      <span className="inline-flex items-center" style={{ gap: 4, overflowWrap: 'anywhere' }}>
                        <Radio size={12} strokeWidth={1.5} aria-hidden />{n.source_label || 'Crisis update'}
                      </span>
                      <span style={{ color: CK.muted, fontWeight: 600 }}>{newsTime(n.published_at ?? n.created_at)}</span>
                    </span>
                    <b title={n.title} style={{ display: '-webkit-box', marginTop: 2, fontSize: 14, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.title}</b>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
