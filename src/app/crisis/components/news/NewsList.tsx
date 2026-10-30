'use client';
// Gavelling Crisis: published news, newest first. Used by the news page and the chair home.

import { useState, type CSSProperties } from 'react';
import { Clock, Landmark, Newspaper, Radio, Users } from 'lucide-react';
import { timeAgo } from '@/lib/crisis/format';
import type { Cabinet, News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK, Card } from '../../crisisKit';
import NewsDetailDialog from './NewsDetailDialog';
import { ZoomableImage } from './ImageLightbox';

/** "12 min ago": never a calendar date (the crisis has its own in-world date). */
export function newsTime(iso: string | null | undefined): string {
  return timeAgo(iso);
}

/** The exact time, for a title tooltip. */
export function newsTimeTitle(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return undefined;
  }
}

export function audienceLabel(n: Pick<News, 'audience_cabinet_id'>, cabinets: Cabinet[]): string {
  if (!n.audience_cabinet_id) return 'Every committee room';
  return cabinets.find((c) => c.id === n.audience_cabinet_id)?.name ?? 'One committee room';
}

/** A story's picture, or null when it has none: then the story is all text and reserves no picture space. */
export function newsPicture(n: Pick<News, 'banner_url'>): string | null {
  const u = n.banner_url?.trim();
  return u ? u : null;
}

/** The banner of a story; pressing it opens the whole picture full screen. Draws nothing at all when there is no picture or it fails to load. */
export function NewsPicture({ n, style }: { n: Pick<News, 'banner_url'>; style?: CSSProperties }) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = newsPicture(n);
  if (!src || broken === src) return null;
  // Pressing the picture opens it whole, uncropped (a span, because a story card around it is itself a button).
  return <ZoomableImage asSpan src={src} alt="Newsflash picture" onError={() => setBroken(src)} style={{ width: '100%', aspectRatio: '16 / 6', background: CK.well, ...style }} />;
}

/** The number of a story in the viewer's own cabinet, or null when it has none (a draft, or older news). */
export function ownNewsNumber(n: Pick<News, 'numbers'>, cabinetId: string | null): number | null {
  if (!cabinetId) return null;
  const x = n.numbers?.[cabinetId];
  return typeof x === 'number' ? x : null;
}

/**
 * The news number, big. A delegate or chair sees the number of their own cabinet; staff and press see
 * one number per cabinet that got the story ("ExComm No. 4 · Presidium No. 3"). `preview` draws the
 * placeholder a story has before it is published. `light` is for the dark red live pop-up.
 */
export function NewsNumber({ n, preview, light }: { n: Pick<News, 'numbers'>; preview?: boolean; light?: boolean }) {
  const v = useCrisis();
  const num = light ? CK.gold : CK.red;
  const soft = light ? 'rgba(255,240,226,0.8)' : CK.inkSoft;
  const big = { fontSize: 34, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: num } as const;
  if (preview) {
    return (
      <span className="inline-flex flex-col" style={{ flex: 'none' }}>
        <b style={big}>#</b>
        <span style={{ fontSize: 11, fontWeight: 600, color: soft, marginTop: 2 }}>Number given when published</span>
      </span>
    );
  }
  if (!v.staff && v.cabinetId) {
    const own = ownNewsNumber(n, v.cabinetId);
    if (own === null) return null;
    return (
      <span className="inline-flex items-baseline" style={{ gap: 5, flex: 'none' }} aria-label={`News number ${own}`}>
        <span style={{ fontSize: 12, fontWeight: 700, color: soft }}>No.</span>
        <b style={big}>{own}</b>
      </span>
    );
  }
  const entries = v.core.cabinets.filter((c) => typeof n.numbers?.[c.id] === 'number');
  if (!entries.length) return null;
  return (
    <span className="inline-flex flex-wrap items-baseline" style={{ gap: '4px 18px' }}>
      {entries.map((c) => (
        <span key={c.id} className="inline-flex items-baseline" style={{ gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: soft, overflowWrap: 'anywhere' }}>{c.short_name || c.name} No.</span>
          <b style={{ ...big, fontSize: entries.length > 1 ? 26 : 34 }}>{n.numbers[c.id]}</b>
        </span>
      ))}
    </span>
  );
}

/** The source and time of a story, each with its icon. Only staff are told which rooms it went to. */
export function NewsMeta({ n, cabinets, size = 14 }: { n: News; cabinets: Cabinet[]; size?: number }) {
  const v = useCrisis();
  const AudIcon = n.audience_cabinet_id ? Landmark : Users;
  return (
    <div className="flex items-center flex-wrap" style={{ gap: '3px 12px', fontSize: 12, fontWeight: 700, color: CK.red }}>
      <span className="inline-flex items-center gap-1.5" style={{ overflowWrap: 'anywhere' }}>
        {n.source_label ? <Radio size={size} strokeWidth={1.5} aria-hidden /> : <Newspaper size={size} strokeWidth={1.5} aria-hidden />}
        {n.source_label || 'Crisis update'}
      </span>
      <span className="inline-flex items-center gap-1.5" title={newsTimeTitle(n.published_at ?? n.created_at)} style={{ color: CK.muted, fontWeight: 600 }}>
        <Clock size={size - 1} strokeWidth={1.5} aria-hidden />{newsTime(n.published_at ?? n.created_at)}
      </span>
      {v.staff && (
        <span className="inline-flex items-center gap-1.5" style={{ color: CK.muted, fontWeight: 600, overflowWrap: 'anywhere' }}>
          <AudIcon size={size - 1} strokeWidth={1.5} aria-hidden />{audienceLabel(n, cabinets)}
        </span>
      )}
    </div>
  );
}

export function NewsCard({ n, cabinets, onOpen }: { n: News; cabinets: Cabinet[]; onOpen?: (n: News) => void }) {
  const banner = <NewsPicture n={n} style={{ borderRadius: '22px 22px 0 0' }} />;
  const body = (
    <>
      <div className="flex items-center flex-wrap" style={{ gap: '4px 14px' }}>
        <NewsNumber n={n} />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}><NewsMeta n={n} cabinets={cabinets} /></div>
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
