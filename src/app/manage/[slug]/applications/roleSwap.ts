// ── One accepted role per person: the role swap (owner, 16 Nov 2026) ──────
//
// Anyone may apply for another role while holding one; a person is accepted
// in only one role that does not combine. Every organiser accept asks
// accept_role_swap_check first (read only):
//   held empty      accept the normal way, unchanged
//   ok false        a sentence saying what the organiser does first; nothing
//                   can be accepted yet
//   held not empty  ask in place, then accept_role_swap: it accepts and
//                   removes the old role (allocation, delegation, dais, team
//                   access, the old application) in one transaction and sends
//                   no email. The caller then runs the normal post-accept
//                   steps for result.application_id.
// The database is the truth; this file only reads its answers.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError } from '@/lib/friendlyError';
import { formatCents } from '@/app/manage/[slug]/financials/shared';

type Client = ReturnType<typeof getAuthedClient>;

export interface HeldRole {
  id: string;
  role: string;
  role_word: string;
  allocation: { committee: string | null; country: string | null; delegation_seat: boolean } | null;
  delegation: string | null;
  chair_of: string[];
  team_access: boolean;
  paid_cents: number;
  currency: string | null;
}

export interface RoleSwapCheck {
  ok: boolean;
  name: string;
  /** The NEW role, e.g. "Chair". */
  role_word: string;
  held: HeldRole[];
  code?: string;
  message?: string;
}

export type RoleSwapResult =
  | { ok: true; application_id: string; removed: string; refund_due_cents: number; currency: string | null; message: string }
  | { ok: false; code: string; message: string };

/** What the accept panel shows for one person. `code` and `check` ride along
 *  on a refusal so a leader holding tickets gets real choices (prompt 80). */
export type SwapAsk =
  | { phase: 'checking' }
  | { phase: 'blocked'; message: string; code?: string; check?: RoleSwapCheck }
  | { phase: 'confirm'; check: RoleSwapCheck };

function asHeld(raw: unknown): HeldRole[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((h): HeldRole => {
    const r = (h ?? {}) as Record<string, unknown>;
    const a = r.allocation as Record<string, unknown> | null | undefined;
    return {
      id: String(r.id ?? ''),
      role: String(r.role ?? ''),
      role_word: String(r.role_word ?? r.role ?? ''),
      allocation: a ? {
        committee: typeof a.committee === 'string' ? a.committee : null,
        country: typeof a.country === 'string' ? a.country : null,
        delegation_seat: a.delegation_seat === true,
      } : null,
      delegation: typeof r.delegation === 'string' && r.delegation ? r.delegation : null,
      chair_of: Array.isArray(r.chair_of) ? r.chair_of.filter((c): c is string => typeof c === 'string' && !!c) : [],
      team_access: r.team_access === true,
      paid_cents: typeof r.paid_cents === 'number' ? r.paid_cents : Number(r.paid_cents ?? 0) || 0,
      currency: typeof r.currency === 'string' ? r.currency : null,
    };
  });
}

/** accept_role_swap_check. Throws on an error or no answer. */
export async function checkRoleSwap(supabase: Client, appId: string): Promise<RoleSwapCheck> {
  const { data, error } = await supabase.rpc('accept_role_swap_check', { p_app: appId });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new UserFacingError('Could not check this application. Please try again.');
  const d = data as Record<string, unknown>;
  return {
    ok: d.ok !== false,
    name: typeof d.name === 'string' && d.name ? d.name : 'This person',
    role_word: typeof d.role_word === 'string' ? d.role_word : '',
    held: asHeld(d.held),
    code: typeof d.code === 'string' ? d.code : undefined,
    message: typeof d.message === 'string' ? d.message : undefined,
  };
}

/** The panel state a check answer leads to; null means accept the normal way. */
export function askFor(check: RoleSwapCheck): SwapAsk | null {
  if (!check.ok) return { phase: 'blocked', message: check.message || 'This application cannot be accepted yet.', code: check.code, check };
  if (check.held.length === 0) return null;
  return { phase: 'confirm', check };
}

/** accept_role_swap. Throws on an error or no answer; a refusal is { ok:false }. */
export async function runRoleSwap(
  supabase: Client,
  appId: string,
  team?: { permissions: Record<string, unknown>; publicTitle: string | null },
): Promise<RoleSwapResult> {
  const args: Record<string, unknown> = { p_app: appId };
  if (team) {
    args.p_permissions = team.permissions;
    args.p_public_title = team.publicTitle;
  }
  const { data, error } = await supabase.rpc('accept_role_swap', args);
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new UserFacingError('Could not accept the application. Please try again.');
  const d = data as Record<string, unknown>;
  if (d.ok !== true || typeof d.application_id !== 'string' || !d.application_id) {
    return { ok: false, code: String(d.code ?? ''), message: typeof d.message === 'string' && d.message ? d.message : 'Could not accept the application. Please try again.' };
  }
  return {
    ok: true,
    application_id: d.application_id,
    removed: typeof d.removed === 'string' ? d.removed : '',
    refund_due_cents: typeof d.refund_due_cents === 'number' ? d.refund_due_cents : Number(d.refund_due_cents ?? 0) || 0,
    currency: typeof d.currency === 'string' ? d.currency : null,
    message: typeof d.message === 'string' && d.message ? d.message : 'Accepted',
  };
}

/** One short line per fact that applies to a held role. */
export function heldFacts(h: HeldRole): string[] {
  const out: string[] = [];
  if (h.allocation && (h.allocation.country || h.allocation.committee)) {
    const where = [h.allocation.country, h.allocation.committee].filter(Boolean);
    const base = where.length === 2 ? `Their seat ${where[0]} in ${where[1]}` : `Their seat ${where[0]}`;
    out.push(h.allocation.delegation_seat && h.delegation ? `${base} goes back to ${h.delegation}` : base);
  }
  if (h.delegation) out.push(`They leave ${h.delegation}`);
  if (h.chair_of.length > 0) out.push(`They stop chairing ${h.chair_of.join(', ')}`);
  if (h.team_access) out.push('Their access to your organising team');
  if (h.paid_cents > 0) out.push(`They paid ${formatCents(h.paid_cents, h.currency || 'USD')}. A refund will wait in Financials, Things to Do.`);
  return out;
}

/** "Delegate", or "Delegate and Observer" when they hold two. */
export function heldWords(check: RoleSwapCheck): string {
  const words = [...new Set(check.held.map(h => h.role_word).filter(Boolean))];
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? 'old');
}

/** Ids that no longer exist after a swap: the application asked about and the
 *  old ones, minus the one that now holds the new role. */
export function goneAfterSwap(appId: string, check: RoleSwapCheck | null, keptId: string): string[] {
  const ids = new Set([appId, ...(check?.held.map(h => h.id) ?? [])]);
  ids.delete(keptId);
  return [...ids].filter(Boolean);
}

// ── A leader who holds their delegation's tickets (prompt 80, 26 Nov 2026) ──
// accept_role_swap_check refuses with code 'leader_tickets'. The organiser then
// gets choices in place: hand every ticket to another leader of the same
// delegation (organiser_move_leader_tickets), remove the unpaid ones
// (remove_pledged_spot_invoice, which refuses paid ones), or write to Gavelling.

export interface HeldTicket { id: string; kind: 'pledge_spot' | 'advisor_spot'; paid: boolean; removable: boolean }
export interface OtherLeader { appId: string; name: string }
export interface TicketHold {
  leaderAppId: string;
  delegation: string | null;
  tickets: HeldTicket[];
  others: OtherLeader[];
  conferenceAcronym: string;
}

/** Reads what the refusal is about: the leader application holding tickets, its tickets and the delegation's other leaders. */
export async function loadTicketHold(supabase: Client, check: RoleSwapCheck): Promise<TicketHold | null> {
  const heldIds = check.held.map(h => h.id).filter(Boolean);
  if (heldIds.length === 0) return null;
  const { data: inv, error } = await supabase
    .from('invoices')
    .select('id, application_id, kind, status, amount_paid_cents, aid_applied_cents')
    .in('application_id', heldIds)
    .in('kind', ['pledge_spot', 'advisor_spot'])
    .neq('status', 'void');
  if (error) throw error;
  const rows = (inv ?? []) as { id: string; application_id: string; kind: 'pledge_spot' | 'advisor_spot'; status: string; amount_paid_cents: number | null; aid_applied_cents: number | null }[];
  if (rows.length === 0) return null;
  const leaderAppId = rows[0].application_id;
  const tickets: HeldTicket[] = rows.filter(r => r.application_id === leaderAppId).map(r => {
    const removable = r.status === 'open' && !(r.amount_paid_cents ?? 0) && !(r.aid_applied_cents ?? 0);
    return { id: r.id, kind: r.kind, paid: r.status === 'settled', removable };
  });
  const { data: me, error: meErr } = await supabase.from('applications').select('id, society_id, conference_id').eq('id', leaderAppId).maybeSingle();
  if (meErr) throw meErr;
  const societyId = (me as { society_id: string | null } | null)?.society_id ?? null;
  const confId = (me as { conference_id: string } | null)?.conference_id ?? null;
  let others: OtherLeader[] = [];
  if (societyId) {
    const { data: lead, error: leadErr } = await supabase
      .from('applications')
      .select('id, invited_name, profiles (display_name)')
      .eq('society_id', societyId)
      .neq('id', leaderAppId)
      .in('role', ['head-delegate', 'faculty-advisor'])
      .not('status', 'in', '(rejected,withdrawn)');
    if (leadErr) throw leadErr;
    others = ((lead ?? []) as { id: string; invited_name: string | null; profiles: { display_name: string | null } | { display_name: string | null }[] | null }[]).map(l => {
      const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      return { appId: l.id, name: p?.display_name?.trim() || l.invited_name?.trim() || 'A leader' };
    });
  }
  let conferenceAcronym = '';
  if (confId) {
    const { data: conf } = await supabase.from('conferences').select('acronym').eq('id', confId).maybeSingle();
    conferenceAcronym = (conf as { acronym: string | null } | null)?.acronym ?? '';
  }
  const delegation = check.held.find(h => h.id === leaderAppId)?.delegation ?? null;
  return { leaderAppId, delegation, tickets, others, conferenceAcronym };
}

/** "3 Delegate Tickets, all unpaid" / "2 Delegate Tickets and 1 Advisor Ticket, 1 paid, 2 unpaid". */
export function ticketSummary(t: HeldTicket[]): string {
  const d = t.filter(x => x.kind === 'pledge_spot').length;
  const a = t.length - d;
  const parts = [
    d ? `${d} Delegate ${d === 1 ? 'Ticket' : 'Tickets'}` : '',
    a ? `${a} Advisor ${a === 1 ? 'Ticket' : 'Tickets'}` : '',
  ].filter(Boolean).join(' and ');
  const paid = t.filter(x => x.paid).length;
  const unpaid = t.length - paid;
  const state = paid === 0 ? 'all unpaid' : unpaid === 0 ? 'all paid' : `${paid} paid, ${unpaid} unpaid`;
  return `${parts}, ${state}`;
}

/** organiser_move_leader_tickets(p_from, p_to). */
export async function moveLeaderTickets(supabase: Client, fromApp: string, toApp: string): Promise<{ ok: true; moved: number } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('organiser_move_leader_tickets', { p_from: fromApp, p_to: toApp });
  if (error) throw error;
  const d = (data ?? {}) as { ok?: boolean; moved?: number; message?: string };
  if (d.ok !== true) return { ok: false, message: d.message || 'Could not move the tickets. Please try again.' };
  return { ok: true, moved: Number(d.moved ?? 0) };
}

/** remove_pledged_spot_invoice for each unpaid ticket; the number that were removed. */
export async function removeUnpaidTickets(supabase: Client, ids: string[]): Promise<number> {
  let removed = 0;
  for (const id of ids) {
    const { data, error } = await supabase.rpc('remove_pledged_spot_invoice', { p_invoice_id: id });
    if (!error && (data as { ok?: boolean } | null)?.ok === true) removed++;
  }
  return removed;
}
