'use client';

// A leader's Overview (head delegates and faculty advisors; owner, 21 Oct 2026:
// "a recap a faculty advisor would want", then the same day: the seat right at
// the top, a little about the delegation, deadlines "not too much", no Needs
// your attention). In this order:
//   Your Seat        a head delegate's own allocation card (`seat`, built by
//                    ParticipantView from DelegateParticipant's OwnSeatCard),
//                    drawn in every state, skeleton and error included.
//   Your next step   DelegationLead with the page's step (pageNextStep). When
//                    the page has nothing to DO, the delegation's own step takes
//                    its place: people to allocate, papers due soon, members
//                    who owe; its button opens the Delegation section.
//   Recap            four white tiles, a big number and its word: allocations
//                    filled (N of M), open allocations, position papers in
//                    (N of M people with an allocation), tickets paid (the
//                    leader's own Delegate and Advisor Tickets from
//                    my_pay_overview, counted exactly as the Financials card
//                    does; with no tickets bought, the members' own fees).
//   Add delegate     AddDelegatePanel, in place: the invite link, or (when the
//                    conference allows leader imports) a name and email.
//   Deadlines        ONE compact card: the conference dates, then at most the
//                    next two dates ahead (a committee's position paper
//                    deadline or study guide release; committees sharing a
//                    day and a kind are one entry), with relative words.
// Reads: useLeaderOverview (nothing new on the database). Grey
// skeletons on the first read only; every later read (the section shown again)
// swaps in place. No pills, names never cut, flags and committee logos.

import { useEffect, useMemo, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import DelegationLead from '../DelegationLead';
import type { NextStep } from '../../dashboardKit';
import { cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, INK, INK_SOFT, STROKE } from '../leaderKit';
import { tally } from '../FinancialsCard';
import { useLeaderOverview, type LeaderOverviewData, type OverviewCommittee } from './useLeaderOverview';
import AddDelegatePanel from './AddDelegatePanel';

const DAY = 24 * 60 * 60 * 1000;
const PAPER_SOON_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LIVE = new Set(['accepted', 'assigned', 'checked-in']);
const SENT_BACK = new Set(['rejected', 'needs_revision', 'returned']);
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Midnight of a date, local time. A bare 'YYYY-MM-DD' is read as that local day. */
function dayOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function todayStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayWords(day: number): string {
  const d = new Date(day);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

function relativeWords(day: number, today: number): string {
  const n = Math.round((day - today) / DAY);
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 14) return `in ${n} days`;
  if (n < 60) return `in ${Math.round(n / 7)} weeks`;
  const months = Math.round(n / 30);
  return months <= 1 ? 'in 1 month' : `in ${months} months`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const shortOf = (c: Pick<OverviewCommittee, 'name' | 'abbreviation'>) => (c.abbreviation ?? '').trim() || committeeDisplayName(c.name, c.abbreviation);

interface Person {
  application_id: string;
  name: string;
  avatar_url: string | null;
  is_me: boolean;
  role: string;
  country_name: string | null;
  country_code: string | null;
  committee: OverviewCommittee | null;
  committee_label: string | null;
}

interface DateRow {
  key: string;
  day: number;
  what: string;
  committee: OverviewCommittee | null;
}

interface Recap {
  filled: number;
  totalAllocations: number;
  open: number;
  papersIn: number;
  papersOf: number;
  papersKnown: boolean;
  /** null when the tickets could not be read. */
  ticketsPaid: number | null;
  ticketsOf: number;
  ticketsWord: string;
  unallocated: Person[];
  owing: (Person & { word: string })[];
  paperDue: (Person & { day: number })[];
  dates: DateRow[];
}

function buildRecap(d: LeaderOverviewData, today: number): Recap {
  const live = d.members.filter(m => LIVE.has(m.status));
  const toPerson = (m: LeaderOverviewData['members'][number]): Person => {
    const ccId = d.apps.get(m.application_id)?.assigned_committee_id ?? null;
    const committee = ccId ? d.committees.get(ccId) ?? null : null;
    const a = m.allocation;
    return {
      application_id: m.application_id, name: m.name, avatar_url: m.avatar_url, is_me: m.is_me, role: m.role,
      country_name: a?.country_name ?? null, country_code: a?.country_code ?? null, committee,
      committee_label: committee ? shortOf(committee) : ((a?.committee_abbr ?? '').trim() || (a?.committee ? committeeDisplayName(a.committee, a.committee_abbr) : null)),
    };
  };
  const isSeated = (m: LeaderOverviewData['members'][number]) => m.role !== 'faculty-advisor'
    && !!m.allocation?.country_name && !!(m.allocation.committee || m.allocation.committee_abbr);
  const seatable = live.filter(m => m.role === 'delegate' || m.role === 'head-delegate');
  const seated = seatable.filter(isSeated);
  const open = d.openSeats?.length ?? 0;

  const unallocated = seatable
    .filter(m => !isSeated(m) && d.apps.get(m.application_id)?.attending !== false)
    .map(toPerson)
    .sort((a, b) => collator.compare(a.name, b.name));

  // Papers: people with an allocation in a committee that takes papers.
  let papersIn = 0;
  let papersOf = 0;
  const paperDue: (Person & { day: number })[] = [];
  for (const m of seated) {
    const p = toPerson(m);
    if (!p.committee || !p.committee.papers_on) continue;
    papersOf += 1;
    const userId = d.apps.get(m.application_id)?.user_id ?? null;
    const status = userId && d.papers ? d.papers.get(userId) : undefined;
    const isIn = !!status && !SENT_BACK.has(status);
    if (isIn) { papersIn += 1; continue; }
    const day = dayOf(p.committee.paper_deadline);
    if (d.papers && day !== null && day >= today && day - today <= PAPER_SOON_DAYS * DAY) paperDue.push({ ...p, day });
  }
  paperDue.sort((a, b) => a.day - b.day || collator.compare(a.committee_label ?? '', b.committee_label ?? '') || collator.compare(a.name, b.name));

  // Tickets: the leader's own Delegate and Advisor Tickets, as the Financials
  // card counts them; a delegation whose members pay for themselves counts
  // their own fees instead.
  const delegateT = d.pay ? tally(d.pay.items, 'delegate') : null;
  const advisorT = d.pay ? tally(d.pay.items, 'advisor') : null;
  const feePayers = seatable.filter(m => !!m.payment_status && m.payment_status !== 'refunded');
  let ticketsPaid: number | null;
  let ticketsOf: number;
  let ticketsWord: string;
  if (delegateT && advisorT && delegateT.total + advisorT.total > 0) {
    ticketsPaid = delegateT.done + advisorT.done;
    ticketsOf = delegateT.total + advisorT.total;
    ticketsWord = plural(ticketsOf, 'ticket paid', 'tickets paid');
  } else if (d.pay || feePayers.length > 0) {
    ticketsPaid = feePayers.filter(m => m.payment_status === 'paid' || m.payment_status === 'waived').length;
    ticketsOf = feePayers.length;
    ticketsWord = plural(ticketsOf, 'fee paid', 'fees paid');
  } else {
    ticketsPaid = null;
    ticketsOf = 0;
    ticketsWord = 'tickets paid';
  }

  const owing = live
    .filter(m => !m.is_me && !!m.payment_status && !['paid', 'waived', 'refunded'].includes(m.payment_status))
    .map(m => ({ ...toPerson(m), word: m.role === 'faculty-advisor' ? 'Owes advisor fee' : 'Owes delegate fee' }))
    .sort((a, b) => collator.compare(a.name, b.name));

  // Dates ahead: the conference, then every committee the delegation sits in.
  const dates: DateRow[] = [];
  const conf = d.conference;
  if (conf && !conf.dates_tbd) {
    const start = dayOf(conf.start_date);
    const end = dayOf(conf.end_date);
    if (start !== null && start >= today) dates.push({ key: 'conf-start', day: start, what: 'Conference starts', committee: null });
    else if (end !== null && end >= today && end !== start) dates.push({ key: 'conf-end', day: end, what: 'Conference ends', committee: null });
  }
  for (const c of d.committees.values()) {
    const paper = c.papers_on ? dayOf(c.paper_deadline) : null;
    if (paper !== null && paper >= today) dates.push({ key: `pp-${c.id}`, day: paper, what: 'Position papers due', committee: c });
    const guides = c.guides_at ? new Date(c.guides_at).getTime() : NaN;
    const guideDay = dayOf(c.guides_at);
    if (!Number.isNaN(guides) && guides > Date.now() && guideDay !== null) dates.push({ key: `sg-${c.id}`, day: guideDay, what: 'Study guide released', committee: c });
  }
  dates.sort((a, b) => a.day - b.day
    || (a.committee ? 1 : 0) - (b.committee ? 1 : 0)
    || collator.compare(a.committee ? shortOf(a.committee) : '', b.committee ? shortOf(b.committee) : '')
    || collator.compare(a.what, b.what));

  return {
    filled: seated.length, totalAllocations: seated.length + open, open,
    papersIn, papersOf, papersKnown: !!d.papers,
    ticketsPaid, ticketsOf, ticketsWord,
    unallocated, owing, paperDue, dates,
  };
}

/** The delegation's own next step, when the page has nothing to do. */
function delegationStep(r: Recap): NextStep | null {
  const open = { label: 'Open delegation', scrollTo: 'section:delegation' };
  const n = r.unallocated.length;
  if (n > 0 && r.open > 0) {
    return { kind: 'action', line: `Allocate ${n} ${plural(n, 'person', 'people')} to your ${r.open} open ${plural(r.open, 'allocation', 'allocations')}.`, action: open };
  }
  if (r.paperDue.length > 0) {
    const p = r.paperDue.length;
    return { kind: 'action', line: `${p} position ${plural(p, 'paper is', 'papers are')} not in yet. The first is due ${relativeWords(r.paperDue[0].day, todayStart())}.`, action: open };
  }
  if (r.owing.length > 0) {
    const o = r.owing.length;
    return { kind: 'action', line: `${o} ${plural(o, 'member still owes their fee', 'members still owe their fee')}.`, action: open };
  }
  return null;
}

export default function LeaderOverview({
  conferenceId, societyId, seat, step, status, roomCode, notice, showDone, active, onOpenSection,
}: {
  conferenceId: string;
  societyId: string;
  /** A head delegate's own seat card, drawn first. */
  seat?: React.ReactNode;
  /** The page's next step (pageNextStep). */
  step: NextStep | null;
  status: string;
  roomCode: string | null;
  notice?: React.ReactNode;
  showDone?: boolean;
  /** Overview is the section on screen: shown again, it re-reads in place. */
  active: boolean;
  onOpenSection: (key: string) => void;
}) {
  const { state, reload } = useLeaderOverview(conferenceId, societyId);
  const today = todayStart();
  const recap = useMemo(() => (state.kind === 'ready' && state.data.isLeader ? buildRecap(state.data, today) : null), [state, today]);
  const confDates = state.kind === 'ready' ? state.data.conference : null;

  // Coming back to Overview (after moving people in Delegation) re-reads in place.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) void reload();
    wasActive.current = active;
  }, [active, reload]);

  const own = recap ? delegationStep(recap) : null;
  const shownStep = step?.kind === 'action' ? step : own ?? step;

  const lead = (
    <>
      {seat}
      <DelegationLead
        step={shownStep}
        status={status}
        roomCode={roomCode}
        notice={notice}
        showDone={showDone}
        onOpenSection={onOpenSection}
      />
    </>
  );

  if (state.kind === 'loading') {
    return (
      <>
        {lead}
        <div className="@container flex flex-col gap-4" aria-hidden>
          <div className="grid grid-cols-2 @[880px]:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex flex-col gap-2.5" style={{ ...cardStyle, padding: '14px 18px' }}>
                <SkeletonBlock width="45%" height={24} radius={8} />
                <SkeletonBlock width="70%" height={12} radius={6} />
              </div>
            ))}
          </div>
          <div style={{ ...cardStyle, padding: '14px 20px' }}>
            <SkeletonBlock width="60%" height={16} radius={6} />
          </div>
        </div>
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        {lead}
        <div style={{ ...cardStyle, padding: '20px 24px' }}>
          <p role="alert" style={{ fontFamily: FONT, fontSize: 14, color: '#8B2020', margin: 0 }}>{state.message}</p>
        </div>
      </>
    );
  }

  if (!recap) return lead;

  return (
    <>
      {lead}
      <div className="@container flex flex-col gap-4 min-w-0">
        <section aria-label="Your delegation at a glance" className="grid grid-cols-2 @[880px]:grid-cols-4 gap-3">
          <Tile n={recap.filled} of={recap.totalAllocations} word={plural(recap.totalAllocations, 'allocation filled', 'allocations filled')} />
          <Tile n={recap.open} word={plural(recap.open, 'open allocation', 'open allocations')} />
          <Tile n={recap.papersKnown ? recap.papersIn : null} of={recap.papersOf} word={plural(recap.papersOf, 'position paper in', 'position papers in')} />
          <Tile n={recap.ticketsPaid} of={recap.ticketsOf} word={recap.ticketsWord} />
        </section>
        {/* Add delegate, right below the delegation (owner, 21 Oct 2026). */}
        <AddDelegatePanel
          societyId={societyId}
          conferenceId={conferenceId}
          societyName={state.kind === 'ready' ? state.data.societyName : null}
          onAdded={() => { void reload(); }}
          onOpenSection={onOpenSection}
        />
        <DeadlinesLine conference={confDates} rows={recap.dates} today={today} />
      </div>
    </>
  );
}

function Tile({ n, of, word }: { n: number | null; of?: number; word: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0" style={{ ...cardStyle, padding: '14px 18px' }}>
      <span style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        <span style={{ fontSize: 26, fontWeight: 600, color: INK }}>{n ?? '–'}</span>
        {of !== undefined && of > 0 && <span style={{ fontSize: 16, fontWeight: 500, color: INK_SOFT }}> of {of}</span>}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.35 }}>{word}</span>
    </div>
  );
}

/** "12 to 14 Mar", "28 Feb to 2 Mar", "12 Mar"; the year when it is not this one. */
function rangeWords(start: number, end: number | null): string {
  if (end === null || end === start) return dayWords(start);
  const a = new Date(start);
  const b = new Date(end);
  const thisYear = new Date().getFullYear();
  const yearB = b.getFullYear() === thisYear ? '' : ` ${b.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}${yearB}`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}${yearB}`;
  return `${dayWords(start)} to ${dayWords(end)}`;
}

interface DateGroup { key: string; day: number; what: string; committees: OverviewCommittee[] }

/** The next two dates ahead; committees sharing a day and a kind are one entry. */
function nextGroups(rows: DateRow[], cap: number): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const r of rows) {
    if (!r.committee) continue;
    const g = groups.find(x => x.day === r.day && x.what === r.what);
    if (g) g.committees.push(r.committee);
    else if (groups.length < cap) groups.push({ key: r.key, day: r.day, what: r.what, committees: [r.committee] });
    else if (r.day > groups[groups.length - 1].day) break;
  }
  return groups;
}

const NAMED_CAP = 3;

/** Deadlines, kept small (owner, 21 Oct 2026: "not too much"): the conference
 *  dates, then at most the next two dates, in one card. */
function DeadlinesLine({ conference, rows, today }: {
  conference: LeaderOverviewData['conference'];
  rows: DateRow[];
  today: number;
}) {
  const start = conference && !conference.dates_tbd ? dayOf(conference.start_date) : null;
  const end = conference && !conference.dates_tbd ? dayOf(conference.end_date) : null;
  const groups = nextGroups(rows, 2);
  const itemStyle: React.CSSProperties = { fontFamily: FONT, fontSize: 14, color: INK, lineHeight: 1.4 };
  const soft: React.CSSProperties = { color: INK_SOFT };
  return (
    <section aria-label="Deadlines" className="flex flex-wrap items-center gap-x-7 gap-y-2.5 min-w-0" style={{ ...cardStyle, padding: '14px 20px' }}>
      <h2 className="inline-flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, margin: 0 }}>
        <CalendarDays size={18} strokeWidth={STROKE} aria-hidden style={{ color: 'var(--gv-main)', flexShrink: 0 }} />
        Deadlines
      </h2>
      <span className="[overflow-wrap:anywhere] min-w-0" style={itemStyle}>
        <span style={{ fontWeight: 600 }}>Conference </span>
        {start !== null
          ? <>{rangeWords(start, end)}{start > today && <span style={soft}>{` · ${relativeWords(start, today)}`}</span>}</>
          : <span style={soft}>Dates to be decided</span>}
      </span>
      {groups.map(g => {
        const named = g.committees.slice(0, NAMED_CAP).map(c => shortOf(c));
        const more = g.committees.length - named.length;
        return (
          <span key={g.key} className="inline-flex items-center gap-2 min-w-0" style={itemStyle}>
            <span className="inline-flex items-center flex-none">
              {g.committees.slice(0, NAMED_CAP).map((c, i) => (
                <span key={c.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                  <CommitteeDisc src={committeeEmblemSrc(c.logo_url, c.name, c.abbreviation)} size={22} />
                </span>
              ))}
            </span>
            <span className="[overflow-wrap:anywhere] min-w-0">
              <span style={{ fontWeight: 600 }}>{g.what}</span>
              {` ${dayWords(g.day)}`}
              <span style={soft}>{` · ${relativeWords(g.day, today)} · ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`}</span>
            </span>
          </span>
        );
      })}
    </section>
  );
}
