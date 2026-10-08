// paymentApi.ts — how a conference is paid (prompt 94).
//
// set_payment_setup is the ONE write for the payment method: card (Stripe) or
// ONE manual kind (a link, a QR code, bank details). Setting one keeps the
// other's details dormant, so switching back is one call. connect-onboard is
// unchanged: 'start' answers a Stripe onboarding url, 'status' the account's
// state. Every refusal is a sentence for people, with the field it is about.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';
import type { Conference } from '@/app/manage/[slug]/layout';

export type MethodKey = 'card' | 'link' | 'qr' | 'bank';
export type BankDetails = { account_name: string; account_number: string; swift: string; bank_name: string; reference: string };

export type SetupResult = { ok: true; ready: boolean; connectStatus?: string } | { ok: false; error: string; field?: string };

/** The method in force today, or null when nothing is set up. */
export function currentMethod(c: Pick<Conference, 'payment_method' | 'manual_kind'>): MethodKey | null {
  if (c.payment_method === 'stripe') return 'card';
  if (c.payment_method === 'manual') return c.manual_kind ?? 'link';
  return null;
}

export const METHOD_NAME: Record<MethodKey, string> = {
  card: 'card payments',
  link: 'a payment link',
  qr: 'a payment QR code',
  bank: 'bank transfer',
};

export async function setPaymentSetup(args: {
  conferenceId: string;
  country: string;
  method: MethodKey;
  url?: string;
  note?: string;
  qrPath?: string | null;
  bank?: BankDetails;
}): Promise<SetupResult> {
  const fallback = 'Your payment set-up could not be saved. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const manual = args.method !== 'card';
    const { data, error } = await c.rpc('set_payment_setup', {
      p_conference_id: args.conferenceId,
      p_payout_country: args.country,
      p_method: manual ? 'manual' : 'stripe',
      p_manual_kind: manual ? args.method : null,
      p_url: args.method === 'link' ? (args.url ?? '').trim() || null : null,
      p_note: manual ? (args.note ?? '').trim() || null : null,
      p_qr_path: args.method === 'qr' ? args.qrPath ?? null : null,
      p_bank: args.method === 'bank' ? args.bank ?? null : null,
    });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      return { ok: false, error: plainOrFallback(a?.error, fallback), field: typeof a?.field === 'string' ? a.field : undefined };
    }
    return { ok: true, ready: a.ready === true, connectStatus: typeof a.connect_status === 'string' ? a.connect_status : undefined };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** Uploads a payment QR image to conference-assets/<conference>/payment-qr/. */
export async function uploadPaymentQr(conferenceId: string, file: File): Promise<{ path: string } | { error: string }> {
  const fallback = 'The QR code could not be uploaded. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { error: 'Your session has expired. Please sign in again.' };
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-60) || 'qr';
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${conferenceId}/payment-qr/${rand}-${safe}`;
    const { error } = await c.storage.from('conference-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) return { error: friendlyError(error, fallback) };
    return { path };
  } catch (e) {
    return { error: friendlyError(e, fallback) };
  }
}

/** The public address of a QR stored in conference-assets. */
export async function qrPublicUrl(path: string): Promise<string | null> {
  const c = await getFreshAuthedClient();
  if (!c) return null;
  return c.storage.from('conference-assets').getPublicUrl(path).data.publicUrl ?? null;
}

export async function connectStart(conferenceId: string, countryCode: string | null): Promise<{ url: string } | { error: string }> {
  const fallback = 'Stripe did not answer. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.functions.invoke('connect-onboard', {
      body: { conferenceId, action: 'start', ...(countryCode ? { country: countryCode } : {}) },
    });
    if (error) return { error: plainOrFallback(await extractFunctionErrorMessage(error), fallback) };
    const r = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!r?.ok || !r.url) return { error: plainOrFallback(r?.error, 'Stripe onboarding could not start. Try again in a moment.') };
    return { url: r.url };
  } catch (e) {
    return { error: friendlyError(e, fallback) };
  }
}

export async function connectStatus(conferenceId: string): Promise<{ status: string } | { error: string }> {
  const fallback = 'Stripe did not answer. Try again in a moment.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.functions.invoke('connect-onboard', { body: { conferenceId, action: 'status' } });
    if (error) return { error: plainOrFallback(await extractFunctionErrorMessage(error), fallback) };
    const r = data as { ok?: boolean; status?: string; error?: string } | null;
    if (!r?.ok || !r.status) return { error: plainOrFallback(r?.error, 'The Stripe account could not be checked. Try again in a moment.') };
    return { status: r.status };
  } catch (e) {
    return { error: friendlyError(e, fallback) };
  }
}

/** Stripe's requirement codes in plain words; one line per kind, never a code. */
export function requirementWords(codes: string[]): string[] {
  const out: string[] = [];
  const add = (w: string) => { if (!out.includes(w)) out.push(w); };
  for (const code of codes) {
    if (code.startsWith('tos_acceptance')) add("Accept Stripe's terms");
    else if (code === 'external_account' || code.startsWith('external_account')) add('Add your bank account');
    else if (code.includes('verification.document') || code.includes('verification.additional_document')) add('Verify your identity');
    else if (code === 'company.tax_id' || code.startsWith('company.tax_id')) add("Your organisation's tax ID");
    else if (code.startsWith('representative') || code.startsWith('person_') || code.startsWith('relationship')) add('Details about the person in charge');
    else if (code.startsWith('business_profile')) add("Your organisation's website or description");
    else if (code.startsWith('individual.') || code.startsWith('owners') || code.startsWith('directors') || code.startsWith('executives')) add('Your personal details');
    else if (code.startsWith('company.')) add("Your organisation's details");
    else add('Other details Stripe asks for');
  }
  return out;
}

/** current_deadline arrives as a Unix time in seconds (Stripe) or an ISO string. */
export function deadlineDate(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** sessionStorage, always in try/catch (private windows throw). */
export function sessionGet(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
export function sessionSet(key: string, value: string): void {
  try { window.sessionStorage.setItem(key, value); } catch { /* ignore */ }
}
export function sessionDel(key: string): void {
  try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
}

/** Set before leaving for Stripe from the welcome flow, so coming back resumes it at step 4. */
export const welcomeMarkerKey = (conferenceId: string) => `gavelling-fin-welcome-resume:${conferenceId}`;
/** The welcome flow opens by itself once per browser session. */
export const welcomeSeenKey = (conferenceId: string) => `gavelling-fin-welcome-seen:${conferenceId}`;
