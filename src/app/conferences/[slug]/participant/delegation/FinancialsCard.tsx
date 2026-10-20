'use client';

// The leader card's Financials (taste board 1A; Christian's answers 6 and 7,
// 19 Oct 2026). Every number comes from what the database already gives:
// my_pay_overview (the leader's OWN items and payments, the same read as /pay)
// and the roster's payment status per member. Nothing here types a price or
// computes a second total; amounts go through the /pay page's formatter in the
// currency /pay picks (itemsCurrency, BalanceHeader.tsx).
//   paid                 totals.paid_cents, exactly /pay's Paid (card and accepted
//                        proofs, net of refunds)
//   Waiting for review   totals.in_review_cents, proofs not accepted yet, as /pay
//   Delegate Tickets     a COUNT of tickets, never an amount: this leader's
//   Advisor Tickets      pledge_spot / advisor_spot items plus their own ticket
//                        (a role_fee named "Delegate Ticket" / "Advisor Ticket",
//                        /pay's names); paid = the invoice is settled; void,
//                        refunded-and-closed and waived tickets are not counted
//   Members paying       members of the delegation whose own fee is still unpaid
//   Left to pay          totals.owed_cents
// Other leaders' tickets and payments are theirs (my_pay_overview reads the
// caller's own items only), so the ticket rows say "Your" when another leader
// has tickets too.

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { PayLink } from '../PaymentsLocked';
import { money, type PayItem, type PayOverview } from '../../pay/payApi';
import { itemsCurrency } from '../../pay/BalanceHeader';
import { BTN_CLASS, cardStyle, FONT, FOREST, INK, INK_SOFT, LINE, linkStyle, OWE, primaryBtn, STROKE } from './leaderKit';

/** Which ticket an item is, by /pay's kinds and names; null when it is not a ticket. */
function ticketOf(i: PayItem): 'delegate' | 'advisor' | null {
  if (i.kind === 'pledge_spot') return 'delegate';
  if (i.kind === 'advisor_spot') return 'advisor';
  if (i.kind === 'role_fee') {
    if (i.label.startsWith('Delegate Ticket')) return 'delegate';
    if (i.label.startsWith('Advisor Ticket')) return 'advisor';
  }
  return null;
}

function tally(items: PayItem[], which: 'delegate' | 'advisor') {
  const live = items.filter(i => i.owner_is_me && ticketOf(i) === which
    && i.status !== 'void' && i.status !== 'waived' && i.state !== 'refund_closed');
  return { total: live.length, done: live.filter(i => i.status === 'settled').length, payable: live.filter(i => i.payable).length };
}

export default function FinancialsCard({ pay, payError, societyId, membersOwing, conferenceId, slug }: {
  pay: PayOverview | null;
  payError: string | null;
  societyId: string;
  /** Members (not this leader) whose own fee is still unpaid. */
  membersOwing: number;
  conferenceId: string;
  slug: string;
}) {
  const row = (label: string, value: React.ReactNode, color?: string) => (
    <div className="flex items-baseline justify-between gap-3" style={{ fontFamily: FONT, fontSize: 14 }}>
      <span style={{ color: INK_SOFT }}>{label}</span>
      <span style={{ color: color ?? INK, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );

  let content: React.ReactNode;
  if (!pay) {
    content = payError
      ? <p role="alert" style={{ fontFamily: FONT, fontSize: 14, color: '#8B2020', margin: 0 }}>{payError}</p>
      : (
        <div className="flex flex-col gap-3" aria-hidden>
          <div style={{ height: 30, width: '60%', borderRadius: 8, background: '#F1ECE1' }} />
          <div style={{ height: 14, borderRadius: 6, background: '#F4F0E6' }} />
          <div style={{ height: 14, borderRadius: 6, background: '#F4F0E6' }} />
        </div>
      );
  } else {
    const cur = itemsCurrency(pay) ?? pay.conference.currency;
    const delegateFees = tally(pay.items, 'delegate');
    const advisorFees = tally(pay.items, 'advisor');
    const toPay = delegateFees.payable + advisorFees.payable;
    const mine = pay.delegation?.find(d => d.society_id === societyId) ?? null;
    const othersHaveTickets = !!mine?.leaders.some(l => !l.is_me && (l.delegate_tickets > 0 || l.advisor_tickets > 0));
    const your = othersHaveTickets ? 'Your ' : '';
    content = (
      <>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{money(pay.totals.paid_cents_in_currency ?? pay.totals.paid_cents, cur)}</span>
          <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>paid</span>
        </div>
        {/* my_pay_overview (Christian, 20 Oct 2026): paid_cents_in_currency is the
            conference currency only; payments in other currencies are named, never added. */}
        {(pay.totals.other_currencies?.length ?? 0) > 0 && (
          <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '-6px 0 0' }}>
            Some payments are in {pay.totals.other_currencies!.join(', ')}. They are not included here
          </p>
        )}
        <div className="flex flex-col" style={{ gap: 9 }}>
          {pay.totals.in_review_cents > 0 && row('Waiting for review', money(pay.totals.in_review_cents, cur))}
          {delegateFees.total > 0 && row(`${your}Delegate Tickets`, <><b style={{ fontWeight: 600 }}>{delegateFees.done}</b> of {delegateFees.total} paid</>)}
          {advisorFees.total > 0 && row(`${your}Advisor Tickets`, <><b style={{ fontWeight: 600 }}>{advisorFees.done}</b> of {advisorFees.total} paid</>)}
          {membersOwing > 0 && row('Members paying themselves', <><b style={{ fontWeight: 600 }}>{membersOwing}</b> owe</>, OWE)}
          <div className="flex items-baseline justify-between gap-3" style={{ fontFamily: FONT, fontSize: 14, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 500, color: INK }}>Left to pay</span>
            <b style={{ fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{money(pay.totals.owed_cents, cur)}</b>
          </div>
        </div>
        {toPay > 0 && (
          <PayLink conferenceId={conferenceId} slug={slug} className={BTN_CLASS} style={{ ...primaryBtn, width: '100%' }}>
            Pay for {toPay} {toPay === 1 ? 'ticket' : 'tickets'}
          </PayLink>
        )}
      </>
    );
  }

  return (
    <section className="flex flex-col" style={{ ...cardStyle, padding: 20, gap: 14 }} aria-label="Financials">
      <div className="flex items-center gap-2.5">
        <CreditCard size={20} strokeWidth={STROKE} aria-hidden style={{ color: FOREST }} />
        <h2 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, margin: 0 }}>Financials</h2>
      </div>
      {content}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/conferences/${slug}/pay?open=spots`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] rounded" style={linkStyle}>Add or remove spots</Link>
        <Link href={`/conferences/${slug}/pay?tab=completed`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] rounded" style={linkStyle}>Receipts</Link>
      </div>
    </section>
  );
}
