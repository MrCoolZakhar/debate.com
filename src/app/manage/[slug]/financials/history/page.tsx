'use client';

/**
 * Financials History — the payments ledger for this conference: every row
 * in `payments` whose invoice belongs here, newest first. This is the money
 * log (who paid what, how, and when) as opposed to /financials/invoices,
 * which is the current state of what's owed.
 */

import { useEffect, useState } from 'react';
import { CreditCard, Receipt } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { invoiceLabel, centsToFee } from '@/lib/invoices';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuInset, NeuIconDisc } from '@/components/neu';
import { inputStyle, mutedCaption, chipStyle, formatRowDate, roleLabel } from '../shared';

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
  created_at: string;
  invoice: PaymentInvoice | PaymentInvoice[] | null;
}

const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const TYPE_LABEL: Record<string, string> = {
  payment: 'PAYMENT',
  manual_paid: 'MANUAL',
  waiver: 'WAIVER',
  refund: 'REFUND',
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, ' ').toUpperCase();
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  payment: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  manual_paid: { bg: 'rgba(154,138,120,0.16)', color: '#6B5E4E' },
  waiver: { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F' },
  refund: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

export default function FinancialsHistoryPage() {
  const { conference } = useManage();
  const { session } = useAuth();

  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data } = await supabase
        .from('payments')
        .select(`
          id, invoice_id, amount_cents, currency, type, method, status, created_at,
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
  const availableTypes = Array.from(new Set(rows.map(r => r.type))).sort();
  const availableMethods = Array.from(new Set(rows.map(r => r.method).filter((m): m is string => !!m))).sort();

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (methodFilter !== 'all' && r.method !== methodFilter) return false;
    return true;
  });

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Transaction history
          </h2>
          <p style={mutedCaption}>
            Every payment recorded against this conference&apos;s invoices, newest first — the money log.
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">All types</option>
            {availableTypes.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          {availableMethods.length > 0 && (
            <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              <option value="all">All methods</option>
              {availableMethods.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
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
            Payments appear here — checkout, manual mark-paid, waivers, and refunds — as a detailed chronological log.
          </p>
        </NeuInset>
      ) : filtered.length === 0 ? (
        <NeuInset small className="text-center px-6 py-8">
          <p style={{ ...mutedCaption, fontSize: 12 }}>No transactions match these filters.</p>
        </NeuInset>
      ) : (
        <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
          {filtered.map((p, i) => {
            const inv = first(p.invoice);
            const app = inv ? first(inv.application) : null;
            const name = app?.profiles?.display_name ?? app?.invited_name ?? 'Unknown';
            const typeStyle = TYPE_STYLE[p.type] ?? { bg: 'rgba(154,138,120,0.13)', color: '#6B5E4E' };
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 flex-wrap px-5 py-2.5"
                style={i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : undefined}
              >
                {/* Date */}
                <span
                  className="inline-flex items-baseline gap-1.5 flex-shrink-0"
                  style={{ minWidth: 100 }}
                >
                  <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {formatRowDate(p.created_at)}
                  </span>
                </span>

                {/* Name */}
                <span
                  className="truncate"
                  style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, flex: '1 1 140px', minWidth: 120 }}
                >
                  {name}
                </span>

                {/* What (invoice label/kind + role) */}
                <span
                  className="truncate"
                  style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.muted, flex: '1 1 140px', minWidth: 120 }}
                >
                  {inv ? invoiceLabel(inv) : 'Unknown invoice'}
                  {app?.role ? ` · ${roleLabel(app.role)}` : ''}
                </span>

                {/* Amount */}
                <span
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink,
                    fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right', marginLeft: 'auto',
                  }}
                >
                  {centsToFee(p.amount_cents, p.currency)}
                </span>

                {/* Type chip */}
                <span
                  className="inline-flex items-center gap-1"
                  style={{ ...chipStyle, backgroundColor: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.color}55` }}
                >
                  <CreditCard size={10} strokeWidth={2.5} />
                  {typeLabel(p.type)}
                </span>

                {/* Method chip */}
                {p.method && (
                  <span
                    style={{
                      ...chipStyle, fontSize: 8.5,
                      backgroundColor: 'rgba(154,138,120,0.13)', color: '#6B5E4E',
                      border: '1px solid rgba(154,138,120,0.35)',
                    }}
                  >
                    {p.method.toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}
        </NeuCard>
      )}
    </section>
  );
}
