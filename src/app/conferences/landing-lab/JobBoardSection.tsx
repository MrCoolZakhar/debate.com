'use client';

// ── The homepage Job Board section (Job Board prompt 4) ─────────────────────
//
// Sits under Gavelling Sessions and the numbers bar, directly above Learn MUN
// (owner). Up to 6 compact job cards from job_homepage(), read on the SERVER
// in src/app/page.tsx and handed down as props, in the owner's order (never
// re-sorted here). With no cards the section renders nothing at all.
//
// Layout: one row of 6 from 1400px, 3 by 2 from 1024px, 2 columns on a
// tablet, a horizontal swipe row on phones. Each card is JobCard's own
// <a href="/jobs?listing=<id>">; a promoted card keeps its gold edge and tag.
//
// Ground: CREAM, the same ground as the Sessions section and the numbers bar
// above it, so the page reads cream (Sessions, numbers, Job Board) then white
// (Learn MUN) with no new band edge; the white job cards need a tinted ground.

import Link from 'next/link';
import JobCard from '@/app/jobs/JobCard';
import { GoldWord } from '@/components/BrandHeading';
import type { JobCard as JobCardData } from '@/lib/jobBoard';
import { CREAM, FOREST, SANS } from './shared';

const INK = '#1C1410';
const INK_70 = '#4A4036';

export default function JobBoardSection({ jobs }: { jobs: JobCardData[] }) {
  if (!jobs || jobs.length === 0) return null;
  return (
    <section
      className="px-5 md:px-14"
      aria-labelledby="hs-jobs-heading"
      style={{ backgroundColor: CREAM, paddingTop: 'clamp(28px, 3vw, 48px)', paddingBottom: 'clamp(40px, 4vw, 64px)' }}
    >
      <style>{`
        .hs-jobs-all { color: ${FOREST}; transition: color 160ms ease; }
        .hs-jobs-all:hover { color: ${INK}; }
        .hs-jobs-all:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; border-radius: 4px; }
        .hs-jobs-row { scrollbar-width: none; -ms-overflow-style: none; }
        .hs-jobs-row::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="mx-auto" style={{ maxWidth: '1280px' }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2
              id="hs-jobs-heading"
              style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(26px, 2.4vw, 40px)', letterSpacing: '-0.015em', color: INK, margin: '0 0 4px 0', textWrap: 'balance' }}
            >
              Job <GoldWord>Board</GoldWord>
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_70, margin: 0 }}>
              Chair, secretariat and staff roles open now
            </p>
          </div>
          <Link
            href="/jobs"
            className="hs-jobs-all inline-flex min-h-11 items-center gap-1.5 self-start sm:self-auto focus:outline-none"
            style={{ fontFamily: SANS, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationThickness: '1.5px', fontSize: '15px', whiteSpace: 'nowrap' }}
          >
            See all roles
          </Link>
        </div>

        {/* Phones: a swipe row that bleeds to the screen edges (the -mx / px
            pair), snapping card by card. The vertical padding is clearance so
            the overflow container never clips a card's hover lift or shadow. */}
        <ul
          className="hs-jobs-row -mx-5 px-5 scroll-px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory py-2 md:mx-0 md:px-0 md:py-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible lg:grid-cols-3 min-[1400px]:grid-cols-6"
          style={{ listStyle: 'none', marginTop: '20px', marginBottom: 0 }}
        >
          {jobs.map(card => (
            <li key={card.id} className="flex w-[78vw] max-w-[300px] flex-shrink-0 snap-start md:w-auto md:max-w-none md:flex-shrink">
              <div className="flex w-full flex-col [&>a]:flex-1">
                <JobCard card={card} compact />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
