'use client';

// ── One listing on the organizer Job Board ─────────────────────────────────
//
// A roomy row: the title (never cut off), role and committee; the status as an
// icon and a word; the closing date; views, clicks to apply and applicants as
// big numbers with their word; the Promoted chip ("until 26 Oct", "Homepage").
// The three-dot menu (Edit, Promote, View on Job Board, Close, Delete) is a
// small portaled menu. Close and Delete are asked IN PLACE, in the row, never
// in a modal. A hidden listing carries Gavelling's note; a paid outside
// listing carries the lock and its hint.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CircleDot, CircleSlash, EyeOff, FilePen, Lock, Megaphone, MoreHorizontal, Pencil, Sparkles, Trash2, ExternalLink, XCircle, Share2,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { JOB_ROLE_LABEL } from '@/lib/jobBoard';
import { InfoHint } from '../settings/applicationsUi';
import { closeListing, dayLabel, type OrgListing, type ShownState } from './jobsApi';
import ListingFunnel from '@/app/jobs/ListingFunnel';
import ShareCardPopup from '@/app/jobs/ShareCardPopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

const STATUS: Record<ShownState, { word: string; icon: typeof CircleDot; color: string }> = {
  draft: { word: 'Draft', icon: FilePen, color: '#8A6614' },
  live: { word: 'Live', icon: CircleDot, color: FOREST },
  closed: { word: 'Closed', icon: CircleSlash, color: INK_SOFT },
  hidden: { word: 'Hidden', icon: EyeOff, color: DANGER },
};

export default function ListingRow({ listing, canPromote, onEdit, onPromote, onChanged }: {
  listing: OrgListing;
  canPromote: boolean;
  onEdit: () => void;
  onPromote: () => void;
  /** Read the panel again after a close or delete landed. */
  onChanged: (message: string) => void;
}) {
  const [asking, setAsking] = useState<null | 'close' | 'delete'>(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const st = STATUS[listing.shown] ?? STATUS.draft;
  const StatusIcon = st.icon;
  const paidOutside = listing.kind === 'outside' && (listing.charged_credits > 0 || listing.locked);
  const closes = dayLabel(listing.closes_at);
  const sub = [JOB_ROLE_LABEL[listing.role], listing.committee].filter(Boolean).join(' · ');

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const r = await closeListing(listing.id);
      if (!r.ok) { setErr(r.message); return; }
      setAsking(null);
      onChanged(r.message || (r.deleted ? 'Draft deleted' : 'Listing closed'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <li className="gv-jr">
      <div className="gv-jr-main">
        <div className="gv-jr-id">
          <p className="gv-jr-title">{listing.title || 'Untitled listing'}</p>
          {sub && <p className="gv-jr-sub">{sub}</p>}
          <p className="gv-jr-facts">
            <span className="gv-jr-status" style={{ color: st.color }}>
              <StatusIcon size={15} strokeWidth={2.4} aria-hidden />
              {st.word}
            </span>
            {closes && listing.shown !== 'draft' && <span>{listing.shown === 'closed' ? `Closed ${closes}` : `Closes ${closes}`}</span>}
            {closes && listing.shown === 'draft' && <span>Would close {closes}</span>}
            {listing.kind === 'outside' && <span>Applies on another site</span>}
            {paidOutside && (
              <span className="gv-jr-lock">
                <Lock size={13} strokeWidth={2.4} aria-hidden />
                <InfoHint
                  label="What is fixed"
                  text={listing.fix_available
                    ? 'Role, title, link and dates are fixed after publishing. One free fix in the first 24 hours'
                    : 'Role, title, link and dates are fixed'}
                  size={14}
                />
              </span>
            )}
          </p>
          {listing.promotion && (
            <p className="gv-jr-promo">
              <span className="gv-jr-chip">
                <Sparkles size={12} strokeWidth={2.4} aria-hidden />
                Promoted until {dayLabel(listing.promotion.ends_on)}
              </span>
              {listing.promotion.with_homepage && <span className="gv-jr-chip gv-jr-chip-soft">Homepage</span>}
            </p>
          )}
          {listing.shown === 'hidden' && listing.hidden_note && (
            <p className="gv-jr-hidden">Hidden by Gavelling: {listing.hidden_note}</p>
          )}
        </div>

        <div className="gv-jr-funnel">
          <ListingFunnel
            funnel={listing.funnel}
            fallback={{ views: listing.views, clicks: listing.clicks, applicants: listing.applicants }}
            outside={listing.kind === 'outside'}
          />
        </div>

        <RowMenu
          items={[
            { key: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
            ...(listing.shown === 'live' && canPromote ? [{ key: 'promote', label: 'Promote', icon: Megaphone, onClick: onPromote }] : []),
            ...(listing.shown !== 'draft' ? [{ key: 'view', label: 'View on Job Board', icon: ExternalLink, href: `/jobs?listing=${encodeURIComponent(listing.id)}` }] : []),
            ...(listing.shown === 'live' ? [{ key: 'share', label: 'Share card', icon: Share2, onClick: () => setSharing(true) }] : []),
            ...(listing.shown === 'live' ? [{ key: 'close', label: 'Close', icon: XCircle, onClick: () => { setErr(''); setAsking('close'); } }] : []),
            ...(listing.shown === 'draft' ? [{ key: 'delete', label: 'Delete', icon: Trash2, danger: true, onClick: () => { setErr(''); setAsking('delete'); } }] : []),
          ]}
          label={`Actions for ${listing.title || 'this listing'}`}
        />
      </div>

      {sharing && <ShareCardPopup card={listing} onClose={() => setSharing(false)} />}

      {asking && (
        <div className="gv-jr-ask" role="group" aria-label={asking === 'close' ? 'Close this listing' : 'Delete this draft'}>
          <p>{asking === 'close' ? 'Close this listing? It stops taking applicants' : 'Delete this draft? It cannot be brought back'}</p>
          <div className="gv-jr-ask-btns">
            <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setAsking(null); setErr(''); }} disabled={busy}>Keep it</button>
            <button type="button" className="gv-st-btn gv-jr-danger" onClick={() => { void confirm(); }} disabled={busy} aria-busy={busy || undefined}>
              {busy ? (asking === 'close' ? 'Closing' : 'Deleting') : asking === 'close' ? 'Close listing' : 'Delete draft'}
            </button>
          </div>
          {err && <p role="alert" className="gv-jr-err">{err}</p>}
        </div>
      )}
    </li>
  );
}

type MenuItem = {
  key: string; label: string; icon: typeof Pencil; danger?: boolean;
  onClick?: () => void; href?: string;
};

/** The three-dot menu: a small portaled list at fixed coordinates, flipped near the edges. */
function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const W = 220;

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = menu.current?.offsetHeight ?? items.length * 44 + 12;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
    setPos({ top, left });
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="gv-jr-more"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { if (!open) place(); setOpen((v) => !v); }}
      >
        <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden />
      </button>
      {open && (
        <Portal>
          <div
            ref={menu}
            role="menu"
            className="gv-jr-menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: W, visibility: pos ? 'visible' : 'hidden' }}
          >
            {items.map((it) => {
              const Icon = it.icon;
              const body = (<><Icon size={16} strokeWidth={2.3} aria-hidden />{it.label}</>);
              return it.href ? (
                <Link key={it.key} role="menuitem" href={it.href} target="_blank" className="gv-jr-mi" onClick={() => setOpen(false)}>{body}</Link>
              ) : (
                <button key={it.key} role="menuitem" type="button" className={`gv-jr-mi${it.danger ? ' gv-jr-mi-danger' : ''}`} onClick={() => { setOpen(false); it.onClick?.(); }}>{body}</button>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}

export const ROW_CSS = `
.gv-jr{list-style:none;padding:16px 18px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 6px 18px rgba(27,56,40,0.07);font-family:${FONT}}
.gv-jr-main{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px 18px}
.gv-jr-id{min-width:0}
.gv-jr-title{margin:0;font-size:17px;font-weight:700;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-jr-sub{margin:3px 0 0;font-size:13.5px;font-weight:600;color:${FOREST};overflow-wrap:anywhere}
.gv-jr-facts{margin:8px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:13.5px;color:${INK_SOFT}}
.gv-jr-status{display:inline-flex;align-items:center;gap:5px;font-weight:700}
.gv-jr-lock{display:inline-flex;align-items:center;gap:4px;color:${INK_SOFT}}
.gv-jr-promo{margin:10px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.gv-jr-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;color:#4A3410;background:linear-gradient(145deg,#F3E3A1 0%,#EED98A 55%,#D9B44A 100%);box-shadow:0 1px 4px rgba(182,135,31,0.3)}
.gv-jr-chip-soft{background:rgba(238,217,138,0.4);box-shadow:none}
.gv-jr-hidden{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:rgba(158,42,18,0.07);font-size:13.5px;line-height:1.45;color:${DANGER};overflow-wrap:anywhere}
.gv-jr-funnel{grid-column:1 / -1;grid-row:2;min-width:0}
.gv-jr-stats{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:8px 26px;margin:0}
.gv-jr-stats div{display:flex;align-items:baseline;gap:6px;flex-direction:row-reverse;justify-content:flex-end}
.gv-jr-stats dd{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jr-stats dt{font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-jr-more{grid-column:2;grid-row:1;width:40px;height:40px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};
  background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-jr-more:focus{outline:none}
.gv-jr-more:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (min-width:1100px){
  .gv-jr-main{grid-template-columns:minmax(0,1fr) auto auto;align-items:center}
  .gv-jr-stats{grid-column:auto;grid-row:1;flex-wrap:nowrap;gap:22px}
  .gv-jr-stats div{flex-direction:column-reverse;align-items:flex-end;gap:0}
  .gv-jr-more{grid-column:3}
}
.gv-jr-menu{position:fixed;z-index:1300;padding:6px;border-radius:14px;background:#FFFFFF;box-shadow:0 12px 36px rgba(27,56,40,0.2),0 0 0 1px rgba(27,56,40,0.06);font-family:${FONT}}
.gv-jr-mi{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:0 12px;border:none;border-radius:10px;background:transparent;cursor:pointer;font-family:${FONT};font-size:14.5px;font-weight:600;color:${INK};text-decoration:none;text-align:left}
.gv-jr-mi:hover,.gv-jr-mi:focus-visible{background:#F3EFE6;outline:none}
.gv-jr-mi-danger{color:${DANGER}}
.gv-jr-ask{margin-top:14px;padding-top:14px;border-top:1px solid rgba(28,20,16,0.08);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px}
.gv-jr-ask p{margin:0;font-size:14.5px;font-weight:600;color:${INK}}
.gv-jr-ask-btns{display:flex;gap:8px}
.gv-jr-danger{background:${DANGER};color:#FFFFFF}
.gv-jr-danger:hover:not(:disabled){background:#86230F}
.gv-jr-err{flex-basis:100%;margin:0;font-size:13.5px;color:${DANGER}}
`;
