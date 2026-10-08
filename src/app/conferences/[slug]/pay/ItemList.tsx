'use client';

// ItemList — every item this person pays, one line each (prompt 95). Each line
// says its state in words with an icon; an item that can be paid now has a
// checkbox (whole items only), one the person added themselves (a delegate or
// advisor ticket, an add-on) has an X to remove it. Nothing says owed once the
// money has arrived.

import { useRef, useState } from 'react';
import {
  Ban, CircleCheck, Clock, Gift, HandCoins, Hourglass, Lock, RotateCcw, ShieldAlert, Undo2, X, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DANGER, DEEP_GOLD, GREEN, INK_SOFT } from './payKit';
import { money, shortDate, type PayItem } from './payApi';

export const PAYABLE_STATES = new Set(['unpaid', 'rejected', 'refunded']);

export function canTick(it: PayItem): boolean {
  return it.payable && PAYABLE_STATES.has(it.state) && it.due_cents > 0;
}

function stateLine(it: PayItem): { icon: LucideIcon; text: string; color: string; title?: string } | null {
  switch (it.state) {
    case 'unpaid': return null;
    case 'started': return { icon: Lock, text: 'Waiting for your proof', color: DEEP_GOLD, title: 'You started paying this. Upload your proof to finish' };
    case 'in_review': return { icon: Hourglass, text: 'Waiting for the organizer to review', color: DEEP_GOLD };
    case 'paid': return { icon: CircleCheck, text: 'Paid', color: GREEN };
    case 'rejected': return { icon: XCircle, text: 'Proof not accepted', color: DANGER };
    case 'refunded': return { icon: Undo2, text: it.refund?.at ? `Refunded on ${shortDate(it.refund.at)}` : 'Refunded', color: INK_SOFT };
    case 'disputed': return { icon: ShieldAlert, text: 'Disputed with your card company', color: DANGER };
    case 'refund_requested': return { icon: RotateCcw, text: 'Refund requested', color: INK_SOFT };
    case 'covered': return { icon: Gift, text: 'Covered by your delegation', color: GREEN };
    case 'waived': return { icon: Ban, text: 'Fee waived', color: GREEN };
    default: return null;
  }
}

/** What the amount column says for this line, or nothing. */
function amountFor(it: PayItem): string | null {
  if (it.state === 'covered' || it.state === 'waived') return null;
  if (it.state === 'paid' || it.state === 'disputed' || it.state === 'refund_requested') return money(it.paid_cents || it.amount_cents, it.currency);
  if (it.state === 'in_review' || it.state === 'started') return money(it.due_cents || it.amount_cents, it.currency);
  return money(it.due_cents, it.currency);
}

export default function ItemList({ items, selected, onToggle, onReceipt, onRemove, below }: {
  items: PayItem[];
  selected: Set<string>;
  onToggle: (it: PayItem) => void;
  onReceipt: (paymentKey: string) => void;
  /** Removes one item; resolves with the sentence to show when it could not. */
  onRemove: (it: PayItem) => Promise<string | null>;
  /** Anything drawn under one line (the voucher panel under the person's own ticket). */
  below?: (it: PayItem) => React.ReactNode;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  if (items.length === 0) {
    return (
      <div className="gv-pay-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nothing to pay right now</p>
      </div>
    );
  }

  const remove = async (it: PayItem) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr('');
    const problem = await onRemove(it);
    busyRef.current = false; setBusy(false);
    if (problem) { setErr(problem); return; }
    setConfirming(null);
  };

  return (
    <div className="gv-pay-items" role="list" aria-label="Your items">
      {items.map(it => {
        const tick = canTick(it);
        const st = stateLine(it);
        const amt = amountFor(it);
        const Icon = st?.icon;
        const isConfirming = confirming === it.invoice_id;
        return (
          <div key={it.invoice_id} className="gv-pay-item" role="listitem" data-selected={selected.has(it.invoice_id) || undefined}>
            <span className="gv-pay-tick">
              {tick && (
                <input type="checkbox" checked={selected.has(it.invoice_id)} onChange={() => onToggle(it)}
                  aria-label={`Select ${it.label} to pay`} />
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="gv-pay-name">{it.label}</p>
              {it.for_name && <p className="gv-pay-for">for {it.for_name}</p>}
              {st && Icon && (
                <p className="gv-pay-state" style={{ color: st.color }} title={st.title}>
                  <Icon size={15} strokeWidth={2.4} aria-hidden /> {st.text}
                  {it.state === 'paid' && it.payment_key && (
                    <button type="button" className="gv-pay-link" style={{ marginLeft: 8, fontSize: 13 }} onClick={() => onReceipt(it.payment_key!)}>
                      Receipt
                    </button>
                  )}
                </p>
              )}
              {it.state === 'rejected' && it.rejected?.reason && (
                <p className="gv-pay-sub">{it.rejected.reason}</p>
              )}
              {it.aid_cents > 0 && (
                <p className="gv-pay-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HandCoins size={14} strokeWidth={2.2} aria-hidden /> Financial aid {money(it.aid_cents, it.currency)} applied
                </p>
              )}
              {it.state === 'unpaid' && !it.payable && (
                <p className="gv-pay-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} strokeWidth={2.2} aria-hidden /> You can pay this once your application is accepted
                </p>
              )}
              {below?.(it)}
            </div>
            <span className="gv-pay-amt" style={{ color: it.state === 'paid' ? GREEN : undefined }}>{amt}</span>
            <span>
              {it.removable && (
                <button type="button" className="gv-pay-x" aria-label={`Remove ${it.label}`} title="Remove"
                  onClick={() => { setErr(''); setConfirming(isConfirming ? null : it.invoice_id); }}>
                  <X size={18} strokeWidth={2.4} />
                </button>
              )}
            </span>
            {isConfirming && (
              <div className="gv-pay-confirm" role="alertdialog" aria-label={`Remove ${it.label}`}>
                <p style={{ margin: 0, fontSize: 14.5 }}>Remove {it.label}? You can add it again later</p>
                {err && <p className="gv-pay-err" role="alert">{err}</p>}
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" className="gv-pay-btn gv-pay-forest" style={{ minHeight: 40 }} disabled={busy} onClick={() => { void remove(it); }}>
                    {busy ? 'Removing' : 'Remove'}
                  </button>
                  <button type="button" className="gv-pay-btn gv-pay-outline" style={{ minHeight: 40 }} disabled={busy} onClick={() => setConfirming(null)}>Keep</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
