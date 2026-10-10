'use client';

// ReceiptsList and ReceiptPopup — every payment as a receipt (prompt 95):
// the date, how it was paid, the total and what was refunded; opening one
// shows each item and the total they add up to. Since prompt 98 the receipt
// offers "Download receipt (PDF)" once the conference has its invoice details.
// Since prompt 102 Paid lists ONLY these receipts: a card says when something
// happened to its items (Refund requested, Refunded, Partly refunded, Disputed),
// and refunds are asked for from the receipt pop-up ("Request a refund", and
// "I haven't received it" beside a line refunded by hand).

import { ChevronRight, CreditCard, Download, Landmark, ReceiptText } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DANGER, GREEN, INK_SOFT } from './payKit';
import { money, shortDate, type PayItem, type PayPayment } from './payApi';
import { refundVia } from './ItemList';

export function howWords(how: PayPayment['how']): string {
  if (how === 'card') return 'Card';
  if (how === 'proof') return 'Proof approved';
  return 'Recorded by the organizers';
}

/** What happened to a payment's items since, in two words; null when nothing did. */
export function receiptEvent(p: PayPayment, itemsById: Map<string, PayItem>): string | null {
  const states = p.items.map(i => itemsById.get(i.invoice_id)?.state);
  if (states.includes('disputed')) return 'Disputed';
  if (states.includes('refund_requested')) return 'Refund requested';
  if (p.returned_cents > 0) return p.returned_cents >= p.total_cents ? 'Refunded' : 'Partly refunded';
  return null;
}

export default function ReceiptsList({ payments, itemsById, onOpen }: {
  payments: PayPayment[];
  /** The overview's items, so a card can say what happened to its own. */
  itemsById: Map<string, PayItem>;
  onOpen: (key: string) => void;
}) {
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
              {receiptEvent(p, itemsById) && (
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: receiptEvent(p, itemsById) === 'Disputed' ? DANGER : INK_SOFT }}>{receiptEvent(p, itemsById)}</span>
              )}
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

export function ReceiptPopup({ payment, conferenceName, onClose, pdf, itemsById, onRequestRefund, onNotReceived }: {
  payment: PayPayment; conferenceName: string; onClose: () => void;
  /** Only when the conference has set up its invoice details (prompt 98). */
  pdf?: { busy: boolean; error: string; onDownload: () => void } | null;
  /** The overview's items: which of this payment's lines can be refunded, or were refunded by hand. */
  itemsById: Map<string, PayItem>;
  /** Opens the refund request with this payment's refundable items, all ticked. */
  onRequestRefund: (items: PayItem[]) => void;
  /** "I haven't received it" for a line refunded by hand. */
  onNotReceived: (item: PayItem) => void;
}) {
  const refundable = payment.items.map(i => itemsById.get(i.invoice_id)).filter((i): i is PayItem => !!i && i.can_request_refund);
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
            {payment.items.map(i => {
              const it = itemsById.get(i.invoice_id);
              const manualRefund = it?.state === 'refunded' && it.refund && refundVia(it.refund.method) !== 'card';
              return (
                <div key={i.invoice_id} className="gv-pay-row" style={{ flexWrap: 'wrap' }}>
                  <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                    {i.label}
                    {it?.state === 'refunded' && <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>Refunded</span>}
                    {it?.state === 'refund_requested' && <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>Refund requested</span>}
                    {it?.state === 'disputed' && <span style={{ display: 'block', fontSize: 12.5, color: DANGER }}>Disputed</span>}
                    {manualRefund && (it!.not_received_reported
                      ? <span style={{ display: 'block', fontSize: 12.5, color: INK_SOFT }}>You told the organizers you haven&apos;t received it</span>
                      : <button type="button" className="gv-pay-link" style={{ fontSize: 13, marginTop: 2 }} onClick={() => onNotReceived(it!)}>I haven&apos;t received it</button>)}
                  </span>
                  <b>{money(i.amount_cents, payment.currency)}</b>
                </div>
              );
            })}
            <div className="gv-pay-row" style={{ fontWeight: 800 }}><span>Total</span><b style={{ color: '#1B3828' }}>{money(sum, payment.currency)}</b></div>
          </div>
          {payment.returned_cents > 0 && (
            <p style={{ margin: 0, fontSize: 14, color: DANGER }}>{money(payment.returned_cents, payment.currency)} of this was refunded</p>
          )}
          {refundable.length > 0 && (
            <div><button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onRequestRefund(refundable)}>Request a refund</button></div>
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
