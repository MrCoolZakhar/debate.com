'use client';

// PublishControls — the conference's status and Publish / Unpublish, in the
// manage header (prompt 106; they used to sit on the dashboard). A pill says
// "Public" or "Draft" (icon and word), and the button beside it:
//   Publish    the same gates as the dashboard's checklist row (at least one
//              committee, read here with a head count when pressed; the
//              payment gate), then PublishModal
//   Unpublish  "Unpublish Your Conference?" first, then is_public false and
//              status 'private' as a verified write (exactly one row)
// Publishing is open to every organizer, as it is on the dashboard (the
// conferences update policy is is_conference_organizer). After either, the
// conference is re-read so the pill and the dashboard change together.

import { useRef, useState } from 'react';
import { Globe2, PencilLine } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { paymentGateBlocks, paymentGateMessage } from '@/lib/payments';
import type { Conference } from './layout';
import PublishModal from './PublishModal';

const CSS = `
.gv-pc-pill{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:700;white-space:nowrap}
.gv-pc-pill.gv-pc-public{background:#2F7A4D;color:#FFFFFF}
.gv-pc-pill.gv-pc-draft{background:rgba(237,231,216,0.14);color:#EDE7D8;box-shadow:inset 0 0 0 1px rgba(237,231,216,0.28)}
.gv-pc-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border-radius:10px;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background-color 140ms ease,opacity 140ms ease}
.gv-pc-btn:focus{outline:none}
.gv-pc-btn:focus-visible{outline:2px solid #EED98A;outline-offset:2px}
.gv-pc-btn:disabled{opacity:0.6;cursor:default}
.gv-pc-publish{background:#EED98A;color:#1B3828}
.gv-pc-publish:hover:not(:disabled){background:#F5E6A8}
.gv-pc-unpublish{background:transparent;color:#EDE7D8;box-shadow:inset 0 0 0 1.5px rgba(237,231,216,0.45)}
.gv-pc-unpublish:hover:not(:disabled){background:rgba(237,231,216,0.1)}
/* In the phone drawer (ivory ground) */
.gv-pc-light .gv-pc-pill.gv-pc-draft{background:rgba(27,56,40,0.08);color:#1B3828;box-shadow:none}
.gv-pc-light .gv-pc-publish{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#EED98A}
.gv-pc-light .gv-pc-unpublish{color:#1C1410;box-shadow:inset 0 0 0 1.5px #1C1410}
.gv-pc-light .gv-pc-btn:focus-visible{outline-color:#1B3828}
/* The unpublish question: as small as its content */
.gv-buy-panel.gv-pc-pop{max-width:440px;min-height:0}
.gv-buy-panel.gv-pc-pop .gv-buy-body{flex-direction:column}
@media (max-width:743px){.gv-buy-panel.gv-pc-pop{height:auto;max-height:92dvh;margin-top:auto;border-radius:22px 22px 0 0}}
`;

export default function PublishControls({ conference, onChanged, light }: {
  conference: Conference;
  /** Re-reads the conference quietly (the layout's refreshConferenceQuiet). */
  onChanged: () => Promise<void>;
  /** Drawn on the ivory phone drawer instead of the forest header. */
  light?: boolean;
}) {
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const live = conference.is_public;

  const startPublish = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setChecking(true);
    try {
      const c = await getFreshAuthedClient();
      if (!c) { notifyErr('Your session has expired. Please sign in again.', 'publish'); return; }
      const { count, error } = await c.from('conference_committees').select('id', { count: 'exact', head: true }).eq('conference_id', conference.id);
      if (error) { notifyErr(friendlyError(error, 'Could not check your committees. Try again in a moment.'), 'publish'); return; }
      if (!count) { notifyErr('Add at least one committee before publishing.', 'publish'); return; }
      if (paymentGateBlocks(conference)) { notifyErr(paymentGateMessage(conference), 'publish'); return; }
      setPublishing(true);
    } finally {
      busyRef.current = false; setChecking(false);
    }
  };

  const unpublish = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr('');
    try {
      const c = await getFreshAuthedClient();
      if (!c) { setErr('Your session has expired. Please sign in again.'); return; }
      const { data, error } = await c.from('conferences').update({ is_public: false, status: 'private' }).eq('id', conference.id).select('id');
      if (error || !data || data.length !== 1) {
        setErr(error ? friendlyError(error, "Couldn't unpublish your conference. Try again in a moment.") : "Couldn't unpublish your conference. Refresh and try again.");
        return;
      }
      await onChanged();
      setUnpublishing(false);
      notifyOk('Your conference is now a draft', 'publish');
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  return (
    <span className={`inline-flex items-center gap-2${light ? ' gv-pc-light' : ''}`}>
      <style>{CSS}</style>
      <span className={`gv-pc-pill ${live ? 'gv-pc-public' : 'gv-pc-draft'}`}>
        {live ? <Globe2 size={14} strokeWidth={2.4} aria-hidden /> : <PencilLine size={14} strokeWidth={2.4} aria-hidden />}
        {live ? 'Public' : 'Draft'}
      </span>
      {live ? (
        <button type="button" className="gv-pc-btn gv-pc-unpublish" onClick={() => { setErr(''); setUnpublishing(true); }}>Unpublish</button>
      ) : (
        <button type="button" className="gv-pc-btn gv-pc-publish" disabled={checking} onClick={() => { void startPublish(); }}>
          {checking ? 'Checking' : 'Publish'}
        </button>
      )}

      {publishing && (
        <PublishModal
          conference={conference}
          onClose={() => setPublishing(false)}
          onPublished={() => { void onChanged().then(() => setPublishing(false)); }}
        />
      )}
      {unpublishing && (
        <>
          <style>{PURCHASE_CSS}</style>
          <PurchaseShell tone="light" label="Unpublish your conference" onClose={() => { if (!busyRef.current) setUnpublishing(false); }} panelClass="gv-pc-pop" testId="unpublish">
            <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
              <h2 style={{ margin: 0, paddingRight: 40, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#1C1410' }}>Unpublish Your Conference?</h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#1C1410' }}>
                It disappears from gavelling.com and nobody new can apply. Applications you already have stay as they are.
              </p>
              {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#8B2020' }}>{err}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" disabled={busy} onClick={() => setUnpublishing(false)}
                  style={{ minHeight: 46, padding: '0 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)', color: '#EED98A', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
                  Keep it public
                </button>
                <button type="button" disabled={busy} onClick={() => { void unpublish(); }}
                  style={{ minHeight: 46, padding: '0 20px', borderRadius: 12, border: 'none', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1.5px #1C1410', color: '#1C1410', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Unpublishing' : 'Unpublish'}
                </button>
              </div>
            </div>
          </PurchaseShell>
        </>
      )}
    </span>
  );
}
