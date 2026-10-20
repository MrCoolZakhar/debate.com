'use client';

// Production conferences landing: the owner-approved "Stagefront" composition,
// rendered by `/`. The data is read on the SERVER (src/app/page.tsx through
// src/lib/listedConferences.ts) and handed in as props, so the conference
// cards, the trust counts, the Job Board cards and the Learn MUN guides are real in the
// HTML a crawler receives. They used to be fetched here after mount, which
// left "—" in every count of the server render. The component still lives in
// the landing-lab/ directory for history.

import VariantStagefront from './landing-lab/VariantStagefront';
import type { HomeGuide } from './landing-lab/HomeSections';
import type { LabConference } from './landing-lab/shared';
import type { FeaturedRow } from '@/lib/spotlight';
import type { JobCard } from '@/lib/jobBoard';

export interface PlatformStats {
  total_conferences: number;
  published_conferences: number;
  countries: number;
}

export default function StagefrontClient({
  conferences,
  stats,
  guides,
  featured = [],
  jobs = [],
}: {
  conferences: LabConference[];
  stats: PlatformStats | null;
  guides: HomeGuide[];
  /** The hero rail from featured_conferences('homepage'), read on the server. */
  featured?: FeaturedRow[];
  /** The homepage Job Board cards from job_homepage(), read on the server. */
  jobs?: JobCard[];
}) {
  return <VariantStagefront conferences={conferences} ratings={{}} stats={stats} guides={guides} featured={featured} jobs={jobs} />;
}
