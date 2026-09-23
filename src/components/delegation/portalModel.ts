// ─────────────────────────────────────────────────────────────────────────────
// portalModel.ts: the delegation portal's data, read in ONE call.
//
// `delegation_portal_overview(p_society)` (SECURITY DEFINER, leaders only) returns
// the delegation, its conference, every member application (any status but
// withdrawn), the block seats the organiser gave it, the committees those seats
// and the members' own seats are in, and every invoice of the delegation with
// what the PAYMENTS LEDGER says came in (received = Stripe, offline = manual),
// never `payment_status` (CLAUDE.md section 3).
//
// Everything below is pure: types, parsing, and the derived numbers the tabs show.
// ─────────────────────────────────────────────────────────────────────────────

import { invoiceLabel } from '@/lib/invoices';

export type MemberRole = 'delegate' | 'head-delegate' | 'faculty-advisor' | (string & {});
export type MemberStatus = 'submitted' | 'accepted' | 'assigned' | 'checked-in' | 'rejected' | 'withdrawn' | (string & {});

export interface PortalMember {
  id: string;
  user_id: string | null;
  role: MemberRole;
  is_head_delegate: boolean;
  status: MemberStatus;
  name: string;
  avatar_url: string | null;
  registered: boolean;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  spots_pledged: number;
  advisors_pledged: number;
  submitted_at: string | null;
}

export interface PortalCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
}

export interface PortalSeat {
  id: string;
  committee_id: string;
  country_code: string;
  country_name: string;
  user_id: string | null;
  application_id: string | null;
  seat: number | null;
}

export interface PortalInvoice {
  id: string;
  application_id: string | null;
  kind: string;
  label: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: 'open' | 'partial' | 'settled' | 'waived' | 'void' | (string & {});
  society_level: boolean;
  created_at: string;
  received_cents: number;
  offline_cents: number;
}

export interface PortalSociety {
  id: string;
  name: string;
  conference_id: string;
  /** Added by the apply-flow work (23 Sep 2026). Absent on older rows / before the column exists. */
  city?: string | null;
  country_code?: string | null;
  logo_url?: string | null;
  spots_purchased?: number | null;
  advisor_spots_purchased?: number | null;
}

export interface PortalConference {
  id: string;
  slug: string;
  full_name: string | null;
  acronym: string | null;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
}

export interface PortalData {
  me: { application_id: string; role: MemberRole };
  facultyAdvisorsEnabled: boolean;
  inviteToken: string | null;
  society: PortalSociety;
  conference: PortalConference;
  members: PortalMember[];
  committees: PortalCommittee[];
  seats: PortalSeat[];
  invoices: PortalInvoice[];
}

export type PortalLoad =
  | { kind: 'ok'; data: PortalData }
  | { kind: 'denied' }
  | { kind: 'not_found' }
  | { kind: 'error' };

/** Parse the RPC answer. Anything unexpected is an error, never a crash. */
export function parsePortal(raw: unknown): PortalLoad {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return { kind: 'error' };
  if (r.ok !== true) {
    if (r.reason === 'denied') return { kind: 'denied' };
    if (r.reason === 'not_found') return { kind: 'not_found' };
    return { kind: 'error' };
  }
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
  const invoices = ((r.invoices as PortalInvoice[] | null) ?? []).map((i) => ({
    ...i,
    amount_cents: num(i.amount_cents),
    amount_paid_cents: num(i.amount_paid_cents),
    received_cents: num(i.received_cents),
    offline_cents: num(i.offline_cents),
  }));
  return {
    kind: 'ok',
    data: {
      me: r.me as PortalData['me'],
      facultyAdvisorsEnabled: r.faculty_advisors_enabled === true,
      inviteToken: (r.invite_token as string | null) ?? null,
      society: r.society as PortalSociety,
      conference: r.conference as PortalConference,
      members: (r.members as PortalMember[] | null) ?? [],
      committees: (r.committees as PortalCommittee[] | null) ?? [],
      seats: (r.seats as PortalSeat[] | null) ?? [],
      invoices,
    },
  };
}

// ── Roles and statuses ───────────────────────────────────────────────────────

export function isHead(m: Pick<PortalMember, 'role' | 'is_head_delegate'>): boolean {
  return m.role === 'head-delegate' || m.is_head_delegate;
}

export const ROLE_WORD: Record<string, string> = {
  'head-delegate': 'Head delegate',
  delegate: 'Delegate',
  'faculty-advisor': 'Faculty advisor',
  observer: 'Observer',
  chair: 'Chair',
};

export function roleWord(role: string): string {
  return ROLE_WORD[role] ?? role;
}

/** A live member: counts toward the delegation. */
export function isLive(m: PortalMember): boolean {
  return m.status !== 'rejected' && m.status !== 'withdrawn';
}

export function isAccepted(m: PortalMember): boolean {
  return m.status === 'accepted' || m.status === 'assigned' || m.status === 'checked-in';
}

/** Can sit in a committee seat (the `delegation_assign_seat` rule). */
export function canHoldSeat(m: PortalMember): boolean {
  return (m.role === 'delegate' || m.role === 'head-delegate') && isAccepted(m) && m.registered && !!m.user_id;
}

// ── Committees ───────────────────────────────────────────────────────────────

/** Long names show the acronym with the full name beneath; short names once. */
export function committeeDisplay(c: PortalCommittee | null | undefined): { primary: string; secondary: string | null } {
  if (!c) return { primary: 'Committee', secondary: null };
  const hasAbbr = !!c.abbreviation && c.abbreviation.toUpperCase() !== c.name.toUpperCase();
  const isLong = c.name.length > 16 || c.name.trim().split(/\s+/).length >= 3;
  if (hasAbbr && isLong) return { primary: c.abbreviation as string, secondary: c.name };
  return { primary: c.name, secondary: null };
}

export function committeeMonogram(c: PortalCommittee | null | undefined): string {
  if (!c) return '?';
  if (c.abbreviation) return c.abbreviation.slice(0, 4);
  const mono = c.name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return mono || c.name.slice(0, 3).toUpperCase();
}

export function initialsOf(name: string, max = 3): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, max).map((w) => w[0]).join('').toUpperCase();
}

// ── Seats ────────────────────────────────────────────────────────────────────

export interface SeatView {
  seat: PortalSeat;
  committee: PortalCommittee | null;
  holder: PortalMember | null;
}

export function seatHolder(seat: PortalSeat, members: PortalMember[]): PortalMember | null {
  if (seat.application_id) {
    const m = members.find((x) => x.id === seat.application_id);
    if (m) return m;
  }
  if (seat.user_id) return members.find((x) => x.user_id === seat.user_id && isLive(x)) ?? null;
  return null;
}

/** Block seats grouped by committee, committees sorted by display name. */
export function seatsByCommittee(data: PortalData): { committee: PortalCommittee | null; seats: SeatView[] }[] {
  const byId = new Map(data.committees.map((c) => [c.id, c]));
  const groups = new Map<string, SeatView[]>();
  for (const s of data.seats) {
    const list = groups.get(s.committee_id) ?? [];
    list.push({ seat: s, committee: byId.get(s.committee_id) ?? null, holder: seatHolder(s, data.members) });
    groups.set(s.committee_id, list);
  }
  return Array.from(groups.entries())
    .map(([id, seats]) => ({ committee: byId.get(id) ?? null, seats }))
    .sort((a, b) => committeeDisplay(a.committee).primary.localeCompare(committeeDisplay(b.committee).primary));
}

// ── Money (the ledger) ───────────────────────────────────────────────────────

export function invoiceDue(i: PortalInvoice): number {
  return i.status === 'open' || i.status === 'partial' ? Math.max(0, i.amount_cents - i.amount_paid_cents) : 0;
}

export function isCoveredByDelegation(i: PortalInvoice): boolean {
  return i.status === 'waived' && (i.label ?? '').toLowerCase().includes('covered by delegation');
}

export type InvoiceState = 'paid' | 'part' | 'unpaid' | 'covered' | 'waived';

export function invoiceState(i: PortalInvoice): InvoiceState {
  if (i.status === 'settled') return 'paid';
  if (isCoveredByDelegation(i)) return 'covered';
  if (i.status === 'waived') return 'waived';
  if (i.status === 'partial' || (i.status === 'open' && i.amount_paid_cents > 0)) return 'part';
  return 'unpaid';
}

export function invoiceTitle(i: PortalInvoice): string {
  if (i.kind === 'role_fee') return 'Registration';
  return invoiceLabel({ kind: i.kind, label: i.label });
}

export interface MoneySummary {
  currency: string;
  receivedCents: number;
  receivedCount: number;
  offlineCents: number;
  offlineCount: number;
  outstandingCents: number;
  outstandingCount: number;
  coveredCount: number;
  myOutstandingCents: number;
  myOpenCount: number;
  otherCurrencies: string[];
  pledgedSpots: number;
  pledgeSpotsPaid: number;
  pledgeSpotsOpen: number;
  advisorSpots: number;
}

/** Figures in the conference currency. An invoice in another currency is named, never summed in. */
export function moneySummary(data: PortalData): MoneySummary {
  const cur = (data.conference.currency || 'USD').toUpperCase();
  const liveApps = new Set(data.members.filter(isLive).map((m) => m.id));
  const s: MoneySummary = {
    currency: cur, receivedCents: 0, receivedCount: 0, offlineCents: 0, offlineCount: 0,
    outstandingCents: 0, outstandingCount: 0, coveredCount: 0, myOutstandingCents: 0, myOpenCount: 0,
    otherCurrencies: [], pledgedSpots: 0, pledgeSpotsPaid: 0, pledgeSpotsOpen: 0, advisorSpots: 0,
  };
  const others = new Set<string>();
  for (const i of data.invoices) {
    if (i.application_id && !liveApps.has(i.application_id) && !i.society_level) continue;
    if (i.currency !== cur) { others.add(i.currency); continue; }
    if (i.received_cents > 0) { s.receivedCents += i.received_cents; s.receivedCount += 1; }
    if (i.offline_cents > 0) { s.offlineCents += i.offline_cents; s.offlineCount += 1; }
    const due = invoiceDue(i);
    if (due > 0) {
      s.outstandingCents += due; s.outstandingCount += 1;
      if (i.application_id === data.me.application_id) { s.myOutstandingCents += due; s.myOpenCount += 1; }
    }
    if (isCoveredByDelegation(i)) s.coveredCount += 1;
    if (i.kind === 'pledge_spot') {
      if (i.status === 'settled' || i.status === 'waived') s.pledgeSpotsPaid += 1;
      else s.pledgeSpotsOpen += 1;
    }
    if (i.kind === 'advisor_spot') s.advisorSpots += 1;
  }
  s.pledgedSpots = data.members.filter(isLive).reduce((n, m) => n + (m.spots_pledged || 0), 0);
  s.otherCurrencies = Array.from(others);
  return s;
}
