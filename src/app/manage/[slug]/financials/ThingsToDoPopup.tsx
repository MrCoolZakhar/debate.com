'use client';

// ThingsToDoPopup — the organizer's money queue, ONE ITEM AT A TIME (1 Oct 2026).
// money_things_to_do gives proofs waiting for review and open money_todos;
// proofs come first, then todos, each oldest first. After an action lands the
// pop-up moves on by itself; Skip moves on and leaves the item for later. Every
// landed action fires 'gv-financials-todo-changed' so the rail badge re-reads,
// and closing re-reads the dashboard (the page does that in onClose).

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, Landmark } from 'lucide-react';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import {
  cents, closeMoneyTodo, recordRefundDifference, refundDifferenceByCard, uploadRefundProof, proofFileProblem, type ManualMethod, matchStripeRefund, notifyMoneyTodoChanged, readThingsToDo, reviewProof, signedProofUrl,
  type ProofThing, type RefundItem, type TodoThing,
} from './financialsApi';
import { READ_ONLY_LINE, Row, formatDate } from './dashboardKit';
import RefundDialog from './RefundDialog';

type Thing = { type: 'proof'; key: string; p: ProofThing } | { type: 'todo'; key: string; t: TodoThing };

const REASON_MAX = 500;

export default function ThingsToDoPopup({ conferenceId, readOnly, onClose }: {
  conferenceId: string; readOnly: boolean; onClose: () => void;
}) {
  const [queue, setQueue] = useState<Thing[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [refund, setRefund] = useState<{ items: RefundItem[]; currency: string; todoId: string } | null>(null);

  useEffect(() => {
    let alive = true;
    readThingsToDo(conferenceId).then(r => {
      if (!alive) return;
      const byDate = <T,>(a: T[], at: (x: T) => string) => [...a].sort((x, y) => at(x).localeCompare(at(y)));
      setQueue([
        ...byDate(r.proofs, p => p.uploaded_at ?? '').map(p => ({ type: 'proof' as const, key: `p:${p.batch_id}`, p })),
        ...byDate(r.todos, t => t.created_at ?? '').map(t => ({ type: 'todo' as const, key: `t:${t.id}`, t })),
      ]);
      setLoadErr('');
    }).catch(e => {
      if (alive) setLoadErr(friendlyError(e, 'Your things to do could not be read. Try again in a moment.'));
    });
    return () => { alive = false; };
  }, [conferenceId, attempt]);

  const done = () => { notifyMoneyTodoChanged(); setIndex(i => i + 1); };
  const skip = () => { setSkipped(n => n + 1); setIndex(i => i + 1); };

  const current = queue && index < queue.length ? queue[index] : null;

  return (
    <>
      <PurchaseShell tone="light" label="Things to do" onClose={onClose} panelClass="gv-fd-wide" testId="financials-todo">
        <div className="gv-fd-pop">
          {queue && current && (
            <p className="gv-fd-sect" aria-live="polite" style={{ margin: 0 }}>{index + 1} of {queue.length}</p>
          )}
          {!queue && !loadErr && <p className="gv-st-quiet" aria-live="polite">Reading your things to do</p>}
          {loadErr && (
            <p className="gv-st-err" role="alert">
              {loadErr} <button type="button" className="gv-st-link" onClick={() => { setLoadErr(''); setAttempt(a => a + 1); }}>Try again</button>
            </p>
          )}
          {queue && !current && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, padding: '24px 0 8px' }}>
              <span className="gv-fd-clear-disc" aria-hidden><CheckCircle2 size={24} strokeWidth={2.2} /></span>
              <h2 className="gv-fd-pop-title">
                {queue.length === 0 ? 'You\'re all caught up' : 'You\'ve cleared your things to do'}
              </h2>
              {skipped > 0 && (
                <p className="gv-fd-note">{skipped} skipped for later. They stay on your list</p>
              )}
              <button type="button" className="gv-st-btn gv-st-forest" onClick={onClose}>Close</button>
            </div>
          )}
          {current && (
            <div key={current.key}>
              {current.type === 'proof'
                ? <ProofStep p={current.p} readOnly={readOnly} onDone={done} onSkip={skip} />
                : <TodoStep t={current.t} conferenceId={conferenceId} readOnly={readOnly} onDone={done} onSkip={skip}
                    onRefund={(items) => setRefund({ items, currency: current.t.currency ?? 'USD', todoId: current.t.id })} />}
            </div>
          )}
        </div>
      </PurchaseShell>
      {refund && (
        <RefundDialog
          items={refund.items}
          currency={refund.currency}
          conferenceId={conferenceId}
          todoId={refund.todoId}
          onClose={() => setRefund(null)}
          onDone={() => { setRefund(null); done(); }}
        />
      )}
    </>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function Actions({ children, readOnly, onSkip }: { children?: React.ReactNode; readOnly: boolean; onSkip: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
      {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {!readOnly && children}
        <button type="button" className="gv-st-link" onClick={onSkip}>{readOnly ? 'Next' : 'Skip'}</button>
      </div>
    </div>
  );
}

/** A reason field that opens in place: the label, 500 characters, the field error under it. */
function ReasonField({ id, label, value, onChange, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <label className="gv-fd-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="gv-fd-text" maxLength={REASON_MAX} value={value} onChange={e => onChange(e.target.value)} autoFocus aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      <p className="gv-fd-count">{value.length} / {REASON_MAX}</p>
      {error && <p id={`${id}-err`} className="gv-st-err" role="alert" style={{ marginTop: 2 }}>{error}</p>}
    </div>
  );
}

function useBusy() {
  const ref = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (ref.current) return;
    ref.current = true;
    setBusy(true);
    try { await fn(); } finally { ref.current = false; setBusy(false); }
  };
  return { busy, run };
}

function Who({ name, email, extra }: { name: string | null; email?: string | null; extra?: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{name || 'Someone'}</p>
      {email && <p className="gv-fd-note" style={{ overflowWrap: 'anywhere' }}>{email}</p>}
      {extra}
    </div>
  );
}

function PaidBy({ card }: { card: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {card ? <CreditCard size={13} strokeWidth={2.2} aria-hidden /> : <Landmark size={13} strokeWidth={2.2} aria-hidden />}
      {card ? 'Paid by card' : 'Paid manually'}
    </span>
  );
}

// ── 1. A proof ─────────────────────────────────────────────────────────────

function ProofStep({ p, readOnly, onDone, onSkip }: { p: ProofThing; readOnly: boolean; onDone: () => void; onSkip: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [urlFailed, setUrlFailed] = useState(false);
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState('');
  const { busy, run } = useBusy();

  useEffect(() => {
    let alive = true;
    if (!p.proof_path) return;
    signedProofUrl(p.proof_path).then(u => {
      if (!alive) return;
      if (u) setUrl(u); else setUrlFailed(true);
    });
    return () => { alive = false; };
  }, [p.proof_path]);

  const accept = () => run(async () => {
    setErr('');
    const r = await reviewProof(p.batch_id, true);
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  });
  const deny = () => run(async () => {
    setErr(''); setFieldErr('');
    const r = await reviewProof(p.batch_id, false, reason.trim());
    if (!r.ok) {
      if (r.field === 'reason') setFieldErr(r.error); else setErr(r.error);
      return;
    }
    onDone();
  });

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div style={{ position: 'relative', height: 'min(560px, calc(100dvh - 220px))', minHeight: 320, borderRadius: 16, background: '#FFFFFF', overflow: 'hidden' }}>
          {!p.proof_path || urlFailed ? (
            <p className="gv-fd-note" style={{ padding: 20 }}>{!p.proof_path ? 'No file was attached to this payment.' : 'The proof could not be opened. Try again in a moment.'}</p>
          ) : !url ? (
            <div className="gv-fd-ph" style={{ position: 'absolute', inset: 0, boxShadow: 'none' }} aria-label="Opening the proof" />
          ) : p.proof_is_pdf ? (
            <PdfViewer url={url} title={`Payment proof from ${p.payer_name ?? 'the payer'}`} zoom={zoom} onZoomChange={setZoom} compact className="absolute inset-0" />
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size" style={{ position: 'absolute', inset: 0, display: 'block', background: '#F3EEE2' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Payment proof from ${p.payer_name ?? 'the payer'}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <span style={{ position: 'absolute', right: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: 700 }}>
                <ExternalLink size={13} strokeWidth={2.4} aria-hidden /> Open full size
              </span>
            </a>
          )}
        </div>

        <div>
          <Who name={p.payer_name} email={p.payer_email} extra={p.delegation ? <p className="gv-fd-note" style={{ overflowWrap: 'anywhere' }}>{p.delegation}</p> : null} />
          <p className="gv-fd-note" style={{ marginTop: 8 }}>
            Sent {formatDate(p.uploaded_at)}
            {p.replaced_count > 0 ? ` · Replaced ${p.replaced_count} time${p.replaced_count === 1 ? '' : 's'}` : ''}
          </p>
          <div className="gv-fd-rows" style={{ marginTop: 14 }}>
            {(p.items ?? []).map(i => (
              <Row key={i.invoice_id} label={i.label} sub={i.for_name ? `For ${i.for_name}` : undefined} amount={cents(i.amount_cents, p.currency)} />
            ))}
            <Row label="Total" amount={cents(p.total_cents, p.currency)} total />
          </div>

          {denying && !readOnly && (
            <ReasonField id={`gv-fd-deny-${p.batch_id}`} label="Why can't you accept it? The payer reads this" value={reason} onChange={v => { setReason(v); setFieldErr(''); }} error={fieldErr} />
          )}
          {err && <p className="gv-st-err" role="alert">{err}</p>}

          <Actions readOnly={readOnly} onSkip={onSkip}>
            {denying ? (
              <>
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void deny(); }} disabled={busy || !reason.trim()}>{busy ? 'Denying' : 'Deny proof'}</button>
                <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setDenying(false); setFieldErr(''); }} disabled={busy}>Back</button>
              </>
            ) : (
              <>
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void accept(); }} disabled={busy}>{busy ? 'Accepting' : 'Accept'}</button>
                <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setDenying(true); setErr(''); }} disabled={busy}>Deny</button>
              </>
            )}
          </Actions>
        </div>
      </div>
    </div>
  );
}

// ── 2 to 6. Todos ──────────────────────────────────────────────────────────

const DISPUTE_STATUS: Record<string, string> = {
  warning_needs_response: 'Waiting for your answer',
  needs_response: 'Waiting for your answer',
  warning_under_review: 'Stripe is reviewing it',
  under_review: 'Stripe is reviewing it',
  warning_closed: 'Closed',
  won: 'You won it',
  lost: 'You lost it',
};
const DISPUTE_REASON: Record<string, string> = {
  fraudulent: 'They say they did not make this payment',
  duplicate: 'They say they were charged twice',
  product_not_received: 'They say they did not get what they paid for',
  product_unacceptable: 'They say it was not what was described',
  credit_not_processed: 'They say a refund they were promised never arrived',
  subscription_canceled: 'They say they had cancelled',
  unrecognized: 'They do not recognise the payment',
  general: 'No reason given',
};

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

function TodoStep({ t, conferenceId, readOnly, onDone, onSkip, onRefund }: {
  t: TodoThing; conferenceId: string; readOnly: boolean; onDone: () => void; onSkip: () => void; onRefund: (items: RefundItem[]) => void;
}) {
  const cur = t.currency ?? 'USD';
  const [mode, setMode] = useState<'none' | 'decline' | 'sorted'>('none');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const { busy, run } = useBusy();

  const items = t.items ?? [];
  const cardItems = t.card_items ?? [];
  const refundable: RefundItem[] = items
    .filter(i => (i.paid_cents ?? 0) > 0)
    .map(i => ({ invoice_id: i.invoice_id, label: i.label, amount_cents: i.paid_cents, paid_by_card: i.paid_by_card }));
  const tickedTotal = cardItems.filter(i => ticked.has(i.invoice_id)).reduce((s, i) => s + (i.net_cents || 0), 0);

  const close = (outcome: 'done' | 'dismissed') => run(async () => {
    setErr('');
    const r = await closeMoneyTodo(t.id, outcome, text);
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  });
  const match = () => run(async () => {
    setErr('');
    const r = await matchStripeRefund(t.id, [...ticked]);
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  });

  const itemRows = items.map(i => (
    <Row key={i.invoice_id} label={i.label} sub={undefined} amount={cents(i.paid_cents > 0 ? i.paid_cents : i.amount_cents, cur)} />
  ));
  const itemRowsWithPay = items.map(i => (
    <div key={i.invoice_id} className="gv-fd-row">
      <span className="gv-fd-row-label">{i.label}<small><PaidBy card={i.paid_by_card} /></small></span>
      <span className="gv-fd-row-amt">{cents(i.paid_cents > 0 ? i.paid_cents : i.amount_cents, cur)}</span>
    </div>
  ));
  const cardRows = cardItems.map(i => (
    <Row key={i.invoice_id} label={i.label} sub={i.for_name ? `For ${i.for_name}` : undefined} amount={cents(i.net_cents, cur)} />
  ));

  const sortedButton = (
    mode === 'sorted' ? (
      <>
        <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void close('done'); }} disabled={busy}>{busy ? 'Saving' : 'Mark as sorted'}</button>
        <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setMode('none')} disabled={busy}>Back</button>
      </>
    ) : (
      <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setMode('sorted'); setText(''); }}>Mark as sorted</button>
    )
  );

  const body = (() => {
    switch (t.kind) {
      case 'refund_request':
        return (
          <>
            <p className="gv-fd-sect">Refund request</p>
            <Who name={t.person_name} email={t.person_email} />
            {t.note && <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>&ldquo;{t.note}&rdquo;</p>}
            <div className="gv-fd-rows" style={{ marginTop: 14 }}>{itemRowsWithPay}</div>
            {mode === 'decline' && !readOnly && (
              <ReasonField id={`gv-fd-decline-${t.id}`} label="Tell them why. They receive this by email" value={text} onChange={v => { setText(v); setErr(''); }} />
            )}
            {err && <p className="gv-st-err" role="alert">{err}</p>}
            <Actions readOnly={readOnly} onSkip={onSkip}>
              {mode === 'decline' ? (
                <>
                  <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void close('dismissed'); }} disabled={busy || !text.trim()}>{busy ? 'Declining' : 'Decline refund'}</button>
                  <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setMode('none')} disabled={busy}>Back</button>
                </>
              ) : (
                <>
                  <button type="button" className="gv-st-btn gv-st-forest" onClick={() => onRefund(refundable)} disabled={refundable.length === 0}>Refund</button>
                  <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setMode('decline'); setText(''); }}>Decline</button>
                </>
              )}
            </Actions>
          </>
        );

      case 'refund_not_received':
        return (
          <>
            <p className="gv-fd-sect">Refund not received</p>
            <Who name={t.person_name} email={t.person_email} />
            <p className="gv-fd-note" style={{ marginTop: 10 }}>They say a refund you recorded has not reached them</p>
            {t.note && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>&ldquo;{t.note}&rdquo;</p>}
            <div className="gv-fd-rows" style={{ marginTop: 14 }}>{itemRows}</div>
            {mode === 'sorted' && !readOnly && (
              <ReasonField id={`gv-fd-sorted-${t.id}`} label="Note (optional)" value={text} onChange={setText} />
            )}
            {err && <p className="gv-st-err" role="alert">{err}</p>}
            <Actions readOnly={readOnly} onSkip={onSkip}>{sortedButton}</Actions>
          </>
        );

      case 'stripe_refund_to_match': {
        const target = t.amount_cents ?? 0;
        return (
          <>
            <p className="gv-fd-sect">Refund to match</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>
              A refund of {cents(target, cur)} was made in your Stripe dashboard. Tick the items it was for
            </p>
            {t.person_name && <p className="gv-fd-note" style={{ marginTop: 6 }}>Paid by {t.person_name}</p>}
            <div className="gv-fd-rows" style={{ marginTop: 14 }}>
              {cardItems.length === 0 ? (
                <p className="gv-fd-note" style={{ padding: '10px 0' }}>No items from that card payment could be found</p>
              ) : cardItems.map(i => (
                <label key={i.invoice_id} className="gv-fd-check">
                  <input
                    type="checkbox"
                    checked={ticked.has(i.invoice_id)}
                    disabled={readOnly || busy}
                    onChange={e => {
                      const next = new Set(ticked);
                      if (e.target.checked) next.add(i.invoice_id); else next.delete(i.invoice_id);
                      setTicked(next);
                      setErr('');
                    }}
                  />
                  <span className="gv-fd-row-label" style={{ flex: 1 }}>
                    {i.label}{i.for_name ? <small style={{ display: 'block', fontSize: 12.5, color: '#5A5046' }}>For {i.for_name}</small> : null}
                  </span>
                  <span className="gv-fd-row-amt">{cents(i.net_cents, cur)}</span>
                </label>
              ))}
            </div>
            <p className="gv-fd-note" style={{ marginTop: 10, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
              Ticked {cents(tickedTotal, cur)} of {cents(target, cur)}
            </p>
            {err && <p className="gv-st-err" role="alert">{err}</p>}
            <Actions readOnly={readOnly} onSkip={onSkip}>
              <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { void match(); }} disabled={busy || ticked.size === 0 || tickedTotal !== target}>{busy ? 'Matching' : 'Match'}</button>
            </Actions>
          </>
        );
      }

      case 'dispute': {
        const status = DISPUTE_STATUS[str(t.payload?.status)] ?? 'Open';
        const reason = DISPUTE_REASON[str(t.payload?.reason)] ?? 'Another reason';
        return (
          <>
            <p className="gv-fd-sect">Dispute</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
              {t.person_name || 'A payer'} disputed a card payment of {cents(t.amount_cents ?? 0, cur)}
            </p>
            <div className="gv-fd-rows" style={{ marginTop: 14 }}>
              <Row label="Status" amount={status} />
              <Row label="Their reason" amount={reason} />
            </div>
            {cardRows.length > 0 && (
              <>
                <p className="gv-fd-sect" style={{ marginTop: 14 }}>The payment covered</p>
                <div className="gv-fd-rows">{cardRows}</div>
              </>
            )}
            <p className="gv-fd-note" style={{ marginTop: 12 }}>Stripe decides disputes. Answer it in your Stripe dashboard. If you lose, these items go back to owed</p>
            <Actions readOnly={false} onSkip={onSkip} />
          </>
        );
      }

      case 'refund_due':
      default:
        return (
          <>
            <p className="gv-fd-sect">Refund due</p>
            <Who name={t.person_name} email={t.person_email} />
            <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 700 }}>
              They moved to a cheaper ticket. {cents(Math.abs(t.amount_cents ?? 0), cur)} is due back to them
            </p>
            {t.note && <p className="gv-fd-note" style={{ marginTop: 8, overflowWrap: 'anywhere' }}>{t.note}</p>}
            {items.length > 0 && <div className="gv-fd-rows" style={{ marginTop: 14 }}>{itemRowsWithPay}</div>}
            {mode !== 'sorted' && !readOnly && (
              <RefundDifference
                todoId={t.id}
                conferenceId={conferenceId}
                amountLabel={cents(Math.abs(t.amount_cents ?? 0), cur)}
                byCard={items.some(i => i.paid_by_card)}
                onDone={onDone}
              />
            )}
            {mode === 'sorted' && !readOnly && (
              <ReasonField id={`gv-fd-due-${t.id}`} label="Note (optional)" value={text} onChange={setText} />
            )}
            {err && <p className="gv-st-err" role="alert">{err}</p>}
            <Actions readOnly={readOnly} onSkip={onSkip}>{sortedButton}</Actions>
          </>
        );
    }
  })();

  return <div style={{ maxWidth: 640 }}>{body}</div>;
}

// ── Refund the difference (prompt 94) ──────────────────────────────────────
// A move to a cheaper ticket: only the difference goes back, the ticket stays
// paid at the new price, the payer is emailed and the to-do closes, all on
// the server. By card it goes through refund-items; any other way, the
// organizer sends it themselves and records it here.

const DIFF_METHODS: { v: ManualMethod; label: string }[] = [
  { v: 'bank_transfer', label: 'Bank transfer' },
  { v: 'cash', label: 'Cash' },
  { v: 'other', label: 'Other' },
];

function RefundDifference({ todoId, conferenceId, amountLabel, byCard, onDone }: {
  todoId: string; conferenceId: string; amountLabel: string; byCard: boolean; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ManualMethod | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [askNoProof, setAskNoProof] = useState(false);
  const [err, setErr] = useState('');
  const [methodErr, setMethodErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { busy, run } = useBusy();

  const go = (anyway: boolean) => run(async () => {
    setErr('');
    if (byCard) {
      const r = await refundDifferenceByCard(todoId);
      if (!r.ok) { setErr(r.error); return; }
      notifyOk(`${amountLabel} is on its way back to their card`, 'financials');
      onDone();
      return;
    }
    if (!method) { setMethodErr('Choose how you sent the money back.'); return; }
    if (!file && !anyway) { setAskNoProof(true); return; }
    let path: string | null = null;
    if (file) {
      const up = await uploadRefundProof(conferenceId, file);
      if ('error' in up) { setErr(up.error); return; }
      path = up.path;
    }
    const r = await recordRefundDifference(todoId, method, path, note);
    if (!r.ok) {
      if (r.field === 'method') setMethodErr(r.error); else setErr(r.error);
      setAskNoProof(false);
      return;
    }
    notifyOk(`Refund of ${amountLabel} recorded`, 'financials');
    onDone();
  });

  if (!open) {
    return (
      <div style={{ marginTop: 16 }}>
        <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setOpen(true)}>
          Refund the difference ({amountLabel})
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {byCard ? (
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>This sends {amountLabel} back to their card through Stripe</p>
      ) : (
        <>
          <p className="gv-fd-note">Send {amountLabel} back yourself first, then record it here</p>
          <div>
            <span className="gv-fd-label" id={`gv-rd-how-${todoId}`}>How did you send it?</span>
            <div className="gv-fd-seg" role="radiogroup" aria-labelledby={`gv-rd-how-${todoId}`}>
              {DIFF_METHODS.map(m => (
                <button key={m.v} type="button" role="radio" aria-checked={method === m.v} disabled={busy}
                  onClick={() => { setMethod(m.v); setMethodErr(''); }}>{m.label}</button>
              ))}
            </div>
            {methodErr && <p className="gv-st-err" role="alert">{methodErr}</p>}
          </div>
          <div>
            <span className="gv-fd-label">Proof of the refund (optional)</span>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                if (!f) { setFile(null); return; }
                const problem = proofFileProblem(f);
                if (problem) { setErr(problem); return; }
                setErr(''); setFile(f); setAskNoProof(false);
              }} />
            {file ? (
              <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</span>
                <button type="button" className="gv-st-link" disabled={busy} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>
              </div>
            ) : (
              <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => fileRef.current?.click()}>Attach a file</button>
            )}
          </div>
          <div>
            <label className="gv-fd-label" htmlFor={`gv-rd-note-${todoId}`}>Note (optional)</label>
            <textarea id={`gv-rd-note-${todoId}`} className="gv-fd-text" style={{ minHeight: 64 }} maxLength={500} value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
          </div>
          {askNoProof && !file && (
            <p className="gv-fd-warn" role="alert">No proof attached. Record the refund anyway?</p>
          )}
        </>
      )}
      {err && <p className="gv-st-err" role="alert">{err}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" className="gv-st-btn gv-st-forest" disabled={busy} onClick={() => { void go(askNoProof); }}>
          {busy ? 'Refunding' : byCard ? `Refund ${amountLabel}` : askNoProof && !file ? 'Record without proof' : 'Record refund'}
        </button>
        <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => { setOpen(false); setAskNoProof(false); setErr(''); }}>Back</button>
      </div>
    </div>
  );
}
