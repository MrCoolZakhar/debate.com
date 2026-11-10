// paymentWaysApi.ts — payment methods (prompt 31; the list, prompt 34).
//
// The conference's own set-up (set_payment_setup) is the FIRST method, named by
// conferences.payment_method_name. Up to 4 more MANUAL methods (5 in all) sit
// beside it, each with a name payers see when they pick how to pay:
//   payment_ways_list               what the organiser has (organisers only)
//   set_payment_method_name         the first method's name
//   payment_way_save                add (p_way_id null) or edit one other method
//   payment_way_remove              hides it; payments already started on it stay reviewable
//   payment_method_remove_main      removes the first method; the next one takes its place
//   payment_method_card_first       adds card as the first method; the manual one moves into the list
// Every answer is { ok, error?, field?, code? }; refusals are sentences.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import type { BankDetails } from './paymentApi';

export type WayKind = 'link' | 'qr' | 'bank' | 'in_person' | 'phone';

export interface PaymentWay {
  id: string;
  name: string;
  manual_kind: WayKind;
  payment_url: string | null;
  instructions: string | null;
  qr_path: string | null;
  bank: Partial<BankDetails> | null;
  phone: string | null;
  hidden: boolean;
  complete: boolean;
  payments_count: number;
  open_payments: number;
}

export interface WaysList { mainName: string | null; canAdd: boolean; ways: PaymentWay[] }

export type WayResult = { ok: true; id?: string; openPayments?: number } | { ok: false; error: string; field?: string; code?: string };

export const WAY_KIND_LABEL: Record<WayKind | 'card', string> = {
  card: 'Card',
  bank: 'Bank transfer',
  qr: 'QR code',
  link: 'Payment link',
  phone: 'Phone',
  in_person: 'In person',
};

const SESSION_GONE = 'Your session has expired. Please sign in again.';

async function rpc(fn: string, args: Record<string, unknown>, fallback: string): Promise<{ a: Record<string, unknown> } | { ok: false; error: string; field?: string; code?: string }> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SESSION_GONE };
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
    return { a };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** The organiser's methods; hidden (removed) ones are left out. */
export async function readPaymentWays(conferenceId: string): Promise<WaysList | { error: string }> {
  const r = await rpc('payment_ways_list', { p_conference_id: conferenceId }, 'Your payment methods could not be read. Try again in a moment.');
  if (!('a' in r)) return { error: r.error };
  const ways = Array.isArray(r.a.ways) ? (r.a.ways as PaymentWay[]) : [];
  return {
    mainName: typeof r.a.main_name === 'string' && r.a.main_name.trim() ? r.a.main_name.trim() : null,
    canAdd: r.a.can_add !== false,
    ways: ways.filter(w => !w.hidden),
  };
}

export async function setMainMethodName(conferenceId: string, name: string): Promise<WayResult> {
  const r = await rpc('set_payment_method_name', { p_conference_id: conferenceId, p_name: name.trim() }, 'The name could not be saved. Try again in a moment.');
  return 'a' in r ? { ok: true } : r;
}

export async function savePaymentWay(args: {
  conferenceId: string;
  wayId: string | null;
  name: string;
  kind: WayKind;
  url: string;
  note: string;
  qrPath: string | null;
  bank: BankDetails;
  phone: string;
}): Promise<WayResult> {
  const r = await rpc('payment_way_save', {
    p_conference_id: args.conferenceId,
    p_way_id: args.wayId,
    p_name: args.name.trim(),
    p_manual_kind: args.kind,
    p_url: args.kind === 'link' ? args.url.trim() || null : null,
    p_note: args.note.trim() || null,
    p_qr_path: args.kind === 'qr' ? args.qrPath : null,
    p_bank: args.kind === 'bank' ? { ...args.bank, swift: args.bank.swift.trim().toUpperCase() } : null,
    p_phone: args.kind === 'phone' ? args.phone.trim() || null : null,
  }, 'This payment method could not be saved. Try again in a moment.');
  if (!('a' in r)) return r;
  return { ok: true, id: typeof r.a.id === 'string' ? r.a.id : undefined };
}

export async function removePaymentWay(wayId: string): Promise<WayResult> {
  const r = await rpc('payment_way_remove', { p_way_id: wayId }, 'This payment method could not be removed. Try again in a moment.');
  if (!('a' in r)) return r;
  return { ok: true, openPayments: typeof r.a.open_payments === 'number' ? r.a.open_payments : 0 };
}

/** Removes the first method: the next one takes its place, or payments switch off when it was the last. */
export async function removeFirstMethod(conferenceId: string): Promise<{ ok: true; last: boolean; nowFirst: string | null; openPayments: number } | { ok: false; error: string; field?: string; code?: string }> {
  const r = await rpc('payment_method_remove_main', { p_conference_id: conferenceId }, 'This payment method could not be removed. Try again in a moment.');
  if (!('a' in r)) return r;
  return {
    ok: true,
    last: r.a.last === true,
    nowFirst: typeof r.a.now_first === 'string' && r.a.now_first.trim() ? r.a.now_first.trim() : null,
    openPayments: typeof r.a.open_payments === 'number' ? r.a.open_payments : 0,
  };
}

/** Adds card as the first method; the current manual first method moves into the list. */
export async function addCardFirst(conferenceId: string, name: string, payoutCountry: string): Promise<{ ok: true; connectStatus: string | null; ready: boolean } | { ok: false; error: string; field?: string; code?: string }> {
  const r = await rpc('payment_method_card_first', { p_conference_id: conferenceId, p_name: name.trim(), p_payout_country: payoutCountry || null }, 'Card payments could not be added. Try again in a moment.');
  if (!('a' in r)) return r;
  return { ok: true, connectStatus: typeof r.a.connect_status === 'string' ? r.a.connect_status : null, ready: r.a.ready === true };
}
