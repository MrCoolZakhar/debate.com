// delegationRows.ts: one delegation, as the organiser decides about it.
//
// Pure derivation, no I/O. The Delegations list in Applications
// (DelegationsBoard.tsx) feeds it three things it already has or reads once:
// the applications the page loaded, the conference's societies, and the
// conference's invoices + succeeded payments. Everything a delegation row
// shows is computed here, so the row, the counts above the list and the
// filters can never disagree.
//
// MONEY FOLLOWS CLAUDE.md §3. Money is the payments ledger, never
// `applications.payment_status` multiplied by a fee:
//   received     succeeded Stripe payments on the delegation's invoices
//   offline      succeeded manual payments (marked paid, approved proof),
//                shown apart and never added to received
//   due          open / partial invoice balances of ACCEPTED members
//                (accepted, assigned, checked-in), the same rule as
//                conference_money_summary()'s `outstanding`
// A delegation's invoices are the ones carrying its `society_id` (pledged
// spots, advisor tickets, per-delegation fees) plus every invoice in a
// member's own name, de-duplicated by invoice id. Only the conference
// currency is summed; anything else is reported as `otherCurrency` so a row
// can say it left something out rather than quietly doing so.

export interface DelegationMemberLite {
  id: string;
  user_id: string | null;
  invited_name: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  is_head_delegate: boolean;
  payment_status: string | null;
  self_paid: boolean;
  attending: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
  society_id: string | null;
  submitted_at: string;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null } | null;
}

export interface SocietyLite {
  id: string;
  name: string;
  spots_purchased: number;
  advisor_spots_purchased: number;
  created_at: string;
  city: string | null;
  country_code: string | null;
  logo_url: string | null;
}

export interface InvoiceLite {
  id: string;
  application_id: string | null;
  society_id: string | null;
  kind: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string;
}

export interface PaymentLite {
  invoice_id: string;
  amount_cents: number;
  currency: string;
  method: string;
}

/** Statuses in which a person is coming (or may be). Mirrors pledgedSpots.ts. */
export const LIVE = new Set(['submitted', 'accepted', 'assigned', 'checked-in']);
/** Accepted or beyond, the same group the Accepted tile counts. */
export const ACCEPTED = new Set(['accepted', 'assigned', 'checked-in']);
/** Roles that take a committee seat, so allocation progress is about them. */
const SEATED_ROLES = new Set(['delegate', 'head-delegate']);

export interface DelegationRow<M extends DelegationMemberLite = DelegationMemberLite> {
  id: string;
  name: string;
  /** Every member row, any status: live first, head delegates first, then by name. */
  members: M[];
  heads: M[];
  /** Most common nationality among live members, as a country name. Only a
   *  fallback for delegations saved before `societies.country_code` existed;
   *  it is labelled as the members' nationality wherever it is shown. */
  country: string | null;
  /** Where the delegation is based and its logo (`societies` columns). */
  city: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  /** Pledged delegate spots + advisor tickets on live pledges. */
  pledged: number;
  /** Spots the organiser has confirmed as paid for (societies columns). */
  purchased: number;
  /** What the delegation said it would bring: the pledge, else the confirmed
   *  spots, else null (no pledge on record). */
  expected: number | null;
  registered: number;
  pending: M[];
  accepted: number;
  /** Accepted members who take a seat, and how many of them have one. */
  seatable: number;
  allocated: number;
  notAttending: number;
  /** Open application drafts that name this delegation. */
  applying: number;
  /** A live pledge exists and the organiser has not marked it received. */
  pledgeAwaiting: boolean;
  receivedCents: number;
  offlineCents: number;
  dueCents: number;
  /** Members (and heads, for delegation invoices) who owe any of `dueCents`. */
  owingMemberIds: string[];
  otherCurrency: boolean;
}

export function memberName(m: { profiles?: { display_name: string } | null; invited_name?: string | null; invited_email?: string | null }): string {
  return m.profiles?.display_name || m.invited_name || m.invited_email || 'Unknown';
}

export function buildDelegationRows<M extends DelegationMemberLite>(input: {
  societies: SocietyLite[];
  members: M[];
  advisorsPledged: Map<string, number>;
  draftsBySociety: Map<string, number>;
  invoices: InvoiceLite[];
  payments: PaymentLite[];
  currency: string;
}): DelegationRow<M>[] {
  const cur = (input.currency || 'USD').toUpperCase();
  const bySociety = new Map<string, M[]>();
  const appSociety = new Map<string, string>();
  const appById = new Map<string, M>();
  for (const m of input.members) {
    appById.set(m.id, m);
    if (!m.society_id) continue;
    appSociety.set(m.id, m.society_id);
    const list = bySociety.get(m.society_id);
    if (list) list.push(m); else bySociety.set(m.society_id, [m]);
  }

  // Invoices per delegation, de-duplicated by id.
  const invBySociety = new Map<string, Map<string, InvoiceLite>>();
  for (const inv of input.invoices) {
    const soc = inv.society_id ?? (inv.application_id ? appSociety.get(inv.application_id) : undefined);
    if (!soc) continue;
    let map = invBySociety.get(soc);
    if (!map) { map = new Map(); invBySociety.set(soc, map); }
    map.set(inv.id, inv);
  }
  const paysByInvoice = new Map<string, PaymentLite[]>();
  for (const p of input.payments) {
    const list = paysByInvoice.get(p.invoice_id);
    if (list) list.push(p); else paysByInvoice.set(p.invoice_id, [p]);
  }

  const rows: DelegationRow<M>[] = input.societies.map(s => {
    const members = (bySociety.get(s.id) ?? []).slice().sort((a, b) => {
      // Live first (rejected / withdrawn at the foot), then heads, then name.
      const al = LIVE.has(a.status) ? 0 : 1;
      const bl = LIVE.has(b.status) ? 0 : 1;
      if (al !== bl) return al - bl;
      if (a.is_head_delegate !== b.is_head_delegate) return a.is_head_delegate ? -1 : 1;
      return memberName(a).localeCompare(memberName(b));
    });
    const live = members.filter(m => LIVE.has(m.status));
    const attendingLive = live.filter(m => m.attending);

    const natCount = new Map<string, number>();
    for (const m of live) {
      const n = m.profiles?.nationality?.trim();
      if (n) natCount.set(n, (natCount.get(n) ?? 0) + 1);
    }
    let country: string | null = null;
    let best = 0;
    for (const [n, c] of natCount) if (c > best) { best = c; country = n; }

    let pledged = 0;
    let pledgeAwaiting = false;
    for (const m of live) {
      if (m.pledge_type === 'delegation' && (m.spots_pledged ?? 0) > 0) {
        pledged += m.spots_pledged ?? 0;
        if (!m.pledge_confirmed_at) pledgeAwaiting = true;
      }
      pledged += Math.max(0, input.advisorsPledged.get(m.id) ?? 0);
    }
    const purchased = (s.spots_purchased ?? 0) + (s.advisor_spots_purchased ?? 0);
    const expected = pledged > 0 ? pledged : purchased > 0 ? purchased : null;

    const acceptedMembers = members.filter(m => ACCEPTED.has(m.status) && m.attending);
    const seatable = acceptedMembers.filter(m => SEATED_ROLES.has(m.role));

    let receivedCents = 0;
    let offlineCents = 0;
    let dueCents = 0;
    let otherCurrency = false;
    const owing = new Set<string>();
    for (const inv of (invBySociety.get(s.id) ?? new Map<string, InvoiceLite>()).values()) {
      const sameCur = (inv.currency || '').toUpperCase() === cur;
      for (const p of paysByInvoice.get(inv.id) ?? []) {
        if ((p.currency || '').toUpperCase() !== cur) { otherCurrency = true; continue; }
        if (p.method === 'stripe') receivedCents += p.amount_cents; else offlineCents += p.amount_cents;
      }
      if (inv.status !== 'open' && inv.status !== 'partial') continue;
      const balance = Math.max(0, inv.amount_cents - inv.amount_paid_cents);
      if (balance <= 0) continue;
      const owner = inv.application_id ? appById.get(inv.application_id) : undefined;
      if (!owner || !ACCEPTED.has(owner.status)) continue;
      if (!sameCur) { otherCurrency = true; continue; }
      dueCents += balance;
      owing.add(owner.id);
    }

    return {
      id: s.id,
      name: s.name,
      members,
      heads: live.filter(m => m.is_head_delegate),
      country,
      city: s.city ?? null,
      countryCode: s.country_code ?? null,
      logoUrl: s.logo_url ?? null,
      pledged,
      purchased,
      expected,
      registered: attendingLive.length,
      pending: members.filter(m => m.status === 'submitted' && m.attending),
      accepted: acceptedMembers.length,
      seatable: seatable.length,
      allocated: seatable.filter(m => !!m.assigned_committee_id).length,
      notAttending: live.filter(m => !m.attending).length,
      applying: input.draftsBySociety.get(s.id) ?? 0,
      pledgeAwaiting,
      receivedCents,
      offlineCents,
      dueCents,
      owingMemberIds: Array.from(owing),
      otherCurrency,
    };
  });

  return rows;
}

/** The order an organiser works in: delegations with people waiting on a
 *  decision first (most waiting first), then money owed, then by name. */
export function sortDelegationRows<M extends DelegationMemberLite>(rows: DelegationRow<M>[]): DelegationRow<M>[] {
  return rows.slice().sort((a, b) => {
    if (b.pending.length !== a.pending.length) return b.pending.length - a.pending.length;
    const ad = a.dueCents > 0 ? 1 : 0;
    const bd = b.dueCents > 0 ? 1 : 0;
    if (ad !== bd) return bd - ad;
    const aEmpty = a.members.length === 0 && a.applying === 0 ? 1 : 0;
    const bEmpty = b.members.length === 0 && b.applying === 0 ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    return a.name.localeCompare(b.name);
  });
}
