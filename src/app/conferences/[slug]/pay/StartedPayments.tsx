'use client';

// StartedPayments — a manual conference's started payments on /pay (prompt 96),
// newest first. Each shows its items, total, date and what to do next:
//   awaiting_proof  how long is left, Upload proof, Open payment page, and a red Cancel
//   pending         Waiting for the organizer to review, View proof, Replace proof
//   rejected        Proof not accepted with the organizer's reason, Upload a new proof
// `highlight` scrolls one into view and rings it (from an item's lock).

import { useEffect, useRef, useState } from 'react';
import { Clock, Hourglass, XCircle } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import { DANGER, DEEP_GOLD, INK_SOFT } from './payKit';
import { money, shortDate } from './payApi';
import { timeLeft, type StartedPayment } from './manualApi';

export default function StartedPayments({ payments, highlight, onUpload, onDetails, onCancel, onViewProof, onReplace, onRestart }: {
  payments: StartedPayment[];
  highlight: string | null;
  onUpload: (p: StartedPayment) => void;
  onDetails: (p: StartedPayment) => void;
  /** Resolves with the sentence to show when it could not be cancelled. */
  onCancel: (p: StartedPayment) => Promise<string | null>;
  onViewProof: (path: string) => void;
  onReplace: (p: StartedPayment) => void;
  onRestart: (p: StartedPayment) => void;
}) {
  const now = useNow(60_000);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!highlight) return;
    refs.current.get(highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  if (payments.length === 0) return null;

  const cancel = async (p: StartedPayment) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr('');
    const problem = await onCancel(p);
    busyRef.current = false; setBusy(false);
    if (problem) { setErr(problem); return; }
    setConfirming(null);
  };

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
                    <button type="button" className="gv-pay-btn gv-pay-outline" onClick={() => onDetails(p)}>Open payment page</button>
                    <button type="button" className="gv-pay-btn" style={{ background: DANGER, color: '#FFFFFF' }}
                      onClick={() => { setErr(''); setConfirming(confirming === p.batch_id ? null : p.batch_id); }}>Cancel</button>
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

              {confirming === p.batch_id && (
                <div className="gv-pay-confirm" role="alertdialog" aria-label="Cancel this payment" style={{ margin: '12px 0 0' }}>
                  <p style={{ margin: 0, fontSize: 14.5 }}>Cancel this payment? The items go back to your list</p>
                  {err && <p className="gv-pay-err" role="alert">{err}</p>}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button type="button" className="gv-pay-btn" style={{ background: DANGER, color: '#FFFFFF', minHeight: 40 }} disabled={busy} onClick={() => { void cancel(p); }}>
                      {busy ? 'Cancelling' : 'Cancel payment'}
                    </button>
                    <button type="button" className="gv-pay-btn gv-pay-outline" style={{ minHeight: 40 }} disabled={busy} onClick={() => setConfirming(null)}>Keep it</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
