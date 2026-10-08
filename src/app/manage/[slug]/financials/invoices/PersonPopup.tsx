'use client';

// PersonPopup — one person's whole money record (prompt 93), read from
// financials_person: what they owe, every payment as a receipt, what was
// waived or covered, every ledger line and the audit history. Every action
// (mark paid, mark unpaid, refund) re-reads this person AND the list behind;
// nothing on screen is patched by hand.

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown, ChevronRight, Clock, CreditCard, ExternalLink, Hourglass, Landmark, Lock, Undo2,
} from 'lucide-react';
import { PurchaseShell } from '@/components/purchase/purchaseKit';
import { friendlyError } from '@/lib/friendlyError';
import { cents, signedProofUrl, type RefundItem } from '../financialsApi';
import { READ_ONLY_LINE, formatDate } from '../dashboardKit';
import MarkPaidDialog from '../MarkPaidDialog';
import MarkUnpaidDialog from '../MarkUnpaidDialog';
import RefundDialog from '../RefundDialog';
import { readPerson, roleWord, type AuditRow, type PersonDetail, type PersonInvoice, type PersonPayment } from './invoicesApi';

const SOFT_GREEN = '#2A5A3C';
const DANGER = '#8B2020';

const AUDIT_WORDS: Record<string, string> = {
  payment_recorded: 'Payment recorded',
  payment_changed: 'Payment changed',
  invoice_created: 'Item added',
  invoice_deleted: 'Item removed',
  application_money_changed: 'Payment status changed',
  pool_changed: 'Delegation tickets changed',
};

function sentence(s: string): string {
  const t = s.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function auditWords(a: AuditRow): string {
  if (a.action === 'invoice_status_changed') {
    const from = str(a.old?.status), to = str(a.new?.status);
    return from && to ? `Status changed from ${from} to ${to}` : 'Status changed';
  }
  if (a.action === 'invoice_amount_changed') {
    const cur = a.currency ?? 'USD';
    const num = (o: Record<string, unknown> | null) => {
      const v = o?.amount_cents ?? o?.amount;
      return typeof v === 'number' ? cents(v, cur) : str(v);
    };
    const from = num(a.old), to = num(a.new);
    return from && to ? `Price changed from ${from} to ${to}` : 'Price changed';
  }
  return AUDIT_WORDS[a.action] ?? sentence(a.action);
}

function methodWords(method: string | null, type: string): string {
  if (method === 'stripe') return type === 'refund' ? 'Card refund' : 'Card';
  if (type === 'manual_proof') return 'Proof';
  if (type === 'refund') return 'Refund';
  if (method === 'manual') return 'Manual';
  return method ? sentence(method) : sentence(type);
}

function howWords(p: PersonPayment): string {
  if (p.how === 'card') return 'Card';
  if (p.how === 'proof') return 'Proof approved';
  return p.by ? `Marked paid by ${p.by}` : 'Marked paid';
}

function waivedReason(i: PersonInvoice): string {
  if (/^covered by/i.test(i.label)) return i.label;
  if (i.aid_cents > 0) return 'Financial aid';
  return 'Fee waived';
}

type Sub =
  | { kind: 'paid'; ids: string[]; total: number; currency: string }
  | { kind: 'unpaid'; ids: string[]; label: string }
  | { kind: 'refund'; items: RefundItem[]; currency: string };

export default function PersonPopup({ applicationId, conferenceId, readOnly, onClose, onChanged }: {
  applicationId: string;
  conferenceId: string;
  readOnly: boolean;
  onClose: () => void;
  /** Re-read the list behind after any landed action. */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [sub, setSub] = useState<Sub | null>(null);
  const [proofErr, setProofErr] = useState('');

  useEffect(() => {
    let alive = true;
    readPerson(applicationId)
      .then(d => { if (!alive) return; setDetail(d); setErr(''); setTicked(new Set()); })
      .catch(e => { if (alive) setErr(friendlyError(e, 'This person could not be read. Try again in a moment.')); });
    return () => { alive = false; };
  }, [applicationId, attempt]);

  const reread = useCallback(() => { setAttempt(a => a + 1); onChanged(); }, [onChanged]);

  const p = detail?.person;
  const invoices = detail?.invoices ?? [];
  const byId = new Map(invoices.map(i => [i.invoice_id, i]));
  const currency = invoices[0]?.currency ?? detail?.payments[0]?.currency ?? 'USD';
  const outstanding = invoices.filter(i => i.status !== 'waived' && (i.due_cents > 0 || i.status === 'open' || i.status === 'partial'));
  const waived = invoices.filter(i => i.status === 'waived' || i.aid_cents > 0);
  const owed = outstanding.reduce((s, i) => s + i.due_cents, 0);
  const returned = (detail?.payments ?? []).reduce((s, x) => s + (x.returned_cents || 0), 0);
  const paid = (detail?.payments ?? []).reduce((s, x) => s + x.total_cents, 0) - returned;
  const tickedLines = outstanding.filter(i => ticked.has(i.invoice_id));
  const tickedTotal = tickedLines.reduce((s, i) => s + i.due_cents, 0);

  const viewProof = async (path: string) => {
    setProofErr('');
    // Open the tab inside the click, then point it at the signed link, so the browser never blocks it.
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    const url = await signedProofUrl(path);
    if (!url) { w?.close(); setProofErr('The proof could not be opened. Try again in a moment.'); return; }
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
  };

  return (
    <>
      <PurchaseShell tone="light" label={p ? `${p.name}: payments` : 'Payments'} onClose={onClose} panelClass="gv-fd-wide" testId="financials-person">
        <div className="gv-fd-pop">
          {!detail && !err && <p className="gv-st-quiet" aria-live="polite">Reading their payments</p>}
          {err && (
            <p className="gv-st-err" role="alert">
              {err} <button type="button" className="gv-st-link" onClick={() => { setErr(''); setAttempt(a => a + 1); }}>Try again</button>
            </p>
          )}
          {detail && p && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between gap-5 flex-wrap" style={{ paddingRight: 40 }}>
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <h2 className="gv-fd-pop-title" style={{ paddingRight: 0, overflowWrap: 'anywhere' }}>{p.name}</h2>
                  {p.email && <p className="gv-fd-note" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{p.email}</p>}
                  <p className="gv-fd-note" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>
                    {[roleWord(p.role), p.delegation].filter(Boolean).join(' · ')}
                    {!p.claimed ? ' · Not claimed yet' : ''}
                  </p>
                </div>
                <div className="flex items-start gap-6 flex-wrap">
                  <Num label="Outstanding" value={owed > 0 ? cents(owed, currency) : 'Nothing owed'} tone={owed > 0 ? 'ink' : 'green'} />
                  <Num label="Paid" value={cents(paid, currency)} tone="forest" />
                  {returned > 0 && <Num label="Refunded" value={cents(returned, currency)} tone="ink" />}
                </div>
              </div>

              {readOnly && <p className="gv-fd-note">{READ_ONLY_LINE}</p>}

              {/* Outstanding */}
              {outstanding.length > 0 && (
                <section aria-labelledby="gv-pp-out">
                  <p className="gv-fd-sect" id="gv-pp-out">Outstanding</p>
                  <div className="gv-fd-rows">
                    {outstanding.map(i => {
                      const locked = i.in_review;
                      return (
                        <label key={i.invoice_id} className="gv-fd-check" style={{ cursor: readOnly || locked ? 'default' : 'pointer', alignItems: 'center' }}
                          title={locked ? 'Review its proof in Things to do' : undefined}>
                          {!readOnly && (
                            <input type="checkbox" checked={ticked.has(i.invoice_id)} disabled={locked}
                              aria-label={`Select ${i.label}`}
                              onChange={e => {
                                const next = new Set(ticked);
                                if (e.target.checked) next.add(i.invoice_id); else next.delete(i.invoice_id);
                                setTicked(next);
                              }} />
                          )}
                          <span className="gv-fd-row-label" style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700 }}>{i.label}</span>
                            {i.price_locked && (
                              <span title="Price locked: a payment was made at this price" aria-label="Price locked" style={{ display: 'inline-flex', marginLeft: 6, verticalAlign: '-1px', color: '#8A7D6E' }}>
                                <Lock size={12} strokeWidth={2.4} aria-hidden />
                              </span>
                            )}
                            {i.for_name && <small>for {i.for_name}</small>}
                            {i.in_review && <small style={{ color: '#B6871F', display: 'flex', alignItems: 'center', gap: 4 }}><Hourglass size={12} strokeWidth={2.4} aria-hidden /> In review</small>}
                            {!i.in_review && i.in_started_payment && <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} strokeWidth={2.4} aria-hidden /> Waiting for their proof</small>}
                          </span>
                          <span className="gv-fd-row-amt">{cents(i.due_cents, i.currency)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 10 }}>
                      <button type="button" className="gv-st-btn gv-st-forest" disabled={tickedLines.length === 0}
                        onClick={() => setSub({ kind: 'paid', ids: tickedLines.map(i => i.invoice_id), total: tickedTotal, currency })}>
                        {tickedLines.length > 0 ? `Mark ${tickedLines.length} paid` : 'Mark paid'}
                      </button>
                      {outstanding.some(i => !i.in_review) && (
                        <button type="button" className="gv-st-link" onClick={() => setTicked(new Set(outstanding.filter(i => !i.in_review).map(i => i.invoice_id)))}>
                          Select all
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Paid */}
              <section aria-labelledby="gv-pp-paid">
                <p className="gv-fd-sect" id="gv-pp-paid">Paid</p>
                {detail.payments.length === 0 ? (
                  <p className="gv-fd-note">No payments yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.payments.map(pay => {
                      const isOpen = open === pay.key;
                      return (
                        <div key={pay.key} style={{ borderRadius: 14, background: '#FFFFFF' }}>
                          <div className="flex items-center gap-3 flex-wrap" style={{ padding: '12px 14px' }}>
                            <button type="button" onClick={() => setOpen(isOpen ? null : pay.key)} aria-expanded={isOpen}
                              className="flex items-center gap-3 focus:outline-none" style={{ flex: '1 1 240px', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit' }}>
                              {isOpen ? <ChevronDown size={16} strokeWidth={2.4} aria-hidden /> : <ChevronRight size={16} strokeWidth={2.4} aria-hidden />}
                              <span style={{ display: 'inline-flex', color: '#2A5A3C' }} aria-hidden>
                                {pay.how === 'card' ? <CreditCard size={16} strokeWidth={2.2} /> : <Landmark size={16} strokeWidth={2.2} />}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{howWords(pay)}</span>
                                <span style={{ display: 'block', fontSize: 12.5, color: '#5A5046' }}>
                                  {formatDate(pay.at)}{pay.note ? ` · ${pay.note}` : ''}
                                </span>
                              </span>
                            </button>
                            <span style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{cents(pay.total_cents, pay.currency)}</span>
                              {pay.returned_cents > 0 && <span style={{ display: 'block', fontSize: 12.5, color: DANGER, fontVariantNumeric: 'tabular-nums' }}>{cents(pay.returned_cents, pay.currency)} returned</span>}
                            </span>
                            {pay.proof_path && (
                              <button type="button" className="gv-st-link" onClick={() => { void viewProof(pay.proof_path!); }}>
                                <ExternalLink size={13} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden /> View proof
                              </button>
                            )}
                          </div>
                          {isOpen && (
                            <div style={{ padding: '0 14px 12px 14px' }}>
                              {pay.items.map(it => {
                                const inv = byId.get(it.invoice_id);
                                const gone = !inv || inv.refundable_cents <= 0;
                                return (
                                  <div key={it.invoice_id} className="gv-fd-row" style={{ alignItems: 'center', borderTop: `1px solid rgba(27,56,40,0.12)` }}>
                                    <span className="gv-fd-row-label">{it.label}</span>
                                    <span className="flex items-center gap-3 flex-wrap" style={{ justifyContent: 'flex-end' }}>
                                      <span className="gv-fd-row-amt">{cents(it.amount_cents, pay.currency)}</span>
                                      {gone ? (
                                        <span style={{ fontSize: 12.5, color: '#5A5046', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Undo2 size={12} strokeWidth={2.4} aria-hidden /> Returned</span>
                                      ) : !readOnly && inv ? (
                                        <>
                                          <button type="button" className="gv-st-link" onClick={() => setSub({
                                            kind: 'refund', currency: inv.currency,
                                            items: [{ invoice_id: inv.invoice_id, label: inv.label, amount_cents: inv.refundable_cents, paid_by_card: inv.paid_by_card }],
                                          })}>Refund</button>
                                          {!inv.paid_by_card && (
                                            <button type="button" className="gv-st-link" onClick={() => setSub({ kind: 'unpaid', ids: [inv.invoice_id], label: inv.label })}>Mark unpaid</button>
                                          )}
                                        </>
                                      ) : null}
                                    </span>
                                  </div>
                                );
                              })}
                              <div className="gv-fd-row gv-fd-total" style={{ borderTop: `1px solid rgba(27,56,40,0.12)` }}>
                                <span className="gv-fd-row-label">Total</span>
                                <span className="gv-fd-row-amt">{cents(pay.total_cents, pay.currency)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {proofErr && <p className="gv-st-err" role="alert">{proofErr}</p>}
              </section>

              {/* Waived and covered */}
              {waived.length > 0 && (
                <section aria-labelledby="gv-pp-waived">
                  <p className="gv-fd-sect" id="gv-pp-waived">Waived and Covered</p>
                  <div className="gv-fd-rows">
                    {waived.map(i => (
                      <div key={i.invoice_id} className="gv-fd-row">
                        <span className="gv-fd-row-label">
                          {i.label}
                          <small>{waivedReason(i)}{i.for_name ? ` · for ${i.for_name}` : ''}</small>
                        </span>
                        <span className="gv-fd-row-amt" style={{ color: '#5A5046' }}>
                          {cents(i.status === 'waived' ? i.amount_cents : i.aid_cents, i.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* All transactions */}
              <Fold title="All Transactions" open={showLedger} onToggle={() => setShowLedger(v => !v)} count={detail.ledger.length}>
                {detail.ledger.length === 0 ? <p className="gv-fd-note">Nothing recorded yet</p> : (
                  <div className="gv-fd-rows">
                    {detail.ledger.map((l, idx) => (
                      <div key={idx} className="gv-fd-row">
                        <span className="gv-fd-row-label">
                          {l.label}
                          <small>
                            {[formatDate(l.at), methodWords(l.method, l.type), l.status !== 'succeeded' ? sentence(l.status) : '', l.by, l.note || l.reason].filter(Boolean).join(' · ')}
                          </small>
                        </span>
                        <span className="gv-fd-row-amt" style={{ color: l.amount_cents < 0 ? DANGER : undefined }}>
                          {l.amount_cents < 0 ? `minus ${cents(-l.amount_cents, l.currency)}` : cents(l.amount_cents, l.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Fold>

              {/* History */}
              <Fold title="History" open={showAudit} onToggle={() => setShowAudit(v => !v)} count={detail.audit.length}>
                {detail.audit.length === 0 ? <p className="gv-fd-note">Nothing changed yet</p> : (
                  <div className="gv-fd-rows">
                    {detail.audit.map((a, idx) => (
                      <div key={idx} className="gv-fd-row">
                        <span className="gv-fd-row-label">
                          {auditWords(a)}
                          <small>{[formatDate(a.at), a.by ?? 'Gavelling', a.note].filter(Boolean).join(' · ')}</small>
                        </span>
                        {typeof a.amount_cents === 'number' && a.amount_cents !== 0 && (
                          <span className="gv-fd-row-amt">{cents(a.amount_cents, a.currency ?? currency)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Fold>
            </>
          )}
        </div>
      </PurchaseShell>

      {sub?.kind === 'paid' && (
        <MarkPaidDialog
          conferenceId={conferenceId}
          invoiceIds={sub.ids}
          totalLabel={cents(sub.total, sub.currency)}
          onClose={() => setSub(null)}
          onDone={() => { setSub(null); reread(); }}
        />
      )}
      {sub?.kind === 'unpaid' && (
        <MarkUnpaidDialog
          invoiceIds={sub.ids}
          title="Mark as Unpaid?"
          body={`${sub.label} goes back to owed, and the manual payment on it is taken off the record.`}
          onClose={() => setSub(null)}
          onDone={() => { setSub(null); reread(); }}
        />
      )}
      {sub?.kind === 'refund' && (
        <RefundDialog
          items={sub.items}
          currency={sub.currency}
          conferenceId={conferenceId}
          onClose={() => setSub(null)}
          onDone={() => { setSub(null); reread(); }}
        />
      )}
    </>
  );
}

function Num({ label, value, tone }: { label: string; value: string; tone: 'ink' | 'forest' | 'green' }) {
  const color = tone === 'green' ? SOFT_GREEN : tone === 'forest' ? '#1B3828' : '#1C1410';
  return (
    <div>
      <span style={{ display: 'block', fontSize: tone === 'green' ? 17 : 24, fontWeight: 900, letterSpacing: '-0.02em', color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A5046' }}>{label}</span>
    </div>
  );
}

function Fold({ title, open, onToggle, count, children }: { title: string; open: boolean; onToggle: () => void; count: number; children: React.ReactNode }) {
  return (
    <section>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 focus:outline-none"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#1C1410' }}>
        {open ? <ChevronDown size={16} strokeWidth={2.4} aria-hidden /> : <ChevronRight size={16} strokeWidth={2.4} aria-hidden />}
        <span className="gv-fd-sect" style={{ margin: 0 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: '#5A5046', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </section>
  );
}
