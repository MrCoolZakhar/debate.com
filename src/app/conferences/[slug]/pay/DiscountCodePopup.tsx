'use client';

// DiscountCodePopup — "Discount Code" on /pay (prompt 107). One field and
// Apply: checkout_discount_quote is asked for the ticked items (read only, it
// changes nothing). A refusal is shown under the field as the server wrote it;
// a good code closes the pop-up by itself and the pay bar shows it applied.
// Only drawn while checkout_discounts_available says codes are on.

import { useRef, useState } from 'react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DANGER, INK } from './payKit';
import { quoteDiscount, type DiscountQuote } from './payApi';

export default function DiscountCodePopup({ invoiceIds, onClose, onApplied }: {
  invoiceIds: string[];
  onClose: () => void;
  onApplied: (code: string, quote: DiscountQuote) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (busyRef.current || !c) return;
    busyRef.current = true; setBusy(true); setErr('');
    const r = await quoteDiscount(invoiceIds, c);
    busyRef.current = false; setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    onApplied(r.data.code || c, r.data);
  };

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label="Discount code" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-pay-small" testId="pay-discount">
        <form
          style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}
          onSubmit={e => { e.preventDefault(); void apply(); }}
        >
          <h2 style={{ margin: 0, paddingRight: 40, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: INK }}>Discount Code</h2>
          <div>
            <label htmlFor="gv-pay-code" className="sr-only">Discount code</label>
            <input
              id="gv-pay-code"
              value={code}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              placeholder="Enter your code"
              aria-invalid={!!err}
              aria-describedby={err ? 'gv-pay-code-err' : undefined}
              disabled={busy}
              onChange={e => { setCode(e.target.value.toUpperCase()); if (err) setErr(''); }}
              style={{
                width: '100%', height: 50, padding: '0 14px', borderRadius: 12,
                border: `1.5px solid ${err ? DANGER : 'rgba(27,56,40,0.28)'}`, background: '#FFFFFF',
                fontFamily: 'inherit', fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: INK,
              }}
            />
            {err && <p id="gv-pay-code-err" role="alert" style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.45, color: DANGER }}>{err}</p>}
          </div>
          <div>
            <button type="submit" className="gv-pay-btn gv-pay-forest" disabled={busy || !code.trim()}>
              {busy ? 'Checking' : 'Apply'}
            </button>
          </div>
        </form>
      </PurchaseShell>
    </>
  );
}
