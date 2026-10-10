// manualApi.ts — paying a manual conference, started payments and refund
// requests on /pay (prompt 96). Every write is verified (an error or ok:false
// is a failure with the server's own sentence); the page re-reads
// my_pay_overview and my_started_payments after each one.
//
// A STARTED PAYMENT is the ticked items and their price, held 3 days, until
// the payer attaches a proof (then it waits for the organizer's review) or
// cancels it. Proof is always required to finish a manual payment.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { safeStorageKey } from '@/lib/storageKey';
import { reportBlocked } from '@/lib/reportCrash';

export interface StartedPayment {
  batch_id: string;
  status: 'awaiting_proof' | 'pending' | 'rejected';
  created_at: string;
  expires_at: string | null;
  total_cents: number;
  currency: string;
  proof_path: string | null;
  proof_uploaded_at: string | null;
  replaced_count: number;
  review_note: string | null;
  items: { invoice_id: string; label: string; kind: string; amount_cents: number; invoice_status: string }[];
}

export interface StartedInfo {
  manual: boolean;
  payments: StartedPayment[];
  locked: Record<string, { batch_id: string; status: string; mine: boolean }>;
}

async function client() {
  const c = await getFreshAuthedClient();
  if (!c) throw new Error('Your session has expired. Please sign in again.');
  return c;
}

export async function readStarted(conferenceId: string): Promise<StartedInfo> {
  const c = await client();
  const { data, error } = await c.rpc('my_started_payments', { p_conference_id: conferenceId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) return { manual: false, payments: [], locked: {} };
  return {
    manual: a.manual === true,
    payments: Array.isArray(a.payments) ? (a.payments as StartedPayment[]) : [],
    locked: (a.locked && typeof a.locked === 'object' ? a.locked : {}) as StartedInfo['locked'],
  };
}

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; code?: string; startedBatchId?: string };

async function call<T extends object>(fn: string, args: Record<string, unknown>, fallback: string, pick: (a: Record<string, unknown>) => T): Promise<Ok<T> | Fail> {
  try {
    const c = await client();
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      return {
        ok: false,
        error: plainOrFallback(a?.error, fallback),
        code: typeof a?.code === 'string' ? a.code : undefined,
        startedBatchId: typeof a?.started_batch_id === 'string' ? a.started_batch_id : undefined,
      };
    }
    return { ok: true, ...pick(a) };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export function startManualPayment(invoiceIds: string[]) {
  return call('start_manual_payment', { p_invoice_ids: invoiceIds }, 'Your payment could not be started. Try again in a moment.', a => ({
    batchId: String(a.batch_id ?? ''),
    expiresAt: typeof a.expires_at === 'string' ? a.expires_at : null,
    totalCents: typeof a.total_cents === 'number' ? a.total_cents : 0,
    currency: typeof a.currency === 'string' ? a.currency : 'USD',
    resumed: a.resumed === true,
  }));
}

export function attachProof(batchId: string, path: string) {
  return call('attach_proof', { p_batch_id: batchId, p_path: path }, 'Your proof could not be sent. Try again in a moment.', () => ({}));
}

export function replaceProof(batchId: string, path: string) {
  return call('replace_proof', { p_batch_id: batchId, p_path: path }, 'Your proof could not be replaced. Try again in a moment.', () => ({}));
}

/** A NEW proof on a payment the organizers did not accept (prompt 102): the SAME payment goes back to review. code 'items_changed' = start a new payment instead. */
export function resubmitProof(batchId: string, path: string) {
  return call('resubmit_proof', { p_batch_id: batchId, p_path: path }, 'Your proof could not be sent. Try again in a moment.', () => ({}));
}

export function cancelStartedPayment(batchId: string) {
  return call('cancel_started_payment', { p_batch_id: batchId }, 'This payment could not be cancelled. Try again in a moment.', () => ({}));
}

export function requestRefund(invoiceIds: string[], reason: string) {
  return call('request_refund', { p_invoice_ids: invoiceIds, p_reason: reason.trim() }, 'Your refund request could not be sent. Try again in a moment.', () => ({}));
}

export function reportRefundNotReceived(invoiceId: string, note: string) {
  return call('report_refund_not_received', { p_invoice_id: invoiceId, p_note: note.trim() || null }, 'Your message could not be sent. Try again in a moment.', () => ({}));
}

export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

export function proofProblem(f: File): string | null {
  const ok = f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (!ok) return 'Choose an image or a PDF.';
  if (f.size > PROOF_MAX_BYTES) return 'That file is over 10 MB. Choose a smaller one.';
  return null;
}

/** Uploads a payer's proof to payment-proofs/<conference id>/ and returns its path. */
export async function uploadProof(conferenceId: string, file: File): Promise<{ path: string } | { error: string }> {
  try {
    const c = await client();
    const path = safeStorageKey(conferenceId, crypto.randomUUID(), file.name);
    const contentType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : undefined);
    const { error } = await c.storage.from('payment-proofs').upload(path, file, { contentType });
    if (error) {
      reportBlocked('upload payment proof', error, { conferenceId });
      return { error: 'Your proof could not be uploaded. Try again, or send it to the organizers directly.' };
    }
    return { path };
  } catch (e) {
    return { error: friendlyError(e, 'Your proof could not be uploaded. Try again in a moment.') };
  }
}

/** A short-lived link to a proof (the payer's own, or a refund proof the organizer attached). */
export async function proofLink(path: string): Promise<string | null> {
  try {
    const c = await client();
    const { data, error } = await c.storage.from('payment-proofs').createSignedUrl(path, 300);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** The public address of the conference's payment QR (conference-assets). */
export async function qrLink(path: string): Promise<string | null> {
  try {
    const c = await client();
    return c.storage.from('conference-assets').getPublicUrl(path).data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/** "2 days left to send your proof", or null once it has lapsed. */
export function timeLeft(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days left to send your proof`;
  if (h >= 24) return '1 day left to send your proof';
  if (h >= 1) return `${h} hour${h === 1 ? '' : 's'} left to send your proof`;
  return 'Less than an hour left to send your proof';
}
