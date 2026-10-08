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
import { money } from './payApi';
import { GREEN, INK_SOFT } from './payKit';

function Action({ icon: Icon, title, line, onClick }: { icon: LucideIcon; title: string; line: string; onClick: () => void }) {
  return (
    <button type="button" className="gv-pay-action" onClick={onClick}>
      <span className="gv-pay-action-icon" aria-hidden><Icon size={20} strokeWidth={2.2} /></span>
      <span style={{ minWidth: 0 }}><b>{title}</b><small>{line}</small></span>
    </button>
  );
}

export default function ActionsColumn({
  conference, aidOpen, primaryAppId, leader, addons, addonInvoices, delegateConfig, advisorConfig,
  delegateOpen, advisorOpen, aidRequest, currency, onChanged, onAidSubmitted,
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
