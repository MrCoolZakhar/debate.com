'use client';

// Data for the applicant pop-up (ApplicantDetailDialog).
//
// Nothing here refetches the applications list. The row itself arrives from
// the page, already loaded. What the row does not carry (the MUN CV, and this
// person's invoices and payments) is read here, once per applicant per page
// session, and kept in a module-level cache so opening the same person again,
// or switching tabs back and forth, never waits on the network twice.
//
// Money rule (CLAUDE.md §3): every amount shown comes from the payments
// ledger (invoices + payments), never from applications.payment_status. A
// free chair is stamped 'paid' on arrival and a pledge-covered member is
// 'paid' with no money of their own, so that flag is an access flag only.

import { useCallback, useEffect, useState } from 'react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';

// ── Shapes ──────────────────────────────────────────────────────────────────

/** The subset of the applications page row this pop-up reads. The page's own
 *  Application type is structurally a superset of this. */
export interface ApplicantApp {
  id: string;
  user_id: string | null;
  role: string;
  status: string;
  is_head_delegate: boolean;
  payment_status: string | null;
  submitted_at: string;
  checked_in_at: string | null;
  organizer_note: string | null;
  resubmitted_at: string | null;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null; topics: string[] | null; logo_url: string | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null; date_of_birth: string | null; mun_experience_level: string | null } | null;
  societies: { name: string } | null;
  society_id: string | null;
  application_preferences: {
    preference_order: number;
    conference_committee_id: string;
    country_code: string;
    country_name: string;
    conference_committees: { name: string; abbreviation: string | null; logo_url: string | null } | null;
  }[];
  experience_entries: {
    id: string;
    entry_type: string;
    conference_name: string;
    committee: string;
    allocation: string;
    event_date: string | null;
    awards: string[];
    description: string | null;
  }[];
}

export interface CvEntry {
  id: string;
  entry_type: string | null;
  conference_name: string;
  committee: string | null;
  allocation: string | null;
  awards: string[] | null;
  award: string | null;
  logo_url: string | null;
  event_date: string | null;
  description: string | null;
  /** 'gavelling_verified' = written by the awards pipeline (blue seal). */
  source: string | null;
}

export interface LedgerBatch {
  id: string;
  method: 'stripe' | 'manual' | 'organizer' | string;
  status: 'pending' | 'paid' | 'rejected' | string;
  proof_path: string | null;
  proof_uploaded_at: string | null;
  paid_at: string | null;
}

export interface LedgerPayment {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'succeeded' | 'pending' | string;
  type: string | null;
  method: string | null;
  note: string | null;
  created_at: string;
  batch: LedgerBatch | null;
}

export interface LedgerInvoice {
  id: string;
  kind: string;
  label: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  aid_applied_cents: number;
  currency: string;
  status: 'open' | 'partial' | 'settled' | 'waived' | 'void' | string;
  application_id: string | null;
  covers_application_id: string | null;
  quantity: number | null;
  created_at: string;
  payments: LedgerPayment[];
}

export interface Ledger {
  invoices: LedgerInvoice[];
}

// ── A tiny keyed cache with in-flight de-duplication ────────────────────────

type Entry<T> = { data?: T; error?: string; promise?: Promise<void> };

function makeCache<T>() {
  const map = new Map<string, Entry<T>>();
  const listeners = new Map<string, Set<() => void>>();
  const emit = (k: string) => listeners.get(k)?.forEach(fn => fn());
  return {
    get: (k: string) => map.get(k),
    load(k: string, fetcher: () => Promise<T>, fallback: string, force = false) {
      const cur = map.get(k);
      if (!force && cur && (cur.data !== undefined || cur.promise)) return;
      const entry: Entry<T> = { data: force ? cur?.data : undefined };
      entry.promise = fetcher()
        .then(d => { entry.data = d; entry.error = undefined; })
        .catch(e => { entry.error = friendlyError(e, fallback); })
        .finally(() => { entry.promise = undefined; emit(k); });
      map.set(k, entry);
      emit(k);
    },
    subscribe(k: string, fn: () => void) {
      if (!listeners.has(k)) listeners.set(k, new Set());
      listeners.get(k)!.add(fn);
      return () => { listeners.get(k)?.delete(fn); };
    },
  };
}

function useCached<T>(
  cache: ReturnType<typeof makeCache<T>>,
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  fallback: string,
) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!key) return;
    const off = cache.subscribe(key, () => bump(n => n + 1));
    if (fetcher) cache.load(key, fetcher, fallback);
    return off;
    // The fetcher closes over the key; re-running on its identity would
    // defeat the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const entry = key ? cache.get(key) : undefined;
  const reload = useCallback(() => {
    if (key && fetcher) cache.load(key, fetcher, fallback, true);
  }, [cache, key, fetcher, fallback]);
  return {
    data: entry?.data,
    error: entry?.error,
    loading: !!entry?.promise && entry?.data === undefined,
    refreshing: !!entry?.promise && entry?.data !== undefined,
    reload,
  };
}

// ── MUN CV (mun_cv_entries is readable by anyone: "Anyone can read CV entries") ──

const cvCache = makeCache<CvEntry[]>();

export function useApplicantCv(userId: string | null, accessToken: string | null) {
  const fetcher = userId && accessToken ? async () => {
    const supabase = getAuthedClient(accessToken);
    const { data, error } = await supabase
      .from('mun_cv_entries')
      .select('id, entry_type, conference_name, committee, allocation, awards, award, logo_url, event_date, description, source')
      .eq('user_id', userId);
    if (error) throw error;
    return ((data ?? []) as CvEntry[]).slice().sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''));
  } : null;
  return useCached(cvCache, userId && accessToken ? userId : null, fetcher, 'Could not load their MUN record. Try again.');
}

// ── Payments ledger ─────────────────────────────────────────────────────────

const ledgerCache = makeCache<Ledger>();

/** Invoices in this applicant's name, plus any invoice that covers them (a
 *  delegation's pledged spot pays for a member through the delegation's own
 *  invoice), each with its payments and the batch that carries the method
 *  and any proof. RLS: organisers read conference invoices / payments /
 *  batches. The cache key carries the application's status and payment flag,
 *  so a mark-paid or an acceptance made from this very pop-up re-reads the
 *  ledger instead of showing a stale one. */
export function useApplicantLedger(app: ApplicantApp, accessToken: string | null) {
  const key = accessToken ? `${app.id}|${app.status}|${app.payment_status ?? ''}` : null;
  const fetcher = accessToken ? async (): Promise<Ledger> => {
    const supabase = getAuthedClient(accessToken);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, kind, label, amount_cents, amount_paid_cents, aid_applied_cents, currency, status,
        application_id, covers_application_id, quantity, created_at,
        payments (
          id, amount_cents, currency, status, type, method, note, created_at,
          batch:payment_batches (id, method, status, proof_path, proof_uploaded_at, paid_at)
        )
      `)
      .or(`application_id.eq.${app.id},covers_application_id.eq.${app.id}`)
      .neq('status', 'void')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const invoices = ((data ?? []) as unknown as LedgerInvoice[]).map(inv => ({
      ...inv,
      payments: (inv.payments ?? [])
        .map(p => ({ ...p, batch: Array.isArray(p.batch) ? (p.batch[0] ?? null) : p.batch }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
    return { invoices };
  } : null;
  return useCached(ledgerCache, key, fetcher, 'Could not load their payments. Try again.');
}

export interface LedgerTotals {
  currency: string;
  /** Succeeded Stripe payments: money that came in through Gavelling. */
  receivedCents: number;
  /** Succeeded manual payments (organiser mark-paid, approved proof). Never added to received. */
  offlineCents: number;
  /** Open balances of invoices in their name. */
  outstandingCents: number;
  billedCents: number;
  aidCents: number;
  pendingProofs: number;
  otherCurrencies: string[];
}

export function ledgerTotals(ledger: Ledger | undefined): LedgerTotals | null {
  if (!ledger || ledger.invoices.length === 0) return null;
  const byCur = new Map<string, number>();
  ledger.invoices.forEach(i => byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + i.amount_cents));
  const currency = [...byCur.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const t: LedgerTotals = {
    currency, receivedCents: 0, offlineCents: 0, outstandingCents: 0, billedCents: 0, aidCents: 0,
    pendingProofs: 0, otherCurrencies: [...byCur.keys()].filter(c => c !== currency),
  };
  for (const inv of ledger.invoices) {
    if (inv.currency !== currency) continue;
    t.billedCents += inv.amount_cents;
    t.aidCents += inv.aid_applied_cents ?? 0;
    if (inv.status === 'open' || inv.status === 'partial') {
      t.outstandingCents += Math.max(0, inv.amount_cents - inv.amount_paid_cents);
    }
    for (const p of inv.payments) {
      if (p.status === 'succeeded') {
        if (p.method === 'stripe') t.receivedCents += p.amount_cents;
        else t.offlineCents += p.amount_cents;
      } else if (p.status === 'pending' && p.type === 'manual_proof') {
        t.pendingProofs += 1;
      }
    }
  }
  return t;
}

/** Signed link to a payment proof in the private bucket (same call and
 *  lifetime Financials → Invoices uses). */
export async function proofUrl(accessToken: string, path: string): Promise<string> {
  const supabase = getAuthedClient(accessToken);
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('no url');
  return data.signedUrl;
}

