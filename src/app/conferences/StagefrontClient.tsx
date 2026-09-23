'use client';

// Production conferences landing: the owner-approved "Stagefront" composition,
// rendered by `/`. The data is read on the SERVER (src/app/page.tsx through
// src/lib/listedConferences.ts) and handed in as props, so the conference
// cards, the trust counts and the job-board figures are real numbers in the
// HTML a crawler receives. They used to be fetched here after mount, which
// left "—" in every count of the server render. The component still lives in
// the landing-lab/ directory for history.

import VariantStagefront, { type JobStats } from './landing-lab/VariantStagefront';
import type { LabConference } from './landing-lab/shared';

export interface PlatformStats {
  total_conferences: number;
  published_conferences: number;
  countries: number;
}

export default function StagefrontClient({
  conferences,
  stats,
  jobStats,
}: {
  conferences: LabConference[];
  stats: PlatformStats | null;
  jobStats: JobStats | null;
}) {
  return <VariantStagefront conferences={conferences} ratings={{}} stats={stats} jobStats={jobStats} />;
}
