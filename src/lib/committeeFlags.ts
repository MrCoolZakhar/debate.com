import type { Committee } from './types';

// Single read path for DB-backed committee flags — works on any device (delegate,
// voting, advisor), since dbSettings comes from the committee row, not localStorage.
export function getCommitteeFlags(committee: Pick<Committee, 'dbSettings'>) {
  const s = committee.dbSettings ?? {};
  return {
    sponsorLabel: (s.sponsorLabel as string) || '',
    lockDelegateRollCall: (s.lockDelegateRollCall as boolean) ?? false,
    disableChat: (s.disableChat as boolean) ?? false,
  };
}

// The visible sponsor term — custom value wins, else the translated fallback.
export function sponsorLabel(committee: Pick<Committee, 'dbSettings'>, fallback: string): string {
  return (committee.dbSettings?.sponsorLabel as string)?.trim() || fallback;
}
