'use client';

// Shared types, data helpers, and chip/modal components used by both the
// DELEGATIONS and INDEPENDENTS modes of the assignment page. Keeping this in
// one place means both views manipulate the same pool-accounting rules and
// render identical swap/not-attending/waived affordances.

import { useState } from 'react';
import { GripVertical, Lock, Check } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { queueEventEmail, type QueueEventEmailResult } from '@/lib/emailEvents';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ModalOverlay as SharedModalOverlay } from '@/components/ModalOverlay';
import ProfileLink from '@/components/ProfileLink';

// ── Shared bits (matches the visual language of the rest of this page) ─────────

export const OUTFIT = "'Outfit', sans-serif";
// Typography rule on this page: no monospace, MONO resolves to Outfit (family swap only).
export const MONO = "'Outfit', sans-serif";

// ── Pool accounting (adapted from applications/page.tsx's fillFreeSpots) ───────

export type Pool = 'delegate' | 'advisor';

export const POOL_ROLES: Record<Pool, string[]> = {
  delegate: ['delegate', 'head-delegate'],
  advisor: ['faculty-advisor'],
};

export const POOL_SPOTS_COLUMN: Record<Pool, 'spots_purchased' | 'advisor_spots_purchased'> = {
  delegate: 'spots_purchased',
  advisor: 'advisor_spots_purchased',
};

export function poolForRole(role: string): Pool | null {
  if (role === 'delegate' || role === 'head-delegate') return 'delegate';
  if (role === 'faculty-advisor') return 'advisor';
  return null;
}

/**
 * Promotes the oldest-submitted attending unpaid members of a pool to 'paid'
 * until the pool's purchased-spots column is full or candidates run out.
 * Idempotent, a no-op when the pool has no free spots. Only 'accepted' and
 * 'assigned' applications count towards occupancy or are eligible candidates:
 * a still-pending or withdrawn/rejected application must never occupy or be
 * auto-promoted into a delegation-purchased spot.
 *
 * Canonical location (F: fillFreeSpots consolidation): applications/page.tsx
 * and DelegationsView.tsx both import this rather than keeping their own copy.
 *
 * Every newly-covered member gets a 'spot_received' email (the fill-path
 * notification), except any id in `opts.suppressIds`, used when the fill was
 * triggered by that same person's own acceptance, which already told them via
 * 'application_accepted' (rule one wins; see emailEvents.ts consolidation notes).
 */
export async function fillFreeSpots(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  societyId: string,
  pool: Pool,
  opts?: { suppressIds?: Set<string> | string[] }
): Promise<{ filledIds: string[] }> {
  const roles = POOL_ROLES[pool];
  const spotsColumn = POOL_SPOTS_COLUMN[pool];

  const [{ data: society }, { count: occupancy }] = await Promise.all([
    supabase.from('societies').select(spotsColumn).eq('id', societyId).single(),
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId)
      .in('role', roles)
      .in('status', ['accepted', 'assigned'])
      .eq('attending', true)
      .eq('payment_status', 'paid'),
  ]);

  const spotsPurchased = (society as Record<string, number> | null)?.[spotsColumn] ?? 0;
  const freeSpots = spotsPurchased - (occupancy ?? 0);
  if (freeSpots <= 0) return { filledIds: [] };

  // Unpaid only, waived members are already covered and skipped.
  const { data: candidates } = await supabase
    .from('applications')
    .select('id')
    .eq('society_id', societyId)
    .in('role', roles)
    .in('status', ['accepted', 'assigned'])
    .eq('attending', true)
    .eq('payment_status', 'unpaid')
    .order('submitted_at', { ascending: true })
    .limit(freeSpots);

  const ids = ((candidates ?? []) as { id: string }[]).map(c => c.id);
  if (ids.length === 0) return { filledIds: [] };

  // These members are absorbed into an already-purchased delegation spot, not
  // funding one themselves, self_paid stays false.
  await supabase.from('applications').update({ payment_status: 'paid', self_paid: false }).in('id', ids);

  const suppress = opts?.suppressIds instanceof Set ? opts.suppressIds : new Set(opts?.suppressIds ?? []);
  const emailIds = ids.filter(id => !suppress.has(id));
  if (emailIds.length > 0) {
    await queueEventEmail(supabase, conferenceId, 'spot_received', emailIds);
  }

  return { filledIds: ids };
}

// ── Types ────────────────────────────────────────────────────────────────────

// A single application, shaped for the delegations/independents pool views.
export interface PoolMember {
  id: string;
  user_id: string;
  invited_email: string | null;
  invited_name: string | null;
  role: string;
  status: string;
  is_head_delegate: boolean;
  payment_status: string | null;
  self_paid: boolean | null;
  attending: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
  submitted_at: string;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  society_id: string | null;
  assigned_committee: { abbreviation: string | null; name: string } | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

// The select() used to load a PoolMember-shaped application row.
export const POOL_MEMBER_SELECT = `
  id, user_id, invited_email, invited_name, role, status, is_head_delegate, payment_status, self_paid, attending,
  pledge_type, spots_pledged, pledge_confirmed_at, submitted_at,
  assigned_committee_id, assigned_country_code, assigned_country_name, society_id,
  assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
  profiles (display_name, avatar_url)
`;

// A lighter row used for the cross-conference participant search. Carries
// assigned_committee_id so swap targets can be checked for an existing
// allocation before offering to transfer one (F11).
export interface SearchApp {
  id: string;
  user_id: string;
  role: string;
  society_id: string | null;
  payment_status: string | null;
  attending: boolean;
  assigned_committee_id: string | null;
  societies: { name: string } | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
  invited_email: string | null;
  invited_name: string | null;
}

// Anything with just enough shape to be a swap source / named party.
export interface NamedApp {
  id: string;
  user_id: string;
  assigned_committee_id: string | null;
  profiles: { display_name: string } | null;
  invited_email?: string | null;
  invited_name?: string | null;
}

/** All accepted/assigned delegates and head delegates across the conference, the shared search pool. */
export async function fetchSearchPool(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string
): Promise<SearchApp[]> {
  const { data } = await supabase
    .from('applications')
    .select(`
      id, user_id, role, society_id, status, payment_status, attending, assigned_committee_id,
      societies (name),
      profiles (display_name, avatar_url),
      invited_email, invited_name
    `)
    .eq('conference_id', conferenceId)
    .in('status', ['accepted', 'assigned'])
    .in('role', ['delegate', 'head-delegate']);
  return (data ?? []) as unknown as SearchApp[];
}

/**
 * Candidates worth transferring a paid spot to: unpaid and attending, a
 * waived or already-paid recipient has no use for someone else's spot.
 */
export function eligibleTransferRecipients(pool: SearchApp[]): SearchApp[] {
  return pool.filter(a => a.payment_status === 'unpaid' && a.attending);
}

/** All accepted/assigned faculty advisors across the conference, used by the TRANSFER SPOT picker (F18). */
export async function fetchAdvisorPool(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string
): Promise<SearchApp[]> {
  const { data } = await supabase
    .from('applications')
    .select(`
      id, user_id, role, society_id, status, payment_status, attending, assigned_committee_id,
      societies (name),
      profiles (display_name, avatar_url),
      invited_email, invited_name
    `)
    .eq('conference_id', conferenceId)
    .in('status', ['accepted', 'assigned'])
    .eq('role', 'faculty-advisor');
  return (data ?? []) as unknown as SearchApp[];
}

// ── Shared DB mutations ──────────────────────────────────────────────────────

// Grants an already-purchased open delegation spot, self_paid stays false.
// Returns the primary write's error message (null on success) so callers can
// roll back optimistic state.
export async function markApplicationPaid(
  supabase: ReturnType<typeof getAuthedClient>,
  applicationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('applications').update({ payment_status: 'paid', self_paid: false }).eq('id', applicationId);
  return { error: error?.message ?? null };
}

export interface SwapEmailResult {
  incoming: QueueEventEmailResult;
  outgoing: QueueEventEmailResult;
  /** First error from the primary payment/allocation writes, null on success. */
  error: string | null;
}

/**
 * Swaps payment status between a source (gaining 'paid') and a target
 * (losing it, dropping to 'unpaid'). Both sides end self_paid = false, the
 * spot is delegation-owned after a swap. If transfer is requested, the
 * target holds a committee allocation, AND the source does not already hold
 * one of its own, that allocation row and the assigned_* fields move to the
 * source, and status flips 'assigned' <-> 'accepted' accordingly. This
 * allocation-transfer path never runs, and so never deletes or overwrites
 * an allocation, when the incoming delegate (source) already has one; the
 * caller (SwapConfirmModal, F11) also disables the checkbox in that case, but
 * the guard here holds regardless of what the caller passes.
 * Queues spot_received for the incoming delegate and spot_lost for the
 * outgoing one; the returned flags say whether either had no enabled template.
 */
export async function performSwap(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  source: NamedApp,
  target: PoolMember,
  transfer: boolean,
  /** Organiser running the swap — stamped on the rows whose status/seat moves. */
  actorId: string
): Promise<SwapEmailResult> {
  let firstError: string | null = null;
  const note = (e: { message: string } | null) => { if (e && !firstError) firstError = e.message; };

  const [srcRes, tgtRes] = await Promise.all([
    supabase.from('applications').update({ payment_status: 'paid', self_paid: false }).eq('id', source.id),
    supabase.from('applications').update({ payment_status: 'unpaid', self_paid: false }).eq('id', target.id),
  ]);
  note(srcRes.error);
  note(tgtRes.error);

  const canTransferAllocation = transfer && !!target.assigned_committee_id && !source.assigned_committee_id;
  if (canTransferAllocation) {
    const { data: allocRow } = await supabase
      .from('conference_allocations')
      .select('id')
      .eq('application_id', target.id)
      .maybeSingle();
    if (allocRow) {
      // Not an insert, but it re-points an existing seat at a different
      // person — that IS an allocation decision, so the actor is refreshed.
      // allocation_sent goes back to false with it: the flag records whether
      // THIS delegate has been told their committee and country, and the
      // incoming delegate has not been. Leaving it set would hide them from
      // the assignment page's "not yet emailed" wave forever.
      const { error } = await supabase.from('conference_allocations')
        .update({
          user_id: source.user_id, application_id: source.id, assigned_by: actorId,
          allocation_sent: false, allocation_sent_at: null,
        })
        .eq('id', (allocRow as { id: string }).id);
      note(error);
    }
    const { error: srcAssignErr } = await supabase.from('applications').update({
      status: 'assigned',
      assigned_committee_id: target.assigned_committee_id,
      assigned_country_code: target.assigned_country_code,
      assigned_country_name: target.assigned_country_name,
      decided_by: actorId,
      decided_at: new Date().toISOString(),
    }).eq('id', source.id);
    note(srcAssignErr);
    const { error: tgtClearErr } = await supabase.from('applications').update({
      status: 'accepted',
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      decided_by: actorId,
      decided_at: new Date().toISOString(),
    }).eq('id', target.id);
    note(tgtClearErr);
  }

  const [incoming, outgoing] = await Promise.all([
    queueEventEmail(supabase, conferenceId, 'spot_received', [source.id]),
    queueEventEmail(supabase, conferenceId, 'spot_lost', [target.id]),
  ]);
  return { incoming, outgoing, error: firstError };
}

// Narrowed to exactly the fields this write touches (not the full PoolMember
// shape) so callers with a differently-typed user_id — e.g. applications/page.tsx's
// Application, where user_id can be null for unclaimed/imported rows — can
// pass their row straight through without an adapter.
export async function markNotAttending(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  member: Pick<PoolMember, 'id' | 'assigned_committee_id' | 'status'>,
  /** Organiser making the call — recorded only when the status actually flips. */
  actorId?: string | null
): Promise<{ result: QueueEventEmailResult; error: string | null }> {
  const hasAllocation = !!member.assigned_committee_id;
  const demoted = member.status === 'assigned';
  const { error: updateErr } = await supabase.from('applications').update({
    attending: false,
    assigned_committee_id: null,
    assigned_country_code: null,
    assigned_country_name: null,
    status: demoted ? 'accepted' : member.status,
    // Only a real status change re-stamps the decision; flipping attendance
    // alone must not overwrite who accepted/assigned them. decided_at and
    // decided_by ALWAYS travel together — a decided_by with no decided_at is
    // an event the feed cannot place on the timeline, so it would vanish.
    ...(demoted ? { decided_by: actorId ?? null, decided_at: new Date().toISOString() } : {}),
  }).eq('id', member.id);
  let firstError: string | null = updateErr?.message ?? null;
  if (hasAllocation) {
    const { error: delErr } = await supabase.from('conference_allocations').delete().eq('application_id', member.id);
    if (delErr && !firstError) firstError = delErr.message;
  }
  const result = await queueEventEmail(supabase, conferenceId, 'not_attending', [member.id]);
  return { result, error: firstError };
}

export async function undoNotAttending(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  member: Pick<PoolMember, 'id'>
): Promise<{ result: QueueEventEmailResult; error: string | null }> {
  const { error } = await supabase.from('applications').update({ attending: true, payment_status: 'unpaid' }).eq('id', member.id);
  const result = await queueEventEmail(supabase, conferenceId, 'attendance_restored', [member.id]);
  return { result, error: error?.message ?? null };
}

/**
 * Payment-provenance outcome when someone leaves their delegation's pool,
 * via remove-from-delegation OR a full conference withdrawal (both reuse this
 * exact accounting so the "existing removal provenance rules" stay singular):
 * a self-funded paid spot (self_paid) travels with them, so the pool's
 * purchased-spots column decrements by 1; a pool-covered paid spot
 * (self_paid = false) stays behind, the caller should drop payment_status to
 * 'unpaid' (returned as `dropToUnpaid`) so the now-open spot is simply free
 * again for fillFreeSpots. Waived/unpaid members are untouched here.
 */
export async function releasePoolSpot(
  supabase: ReturnType<typeof getAuthedClient>,
  member: { role: string; payment_status: string | null; self_paid: boolean | null; society_id: string | null }
): Promise<{ dropToUnpaid: boolean; error: string | null }> {
  const pool = poolForRole(member.role);
  const selfFundedPaidSpot = member.payment_status === 'paid' && !!member.self_paid;
  const pooledPaidSpot = member.payment_status === 'paid' && !member.self_paid;

  if (selfFundedPaidSpot && pool && member.society_id) {
    const spotsColumn = POOL_SPOTS_COLUMN[pool];
    const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', member.society_id).single();
    const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
    const { error: socErr } = await supabase.from('societies').update({ [spotsColumn]: Math.max(0, current - 1) }).eq('id', member.society_id);
    if (socErr) return { dropToUnpaid: false, error: socErr.message };
  }

  return { dropToUnpaid: pooledPaidSpot, error: null };
}

/**
 * Removes a member from their delegation (F4/D). Outcome depends on how they
 * were paid: a self-funded paid spot (self_paid) travels with them, they
 * leave as a paid independent and their pool's spots column is decremented
 * by 1. A pool-covered paid spot (self_paid = false) stays with the
 * delegation, they leave unpaid and the pool count is untouched (the spot
 * simply shows open again). Waived stays waived (personal), unpaid stays
 * unpaid. attending is left as-is. Their allocation is untouched unless
 * keepAllocation is false, in which case it's deleted along with the
 * assigned_* fields (and status drops back to 'accepted' if it was 'assigned').
 */
export async function removeFromDelegation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  member: PoolMember,
  keepAllocation: boolean,
  /** Organiser removing them — recorded only when the status actually flips. */
  actorId?: string | null
): Promise<{ result: QueueEventEmailResult; error: string | null }> {
  const { dropToUnpaid, error: releaseError } = await releasePoolSpot(supabase, member);

  const updates: Record<string, unknown> = {
    society_id: null,
    // Derived convenience, kept in sync for read paths that haven't been
    // ported, society_id IS NULL is the actual source of truth, never read
    // is_independent for logic.
    is_independent: true,
  };
  if (dropToUnpaid) updates.payment_status = 'unpaid';
  if (!keepAllocation) {
    updates.assigned_committee_id = null;
    updates.assigned_country_code = null;
    updates.assigned_country_name = null;
    if (member.status === 'assigned') {
      updates.status = 'accepted';
      // Paired, always — see markNotAttending.
      updates.decided_by = actorId ?? null;
      updates.decided_at = new Date().toISOString();
    }
  }

  const { error: updateErr } = await supabase.from('applications').update(updates).eq('id', member.id);
  let firstError: string | null = releaseError ?? updateErr?.message ?? null;

  if (!keepAllocation && member.assigned_committee_id) {
    const { error: delErr } = await supabase.from('conference_allocations').delete().eq('application_id', member.id);
    if (delErr && !firstError) firstError = delErr.message;
  }

  const result = await queueEventEmail(supabase, conferenceId, 'removed_from_delegation', [member.id]);
  return { result, error: firstError };
}

/**
 * Whether a pledge's obligations are already met, independent of whether
 * MARK RECEIVED was ever clicked (F21 self-resolution), the spots grant has
 * run (pledge_confirmed_at).
 */
export function pledgeSatisfied(m: PoolMember): boolean {
  if (m.pledge_type !== 'delegation') return false;
  return !!m.pledge_confirmed_at;
}

// ── Small shared bits ────────────────────────────────────────────────────────

// ── Unregistered (imported, unclaimed) applicant helpers ────────────────────
// Shared across every view that joins applications -> profiles: an imported
// row has user_id null until the invitee signs up (claim_imported_applications
// trigger), so profiles is null and invited_name/invited_email carry the data.

export function memberDisplayName(m: { profiles?: { display_name: string } | null; invited_name?: string | null }): string {
  return m.profiles?.display_name ?? m.invited_name ?? 'Unknown';
}

export function NotRegisteredChip() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-bold flex-shrink-0"
      style={{ fontSize: 10, fontFamily: OUTFIT, letterSpacing: '0.06em', backgroundColor: 'rgba(154,138,120,0.12)', color: '#9A8A78', border: '1px solid rgba(154,138,120,0.3)' }}
    >
      NOT REGISTERED
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 600 }}>
      {children}
    </p>
  );
}

// Single avatar primitive for every person listed across the assignment page.
// Renders profiles.avatar_url when present; otherwise an initial-disc built
// from the (display or invited) name, forest disc, ivory letter, so imported,
// account-less applicants still get a recognisable, legible avatar.
export function MemberAvatar({ name, url, size = 28, userId, nested }: {
  name: string; url: string | null; size?: number;
  /**
   * profiles.id / pool_members.user_id — OPT-IN ONLY. When passed, the avatar
   * wraps itself in a <ProfileLink> to that person's public MUN CV. When it is
   * NOT passed the markup below is byte-identical to what it has always been,
   * and that is load-bearing: this avatar is rendered inside chips that sit in
   * real <button>s and inside drag sources, where an <a> would be invalid HTML
   * or would hijack the drag. Only pass `userId` from a site you have verified
   * has no <button>/<a> ancestor.
   */
  userId?: string | null;
  /** Forwarded to ProfileLink — set when a clickable (onClick) ancestor exists. */
  nested?: boolean;
}) {
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase();
  const inner = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: '1px solid rgba(221,212,192,0.9)' }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: '#1B3828', color: '#EED98A',
        border: '1px solid rgba(221,212,192,0.9)',
        fontFamily: OUTFIT, fontWeight: 700, fontSize: Math.round(size * 0.42), lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
  if (!userId) return inner;
  // inline-flex + flex-shrink:0 so the anchor is exactly the flex item the
  // avatar itself was — the link must not change any layout. draggable={false}
  // so an <a> inside a drag surface never starts a link drag of its own.
  return (
    <ProfileLink userId={userId} name={name} nested={nested} draggable={false}
      style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {inner}
    </ProfileLink>
  );
}

export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Thin wrapper over the shared house backdrop (@/components/ModalOverlay),
  // which owns the background scroll lock, Escape-to-close and the dialog ARIA.
  // `px-4` (no vertical padding) preserves this page's original spacing.
  return <SharedModalOverlay onClose={onClose} paddingClassName="px-4">{children}</SharedModalOverlay>;
}

export function pledgeText(m: PoolMember): string {
  if (m.pledge_type !== 'delegation') return '';
  return `${m.spots_pledged ?? 0} delegation spots`;
}

// ── Chips ────────────────────────────────────────────────────────────────────

// Small text-button used consistently for the REMOVE action across every
// chip variant (F4/D, every member card gets one).
function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onRemove(); }}
      className="flex-shrink-0 focus:outline-none"
      style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
    >
      REMOVE
    </button>
  );
}

// A draggable / click-selectable chip. Used both for a delegation's own
// unpaid members (with NOT ATTENDING / REMOVE actions) and for
// cross-conference search results being dragged in as a substitute (no
// action, just a subtitle).
export function DraggableChip({
  name, avatarUrl, subtitle, selected, onSelect, onDragStart, onDragEnd, onNotAttending, onRemove, dataId,
}: {
  name: string; avatarUrl: string | null; subtitle?: string; selected: boolean;
  onSelect: () => void; onDragStart: () => void; onDragEnd: () => void;
  onNotAttending?: () => void; onRemove?: () => void; dataId: string;
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', dataId); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5 transition-colors"
      style={{
        backgroundColor: selected ? 'rgba(27,56,40,0.08)' : '#FAF8F3',
        border: `1.5px solid ${selected ? '#1B3828' : '#DDD4C0'}`,
        cursor: 'grab',
      }}
    >
      <GripVertical size={13} style={{ color: '#DDD4C0', flexShrink: 0 }} />
      {/* Deliberately NOT linked to the CV. This chip is the drag SOURCE for
          delegation assignment — the core workflow of this page — and it is
          handed only `dataId` (the APPLICATION id), never the user id, so
          linking would also mean threading `user_id` through both callers.
          Not worth putting an <a> inside a drag source for. */}
      <MemberAvatar name={name} url={avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
        {subtitle && (
          <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{subtitle}</p>
        )}
      </div>
      {selected && <Check size={13} style={{ color: '#3D7A52', flexShrink: 0 }} />}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {onNotAttending && (
          <button
            onClick={e => { e.stopPropagation(); onNotAttending(); }}
            className="focus:outline-none"
            style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            NOT ATTENDING
          </button>
        )}
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    </div>
  );
}

export function WaivedChip({ member, onRemove }: { member: PoolMember; onRemove?: () => void }) {
  const name = memberDisplayName(member);
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5"
      style={{ backgroundColor: 'rgba(184,132,74,0.06)', border: '1px solid rgba(184,132,74,0.3)' }}
    >
      <Lock size={13} style={{ color: '#9A6B2F', flexShrink: 0 }} />
      {/* Static chip: plain <div>, no onClick and no drag; the only button is a
          sibling REMOVE. So a bare link, no nesting needed. */}
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} userId={member.user_id} />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</span>
      {!member.user_id && <NotRegisteredChip />}
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9A6B2F', fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0 }}>WAIVED</span>
      {onRemove && <RemoveButton onRemove={onRemove} />}
    </div>
  );
}

export function NotAttendingChip({ member, onUndo, onRemove }: { member: PoolMember; onUndo: () => void; onRemove?: () => void }) {
  const name = memberDisplayName(member);
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5"
      style={{ backgroundColor: 'rgba(154,138,120,0.06)', border: '1px solid #F0EDE6', opacity: 0.7 }}
    >
      {/* Static chip: plain <div>, no onClick and no drag; UNDO / REMOVE are
          siblings. So a bare link, no nesting needed. */}
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} userId={member.user_id} />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{name}</span>
      {!member.user_id && <NotRegisteredChip />}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={onUndo}
          className="focus:outline-none"
          style={{ fontSize: 10, fontWeight: 700, color: '#1B3828', fontFamily: MONO, letterSpacing: '0.04em' }}
        >
          UNDO
        </button>
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    </div>
  );
}

export function PaidSlotChip({
  member, isDropTarget, clickable, hdTag,
  onDragOver, onDragLeave, onDrop, onClickTarget, onNotAttending, onRemove,
}: {
  member: PoolMember; isDropTarget: boolean; clickable: boolean; hdTag?: boolean;
  onDragOver: () => void; onDragLeave: () => void; onDrop: (sourceId: string) => void;
  onClickTarget: () => void; onNotAttending: () => void; onRemove?: () => void;
}) {
  const name = memberDisplayName(member);
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain')); }}
      onClick={() => { if (clickable) onClickTarget(); }}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-1.5 transition-colors"
      style={{
        backgroundColor: isDropTarget ? 'rgba(61,122,82,0.1)' : '#FAF8F3',
        border: `1.5px solid ${isDropTarget ? '#1B3828' : '#DDD4C0'}`,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      {/* This chip is a DROP TARGET but never a drag SOURCE (no draggable), so
          an anchor cannot hijack a drag here — dragover/drop still bubble from
          it to this div. nested because the chip has its own onClick (pick as
          swap target). */}
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} userId={member.user_id} nested />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
          {!member.user_id && <NotRegisteredChip />}
          {hdTag && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-full"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO }}
            >
              HD
            </span>
          )}
        </div>
        {member.assigned_committee_id && (
          <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            {member.assigned_committee?.abbreviation ?? member.assigned_committee?.name}, {member.assigned_country_name}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onNotAttending(); }}
          className="focus:outline-none"
          style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          NOT ATTENDING
        </button>
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    </div>
  );
}

export function OpenSlot({
  isDropTarget, clickable, onDragOver, onDragLeave, onDrop, onClickTarget,
}: {
  isDropTarget: boolean; clickable: boolean;
  onDragOver: () => void; onDragLeave: () => void; onDrop: (sourceId: string) => void; onClickTarget: () => void;
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain')); }}
      onClick={() => { if (clickable) onClickTarget(); }}
      className="flex items-center justify-center rounded-xl px-3 py-2.5 mb-1.5 transition-colors"
      style={{
        border: `1.5px dashed ${isDropTarget ? '#1B3828' : '#DDD4C0'}`,
        backgroundColor: isDropTarget ? 'rgba(61,122,82,0.06)' : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.08em' }}>OPEN SPOT</span>
    </div>
  );
}

// ── Swap confirmation modal ──────────────────────────────────────────────────
// Built on the shared ConfirmModal. F11: when the incoming delegate (source)
// already holds an allocation of their own, the transfer checkbox is forced
// off and disabled, the swap then only exchanges payment_status, and
// performSwap's own guard (above) backs this up regardless of what gets
// passed in.

export function SwapConfirmModal({
  source, target, onCancel, onConfirm,
}: {
  source: NamedApp; target: PoolMember;
  onCancel: () => void; onConfirm: (transfer: boolean) => void;
}) {
  const sourceHasAllocation = !!source.assigned_committee_id;
  const [transfer, setTransfer] = useState(!sourceHasAllocation && !!target.assigned_committee_id);
  const sourceName = source.profiles?.display_name ?? 'this delegate';
  const targetCommittee = target.assigned_committee?.abbreviation ?? target.assigned_committee?.name;

  return (
    <ConfirmModal
      title="Switch delegates?"
      body="Are you sure you want to switch these two delegates and their payment status?"
      confirmLabel="Confirm Swap"
      checkbox={
        target.assigned_committee_id
          ? {
              label: `Transfer committee assignment (${targetCommittee}, ${target.assigned_country_name}) to ${sourceName}`,
              defaultChecked: !sourceHasAllocation,
              disabled: sourceHasAllocation,
              disabledNote: sourceHasAllocation
                ? `${sourceName} already holds an allocation, manage allocations in the Delegates tab.`
                : undefined,
            }
          : undefined
      }
      checked={transfer}
      onCheckedChange={setTransfer}
      onConfirm={() => onConfirm(!sourceHasAllocation && transfer)}
      onCancel={onCancel}
    />
  );
}
