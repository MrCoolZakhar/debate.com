'use client';

/**
 * Financials → Transactions: the payments ledger for this conference, every
 * row in `payments` whose invoice belongs here, newest first. This is the
 * money log (who paid what, how, and when), as opposed to Invoices, which is
 * the current state of what's owed. Each row says what happened in words
 * (Payment, Proof approved, Marked paid, Marked unpaid, Refund, Dispute lost)
 * with ONE chip for how (Card or Manual), and the amount signed and coloured:
 * money in green with "+", money out red with "−" before the currency.
 */

import { useEffect, useState } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { invoiceLabel } from '@/lib/invoices';
import { NEU, OUTFIT, NeuCard, NeuInset } from '@/components/neu';
import { inputStyle, mutedCaption, chipStyle, formatRowDate, roleLabel, formatCents } from '../shared';

interface PaymentInvoice {
  id: string;
  kind: string;
  label: string | null;
  application: { role: string; invited_name: string | null; profiles: { display_name: string } | null } | { role: string; invited_name: string | null; profiles: { display_name: string } | null }[] | null;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  type: string;
  method: string | null;
  status: string;
  note: string | null;
  reason: string | null;
  created_at: string;
  invoice: PaymentInvoice | PaymentInvoice[] | null;
}

const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type What = 'payment' | 'proof' | 'marked' | 'unmarked' | 'refund' | 'dispute' | 'waived' | 'other';
const WHAT_LABEL: Record<What, string> = {
  payment: 'Payment',
  proof: 'Proof approved',
  marked: 'Marked paid',
  unmarked: 'Marked unpaid',
  refund: 'Refund',
  dispute: 'Dispute lost',
  waived: 'Waived',
  other: 'Other',
};

function whatHappened(p: PaymentRow): What {
  if (p.type === 'reversal' || (p.note ?? '').startsWith('Reversal of ')) return 'unmarked';
  if (p.type === 'refund') return /dispute/i.test(`${p.reason ?? ''} ${p.note ?? ''}`) ? 'dispute' : 'refund';
  if (p.type === 'manual_proof') return 'proof';
  if (p.type === 'manual_paid') return 'marked';
  if (p.type === 'waiver') return 'waived';
  if (p.type === 'payment') return 'payment';
  return 'other';
}

const GREEN = '#2A5A3C';
const RED = '#8B2020';

function signed(cents: number, currency: string): { text: string; color: string } {
  if (cents > 0) return { text: `+${formatCents(cents, currency)}`, color: GREEN };
  if (cents < 0) return { text: `−${formatCents(-cents, currency)}`, color: RED };
  return { text: formatCents(0, currency), color: NEU.inkSoft };
}

export default function FinancialsHistoryPage() {
  const { conference } = useManage();
  const { session } = useAuth();

  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [whatFilter, setWhatFilter] = useState<string>('all');
  const [howFilter, setHowFilter] = useState<string>('all');
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data } = await supabase
        .from('payments')
        .select(`
          id, invoice_id, amount_cents, currency, type, method, status, note, reason, created_at,
          invoice:invoices!inner (
            id, kind, label, conference_id,
            application:applications!invoices_application_id_fkey (role, invited_name, profiles (display_name))
          )
        `)
        .eq('invoice.conference_id', conference.id)
        .order('created_at', { ascending: false });
      setPayments((data ?? []) as unknown as PaymentRow[]);
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conference) return null;

  const loading = payments === null;
  const rows = payments ?? [];
  const availableWhat = Array.from(new Set(rows.map(whatHappened)));
  const hasCard = rows.some(r => r.method === 'stripe');
  const hasManual = rows.some(r => r.method !== 'stripe');

  const filtered = rows.filter(r => {
    if (whatFilter !== 'all' && whatHappened(r) !== whatFilter) return false;
    if (howFilter === 'card' && r.method !== 'stripe') return false;
    if (howFilter === 'manual' && r.method === 'stripe') return false;
    if (direction === 'in' && !(r.amount_cents > 0)) return false;
    if (direction === 'out' && !(r.amount_cents < 0)) return false;
    return true;
  });

  return (
    <section>
      {/* The title ("Transactions") and its caption come from the Financials layout. */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select aria-label="Money in or out" value={direction} onChange={e => setDirection(e.target.value as 'all' | 'in' | 'out')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">Money in and out</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
          <select aria-label="What happened" value={whatFilter} onChange={e => setWhatFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">Everything</option>
            {availableWhat.map(w => <option key={w} value={w}>{WHAT_LABEL[w]}</option>)}
          </select>
          {hasCard && hasManual && (
            <select aria-label="How" value={howFilter} onChange={e => setHowFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              <option value="all">Card and manual</option>
              <option value="card">Card</option>
              <option value="manual">Manual</option>
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      ) : rows.length === 0 ? (
        <NeuInset className="flex flex-col items-center text-center px-6 py-10">
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>
            No transactions yet
          </p>
          <p className="mt-1 max-w-sm" style={{ ...mutedCaption, fontSize: 11.5 }}>
            Payments, refunds and corrections appear here as they happen
          </p>
        </NeuInset>
      ) : filtered.length === 0 ? (
        <NeuInset small className="text-center px-6 py-8">
          <p style={{ ...mutedCaption, fontSize: 12 }}>No transactions match these filters</p>
        </NeuInset>
      ) : (
        <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
          {filtered.map((p, i) => {
            const inv = first(p.invoice);
            const app = inv ? first(inv.application) : null;
            const name = app?.profiles?.display_name ?? app?.invited_name ?? 'Unknown';
            const what = whatHappened(p);
            const card = p.method === 'stripe';
            const settled = p.status === 'succeeded';
            const amt = signed(p.amount_cents, p.currency);
            // Money that has not landed (a proof waiting, a failed card) is never shown as money in or out.
            const amtColor = settled ? amt.color : NEU.inkSoft;
            const whatLabel = what === 'proof' && !settled ? 'Proof sent' : WHAT_LABEL[what];
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 flex-wrap px-5 py-3"
                style={i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : undefined}
              >
                <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', minWidth: 96 }}>
                  {formatRowDate(p.created_at)}
                </span>

                <span className="[overflow-wrap:anywhere]" style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>{name}</span>
                  <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>
                    {inv ? invoiceLabel(inv) : 'Unknown item'}
                    {app?.role ? ` · ${roleLabel(app.role)}` : ''}
                  </span>
                </span>

                <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, minWidth: 110 }}>
                  {whatLabel}
                  {!settled && (
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft }}>
                      {p.status === 'pending' ? 'Waiting' : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  )}
                </span>

                <span className="inline-flex items-center gap-1" style={{ ...chipStyle, color: NEU.inkSoft }}>
                  {card ? <CreditCard size={14} strokeWidth={2.4} aria-hidden="true" /> : <Landmark size={14} strokeWidth={2.4} aria-hidden="true" />}
                  {card ? 'Card' : 'Manual'}
                </span>

                <span style={{
                  fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: amtColor,
                  fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right', marginLeft: 'auto',
                }}>
                  {amt.text}
                </span>
              </div>
            );
          })}
        </NeuCard>
      )}
    </section>
  );
}
