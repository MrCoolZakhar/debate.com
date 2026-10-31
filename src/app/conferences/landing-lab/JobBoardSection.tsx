'use client';

// ── The homepage Job Board section (Job Board prompts 4 and 6) ─────────────
//
// Sits under Gavelling Sessions and the numbers bar, directly above Learn MUN
// (owner). It ALWAYS shows (owner, 20 Oct 2026): people must always reach the
// Job Board from the homepage. It is never an empty band, because the six
// tiles below always fill it.
//
// Two columns from 1024px: the words and the search on the LEFT (about a
// third), six small tiles on the RIGHT (3 by 2). Stacked on tablets (tiles
// 2 across) and phones (tiles in a swipe row).
//   - The search is the hero's conference search restyled for cream: a pill
//     with a magnifier, the field, and ONE round forest button that IS "See
//     all roles" when empty (/jobs) and searches with text (/jobs?q=...).
//   - The tiles: real listings first, in job_homepage()'s order (read on the
//     SERVER in src/app/page.tsx, never re-sorted here), then the evergreen
//     starter tiles fill the rest up to 6. A listing tile carries only the
//     title, the conference short name, the dates and the place; a starter
//     tile is plainly not a job (an icon, a title, one line, quieter).
//
// Ground: CREAM, the same ground as the Sessions section and the numbers bar
// above it, so the page reads cream (Sessions, numbers, Job Board) then white
// (Learn MUN) with no new band edge.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing, Banknote, Clock, Gavel, Landmark, Megaphone, PlusCircle, Search, Sparkles, Crown } from 'lucide-react';
import type { JobCard as JobCardData } from '@/lib/jobBoard';
import { jobDates, jobPlace, JobLogo } from '@/app/jobs/JobCard';
import { CircleFlag } from '@/components/CircleFlag';
import { CREAM, FOREST, IVORY, SANS } from './shared';
import { JobRoleGlyph } from '@/lib/jobRoleIcon';
import { JOB_ROLE_LABEL } from '@/lib/jobBoard';

const INK = '#1C1410';
const INK_70 = '#4A4036';
const INK_SOFT = '#5C5140';
const TILE_COUNT = 6;

type IconType = typeof Gavel;
const STARTERS: { title: string; line: string; href: string; icon: IconType }[] = [
  { title: 'Chair roles', line: 'Run a committee at conferences worldwide', href: '/jobs?role=chair', icon: Gavel },
  { title: 'Secretariat roles', line: "Join a conference's leadership team", href: '/jobs?role=secretariat', icon: Landmark },
  { title: 'Staff roles', line: 'Press, logistics, crisis and more', href: '/jobs?role=staff', icon: Megaphone },
  { title: 'Post a listing', line: 'Free when people apply on Gavelling', href: '/jobs?post=1', icon: PlusCircle },
  { title: 'Paid roles', line: 'Roles that pay or cover travel and stay', href: '/jobs?offer=paid', icon: Banknote },
  { title: 'Role alerts', line: 'An email when new roles match, with Unlimited', href: '/jobs', icon: BellRing },
];

export default function JobBoardSection({ jobs }: { jobs: JobCardData[] }) {
  const listings = (jobs ?? []).slice(0, TILE_COUNT);
  const starters = STARTERS.slice(0, TILE_COUNT - listings.length);
  // Taken once, for the "closes within 14 days" test on listing tiles.
  const [now] = useState(() => Date.now());

  return (
    <section
      className="px-5 md:px-14"
      aria-labelledby="hs-jobs-heading"
      style={{ backgroundColor: CREAM, paddingTop: 'clamp(28px, 3vw, 48px)', paddingBottom: 'clamp(40px, 4vw, 64px)' }}
    >
      <style>{SECTION_CSS}</style>
      <div className="hs-jobs-grid mx-auto" style={{ maxWidth: '1280px' }}>
        {/* ── Left: the words and the search ── */}
        <div className="hs-jobs-left">
          <h2
            id="hs-jobs-heading"
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(26px, 2.4vw, 40px)', letterSpacing: '-0.015em', color: INK, margin: '0 0 8px 0', textWrap: 'balance' }}
          >
            Job Board
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_70, margin: '0 0 20px 0', textWrap: 'pretty' }}>
            Find chairing, secretariat and staff opportunities at conferences all over the globe.
          </p>
          <RoleSearch />
        </div>

        {/* ── Right: always six tiles ── */}
        <ul className="hs-jobs-tiles -mx-5 px-5 scroll-px-5 md:mx-0 md:px-0" aria-label="Open roles">
          {listings.map((card) => (
            <li key={card.id} className="hs-jobs-cell"><ListingTile card={card} now={now} /></li>
          ))}
          {starters.map((s) => (
            <li key={s.title} className="hs-jobs-cell"><StarterTile {...s} /></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The hero's search, restyled for cream: the round button is "See all roles" when empty. */
function RoleSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const q = query.trim();
  const submit = () => {
    router.push(q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');
  };
  return (
    <div
      className="flex items-center gap-2"
      style={{
        backgroundColor: '#FFFFFF',
        border: `1px solid ${focused ? 'rgba(27,56,40,0.45)' : 'rgba(28,20,16,0.14)'}`,
        borderRadius: '9999px',
        padding: '6px 6px 6px clamp(16px, 1.4vw, 20px)',
        boxShadow: focused
          ? '0 10px 26px rgba(27,56,40,0.12), 0 0 0 3px rgba(27,56,40,0.08)'
          : '0 6px 18px rgba(27,56,40,0.07)',
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
      }}
    >
      <Search size={19} strokeWidth={2.25} style={{ color: INK_SOFT, flexShrink: 0 }} aria-hidden="true" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        onFocus={() => { setFocused(true); router.prefetch('/jobs'); }}
        onBlur={() => setFocused(false)}
        placeholder="Search roles or conferences…"
        aria-label="Search roles"
        className="hs-jobs-input"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 16.5px)', fontWeight: 500, color: INK,
        }}
      />
      <button
        type="button"
        onClick={submit}
        aria-label={q ? 'Search roles' : 'See all roles'}
        title={q ? 'Search roles' : 'See all roles'}
        className="hs-jobs-go inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
      >
        <Search size={19} strokeWidth={2.75} aria-hidden="true" />
      </button>
    </div>
  );
}

function ListingTile({ card, now }: { card: JobCardData; now: number }) {
  const conf = card.conference;
  const place = conf.format === 'online' ? 'Online' : jobPlace(conf);
  const long = card.title.length > 30;
  // Closing within 14 days: the card's own urgency line when it is a "Closes ..." line.
  const closesMs = card.closes_at ? new Date(card.closes_at).getTime() - now : NaN;
  const closing = Number.isFinite(closesMs) && closesMs >= 0 && closesMs <= 14 * 86400000 && card.urgency?.startsWith('Closes') ? card.urgency : null;
  return (
    <Link
      href={`/jobs?listing=${encodeURIComponent(card.id)}`}
      className={`hs-jobs-tile hs-jobs-tile-listing${card.promoted ? ' hs-jobs-tile-promoted' : ''} focus:outline-none`}
    >
      {/* The conference's logo over the tile's top-right edge, half outside (owner, 31 Oct 2026). */}
      <span className="hs-jobs-logo"><JobLogo conf={conf} size={36} standalone={card.standalone} /></span>
      {(card.promoted || card.premium) && (
        <span className="hs-jobs-tags">
          {card.premium && <span className="hs-jobs-tag hs-jobs-tag-premium"><Crown size={10} strokeWidth={2.6} aria-hidden />Premium</span>}
          {card.promoted && <span className="hs-jobs-tag"><Sparkles size={10} strokeWidth={2.6} aria-hidden />Promoted</span>}
        </span>
      )}
      <span className="hs-jobs-titlerow">
        <RoleIcon role={card.role} />
        <span className="hs-jobs-title" style={{ fontSize: long ? 13.5 : 15 }}>{card.title}</span>
      </span>
      <span className="hs-jobs-conf">{conf.short || conf.name}</span>
      <span className="hs-jobs-meta">{jobDates(conf)}</span>
      {(place || closing) && (
        // The place and the closing line share one line when there is room, so tiles keep their size.
        <span className="hs-jobs-metarow">
          {place && (
            <span className="hs-jobs-meta hs-jobs-place">
              {conf.format !== 'online' && conf.country && <CircleFlag country={conf.country} size={14} />}
              {place}
            </span>
          )}
          {closing && (
            <span className="hs-jobs-closing"><Clock size={11} strokeWidth={2.6} aria-hidden />{closing}</span>
          )}
        </span>
      )}
    </Link>
  );
}

/** The role's fine-line icon beside the title (chair, secretariat, staff). */
function RoleIcon({ role }: { role: JobCardData['role'] }) {
  const label = JOB_ROLE_LABEL[role] ?? 'Role';
  return (
    <span className="hs-jobs-roleicon" role="img" aria-label={label} title={label}>
      <JobRoleGlyph role={role} size={17} />
    </span>
  );
}

function StarterTile({ title, line, href, icon: Icon }: { title: string; line: string; href: string; icon: IconType }) {
  return (
    <Link href={href} className="hs-jobs-tile hs-jobs-tile-starter focus:outline-none">
      <span className="hs-jobs-icon" aria-hidden><Icon size={16} strokeWidth={2.2} /></span>
      <span className="hs-jobs-title" style={{ fontSize: 14.5 }}>{title}</span>
      <span className="hs-jobs-meta">{line}</span>
    </Link>
  );
}

const SECTION_CSS = `
.hs-jobs-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
@media (min-width: 1024px) {
  .hs-jobs-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: clamp(32px, 3.5vw, 56px); align-items: center; }
}
.hs-jobs-left { min-width: 0; max-width: 560px; }
@media (min-width: 1024px) { .hs-jobs-left { max-width: none; } }
.hs-jobs-input::placeholder { color: #857866; }
.hs-jobs-go { width: clamp(42px, 3vw, 46px); height: clamp(42px, 3vw, 46px); border: none; border-radius: 9999px; padding: 0; cursor: pointer;
  color: ${IVORY}; background: linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%); box-shadow: 0 4px 12px rgba(27,56,40,0.28);
  transition: transform 160ms ease, box-shadow 160ms ease; }
.hs-jobs-go:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(27,56,40,0.32); }
.hs-jobs-go:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; }

/* Tiles: a swipe row on phones, 2 across on tablets, 3 by 2 from 1024px. */
.hs-jobs-tiles { list-style: none; margin: 0; display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding-top: 22px; padding-bottom: 6px;
  scrollbar-width: none; -ms-overflow-style: none; }
.hs-jobs-tiles::-webkit-scrollbar { display: none; }
.hs-jobs-cell { display: flex; flex: 0 0 min(64vw, 230px); scroll-snap-align: start; min-width: 0; }
@media (min-width: 768px) {
  .hs-jobs-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 12px; overflow: visible; padding: 18px 0 0; }
  .hs-jobs-cell { flex: initial; }
}
@media (min-width: 1024px) { .hs-jobs-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

.hs-jobs-tile { position: relative; display: flex; flex-direction: column; gap: 2px; width: 100%; min-height: 108px; padding: 13px 14px; border-radius: 14px;
  background: #FFFFFF; text-decoration: none; color: ${INK}; font-family: ${SANS};
  box-shadow: 0 1px 2px rgba(27,56,40,0.05), 0 4px 14px rgba(27,56,40,0.07);
  transition: box-shadow 200ms ease, transform 220ms cubic-bezier(0.22,1,0.36,1); }
.hs-jobs-tile:hover { box-shadow: 0 1px 2px rgba(27,56,40,0.06), 0 10px 24px rgba(27,56,40,0.12); transform: translateY(-2px); }
.hs-jobs-tile:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px ${FOREST}; }
.hs-jobs-tile-promoted { box-shadow: 0 0 0 1.5px #E2C467, 0 6px 18px rgba(182,135,31,0.16); }
.hs-jobs-tile-promoted:hover { box-shadow: 0 0 0 1.5px #D9B44A, 0 10px 24px rgba(182,135,31,0.24); }
.hs-jobs-tile-starter { background: rgba(255,255,255,0.62); box-shadow: inset 0 0 0 1px rgba(28,20,16,0.08); }
.hs-jobs-tile-starter:hover { background: #FFFFFF; box-shadow: inset 0 0 0 1px rgba(27,56,40,0.18), 0 6px 16px rgba(27,56,40,0.08); }
.hs-jobs-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.hs-jobs-tag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 9999px; font-size: 10.5px; font-weight: 700; line-height: 1.3;
  color: #4A3410; background: linear-gradient(145deg, #F3E3A1 0%, #EED98A 55%, #D9B44A 100%); }
.hs-jobs-tag-premium { color: #F4F1E8; background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%); }
.hs-jobs-titlerow { display: flex; align-items: flex-start; gap: 7px; }
.hs-jobs-tile-listing .hs-jobs-titlerow, .hs-jobs-tile-listing .hs-jobs-tags { padding-right: 34px; }
.hs-jobs-logo { position: absolute; top: -18px; right: 12px; z-index: 1; line-height: 0; }
.hs-jobs-place { display: inline-flex; align-items: center; gap: 5px; }
.hs-jobs-roleicon { flex-shrink: 0; display: inline-flex; color: ${FOREST}; margin-top: 1px; }
.hs-jobs-icon { width: 28px; height: 28px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 6px;
  color: ${FOREST}; background: rgba(27,56,40,0.07); }
.hs-jobs-title { font-weight: 700; line-height: 1.25; letter-spacing: -0.005em; color: ${INK}; overflow-wrap: anywhere; }
.hs-jobs-conf { margin-top: 2px; font-size: 13px; font-weight: 700; color: ${FOREST}; overflow-wrap: anywhere; }
.hs-jobs-metarow { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; row-gap: 1px; }
.hs-jobs-closing { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #8A5A12; white-space: nowrap; }
.hs-jobs-meta { font-size: 12.5px; font-weight: 500; line-height: 1.4; color: ${INK_SOFT}; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .hs-jobs-tile, .hs-jobs-go { transition: none; } .hs-jobs-tile:hover, .hs-jobs-go:hover { transform: none; } }
`;
