'use client';

// Participant view, the person tab. Orchestrates: role pill switcher (when
// the viewer has more than one application here), the pay-gated content for
// the selected application, the payment panel, and Q&R, the latter two are
// never gated. Deliberately has no conference summary card: the page around
// this tab already is one.

import { useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SectionCard, OUTFIT, getGateState, roleLabel, statusPriority } from './shared';
import { PayGate, RejectedCard } from './PayGate';
import DelegateParticipant from './DelegateParticipant';
import AdvisorParticipant from './AdvisorParticipant';
import ChairParticipant from './ChairParticipant';
import ObserverParticipant from './ObserverParticipant';
import PaymentPanel from './PaymentPanel';
import RequestsPanel from './RequestsPanel';
import ApplyPointer from './ApplyPointer';
import type { ParticipantApplication, ParticipantRoleConfig, ParticipantAllocation, ParticipantCommittee } from './types';

const DELEGATE_ROLES = new Set(['delegate', 'head-delegate']);

function RolePlaceholder({ role }: { role: string }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Your {roleLabel(role).toLowerCase()} dashboard is coming soon
        </p>
        <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          Role-specific tools for {roleLabel(role).toLowerCase()}s are on the way.
        </p>
      </div>
    </SectionCard>
  );
}

const STATUS_DOT: Record<string, string> = {
  assigned: '#3D7A52', 'checked-in': '#3D7A52', accepted: '#B6871F', submitted: '#9A8A78',
  rejected: '#8B2020', withdrawn: '#9A8A78',
};

function pickDefault(apps: ParticipantApplication[]): ParticipantApplication {
  return [...apps].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0];
}

export interface ParticipantViewProps {
  conferenceId: string;
  conferenceSlug: string;
  contactEmail: string | null;
  defaultFeeCurrency: string;
  myApplications: ParticipantApplication[];
  roleConfigs: ParticipantRoleConfig[];
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
  /** True once the conference's Stripe Connect onboarding is complete. */
  paymentsEnabled: boolean;
  /** Organizer-provided payment page, shown as a fallback when paymentsEnabled is false. */
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
}

export default function ParticipantView({
  conferenceId, conferenceSlug, contactEmail, defaultFeeCurrency, myApplications, roleConfigs, myAllocation, committees, allocationSwapMode, paymentsEnabled, externalPaymentUrl, externalPaymentNote,
}: ParticipantViewProps) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!user) {
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut />;
  }
  if (myApplications.length === 0) {
    return <ApplyPointer conferenceSlug={conferenceSlug} signedOut={false} />;
  }

  const selected = myApplications.find(a => a.id === selectedId) ?? pickDefault(myApplications);
  const roleConfig = roleConfigs.find(rc => rc.role === selected.role) ?? null;
  const paymentTiming = roleConfig?.payment_timing ?? 'anytime';
  const gateState = getGateState(paymentTiming, selected.status, selected.payment_status);
  const payableNow = gateState !== 'under_review';

  return (
    <div className="flex flex-col gap-6">
      {myApplications.length > 1 && (
        <SectionCard className="!p-3">
          <div className="flex flex-wrap gap-1.5">
            {myApplications.map(app => {
              const active = app.id === selected.id;
              return (
                <button
                  key={app.id}
                  onClick={() => setSelectedId(app.id)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold focus:outline-none transition-colors"
                  style={{
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#6B5F52',
                    border: active ? 'none' : '1px solid #DDD4C0',
                    fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: STATUS_DOT[app.status] ?? '#9A8A78', flexShrink: 0 }} />
                  {roleLabel(app.role)}
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {selected.status === 'rejected' ? (
        // Payment and role content are meaningless once rejected, replaces
        // both rather than gating them (a rejection isn't a PayGate state).
        <RejectedCard conferenceSlug={conferenceSlug} role={selected.role} />
      ) : (
        <>
          {selected.status === 'submitted' && (
            <SectionCard className="!py-4 !px-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[13px]" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
                  Need to change something before it&apos;s reviewed?
                </p>
                <Link
                  href={`/conferences/${conferenceSlug}/apply?role=${selected.role}&edit=1`}
                  className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3.5 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                  style={{ border: '1px solid #DDD4C0', color: '#1C1410', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <Pencil size={12} />
                  EDIT APPLICATION
                </Link>
              </div>
            </SectionCard>
          )}

          <PaymentPanel
            key={selected.id}
            applicationId={selected.id}
            conferenceId={conferenceId}
            feeAmount={roleConfig?.fee_amount ?? 0}
            feeCurrency={roleConfig?.fee_currency ?? defaultFeeCurrency}
            feePhases={roleConfig?.fee_phases ?? null}
            allowPartial={roleConfig?.allow_partial_payments ?? false}
            paymentStatus={selected.payment_status}
            amountPaid={selected.amount_paid}
            payableNow={payableNow}
            contactEmail={contactEmail}
            aidStatus={selected.aid_status}
            paymentsEnabled={paymentsEnabled}
            externalPaymentUrl={externalPaymentUrl}
            externalPaymentNote={externalPaymentNote}
          />

          <PayGate gateState={gateState}>
            {DELEGATE_ROLES.has(selected.role) ? (
              <DelegateParticipant
                conferenceId={conferenceId}
                application={selected}
                myAllocation={myAllocation}
                committees={committees}
                allocationSwapMode={allocationSwapMode}
              />
            ) : selected.role === 'faculty-advisor' ? (
              <AdvisorParticipant
                conferenceId={conferenceId}
                application={selected}
                allocationSwapMode={allocationSwapMode}
                roleConfigs={roleConfigs}
                contactEmail={contactEmail}
                paymentsEnabled={paymentsEnabled}
                externalPaymentUrl={externalPaymentUrl}
                externalPaymentNote={externalPaymentNote}
              />
            ) : selected.role === 'chair' ? (
              <ChairParticipant conferenceId={conferenceId} />
            ) : selected.role === 'observer' ? (
              <ObserverParticipant />
            ) : (
              <RolePlaceholder role={selected.role} />
            )}
          </PayGate>
        </>
      )}

      <RequestsPanel conferenceId={conferenceId} applicationId={selected.id} />
    </div>
  );
}
