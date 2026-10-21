// What the delegation Overview draws, computed from useDelegationOverview's
// read (and the viewer's open balances for payment due dates). Pure.

import { committeeDisplayName } from '@/lib/presetNames';
import type { NextStep } from '../../dashboardKit';
import type { OpenBalance } from '../../PayNowCard';
import type { DelegationOverviewData, OverviewCommittee } from './useDelegationOverview';
import { DAY, dayOf, relativeWords } from './overviewDates';

const LIVE = new Set(['accepted', 'assigned', 'checked-in']);
const SENT_BACK = new Set(['rejected', 'needs_revision', 'returned']);
const PAPER_SOON_DAYS = 14;
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
export const shortOf = (c: Pick<OverviewCommittee, 'name' | 'abbreviation'>) => (c.abbreviation ?? '').trim() || committeeDisplayName(c.name, c.abbreviation);

export interface Person {
  application_id: string;
  name: string;
  avatar_url: string | null;
  is_me: boolean;
  role: string;
}

export interface CommitteeBrief {
  committee: OverviewCommittee;
  people: number;
  open: number;
}

export type DeadlineKind = 'conference' | 'paper' | 'guide' | 'payment';

export interface DeadlineRow {
  key: string;
  day: number;
  /** For the conference: its last day when it runs over several. */
  endDay?: number | null;
  kind: DeadlineKind;
  what: string;
  committees: OverviewCommittee[];
}

export interface Recap {
  /** Delegates and head delegates still in the delegation. */
  delegateCount: number;
  leaders: Person[];
  committeesBrief: CommitteeBrief[];
  papersIn: number;
  papersOf: number;
  papersKnown: boolean;
  papersMissing: Person[];
  unallocated: Person[];
  openCount: number;
  owing: Person[];
  paperDue: { day: number }[];
  deadlines: DeadlineRow[];
  /** The conference's dates are not decided yet. */
  datesTbd: boolean;
}

export function buildRecap(d: DelegationOverviewData, today: number, balances: OpenBalance[] | null): Recap {
  const live = d.members.filter(m => LIVE.has(m.status));
  const toPerson = (m: DelegationOverviewData['members'][number]): Person => ({
    application_id: m.application_id, name: m.name, avatar_url: m.avatar_url, is_me: m.is_me, role: m.role,
  });
  const committeeOf = (applicationId: string) => {
    const id = d.apps.get(applicationId)?.assigned_committee_id ?? null;
    return id ? d.committees.get(id) ?? null : null;
  };
  const isSeated = (m: DelegationOverviewData['members'][number]) => m.role !== 'faculty-advisor'
    && !!m.allocation?.country_name && !!(m.allocation.committee || m.allocation.committee_abbr);
  const seatable = live.filter(m => m.role === 'delegate' || m.role === 'head-delegate');
  const seated = seatable.filter(isSeated);

  const leaders = live
    .filter(m => m.role === 'head-delegate' || m.role === 'faculty-advisor')
    .map(toPerson)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'faculty-advisor' ? -1 : 1) || collator.compare(a.name, b.name));

  const unallocated = seatable
    .filter(m => !isSeated(m) && d.apps.get(m.application_id)?.attending !== false)
    .map(toPerson)
    .sort((a, b) => collator.compare(a.name, b.name));

  // Papers: people with an allocation in a committee that takes papers.
  let papersIn = 0;
  let papersOf = 0;
  const papersMissing: Person[] = [];
  const paperDue: { day: number }[] = [];
  for (const m of seated) {
    const c = committeeOf(m.application_id);
    if (!c || !c.papers_on) continue;
    papersOf += 1;
    const userId = d.apps.get(m.application_id)?.user_id ?? null;
    const status = userId && d.papers ? d.papers.get(userId) : undefined;
    if (status && !SENT_BACK.has(status)) { papersIn += 1; continue; }
    papersMissing.push(toPerson(m));
    const day = dayOf(c.paper_deadline);
    if (d.papers && day !== null && day >= today && day - today <= PAPER_SOON_DAYS * DAY) paperDue.push({ day });
  }
  papersMissing.sort((a, b) => collator.compare(a.name, b.name));
  paperDue.sort((a, b) => a.day - b.day);

  const owing = live
    .filter(m => !m.is_me && !!m.payment_status && !['paid', 'waived', 'refunded'].includes(m.payment_status))
    .map(toPerson);

  // The committees the delegation sits in, with its people and open allocations.
  const briefs = new Map<string, CommitteeBrief>();
  for (const c of d.committees.values()) briefs.set(c.id, { committee: c, people: 0, open: 0 });
  for (const m of seated) {
    const c = committeeOf(m.application_id);
    if (c) { const b = briefs.get(c.id); if (b) b.people += 1; }
  }
  for (const s of d.openSeats ?? []) {
    const b = briefs.get(s.conference_committee_id);
    if (b) b.open += 1;
  }
  const committeesBrief = [...briefs.values()]
    .filter(b => b.people + b.open > 0)
    .sort((a, b) => collator.compare(shortOf(a.committee), shortOf(b.committee)));

  // Dates ahead, in order: the conference, papers, guides, payments.
  const rows: DeadlineRow[] = [];
  const conf = d.conference;
  const datesTbd = !conf || conf.dates_tbd;
  if (conf && !conf.dates_tbd) {
    const start = dayOf(conf.start_date);
    const end = dayOf(conf.end_date);
    if (start !== null && (start >= today || (end !== null && end >= today))) {
      rows.push({ key: 'conference', day: start >= today ? start : (end as number), endDay: start >= today ? end : null, kind: 'conference', what: start >= today ? 'Conference' : 'Conference ends', committees: [] });
    }
  }
  const add = (kind: DeadlineKind, what: string, day: number, c: OverviewCommittee) => {
    const same = rows.find(r => r.kind === kind && r.day === day);
    if (same) { same.committees.push(c); return; }
    rows.push({ key: `${kind}-${c.id}`, day, kind, what, committees: [c] });
  };
  const nowMs = Date.now();
  for (const c of d.committees.values()) {
    const paper = c.papers_on ? dayOf(c.paper_deadline) : null;
    if (paper !== null && paper >= today) add('paper', 'Position papers due', paper, c);
    const guideMs = c.guides_at ? new Date(c.guides_at).getTime() : NaN;
    const guideDay = dayOf(c.guides_at);
    if (!Number.isNaN(guideMs) && guideMs > nowMs && guideDay !== null) add('guide', 'Study guide out', guideDay, c);
  }
  for (const b of balances ?? []) {
    const due = dayOf(b.due_date);
    if (due !== null && due >= today && !rows.some(r => r.kind === 'payment' && r.day === due)) {
      rows.push({ key: `payment-${b.currency}-${due}`, day: due, kind: 'payment', what: 'Payment due', committees: [] });
    }
  }
  const kindOrder: Record<DeadlineKind, number> = { conference: 3, payment: 0, paper: 1, guide: 2 };
  rows.sort((a, b) => a.day - b.day || kindOrder[a.kind] - kindOrder[b.kind]);
  for (const r of rows) r.committees.sort((a, b) => collator.compare(shortOf(a), shortOf(b)));

  return {
    delegateCount: seatable.length,
    leaders,
    committeesBrief,
    papersIn, papersOf, papersKnown: !!d.papers, papersMissing,
    unallocated,
    openCount: d.openSeats?.length ?? 0,
    owing,
    paperDue,
    deadlines: rows,
    datesTbd,
  };
}

/** A leader's delegation step, when the page has nothing to do. */
export function delegationStep(r: Recap, today: number): NextStep | null {
  const open = { label: 'Open delegation', scrollTo: 'section:delegation' };
  const n = r.unallocated.length;
  if (n > 0 && r.openCount > 0) {
    return { kind: 'action', line: `Allocate ${n} ${plural(n, 'person', 'people')} to your ${r.openCount} open ${plural(r.openCount, 'allocation', 'allocations')}.`, action: open };
  }
  if (r.paperDue.length > 0) {
    const p = r.paperDue.length;
    return { kind: 'action', line: `${p} position ${plural(p, 'paper is', 'papers are')} not in yet. The first is due ${relativeWords(r.paperDue[0].day, today)}.`, action: open };
  }
  if (r.owing.length > 0) {
    const o = r.owing.length;
    return { kind: 'action', line: `${o} ${plural(o, 'member still owes their fee', 'members still owe their fee')}.`, action: open };
  }
  return null;
}
