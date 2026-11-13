'use client';

// PaymentWays — "Your Payment Methods" inside the Payment Method pop-up
// (prompt 31; one list, prompt 34). Every method is one row that looks the
// same: the conference's own set-up (set_payment_setup, the FIRST method) and
// up to 4 more MANUAL methods, each with a name payers see when there is more
// than one. Each row has Edit and Remove. Every view replaces the pop-up's
// content (never a pop-up on a pop-up): the list, the kind picker, then that
// kind's form. Remove asks in place. Card can be added while the first method
// is manual (payment_method_card_first): card becomes the first method.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2, Check, CreditCard, HandCoins, ImageUp, Link2, Phone, Plus, QrCode, X } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { SUPABASE_URL } from '@/lib/supabase';
import { notifyOk } from '@/lib/appNotify';
import { READ_ONLY_LINE } from '../dashboardKit';
import { connectStart, sessionSet, uploadPaymentQr, welcomeMarkerKey, type BankDetails, type MethodKey } from './paymentApi';
import {
  WAY_KIND_LABEL, addCardFirst, readPaymentWays, removeFirstMethod, removePaymentWay, savePaymentWay,
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
.gv-pw-count{position:absolute;top:14px;right:14px;display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:800;color:#1B3828}
.gv-pw-count .gv-pw-tick{width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#1B3828;color:#EED98A}
`;

/** The name field every payment method form starts with (prompt 34). */
export const METHOD_NAME_LABEL = 'Name of this payment method';
export const METHOD_NAME_HINT = 'Payers see this name when you have more than one payment method.';
export const METHOD_NAME_MISSING = 'Give this payment method a name.';

/** The check (and "x2" when used more than once) on a kind card already in use. */
export function KindInUse({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="gv-pw-count" aria-label={count > 1 ? `In use ${count} times` : 'In use'}>
      {count > 1 && <span>x{count}</span>}
      <span className="gv-pw-tick" aria-hidden><Check size={15} strokeWidth={3} /></span>
    </span>
  );
}

const KIND_CARDS: { key: WayKind; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'link', title: 'Payment link', icon: <Link2 size={24} strokeWidth={2.2} />,
    desc: 'Send payers to your own payment page. You confirm payments by reviewing the proofs payers upload.' },
  { key: 'qr', title: 'Payment QR code', icon: <QrCode size={24} strokeWidth={2.2} />,
    desc: 'Show a QR code payers scan with their banking app. You confirm payments by reviewing the proofs payers upload.' },
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

type View = { v: 'list' } | { v: 'kind' } | { v: 'form'; kind: WayKind; way: PaymentWay | null } | { v: 'card' };

export default function PaymentWays({ conference, mainKind, readOnly, cardOk, country, welcome, stepLine, onBack, onEditMain, onAddFirst, onDone, onChanged }: {
  /** "Step 3 of 3" above the title, the flow's own counter. */
  stepLine?: string;
  conference: Conference;
  /** The first method's kind today (card or a manual kind), null when there is none. */
  mainKind: MethodKey | null;
  readOnly: boolean;
  /** Stripe works for the bank country (isStripeCountrySupported). */
  cardOk: boolean;
  /** The bank country, for adding card. */
  country: string;
  /** Inside the welcome flow (its marker is set before going to Stripe). */
  welcome: boolean;
  /** Back from the list (to the currency step). */
  onBack?: () => void;
  /** Opens the first method's own set-up form. */
  onEditMain: () => void;
  /** No method at all: the first set-up path (kind cards, then the form, then back here). */
  onAddFirst: () => void;
  onDone: () => void;
  /** Re-read the conference after a change. */
  onChanged: () => void;
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

  // ── Remove, asked in place ───────────────────────────────────────────────
  // asking: a way id, or 'first' for the first method.
  const [asking, setAsking] = useState<string | null>(null);
  const remove = (w: PaymentWay) => run(async () => {
    const r = await removePaymentWay(w.id);
    if (!r.ok) { setErr(r.error); return; }
    setAsking(null);
    notifyOk('Payment method removed', 'financials');
    await load();
    onChanged();
  });
  const removeFirst = () => run(async () => {
    const r = await removeFirstMethod(conference.id);
    if (!r.ok) { setErr(r.error); return; }
    setAsking(null);
    if (r.nowFirst) notifyOk(`${r.nowFirst} is now your first payment method`, 'financials');
    else notifyOk('Payment method removed', 'financials');
    await load();
    onChanged();
  });

  // ── Adding card (the first method is manual) ─────────────────────────────
  const hasStripeAccount = !!conference.stripe_account_id
    || conference.connect_onboarding_status === 'pending' || conference.connect_onboarding_status === 'complete';
  const saveCard = () => run(async () => {
    const n = name.trim();
    if (!n) { setErrs({ name: METHOD_NAME_MISSING }); return; }
    if (n.length > NAME_MAX) { setErrs({ name: 'Keep the name under 40 characters.' }); return; }
    setErrs({});
    const r = await addCardFirst(conference.id, n, country);
    if (!r.ok) {
      if (r.field === 'name') setErrs({ name: r.error }); else setErr(r.error);
      return;
    }
    onChanged();
    if (!hasStripeAccount) {
      // On to Stripe exactly as the first set-up does; the welcome flow resumes on return.
      if (welcome) sessionSet(welcomeMarkerKey(conference.id), '1');
      const c = await connectStart(conference.id, country || null);
      if ('error' in c) { setErr(c.error); return; }
      window.location.assign(c.url);
      return;
    }
    notifyOk('Card payments added', 'financials');
    await load();
    setView({ v: 'list' });
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
    if (!n) e.name = METHOD_NAME_MISSING;
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
      if (r.code === 'main_name' || r.code === 'no_main') { await load(); setView({ v: 'list' }); setErr(r.error); return; }
      if (r.field && r.field in ({ name: 1, url: 1, qr: 1, phone: 1, note: 1, account_name: 1, account_number: 1, swift: 1, bank_name: 1, reference: 1, manual_kind: 1 } as Record<string, number>)) {
        setErrs({ [r.field]: r.error } as Errs);
      } else setErr(r.error);
      return;
    }
    await load();
    onChanged();
    setView({ v: 'list' });
  });

  const fieldErr = (k: keyof Errs) => errs[k] ? <p className="gv-st-err" role="alert">{errs[k]}</p> : null;

  // ── Render ───────────────────────────────────────────────────────────────
  let title = 'Your Payment Methods';
  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  // How many methods use each kind (the check, and "x2", on the kind cards).
  const kindCounts = new Map<string, number>();
  if (mainKind) kindCounts.set(mainKind, 1);
  for (const w of list?.ways ?? []) kindCounts.set(w.manual_kind, (kindCounts.get(w.manual_kind) ?? 0) + 1);
  const total = (mainKind ? 1 : 0) + (list?.ways.length ?? 0);

  if (view.v === 'list') {
    if (!list) {
      body = loadErr
        ? <p className="gv-st-err" role="alert">{loadErr} <button type="button" className="gv-st-link" onClick={() => { void load(); }}>Try again</button></p>
        : <div className="gv-fd-ph" style={{ height: 120, borderRadius: 16 }} aria-busy="true" />;
    } else {
      const only = total === 1;
      const askingWay = asking && asking !== 'first' ? list.ways.find(w => w.id === asking) ?? null : null;
      const confirm = (open: number, onYes: () => void) => (
        <div className="gv-fd-warn" role="alertdialog" aria-label="Remove this payment method" style={{ marginTop: 8 }}>
          <p style={{ margin: '0 0 12px' }}>
            {only
              ? 'This is your only payment method. If you remove it, nobody can pay you until you add a new one.'
              : `Remove this payment method? Payers will not see it any more.${open > 0 ? ' Payments already started with it stay in your list to review.' : ''}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={onYes} autoFocus>
              {busy ? 'Removing' : 'Remove'}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setAsking(null)}>Keep it</button>
          </div>
        </div>
      );
      const cardNote = mainKind === 'card' && conference.connect_onboarding_status !== 'complete' ? ' · Stripe needs a few more details' : '';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="gv-fd-note" style={{ fontSize: 15, margin: 0 }}>Payers choose one of these when they pay. With only one, they never see its name.</p>
          {total === 0 ? (
            <p className="gv-fd-note" style={{ fontSize: 15, fontWeight: 700 }}>No payment methods yet</p>
          ) : (
            <div className="gv-pw-list">
              {mainKind && (
                <div className="gv-pw-row">
                  <span className="gv-pw-name">
                    <b>{list.mainName ?? WAY_KIND_LABEL[mainKind]}</b>
                    <small>{WAY_KIND_LABEL[mainKind]}{cardNote}</small>
                  </span>
                  {!readOnly && asking !== 'first' && (
                    <span className="gv-pw-acts">
                      <button type="button" className="gv-st-link" onClick={onEditMain}>Edit</button>
                      <button type="button" className="gv-st-link" style={{ color: '#8B2020' }} onClick={() => { setErr(''); setAsking('first'); }}>Remove</button>
                    </span>
                  )}
                  {asking === 'first' && <div style={{ flexBasis: '100%' }}>{confirm(0, () => { void removeFirst(); })}</div>}
                </div>
              )}
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
                  {askingWay?.id === w.id && <div style={{ flexBasis: '100%' }}>{confirm(w.open_payments, () => { void remove(w); })}</div>}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (total < 5 ? (
            <div>
              <button type="button" className="gv-st-btn gv-st-outline" disabled={busy}
                onClick={() => { setErr(''); setAsking(null); if (!mainKind) onAddFirst(); else setView({ v: 'kind' }); }}>
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
        <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={onDone}>
          Done
        </button>
      </>
    );
  } else if (view.v === 'kind') {
    title = 'Add a Payment Method';
    const hasCard = mainKind === 'card';
    body = (
      <div className="gv-pf-cards" role="radiogroup" aria-label="How people pay you">
        {cardOk && (
          <button type="button" role="radio" aria-checked={false} className="gv-pf-card" disabled={hasCard}
            onClick={() => { setName(''); setErrs({}); setErr(''); setView({ v: 'card' }); }}>
            <KindInUse count={hasCard ? 1 : 0} />
            <span className="gv-pf-icon" aria-hidden><CreditCard size={24} strokeWidth={2.2} /></span>
            <p className="gv-pf-title">Pay by card</p>
            <p className="gv-pf-desc">{hasCard ? 'You already have a card payment method' : 'Payers pay by card inside Gavelling and everything updates automatically. Card becomes your first payment method.'}</p>
          </button>
        )}
        {KIND_CARDS.map(m => (
          <button key={m.key} type="button" role="radio" aria-checked={false} className="gv-pf-card" onClick={() => openForm(m.key, null)}>
            <KindInUse count={kindCounts.get(m.key) ?? 0} />
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
  } else if (view.v === 'card') {
    title = 'Pay by Card';
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="gv-fd-label" htmlFor="gv-pw-card-name">{METHOD_NAME_LABEL}</label>
          <input id="gv-pw-card-name" className="gv-pf-input" value={name} maxLength={NAME_MAX} disabled={readOnly} required aria-invalid={!!errs.name}
            onChange={e => { setName(e.target.value); setErrs(x => ({ ...x, name: undefined })); }} />
          <p className="gv-fd-note" style={{ marginTop: 4 }}>{METHOD_NAME_HINT}</p>
          {fieldErr('name')}
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
          {hasStripeAccount
            ? 'Card payments go to your Stripe account. Card becomes your first payment method and the method you have now moves into this list.'
            : 'Stripe handles card payments and pays them into your bank account. Next, Stripe asks for your organisation\'s details and your bank account. It takes about five minutes, and you come straight back here'}
        </p>
      </div>
    );
    foot = (
      <>
        <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setErr(''); setView({ v: 'kind' }); }}>
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
        </button>
        <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly || busy} onClick={() => { void saveCard(); }}>
          {busy ? 'Saving' : hasStripeAccount ? 'Use card payments' : 'Continue to Stripe'}
        </button>
      </>
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
          <label className="gv-fd-label" htmlFor="gv-pw-name">{METHOD_NAME_LABEL}</label>
          <input id="gv-pw-name" className="gv-pf-input" value={name} maxLength={NAME_MAX} disabled={readOnly} required
            aria-invalid={!!errs.name}
            onChange={e => { setName(e.target.value); setErrs(x => ({ ...x, name: undefined })); }} />
          <p className="gv-fd-note" style={{ marginTop: 4 }}>{METHOD_NAME_HINT}</p>
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
        {stepLine && <p className="gv-pf-step">{stepLine}</p>}
        <h2 className="gv-fd-pop-title" style={{ paddingRight: 0 }}>{title}</h2>
      </div>
      {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
      {body}
      {err && <p className="gv-st-err" role="alert">{err}</p>}
      <div className="gv-fd-footbar">{foot}</div>
    </>
  );
}
