'use client';

// PaymentWays — "Your Payment Methods" inside the Payment Method pop-up
// (prompt 31, C.D. MUN: UPI for Indian delegates, a SWIFT transfer for
// international ones). The conference's own set-up stays the MAIN method;
// here the organiser names it and adds up to 4 extra MANUAL methods, each with
// a name payers see when they pick how to pay. Every view replaces the
// pop-up's content (never a pop-up on a pop-up): the list, the kind picker,
// then that kind's form. Remove asks in place and only hides the method.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2, Check, HandCoins, ImageUp, Link2, Phone, Plus, QrCode, X } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { SUPABASE_URL } from '@/lib/supabase';
import { notifyOk } from '@/lib/appNotify';
import { READ_ONLY_LINE } from '../dashboardKit';
import { uploadPaymentQr, type BankDetails, type MethodKey } from './paymentApi';
import {
  WAY_KIND_LABEL, readPaymentWays, removePaymentWay, savePaymentWay, setMainMethodName,
  type PaymentWay, type WayKind, type WaysList,
} from './paymentWaysApi';

const NAME_MAX = 40;
const NOTE_MAX = 500;
const QR_MAX_BYTES = 5 * 1024 * 1024;
const MAX_WAYS_LINE = 'You can have up to 5 payment methods.';

const WAYS_CSS = `
.gv-pw-list{display:flex;flex-direction:column;border-radius:16px;background:#FFFFFF;padding:2px 16px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -26px rgba(27,56,40,0.5),inset 0 0 0 1.5px rgba(27,56,40,0.1)}
.gv-pw-row{display:flex;align-items:center;gap:12px;padding:14px 0;flex-wrap:wrap}
.gv-pw-row + .gv-pw-row{border-top:1px solid rgba(27,56,40,0.12)}
.gv-pw-name{flex:1 1 200px;min-width:0}
.gv-pw-name b{display:block;font-size:16px;font-weight:800;color:#1C1410;overflow-wrap:anywhere}
.gv-pw-name small{display:block;margin-top:2px;font-size:13px;color:#5A5046}
.gv-pw-acts{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.gv-pw-main{display:inline-block;margin-left:8px;font-size:12px;font-weight:700;color:#2A5A3C}
`;

const KIND_CARDS: { key: WayKind; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'link', title: 'Payment link', icon: <Link2 size={24} strokeWidth={2.2} />,
    desc: 'Send payers to your own payment page. You confirm payments by reviewing the proofs payers upload.' },
  { key: 'qr', title: 'Payment QR code', icon: <QrCode size={24} strokeWidth={2.2} />,
    desc: 'Show a QR code payers scan with their banking app (for example UPI). You confirm payments by reviewing the proofs payers upload.' },
  { key: 'phone', title: 'Phone number', icon: <Phone size={24} strokeWidth={2.2} />,
    desc: 'Show a phone number payers send money to (for example a mobile money or bank app number). You confirm payments by reviewing the proofs payers upload.' },
  { key: 'bank', title: 'Bank transfer', icon: <Building2 size={24} strokeWidth={2.2} />,
    desc: 'Show your bank details with copy buttons. You confirm payments by reviewing the proofs payers upload.' },
  { key: 'in_person', title: 'In-person payment', icon: <HandCoins size={24} strokeWidth={2.2} />,
    desc: 'Payers pay you in person, for example in cash at registration. They see your instructions and can finish without a proof. You confirm each payment yourself.' },
];

const KIND_TITLE: Record<WayKind, string> = {
  link: 'Payment Link', qr: 'Payment QR Code', phone: 'Phone Number', bank: 'Bank Transfer', in_person: 'In-Person Payment',
};

type Errs = Partial<Record<'name' | 'url' | 'qr' | 'phone' | 'note' | 'account_name' | 'account_number' | 'swift' | 'bank_name' | 'reference' | 'manual_kind', string>>;

const qrUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/conference-assets/${path.split('/').map(encodeURIComponent).join('/')}`;

type View = { v: 'list' } | { v: 'kind' } | { v: 'form'; kind: WayKind; way: PaymentWay | null };

export default function PaymentWays({ conference, mainKind, readOnly, onBack, onEditMain, onDone }: {
  conference: Conference;
  /** The main method's kind today (card or a manual kind). */
  mainKind: MethodKey | null;
  readOnly: boolean;
  /** Back from the list (to "Are you using multiple payment methods?"); none when opened straight on the list. */
  onBack?: () => void;
  /** Runs today's set-up for the main method. */
  onEditMain: () => void;
  onDone: () => void;
}) {
  const [list, setList] = useState<WaysList | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [view, setView] = useState<View>({ v: 'list' });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await readPaymentWays(conference.id);
    if ('error' in r) { setLoadErr(r.error); return null; }
    setLoadErr('');
    setList(r);
    return r;
  }, [conference.id]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current || readOnly) return;
    busyRef.current = true; setBusy(true); setErr('');
    try { await fn(); } finally { busyRef.current = false; setBusy(false); }
  };

  // ── The main method's name ──────────────────────────────────────────────
  const [mainName, setMainName] = useState('');
  const [editingMain, setEditingMain] = useState(false);
  const [mainErr, setMainErr] = useState('');
  const needsMainName = !!list && !list.mainName;
  const saveMainName = () => run(async () => {
    const n = mainName.trim();
    if (!n) { setMainErr('Give your main payment method a name, for example International delegates.'); return; }
    if (n.length > NAME_MAX) { setMainErr('Keep the name under 40 characters.'); return; }
    const r = await setMainMethodName(conference.id, n);
    if (!r.ok) { setMainErr(r.error); return; }
    setMainErr('');
    setEditingMain(false);
    await load();
  });
  const mainNameField = (
    <div>
      <label className="gv-fd-label" htmlFor="gv-pw-main-name">Name for your main payment method</label>
      <input id="gv-pw-main-name" className="gv-pf-input" value={mainName} maxLength={NAME_MAX} disabled={readOnly || busy}
        placeholder="For example, International delegates" aria-invalid={!!mainErr}
        onChange={e => { setMainName(e.target.value); setMainErr(''); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void saveMainName(); } }} />
      {mainErr && <p className="gv-st-err" role="alert">{mainErr}</p>}
      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 10 }}>
        <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly || busy} onClick={() => { void saveMainName(); }}>
          {busy ? 'Saving' : 'Save name'}
        </button>
        {editingMain && (
          <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setEditingMain(false); setMainErr(''); }}>Cancel</button>
        )}
      </div>
    </div>
  );

  // ── Remove, asked in place ───────────────────────────────────────────────
  const [asking, setAsking] = useState<string | null>(null);
  const remove = (w: PaymentWay) => run(async () => {
    const r = await removePaymentWay(w.id);
    if (!r.ok) { setErr(r.error); return; }
    setAsking(null);
    notifyOk('Payment method removed', 'financials');
    await load();
  });

  // ── The form (add or edit one extra method) ──────────────────────────────
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [qrPath, setQrPath] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState<BankDetails>({ account_name: '', account_number: '', swift: '', bank_name: '', reference: '' });
  const [errs, setErrs] = useState<Errs>({});
  const qrInput = useRef<HTMLInputElement | null>(null);

  const openForm = (kind: WayKind, way: PaymentWay | null) => {
    setName(way?.name ?? '');
    setUrl(way?.payment_url ?? '');
    setNote(way?.instructions ?? '');
    setQrPath(way?.qr_path ?? null);
    setQrFile(null);
    setQrPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPhone(way?.phone ?? '');
    const b = way?.bank ?? {};
    setBank({ account_name: b.account_name ?? '', account_number: b.account_number ?? '', swift: b.swift ?? '', bank_name: b.bank_name ?? '', reference: b.reference ?? '' });
    setErrs({}); setErr('');
    setView({ v: 'form', kind, way });
  };

  const pickQr = (f: File | null) => {
    setErrs(e => ({ ...e, qr: undefined }));
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/.test(f.type)) { setErrs(e => ({ ...e, qr: 'Upload a PNG or JPG image.' })); return; }
    if (f.size > QR_MAX_BYTES) { setErrs(e => ({ ...e, qr: 'That image is over 5 MB. Upload a smaller one.' })); return; }
    setQrFile(f);
    setQrPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
  };

  /** The same checks as the main set-up, so the server rarely has to refuse. */
  const localErrors = (kind: WayKind): Errs => {
    const e: Errs = {};
    const n = name.trim();
    if (!n) e.name = 'Give this payment method a name, for example Indian delegates.';
    else if (n.length > NAME_MAX) e.name = 'Keep the name under 40 characters.';
    if (kind === 'link') {
      const u = url.trim();
      if (!u) e.url = 'Add the link to your payment page.';
      else if (!/^https:\/\/\S+\.\S+$/i.test(u)) e.url = 'The link must start with https:// and be a full web address.';
    }
    if (kind === 'qr' && !qrPath && !qrFile) e.qr = 'Upload your payment QR code image.';
    if (kind === 'phone') {
      const ph = phone.trim();
      const digits = ph.replace(/\D/g, '').length;
      if (!ph) e.phone = 'Add the phone number people pay to.';
      else if (ph.length > 40 || !/^\+?[0-9 ()./-]+$/.test(ph) || digits < 6 || digits > 20) e.phone = 'Enter a phone number with digits only, for example +44 7700 900123.';
    }
    if (kind === 'bank') {
      if (!bank.account_name.trim()) e.account_name = 'Add the name on the account.';
      if (!bank.account_number.trim()) e.account_number = 'Add the IBAN or account number.';
      const sw = bank.swift.trim().toUpperCase();
      if (sw && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(sw)) e.swift = 'A SWIFT or BIC code has 8 or 11 letters and numbers.';
    }
    if (kind === 'in_person' && !note.trim()) e.note = 'Add the instructions for paying in person, for example where and when to pay.';
    if (note.trim().length > NOTE_MAX) e.note = 'Keep the instructions under 500 characters.';
    return e;
  };

  const saveWay = (kind: WayKind, way: PaymentWay | null) => run(async () => {
    const local = localErrors(kind);
    if (Object.keys(local).length > 0) { setErrs(local); return; }
    setErrs({});
    let path = qrPath;
    if (kind === 'qr' && qrFile) {
      const up = await uploadPaymentQr(conference.id, qrFile);
      if ('error' in up) { setErrs({ qr: up.error }); return; }
      path = up.path;
      setQrPath(up.path);
      setQrFile(null);
    }
    const r = await savePaymentWay({ conferenceId: conference.id, wayId: way?.id ?? null, name, kind, url, note, qrPath: path, bank, phone });
    if (!r.ok) {
      if (r.code === 'main_name') { await load(); setView({ v: 'list' }); setMainErr(r.error); return; }
      if (r.field && r.field in ({ name: 1, url: 1, qr: 1, phone: 1, note: 1, account_name: 1, account_number: 1, swift: 1, bank_name: 1, reference: 1, manual_kind: 1 } as Record<string, number>)) {
        setErrs({ [r.field]: r.error } as Errs);
      } else setErr(r.error);
      return;
    }
    await load();
    setView({ v: 'list' });
  });

  const fieldErr = (k: keyof Errs) => errs[k] ? <p className="gv-st-err" role="alert">{errs[k]}</p> : null;

  // ── Render ───────────────────────────────────────────────────────────────
  let title = 'Your Payment Methods';
  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (view.v === 'list') {
    if (!list) {
      body = loadErr
        ? <p className="gv-st-err" role="alert">{loadErr} <button type="button" className="gv-st-link" onClick={() => { void load(); }}>Try again</button></p>
        : <div className="gv-fd-ph" style={{ height: 120, borderRadius: 16 }} aria-busy="true" />;
    } else if (needsMainName) {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="gv-fd-note" style={{ fontSize: 15 }}>Payers see each method&apos;s name when they pay. Start with the one you have now</p>
          {mainNameField}
        </div>
      );
    } else {
      const askingWay = asking ? list.ways.find(w => w.id === asking) ?? null : null;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gv-pw-list">
            <div className="gv-pw-row">
              <span className="gv-pw-name">
                <b>{list.mainName}<span className="gv-pw-main">Main</span></b>
                <small>{mainKind ? WAY_KIND_LABEL[mainKind] : 'Not set up'}</small>
              </span>
              {!readOnly && !editingMain && (
                <span className="gv-pw-acts">
                  <button type="button" className="gv-st-link" onClick={() => { setMainName(list.mainName ?? ''); setMainErr(''); setEditingMain(true); }}>Edit name</button>
                  <button type="button" className="gv-st-link" onClick={onEditMain}>Edit</button>
                </span>
              )}
            </div>
            {editingMain && <div style={{ padding: '4px 0 16px' }}>{mainNameField}</div>}
            {list.ways.map(w => (
              <div key={w.id} className="gv-pw-row">
                <span className="gv-pw-name">
                  <b>{w.name}</b>
                  <small>{WAY_KIND_LABEL[w.manual_kind]}{w.complete ? '' : ' · Not finished'}</small>
                </span>
                {!readOnly && asking !== w.id && (
                  <span className="gv-pw-acts">
                    <button type="button" className="gv-st-link" onClick={() => openForm(w.manual_kind, w)}>Edit</button>
                    <button type="button" className="gv-st-link" style={{ color: '#8B2020' }} onClick={() => { setErr(''); setAsking(w.id); }}>Remove</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {askingWay && (
            <div className="gv-fd-warn" role="alertdialog" aria-label="Remove this payment method">
              <p style={{ margin: '0 0 12px' }}>
                Remove this payment method? Payers will not see it any more.
                {askingWay.open_payments > 0 ? ' Payments already started with it stay in your list to review.' : ''}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => { void remove(askingWay); }} autoFocus>
                  {busy ? 'Removing' : 'Remove'}
                </button>
                <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setAsking(null)}>Keep it</button>
              </div>
            </div>
          )}
          {!readOnly && (list.canAdd ? (
            <div>
              <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setErr(''); setAsking(null); setView({ v: 'kind' }); }}>
                <Plus size={16} strokeWidth={2.4} aria-hidden /> Add a payment method
              </button>
            </div>
          ) : <p className="gv-fd-note">{MAX_WAYS_LINE}</p>)}
        </div>
      );
    }
    foot = (
      <>
        {onBack && (
          <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
          </button>
        )}
        <button type="button" className="gv-st-btn gv-st-forest" disabled={busy}
          onClick={() => { if (!readOnly) notifyOk('Payment methods saved', 'financials'); onDone(); }}>
          Done
        </button>
      </>
    );
  } else if (view.v === 'kind') {
    title = 'Add a Payment Method';
    body = (
      <div className="gv-pf-cards" role="radiogroup" aria-label="How people pay you">
        {KIND_CARDS.map(m => (
          <button key={m.key} type="button" role="radio" aria-checked={false} className="gv-pf-card" onClick={() => openForm(m.key, null)}>
            <span className="gv-pf-icon" aria-hidden>{m.icon}</span>
            <p className="gv-pf-title">{m.title}</p>
            <p className="gv-pf-desc">{m.desc}</p>
          </button>
        ))}
      </div>
    );
    foot = (
      <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setView({ v: 'list' })}>
        <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
      </button>
    );
  } else {
    const { kind, way } = view;
    title = KIND_TITLE[kind];
    const inPerson = kind === 'in_person';
    const preview = qrPreview ?? (qrPath ? qrUrl(qrPath) : null);
    const bankField = (k: keyof BankDetails, label: string, required: boolean, placeholder?: string) => (
      <div>
        <label className="gv-fd-label" htmlFor={`gv-pw-${k}`}>{label}{required ? '' : ' (optional)'}</label>
        <input id={`gv-pw-${k}`} className="gv-pf-input" value={bank[k]} disabled={readOnly} placeholder={placeholder}
          maxLength={k === 'swift' ? 11 : 120} aria-invalid={!!errs[k]}
          onChange={e => { const v = e.target.value; setBank(x => ({ ...x, [k]: v })); setErrs(x => ({ ...x, [k]: undefined })); }} />
        {fieldErr(k)}
      </div>
    );
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="gv-fd-label" htmlFor="gv-pw-name">Name payers will see</label>
          <input id="gv-pw-name" className="gv-pf-input" value={name} maxLength={NAME_MAX} disabled={readOnly} required
            placeholder="For example, Indian delegates" aria-invalid={!!errs.name}
            onChange={e => { setName(e.target.value); setErrs(x => ({ ...x, name: undefined })); }} />
          {fieldErr('name')}
        </div>
        {kind === 'link' && (
          <div>
            <label className="gv-fd-label" htmlFor="gv-pw-url">Link to your payment page</label>
            <input id="gv-pw-url" className="gv-pf-input" type="url" inputMode="url" placeholder="https://" value={url} disabled={readOnly}
              aria-invalid={!!errs.url} onChange={e => { setUrl(e.target.value); setErrs(x => ({ ...x, url: undefined })); }} />
            {fieldErr('url')}
          </div>
        )}
        {kind === 'qr' && (
          <div>
            <span className="gv-fd-label">Your QR code (PNG or JPG, up to 5 MB)</span>
            <input ref={qrInput} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e => pickQr(e.target.files?.[0] ?? null)} />
            <div className="flex items-end gap-4 flex-wrap">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Your payment QR code" className="gv-pf-qr" />
              ) : (
                <span className="gv-pf-qr" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#5A5046' }} aria-hidden>
                  <QrCode size={40} strokeWidth={1.8} />
                </span>
              )}
              <button type="button" className="gv-st-btn gv-st-outline" disabled={readOnly || busy} onClick={() => qrInput.current?.click()}>
                <ImageUp size={16} strokeWidth={2.2} aria-hidden /> {preview ? 'Replace image' : 'Upload image'}
              </button>
              {qrFile && way?.qr_path && !busy && (
                <button type="button" className="gv-st-link" onClick={() => { setQrFile(null); setQrPreview(null); setQrPath(way.qr_path); }}>
                  <X size={13} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> Keep the old image
                </button>
              )}
            </div>
            {fieldErr('qr')}
          </div>
        )}
        {kind === 'phone' && (
          <div>
            <label className="gv-fd-label" htmlFor="gv-pw-phone">Phone number people pay to</label>
            <input id="gv-pw-phone" className="gv-pf-input" type="tel" inputMode="tel" autoComplete="off" placeholder="+44 7700 900123" value={phone} disabled={readOnly}
              maxLength={40} aria-invalid={!!errs.phone} onChange={e => { setPhone(e.target.value); setErrs(x => ({ ...x, phone: undefined })); }} />
            {fieldErr('phone')}
          </div>
        )}
        {kind === 'bank' && (
          <>
            <div className="gv-pf-grid">
              {bankField('account_name', 'Name on the account', true)}
              {bankField('account_number', 'IBAN or account number', true)}
              {bankField('swift', 'SWIFT or BIC', false)}
              {bankField('bank_name', 'Bank name', false)}
            </div>
            {bankField('reference', 'Payment reference', false, 'For example your name and conference')}
          </>
        )}
        <div>
          <label className="gv-fd-label" htmlFor="gv-pw-note">{inPerson ? 'Instructions for payment' : 'Instructions for payers (optional)'}</label>
          <textarea id="gv-pw-note" className="gv-fd-text" maxLength={NOTE_MAX} value={note} disabled={readOnly} required={inPerson}
            placeholder={inPerson ? 'For example: Pay in cash at the registration desk on day one' : undefined}
            onChange={e => { setNote(e.target.value); setErrs(x => ({ ...x, note: undefined })); }} aria-invalid={!!errs.note} />
          <p className="gv-fd-count">{note.length} / {NOTE_MAX}</p>
          <p className="gv-fd-note" style={{ marginTop: 4 }}>No need to ask for screenshots. Payers upload their proof on Gavelling and you accept it in Financials</p>
          {fieldErr('note')}
        </div>
        {fieldErr('manual_kind')}
      </div>
    );
    foot = (
      <>
        <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setErr(''); setView(way ? { v: 'list' } : { v: 'kind' }); }}>
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
        </button>
        <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly || busy} onClick={() => { void saveWay(kind, way); }}>
          {busy ? 'Saving' : <><Check size={16} strokeWidth={2.6} aria-hidden /> Save</>}
        </button>
      </>
    );
  }

  return (
    <>
      <style>{WAYS_CSS}</style>
      <div style={{ paddingRight: 40 }}>
        <h2 className="gv-fd-pop-title" style={{ paddingRight: 0 }}>{title}</h2>
      </div>
      {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
      {body}
      {err && <p className="gv-st-err" role="alert">{err}</p>}
      <div className="gv-fd-footbar">{foot}</div>
    </>
  );
}
