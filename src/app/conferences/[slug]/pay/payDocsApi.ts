// payDocsApi.ts — a payer's invoices and receipts on /pay (prompt 98).
//
// my_money_documents says whether the conference has set up its invoice
// details (settings_ready; nothing about documents shows until it has), the
// payer's saved billing details and the documents already made for them.
// create_my_money_document makes one from their OWN payments or open items;
// the server refuses anything that is not theirs.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import type { MoneyDocKind } from '@/components/money/moneyDocument';

export interface Billing { institution: string | null; address: string | null; phone: string | null; tax_number: string | null; attn: string | null }

export interface MyDocument {
  document_id: string;
  kind: MoneyDocKind;
  number: string;
  created_at: string;
  currency: string;
  paid_cents: number;
  balance_cents: number;
  payment_keys: string[] | null;
}

export interface MyDocs { settings_ready: boolean; billing: Billing | null; documents: MyDocument[] }

export async function readMyDocs(conferenceId: string): Promise<MyDocs> {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  const { data, error } = await c.rpc('my_money_documents', { p_conference_id: conferenceId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, 'Your invoices and receipts could not be read.'));
  return {
    settings_ready: a.settings_ready === true,
    billing: (a.billing as Billing | null) ?? null,
    documents: Array.isArray(a.documents) ? (a.documents as MyDocument[]) : [],
  };
}

type W<T> = { ok: true; data: T } | { ok: false; error: string };

async function write<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<W<T>> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) return { ok: false, error: plainOrFallback(a?.error, fallback) };
    return { ok: true, data: a as T };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export function saveMyBilling(conferenceId: string, b: Billing) {
  return write('save_my_billing_details', { p_conference_id: conferenceId, p: b }, 'Your billing details could not be saved. Try again in a moment.');
}

export function createMyDocument(conferenceId: string, kind: MoneyDocKind, paymentKeys: string[] | null, invoiceIds: string[] | null) {
  return write<{ document_id: string; number: string }>('create_my_money_document', {
    p_conference_id: conferenceId, p_kind: kind, p_payment_keys: paymentKeys, p_invoice_ids: invoiceIds,
  }, kind === 'receipt' ? 'Your receipt could not be made. Try again in a moment.' : 'Your invoice could not be made. Try again in a moment.');
}

/** A receipt already made for exactly this one payment, if any. */
export function receiptFor(docs: MyDocument[], key: string): MyDocument | null {
  return docs.find(d => d.kind === 'receipt' && (d.payment_keys ?? []).length === 1 && d.payment_keys![0] === key) ?? null;
}
