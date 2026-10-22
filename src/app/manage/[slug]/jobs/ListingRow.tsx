'use client';

// ── One listing on the organizer Job Board ─────────────────────────────────
//
// A roomy row: the role's photo (RoleThumb, ringed in the role's accent) and a
// thin top edge in that accent; the title (never cut off), the role word in its
// colour and the committee; the status as an icon and a word (Live green,
// Closed grey); the closing date, amber with an hourglass within 7 days; views, clicks to apply and applicants as
// big numbers with their word; Promoted ("until 26 Oct", "On the homepage")
// as a style A icon and words, never a chip, and a gold ring on the row.
// The three-dot menu (Edit, Promote, View on Job Board, Close, Delete) is a
// small portaled menu. Close and Delete are asked IN PLACE, in the row, never
// in a modal. A hidden listing carries Gavelling's note; a paid outside
// listing carries the lock and its hint.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  CalendarClock, CircleDot, CircleSlash, EyeOff, FilePen, Hourglass, House, Lock, Megaphone, MoreHorizontal, Pencil, Sparkles, Trash2, ExternalLink, XCircle, Share2,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { JOB_ROLE_LABEL } from '@/lib/jobBoard';
import { InfoHint } from '../settings/applicationsUi';
import { closeListing, dayLabel, type OrgListing, type ShownState } from './jobsApi';
import ListingFunnel from '@/app/jobs/ListingFunnel';
import ShareCardPopup from '@/app/jobs/ShareCardPopup';
import { ICON_STROKE, ROLE_THEME, RoleThumb, STATUS_TONE } from './jobKit';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

const STATUS: Record<ShownState, { word: string; icon: typeof CircleDot; color: string }> = {
  draft: { word: 'Draft', icon: FilePen, color: STATUS_TONE.draft },
  live: { word: 'Live', icon: CircleDot, color: STATUS_TONE.open },
  closed: { word: 'Closed', icon: CircleSlash, color: STATUS_TONE.closed },
  hidden: { word: 'Hidden', icon: EyeOff, color: STATUS_TONE.hidden },
};

/** A live listing closing within this many days reads in amber. */
const SOON_DAYS = 7;

function closingSoon(listing: OrgListing): boolean {
  if (listing.shown !== 'live' || !listing.closes_at) return false;
  const iso = listing.closes_at;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T23:59:59`) : new Date(iso);
  const left = d.getTime() - Date.now();
  return Number.isFinite(left) && left >= 0 && left <= SOON_DAYS * 86_400_000;
}

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
  const theme = ROLE_THEME[listing.role] ?? ROLE_THEME.chair;
  const RoleIcon = theme.icon;
  const soon = closingSoon(listing);

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
    <li
      className={`gv-jr${listing.promotion ? ' gv-jr-promoted' : ''}${listing.shown === 'closed' ? ' gv-jr-closed' : ''}`}
      style={{ '--gv-jr-accent': theme.accent } as CSSProperties}
    >
      <div className="gv-jr-main">
        <div className="gv-jr-id">
        <RoleThumb role={listing.role} size={60} />
        <div className="gv-jr-text">
          <p className="gv-jr-title">{listing.title || 'Untitled listing'}</p>
          <p className="gv-jr-sub">
            <span className="gv-jr-type" style={{ color: theme.text }}>
              <RoleIcon size={15} strokeWidth={1.8} aria-hidden className="gv-jr-sub-icon" style={{ color: theme.accent }} />
              {JOB_ROLE_LABEL[listing.role]}
            </span>
            {listing.committee && <span>· {listing.committee}</span>}
          </p>
          <p className="gv-jr-facts">
            <span className="gv-jr-status" style={{ color: st.color }}>
              <StatusIcon size={15} strokeWidth={1.9} aria-hidden />
              {st.word}
            </span>
            {closes && (
              <span className={`gv-jr-fact${soon ? ' gv-jr-soon' : ''}`}>
                {soon
                  ? <Hourglass size={15} strokeWidth={1.8} aria-hidden />
                  : <CalendarClock size={15} strokeWidth={ICON_STROKE} aria-hidden />}
                {listing.shown === 'draft' ? `Would close ${closes}` : listing.shown === 'closed' ? `Closed ${closes}` : `Closes ${closes}`}
              </span>
            )}
            {listing.kind === 'outside' && <span>Applies on another site</span>}
            {paidOutside && (
              <span className="gv-jr-lock">
                <Lock size={14} strokeWidth={ICON_STROKE} aria-hidden />
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
              <span className="gv-jr-fact gv-jr-fact-gold">
                <Sparkles size={15} strokeWidth={ICON_STROKE} aria-hidden />
                Promoted until {dayLabel(listing.promotion.ends_on)}
              </span>
              {listing.promotion.with_homepage && (
                <span className="gv-jr-fact gv-jr-fact-gold">
                  <House size={15} strokeWidth={ICON_STROKE} aria-hidden />
                  On the homepage
                </span>
              )}
            </p>
          )}
          {listing.shown === 'hidden' && listing.hidden_note && (
            <p className="gv-jr-hidden">Hidden by Gavelling: {listing.hidden_note}</p>
          )}
        </div>
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
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
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
              const body = (<><Icon size={16} strokeWidth={ICON_STROKE} aria-hidden />{it.label}</>);
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
.gv-jr{list-style:none;padding:19px 18px 16px;border-radius:18px;background:#FFFFFF;box-shadow:inset 0 3px 0 var(--gv-jr-accent,${FOREST}),0 1px 2px rgba(27,56,40,0.06),0 8px 24px rgba(27,56,40,0.08),inset 0 0 0 1px rgba(27,56,40,0.04);font-family:${FONT}}
/* Promoted: the role's top edge stays; a gold ring and glow mark the promotion. */
.gv-jr-promoted{box-shadow:inset 0 3px 0 var(--gv-jr-accent,${FOREST}),inset 0 0 0 1.5px rgba(201,161,62,0.55),0 0 0 4px rgba(238,217,138,0.28),0 1px 2px rgba(27,56,40,0.08),0 12px 28px -10px rgba(27,56,40,0.26)}
.gv-jr-closed{background:#FBFAF6}
.gv-jr-closed .gv-jk-thumb{filter:grayscale(0.85);opacity:0.75}
.gv-jr-main{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px 18px}
.gv-jr-id{min-width:0;display:flex;align-items:flex-start;gap:16px}
.gv-jr-id .gv-jk-thumb{margin:4px 0 0 4px}
.gv-jr-text{min-width:0;flex:1 1 auto}
.gv-jr-type{display:inline-flex;align-items:center;gap:6px;font-weight:700}
.gv-jr-soon{color:${STATUS_TONE.soon};font-weight:700}
.gv-jr-title{margin:0;font-size:17px;font-weight:700;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-jr-sub{margin:4px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;font-size:13.5px;font-weight:600;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-jr-sub-icon{flex-shrink:0}
.gv-jr-fact{display:inline-flex;align-items:center;gap:5px}
.gv-jr-fact-gold{font-size:13px;font-weight:700;color:#8A6614}
.gv-jr-facts{margin:8px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:13.5px;color:${INK_SOFT}}
.gv-jr-status{display:inline-flex;align-items:center;gap:5px;font-weight:700}
.gv-jr-lock{display:inline-flex;align-items:center;gap:4px;color:${INK_SOFT}}
.gv-jr-promo{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px 14px}
.gv-jr-hidden{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:rgba(158,42,18,0.07);font-size:13.5px;line-height:1.45;color:${DANGER};overflow-wrap:anywhere}
.gv-jr-funnel{grid-column:1 / -1;grid-row:2;min-width:0}
@media (max-width:600px){.gv-jr-id{gap:12px}.gv-jr-id .gv-jk-thumb{width:48px !important;height:48px !important;border-radius:13px}}
.gv-jr-stats{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:8px 26px;margin:0}
.gv-jr-stats div{display:flex;align-items:baseline;gap:6px;flex-direction:row-reverse;justify-content:flex-end}
.gv-jr-stats dd{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jr-stats dt{font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-jr-more{grid-column:2;grid-row:1;width:40px;height:40px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};
  background:#FFFFFF;border:1px solid rgba(27,56,40,0.20);box-shadow:0 1px 2px rgba(27,56,40,0.07);transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms cubic-bezier(0.22,1,0.36,1),box-shadow 150ms cubic-bezier(0.22,1,0.36,1)}
.gv-jr-more:hover{background:#F4F0E6;border-color:rgba(27,56,40,0.45);box-shadow:0 2px 8px rgba(27,56,40,0.12)}
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
