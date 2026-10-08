'use client';

// ManualPayPopup — paying a manual conference (prompt 96). Opened once a
// started payment exists (start_manual_payment); proof is always required to
// finish. What it shows depends on the conference's manual kind:
//   link  "We're taking you to the payment page ...", a 5-second countdown
//         (and Go now), the page opens in a NEW tab; this tab keeps the upload
//   qr    the QR on the right, large enough to scan, tap to enlarge
//   bank  the bank details on the right, each with a copy button, and the amount
// The proof upload sits on the left with the instructions. Finish calls
// attach_proof (or replace_proof in 'replace' mode). X keeps the started
// payment; it is never cancelled by closing.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { DANGER, INK_SOFT } from './payKit';
import { money, type PayOverview } from './payApi';
import { attachProof, qrLink, replaceProof } from './manualApi';
import ProofDrop from './ProofDrop';

export type ManualMode = 'pay' | 'upload' | 'details' | 'replace';

export const MANUAL_CSS = `
.gv-buy-panel.gv-pay-manual{max-width:920px}
.gv-pm-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}
@media (min-width:760px){.gv-pm-grid.gv-pm-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.gv-pm-copyrow{display:flex;align-items:center;gap:10px;padding:10px 0}
.gv-pm-copyrow + .gv-pm-copyrow{border-top:1px solid rgba(27,56,40,0.12)}
.gv-pm-copy{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:10px;border:none;background:#FAF8F3;color:#1B3828;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0}
.gv-pm-copy:hover{background:#F0EBDD}
.gv-pm-copy:focus{outline:none}
.gv-pm-copy:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
`;

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the value is on screen to copy by hand */ }
  };
  return (
    <div className="gv-pm-copyrow">
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>{label}</span>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </span>
      <button type="button" className="gv-pm-copy" onClick={() => { void copy(); }} aria-label={`Copy ${label}`}>
        {copied ? <><Check size={15} strokeWidth={2.6} aria-hidden /> Copied</> : <><Copy size={15} strokeWidth={2.2} aria-hidden /> Copy</>}
      </button>
    </div>
  );
}

export default function ManualPayPopup({ conference, batchId, totalCents, currency, mode, onClose, onDone }: {
  conference: PayOverview['conference'];
  batchId: string;
  totalCents: number;
  currency: string;
  mode: ManualMode;
  onClose: () => void;
  /** The proof was sent (or replaced): the page re-reads. */
  onDone: () => void;
}) {
  const kind = conference.manual_kind ?? 'link';
  const total = money(totalCents, currency);
  const showUpload = mode !== 'details';
  const showWay = mode === 'pay' || mode === 'details';
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  // link: count down, then open the payment page in a new tab.
  const [count, setCount] = useState(mode === 'pay' && kind === 'link' && conference.payment_url ? 5 : 0);
  const [opened, setOpened] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const openPage = () => {
    if (!conference.payment_url) return;
    const w = window.open(conference.payment_url, '_blank', 'noopener,noreferrer');
    setOpened(true);
    setCount(0);
    // A tab opened by a timer can be stopped by the browser: then the link is right here.
    if (!w) setBlocked(true);
  };
  useEffect(() => {
    if (count <= 0 || opened) return;
    const t = setTimeout(() => {
      if (count === 1) openPage(); else setCount(c => c - 1);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, opened]);

  const [qr, setQr] = useState<string | null>(null);
  const [qrBig, setQrBig] = useState(false);
  useEffect(() => {
    if (kind !== 'qr' || !conference.qr_path || !showWay) return;
    let alive = true;
    void qrLink(conference.qr_path).then(u => { if (alive) setQr(u); });
    return () => { alive = false; };
  }, [kind, conference.qr_path, showWay]);

  const finish = async () => {
    if (busyRef.current || !path) return;
    busyRef.current = true; setBusy(true); setErr('');
    const r = mode === 'replace' ? await replaceProof(batchId, path) : await attachProof(batchId, path);
    busyRef.current = false; setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    notifyOk(mode === 'replace' ? 'Proof replaced. The organizers will review it' : 'Proof sent. The organizers will review it', 'pay');
    onDone();
  };

  const instructions = conference.instructions?.trim();
  const b = conference.bank ?? {};

  const way = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {kind === 'link' && (
        <div style={{ padding: 16, borderRadius: 14, background: '#FFFFFF' }}>
          {mode === 'pay' && count > 0 && (
            <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }} aria-live="polite">Opening in {count}</p>
          )}
          {blocked && <p style={{ margin: '0 0 10px', fontSize: 14, color: INK_SOFT }}>Your browser kept the page from opening. Use the button</p>}
          {conference.payment_url ? (
            <button type="button" className="gv-pay-btn gv-pay-outline" onClick={openPage}>
              <ExternalLink size={16} strokeWidth={2.2} aria-hidden /> {mode === 'pay' && count > 0 ? 'Go now' : 'Open the payment page'}
            </button>
          ) : <p className="gv-pay-quiet">The organizers have not added a payment page link yet</p>}
        </div>
      )}
      {kind === 'qr' && (
        <div style={{ padding: 16, borderRadius: 14, background: '#FFFFFF', textAlign: 'center' }}>
          {qr ? (
            <button type="button" onClick={() => setQrBig(true)} aria-label="Enlarge the QR code" style={{ border: 'none', background: 'none', padding: 0, cursor: 'zoom-in' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="The conference's payment QR code" style={{ width: 'min(320px, 100%)', aspectRatio: '1', objectFit: 'contain' }} />
            </button>
          ) : <p className="gv-pay-quiet">The QR code is loading</p>}
          <p style={{ margin: '8px 0 0', fontSize: 13, color: INK_SOFT }}>Scan it with your banking app. Tap to enlarge</p>
        </div>
      )}
      {kind === 'bank' && (
        <div style={{ padding: '6px 16px', borderRadius: 14, background: '#FFFFFF' }}>
          {b.account_name && <CopyRow label="Name on the account" value={b.account_name} />}
          {b.account_number && <CopyRow label="IBAN or account number" value={b.account_number} />}
          {b.swift && <CopyRow label="SWIFT or BIC" value={b.swift} />}
          {b.bank_name && <CopyRow label="Bank name" value={b.bank_name} />}
          {b.reference && <CopyRow label="Payment reference" value={b.reference} />}
          <CopyRow label="Amount to send" value={total} />
        </div>
      )}
    </div>
  );

  const title = mode === 'replace' ? 'Replace Your Proof' : mode === 'upload' ? 'Upload Your Proof' : mode === 'details' ? 'How to Pay' : `Pay ${total}`;

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{MANUAL_CSS}</style>
      <PurchaseShell tone="light" label={title} onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-pay-manual" testId="pay-manual">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
          <div style={{ paddingRight: 40 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
            {mode === 'pay' && kind === 'link' && (
              <p style={{ margin: '6px 0 0', fontSize: 15.5, lineHeight: 1.5 }}>We&apos;re taking you to the payment page. Upload your proof here to finish paying</p>
            )}
            {mode !== 'pay' && <p style={{ margin: '6px 0 0', fontSize: 15, color: INK_SOFT }}>{total}</p>}
          </div>

          <div className={`gv-pm-grid${showWay && showUpload && kind !== 'link' ? ' gv-pm-two' : ''}`}>
            {(showUpload || instructions) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {instructions && (
                  <p style={{ margin: 0, padding: 14, borderRadius: 14, background: '#FFFFFF', fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{instructions}</p>
                )}
                {kind === 'link' && showWay && way}
                {showUpload && <ProofDrop conferenceId={conference.id} onUploaded={setPath} disabled={busy} />}
              </div>
            )}
            {showWay && kind !== 'link' && way}
          </div>

          {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: DANGER }}>{err}</p>}
          {showUpload ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" className="gv-pay-btn gv-pay-forest" disabled={!path || busy} onClick={() => { void finish(); }}>
                {busy ? 'Sending' : mode === 'replace' ? 'Replace proof' : 'Finish'}
              </button>
              {!path && <span style={{ fontSize: 13.5, color: INK_SOFT }}>Upload your proof to finish</span>}
            </div>
          ) : (
            <div><button type="button" className="gv-pay-btn gv-pay-outline" onClick={onClose}>Close</button></div>
          )}
        </div>
      </PurchaseShell>
      {qrBig && qr && (
        <div role="dialog" aria-modal="true" aria-label="QR code" onClick={() => setQrBig(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="The conference's payment QR code, enlarged" style={{ width: 'min(92vw, 92vh)', height: 'auto', background: '#FFFFFF', borderRadius: 16, padding: 16 }} />
        </div>
      )}
    </>
  );
}
