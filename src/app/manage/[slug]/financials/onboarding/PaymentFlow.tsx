'use client';

// PaymentFlow — "Welcome to Financials" and the Payment Method pop-up
// (prompt 94). One pop-up with steps, like creating a conference:
//   1 Where is your bank account?   (a country, saved with step 3's call)
//   2 How will people pay you?      (card, payment link, QR code, bank transfer)
//   3 The chosen method's set-up    (ONE set_payment_setup call; card goes on to Stripe)
//   4 Registration fee              (welcome only, skippable)
//   5 Add-ons                       (welcome only, skippable)
//   Done                            (welcome only)
// The Payment Method pop-up is the same flow opened at step 2 with the
// current method chosen and its details filled in; it ends after step 3.
// Card OR one manual kind, never both: switching asks first and is one call.
// Each step saves on Continue, so closing halfway keeps what was saved.

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Check, CircleCheck, CreditCard, ImageUp, Link2, QrCode, X,
} from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES, getCountryByName } from '@/lib/countries';
import { isStripeCountrySupported } from '@/lib/payments';
import { SUPABASE_URL } from '@/lib/supabase';
import { notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '../../store/storeKit';
import { DASH_CSS, READ_ONLY_LINE } from '../dashboardKit';
import ApplicationFeeSection from '../ApplicationFeeSection';
import AddonsSection from '../AddonsSection';
import StripeState from './StripeState';
import {
  METHOD_NAME, currentMethod, setPaymentSetup, uploadPaymentQr, sessionSet, welcomeMarkerKey,
  connectStart, type BankDetails, type MethodKey,
} from './paymentApi';

const NOTE_MAX = 500;
const QR_MAX_BYTES = 5 * 1024 * 1024;

export const FLOW_CSS = `
.gv-pf-step{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#5A5046}
.gv-pf-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@media (min-width:720px){.gv-pf-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-pf-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:18px 18px 20px;border-radius:18px;border:none;background:#FFFFFF;text-align:left;cursor:pointer;font-family:inherit;color:#1C1410;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -26px rgba(27,56,40,0.5),inset 0 0 0 1.5px rgba(27,56,40,0.1);transition:box-shadow 160ms ease,transform 120ms ease}
.gv-pf-card:hover:not(:disabled){box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 34px -24px rgba(27,56,40,0.55),inset 0 0 0 1.5px rgba(27,56,40,0.28)}
.gv-pf-card:disabled{cursor:default;opacity:0.6}
.gv-pf-card[aria-checked="true"]{box-shadow:0 0 0 3px #1B3828,0 18px 34px -24px rgba(27,56,40,0.55)}
.gv-pf-card:focus{outline:none}
.gv-pf-card:focus-visible{box-shadow:0 0 0 3px #FFFFFF,0 0 0 6px #1B3828}
.gv-pf-icon{width:48px;height:48px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:rgba(238,217,138,0.45);color:#1B3828}
.gv-pf-title{margin:0;font-size:18px;font-weight:800;letter-spacing:-0.01em}
.gv-pf-desc{margin:0;font-size:14px;line-height:1.5;color:#5A5046}
.gv-pf-tick{position:absolute;top:14px;right:14px;width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#1B3828;color:#EED98A}
.gv-pf-input{width:100%;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:#1C1410;font-family:inherit;font-size:15.5px}
.gv-pf-input:focus{outline:none;border-color:#1B3828;box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-pf-input[aria-invalid="true"]{border-color:#8B2020}
.gv-pf-select{appearance:auto;cursor:pointer}
.gv-pf-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:640px){.gv-pf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-pf-qr{width:180px;height:180px;border-radius:14px;background:#FFFFFF;object-fit:contain;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.12)}
.gv-pf-done{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:16px 0 8px}
`;

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type FieldErrs = Partial<Record<'country' | 'method' | 'manual_kind' | 'url' | 'qr' | 'note' | 'account_name' | 'account_number' | 'swift' | 'bank_name' | 'reference', string>>;

const METHOD_CARDS: { key: MethodKey; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'card', title: 'Pay by card', icon: <CreditCard size={24} strokeWidth={2.2} />,
    desc: 'Payers pay by card inside Gavelling and everything updates automatically. Stripe keeps a small percentage plus a fixed fee on each payment. That fee is your conference\'s cost, and Stripe keeps it on refunds too.' },
  { key: 'link', title: 'Payment link', icon: <Link2 size={24} strokeWidth={2.2} />,
    desc: 'Send payers to your own payment page. You confirm payments by reviewing the proofs payers upload.' },
  { key: 'qr', title: 'Payment QR code', icon: <QrCode size={24} strokeWidth={2.2} />,
    desc: 'Show a QR code payers scan with their banking app (for example UPI). You confirm payments by reviewing the proofs payers upload.' },
  { key: 'bank', title: 'Bank transfer', icon: <Building2 size={24} strokeWidth={2.2} />,
    desc: 'Show your bank details with copy buttons. You confirm payments by reviewing the proofs payers upload.' },
];

const qrUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/conference-assets/${path.split('/').map(encodeURIComponent).join('/')}`;

export default function PaymentFlow({ conference, mode, startStep, readOnly, onClose, onChanged }: {
  conference: Conference;
  /** 'welcome' runs all the steps; 'payment' is the Payment Method pop-up (steps 1 to 3). */
  mode: 'welcome' | 'payment';
  startStep?: Step;
  readOnly: boolean;
  onClose: () => void;
  /** Re-read the conference and the dashboard after something was saved. */
  onChanged: () => void;
}) {
  const current = currentMethod(conference);
  const [step, setStep] = useState<Step>(startStep ?? (mode === 'payment' ? 2 : 1));
  const [country, setCountry] = useState(conference.payout_country || getCountryByName(conference.country)?.code || '');
  const [method, setMethod] = useState<MethodKey | null>(current);
  const [url, setUrl] = useState(conference.external_payment_url ?? '');
  const [note, setNote] = useState(conference.external_payment_note ?? '');
  const [qrPath, setQrPath] = useState<string | null>(conference.payment_qr_path ?? null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const b = conference.bank_details ?? {};
  const [bank, setBank] = useState<BankDetails>({
    account_name: b.account_name ?? '', account_number: b.account_number ?? '', swift: b.swift ?? '',
    bank_name: b.bank_name ?? '', reference: b.reference ?? '',
  });
  const [errs, setErrs] = useState<FieldErrs>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [askSwitch, setAskSwitch] = useState(false);
  const busyRef = useRef(false);
  const qrInput = useRef<HTMLInputElement | null>(null);

  const countries = useMemo(() => [...UN_COUNTRIES].sort((a, b2) => a.name.localeCompare(b2.name)), []);
  const countryName = countries.find(c => c.code === country)?.name ?? country;
  const cardOk = isStripeCountrySupported(country);
  const total = mode === 'welcome' ? 5 : 3;
  const hasStripeAccount = !!conference.stripe_account_id
    || conference.connect_onboarding_status === 'pending' || conference.connect_onboarding_status === 'complete';

  const busyRun = async (fn: () => Promise<void>) => {
    if (busyRef.current || readOnly) return;
    busyRef.current = true; setBusy(true); setErr('');
    try { await fn(); } finally { busyRef.current = false; setBusy(false); }
  };

  /** Client checks first, so the server rarely has to refuse. */
  const localErrors = (): FieldErrs => {
    const e: FieldErrs = {};
    if (!country) e.country = 'Choose the country your bank account is in.';
    if (method === 'link') {
      const u = url.trim();
      if (!u) e.url = 'Add the link to your payment page.';
      else if (!/^https:\/\/\S+\.\S+$/i.test(u)) e.url = 'The link must start with https:// and be a full web address.';
    }
    if (method === 'qr' && !qrPath && !qrFile) e.qr = 'Upload your payment QR code image.';
    if (method === 'bank') {
      if (!bank.account_name.trim()) e.account_name = 'Add the name on the account.';
      if (!bank.account_number.trim()) e.account_number = 'Add the IBAN or account number.';
      const sw = bank.swift.trim().toUpperCase();
      if (sw && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(sw)) e.swift = 'A SWIFT or BIC code has 8 or 11 letters and numbers.';
    }
    if (note.trim().length > NOTE_MAX) e.note = 'Keep the instructions under 500 characters.';
    return e;
  };

  /** Step 3's one write. Returns true when it landed. */
  const save = async (): Promise<boolean> => {
    if (!method) return false;
    const local = localErrors();
    if (Object.keys(local).length > 0) { setErrs(local); if (local.country) setStep(1); return false; }
    setErrs({});
    let path = qrPath;
    if (method === 'qr' && qrFile) {
      const up = await uploadPaymentQr(conference.id, qrFile);
      if ('error' in up) { setErrs({ qr: up.error }); return false; }
      path = up.path;
      setQrPath(up.path);
      setQrFile(null);
    }
    const r = await setPaymentSetup({
      conferenceId: conference.id, country, method, url, note, qrPath: path,
      bank: { ...bank, swift: bank.swift.trim().toUpperCase() },
    });
    if (!r.ok) {
      if (r.field) {
        setErrs({ [r.field]: r.error } as FieldErrs);
        if (r.field === 'country') setStep(1);
        if (r.field === 'method' || r.field === 'manual_kind') setStep(2);
      } else setErr(r.error);
      return false;
    }
    onChanged();
    return true;
  };

  /** After a manual method saved: on to the fee (welcome) or done (payment). */
  const afterSave = () => {
    if (mode === 'welcome') setStep(4);
    else { notifyOk('Payment method saved', 'financials'); onClose(); }
  };

  const continueStep3 = () => busyRun(async () => {
    if (mode === 'payment' && current && method !== current && !askSwitch) { setAskSwitch(true); return; }
    setAskSwitch(false);
    if (method === 'card') {
      const ok = await save();
      if (!ok) return;
      if (hasStripeAccount) { afterSave(); return; }
      // No account yet: on to Stripe. The welcome flow resumes at step 4 on return.
      if (mode === 'welcome') sessionSet(welcomeMarkerKey(conference.id), '1');
      const r = await connectStart(conference.id, country || null);
      if ('error' in r) { setErr(r.error); return; }
      window.location.assign(r.url);
      return;
    }
    if (await save()) afterSave();
  });

  const pickQr = (f: File | null) => {
    setErrs(e => ({ ...e, qr: undefined }));
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/.test(f.type)) { setErrs(e => ({ ...e, qr: 'Upload a PNG or JPG image.' })); return; }
    if (f.size > QR_MAX_BYTES) { setErrs(e => ({ ...e, qr: 'That image is over 5 MB. Upload a smaller one.' })); return; }
    setQrFile(f);
    setQrPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
  };

  const fieldErr = (k: keyof FieldErrs) => errs[k] ? <p className="gv-st-err" role="alert">{errs[k]}</p> : null;

  const notesField = (
    <div>
      <label className="gv-fd-label" htmlFor="gv-pf-note">Instructions for payers (optional)</label>
      <textarea id="gv-pf-note" className="gv-fd-text" maxLength={NOTE_MAX} value={note} disabled={readOnly}
        onChange={e => { setNote(e.target.value); setErrs(x => ({ ...x, note: undefined })); }} aria-invalid={!!errs.note} />
      <p className="gv-fd-count">{note.length} / {NOTE_MAX}</p>
      {fieldErr('note')}
    </div>
  );

  const bankField = (k: keyof BankDetails, label: string, required: boolean, placeholder?: string) => (
    <div>
      <label className="gv-fd-label" htmlFor={`gv-pf-${k}`}>{label}{required ? '' : ' (optional)'}</label>
      <input id={`gv-pf-${k}`} className="gv-pf-input" value={bank[k]} disabled={readOnly} placeholder={placeholder}
        maxLength={k === 'swift' ? 11 : 120} aria-invalid={!!errs[k]}
        onChange={e => { const v = e.target.value; setBank(x => ({ ...x, [k]: v })); setErrs(x => ({ ...x, [k]: undefined })); }} />
      {fieldErr(k)}
    </div>
  );

  // ── Steps ──────────────────────────────────────────────────────────────
  let title = '';
  let body: React.ReactNode = null;
  let primary: { label: string; onClick: () => void; disabled?: boolean } | null = null;
  let skip: (() => void) | null = null;

  if (step === 1) {
    title = 'Where Is Your Bank Account?';
    body = (
      <div>
        <label className="gv-fd-label" htmlFor="gv-pf-country">Country</label>
        <div className="flex items-center gap-3">
          {country && <FlagImg code={country} size={24} />}
          <select id="gv-pf-country" className="gv-pf-input gv-pf-select" value={country} disabled={readOnly} aria-invalid={!!errs.country}
            onChange={e => { setCountry(e.target.value); setErrs(x => ({ ...x, country: undefined })); }}>
            <option value="">Choose a country</option>
            {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        {fieldErr('country')}
        <p className="gv-fd-note" style={{ marginTop: 10 }}>This decides which ways to pay you can offer</p>
      </div>
    );
    primary = { label: 'Continue', disabled: !country, onClick: () => { if (country) setStep(2); } };
  } else if (step === 2) {
    title = 'How Will People Pay You?';
    const cards = METHOD_CARDS.filter(m => m.key !== 'card' || cardOk);
    body = (
      <div>
        <div className="gv-pf-cards" role="radiogroup" aria-label="How people pay you">
          {cards.map(m => (
            <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className="gv-pf-card"
              onClick={() => { setMethod(m.key); setErrs({}); setAskSwitch(false); }}>
              {method === m.key && <span className="gv-pf-tick" aria-hidden><Check size={15} strokeWidth={3} /></span>}
              <span className="gv-pf-icon" aria-hidden>{m.icon}</span>
              <p className="gv-pf-title">{m.title}</p>
              <p className="gv-pf-desc">{m.desc}</p>
              {current === m.key && <p className="gv-fd-note" style={{ fontWeight: 700, color: '#2A5A3C' }}>In use now</p>}
            </button>
          ))}
        </div>
        {!cardOk && country && (
          <p className="gv-fd-note" style={{ marginTop: 12 }}>Card payments are not available for bank accounts in {countryName} yet</p>
        )}
        <p className="gv-fd-note" style={{ marginTop: 10 }}>
          Bank account in {countryName || 'no country yet'}.{' '}
          <button type="button" className="gv-st-link" onClick={() => setStep(1)}>Change</button>
        </p>
        {fieldErr('method')}{fieldErr('manual_kind')}
      </div>
    );
    primary = { label: 'Continue', disabled: !method || (method === 'card' && !cardOk), onClick: () => { if (method) setStep(3); } };
  } else if (step === 3) {
    if (method === 'card') {
      title = 'Pay by Card';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hasStripeAccount ? (
            <StripeState conference={conference} countryCode={country || null} readOnly={readOnly} onRefreshed={onChanged}
              beforeLeave={mode === 'welcome' ? () => sessionSet(welcomeMarkerKey(conference.id), '1') : undefined} />
          ) : (
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              Stripe handles card payments and pays them into your bank account. Next, Stripe asks for your organisation&apos;s details and your bank account. It takes about five minutes, and you come straight back here
            </p>
          )}
        </div>
      );
      primary = {
        label: hasStripeAccount ? (current === 'card' ? (mode === 'welcome' ? 'Continue' : 'Done') : 'Use card payments') : 'Continue to Stripe',
        onClick: () => { if (mode === 'payment' && current === 'card' && hasStripeAccount) { onClose(); return; } void continueStep3(); },
      };
    } else if (method === 'link') {
      title = 'Payment Link';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="gv-fd-label" htmlFor="gv-pf-url">Link to your payment page</label>
            <input id="gv-pf-url" className="gv-pf-input" type="url" inputMode="url" placeholder="https://" value={url} disabled={readOnly}
              aria-invalid={!!errs.url} onChange={e => { setUrl(e.target.value); setErrs(x => ({ ...x, url: undefined })); }} />
            {fieldErr('url')}
          </div>
          {notesField}
        </div>
      );
      primary = { label: 'Save', onClick: () => { void continueStep3(); } };
    } else if (method === 'qr') {
      title = 'Payment QR Code';
      const preview = qrPreview ?? (qrPath ? qrUrl(qrPath) : null);
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            </div>
            {fieldErr('qr')}
          </div>
          {notesField}
        </div>
      );
      primary = { label: 'Save', onClick: () => { void continueStep3(); } };
    } else if (method === 'bank') {
      title = 'Bank Transfer';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gv-pf-grid">
            {bankField('account_name', 'Name on the account', true)}
            {bankField('account_number', 'IBAN or account number', true)}
            {bankField('swift', 'SWIFT or BIC', false)}
            {bankField('bank_name', 'Bank name', false)}
          </div>
          {bankField('reference', 'Payment reference', false, 'For example your name and conference')}
          {notesField}
        </div>
      );
      primary = { label: 'Save', onClick: () => { void continueStep3(); } };
    }
  } else if (step === 4) {
    title = 'Registration Fee';
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="gv-fd-note" style={{ fontSize: 15 }}>A fee charged once per delegation, or once per delegate, on top of the conference ticket</p>
        <ApplicationFeeSection conference={conference} bare />
      </div>
    );
    primary = { label: 'Continue', onClick: () => setStep(5) };
    skip = () => setStep(5);
  } else if (step === 5) {
    title = 'Add-ons';
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="gv-fd-note" style={{ fontSize: 15 }}>Extras payers can add, like a gala ticket or a T-shirt</p>
        <AddonsSection conference={conference} bare />
      </div>
    );
    primary = { label: 'Continue', onClick: () => setStep(6) };
    skip = () => setStep(6);
  }

  const showBack = step > 1 && step < 6;

  return (
    <>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{FLOW_CSS}</style>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label={mode === 'welcome' ? 'Welcome to Financials' : 'Payment method'} onClose={onClose} panelClass="gv-fd-wide" testId="financials-payment-flow">
        <div className="gv-fd-pop gv-st">
          {conference.platform_collects ? (
            <div className="gv-pf-done">
              <span className="gv-fd-clear-disc" aria-hidden><CircleCheck size={24} strokeWidth={2.2} /></span>
              <h2 className="gv-fd-pop-title">Gavelling Collects Payments for You</h2>
              <p className="gv-fd-note" style={{ fontSize: 15 }}>Payers pay by card and there is nothing to set up</p>
              <button type="button" className="gv-st-btn gv-st-forest" onClick={onClose}>Close</button>
            </div>
          ) : step === 6 ? (
            <div className="gv-pf-done">
              <span className="gv-fd-clear-disc" aria-hidden><CircleCheck size={24} strokeWidth={2.2} /></span>
              <h2 className="gv-fd-pop-title">You&apos;re Ready to Take Payments</h2>
              <button type="button" className="gv-st-btn gv-st-forest" onClick={onClose}>Go to Financials</button>
              <Link href={`/manage/${conference.slug}/settings?tab=applications`} className="gv-st-link" onClick={onClose}>Set fees for each role</Link>
            </div>
          ) : (
            <>
              <div style={{ paddingRight: 40 }}>
                <p className="gv-pf-step">Step {step} of {total}</p>
                <h2 className="gv-fd-pop-title" style={{ paddingRight: 0 }}>{title}</h2>
              </div>
              {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
              {body}
              {askSwitch && method && (
                <div className="gv-fd-warn" role="alertdialog" aria-label="Switch how people pay">
                  <p style={{ margin: '0 0 12px' }}>Switch to {METHOD_NAME[method]}? Payers will see the new way to pay straight away</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => { void continueStep3(); }} autoFocus>
                      {busy ? 'Switching' : 'Switch'}
                    </button>
                    <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setAskSwitch(false)}>Go back</button>
                  </div>
                </div>
              )}
              {err && <p className="gv-st-err" role="alert">{err}</p>}
              <div className="gv-fd-footbar">
                {showBack && (
                  <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setAskSwitch(false); setErr(''); setStep((step - 1) as Step); }}>
                    <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
                  </button>
                )}
                {primary && !askSwitch && (
                  <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly || busy || primary.disabled} onClick={primary.onClick}>
                    {busy ? 'Saving' : primary.label}
                  </button>
                )}
                {skip && <button type="button" className="gv-st-link" onClick={skip}>Skip for now</button>}
                {step === 3 && method === 'qr' && !readOnly && !busy && qrFile && qrPath && (
                  <button type="button" className="gv-st-link" onClick={() => { setQrFile(null); setQrPreview(null); }}>
                    <X size={13} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> Keep the old image
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}
