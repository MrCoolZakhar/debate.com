'use client';

// Shared gating wrapper for participant content. Payment timing + status
// decide whether children render, or a lock-card / under-review card takes
// their place, see getGateState in shared.tsx for the three-way logic.
// Never wraps the payment panel or Q&R, those are always visible.

import Link from 'next/link';
import { Lock, Clock, XCircle, RotateCcw } from 'lucide-react';
import { SectionCard, OUTFIT, type GateState } from './shared';

export function LockedCard() {
  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <div
          className="flex items-center justify-center mb-5"
          style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}
        >
          <Lock size={24} strokeWidth={1.8} style={{ color: '#1B3828' }} />
        </div>
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Unlocks once your registration is paid.
        </p>
        <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          Settle your fee below and this section opens up right away.
        </p>
      </div>
    </SectionCard>
  );
}

/** Shown in place of the payment panel + role content for a rejected
 *  application (rendered by ParticipantView directly, outside PayGate — a
 *  rejection isn't one of the three pay-gate states, and payment/role
 *  content is meaningless once rejected). Links into the apply flow's edit
 *  mode, resubmit_application is the only write path for the edit — but
 *  only when the role's allow_resubmission is on; otherwise the rejection
 *  is final and no resubmit button renders. */
export function RejectedCard({
  conferenceSlug, role, organizerNote, allowResubmission,
}: {
  conferenceSlug: string;
  role: string;
  organizerNote?: string | null;
  allowResubmission?: boolean;
}) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <div
          className="flex items-center justify-center mb-5"
          style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)' }}
        >
          <XCircle size={24} strokeWidth={1.8} style={{ color: '#8B2020' }} />
        </div>
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Your application wasn&apos;t accepted this time.
        </p>

        {organizerNote && (
          <div
            className="text-left rounded-xl px-4 py-3 mb-4"
            style={{ maxWidth: 380, backgroundColor: 'rgba(184,132,74,0.08)', border: '1px solid rgba(184,132,74,0.22)' }}
          >
            <p className="text-[10px] font-bold mb-1" style={{ color: '#B8844A', fontFamily: OUTFIT, letterSpacing: '0.1em' }}>
              FEEDBACK FROM THE ORGANIZERS
            </p>
            <p className="text-[13px] whitespace-pre-wrap" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.6 }}>
              {organizerNote}
            </p>
          </div>
        )}

        {allowResubmission ? (
          <>
            <p className="text-[13px] max-w-[340px] mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
              You can edit your application and resubmit it for another look from the organizing team.
            </p>
            <Link
              href={`/conferences/${conferenceSlug}/apply?role=${role}&edit=1`}
              className="inline-flex items-center gap-2 rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              <RotateCcw size={15} />
              EDIT AND RESUBMIT
            </Link>
          </>
        ) : (
          <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            This decision is final for this role.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

export function UnderReviewCard() {
  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center py-10">
        <div
          className="flex items-center justify-center mb-5"
          style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(184,132,74,0.12)', border: '1px solid rgba(184,132,74,0.24)' }}
        >
          <Clock size={24} strokeWidth={1.8} style={{ color: '#B8844A' }} />
        </div>
        <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Application under review
        </p>
        <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          We&apos;ll email you once a decision is made. Payment and this section open up once you&apos;re accepted.
        </p>
      </div>
    </SectionCard>
  );
}

export function PayGate({ gateState, children }: { gateState: GateState; children: React.ReactNode }) {
  if (gateState === 'under_review') return <UnderReviewCard />;
  if (gateState === 'locked') return <LockedCard />;
  return <>{children}</>;
}
