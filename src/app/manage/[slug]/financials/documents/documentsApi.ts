// documentsApi.ts — Invoices and Receipts (prompt 98): the organizer's reads
// and writes of invoice details and money documents. Every write is verified:
// ok:false is shown as the server's sentence, under its field when it names one.
// Documents are snapshots of the ledger; nothing here can change an amount.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import type { BilledTo, DocConference, Editable, Issuer, MoneyDocKind } from '@/components/money/moneyDocument';

async function client() {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  return c;
}

export type Write<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; error: string; field?: string; code?: string };

async function rpcWrite<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>, fallback: string): Promise<Write<T>> {
  try {
    const c = await client();
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      return {
        ok: false,
        error: plainOrFallback(a?.error, fallback),
        field: typeof a?.field === 'string' ? a.field : undefined,
        code: typeof a?.code === 'string' ? a.code : undefined,
      };
    }
    return { ok: true, data: a as T };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

async function rpcRead(fn: string, args: Record<string, unknown>, fallback: string): Promise<Record<string, unknown>> {
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, fallback));
  return a;
}

// ── Invoice details ─────────────────────────────────────────────────────────

export interface InvoiceSettings {
  settings: (Issuer & { number_prefix: string }) | null;
  suggested_prefix: string;
  conference: DocConference;
}

export async function readInvoiceSettings(conferenceId: string): Promise<InvoiceSettings> {
  const a = await rpcRead('get_invoice_settings', { p_conference_id: conferenceId }, 'Your invoice details could not be read. Try again in a moment.');
  return {
    settings: (a.settings as InvoiceSettings['settings']) ?? null,
    suggested_prefix: typeof a.suggested_prefix === 'string' && a.suggested_prefix ? a.suggested_prefix : 'INV',
    conference: (a.conference as DocConference) ?? { full_name: null, acronym: null, logo_url: null },
  };
}

export interface SettingsInput {
  legal_name: string; address: string; website: string; tax_id: string; number_prefix: string; tax_note: string; accent_color: string | null;
}

export function saveInvoiceSettings(conferenceId: string, s: SettingsInput) {
  return rpcWrite('save_invoice_settings', { p_conference_id: conferenceId, p: s }, 'Your invoice details could not be saved. Try again in a moment.');
}

// ── Payments and documents ──────────────────────────────────────────────────

export interface MoneyPayment {
  key: string;
  at: string;
  how: 'card' | 'proof' | 'marked';
  application_id: string;
  name: string;
  delegation: string | null;
  total_cents: number;
  returned_cents: number;
  currency: string;
  kinds: string[];
  items: { invoice_id: string; label: string; kind: string; amount_cents: number }[];
  documents: { document_id: string; number: string }[];
}

export async function readPayments(conferenceId: string): Promise<MoneyPayment[]> {
  const a = await rpcRead('financials_payments', { p_conference_id: conferenceId }, 'The payments could not be read. Try again in a moment.');
  return Array.isArray(a.payments) ? (a.payments as MoneyPayment[]) : [];
}

export interface DocumentRow {
  document_id: string;
  kind: MoneyDocKind;
  number: string;
  created_at: string;
  currency: string;
  subtotal_cents: number;
  paid_cents: number;
  balance_cents: number;
  billed_to: BilledTo | null;
  application_id: string | null;
  sent_to_payer_at: string | null;
}

export async function readDocuments(conferenceId: string): Promise<DocumentRow[]> {
  const a = await rpcRead('financials_documents', { p_conference_id: conferenceId }, 'Your documents could not be read. Try again in a moment.');
  return Array.isArray(a.documents) ? (a.documents as DocumentRow[]) : [];
}

export function createDocument(conferenceId: string, kind: MoneyDocKind, applicationId: string, paymentKeys: string[] | null, invoiceIds: string[] | null) {
  return rpcWrite<{ ok: true; document_id: string; number: string }>('create_money_document', {
    p_conference_id: conferenceId, p_kind: kind, p_application_id: applicationId,
    p_payment_keys: paymentKeys, p_invoice_ids: invoiceIds,
  }, kind === 'receipt' ? 'The receipt could not be made. Try again in a moment.' : 'The invoice could not be made. Try again in a moment.');
}

export function updateDocument(documentId: string, editable: Editable, billedTo: BilledTo) {
  return rpcWrite('update_money_document', { p_document_id: documentId, p_editable: editable, p_billed_to: billedTo }, 'Your changes could not be saved. Try again in a moment.');
}

export function sendDocument(documentId: string, to: 'me' | 'payer') {
  return rpcWrite('send_money_document', { p_document_id: documentId, p_to: to }, 'The email could not be sent. Try again in a moment.');
}

/** Let the "documents made" links on the list catch up after a create. */
export const DOCUMENTS_CHANGED = 'gv-money-documents-changed';
