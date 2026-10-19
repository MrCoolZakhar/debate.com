'use client';

// The leader card's Financials (taste board 1A). Every number comes from what
// the database already gives: my_pay_overview (the leader's OWN items and
// payments, the same read as /pay) and the roster's payment status per member.
// Nothing here types a price; amounts go through the /pay page's formatter.
//   paid               my_pay_overview totals.paid_cents (what this leader paid)
//   Delegate fees      this leader's delegation tickets (pledge_spot items), paid of all
//   Faculty advisor    this leader's advisor tickets (advisor_spot items), paid of all
//   Members paying     members of the delegation whose own fee is still unpaid
//   Left to pay        my_pay_overview totals.owed_cents
// Other leaders' tickets and payments are theirs (my_pay_overview reads the
// caller's own items only), so the two fee rows say "you added" when another
// leader has tickets too.

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { PayLink } from '../PaymentsLocked';
import { money, type PayItem, type PayOverview } from '../../pay/payApi';
import { BTN_CLASS, cardStyle, FONT, FOREST, INK, INK_SOFT, LINE, linkStyle, OWE, primaryBtn, STROKE } from './leaderKit';

const DONE_STATES = new Set(['paid', 'refund_requested', 'disputed', 'covered', 'waived']);

function tally(items: PayItem[], kind: string) {
  const live = items.filter(i => i.kind === kind && i.owner_is_me && i.state !== 'refund_closed');
  return { total: live.length, done: live.filter(i => DONE_STATES.has(i.state)).length, payable: live.filter(i => i.payable).length };
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
    const cur = pay.conference.currency;
    const delegateFees = tally(pay.items, 'pledge_spot');
    const advisorFees = tally(pay.items, 'advisor_spot');
    const toPay = delegateFees.payable + advisorFees.payable;
    const mine = pay.delegation?.find(d => d.society_id === societyId) ?? null;
    const othersHaveTickets = !!mine?.leaders.some(l => !l.is_me && (l.delegate_tickets > 0 || l.advisor_tickets > 0));
    const youAdded = othersHaveTickets ? ' you added' : '';
    content = (
      <>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{money(pay.totals.paid_cents, cur)}</span>
          <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>paid</span>
        </div>
        <div className="flex flex-col" style={{ gap: 9 }}>
          {delegateFees.total > 0 && row(`Delegate fees${youAdded}`, <><b style={{ fontWeight: 600 }}>{delegateFees.done}</b> of {delegateFees.total} paid</>)}
          {advisorFees.total > 0 && row(`Faculty advisor fees${youAdded}`, <><b style={{ fontWeight: 600 }}>{advisorFees.done}</b> of {advisorFees.total} paid</>)}
          {membersOwing > 0 && row('Members paying themselves', <><b style={{ fontWeight: 600 }}>{membersOwing}</b> owe</>, OWE)}
          <div className="flex items-baseline justify-between gap-3" style={{ fontFamily: FONT, fontSize: 14, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 500, color: INK }}>Left to pay</span>
            <b style={{ fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{money(pay.totals.owed_cents, cur)}</b>
          </div>
        </div>
        {toPay > 0 && (
          <PayLink conferenceId={conferenceId} slug={slug} className={BTN_CLASS} style={{ ...primaryBtn, width: '100%' }}>
            Pay for {toPay} {toPay === 1 ? 'spot' : 'spots'}
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
        <Link href={`/conferences/${slug}/pay?open=spots`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={linkStyle}>Add or remove spots</Link>
        <Link href={`/conferences/${slug}/pay?tab=completed`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={linkStyle}>Receipts</Link>
      </div>
    </section>
  );
}
