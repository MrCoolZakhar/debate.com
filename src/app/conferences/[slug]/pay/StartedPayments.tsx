'use client';

// StartedPayments — a manual conference's started payments on /pay (prompt 96),
// newest first. Each shows its items, total, date and what to do next:
//   awaiting_proof  how long is left, Upload proof, the way to pay by the conference's
//                   manual kind (Open payment page / Open payment QR / View bank
//                   details, prompt 101), and a red Cancel that opens its own pop-up
//   pending         Waiting for the organizer to review, View proof, Replace proof
//   rejected        Proof not accepted with the organizer's reason, Upload a new proof
// `highlight` scrolls one into view and rings it (from an item's lock).

import { useEffect, useRef } from 'react';
import { Clock, Hourglass, XCircle } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import { DANGER, DEEP_GOLD, INK_SOFT } from './payKit';
import { money, shortDate } from './payApi';
import { timeLeft, type StartedPayment } from './manualApi';

export default function StartedPayments({ payments, highlight, wayLabel, onUpload, onOpenWay, onCancel, onViewProof, onReplace, onRestart }: {
  payments: StartedPayment[];
  highlight: string | null;
  /** "Open payment page", "Open payment QR" or "View bank details"; null hides the button. */
  wayLabel: string | null;
  onUpload: (p: StartedPayment) => void;
  /** Runs inside the click, so a payment link can open a new tab. */
  onOpenWay: (p: StartedPayment) => void;
  /** Opens the "Cancel This Payment?" pop-up. */
  onCancel: (p: StartedPayment) => void;
  onViewProof: (path: string) => void;
  onReplace: (p: StartedPayment) => void;
  onRestart: (p: StartedPayment) => void;
}) {
  const now = useNow(60_000);
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!highlight) return;
    refs.current.get(highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  if (payments.length === 0) return null;

  return (
    <section aria-labelledby="gv-pay-started" id="started-payments">
      <p className="gv-pay-sect" id="gv-pay-started">Started Payments</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {payments.map(p => {
          const left = p.status === 'awaiting_proof' ? timeLeft(p.expires_at, now) : null;
          const lit = highlight === p.batch_id;
          return (
            <div
              key={p.batch_id}
              ref={el => { if (el) refs.current.set(p.batch_id, el); else refs.current.delete(p.batch_id); }}
              className="gv-pay-card"
              style={{ padding: '16px 18px', boxShadow: lit ? '0 0 0 3px #EED98A, 0 0 0 4px rgba(182,135,31,0.5), 0 18px 40px -26px rgba(182,135,31,0.6)' : undefined, transition: 'box-shadow 300ms ease' }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div style={{ minWidth: 0 }}>
                  {p.status === 'awaiting_proof' && (
                    <p className="gv-pay-state" style={{ margin: 0, color: DEEP_GOLD }}><Clock size={15} strokeWidth={2.4} aria-hidden /> {left ?? 'Waiting for your proof'}</p>
                  )}
                  {p.status === 'pending' && (
                    <p className="gv-pay-state" style={{ margin: 0, color: DEEP_GOLD }}><Hourglass size={15} strokeWidth={2.4} aria-hidden /> Waiting for the organizer to review</p>
                  )}
                  {p.status === 'rejected' && (
                    <p className="gv-pay-state" style={{ margin: 0, color: DANGER }}><XCircle size={15} strokeWidth={2.4} aria-hidden /> Proof not accepted</p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: INK_SOFT }}>Started {shortDate(p.created_at)}</p>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(p.total_cents, p.currency)}</span>
              </div>

              <div className="gv-pay-rows" style={{ marginTop: 12, background: '#FAF8F3' }}>
                {p.items.map(i => (
                  <div key={i.invoice_id} className="gv-pay-row"><span style={{ overflowWrap: 'anywhere' }}>{i.label}</span><b>{money(i.amount_cents, p.currency)}</b></div>
                ))}
              </div>

              {p.status === 'rejected' && p.review_note && (
                <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{p.review_note}</p>
              )}

              <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 14 }}>
                {p.status === 'awaiting_proof' && (
                  <>
                    <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => onUpload(p)}>Upload proof</button>
                    {wayLabel && <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onOpenWay(p)}>{wayLabel}</button>}
                    <button type="button" className="gv-pay-btn" style={{ background: DANGER, color: '#FFFFFF' }}
                      onClick={() => onCancel(p)}>Cancel</button>
                  </>
                )}
                {p.status === 'pending' && (
                  <>
                    {p.proof_path && <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onViewProof(p.proof_path!)}>View proof</button>}
                    <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onReplace(p)}>Replace proof</button>
                  </>
                )}
                {p.status === 'rejected' && (
                  <button type="button" className="gv-pay-btn gv-pay-forest" onClick={() => onRestart(p)}>Upload a new proof</button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
