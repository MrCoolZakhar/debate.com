'use client';

// Observer participant view. Observers are not allocated anywhere: Overview
// is the parent's status row (what happens next says it), and Committees
// lists every room with its session once sessions open.

import CommitteesSessionsCard from './CommitteesSessionsCard';
import { Pane } from './dashboardKit';

export default function ObserverParticipant({ conferenceId, conferenceStartDate, section }: {
  conferenceId: string;
  conferenceStartDate: string | null;
  section: string;
}) {
  return (
    <Pane show={section === 'committees'}>
      <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
    </Pane>
  );
}
