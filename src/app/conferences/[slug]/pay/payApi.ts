// payApi.ts — the /pay page's reads and writes (prompt 95).
//
// my_pay_overview is the ONE read of what the signed-in person pays: their
// own items plus their delegation's tickets and registration fee when they
// lead it, each with a state in words, the payments as receipts, and totals.
// Card payments run inside Gavelling through create-checkout's embedded path;
// the Stripe webhook settles the items a few seconds after the payment, so
// the page waits for it (see useSettleWait in CardPayPopup).

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';

export type ItemState =
  | 'unpaid' | 'started' | 'in_review' | 'paid' | 'rejected' | 'refunded'
  | 'disputed' | 'refund_requested' | 'covered' | 'waived';

export interface PayItem {
  invoice_id: string;
  label: string;
  kind: string;
  amount_cents: number;
  paid_cents: number;
  due_cents: number;
  aid_cents: number;
  currency: string;
  status: string;
  state: ItemState;
  rejected: { reason: string | null; at: string } | null;
  refund: { at: string; method: string | null; note: string | null; proof_path: string | null; amount_cents: number } | null;
  not_received_reported: boolean;
  payment_key: string | null;
  paid_by_card: boolean;
  for_name: string | null;
  owner_is_me: boolean;
  payable: boolean;
  removable: boolean;
  can_request_refund: boolean;
}

export interface PayPayment {
  key: string;
  at: string;
  how: 'card' | 'proof' | 'marked';
  total_cents: number;
  returned_cents: number;
  currency: string;
  items: { invoice_id: string; label: string; amount_cents: number }[];
}

export interface PayOverview {
  conference: {
    id: string; slug: string; acronym: string | null; full_name: string; currency: string;
    method: 'stripe' | 'manual' | null; manual_kind: 'link' | 'qr' | 'bank' | null;
    payment_url: string | null; instructions: string | null; qr_path: string | null;
    bank: { account_name?: string; account_number?: string; swift?: string; bank_name?: string; reference?: string } | null;
    ready: boolean; aid_open: boolean; contact_email: string | null;
  };
  me: { application_id: string; role: string; status: string; payment_status: string; society_id: string | null; delegation: string | null; is_leader: boolean }[];
  items: PayItem[];
  payments: PayPayment[];
  totals: { owed_cents: number; paid_cents: number; in_review_cents: number };
}

export async function readPayOverview(conferenceId: string): Promise<PayOverview> {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  const { data, error } = await c.rpc('my_pay_overview', { p_conference_id: conferenceId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, 'Your payments could not be read. Try again in a moment.'));
  return {
    conference: a.conference as PayOverview['conference'],
    me: Array.isArray(a.me) ? (a.me as PayOverview['me']) : [],
    items: Array.isArray(a.items) ? (a.items as PayItem[]) : [],
    payments: Array.isArray(a.payments) ? (a.payments as PayPayment[]) : [],
    totals: (a.totals as PayOverview['totals']) ?? { owed_cents: 0, paid_cents: 0, in_review_cents: 0 },
  };
}

export type Result = { ok: true } | { ok: false; error: string };

/** A delegate or advisor ticket the leader added: remove_pledged_spot_invoice. */
export async function removePledgedTicket(invoiceId: string): Promise<Result> {
  const fallback = 'This could not be removed. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.rpc('remove_pledged_spot_invoice', { p_invoice_id: invoiceId });
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || !r?.ok) return { ok: false, error: r?.error ? plainOrFallback(r.error, fallback) : friendlyError(error, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** An add-on: set_addon_selection with every OTHER unpaid add-on kept as it is. */
export async function removeAddon(applicationId: string, invoiceId: string): Promise<Result> {
  const fallback = 'This add-on could not be removed. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const { data: rows, error: readErr } = await c
      .from('invoices')
      .select('id, config_id, quantity, status')
      .eq('application_id', applicationId)
      .eq('kind', 'addon')
      .in('status', ['open', 'partial']);
    if (readErr) return { ok: false, error: friendlyError(readErr, fallback) };
    const keep = ((rows ?? []) as { id: string; config_id: string | null; quantity: number | null }[])
      .filter(r => r.id !== invoiceId && r.config_id)
      .map(r => ({ addon_id: r.config_id as string, quantity: r.quantity || 1 }));
    const { data, error } = await c.rpc('set_addon_selection', { p_application_id: applicationId, p_selections: keep });
    const r = data as { ok?: boolean; error?: string } | null;
    if (error || (r && r.ok === false)) return { ok: false, error: r?.error ? plainOrFallback(r.error, fallback) : friendlyError(error, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export type CheckoutAnswer =
  | { ok: true; embedded: true; clientSecret: string; sessionId: string; stripeAccount: string | null }
  | { ok: true; embedded: false; url: string }
  | { ok: false; error: string };

/** create-checkout's invoiceIds path; embedded when a publishable key exists. */
export async function startCheckout(invoiceIds: string[], embedded: boolean): Promise<CheckoutAnswer> {
  const fallback = "We couldn't open the card payment. Try again in a moment.";
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.functions.invoke('create-checkout', { body: embedded ? { invoiceIds, embedded: true } : { invoiceIds } });
    if (error) return { ok: false, error: plainOrFallback(await extractFunctionErrorMessage(error), fallback) };
    const r = data as { ok?: boolean; url?: string; client_secret?: string; session_id?: string; stripe_account?: string | null; error?: string } | null;
    if (!r?.ok) return { ok: false, error: plainOrFallback(r?.error, fallback) };
    if (embedded && r.client_secret) {
      return { ok: true, embedded: true, clientSecret: r.client_secret, sessionId: r.session_id ?? '', stripeAccount: r.stripe_account ?? null };
    }
    if (r.url) return { ok: true, embedded: false, url: r.url };
    return { ok: false, error: fallback };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export const KIND_GROUP: Record<string, string> = {
  role_fee: 'Tickets',
  pledge_spot: 'Delegate tickets',
  advisor_spot: 'Advisor tickets',
  app_fee: 'Registration fee',
  addon: 'Add-ons',
  surcharge: 'Ticket differences',
};
export const KIND_ORDER = ['role_fee', 'pledge_spot', 'advisor_spot', 'app_fee', 'addon', 'surcharge'];

const formatters = new Map<string, Intl.NumberFormat>();
/** Minor units in a currency, with separators in the reader's locale. */
export function money(cents: number, currency: string): string {
  const cur = (currency || 'USD').toUpperCase();
  const amount = (cents || 0) / 100;
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  const key = `${cur}:${whole ? 0 : 1}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, whole
        ? { style: 'currency', currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 }
        : { style: 'currency', currency: cur });
    } catch {
      return `${cur} ${amount.toFixed(2)}`;
    }
    formatters.set(key, f);
  }
  return f.format(amount);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
