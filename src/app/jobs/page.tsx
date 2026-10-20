import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import SiteFooter from '@/components/SiteFooter';
import type { JobBoardPage, JobListingResult } from '@/lib/jobBoard';
import { cleanFilters } from '@/lib/jobBoard';
import JobBoardClient from './JobBoardClient';
import { jobFiltersOf, paramSource, readJobQuery } from './jobQuery';

// /jobs, the Job Board (docs/conferences/job-board.md). The first page of
// job_board() for the filters in the URL is read HERE, signed out, so the
// list is in the raw HTML for search engines (each card is a plain <a href>).
// A shared ?listing= link is read here too, so the listing draws at once.
// Everything after that is the client's: the signed-in reads, the tabs, the
// filters and the apply pop-up.

export const metadata: Metadata = pageMetadata({
  title: 'MUN Job Board: Chair, Secretariat and Staff Roles',
  description: 'Open chair, secretariat and staff roles at Model UN conferences worldwide. Apply in minutes with your Gavelling profile.',
  path: '/jobs',
});

const IVORY = '#EDE7D8';
// The paper grain every public page lays over the ivory (as Explore does).
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FIRST_PAGE = 30;

async function readFirstPage(filters: ReturnType<typeof jobFiltersOf>): Promise<JobBoardPage | null> {
  try {
    const { data, error } = await supabase.rpc('job_board', { p_filters: cleanFilters(filters), p_limit: FIRST_PAGE, p_offset: 0 });
    if (error || !data) return null;
    const d = data as Partial<JobBoardPage>;
    return { total: Number(d.total ?? 0), items: Array.isArray(d.items) ? d.items : [], live: !!d.live };
  } catch {
    return null;
  }
}

async function readListing(id: string | null): Promise<JobListingResult | null> {
  if (!id) return null;
  try {
    const { data, error } = await supabase.rpc('job_listing_get', { p_id: id });
    if (error || !data || !(data as { ok?: boolean }).ok) return null;
    return data as JobListingResult;
  } catch {
    return null;
  }
}

export default async function JobsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = readJobQuery(paramSource(await searchParams));
  const [page, detail] = await Promise.all([readFirstPage(jobFiltersOf(query)), readListing(query.listing)]);

  return (
    <div className="relative flex flex-col min-h-screen" style={{ backgroundColor: IVORY, overflowX: 'clip', fontFamily: 'var(--font-brand), sans-serif' }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <div className="relative z-10 flex flex-col flex-1">
        {/* A failed server read leaves the client to read the board itself;
            it then shows its own skeletons and, if that fails too, the error. */}
        <JobBoardClient initialQuery={query} initialPage={page} initialError={null} initialDetail={detail} />
        <SiteFooter />
      </div>
    </div>
  );
}
