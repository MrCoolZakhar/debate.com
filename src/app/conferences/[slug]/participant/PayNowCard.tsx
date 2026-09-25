'use client';

// "Pay now": what the signed-in participant owes today, from my_open_balances()
// (open / partial invoices that are payable now: accepted, or payable before
// acceptance; their own or their delegation's as its lead). One row per
// conference and currency, with the amount, the due date when the organiser set
// one (invoices.due_date), and a button to /conferences/<slug>/pay.
//
// Two shapes: `PayNowCard` for one conference (the participant page) and
// `PaymentsDueSection` for every conference (/account/conferences). Both render
// nothing when nothing is owed, and nothing on a failed read (the /pay page
// stays reachable from the application card either way).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, ArrowRight, CalendarClock } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { centsToFee } from '@/lib/invoices';
import { SectionCard, OUTFIT } from './shared';

export interface OpenBalance {
  conference_id: string;
  slug: string;
  acronym: string | null;
  full_name: string | null;
  logo_url: string | null;
  start_date: string | null;
  currency: string;
  due_cents: number;
  items: number;
  due_date: string | null;
  payments_ready: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
function isOverdue(iso: string): boolean {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso.slice(0, 10) < t;
}

export function useOpenBalances(userId: string | null, conferenceId?: string | null) {
  // Rows are kept with the key they were read for, so signing out (no user)
  // reads as null without a synchronous setState in the effect.
  const key = userId ? `${userId}|${conferenceId ?? ''}` : null;
  const [loaded, setLoaded] = useState<{ key: string; rows: OpenBalance[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client.rpc('my_open_balances', { p_conference: conferenceId ?? null });
      if (cancelled) return;
      setLoaded({ key, rows: error ? [] : ((data as OpenBalance[] | null) ?? []) });
    })();
    return () => { cancelled = true; };
  }, [key, conferenceId]);
  return key && loaded?.key === key ? loaded.rows : null;
}

function BalanceRow({ b, showConference }: { b: OpenBalance; showConference: boolean }) {
  const overdue = b.due_date ? isOverdue(b.due_date) : false;
  const name = b.acronym || b.full_name || 'Conference';
  return (
    <div className="flex items-center gap-3.5 flex-wrap">
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(27,56,40,0.07)' }}
      >
        <CreditCard size={18} strokeWidth={2} style={{ color: '#1B3828' }} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        {showConference && (
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: '#6B5F52', margin: 0 }}>{name}</p>
        )}
        <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 800, color: '#1C1410', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {centsToFee(b.due_cents, b.currency)}
        </p>
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: overdue ? '#8B2020' : '#6B5F52', margin: '2px 0 0 0' }}>
          {b.due_date ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} aria-hidden />
              {overdue ? `Was due ${fmtDay(b.due_date)}` : `Due by ${fmtDay(b.due_date)}`}
            </span>
          ) : (
            `${b.items} ${b.items === 1 ? 'item' : 'items'} to pay`
          )}
        </p>
      </div>
      {b.payments_ready ? (
        <Link
          href={`/conferences/${b.slug}/pay`}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 focus:outline-none flex-shrink-0"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
        >
          Pay now <ArrowRight size={14} aria-hidden />
        </Link>
      ) : (
        <p className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 12, color: '#6B5F52', margin: 0, maxWidth: 220 }}>
          The organisers have not opened payments yet.
        </p>
      )}
    </div>
  );
}

/** One conference, on the participant page. */
export function PayNowCard({ userId, conferenceId }: { userId: string | null; conferenceId: string }) {
  const rows = useOpenBalances(userId, conferenceId);
  if (!rows || rows.length === 0) return null;
  return (
    <SectionCard>
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
        PAYMENT DUE
      </p>
      <div className="flex flex-col gap-4">
        {rows.map(b => <BalanceRow key={`${b.conference_id}:${b.currency}`} b={b} showConference={false} />)}
      </div>
    </SectionCard>
  );
}

/** Every conference, on /account/conferences. */
export function PaymentsDueSection({ userId }: { userId: string | null }) {
  const rows = useOpenBalances(userId, null);
  if (!rows || rows.length === 0) return null;
  return (
    <section className="mb-8" aria-label="Payments due">
      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.18em', color: '#8A6614', margin: '0 0 10px 0' }}>
        PAYMENTS DUE
      </p>
      <SectionCard>
        <div className="flex flex-col gap-4">
          {rows.map(b => <BalanceRow key={`${b.conference_id}:${b.currency}`} b={b} showConference />)}
        </div>
      </SectionCard>
    </section>
  );
}
