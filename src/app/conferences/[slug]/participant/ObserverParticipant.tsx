'use client';

// Observer participant view, spine only, plus a short welcome card. No
// committee content: observers aren't allocated anywhere.

import { Eye } from 'lucide-react';
import CommitteesSessionsCard from './CommitteesSessionsCard';
import { SectionCard, OUTFIT } from './shared';

export default function ObserverParticipant({ conferenceId, conferenceStartDate }: {
  conferenceId: string;
  conferenceStartDate: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionCard>
        <div className="flex flex-col items-center text-center py-10">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}
          >
            <Eye size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
          </div>
          <p className="text-[15px] font-semibold max-w-[360px]" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            You&apos;re registered as an observer. The organizing team will share event details.
          </p>
        </div>
      </SectionCard>
      <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
    </div>
  );
}
