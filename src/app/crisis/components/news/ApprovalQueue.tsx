'use client';
// Gavelling Crisis: everything waiting for the Crisis Director (and the assistant directors) to say yes or no to, on every page.
// 1. Each press release waiting for approval, and each news draft a backroomer saved, rises from the bottom of the screen as a card
//    with its approve and reject buttons. A card stays until it is decided or closed (closing hides the card only).
// 2. A small "Waiting for a reply" button at the bottom right keeps the count and opens a side list of everything still waiting,
//    each with the same buttons, until it is approved or rejected.
// Press releases are read once per tab every 30 s (pressQueue.ts); news drafts arrive live (useCrisisNews). Mounted once in the crisis layout.

import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Megaphone, Newspaper, Pencil, Send, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, publishNews } from '@/lib/crisis/api';
import { timeAgo } from '@/lib/crisis/format';
import type { News } from '@/lib/crisis/types';
import type { PendingRelease } from '@/lib/press';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, CK } from '../../crisisKit';
import NewsComposerDialog from '../command/NewsComposerDialog';
import AttachmentView from './AttachmentView';
import { ZoomableImage } from './ImageLightbox';
import { audienceLabel, newsPicture } from './NewsList';
import { decidePressRelease, usePressQueue } from './pressQueue';
import { useCrisisNews } from './useCrisisNews';

const MAX_CARDS = 3;

export type WaitingItem =
  | { kind: 'press'; key: string; at: string; r: PendingRelease }
  | { kind: 'news'; key: string; at: string; n: News };

function roomsText(rooms: string[]): string {
  return rooms.length === 0 ? 'Every committee room' : rooms.join(', ');
}

/** One thing waiting for a reply. `card` is the bottom card, `row` the side list. Press releases get Approve and send and Reject; a news draft gets Publish and Edit. */
export function WaitingItemView({ item, variant, conferenceId, onEdit, onPublished, onClose, cabinetsLabel }: {
  item: WaitingItem;
  variant: 'card' | 'row';
  conferenceId: string;
  onEdit: (n: News) => void;
  onPublished: () => void;
  onClose?: () => void;
  cabinetsLabel: (n: News) => string;
}) {
  const v = useCrisis();
  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'publish'>(null);
  const card = variant === 'card';
  const text = item.kind === 'press' ? item.r.message : item.n.body;
  const picture = item.kind === 'press' ? item.r.imageUrl : newsPicture(item.n);

  const decide = async (approve: boolean) => {
    if (busy || item.kind !== 'press') return;
    setBusy(approve ? 'approve' : 'reject');
    await decidePressRelease(conferenceId, item.r, approve);
    setBusy(null);
  };
  const publish = async () => {
    if (busy || item.kind !== 'news') return;
    setBusy('publish');
    try {
      const r = await publishNews(v.ref, item.n.id);
      notifyOk(r.rooms <= 0 ? 'Published. No committee room was open to show it in.' : `Published to ${r.rooms} committee ${r.rooms === 1 ? 'room' : 'rooms'}`, 'crisis-press');
      onPublished();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not publish that.'), 'crisis-press');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ background: card ? CK.card : CK.well, borderRadius: card ? 20 : 14, padding: card ? '14px 16px' : '10px 12px', boxShadow: card ? CK.shadow : 'none', fontFamily: CK.font, position: 'relative' }}>
      {onClose && (
        <button
          type="button" aria-label="Close this card, it stays in the waiting list" onClick={onClose}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ position: 'absolute', top: 8, right: 8, border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        ><X size={15} strokeWidth={1.5} aria-hidden /></button>
      )}
      <div className="flex items-center" style={{ gap: 8, paddingRight: onClose ? 32 : 0 }}>
        <span aria-hidden style={{ color: CK.red, display: 'inline-flex' }}>{item.kind === 'press' ? <Megaphone size={17} strokeWidth={1.5} /> : <Newspaper size={17} strokeWidth={1.5} />}</span>
        <b style={{ fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>
          {item.kind === 'press' ? `Press release${item.r.authorLabel ? `: ${item.r.authorLabel}` : ''}` : `News draft: ${item.n.title}`}
        </b>
      </div>
      <p className="flex items-center flex-wrap" style={{ margin: '3px 0 0', gap: '2px 10px', fontSize: 12, color: CK.muted }}>
        <span className="inline-flex items-center gap-1"><Clock size={12} strokeWidth={1.5} aria-hidden />Sent {timeAgo(item.at)}</span>
        <span style={{ overflowWrap: 'anywhere' }}>{item.kind === 'press' ? roomsText(item.r.rooms) : cabinetsLabel(item.n)}</span>
      </p>
      {picture && (
        <ZoomableImage src={picture} alt={item.kind === 'press' ? 'Press release picture' : 'Newsflash picture'} style={{ width: card ? 72 : '100%', maxWidth: card ? 72 : 300, height: card ? 72 : undefined, aspectRatio: card ? undefined : '16 / 7', borderRadius: 10, marginTop: 8 }} />
      )}
      <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(card ? { maxHeight: 150, overflowY: 'auto' as const } : {}) }}>{text}</p>
      {!card && item.kind === 'news' && item.n.attachment_url && <div style={{ marginTop: 8 }}><AttachmentView url={item.n.attachment_url} name={item.n.attachment_name} /></div>}
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 10 }}>
        {item.kind === 'press' ? (
          <>
            <Btn size="sm" tone="green" icon={<Check size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => void decide(true)}>{busy === 'approve' ? 'Approving' : 'Approve and send'}</Btn>
            <Btn size="sm" tone="danger" icon={<X size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => void decide(false)}>{busy === 'reject' ? 'Rejecting' : 'Reject'}</Btn>
          </>
        ) : (
          <>
            <Btn size="sm" tone="green" icon={<Send size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => void publish()}>{busy === 'publish' ? 'Publishing' : 'Publish'}</Btn>
            <Btn size="sm" tone="ghost" icon={<Pencil size={14} strokeWidth={1.5} aria-hidden />} disabled={!!busy} onClick={() => onEdit(item.n)}>Edit</Btn>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.crisis-wait-cards { position: fixed; right: 12px; bottom: calc(76px + 50px + env(safe-area-inset-bottom, 0px)); z-index: 240; width: min(400px, calc(100vw - 24px)); display: grid; gap: 8px; }
.crisis-wait-card { animation: crisis-wait-rise 380ms cubic-bezier(0.22,1,0.36,1) both; }
.crisis-wait-pill { position: fixed; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); z-index: 240; }
.crisis-wait-drawer { position: fixed; right: 0; top: var(--crisis-bar-h, 56px); bottom: 0; z-index: 245; width: min(430px, 100vw); display: flex; flex-direction: column; background: #FBF4EE; box-shadow: -10px 0 30px rgba(58,14,15,0.18); animation: crisis-wait-slide 260ms cubic-bezier(0.22,1,0.36,1) both; }
@media (min-width: 768px) { .crisis-wait-cards { bottom: calc(22px + 50px); right: 18px; } .crisis-wait-pill { bottom: 22px; right: 18px; } }
@keyframes crisis-wait-rise { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
@keyframes crisis-wait-slide { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .crisis-wait-card, .crisis-wait-drawer { animation: none; } }
`;

function Queue({ signedIn }: { signedIn: boolean }) {
  const v = useCrisis();
  const conferenceId = v.conference.id;
  const press = usePressQueue(conferenceId, signedIn);
  const { items: news, reload } = useCrisisNews(v.ref);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<News | null>(null);
  // Re-draws the "waiting since" times every 30 s.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const loaded = (press.state !== 'loading' || !signedIn) && news !== null;
  const items = useMemo<WaitingItem[]>(() => {
    const out: WaitingItem[] = [];
    (press.board?.pending ?? []).forEach((r) => out.push({ kind: 'press', key: `p:${r.id}`, at: r.createdAt, r }));
    (news ?? []).filter((n) => n.status === 'draft').forEach((n) => out.push({ kind: 'news', key: `n:${n.id}`, at: n.created_at, n }));
    // The longest wait first: those are the ones that got delayed.
    return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [press.board, news]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-image-lightbox]')) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!loaded || items.length === 0) {
    return editing ? <NewsComposerDialog edit={editing} onClose={() => setEditing(null)} onChanged={() => { void reload(); }} /> : null;
  }

  const cabinetsLabel = (n: News) => `${audienceLabel(n, v.core.cabinets)}`;
  const cards = open ? [] : items.filter((i) => !closed.has(i.key));
  const shown = cards.slice(0, MAX_CARDS);
  const hidden = items.length - shown.length;
  const common = { conferenceId, onEdit: (n: News) => { setOpen(false); setEditing(n); }, onPublished: () => { void reload(); }, cabinetsLabel };

  return (
    <>
      <style>{CSS}</style>
      {!open && shown.length > 0 && (
        <div className="crisis-wait-cards" role="status" aria-live="polite">
          {shown.map((it) => (
            <div key={it.key} className="crisis-wait-card">
              <WaitingItemView item={it} variant="card" {...common} onClose={() => setClosed((s) => new Set(s).add(it.key))} />
            </div>
          ))}
          {hidden > 0 && (
            <button
              type="button" onClick={() => setOpen(true)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, borderRadius: 14, padding: '8px 12px', background: CK.card, boxShadow: CK.shadowSm, color: CK.forest, fontSize: 13, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: CK.font }}
            >{hidden} more waiting for a reply</button>
          )}
        </div>
      )}
      {!open && (
        <button
          type="button" className="crisis-wait-pill inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]" onClick={() => setOpen(true)}
          aria-label={`Waiting for a reply: ${items.length}`}
          style={{ gap: 8, border: 0, borderRadius: 999, padding: '9px 16px 9px 12px', background: CK.redBtn, color: '#FFF4E6', boxShadow: CK.redShadow, cursor: 'pointer', fontFamily: CK.font, fontSize: 13.5, fontWeight: 700 }}
        >
          <b style={{ fontSize: 20, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.gold }}>{items.length}</b>
          Waiting for a reply
        </button>
      )}
      {open && (
        <aside className="crisis-wait-drawer" aria-label="Waiting for a reply">
          <div className="flex items-center" style={{ gap: 10, padding: '14px 16px 10px' }}>
            <b style={{ fontSize: 26, lineHeight: 1, color: CK.red, fontVariantNumeric: 'tabular-nums', fontFamily: CK.font }}>{items.length}</b>
            <h2 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 800, color: CK.ink, fontFamily: CK.font }}>Waiting for a Reply</h2>
            <button
              type="button" aria-label="Close the list" onClick={() => setOpen(false)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: CK.well, color: CK.inkSoft, borderRadius: 999, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            ><X size={16} strokeWidth={1.5} aria-hidden /></button>
          </div>
          <div className="grid" style={{ gap: 8, padding: '0 12px 16px', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
            {items.map((it) => <WaitingItemView key={it.key} item={it} variant="row" {...common} />)}
          </div>
        </aside>
      )}
      {editing && <NewsComposerDialog edit={editing} onClose={() => setEditing(null)} onChanged={() => { void reload(); }} />}
    </>
  );
}

/** Mounted once in the crisis layout. Only the Crisis Director, assistant directors and the organiser see it. */
export default function ApprovalQueue() {
  const v = useCrisis();
  const { user } = useAuth();
  if (!v.director) return null;
  return <Queue signedIn={!!user} />;
}
