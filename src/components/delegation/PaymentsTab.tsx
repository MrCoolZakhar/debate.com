'use client';

// Payments: what the delegation owes and what came in, invoice by invoice.
//
// Every "paid" figure is the payments ledger (succeeded payment rows), never
// `payment_status`: money paid online through Gavelling and money the organiser
// recorded as paid offline are shown apart and never added together
// (CLAUDE.md section 3). The leader pays their own invoices (delegation spots,
// advisor tickets, a per-delegation fee) on the conference's pay page; members
// pay their own registration from their conference page.

import { useMemo } from 'react';
import { CreditCard, HandCoins, Receipt, Users } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { centsToFee } from '@/lib/invoices';
import {
  invoiceDue, invoiceState, invoiceTitle, isLive, moneySummary,
  type PortalData, type PortalInvoice, type PortalMember,
} from './portalModel';
import { BigNumber, InvoiceMark, Panel, PanelTitle, PersonAvatar, PrimaryButton } from './portalUi';

export function PaymentsTab({ data }: { data: PortalData }) {
  const money = useMemo(() => moneySummary(data), [data]);
  const byApp = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members]);
  const cur = money.currency;

  const mine = data.invoices.filter((i) => i.application_id === data.me.application_id);
  const leaderBill = data.invoices.filter((i) => i.society_level && i.application_id !== data.me.application_id);
  const memberFees = data.invoices.filter((i) => !i.society_level && i.application_id !== data.me.application_id);

  // Members' own fees grouped by person, live members only.
  const perMember = new Map<string, PortalInvoice[]>();
  for (const i of memberFees) {
    if (!i.application_id) continue;
    const m = byApp.get(i.application_id);
    if (!m || !isLive(m)) continue;
    const list = perMember.get(m.id) ?? [];
    list.push(i);
    perMember.set(m.id, list);
  }
  const memberRows = Array.from(perMember.entries())
    .map(([id, invs]) => ({ member: byApp.get(id) as PortalMember, invs }))
    .sort((a, b) => invoiceDueSum(b.invs) - invoiceDueSum(a.invs) || a.member.name.localeCompare(b.member.name));

  const payHref = `/conferences/${data.conference.slug}/pay`;

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelTitle icon={Receipt} title="The delegation's money" sub={`Everything below is in ${cur}. It counts your invoices and your members' own fees.`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
          <BigNumber value={centsToFee(money.receivedCents, cur)} label="Paid online" tone="forest" note={`${money.receivedCount} invoice${money.receivedCount === 1 ? '' : 's'}`} />
          <BigNumber value={centsToFee(money.offlineCents, cur)} label="Recorded offline" tone="soft" note="by the organiser" />
          <BigNumber value={centsToFee(money.outstandingCents, cur)} label="Still owed" tone={money.outstandingCents > 0 ? 'danger' : 'soft'} note={`${money.outstandingCount} open invoice${money.outstandingCount === 1 ? '' : 's'}`} />
          <BigNumber value={money.coveredCount} label="Covered by the delegation" tone="soft" note="members who pay nothing themselves" />
        </div>
        {money.otherCurrencies.length > 0 && (
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, marginTop: 12 }}>
            Some invoices are in {money.otherCurrencies.join(', ')} and are listed below but not counted here.
          </p>
        )}
      </Panel>

      {(money.pledgedSpots > 0 || money.pledgeSpotsPaid + money.pledgeSpotsOpen > 0) && (
        <Panel tone="wash">
          <PanelTitle icon={HandCoins} title="Delegation spots" sub="Spots the delegation pledged to pay for. Members on a paid spot owe nothing themselves." />
          <div className="grid grid-cols-3 gap-4">
            <BigNumber value={money.pledgedSpots} label="Pledged" />
            <BigNumber value={money.pledgeSpotsPaid} label="Paid" tone="forest" />
            <BigNumber value={money.pledgeSpotsOpen} label="Unpaid" tone={money.pledgeSpotsOpen > 0 ? 'danger' : 'soft'} />
          </div>
        </Panel>
      )}

      <Panel style={{ padding: '16px 16px 8px' }}>
        <PanelTitle
          icon={CreditCard}
          title="Your bill"
          sub={money.myOutstandingCents > 0
            ? `${centsToFee(money.myOutstandingCents, cur)} left to pay on ${money.myOpenCount} invoice${money.myOpenCount === 1 ? '' : 's'}.`
            : mine.length > 0 ? 'Nothing left to pay.' : 'You have no invoices.'}
          aside={money.myOutstandingCents > 0 ? <PrimaryButton href={payHref} icon={CreditCard}>Pay</PrimaryButton> : undefined}
        />
        <InvoiceList invoices={mine} />
      </Panel>

      {leaderBill.length > 0 && (
        <Panel style={{ padding: '16px 16px 8px' }}>
          <PanelTitle icon={Receipt} title="Billed to other leaders" sub="Delegation invoices that belong to another leader's application. They pay them from their own account." />
          <InvoiceList invoices={leaderBill} owner={(i) => (i.application_id ? byApp.get(i.application_id)?.name : undefined)} />
        </Panel>
      )}

      <Panel style={{ padding: '16px 16px 6px' }}>
        <PanelTitle icon={Users} title="Members' own fees" sub="Each member pays these from their own conference page." />
        {memberRows.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, paddingBottom: 10 }}>No member has an invoice yet.</p>
        ) : (
          <ul>
            {memberRows.map(({ member, invs }) => (
              <li key={member.id} style={{ padding: '12px 0', borderTop: NEU.hairline }}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <PersonAvatar name={member.name} url={member.avatar_url} size={28} />
                  <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, color: NEU.ink }}>{member.name}</span>
                </div>
                <InvoiceList invoices={invs} compact />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function invoiceDueSum(invs: PortalInvoice[]): number {
  return invs.reduce((n, i) => n + invoiceDue(i), 0);
}

function InvoiceList({ invoices, owner, compact }: { invoices: PortalInvoice[]; owner?: (i: PortalInvoice) => string | undefined; compact?: boolean }) {
  if (invoices.length === 0) return compact ? null : <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, paddingBottom: 8 }}>No invoices.</p>;
  return (
    <ul>
      {invoices.map((i) => {
        const paid = i.received_cents + i.offline_cents;
        const due = invoiceDue(i);
        const who = owner?.(i);
        return (
          <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ padding: compact ? '6px 0 6px 38px' : '11px 0', borderTop: compact ? 'none' : NEU.hairline }}>
            <div className="min-w-0" style={{ flex: '1 1 180px' }}>
              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: NEU.ink }}>{invoiceTitle(i)}</p>
              {who && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>{who}</p>}
            </div>
            <div style={{ flex: '0 1 170px' }}><InvoiceMark state={invoiceState(i)} /></div>
            <div className="text-right" style={{ flex: '0 0 auto', minWidth: 110, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: NEU.ink }}>{centsToFee(i.amount_cents, i.currency)}</p>
              {due > 0 && paid > 0 && <p style={{ fontSize: 12, color: NEU.inkSoft }}>{centsToFee(due, i.currency)} left</p>}
              {i.offline_cents > 0 && <p style={{ fontSize: 12, color: NEU.inkSoft }}>{centsToFee(i.offline_cents, i.currency)} paid offline</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
