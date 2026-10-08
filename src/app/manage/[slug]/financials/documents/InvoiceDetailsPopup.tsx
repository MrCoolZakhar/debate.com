'use client';

// InvoiceDetailsPopup — "Your Invoice Details" (prompt 98): who issues the
// conference's invoices and receipts, the number prefix, the default tax note
// and the colour, with a sample document on the right that follows every
// keystroke. The first time it is a two-step walkthrough (who issues them,
// then how they look); afterwards it is one screen. Saved only with
// save_invoice_settings; a refusal that names a field shows under that field.

import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import MoneyDocumentView from '@/components/money/MoneyDocumentView';
import { DOC_FOREST, sampleDoc } from '@/components/money/moneyDocument';
import { notifyOk } from '@/lib/appNotify';
import { READ_ONLY_LINE } from '../dashboardKit';
import { Field } from './docsKit';
import { saveInvoiceSettings, type InvoiceSettings, type SettingsInput } from './documentsApi';

const STEP_ONE = new Set(['legal_name', 'address', 'website', 'tax_id']);

function cleanPrefix(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export default function InvoiceDetailsPopup({ conferenceId, initial, readOnly, onClose, onSaved }: {
  conferenceId: string;
  initial: InvoiceSettings;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = initial.settings;
  const firstTime = !s;
  const conf = initial.conference;
  const [v, setV] = useState<SettingsInput>(() => ({
    legal_name: s?.legal_name ?? conf.full_name ?? '',
    address: s?.address ?? '',
    website: s?.website ?? conf.website ?? '',
    tax_id: s?.tax_id ?? '',
    number_prefix: s?.number_prefix ?? cleanPrefix(initial.suggested_prefix),
    tax_note: s?.tax_note ?? '',
    accent_color: s?.accent_color ?? null,
  }));
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const set = <K extends keyof SettingsInput>(k: K, val: SettingsInput[K]) => {
    setV(prev => ({ ...prev, [k]: val }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const year = new Date().getFullYear();
  const example = `${v.number_prefix || 'WM'}-${year}-RCT-0001`;

  // The swatches: Gavelling forest, then the conference's own email colours when it has them.
  const theme = conf.email_theme ?? null;
  const swatches = Array.from(new Set([DOC_FOREST, theme?.accentColor, theme?.buttonColor]
    .filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
    .map(c => c.toUpperCase())));
  const current = (v.accent_color ?? DOC_FOREST).toUpperCase();
  const custom = !swatches.includes(current);

  const preview = sampleDoc(
    {
      legal_name: v.legal_name || 'Your legal name', address: v.address || 'Your address', website: v.website || null,
      tax_id: v.tax_id || null, number_prefix: v.number_prefix || 'WM', tax_note: v.tax_note || null, accent_color: v.accent_color,
    },
    conf,
  );

  const checkStepOne = () => {
    const e: Record<string, string> = {};
    if (!v.legal_name.trim()) e.legal_name = 'Add the legal name your invoices are issued under.';
    if (!v.address.trim()) e.address = 'Add the address that goes on your invoices.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (busyRef.current || readOnly) return;
    if (!checkStepOne()) { setStep(1); return; }
    if (!/^[A-Z0-9]{2,8}$/.test(v.number_prefix)) { setErrors({ number_prefix: 'Use 2 to 8 letters or numbers, for example WM.' }); return; }
    busyRef.current = true; setBusy(true); setFormErr('');
    const r = await saveInvoiceSettings(conferenceId, {
      ...v,
      legal_name: v.legal_name.trim(), address: v.address.trim(), website: v.website.trim(), tax_id: v.tax_id.trim(), tax_note: v.tax_note.trim(),
      accent_color: v.accent_color && v.accent_color.toUpperCase() !== DOC_FOREST.toUpperCase() ? v.accent_color : null,
    });
    busyRef.current = false; setBusy(false);
    if (!r.ok) {
      if (r.field) {
        setErrors({ [r.field]: r.error });
        if (firstTime && STEP_ONE.has(r.field)) setStep(1);
      } else setFormErr(r.error);
      return;
    }
    notifyOk('Invoice details saved', 'financials');
    onSaved();
  };

  const showOne = !firstTime || step === 1;
  const showTwo = !firstTime || step === 2;
  const err = (k: string) => errors[k];
  const inv = (k: string) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `md-${k}-err` } : {});

  return (
    <PurchaseShell tone="light" label="Your invoice details" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-md-studio" testId="invoice-details">
      <div className="gv-md-left">
        <div>
          {firstTime && <p className="gv-md-sect" style={{ marginBottom: 8 }}>Step {step} of 2</p>}
          <h2 className="gv-md-title">Your Invoice Details</h2>
          <p className="gv-md-sub">
            {firstTime && step === 2 ? 'How your numbers and documents look' : 'Who your invoices and receipts come from'}
          </p>
          {readOnly && <p className="gv-md-sub">{READ_ONLY_LINE}</p>}
        </div>

        <fieldset disabled={readOnly || busy} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {showOne && (
            <div className="gv-md-group">
              {!firstTime && <p className="gv-md-sect">Issuer</p>}
              <Field id="md-legal_name" label="Legal name" error={err('legal_name')} hint="The name of the organization that issues the invoice">
                <input id="md-legal_name" className="gv-md-input" value={v.legal_name} maxLength={200} autoComplete="organization"
                  onChange={e => set('legal_name', e.target.value)} {...inv('legal_name')} />
              </Field>
              <Field id="md-address" label="Address" error={err('address')}>
                <textarea id="md-address" className="gv-md-area" value={v.address} maxLength={400} rows={3} autoComplete="street-address"
                  onChange={e => set('address', e.target.value)} {...inv('address')} />
              </Field>
              <div className="gv-md-two">
                <Field id="md-website" label={<>Website <small>(optional)</small></>} error={err('website')}>
                  <input id="md-website" className="gv-md-input" value={v.website} maxLength={200} inputMode="url"
                    onChange={e => set('website', e.target.value)} {...inv('website')} />
                </Field>
                <Field id="md-tax_id" label={<>Tax ID <small>(optional)</small></>} error={err('tax_id')}>
                  <input id="md-tax_id" className="gv-md-input" value={v.tax_id} maxLength={80}
                    onChange={e => set('tax_id', e.target.value)} {...inv('tax_id')} />
                </Field>
              </div>
            </div>
          )}

          {showTwo && (
            <div className="gv-md-group">
              {!firstTime && <p className="gv-md-sect">Numbers and Look</p>}
              <Field id="md-number_prefix" label="Number prefix" error={err('number_prefix')}
                hint={<>2 to 8 letters or numbers. Your first receipt: <span className="gv-md-example">{example}</span></>}>
                <input id="md-number_prefix" className="gv-md-input" value={v.number_prefix} maxLength={8} autoCapitalize="characters"
                  onChange={e => set('number_prefix', cleanPrefix(e.target.value))} {...inv('number_prefix')} />
              </Field>
              <Field id="md-tax_note" label={<>Default tax note <small>(optional)</small></>} error={err('tax_note')} hint="Printed small under the totals. You can change it on any document">
                <textarea id="md-tax_note" className="gv-md-area" value={v.tax_note} maxLength={600} rows={2}
                  placeholder="For example: VAT is not applicable to this transaction"
                  onChange={e => set('tax_note', e.target.value)} {...inv('tax_note')} />
              </Field>
              <div className="gv-md-field">
                <span className="gv-md-label" id="md-colour-label">Colour</span>
                <div className="gv-md-swatches" role="radiogroup" aria-labelledby="md-colour-label">
                  {swatches.map((c, i) => (
                    <button key={c} type="button" role="radio" aria-checked={current === c} className="gv-md-swatch" style={{ background: c }}
                      aria-label={i === 0 ? 'Gavelling green' : `Your conference colour ${c}`} title={i === 0 ? 'Gavelling green' : 'From your conference emails'}
                      onClick={() => set('accent_color', i === 0 ? null : c)}>
                      {current === c && <Check size={16} strokeWidth={3} aria-hidden style={{ mixBlendMode: 'difference' }} />}
                    </button>
                  ))}
                  <label className="gv-md-picker" title="Pick any colour" style={custom ? { boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${DOC_FOREST}` } : undefined}>
                    <span className="sr-only">Pick any colour</span>
                    <input type="color" value={current.toLowerCase()} onChange={e => set('accent_color', e.target.value.toUpperCase())} />
                  </label>
                  {custom && <span className="gv-md-hint" style={{ fontVariantNumeric: 'tabular-nums' }}>{current}</span>}
                </div>
                {err('accent_color') && <p className="gv-md-err" role="alert">{err('accent_color')}</p>}
              </div>
            </div>
          )}
        </fieldset>

        <div className="gv-md-foot">
          {formErr && <p className="gv-md-err" role="alert">{formErr}</p>}
          <div className="gv-md-foot-row">
            {firstTime && step === 1 ? (
              <button type="button" className="gv-st-btn gv-st-forest" disabled={readOnly} onClick={() => { if (checkStepOne()) setStep(2); }}>Next</button>
            ) : (
              <>
                {firstTime && <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setStep(1)}>Back</button>}
                <button type="button" className="gv-st-btn gv-st-forest" disabled={busy || readOnly} onClick={() => { void save(); }}>
                  {busy ? 'Saving' : firstTime ? 'Save and continue' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="gv-md-right" aria-label="Sample document">
        <div className="gv-md-paper">
          <p className="gv-md-hint" style={{ textAlign: 'center', marginBottom: 12 }}>A sample, so you can see your details in place</p>
          <MoneyDocumentView doc={preview} />
        </div>
      </div>
    </PurchaseShell>
  );
}
