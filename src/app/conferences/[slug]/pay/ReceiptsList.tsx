'use client';

// ReceiptsList and ReceiptPopup — every payment as a receipt (prompt 95):
// the date, how it was paid, the total and what was refunded; opening one
// shows each item and the total they add up to. Since prompt 98 the receipt
// offers "Download receipt (PDF)" once the conference has its invoice details.

import { ChevronRight, CreditCard, Download, Landmark, ReceiptText } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DANGER, GREEN, INK_SOFT } from './payKit';
import { money, shortDate, type PayPayment } from './payApi';

export function howWords(how: PayPayment['how']): string {
  if (how === 'card') return 'Card';
  if (how === 'proof') return 'Proof approved';
  return 'Recorded by the organizers';
}

export default function ReceiptsList({ payments, onOpen }: { payments: PayPayment[]; onOpen: (key: string) => void }) {
  if (payments.length === 0) return null;
  return (
    <section aria-labelledby="gv-pay-paid">
      <p className="gv-pay-sect" id="gv-pay-paid">Paid</p>
      <div className="gv-pay-receipts">
        {payments.map(p => (
          <button key={p.key} type="button" className="gv-pay-receipt" onClick={() => onOpen(p.key)} aria-label={`Receipt from ${shortDate(p.at)}, ${money(p.total_cents, p.currency)}`}>
            <span style={{ display: 'inline-flex', color: GREEN }} aria-hidden>
              {p.how === 'card' ? <CreditCard size={18} strokeWidth={2.2} /> : <Landmark size={18} strokeWidth={2.2} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{howWords(p.how)}</span>
              <span style={{ display: 'block', fontSize: 13, color: INK_SOFT }}>{shortDate(p.at)}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(p.total_cents, p.currency)}</span>
              {p.returned_cents > 0 && <span style={{ display: 'block', fontSize: 12.5, color: DANGER, fontVariantNumeric: 'tabular-nums' }}>{money(p.returned_cents, p.currency)} refunded</span>}
            </span>
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden style={{ color: INK_SOFT }} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function ReceiptPopup({ payment, conferenceName, onClose, pdf }: {
  payment: PayPayment; conferenceName: string; onClose: () => void;
  /** Only when the conference has set up its invoice details (prompt 98). */
  pdf?: { busy: boolean; error: string; onDownload: () => void } | null;
}) {
  const sum = payment.items.reduce((s, i) => s + i.amount_cents, 0);
  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <PurchaseShell tone="light" label="Receipt" onClose={onClose} panelClass="gv-pay-mid" testId="pay-receipt">
        <div style={{ padding: '28px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <div style={{ paddingRight: 40 }}>
            <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: 'rgba(238,217,138,0.45)', color: '#1B3828' }} aria-hidden>
              <ReceiptText size={22} strokeWidth={2.2} />
            </span>
            <h2 style={{ margin: '12px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#1C1410' }}>Receipt</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14.5, color: INK_SOFT, overflowWrap: 'anywhere' }}>{conferenceName}</p>
          </div>
          <div className="gv-pay-rows">
            <div className="gv-pay-row"><span>Date</span><b>{shortDate(payment.at)}</b></div>
            <div className="gv-pay-row"><span>Paid by</span><b>{howWords(payment.how)}</b></div>
          </div>
          <div className="gv-pay-rows">
            {payment.items.map(i => (
              <div key={i.invoice_id} className="gv-pay-row"><span style={{ overflowWrap: 'anywhere' }}>{i.label}</span><b>{money(i.amount_cents, payment.currency)}</b></div>
            ))}
            <div className="gv-pay-row" style={{ fontWeight: 800 }}><span>Total</span><b style={{ color: '#1B3828' }}>{money(sum, payment.currency)}</b></div>
          </div>
          {payment.returned_cents > 0 && (
            <p style={{ margin: 0, fontSize: 14, color: DANGER }}>{money(payment.returned_cents, payment.currency)} of this was refunded</p>
          )}
          {pdf && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <button type="button" className="gv-pay-btn gv-pay-forest" disabled={pdf.busy} onClick={pdf.onDownload}>
                  <Download size={16} strokeWidth={2.4} aria-hidden /> {pdf.busy ? 'Making the PDF' : 'Download receipt (PDF)'}
                </button>
              </div>
              {pdf.error && <p className="gv-pay-err" role="alert">{pdf.error}</p>}
            </div>
          )}
        </div>
      </PurchaseShell>
    </>
  );
}
