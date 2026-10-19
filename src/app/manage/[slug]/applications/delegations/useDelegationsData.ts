'use client';

// useDelegationsData: everything the Delegations tab and the delegation pop-up
// read, in one place. The table and the pop-up are fed by the same load, so a
// number in a row and the same number in the pop-up can never disagree.
//
// Reads (all RLS-scoped to the conference's organisers):
//   societies                the delegations (name, place, crest)
//   applications             advisors_pledged (for the expected size), and the
//                            members themselves when the caller has not passed
//                            them in (the pop-up opened from another page)
//   invoices + payments      the payments ledger, for the Payments tab and who owes
//   conference_committees    with committee_country_slots and conference_allocations,
//                            for seats given, seats filled and free seats
//
// Keyed on the user id, never the token (CLAUDE.md §5); every read gets its
// client at call time. A re-read never blanks the screen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import {
  buildDelegationRows, sortDelegationRows,
  type DelegationMemberLite, type DelegationRow, type InvoiceLite, type PaymentLite, type SocietyLite,
} from '../delegationRows';
import { societySeatCounts, type SeatCommittee } from './societySeats';
import { paidSpotsBySociety } from '@/app/manage/[slug]/assignment/delegationSeatsGrid';

export interface DelegationView<M extends DelegationMemberLite = DelegationMemberLite> extends DelegationRow<M> {
  /** Delegate spots paid for, from the ledger: settled `pledge_spot` invoices of
   *  the delegation's live leaders plus delegates and head delegates who paid
   *  their own ticket or were waived. `paidSpotsBySociety` (delegationSeatsGrid.ts),
   *  the twin of `_society_paid_delegate_spots`, so the tab, the pop-up and the
   *  allocation page show one number. Never `societies.spots_purchased`. */
  paid: number;
  /** Seats the delegation holds: block seats plus seats of its members. Doubles count as 2. */
  seatsGiven: number;
  /** Of those, seats with a person on them. */
  seatsFilled: number;
  /** Paid spots still without a seat. */
  needSeats: number;
}

/** An invoice with the two columns the Payments tab also draws. */
export type InvoiceRow = InvoiceLite & { label: string | null; quantity: number | null };

const MEMBER_COLUMNS = `
  id, user_id, invited_name, invited_email, role, status, is_head_delegate, payment_status, self_paid, attending,
  pledge_type, spots_pledged, pledge_confirmed_at, society_id, submitted_at,
  assigned_committee_id, assigned_country_code, assigned_country_name,
  assigned_committee:conference_committees!assigned_committee_id (name, abbreviation),
  profiles (display_name, email, avatar_url, nationality)
`;

/** Reads every page of a query (PostgREST caps a response at 1,000 rows). */
async function pageAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: out, error: null };
}

export function useDelegationsData<M extends DelegationMemberLite>(args: {
  conferenceId: string;
  currency: string;
  /** The applications the page already loaded. Omit to load the delegations' members here. */
  applications?: M[];
  /** Open drafts naming a delegation ("still applying"). */
  drafts?: { society_id: string | null }[];
}) {
  const { conferenceId, currency, applications, drafts } = args;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const ownMembers = !applications;

  const [societies, setSocieties] = useState<SocietyLite[] | null>(null);
  const [loadedMembers, setLoadedMembers] = useState<M[]>([]);
  const [advisorsPledged, setAdvisorsPledged] = useState<Map<string, number>>(new Map());
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentLite[]>([]);
  const [committees, setCommittees] = useState<SeatCommittee[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [moneyUnavailable, setMoneyUnavailable] = useState(false);
  const [seatsUnavailable, setSeatsUnavailable] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!userId) return;
    const seq = ++loadSeq.current;
    const supabase = await getFreshAuthedClient();
    if (!supabase || seq !== loadSeq.current) return;
    const [socRes, advRes, invRes, payRes, comRes, memRes] = await Promise.all([
      supabase.from('societies')
        .select('id, name, spots_purchased, advisor_spots_purchased, created_at, city, country_code, logo_url')
        .eq('conference_id', conferenceId)
        .order('name', { ascending: true }),
      supabase.from('applications')
        .select('id, advisors_pledged')
        .eq('conference_id', conferenceId)
        .gt('advisors_pledged', 0),
      pageAll<InvoiceRow>((from, to) => supabase.from('invoices')
        .select('id, application_id, society_id, kind, status, amount_cents, amount_paid_cents, currency, label, quantity')
        .eq('conference_id', conferenceId)
        .order('id', { ascending: true })
        .range(from, to)),
      pageAll<PaymentLite>((from, to) => supabase.from('payments')
        .select('id, invoice_id, amount_cents, currency, method, invoices!inner(conference_id)')
        .eq('invoices.conference_id', conferenceId)
        .eq('status', 'succeeded')
        .order('id', { ascending: true })
        .range(from, to)),
      supabase.from('conference_committees')
        .select(`
          id, name, abbreviation, logo_url,
          committee_country_slots (id, country_code, country_name, delegation_size, is_observer),
          conference_allocations (id, country_code, country_name, seat, society_id, application_id, user_id)
        `)
        .eq('conference_id', conferenceId)
        .order('name', { ascending: true }),
      ownMembers
        ? pageAll<M>((from, to) => supabase.from('applications')
          .select(MEMBER_COLUMNS)
          .eq('conference_id', conferenceId)
          .not('society_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, to))
        : Promise.resolve({ data: [] as M[], error: null }),
    ]);
    if (seq !== loadSeq.current) return;
    if (socRes.error || memRes.error) {
      setLoadFailed(true);
      // Logged, never shown: the screen says what failed in plain words.
      friendlyError(socRes.error ?? memRes.error, 'The delegations could not be loaded.');
      return;
    }
    setLoadFailed(false);
    setSocieties((socRes.data ?? []) as SocietyLite[]);
    if (ownMembers) setLoadedMembers(memRes.data as M[]);
    const adv = new Map<string, number>();
    for (const r of (advRes.data ?? []) as { id: string; advisors_pledged: number | null }[]) adv.set(r.id, r.advisors_pledged ?? 0);
    setAdvisorsPledged(adv);
    // Money or seats failing must not blank the list: each part says it could not be read.
    setInvoices(invRes.error ? [] : invRes.data);
    setPayments(payRes.error ? [] : payRes.data);
    setMoneyUnavailable(!!(invRes.error || payRes.error));
    if (comRes.error) setSeatsUnavailable(true);
    else { setSeatsUnavailable(false); setCommittees((comRes.data ?? []) as unknown as SeatCommittee[]); }
  }, [userId, conferenceId, ownMembers]);

  const members = useMemo(() => applications ?? loadedMembers, [applications, loadedMembers]);

  // Re-read when the applications change in a way that can move money, spots
  // or seats, debounced so a bulk accept of forty rows is one read.
  const version = useMemo(
    () => (applications ?? []).map(a => `${a.id}:${a.status}:${a.payment_status}:${a.society_id ?? ''}:${a.assigned_committee_id ?? ''}`).join('|'),
    [applications],
  );
  const firstLoad = useRef(true);
  useEffect(() => {
    const delay = firstLoad.current ? 0 : 900;
    firstLoad.current = false;
    const t = setTimeout(() => { void load(); }, delay);
    return () => clearTimeout(t);
  }, [load, version]);

  const draftsBySociety = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of drafts ?? []) if (d.society_id) m.set(d.society_id, (m.get(d.society_id) ?? 0) + 1);
    return m;
  }, [drafts]);

  const rows = useMemo<DelegationView<M>[]>(() => {
    if (!societies) return [];
    const base = sortDelegationRows(buildDelegationRows<M>({
      societies, members, advisorsPledged, draftsBySociety, invoices, payments, currency,
    }));
    const paidBySociety = paidSpotsBySociety(
      members,
      invoices.filter(i => i.kind === 'pledge_spot' && i.status === 'settled').map(i => i.application_id),
    );
    return base.map(r => {
      const paid = paidBySociety.get(r.id) ?? 0;
      const ids = new Set(r.members.map(m => m.id));
      const { given, filled } = committees ? societySeatCounts(committees, r.id, ids) : { given: 0, filled: 0 };
      return { ...r, paid, seatsGiven: given, seatsFilled: filled, needSeats: Math.max(0, paid - given) };
    });
  }, [societies, members, advisorsPledged, draftsBySociety, invoices, payments, currency, committees]);

  return {
    rows,
    committees,
    invoices,
    payments,
    loading: societies === null && !loadFailed,
    loadFailed,
    moneyUnavailable,
    seatsUnavailable,
    reload: load,
  };
}

export type DelegationsData<M extends DelegationMemberLite = DelegationMemberLite> = ReturnType<typeof useDelegationsData<M>>;
