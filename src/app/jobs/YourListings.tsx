'use client';

// ── Your Listings on /jobs: the standalone listings this person posted ──────
//
// docs/conferences/job-board.md, prompt 5. One row per listing from job_my():
// the title (never cut off), the role and conference, the status as an icon
// and a word, the closing date, the lock hint on a paid listing, the Promoted
// chip, Gavelling's note on a hidden listing, and views and clicks as big
// numbers with their word. Actions: Edit, Promote (live), Close (live) and
// Delete (drafts). Close and Delete are asked IN PLACE in the row, never in a
// modal. The title selects the listing for the right pane.

import { useRef, useState } from 'react';
import { CircleDot, CircleSlash, EyeOff, FilePen, Lock, Megaphone, Pencil, Sparkles, Trash2, XCircle } from 'lucide-react';
import { JOB_ROLE_LABEL, type JobMyListing } from '@/lib/jobBoard';
import { InfoHint } from '@/app/manage/[slug]/settings/applicationsUi';
import { closeListing, dayLabel } from '@/app/manage/[slug]/jobs/jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#9E2A12';

type Shown = JobMyListing['shown'];
const STATUS: Record<Shown, { word: string; icon: typeof CircleDot; color: string }> = {
  draft: { word: 'Draft', icon: FilePen, color: '#8A6614' },
  live: { word: 'Live', icon: CircleDot, color: FOREST },
  closed: { word: 'Closed', icon: CircleSlash, color: INK_SOFT },
  hidden: { word: 'Hidden', icon: EyeOff, color: DANGER },
};

export default function YourListings({ listings, selectedId, onSelect, onEdit, onPromote, onChanged }: {
  listings: JobMyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (l: JobMyListing) => void;
  onPromote: (l: JobMyListing) => void;
  /** A close or delete landed: toast and read job_my again. */
  onChanged: (message: string) => void;
}) {
  // Drafts first, then the rest in the server's order.
  const rows = [...listings].sort((a, b) => (a.shown === 'draft' ? 0 : 1) - (b.shown === 'draft' ? 0 : 1));
  return (
    <>
      <style>{YL_CSS}</style>
      <ul className="gv-yl-list">
        {rows.map((l) => (
          <Row
            key={l.id}
            listing={l}
            selected={l.id === selectedId}
            onSelect={() => onSelect(l.id)}
            onEdit={() => onEdit(l)}
            onPromote={() => onPromote(l)}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </>
  );
}

function Row({ listing, selected, onSelect, onEdit, onPromote, onChanged }: {
  listing: JobMyListing;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onPromote: () => void;
  onChanged: (message: string) => void;
}) {
  const [asking, setAsking] = useState<null | 'close' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const st = STATUS[listing.shown] ?? STATUS.draft;
  const StatusIcon = st.icon;
  const paid = listing.charged_credits > 0 || listing.locked;
  const closes = dayLabel(listing.closes_at);
  const conf = listing.conference;
  const sub = [JOB_ROLE_LABEL[listing.role], conf.short || conf.name].filter(Boolean).join(' · ');

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
    <li className={`gv-yl${selected ? ' gv-yl-on' : ''}`}>
      <button type="button" className="gv-yl-title" onClick={onSelect} aria-current={selected || undefined}>
        {listing.title || 'Untitled listing'}
      </button>
      {sub && <p className="gv-yl-sub">{sub}</p>}
      <p className="gv-yl-facts">
        <span className="gv-yl-status" style={{ color: st.color }}>
          <StatusIcon size={15} strokeWidth={2.4} aria-hidden />
          {st.word}
        </span>
        {closes && listing.shown !== 'draft' && <span>{listing.shown === 'closed' ? `Closed ${closes}` : `Closes ${closes}`}</span>}
        {closes && listing.shown === 'draft' && <span>Would close {closes}</span>}
        {paid && listing.shown !== 'draft' && (
          <span className="gv-yl-lock">
            <Lock size={13} strokeWidth={2.4} aria-hidden />
            <InfoHint
              label="What is fixed"
              text={listing.fix_available
                ? 'Role, title, link, conference details and dates are fixed after posting. One free fix in the first 24 hours'
                : 'Role, title, link, conference details and dates are fixed'}
              size={14}
            />
          </span>
        )}
      </p>
      {listing.promotion && (
        <p className="gv-yl-promo">
          <span className="gv-yl-chip">
            <Sparkles size={12} strokeWidth={2.4} aria-hidden />
            Promoted until {dayLabel(listing.promotion.ends_on)}
          </span>
          {listing.promotion.with_homepage && <span className="gv-yl-chip gv-yl-chip-soft">Homepage</span>}
        </p>
      )}
      {listing.shown === 'hidden' && listing.hidden_note && (
        <p className="gv-yl-hidden">Hidden by Gavelling: {listing.hidden_note}</p>
      )}

      {listing.shown !== 'draft' && (
        <dl className="gv-yl-stats">
          <div><dt>{listing.views === 1 ? 'view' : 'views'}</dt><dd>{listing.views.toLocaleString('en-US')}</dd></div>
          <div><dt>{listing.clicks === 1 ? 'click to apply' : 'clicks to apply'}</dt><dd>{listing.clicks.toLocaleString('en-US')}</dd></div>
        </dl>
      )}

      {!asking && (
        <div className="gv-yl-actions">
          <button type="button" className="gv-yl-btn" onClick={onEdit}><Pencil size={15} strokeWidth={2.4} aria-hidden />Edit</button>
          {listing.shown === 'live' && (
            <button type="button" className="gv-yl-btn" onClick={onPromote}><Megaphone size={15} strokeWidth={2.4} aria-hidden />Promote</button>
          )}
          {listing.shown === 'live' && (
            <button type="button" className="gv-yl-btn" onClick={() => { setErr(''); setAsking('close'); }}><XCircle size={15} strokeWidth={2.4} aria-hidden />Close</button>
          )}
          {listing.shown === 'draft' && (
            <button type="button" className="gv-yl-btn gv-yl-btn-danger" onClick={() => { setErr(''); setAsking('delete'); }}><Trash2 size={15} strokeWidth={2.4} aria-hidden />Delete</button>
          )}
        </div>
      )}

      {asking && (
        <div className="gv-yl-ask" role="group" aria-label={asking === 'close' ? 'Close this listing' : 'Delete this draft'}>
          <p>{asking === 'close' ? 'Close this listing? It stops showing on the Job Board' : 'Delete this draft? It cannot be brought back'}</p>
          <div className="gv-yl-ask-btns">
            <button type="button" className="gv-yl-btn" onClick={() => { setAsking(null); setErr(''); }} disabled={busy}>Keep it</button>
            <button type="button" className="gv-yl-btn gv-yl-danger" onClick={() => { void confirm(); }} disabled={busy} aria-busy={busy || undefined}>
              {busy ? (asking === 'close' ? 'Closing' : 'Deleting') : asking === 'close' ? 'Close listing' : 'Delete draft'}
            </button>
          </div>
          {err && <p role="alert" className="gv-yl-err">{err}</p>}
        </div>
      )}
    </li>
  );
}

const YL_CSS = `
.gv-yl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.gv-yl{padding:16px 18px;border-radius:16px;background:#FFFFFF;border:1.5px solid transparent;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 6px 18px rgba(27,56,40,0.07);font-family:${FONT};transition:border-color 140ms ease}
.gv-yl-on{border-color:${FOREST}}
.gv-yl-title{display:block;width:100%;padding:0;border:none;background:none;cursor:pointer;text-align:left;font-family:${FONT};font-size:17px;font-weight:700;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-yl-title:hover{text-decoration:underline;text-underline-offset:3px}
.gv-yl-sub{margin:3px 0 0;font-size:13.5px;font-weight:600;color:${FOREST};overflow-wrap:anywhere}
.gv-yl-facts{margin:8px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:13.5px;color:${INK_SOFT}}
.gv-yl-status{display:inline-flex;align-items:center;gap:5px;font-weight:700}
.gv-yl-lock{display:inline-flex;align-items:center;gap:4px;color:${INK_SOFT}}
.gv-yl-promo{margin:10px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.gv-yl-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;color:#4A3410;background:linear-gradient(145deg,#F3E3A1 0%,#EED98A 55%,#D9B44A 100%);box-shadow:0 1px 4px rgba(182,135,31,0.3)}
.gv-yl-chip-soft{background:rgba(238,217,138,0.4);box-shadow:none}
.gv-yl-hidden{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:rgba(158,42,18,0.07);font-size:13.5px;line-height:1.45;color:${DANGER};overflow-wrap:anywhere}
.gv-yl-stats{display:flex;flex-wrap:wrap;gap:8px 26px;margin:12px 0 0}
.gv-yl-stats div{display:flex;flex-direction:row-reverse;justify-content:flex-end;align-items:baseline;gap:6px}
.gv-yl-stats dd{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-yl-stats dt{font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-yl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.gv-yl-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;border:1.5px solid rgba(28,20,16,0.16);background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:14px;font-weight:700;color:${INK}}
.gv-yl-btn:hover:not(:disabled){border-color:rgba(27,56,40,0.45)}
.gv-yl-btn:disabled{opacity:0.6;cursor:default}
.gv-yl-btn-danger{color:${DANGER}}
.gv-yl-danger{background:${DANGER};border-color:${DANGER};color:#FFFFFF}
.gv-yl-danger:hover:not(:disabled){background:#86230F;border-color:#86230F}
.gv-yl-ask{margin-top:14px;padding-top:14px;border-top:1px solid rgba(28,20,16,0.08);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px}
.gv-yl-ask p{margin:0;font-size:14.5px;font-weight:600;color:${INK}}
.gv-yl-ask-btns{display:flex;gap:8px}
.gv-yl-err{flex-basis:100%;margin:0;font-size:13.5px;color:${DANGER}}
.gv-yl :is(button):focus{outline:none}
.gv-yl :is(button):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gv-yl{transition:none}}
`;
