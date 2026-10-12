'use client';

// ActionsColumn — the /pay page's right column (prompt 95). It shows ONLY the
// actions that apply to this person; nothing is dimmed:
//   Apply for financial aid   when aid is open and no decision yet (else the decision)
//   Buy add-ons               when the conference has active add-ons
//   Add delegation tickets    leaders, while delegate applications are open
//   Buy advisor tickets       leaders, while faculty advisor applications are open
//   Pay for your delegates    leaders (DelegationCreditsCard); everyone else Buy credits
// The pop-ups behind them are the page's existing ones, moved unchanged
// (payPanels.tsx, AidRequestModal, PledgeInvoicingCard, PayActionPopup,
// DelegationCreditsCard). ?open=aid|addons|spots|advisors|credits opens one on load.

import { useEffect, useRef, useState } from 'react';
import { Coins, GraduationCap, HandCoins, ShoppingBag, Users2, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { normalizeBlocks, type FormBlock } from '@/lib/customQuestions';
import type { InvoiceRow } from '@/lib/invoices';
import AidRequestModal from '../participant/AidRequestModal';
import DelegationCreditsCard from '../participant/DelegationCreditsCard';
import PledgeInvoicingCard from '../participant/PledgeInvoicingCard';
import PayActionPopup from '../participant/PayActionPopup';
import {
  AddSpotsPanel, AddonsModal, AdvisorTicketsModal,
  type ActiveAddon, type AidRequestRow, type PayConference, type PayRoleConfig,
} from './payPanels';
import { money, type PayDelegation } from './payApi';
import { GREEN, INK, INK_SOFT, LINE } from './payKit';

function Action({ icon: Icon, title, line, onClick }: { icon: LucideIcon; title: string; line: string; onClick: () => void }) {
  return (
    <button type="button" className="gv-pay-action" onClick={onClick}>
      <span className="gv-pay-action-icon" aria-hidden><Icon size={20} strokeWidth={2.2} /></span>
      <span style={{ minWidth: 0 }}><b>{title}</b><small>{line}</small></span>
    </button>
  );
}

/**
 * What the delegation's leaders have requested so far (prompt 101), at the top
 * of the ticket pop-ups: a big number with the words beside it, one row per
 * leader who requested any (the caller as "You"), and how many are in the
 * delegation now. Names wrap; never cut off.
 */
function TicketsRequested({ d, kind }: { d: PayDelegation | null; kind: 'delegate' | 'advisor' }) {
  if (!d) return null;
  const total = kind === 'delegate' ? d.delegate_tickets : d.advisor_tickets;
  const people = kind === 'delegate' ? d.delegates : d.advisors;
  const rows = d.leaders
    .map(l => ({ name: l.is_me ? 'You' : (l.name || 'A leader'), n: kind === 'delegate' ? l.delegate_tickets : l.advisor_tickets }))
    .filter(r => r.n > 0);
  return (
    <div className="gv-pay-card" style={{ padding: '14px 16px', boxShadow: `inset 0 0 0 1px ${LINE}` }}>
      {total > 0 ? (
        <>
          <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: INK }}>{total}</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{kind === 'delegate' ? 'delegate' : 'advisor'} ticket{total === 1 ? '' : 's'} requested</span>
          </p>
          {rows.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: `1px solid ${LINE}`, fontSize: 14 }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{r.name}</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{r.n}</b>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>No tickets requested yet</p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 13.5, color: INK_SOFT }}>
        {people} {kind === 'delegate' ? (people === 1 ? 'delegate' : 'delegates') : (people === 1 ? 'advisor' : 'advisors')} in your delegation so far
      </p>
    </div>
  );
}

export default function ActionsColumn({
  conference, aidOpen, primaryAppId, leader, addons, addonInvoices, delegateConfig, advisorConfig,
  delegateOpen, advisorOpen, aidRequest, currency, onChanged, onAidSubmitted, delegation,
}: {
  conference: PayConference;
  aidOpen: boolean;
  primaryAppId: string;
  leader: { id: string; society_id: string } | null;
  addons: ActiveAddon[];
  /** The primary application's invoices, so the add-ons pop-up knows what is already chosen. */
  addonInvoices: InvoiceRow[];
  delegateConfig: PayRoleConfig | null;
  advisorConfig: PayRoleConfig | null;
  delegateOpen: boolean;
  advisorOpen: boolean;
  aidRequest: AidRequestRow | null;
  currency: string;
  onChanged: () => void;
  onAidSubmitted: () => void;
  /** my_pay_overview's `delegation`: what the leaders of each delegation the caller leads have requested. */
  delegation: PayDelegation[] | null;
}) {
  const { session } = useAuth();
  const aidBlocks: FormBlock[] = normalizeBlocks(conference.aid_questions);
  const [aid, setAid] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [spots, setSpots] = useState(false);
  const [advisors, setAdvisors] = useState(false);
  const [credits, setCredits] = useState(false);

  const showAid = aidOpen && !aidRequest;
  const showAddons = addons.length > 0;
  const showSpots = !!leader && delegateOpen;
  const showAdvisors = !!leader && advisorOpen;
  const myDelegation = (leader && delegation?.find(d => d.society_id === leader.society_id)) || null;

  // ?open=aid|addons|spots|advisors|credits opens that pop-up on load, then leaves the URL.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const which = url.searchParams.get('open');
    if (!which) return;
    const t = setTimeout(() => {
      if (openedFromUrl.current) return;
      openedFromUrl.current = true;
      if (which === 'aid' && showAid) setAid(true);
      else if (which === 'addons' && showAddons) setAddonsOpen(true);
      else if (which === 'spots' && leader) setSpots(true);
      else if (which === 'advisors' && leader) setAdvisors(true);
      else if (which === 'credits') { if (leader) setCredits(true); else openCreditsPopup({ context: 'pay' }); }
      url.searchParams.delete('open');
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
    }, 0);
    return () => clearTimeout(t);
  }, [showAid, showAddons, leader]);

  return (
    <div className="flex flex-col gap-3">
      {showAid && <Action icon={HandCoins} title="Apply for Financial Aid" line="Ask for a reduced fee" onClick={() => setAid(true)} />}
      {aidOpen && aidRequest && (
        <div className="gv-pay-card" style={{ padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Financial Aid</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: aidRequest.status === 'approved' ? GREEN : INK_SOFT }}>
            {aidRequest.status === 'pending' && 'Your request is under review'}
            {aidRequest.status === 'approved' && `Approved. ${money(Math.round((aidRequest.granted_amount ?? 0) * 100), currency)} applied`}
            {aidRequest.status === 'denied' && 'Not approved this time'}
          </p>
        </div>
      )}
      {showAddons && <Action icon={ShoppingBag} title="Buy Add-ons" line="Optional extras" onClick={() => setAddonsOpen(true)} />}
      {showSpots && <Action icon={Users2} title="Add Delegation Tickets" line="Pay for more delegate places" onClick={() => setSpots(true)} />}
      {showAdvisors && <Action icon={GraduationCap} title="Buy Advisor Tickets" line="Tickets for your faculty advisors" onClick={() => setAdvisors(true)} />}
      {leader
        ? <Action icon={Coins} title="Pay for Your Delegates" line="Credits your delegates apply with" onClick={() => setCredits(true)} />
        : <Action icon={Coins} title="Buy Credits" line="Credits for your own applications" onClick={() => openCreditsPopup({ context: 'pay' })} />}

      <AidRequestModal
        applicationId={primaryAppId}
        conferenceId={conference.id}
        aidBlocks={aidBlocks}
        aidIntro={conference.aid_intro}
        currency={currency}
        open={aid}
        onClose={() => setAid(false)}
        onSubmitted={onAidSubmitted}
      />
      <AddonsModal
        open={addonsOpen}
        onClose={() => setAddonsOpen(false)}
        addons={addons}
        invoices={addonInvoices}
        applicationId={primaryAppId}
        accessToken={session?.access_token}
        onSaved={onChanged}
      />
      {leader && spots && (
        <PayActionPopup
          title="Add Delegation Tickets"
          line="Pay for more places for your delegation. Each ticket is a delegate place"
          onClose={() => setSpots(false)}
          width={640}
          testId="pay-spots"
        >
          <TicketsRequested d={myDelegation} kind="delegate" />
          <AddSpotsPanel applicationId={leader.id} accessToken={session?.access_token} onAdded={onChanged} />
          <PledgeInvoicingCard
            applicationId={leader.id}
            societyId={leader.society_id}
            currency={delegateConfig?.fee_currency ?? currency}
            financialAidEnabled={conference.financial_aid_enabled}
            aidBlocks={aidBlocks}
            aidIntro={conference.aid_intro}
          />
        </PayActionPopup>
      )}
      {leader && (
        <AdvisorTicketsModal
          open={advisors}
          onClose={() => setAdvisors(false)}
          applicationId={leader.id}
          accessToken={session?.access_token}
          advisorRoleConfig={advisorConfig}
          onAdded={onChanged}
          summary={<TicketsRequested d={myDelegation} kind="advisor" />}
        />
      )}
      {leader && credits && (
        <PayActionPopup
          title="Pay for Your Delegates"
          line="Add credits to your delegation so your delegates can apply without using their own"
          onClose={() => setCredits(false)}
          testId="pay-credits"
        >
          <DelegationCreditsCard societyId={leader.society_id} />
        </PayActionPopup>
      )}
    </div>
  );
}
