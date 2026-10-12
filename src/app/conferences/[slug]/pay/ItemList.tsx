'use client';

// ItemList — the payer's own items, one line each (prompt 95; since prompt 101
// my_pay_overview returns only items on the payer's own applications, and the
// page draws one list per tab). Each line says its state in words with an
// icon; an item that can be paid now has a checkbox (whole items only), one
// the payer added themselves (a delegate or advisor ticket, an add-on) has an
// X to remove it. Nothing says owed once the money has arrived.

import { useEffect, useId, useRef, useState } from 'react';
import {
  Ban, CircleCheck, Clock, ExternalLink, Gift, HandCoins, Hourglass, Lock, MoreHorizontal, RotateCcw, ShieldAlert, Undo2, X, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DANGER, DEEP_GOLD, GREEN, INK_SOFT } from './payKit';
import { money, shortDate, type PayItem } from './payApi';

export const PAYABLE_STATES = new Set(['unpaid', 'rejected', 'refunded']);

export function canTick(it: PayItem, locked?: Record<string, unknown>): boolean {
  return it.payable && PAYABLE_STATES.has(it.state) && it.due_cents > 0 && !(locked && locked[it.invoice_id]);
}

export function refundVia(method: string | null | undefined): string {
  if (!method || method === 'stripe' || method === 'card') return 'card';
  if (method === 'bank_transfer') return 'bank transfer';
  if (method === 'cash') return 'cash';
  return 'other';
}

function stateLine(it: PayItem): { icon: LucideIcon; text: string; color: string } | null {
  switch (it.state) {
    case 'unpaid': return null;
    case 'started': return { icon: Lock, text: 'In a started payment', color: DEEP_GOLD };
    case 'in_review': return { icon: Hourglass, text: 'Waiting for the organizer to review', color: DEEP_GOLD };
    case 'paid': return { icon: CircleCheck, text: 'Paid', color: GREEN };
    case 'rejected': return { icon: XCircle, text: 'Proof not accepted', color: DANGER };
    case 'refunded': return { icon: Undo2, text: it.refund?.at ? `Refunded on ${shortDate(it.refund.at)} via ${refundVia(it.refund.method)}` : 'Refunded', color: INK_SOFT };
    case 'disputed': return { icon: ShieldAlert, text: 'Your card company is looking into this payment. The organizers will be in touch', color: DANGER };
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

/**
 * A waived or covered ticket (prompt 102): its real name and price, faded,
 * under a small WAIVED or COVERED banner. The line is a button so the note on
 * who took it off opens by hover, keyboard focus or a tap alike.
 */
function NotChargedLine({ it }: { it: PayItem }) {
  const nc = it.not_charged!;
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const word = nc.by === 'delegation' ? 'COVERED' : 'WAIVED';
  const note = nc.by === 'delegation' ? 'This ticket is covered by your delegation' : 'This ticket was waived by the organizers';
  return (
    <div className="gv-pay-item" role="listitem" style={{ position: 'relative' }}>
      <button
        type="button"
        aria-describedby={tipId}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{ gridColumn: '1 / -1', position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '6px 12px 6px 50px', border: 'none', background: 'none', cursor: 'default', fontFamily: 'inherit', color: 'inherit', textAlign: 'left' }}
      >
        <span style={{ flex: 1, minWidth: 0, opacity: 0.45, fontSize: 15.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{nc.label}</span>
        <span style={{ opacity: 0.45, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(nc.cents, it.currency)}</span>
        <span aria-hidden style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-4deg)',
          padding: '2px 12px', borderRadius: 6, border: `1.5px solid ${GREEN}`, background: 'rgba(255,255,255,0.85)',
          color: GREEN, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.16em',
        }}>{word}</span>
      </button>
      <span id={tipId} role="tooltip" style={{
        position: 'absolute', left: '50%', bottom: 'calc(100% - 6px)', transform: 'translateX(-50%)', zIndex: 5,
        padding: '7px 11px', borderRadius: 10, background: '#1C1410', color: '#FFFFFF', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        boxShadow: '0 8px 20px -10px rgba(0,0,0,0.5)', opacity: open ? 1 : 0, pointerEvents: 'none', transition: 'opacity 140ms ease',
      }}>{note}</span>
    </div>
  );
}

export default function ItemList({ items, selected, onToggle, onReceipt, onRemove, below, locked, onLock, onRequestRefund, onNotReceived, onViewProof }: {
  items: PayItem[];
  /** Items held by a started payment (my_started_payments.locked). */
  locked?: Record<string, { batch_id: string; status: string; mine: boolean }>;
  onLock?: (invoiceId: string) => void;
  onRequestRefund?: (it: PayItem) => void;
  onNotReceived?: (it: PayItem) => void;
  onViewProof?: (path: string) => void;
  selected: Set<string>;
  onToggle: (it: PayItem) => void;
  onReceipt: (paymentKey: string) => void;
  /** Removes one item; resolves with the sentence to show when it could not. */
  onRemove: (it: PayItem) => Promise<string | null>;
  /** Anything drawn under one line (the voucher panel under the person's own ticket). */
  below?: (it: PayItem) => React.ReactNode;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const menuWrapRef = useRef<HTMLSpanElement | null>(null);

  // The row menu closes on a press anywhere outside it and on Escape (focus
  // goes back to its trigger), not only by tapping the trigger again.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (menuWrapRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      menuWrapRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
      setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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
        if ((it.state === 'waived' || it.state === 'covered') && it.not_charged) return <NotChargedLine key={it.invoice_id} it={it} />;
        const lock = locked?.[it.invoice_id];
        const tick = canTick(it, locked);
        const st = lock && it.state !== 'in_review' && it.state !== 'paid'
          ? { icon: Lock, text: 'In a started payment', color: DEEP_GOLD }
          : stateLine(it);
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
              {st && Icon && (st.text === 'In a started payment' && onLock ? (
                <button type="button" className="gv-pay-state" onClick={() => onLock(it.invoice_id)}
                  style={{ color: st.color, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  <Icon size={15} strokeWidth={2.4} aria-hidden /> {st.text}
                </button>
              ) : (
                <p className="gv-pay-state" style={{ color: st.color }}>
                  <Icon size={15} strokeWidth={2.4} aria-hidden /> {st.text}
                  {it.state === 'paid' && it.payment_key && (
                    <button type="button" className="gv-pay-link" style={{ marginLeft: 8, fontSize: 13 }} onClick={() => onReceipt(it.payment_key!)}>
                      Receipt
                    </button>
                  )}
                </p>
              ))}
              {it.state === 'refunded' && it.refund && (
                <>
                  {it.refund.note && <p className="gv-pay-sub">{it.refund.note}</p>}
                  <p className="gv-pay-sub" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {it.refund.proof_path && onViewProof && (
                      <button type="button" className="gv-pay-link" style={{ fontSize: 13 }} onClick={() => onViewProof(it.refund!.proof_path!)}>
                        <ExternalLink size={13} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> View proof
                      </button>
                    )}
                    {refundVia(it.refund.method) !== 'card' && (it.not_received_reported
                      ? <span>You told the organizers you haven&apos;t received it</span>
                      : onNotReceived && <button type="button" className="gv-pay-link" style={{ fontSize: 13 }} onClick={() => onNotReceived(it)}>I haven&apos;t received it</button>)}
                  </p>
                </>
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
            <span style={{ position: 'relative' }} ref={menu === it.invoice_id ? menuWrapRef : undefined}>
              {it.state === 'paid' && it.can_request_refund && onRequestRefund && (
                <>
                  <button type="button" className="gv-pay-x" aria-label={`More for ${it.label}`} aria-expanded={menu === it.invoice_id}
                    onClick={() => setMenu(menu === it.invoice_id ? null : it.invoice_id)}>
                    <MoreHorizontal size={18} strokeWidth={2.4} />
                  </button>
                  {menu === it.invoice_id && (
                    <span role="menu" style={{ position: 'absolute', right: 0, top: 46, zIndex: 20, minWidth: 190, padding: 6, borderRadius: 12, background: '#FFFFFF', boxShadow: '0 12px 30px -10px rgba(27,56,40,0.45), 0 0 0 1px rgba(27,56,40,0.08)' }}>
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); onRequestRefund(it); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#1C1410' }}>
                        Request a refund
                      </button>
                    </span>
                  )}
                </>
              )}
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
