'use client';

// Shared gating wrapper for participant content. Payment timing + status
// decide whether children render, or a lock-card / under-review card takes
// their place, see getGateState in shared.tsx for the three-way logic.
// Never wraps the payment panel or Q&R, those are always visible.

import { Lock, Clock } from 'lucide-react';
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
