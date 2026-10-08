// financialsApi.ts — every read and write of the Financials dashboard (1 Oct 2026).
//
// Reads:  financials_dashboard, money_things_to_do (money_things_to_do_count is
//         the rail badge's, read in the manage layout)
// Writes: review_proof, close_money_todo, match_stripe_refund,
//         record_manual_refund, and the refund-items edge function.
//
// Every write is a VERIFIED write: a transport error, ok:false, or nothing
// returned is a failure, shown as the server's own sentence (plainOrFallback)
// or a plain fallback, and nothing on screen changes. All amounts are minor
// units (cents) in the stated currency.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';

export type MoneyKind = 'role_fee' | 'pledge_spot' | 'advisor_spot' | 'app_fee' | 'addon' | 'surcharge';
export const KIND_ORDER: MoneyKind[] = ['role_fee', 'pledge_spot', 'advisor_spot', 'app_fee', 'addon', 'surcharge'];
export const KIND_NAME: Record<MoneyKind, string> = {
  role_fee: 'Tickets',
  pledge_spot: 'Delegate tickets',
  advisor_spot: 'Advisor tickets',
  app_fee: 'Registration fee',
  addon: 'Add-ons',
  surcharge: 'Ticket differences',
};
export function kindName(k: string): string {
  return (KIND_NAME as Record<string, string>)[k] ?? 'Other';
}

export type ByKind = Partial<Record<MoneyKind, number>>;

export interface FinancialsDashboard {
  currency: string;
  received: {
    total_cents: number; card_cents: number; card_count: number; manual_cents: number; manual_count: number;
    refunded_cents: number; refunded_count: number; by_kind: ByKind;
  };
  outstanding: { total_cents: number; items: number; people: number; by_kind: ByKind; unclaimed_cents: number; unclaimed_items: number };
  in_review: { total_cents: number; count: number };
  not_charged: { covered_people: number; waived_cents: number; waived_items: number; aid_cents: number; aid_people: number };
  other_currencies: string[];
  todo_count: number;
  people_billed: number;
  settings: {
    payment_method: 'stripe' | 'manual' | null;
    connect_status: string | null;
    platform_collects: boolean;
    has_external_url: boolean;
    registration_fee: null | { label: string | null; amount_cents: number; currency: string; applies_to: string | null; active: boolean };
    addons_active: number; addons_sold: number; vouchers_active: number; vouchers_used: number;
  };
}

export interface ProofItem { invoice_id: string; label: string; kind: string; amount_cents: number; for_name: string | null }
export interface ProofThing {
  kind: 'proof';
  batch_id: string;
  payer_name: string | null;
  payer_email: string | null;
  delegation: string | null;
  total_cents: number;
  currency: string;
  proof_path: string | null;
  proof_is_pdf: boolean;
  replaced_count: number;
  uploaded_at: string;
  items: ProofItem[];
}

export type TodoKind = 'refund_request' | 'refund_not_received' | 'stripe_refund_to_match' | 'dispute' | 'refund_due';
export interface TodoItem { invoice_id: string; label: string; kind: string; amount_cents: number; paid_cents: number; status: string; paid_by_card: boolean }
export interface CardItem { invoice_id: string; label: string; kind: string; net_cents: number; for_name: string | null }
export interface TodoThing {
  id: string;
  kind: TodoKind;
  status: string;
  application_id: string | null;
  invoice_ids: string[] | null;
  amount_cents: number | null;
  currency: string | null;
  stripe_ref: string | null;
  payload: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
  person_name: string | null;
  person_email: string | null;
  items: TodoItem[];
  card_items?: CardItem[];
}

export interface ThingsToDo { proofs: ProofThing[]; todos: TodoThing[] }

/** A refundable item, as the refund dialog takes it (kept general for Invoices). */
export interface RefundItem { invoice_id: string; label: string; amount_cents: number; paid_by_card: boolean }

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

async function client() {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  return c;
}

/** A write's answer: ok, or the sentence to show (and the field it is about). */
export type WriteResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string; partial?: boolean };

async function rpcWrite(fn: string, args: Record<string, unknown>, fallback: string): Promise<WriteResult> {
  try {
    const c = await client();
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      return { ok: false, error: plainOrFallback(a?.error ?? a?.message, fallback), field: typeof a?.field === 'string' ? a.field : undefined };
    }
    return { ok: true, data: a };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export async function readDashboard(conferenceId: string): Promise<FinancialsDashboard> {
  const c = await client();
  const { data, error } = await c.rpc('financials_dashboard', { p_conference_id: conferenceId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, 'Your Financials could not be read. Try again in a moment.'));
  return a as unknown as FinancialsDashboard;
}

export async function readThingsToDo(conferenceId: string): Promise<ThingsToDo> {
  const c = await client();
  const { data, error } = await c.rpc('money_things_to_do', { p_conference_id: conferenceId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, 'Your things to do could not be read. Try again in a moment.'));
  return {
    proofs: Array.isArray(a.proofs) ? (a.proofs as ProofThing[]) : [],
    todos: Array.isArray(a.todos) ? (a.todos as TodoThing[]) : [],
  };
}

export function reviewProof(batchId: string, approve: boolean, reason?: string) {
  return rpcWrite('review_proof', { p_batch_id: batchId, p_approve: approve, p_reason: reason ?? null },
    approve ? 'This proof could not be accepted. Try again in a moment.' : 'This proof could not be denied. Try again in a moment.');
}

export function closeMoneyTodo(todoId: string, outcome: 'done' | 'dismissed', note?: string) {
  return rpcWrite('close_money_todo', { p_todo_id: todoId, p_outcome: outcome, p_note: note?.trim() || null },
    'This could not be saved. Try again in a moment.');
}

export function matchStripeRefund(todoId: string, invoiceIds: string[]) {
  return rpcWrite('match_stripe_refund', { p_todo_id: todoId, p_invoice_ids: invoiceIds },
    'The refund could not be matched. Try again in a moment.');
}

export function recordManualRefund(invoiceIds: string[], method: 'bank_transfer' | 'cash' | 'other', proofPath: string | null, note: string, todoId?: string) {
  return rpcWrite('record_manual_refund', {
    p_invoice_ids: invoiceIds, p_method: method, p_proof_path: proofPath, p_note: note.trim() || null, p_todo_id: todoId ?? null,
  }, 'The refund could not be recorded. Try again in a moment.');
}

/** refund-items: card items back through Stripe (Stripe keeps its fee). */
export async function refundCardItems(invoiceIds: string[], reason: string, todoId?: string): Promise<WriteResult> {
  const fallback = 'The refund could not be sent. Try again in a moment.';
  try {
    const c = await client();
    const { data, error } = await c.functions.invoke('refund-items', {
      body: { invoiceIds, reason: reason.trim() || null, todoId: todoId ?? null },
    });
    if (error) return { ok: false, error: plainOrFallback(await extractFunctionErrorMessage(error), fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      // One Stripe refund per card payment: some can land while another fails.
      const refunds = Array.isArray(a?.refunds) ? (a!.refunds as Array<{ error?: string }>) : [];
      const partial = refunds.some((r) => !r.error);
      const msg = plainOrFallback(a?.error, fallback);
      return partial
        ? { ok: false, partial: true, error: `Some of these were refunded, but not all. ${msg}` }
        : { ok: false, error: msg };
    }
    return { ok: true, data: a };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** A signed link to a proof in payment-proofs, good for 5 minutes. */
export async function signedProofUrl(path: string): Promise<string | null> {
  try {
    const c = await client();
    const { data, error } = await c.storage.from('payment-proofs').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Uploads a refund proof to payment-proofs/<conference>/refunds/ and returns its path. */
export async function uploadRefundProof(conferenceId: string, file: File): Promise<{ path: string } | { error: string }> {
  try {
    const c = await client();
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80) || 'proof';
    const path = `${conferenceId}/refunds/${Date.now()}-${safe}`;
    const { error } = await c.storage.from('payment-proofs').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) return { error: friendlyError(error, 'The proof could not be uploaded. Try again, or record the refund without it.') };
    return { path };
  } catch (e) {
    return { error: friendlyError(e, 'The proof could not be uploaded. Try again, or record the refund without it.') };
  }
}

/** Minor units as money in a currency, for amounts that are not converted. */
export function cents(value: number | null | undefined, currency: string): string {
  const amount = n(value) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Tells the rail badge to re-read after a money action. */
export function notifyMoneyTodoChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gv-financials-todo-changed'));
}
