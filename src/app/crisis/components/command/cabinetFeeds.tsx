'use client';
// Gavelling Crisis: a cabinet's Cabinet Directives and Crisis News, drawn ONE way for everyone who looks at them: the room
// pop-up on Command (tabs "Cabinet Directives" and "Crisis News") and the chair's Front Room. Same rows, same filters, same
// order, so what the Crisis Director sees for a cabinet is what its chair sees. Title first, then the status.
//   Cabinet Directives  the directives sent in the cabinet's name (kind committee), newest first, every status.
//   Crisis News         published stories for that cabinet or for every room, newest first.
// A row with `onOpen` is a button that opens the item; without it the row unfolds in place (a chair reads the text there).

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Landmark, Newspaper, Radio, Users } from 'lucide-react';
import { dirNumber } from '@/lib/crisis/format';
import type { Cabinet, Character, Directive, News } from '@/lib/crisis/types';
import { CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { OutcomeLine, StatusLine, whenLabel, whenTitle } from '../delegate/directiveUi';
import { DirectiveBody } from '../directives/attachedImage';
import { NumberBadge } from '../directives/directiveParts';
import NewsDetailDialog from '../news/NewsDetailDialog';
import { audienceLabel, newsTime, newsTimeTitle } from '../news/NewsList';

const newest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

/** The cabinet's own directives, newest first (a withdrawn one is not listed). */
export function cabinetDirectivesOf(directives: Directive[] | null, cabinetId: string | null): Directive[] | null {
  if (!directives) return null;
  return directives.filter((d) => d.kind === 'committee' && d.status !== 'withdrawn' && (!cabinetId || d.cabinet_id === cabinetId)).sort(newest);
}

/** Published news the cabinet gets (its own or every room's), newest first. */
export function cabinetNewsOf(news: News[] | null, cabinetId: string | null): News[] | null {
  if (!news) return null;
  return news
    .filter((n) => n.status === 'published' && (!cabinetId || !n.audience_cabinet_id || n.audience_cabinet_id === cabinetId))
    .sort((a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime());
}

const rowBase = { width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '11px 0', fontFamily: CK.font, color: CK.ink, borderTop: `1px solid ${CK.hair}` } as const;
const focusCls = 'block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]';

function Empty({ children }: { children: string }) {
  return <p style={{ margin: 0, padding: '4px 0', fontSize: 14, color: CK.inkSoft, fontFamily: CK.font }}>{children}</p>;
}

function Loading() {
  return <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={54} /><Skeleton h={54} /></div>;
}

function authorName(d: Directive, characters: Character[]): string | null {
  return characters.find((c) => c.id === d.author_character_id)?.name ?? null;
}

function DirectiveRow({ d, characters, onOpen }: { d: Directive; characters: Character[]; onOpen?: (d: Directive) => void }) {
  const [open, setOpen] = useState(false);
  const name = authorName(d, characters);
  const head = (
    <>
      <span className="flex items-start gap-2 flex-wrap">
        <b style={{ flex: '1 1 200px', minWidth: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
        <NumberBadge n={dirNumber(d)} style={{ marginTop: 2 }} />
      </span>
      <span className="flex items-center flex-wrap" style={{ gap: '2px 12px', marginTop: 3 }}>
        <StatusLine s={d.status} />
        <OutcomeLine d={d} />
      </span>
      <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.muted, overflowWrap: 'anywhere' }}>
        {name ? <>From {name}</> : 'Cabinet directive'}
        <span title={whenTitle(d.created_at)}>{` · ${whenLabel(d.created_at)}`}</span>
      </span>
    </>
  );
  if (onOpen) {
    return <button type="button" onClick={() => onOpen(d)} className={focusCls} style={{ ...rowBase, cursor: 'pointer' }}>{head}</button>;
  }
  return (
    <div style={rowBase}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={focusCls} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font }}>{head}</button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ marginTop: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}
      >
        {open ? <ChevronUp size={14} strokeWidth={1.6} aria-hidden /> : <ChevronDown size={14} strokeWidth={1.6} aria-hidden />}
        {open ? 'Show less' : 'Read all'}
      </button>
      {open && <div style={{ marginTop: 6 }}><DirectiveBody body={d.body} style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} /></div>}
    </div>
  );
}

/** The cabinet's directives: title first, then the status. */
export function CabinetDirectivesList({ directives, cabinetId, onOpen }: { directives: Directive[] | null; cabinetId: string | null; onOpen?: (d: Directive) => void }) {
  const { core } = useCrisis();
  const list = useMemo(() => cabinetDirectivesOf(directives, cabinetId), [directives, cabinetId]);
  if (list === null) return <Loading />;
  if (list.length === 0) return <Empty>No cabinet directives yet.</Empty>;
  return (
    <div>
      {list.map((d) => <DirectiveRow key={d.id} d={d} characters={core.characters} onOpen={onOpen} />)}
    </div>
  );
}

function NewsRow({ n, cabinetId, cabinets, onOpen }: { n: News; cabinetId: string | null; cabinets: Cabinet[]; onOpen: (n: News) => void }) {
  const num = cabinetId ? n.numbers?.[cabinetId] : undefined;
  const Aud = n.audience_cabinet_id ? Landmark : Users;
  return (
    <button type="button" onClick={() => onOpen(n)} className={focusCls} style={{ ...rowBase, cursor: 'pointer' }}>
      <span className="flex items-start gap-2 flex-wrap">
        <b style={{ flex: '1 1 200px', minWidth: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
        {typeof num === 'number' && <NumberBadge n={num} style={{ marginTop: 2 }} />}
      </span>
      <span className="flex items-center flex-wrap" style={{ gap: '2px 12px', marginTop: 3, fontSize: 12.5, fontWeight: 700, color: CK.red }}>
        <span className="inline-flex items-center gap-1.5" style={{ overflowWrap: 'anywhere' }}>
          {n.source_label ? <Radio size={13} strokeWidth={1.5} aria-hidden /> : <Newspaper size={13} strokeWidth={1.5} aria-hidden />}
          {n.source_label || 'Crisis update'}
        </span>
        <span title={newsTimeTitle(n.published_at ?? n.created_at)} style={{ color: CK.muted, fontWeight: 600 }}>{newsTime(n.published_at ?? n.created_at)}</span>
        <span className="inline-flex items-center gap-1.5" style={{ color: CK.muted, fontWeight: 600 }}><Aud size={13} strokeWidth={1.5} aria-hidden />{audienceLabel(n, cabinets)}</span>
      </span>
    </button>
  );
}

/** The cabinet's news: title first, then where it came from and when. A click opens the story (`onOpen`, or the news dialog). */
export function CrisisNewsList({ news, cabinetId, onOpen }: { news: News[] | null; cabinetId: string | null; onOpen?: (n: News) => void }) {
  const { core } = useCrisis();
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(() => cabinetNewsOf(news, cabinetId), [news, cabinetId]);
  if (list === null) return <Loading />;
  if (list.length === 0) return <Empty>No news yet. It shows up here as soon as it is published.</Empty>;
  const opened = !onOpen && openId ? list.find((x) => x.id === openId) : null;
  return (
    <>
      <div>
        {list.map((n) => <NewsRow key={n.id} n={n} cabinetId={cabinetId} cabinets={core.cabinets} onOpen={onOpen ?? ((x) => setOpenId(x.id))} />)}
      </div>
      {opened && <NewsDetailDialog n={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}
