'use client';

// ManualPayPopup — paying a manual conference (prompt 96). Opened once a
// started payment exists (start_manual_payment); proof is always required to
// finish. What it shows depends on the conference's manual kind:
//   link  the payment page was already opened in a new tab by the Pay click
//         itself (through /pay/go, prompt 101: a tab opened by a timer is
//         blocked); this pop-up says so and offers "Open it again"
//   qr    the QR on the right, large enough to scan, tap to enlarge
//   bank  the bank details on the right, each with a copy button, and the amount
// The proof upload sits on the left with the instructions. Finish calls
// attach_proof (or replace_proof in 'replace' mode). X keeps the started
// payment; it is never cancelled by closing.
//
// PaymentWayPopup (prompt 101) is the small pop-up a started payment opens for
// a QR ("Payment QR") or bank details ("Bank Details").
//
// On a phone (pointer: coarse, or narrower than 768px) the QR block also offers
// "Save QR image", a line about scanning from a photo, and "Copy amount": most
// delegates pay from the same phone that shows the code, so they cannot scan it.
// Shown by CSS only (.gv-pm-touch), so nothing differs between server and client.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { notifyOk } from '@/lib/appNotify';
import { DANGER, INK_SOFT } from './payKit';
import { money, type PayOverview } from './payApi';
import { attachProof, qrLink, replaceProof } from './manualApi';
import ProofDrop from './ProofDrop';

export type ManualMode = 'pay' | 'upload' | 'replace';

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
.gv-pm-touch{display:none}
@media (pointer:coarse),(max-width:767px){
  .gv-pm-touch{display:flex;flex-direction:column;gap:10px;margin-top:14px;text-align:left}
  .gv-pm-copy{min-height:44px}
}
`;

function CopyRow({ label, value, notice }: { label: string; value: string; notice?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600);
      if (notice) notifyOk(notice, 'pay');
    } catch { /* the value is on screen to copy by hand */ }
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

export default function ManualPayPopup({ conference, batchId, totalCents, currency, mode, tabOpened, onClose, onDone }: {
  conference: PayOverview['conference'];
  batchId: string;
  totalCents: number;
  currency: string;
  mode: ManualMode;
  /** Pay on a payment link: whether the Pay click managed to open the new tab. */
  tabOpened?: boolean;
  onClose: () => void;
  /** The proof was sent (or replaced): the page re-reads. */
  onDone: () => void;
}) {
  const kind = conference.manual_kind ?? 'link';
  const total = money(totalCents, currency);
  const showWay = mode === 'pay';
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

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

  const way = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {kind === 'link' && (
        <div style={{ padding: 16, borderRadius: 14, background: '#FFFFFF' }}>
          {conference.payment_url ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.5 }} aria-live="polite">
                {tabOpened
                  ? 'We opened the payment page in a new tab. Pay there, then upload your proof here'
                  : 'Your browser stopped the new tab. Use the button to open the payment page'}
              </p>
              <button type="button" className={`gv-pay-btn ${tabOpened ? 'gv-pay-outline' : 'gv-pay-forest'}`}
                onClick={() => { window.open(conference.payment_url!, '_blank', 'noopener,noreferrer'); }}>
                <ExternalLink size={16} strokeWidth={2.2} aria-hidden /> {tabOpened ? 'Open it again' : 'Open the payment page'}
              </button>
            </>
          ) : <p className="gv-pay-quiet">The organizers have not added a payment page link yet</p>}
        </div>
      )}
      {kind === 'qr' && <QrBlock qr={qr} onEnlarge={() => setQrBig(true)} fileBase={conference.acronym || conference.slug} total={total} />}
      {kind === 'bank' && <BankRows bank={conference.bank} total={total} />}
    </div>
  );

  const title = mode === 'replace' ? 'Replace Your Proof' : mode === 'upload' ? 'Upload Your Proof' : `Pay ${total}`;

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{MANUAL_CSS}</style>
      <PurchaseShell tone="light" label={title} onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-pay-manual" testId="pay-manual">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
          <div style={{ paddingRight: 40 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
            {mode !== 'pay' && <p style={{ margin: '6px 0 0', fontSize: 15, color: INK_SOFT }}>{total}</p>}
          </div>

          <div className={`gv-pm-grid${showWay && kind !== 'link' ? ' gv-pm-two' : ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {instructions && (
                <p style={{ margin: 0, padding: 14, borderRadius: 14, background: '#FFFFFF', fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{instructions}</p>
              )}
              {kind === 'link' && showWay && way}
              <ProofDrop conferenceId={conference.id} onUploaded={setPath} disabled={busy} />
            </div>
            {showWay && kind !== 'link' && way}
          </div>

          {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: DANGER }}>{err}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className="gv-pay-btn gv-pay-forest" disabled={!path || busy} onClick={() => { void finish(); }}>
              {busy ? 'Sending' : mode === 'replace' ? 'Replace proof' : 'Finish'}
            </button>
            {!path && <span style={{ fontSize: 13.5, color: INK_SOFT }}>Upload your proof to finish</span>}
          </div>
        </div>
      </PurchaseShell>
      {qrBig && qr && <QrLightbox qr={qr} onClose={() => setQrBig(false)} />}
    </>
  );
}

const QR_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

function qrFileName(base: string, type: string, url: string): string {
  const safe = base.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'conference';
  const raw = /\.([a-z0-9]{3,4})(?:$|\?)/i.exec(url)?.[1]?.toLowerCase();
  const fromUrl = raw === 'jpeg' ? 'jpg' : raw;
  const ext = QR_EXT[type] ?? (fromUrl && Object.values(QR_EXT).includes(fromUrl) ? fromUrl : 'png');
  return `${safe}-payment-qr.${ext}`;
}

/** Phones only (CSS): save the QR image, scan it from a photo, copy the amount. */
function QrTouchHelp({ qr, fileBase, total }: { qr: string | null; fileBase: string; total: string }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Fetch the image ahead of the press, so a share sheet can open while the
  // tap still counts as one (Safari refuses a share after a slow await).
  useEffect(() => {
    if (!qr || typeof window === 'undefined') return;
    if (!window.matchMedia?.('(pointer: coarse), (max-width: 767px)').matches) return;
    let alive = true;
    fetch(qr).then(r => (r.ok ? r.blob() : null)).then(b => { if (alive && b) setBlob(b); }).catch(() => { /* fetched again on press */ });
    return () => { alive = false; };
  }, [qr]);

  const save = async () => {
    if (!qr || busy) return;
    setMsg('');
    let b = blob;
    if (!b) {
      setBusy(true);
      try {
        const r = await fetch(qr);
        if (!r.ok) throw new Error('fetch');
        b = await r.blob();
      } catch {
        b = null;
      }
      setBusy(false);
    }
    if (!b) {
      // Open the image itself so it can be saved by pressing and holding it.
      const w = window.open(qr, '_blank', 'noopener,noreferrer');
      setMsg(w ? 'We opened the QR code in a new tab. Press and hold it to save it' : 'We could not save the QR code. Press and hold it above to save it');
      return;
    }
    const name = qrFileName(fileBase, b.type, qr);
    const file = new File([b], name, { type: b.type || 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file] });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        // Sharing refused: download it instead.
      }
    }
    try {
      const href = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = href; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      notifyOk('QR image saved', 'pay');
    } catch {
      setMsg('We could not save the QR code. Press and hold it above to save it');
    }
  };

  return (
    <div className="gv-pm-touch">
      <button type="button" className="gv-pay-btn gv-pay-outline" disabled={!qr || busy} onClick={() => { void save(); }} style={{ width: '100%' }}>
        <Download size={16} strokeWidth={2.2} aria-hidden /> {busy ? 'Saving' : 'Save QR image'}
      </button>
      {msg && <p role="status" style={{ margin: 0, fontSize: 13.5, color: INK_SOFT }}>{msg}</p>}
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: INK_SOFT }}>Or open your banking app and choose scan from a photo</p>
      <CopyRow label="Amount to pay" value={total} notice="Amount copied" />
    </div>
  );
}

function QrBlock({ qr, onEnlarge, fileBase, total }: { qr: string | null; onEnlarge: () => void; fileBase: string; total: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, background: '#FFFFFF', textAlign: 'center' }}>
      {qr ? (
        <button type="button" onClick={onEnlarge} aria-label="Enlarge the QR code" style={{ border: 'none', background: 'none', padding: 0, cursor: 'zoom-in' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="The conference's payment QR code" style={{ width: 'min(320px, 100%)', aspectRatio: '1', objectFit: 'contain' }} />
        </button>
      ) : <p className="gv-pay-quiet">The QR code is loading</p>}
      <p style={{ margin: '8px 0 0', fontSize: 13, color: INK_SOFT }}>Scan it with your banking app. Tap to enlarge</p>
      <QrTouchHelp qr={qr} fileBase={fileBase} total={total} />
    </div>
  );
}

function QrLightbox({ qr, onClose }: { qr: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="QR code" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="The conference's payment QR code, enlarged" style={{ width: 'min(92vw, 92vh)', height: 'auto', background: '#FFFFFF', borderRadius: 16, padding: 16 }} />
    </div>
  );
}

function BankRows({ bank, total }: { bank: PayOverview['conference']['bank']; total: string }) {
  const b = bank ?? {};
  return (
    <div style={{ padding: '6px 16px', borderRadius: 14, background: '#FFFFFF' }}>
      {b.account_name && <CopyRow label="Name on the account" value={b.account_name} />}
      {b.account_number && <CopyRow label="IBAN or account number" value={b.account_number} />}
      {b.swift && <CopyRow label="SWIFT or BIC" value={b.swift} />}
      {b.bank_name && <CopyRow label="Bank name" value={b.bank_name} />}
      {b.reference && <CopyRow label="Payment reference" value={b.reference} />}
      <CopyRow label="Amount to send" value={total} />
    </div>
  );
}

/** A started payment's QR ("Payment QR") or bank details ("Bank Details"): small, as tall as its content. */
export function PaymentWayPopup({ conference, kind, totalCents, currency, onClose }: {
  conference: PayOverview['conference'];
  kind: 'qr' | 'bank';
  totalCents: number;
  currency: string;
  onClose: () => void;
}) {
  const total = money(totalCents, currency);
  const instructions = conference.instructions?.trim();
  const [qr, setQr] = useState<string | null>(null);
  const [qrBig, setQrBig] = useState(false);
  useEffect(() => {
    if (kind !== 'qr' || !conference.qr_path) return;
    let alive = true;
    void qrLink(conference.qr_path).then(u => { if (alive) setQr(u); });
    return () => { alive = false; };
  }, [kind, conference.qr_path]);
  const title = kind === 'qr' ? 'Payment QR' : 'Bank Details';

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{MANUAL_CSS}</style>
      <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-pay-small" testId="pay-way">
        <div style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          <div style={{ paddingRight: 40 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total}</p>
          </div>
          {instructions && (
            <p style={{ margin: 0, padding: 14, borderRadius: 14, background: '#FFFFFF', fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{instructions}</p>
          )}
          {kind === 'qr'
            ? (conference.qr_path ? <QrBlock qr={qr} onEnlarge={() => setQrBig(true)} fileBase={conference.acronym || conference.slug} total={total} /> : <p className="gv-pay-quiet">The organizers have not added a QR code yet</p>)
            : <BankRows bank={conference.bank} total={total} />}
          <div><button type="button" className="gv-pay-btn gv-pay-outline" onClick={onClose}>Close</button></div>
        </div>
      </PurchaseShell>
      {qrBig && qr && <QrLightbox qr={qr} onClose={() => setQrBig(false)} />}
    </>
  );
}
