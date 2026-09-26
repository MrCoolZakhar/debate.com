'use client';

// The dashboard's Payment section. Never gated (you pay to unlock the rest).
// What it shows, all from data the page already holds or the cards already
// read: this application's payment state as icon + word, a way to /pay (the
// single money surface), what is owed today (PayNowCard, my_open_balances),
// and for a delegation leader the "Pay for your delegates" pool
// (DelegationCreditsCard, which renders nothing for anyone who does not lead).

import { ArrowRight, CheckCircle2, Hourglass, MinusCircle } from 'lucide-react';
import { PayNowCard } from './PayNowCard';
import DelegationCreditsCard from './DelegationCreditsCard';
import { OUTFIT, CHIP_STYLES, derivePaymentChip } from './shared';
import { DashCard, CardHeading, ForestLink, IconWord, INK, INK_SOFT } from './dashboardKit';
import type { ParticipantApplication } from './types';

const PAID = new Set(['paid', 'waived']);

export default function PaymentPane({ application, conferenceId, conferenceSlug, userId, feeToday, paymentTiming, isLeader }: {
  application: ParticipantApplication;
  conferenceId: string;
  conferenceSlug: string;
  userId: string | null;
  feeToday: number;
  paymentTiming: string;
  /** A faculty advisor or head delegate with a delegation: shows the pool. */
  isLeader: boolean;
}) {
  const free = feeToday === 0;
  const settled = PAID.has(application.payment_status);
  const waitingForAcceptance = paymentTiming === 'after_acceptance' && application.status === 'submitted' && !settled;
  const chip = CHIP_STYLES[derivePaymentChip(application.payment_status, application.self_paid, application.amount_paid)];

  let line: string;
  if (free) line = 'Your role has no registration fee.';
  else if (settled) line = 'Your registration is settled. Receipts and anything else you owe are on the payments page.';
  else if (waitingForAcceptance) line = 'You can pay once the organisers accept your application.';
  else line = 'Pay your registration fee on the payments page, by card or the way the organisers set up.';

  return (
    <>
      <DashCard>
        <CardHeading title="Payment" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0" style={{ maxWidth: 440 }}>
            {free ? (
              <IconWord icon={settled ? CheckCircle2 : MinusCircle} word="No fee required" color={settled ? '#2A5A3C' : INK_SOFT} size="lg" />
            ) : waitingForAcceptance ? (
              <IconWord icon={Hourglass} word="After acceptance" color={INK_SOFT} size="lg" />
            ) : (
              <IconWord icon={chip.icon} word={chip.word} color={chip.color} size="lg" />
            )}
            <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK, margin: '8px 0 0 0', lineHeight: 1.5 }}>{line}</p>
          </div>
          {!(free && settled) && !waitingForAcceptance && (
            <ForestLink href={`/conferences/${conferenceSlug}/pay`}>
              Open payments <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
            </ForestLink>
          )}
        </div>
      </DashCard>

      {/* What is owed right now across this conference (own + delegation
          invoices), with the due date when set and a way to /pay. */}
      <PayNowCard userId={userId} conferenceId={conferenceId} />

      {isLeader && application.society_id && <DelegationCreditsCard societyId={application.society_id} />}
    </>
  );
}
