// invoices.ts — shared display helpers for the invoices/payments ledger
// (see PART 1-7 of the invoicing frontend). Pure functions only, no I/O —
// every page fetches its own rows and calls into here for label/status/money
// formatting so the "Registration" fallback and payability rule stay in
// exactly one place.

import { formatFee } from '@/lib/finance';

export type InvoiceKind = 'role_fee' | 'pledge_spot' | 'app_fee' | 'addon' | (string & {});
export type InvoiceStatus = 'open' | 'partial' | 'settled' | 'waived' | 'void';

export interface InvoiceRow {
  id: string;
  conference_id: string;
  kind: InvoiceKind;
  label: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: InvoiceStatus;
  gates_acceptance: boolean;
  payable_before_acceptance: boolean;
  application_id: string | null;
  society_id: string | null;
  config_id: string | null;
  aid_applied_cents: number;
  quantity: number;
  created_at: string;
}

const KIND_FALLBACK_LABEL: Record<string, string> = {
  role_fee: 'Registration',
  pledge_spot: 'Delegation spot',
  app_fee: 'Conference Application Fee',
  addon: 'Add-on',
};

/** Display label: the config-derived label already stored on the invoice
 *  (app_fee/addon), else a friendly fallback per kind, e.g. role_fee → "Registration". */
export function invoiceLabel(inv: Pick<InvoiceRow, 'kind' | 'label'>): string {
  return inv.label || KIND_FALLBACK_LABEL[inv.kind] || inv.kind;
}

/** Money still owed on this invoice, in cents. */
export function invoiceDueCents(inv: Pick<InvoiceRow, 'amount_cents' | 'amount_paid_cents'>): number {
  return Math.max(0, inv.amount_cents - inv.amount_paid_cents);
}

/** cents → formatted major-unit string, e.g. 4599 'USD' → "$45.99". */
export function centsToFee(cents: number, currency: string): string {
  return formatFee(cents / 100, currency);
}

/** An invoice is payable when it's explicitly payable pre-acceptance, or the
 *  owning application has cleared acceptance (accepted/assigned/checked-in).
 *  role_fee is the only kind whose payable_before_acceptance varies (by
 *  payment_timing); app_fee/addon are always payable_before_acceptance=true
 *  per sync_participant_invoices. */
export function isInvoicePayable(inv: Pick<InvoiceRow, 'payable_before_acceptance'>, applicationStatus: string): boolean {
  return inv.payable_before_acceptance
    || applicationStatus === 'accepted' || applicationStatus === 'assigned' || applicationStatus === 'checked-in';
}

export function isInvoiceSettled(inv: Pick<InvoiceRow, 'status'>): boolean {
  return inv.status === 'settled' || inv.status === 'waived';
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'UNPAID', partial: 'PARTIAL', settled: 'PAID', waived: 'WAIVED', void: 'VOID',
};

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus, { bg: string; color: string }> = {
  open: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
  partial: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  settled: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  waived: { bg: 'rgba(154,138,120,0.16)', color: '#6B5E4E' },
  void: { bg: 'rgba(154,138,120,0.16)', color: '#6B5E4E' },
};

/** Applies gates acceptance for an UNPAID invoice, any kind — the
 *  acceptance-block rule shared by applications/page.tsx. Widened from
 *  app_fee-only now that a role_fee (registration) can also gate acceptance
 *  via application_role_configs.fee_gates_acceptance. */
export function isUnpaidGatingInvoice(inv: Pick<InvoiceRow, 'gates_acceptance' | 'status'>): boolean {
  return inv.gates_acceptance && inv.status !== 'settled' && inv.status !== 'waived' && inv.status !== 'void';
}
