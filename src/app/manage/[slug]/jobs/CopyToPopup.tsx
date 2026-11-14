'use client';

// ── Copy a listing to other listings (prompt 44) ───────────────────────────
//
// Like copying applications settings: one listing's description, what you
// offer, screening questions, auto-reject, deadline and who posts it go to the
// listings picked here (job_listing_copy_to). Titles and committees stay. Each
// target goes through the normal save, so a paid live listing may refuse some
// changes: those are listed in place (never a second pop-up) with their reason.

import { useMemo, useRef, useState } from 'react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { POSTING_CSS } from './PostingPopup';
import { copyListingTo, type OrgListing } from './jobsApi';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

const CSS = `
.gv-cp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;max-height:min(46vh,420px);overflow-y:auto}
.gv-cp-row{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:14px;border:1.5px solid rgba(28,20,16,0.12);background:#FFFFFF;cursor:pointer;font-family:${FONT}}
.gv-cp-row-on{border-color:${FOREST};background:#EEF3EC}
.gv-cp-row input{flex-shrink:0;width:18px;height:18px;margin-top:2px;accent-color:${FOREST}}
.gv-cp-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.gv-cp-name{font-size:15px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-cp-sub{font-size:13px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cp-note{font-size:12.5px;font-weight:600;color:#8A6614}
`;

export default function CopyToPopup({ from, others, onClose }: {
  from: OrgListing;
  /** The conference's other listings that are not closed. */
  others: OrgListing[];
  /** Closes; the panel reads again. */
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [failed, setFailed] = useState<{ listing_id: string; title: string; message: string }[] | null>(null);
  const busyRef = useRef(false);
  const title = from.title || 'this listing';
  const allOn = picked.size === others.length && others.length > 0;
  const list = useMemo(() => others, [others]);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const copy = async () => {
    if (busyRef.current || picked.size === 0) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const r = await copyListingTo(from.id, [...picked]);
      if (!r.ok) { setErr(r.message); return; }
      notifyOk(r.message || 'Copied', 'jobs');
      const bad = Array.isArray(r.failed) ? r.failed : [];
      if (bad.length > 0) { setFailed(bad); return; }
      onClose();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const n = picked.size;
  return (
    <PurchaseShell tone="light" label={`Copy ${title} to other listings`} onClose={onClose} panelClass="gv-st-pop gv-jp" testId="job-copy-to">
      <style>{PURCHASE_CSS}{POSTING_CSS}{CSS}</style>
      <div className="gv-jp-col">
        <header className="gv-jp-head">
          <h2 className="gv-jp-title" style={{ overflowWrap: 'anywhere' }}>
            {failed ? 'Some Listings Were Not Changed' : `Copy ${title} to Other Listings`}
          </h2>
        </header>

        {failed ? (
          <>
            <ul className="gv-cp-list" aria-label="Listings not changed">
              {failed.map((f) => (
                <li key={f.listing_id} className="gv-cp-row" style={{ cursor: 'default' }}>
                  <span className="gv-cp-text">
                    <span className="gv-cp-name">{f.title || 'Untitled listing'}</span>
                    <span className="gv-cp-sub">{f.message}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="gv-jp-actions">
              <button type="button" className="gv-jp-main" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="gv-jp-line">Copies the description, what you offer, screening questions, auto-reject, deadline and who posts it. Titles and committees stay as they are.</p>
            <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: FONT }}>
              <p className="gv-jp-line" style={{ margin: 0 }}><strong>{n}</strong> picked</p>
              <button type="button" className="gv-jp-a" disabled={busy}
                onClick={() => setPicked(allOn ? new Set() : new Set(others.map((o) => o.id)))}>
                {allOn ? 'Clear' : 'Select all'}
              </button>
            </div>
            <ul className="gv-cp-list" aria-label="Listings to copy to">
              {list.map((o) => {
                const on = picked.has(o.id);
                const paid = o.shown === 'live' && (o.charged_credits > 0 || !!o.promotion);
                return (
                  <li key={o.id}>
                    <label className={`gv-cp-row${on ? ' gv-cp-row-on' : ''}`}>
                      <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(o.id)} />
                      <span className="gv-cp-text">
                        <span className="gv-cp-name">{o.title || 'Untitled listing'}</span>
                        <span className="gv-cp-sub">{[o.committee, o.shown === 'draft' ? 'Draft' : o.shown === 'hidden' ? 'Hidden' : 'Live'].filter(Boolean).join(' · ')}</span>
                        {paid && <span className="gv-cp-note">Paid listing: some changes may be refused</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {err && <p role="alert" className="gv-jp-err gv-jp-err-block">{err}</p>}
            <div className="gv-jp-actions">
              <button type="button" className="gv-jp-main" onClick={() => { void copy(); }} disabled={busy || n === 0} aria-busy={busy || undefined}>
                {busy ? 'Copying' : `Copy to ${n} ${n === 1 ? 'listing' : 'listings'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </PurchaseShell>
  );
}
