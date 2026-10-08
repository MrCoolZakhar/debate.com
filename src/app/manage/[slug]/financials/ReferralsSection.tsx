'use client';

/**
 * ReferralsSection — who referred whom, and what they paid.
 *
 * WHY IT LIVES IN FINANCIALS
 * The question is "which ambassador sent this delegate or delegation, and how
 * much money came in from them". Both halves are money, both are already
 * permissioned by `financials`, and the answer is a per-ambassador table, not
 * a chip on a row. A column in Applications would answer a different
 * question (what is this one person's code) and would mean loading vouchers
 * and invoices into the biggest file in the repo.
 *
 * WHERE THE DATA COMES FROM
 * A referral is a `voucher_redemptions` row, NOT a stamp on an invoice. See
 * scratchpad/ambassadors/referral-vouchers.sql for why: apply_voucher needs
 * an open role_fee invoice, which a pre-acceptance applicant, a free role and
 * a delegation leader paying pledge spots all lack. So:
 *   vouchers              kind = 'referral' for this conference  (the codes)
 *   voucher_redemptions   context 'conference_signup'            (who used one)
 *   applications          the person, their role, their delegation
 *   invoices              what was actually PAID, from the ledger
 *
 * Money shown is the ledger, never payment_status (CLAUDE.md §3): a row's
 * paid figure is the sum of invoices.amount_paid_cents, so a free chair
 * stamped 'paid' contributes nothing and a part payment shows what landed.
 *
 * A DELEGATION'S money is every invoice of that society, not just the
 * leader's own registration: the leader who typed the code is the one who
 * pays the pledge spots and the advisor tickets.
 *
 * Nothing here writes. Every read is the organiser's own RLS (vouchers and
 * voucher_redemptions both carry an is_conference_organizer policy), so there
 * is no RPC and no SECURITY DEFINER path to review.
 *
 * Inert until the migration runs: with no referral vouchers it renders
 * nothing at all.
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Handshake, Search } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { cents } from './financialsApi';
import {
  NEU, NEU_GRADIENTS, OUTFIT,
  NeuCard, NeuInset, NeuPill, NeuIconDisc,
} from '@/components/neu';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReferralVoucher { id: string; code: string; active: boolean }

interface Redemption {
  voucher_id: string;
  application_id: string | null;
  user_id: string;
  created_at: string;
}

interface AppRow {
  id: string;
  role: string;
  status: string;
  society_id: string | null;
  invited_name: string | null;
  profiles: { display_name: string | null } | null;
  societies: { name: string | null } | null;
}

interface InvoiceRow {
  id: string;
  application_id: string | null;
  society_id: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string | null;
  status: string;
}

/** One referred person, under the ambassador whose code they used. */
interface Referred {
  applicationId: string;
  name: string;
  role: string;
  status: string;
  delegation: string | null;
  /** Money that actually landed, in minor units. */
  paidCents: number;
  /** Still open on their invoices (and their delegation's, for a leader). */
  outstandingCents: number;
  at: string;
}

interface Row {
  code: string;
  active: boolean;
  people: Referred[];
  paidCents: number;
  outstandingCents: number;
}

const ROLE_LABEL: Record<string, string> = {
  delegate: 'Delegate',
  'head-delegate': 'Head delegate',
  'faculty-advisor': 'Faculty advisor',
  observer: 'Observer',
  chair: 'Chair',
  secretariat: 'Secretariat',
  staff: 'Staff',
};

/** A leader's money is their delegation's money: they are the one who pays
 *  the pledged spots and the advisor tickets. */
function leadsDelegation(role: string): boolean {
  return role === 'faculty-advisor' || role === 'head-delegate';
}

// ── Section ────────────────────────────────────────────────────────────────

export default function ReferralsSection({ conference }: { conference: Conference }) {
  const { session } = useAuth();
  const [vouchers, setVouchers] = useState<ReferralVoucher[] | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [onlyUsed, setOnlyUsed] = useState(false);

  // One batched read, the same shape as useFinancialsData in shared.tsx.
  // Nothing is fetched beyond the referral codes when there are none.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data: vs } = await supabase
        .from('vouchers')
        .select('id, code, active')
        .eq('scope', 'conference')
        .eq('conference_id', conference.id)
        .eq('kind', 'referral')
        .order('code', { ascending: true });
      if (cancelled) return;
      const codes = (vs ?? []) as ReferralVoucher[];
      setVouchers(codes);
      if (codes.length === 0) return;

      const { data: rs } = await supabase
        .from('voucher_redemptions')
        .select('voucher_id, application_id, user_id, created_at')
        .in('voucher_id', codes.map(v => v.id))
        .eq('context', 'conference_signup')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const reds = ((rs ?? []) as Redemption[]).filter(r => r.application_id);
      setRedemptions(reds);
      if (reds.length === 0) return;

      const [{ data: as }, { data: invs }] = await Promise.all([
        supabase
          .from('applications')
          .select('id, role, status, society_id, invited_name, profiles (display_name), societies (name)')
          .eq('conference_id', conference.id)
          .in('id', reds.map(r => r.application_id as string)),
        supabase
          .from('invoices')
          .select('id, application_id, society_id, amount_cents, amount_paid_cents, currency, status')
          .eq('conference_id', conference.id),
      ]);
      if (cancelled) return;
      setApps((as ?? []) as unknown as AppRow[]);
      setInvoices((invs ?? []) as InvoiceRow[]);
    })();
    return () => { cancelled = true; };
  }, [conference.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<{ rows: Row[]; totalPaidCents: number }>(() => {
    if (!vouchers) return { rows: [], totalPaidCents: 0 };
    const appById = new Map(apps.map(a => [a.id, a] as const));
    const live = invoices.filter(inv => inv.status !== 'void');

    // One referral per application, the EARLIEST (redemptions arrive ordered
    // by created_at). A second code typed later never re-credits.
    const creditedApps = new Set<string>();
    const peopleByVoucher = new Map<string, Referred[]>();
    // Every invoice attributed to SOME ambassador, so the figure at the top
    // counts each invoice once even in the odd case of two referred leaders
    // in one delegation (each of their rows shows the delegation's money).
    const attributed = new Set<string>();

    for (const r of redemptions) {
      const appId = r.application_id as string;
      if (creditedApps.has(appId)) continue;
      creditedApps.add(appId);
      const a = appById.get(appId);
      if (!a) continue; // another conference, or the row is gone
      // A leader's figure is their DELEGATION's money: they are the one who
      // pays the pledged spots and the advisor tickets. Matched by invoice,
      // not by two sums: their own registration carries no society_id while
      // their spot invoices carry both, so adding an application fold to a
      // society fold would count the spots twice.
      const isLeader = leadsDelegation(a.role) && !!a.society_id;
      let paidCents = 0;
      let outstandingCents = 0;
      for (const inv of live) {
        const mine = inv.application_id === appId
          || (isLeader && inv.society_id !== null && inv.society_id === a.society_id);
        if (!mine) continue;
        const paid = Number(inv.amount_paid_cents) || 0;
        paidCents += paid;
        outstandingCents += Math.max(0, (Number(inv.amount_cents) || 0) - paid);
        attributed.add(inv.id);
      }
      const list = peopleByVoucher.get(r.voucher_id) ?? [];
      list.push({
        applicationId: appId,
        name: a.profiles?.display_name?.trim() || a.invited_name?.trim() || 'Name not set',
        role: ROLE_LABEL[a.role] ?? a.role,
        status: a.status,
        delegation: a.societies?.name?.trim() || null,
        paidCents,
        outstandingCents,
        at: r.created_at,
      });
      peopleByVoucher.set(r.voucher_id, list);
    }

    const byId = new Map(live.map(inv => [inv.id, inv] as const));
    const totalPaidCents = [...attributed]
      .reduce((sum, id) => sum + (Number(byId.get(id)?.amount_paid_cents) || 0), 0);

    const out = vouchers.map(v => {
      const people = peopleByVoucher.get(v.id) ?? [];
      return {
        code: v.code,
        active: v.active,
        people,
        paidCents: people.reduce((sum, p) => sum + p.paidCents, 0),
        outstandingCents: people.reduce((sum, p) => sum + p.outstandingCents, 0),
      };
    }).sort((a, b) => b.paidCents - a.paidCents || b.people.length - a.people.length || a.code.localeCompare(b.code));

    return { rows: out, totalPaidCents };
  }, [vouchers, redemptions, apps, invoices]);

  const currency = conference.fee_currency || 'USD';
  const codeRows = rows.rows;
  const shown = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/\s+/g, '');
    return codeRows.filter(r => (!onlyUsed || r.people.length > 0) && (!q || r.code.includes(q)));
  }, [codeRows, query, onlyUsed]);

  const totalPeople = codeRows.reduce((sum, r) => sum + r.people.length, 0);
  const totalPaid = rows.totalPaidCents;
  const usedCodes = codeRows.filter(r => r.people.length > 0).length;

  // Nothing to say until referral codes exist. This is what keeps the
  // section inert before the migration runs.
  if (!vouchers || vouchers.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Handshake} emoji="Handshake" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Referrals
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
            Who referred each delegate or delegation, and what has been paid. Referral codes never change a price.
          </p>
        </div>
      </div>

      {/* Three plain figures, no pills (CLAUDE.md §8: a big number with the
          word beside it). */}
      <NeuCard style={{ padding: '14px 18px' }}>
        <div className="flex items-center gap-8 flex-wrap">
          <Stat value={String(totalPeople)} label={totalPeople === 1 ? 'person referred' : 'people referred'} />
          <Stat value={`${usedCodes}/${codeRows.length}`} label="codes used" />
          <Stat value={cents(totalPaid, currency)} label="paid in" />
        </div>
      </NeuCard>

      {/* Search + the one filter */}
      <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0" style={{ maxWidth: 340 }}>
          <Search
            size={14}
            strokeWidth={2.4}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: NEU.muted }}
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search codes"
            aria-label="Search referral codes"
            spellCheck={false}
            style={{
              width: '100%', padding: '9px 12px 9px 32px', borderRadius: 12, border: 'none', outline: 'none',
              backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink,
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            }}
          />
        </div>
        <NeuPill active={onlyUsed} gradient={NEU_GRADIENTS.forest} onClick={() => setOnlyUsed(v => !v)}>
          Used only
        </NeuPill>
      </div>

      {shown.length === 0 ? (
        <NeuInset className="px-6 py-6 text-center">
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
            {onlyUsed && !query.trim() ? 'No referral code has been used yet' : `No code matches ${query.trim()}`}
          </p>
        </NeuInset>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map(r => {
            const open = openCode === r.code;
            return (
              <NeuCard key={r.code} style={{ padding: '12px 16px', opacity: r.active ? 1 : 0.78 }}>
                <button
                  type="button"
                  onClick={() => setOpenCode(open ? null : r.code)}
                  disabled={r.people.length === 0}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 flex-wrap text-left focus:outline-none"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: r.people.length === 0 ? 'default' : 'pointer' }}
                >
                  {/* Two rows, never an ellipsis: the code is a person's name
                      (CLAUDE.md §8). */}
                  <span
                    style={{
                      fontFamily: OUTFIT, fontWeight: 900, fontSize: 13.5, color: NEU.ink,
                      letterSpacing: '0.05em', minWidth: 150, flex: '1 1 200px',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {r.code}
                    {!r.active && (
                      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: NEU.muted, letterSpacing: 0 }}>
                        Inactive
                      </span>
                    )}
                  </span>

                  <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: r.people.length ? NEU.ink : NEU.muted, fontVariantNumeric: 'tabular-nums', minWidth: 96 }}>
                    {r.people.length === 0 ? 'Not used yet' : `${r.people.length} ${r.people.length === 1 ? 'person' : 'people'}`}
                  </span>

                  <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.forest, fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>
                    {cents(r.paidCents, currency)}
                  </span>

                  {r.outstandingCents > 0 && (
                    <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                      {cents(r.outstandingCents, currency)} outstanding
                    </span>
                  )}

                  <span className="flex-1" />

                  {r.people.length > 0 && (
                    <ChevronDown
                      size={16}
                      strokeWidth={2.4}
                      aria-hidden="true"
                      style={{ color: NEU.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }}
                    />
                  )}
                </button>

                {open && (
                  <div className="mt-3 flex flex-col gap-2">
                    {r.people.map(p => (
                      <NeuInset key={p.applicationId} small className="px-3 py-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, flex: '1 1 180px', overflowWrap: 'anywhere' }}>
                            {p.name}
                            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: NEU.inkSoft }}>
                              {p.role}
                              {p.delegation ? ` · ${p.delegation}` : ''}
                            </span>
                          </span>
                          <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted, textTransform: 'capitalize' }}>
                            {p.status}
                          </span>
                          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>
                            {cents(p.paidCents, currency)}
                          </span>
                        </div>
                      </NeuInset>
                    ))}
                    {r.people.some(p => p.delegation) && (
                      <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.inkSoft, lineHeight: 1.6 }}>
                        A delegation leader&apos;s figure is everything their delegation has paid, spots and tickets included.
                      </p>
                    )}
                  </div>
                )}
              </NeuCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft }}>
        {label}
      </span>
    </span>
  );
}
