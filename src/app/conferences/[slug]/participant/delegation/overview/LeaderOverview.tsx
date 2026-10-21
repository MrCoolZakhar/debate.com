'use client';

// A leader's Overview (head delegates and faculty advisors; owner, 21 Oct 2026:
// "a recap a faculty advisor would want"). Calm, one obvious next step:
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
//   Deadlines        every date ahead, in order, with relative words ("in 5
//                    days"): the conference, each committee's position paper
//                    deadline and study guide release, committees A to Z on a
//                    shared day.
//   Needs your attention
//                    members without an allocation, members who owe their fee,
//                    papers not in within 14 days of their deadline.
// A head delegate's own seat ("Your seat") follows from DelegateParticipant's
// Overview pane. Reads: useLeaderOverview (nothing new on the database). Grey
// skeletons on the first read only; every later read (the section shown again)
// swaps in place. No pills, names never cut, flags and committee logos.

import { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, CheckCircle2, CircleAlert } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import DelegationLead from '../DelegationLead';
import type { NextStep } from '../../dashboardKit';
import { BTN_CLASS, cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, FOREST, INK, INK_SOFT, LINE, OWE, RoundAvatar, secondaryBtn, STROKE } from '../leaderKit';
import { tally } from '../FinancialsCard';
import { useLeaderOverview, type LeaderOverviewData, type OverviewCommittee } from './useLeaderOverview';

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
  conferenceId, societyId, step, status, roomCode, notice, showDone, active, onOpenSection,
}: {
  conferenceId: string;
  societyId: string;
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

  // Coming back to Overview (after moving people in Delegation) re-reads in place.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) void reload();
    wasActive.current = active;
  }, [active, reload]);

  const own = recap ? delegationStep(recap) : null;
  const shownStep = step?.kind === 'action' ? step : own ?? step;

  const lead = (
    <DelegationLead
      step={shownStep}
      status={status}
      roomCode={roomCode}
      notice={notice}
      showDone={showDone}
      onOpenSection={onOpenSection}
    />
  );

  if (state.kind === 'loading') {
    return (
      <>
        {lead}
        <div className="@container flex flex-col gap-6" aria-hidden>
          <div className="grid grid-cols-2 @[880px]:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex flex-col gap-3" style={{ ...cardStyle, padding: '20px 22px' }}>
                <SkeletonBlock width="45%" height={30} radius={8} />
                <SkeletonBlock width="70%" height={13} radius={6} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 @[880px]:grid-cols-2 gap-6">
            {[0, 1].map(i => (
              <div key={i} className="flex flex-col gap-3" style={{ ...cardStyle, padding: '22px 24px' }}>
                <SkeletonBlock width="35%" height={18} radius={6} />
                <SkeletonBlock height={14} radius={6} />
                <SkeletonBlock height={14} radius={6} />
                <SkeletonBlock width="80%" height={14} radius={6} />
              </div>
            ))}
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
      <div className="@container flex flex-col gap-6 min-w-0">
        <section aria-label="Your delegation at a glance" className="grid grid-cols-2 @[880px]:grid-cols-4 gap-4">
          <Tile n={recap.filled} of={recap.totalAllocations} word={plural(recap.totalAllocations, 'allocation filled', 'allocations filled')} />
          <Tile n={recap.open} word={plural(recap.open, 'open allocation', 'open allocations')} />
          <Tile n={recap.papersKnown ? recap.papersIn : null} of={recap.papersOf} word={plural(recap.papersOf, 'position paper in', 'position papers in')} />
          <Tile n={recap.ticketsPaid} of={recap.ticketsOf} word={recap.ticketsWord} />
        </section>

        <div className="grid grid-cols-1 @[880px]:grid-cols-2 gap-6 items-start">
          <DeadlinesCard rows={recap.dates} today={today} />
          <AttentionCard recap={recap} onOpenDelegation={() => onOpenSection('delegation')} />
        </div>
      </div>
    </>
  );
}

function Tile({ n, of, word }: { n: number | null; of?: number; word: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0" style={{ ...cardStyle, padding: '20px 22px' }}>
      <span style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        <span style={{ fontSize: 32, fontWeight: 600, color: INK }}>{n ?? '–'}</span>
        {of !== undefined && of > 0 && <span style={{ fontSize: 18, fontWeight: 500, color: INK_SOFT }}> of {of}</span>}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, lineHeight: 1.35 }}>{word}</span>
    </div>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={20} strokeWidth={STROKE} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
      <h2 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, margin: 0 }}>{children}</h2>
    </div>
  );
}

function DeadlinesCard({ rows, today }: { rows: DateRow[]; today: number }) {
  return (
    <section className="flex flex-col min-w-0" style={{ ...cardStyle, padding: '20px 24px', gap: 12 }} aria-label="Deadlines">
      <CardTitle icon={CalendarDays}>Deadlines</CardTitle>
      {rows.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>No dates ahead yet. They show here once the organisers set them.</p>
      ) : (
        <ul className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 min-w-0" style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}>
              {r.committee ? (
                <CommitteeDisc src={committeeEmblemSrc(r.committee.logo_url, r.committee.name, r.committee.abbreviation)} size={30} />
              ) : (
                <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, color: FOREST }}>
                  <CalendarDays size={20} strokeWidth={STROKE} aria-hidden />
                </span>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: INK, lineHeight: 1.3 }}>{r.what}</span>
                {r.committee && (
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.35 }}>
                    {shortOf(r.committee)}{shortOf(r.committee) !== r.committee.name ? ` · ${r.committee.name}` : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end flex-none" style={{ fontFamily: FONT, textAlign: 'right' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{dayWords(r.day)}</span>
                <span style={{ fontSize: 13, color: INK_SOFT }}>{relativeWords(r.day, today)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GROUP_CAP = 6;

function PersonLine({ p, detail }: { p: Person; detail?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 min-w-0" style={{ padding: '7px 0' }}>
      <RoundAvatar name={p.name} url={p.avatar_url} size={32} seed={p.application_id} />
      <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: INK, lineHeight: 1.3 }}>
        {p.name}
        {p.is_me && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 6 }}>You</span>}
      </span>
      {detail && <span className="flex-none max-w-[50%] inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.3, textAlign: 'right' }}>{detail}</span>}
    </li>
  );
}

function Group({ n, word, children, more }: { n: number; word: string; children: React.ReactNode; more: number }) {
  return (
    <div className="flex flex-col min-w-0">
      <p className="flex items-baseline gap-2" style={{ fontFamily: FONT, margin: '0 0 2px' }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <span style={{ fontSize: 14.5, color: INK_SOFT }}>{word}</span>
      </p>
      <ul className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{children}</ul>
      {more > 0 && <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '2px 0 0 44px' }}>And {more} more in Delegation</p>}
    </div>
  );
}

function SeatBits({ p }: { p: Person }) {
  if (!p.country_name) return null;
  return (
    <>
      <CircleFlag code={p.country_code} label={p.country_name} size={16} decorative />
      {p.committee && <CommitteeDisc src={committeeEmblemSrc(p.committee.logo_url, p.committee.name, p.committee.abbreviation)} size={16} />}
      {p.committee_label ?? p.country_name}
    </>
  );
}

function AttentionCard({ recap, onOpenDelegation }: { recap: Recap; onOpenDelegation: () => void }) {
  const { unallocated, owing, paperDue } = recap;
  const any = unallocated.length + owing.length + paperDue.length > 0;
  return (
    <section className="flex flex-col min-w-0" style={{ ...cardStyle, padding: '20px 24px', gap: 14 }} aria-label="Needs your attention">
      <CardTitle icon={CircleAlert}>Needs Your Attention</CardTitle>
      {!any ? (
        <p className="inline-flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
          <CheckCircle2 size={18} strokeWidth={STROKE} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
          Nothing needs your attention right now
        </p>
      ) : (
        <>
          {unallocated.length > 0 && (
            <Group n={unallocated.length} word={plural(unallocated.length, 'person without an allocation', 'people without an allocation')} more={Math.max(0, unallocated.length - GROUP_CAP)}>
              {unallocated.slice(0, GROUP_CAP).map(p => <PersonLine key={p.application_id} p={p} />)}
            </Group>
          )}
          {paperDue.length > 0 && (
            <Group n={paperDue.length} word={plural(paperDue.length, 'position paper not in yet', 'position papers not in yet')} more={Math.max(0, paperDue.length - GROUP_CAP)}>
              {paperDue.slice(0, GROUP_CAP).map(p => (
                <PersonLine key={p.application_id} p={p} detail={<><SeatBits p={p} /><span>{`· due ${relativeWords(p.day, todayStart())}`}</span></>} />
              ))}
            </Group>
          )}
          {owing.length > 0 && (
            <Group n={owing.length} word={plural(owing.length, 'member owes their fee', 'members owe their fee')} more={Math.max(0, owing.length - GROUP_CAP)}>
              {owing.slice(0, GROUP_CAP).map(p => (
                <PersonLine key={p.application_id} p={p} detail={<span style={{ color: OWE }}>{p.word}</span>} />
              ))}
            </Group>
          )}
          <div>
            <button type="button" onClick={onOpenDelegation} className={BTN_CLASS} style={secondaryBtn}>Open delegation</button>
          </div>
        </>
      )}
    </section>
  );
}
