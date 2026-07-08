'use client';

// Shared types, data helpers, and chip/modal components used by both the
// DELEGATIONS and INDEPENDENTS modes of the assignment page. Keeping this in
// one place means both views manipulate the same pool-accounting rules and
// render identical swap/not-attending/waived affordances.

import { useState } from 'react';
import { GripVertical, Lock, User, Check } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { queueEventEmail } from '@/lib/emailEvents';

// ── Shared bits (matches the visual language of the rest of this page) ─────────

export const OUTFIT = "'Outfit', sans-serif";
// Typography rule on this page: no monospace — MONO resolves to Outfit (family swap only).
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
 * Idempotent — a no-op when the pool has no free spots.
 */
export async function fillFreeSpots(
  supabase: ReturnType<typeof getAuthedClient>,
  societyId: string,
  pool: Pool
) {
  const roles = POOL_ROLES[pool];
  const spotsColumn = POOL_SPOTS_COLUMN[pool];

  const [{ data: society }, { count: occupancy }] = await Promise.all([
    supabase.from('societies').select(spotsColumn).eq('id', societyId).single(),
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId)
      .in('role', roles)
      .eq('attending', true)
      .eq('payment_status', 'paid'),
  ]);

  const spotsPurchased = (society as Record<string, number> | null)?.[spotsColumn] ?? 0;
  const freeSpots = spotsPurchased - (occupancy ?? 0);
  if (freeSpots <= 0) return;

  const { data: candidates } = await supabase
    .from('applications')
    .select('id')
    .eq('society_id', societyId)
    .in('role', roles)
    .eq('attending', true)
    .eq('payment_status', 'unpaid')
    .order('submitted_at', { ascending: true })
    .limit(freeSpots);

  const ids = ((candidates ?? []) as { id: string }[]).map(c => c.id);
  if (ids.length === 0) return;

  await supabase.from('applications').update({ payment_status: 'paid' }).in('id', ids);
}

// ── Types ────────────────────────────────────────────────────────────────────

// A single application, shaped for the delegations/independents pool views.
export interface PoolMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  is_head_delegate: boolean;
  payment_status: string | null;
  attending: boolean;
  pledge_type: 'own' | 'delegation' | 'both' | null;
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
  id, user_id, role, status, is_head_delegate, payment_status, attending,
  pledge_type, spots_pledged, pledge_confirmed_at, submitted_at,
  assigned_committee_id, assigned_country_code, assigned_country_name, society_id,
  assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
  profiles (display_name, avatar_url)
`;

// A lighter row used for the cross-conference participant search.
export interface SearchApp {
  id: string;
  user_id: string;
  role: string;
  society_id: string | null;
  societies: { name: string } | null;
  profiles: { display_name: string } | null;
}

// Anything with just enough shape to be a swap source / named party.
export interface NamedApp {
  id: string;
  user_id: string;
  profiles: { display_name: string } | null;
}

/** All accepted/assigned delegates and head delegates across the conference — the shared search pool. */
export async function fetchSearchPool(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string
): Promise<SearchApp[]> {
  const { data } = await supabase
    .from('applications')
    .select(`
      id, user_id, role, society_id, status,
      societies (name),
      profiles (display_name)
    `)
    .eq('conference_id', conferenceId)
    .in('status', ['accepted', 'assigned'])
    .in('role', ['delegate', 'head-delegate']);
  return (data ?? []) as unknown as SearchApp[];
}

// ── Shared DB mutations ──────────────────────────────────────────────────────

export async function markApplicationPaid(supabase: ReturnType<typeof getAuthedClient>, applicationId: string) {
  await supabase.from('applications').update({ payment_status: 'paid' }).eq('id', applicationId);
}

export interface SwapEmailResult {
  incomingDrafted: boolean;
  outgoingDrafted: boolean;
}

/**
 * Swaps payment status between a source (gaining 'paid') and a target
 * (losing it, dropping to 'unpaid'). If transfer is requested and the target
 * holds a committee allocation, that allocation row and the assigned_* fields
 * move to the source, and status flips 'assigned' <-> 'accepted' accordingly.
 * Queues spot_received for the incoming delegate and spot_lost for the
 * outgoing one; the returned flags say whether either had no enabled template.
 */
export async function performSwap(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  source: NamedApp,
  target: PoolMember,
  transfer: boolean
): Promise<SwapEmailResult> {
  await Promise.all([
    supabase.from('applications').update({ payment_status: 'paid' }).eq('id', source.id),
    supabase.from('applications').update({ payment_status: 'unpaid' }).eq('id', target.id),
  ]);

  if (transfer && target.assigned_committee_id) {
    const { data: allocRow } = await supabase
      .from('conference_allocations')
      .select('id')
      .eq('application_id', target.id)
      .maybeSingle();
    if (allocRow) {
      await supabase.from('conference_allocations')
        .update({ user_id: source.user_id, application_id: source.id })
        .eq('id', (allocRow as { id: string }).id);
    }
    await supabase.from('applications').update({
      status: 'assigned',
      assigned_committee_id: target.assigned_committee_id,
      assigned_country_code: target.assigned_country_code,
      assigned_country_name: target.assigned_country_name,
    }).eq('id', source.id);
    await supabase.from('applications').update({
      status: 'accepted',
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
    }).eq('id', target.id);
  }

  const [incoming, outgoing] = await Promise.all([
    queueEventEmail(supabase, conferenceId, 'spot_received', [source.id]),
    queueEventEmail(supabase, conferenceId, 'spot_lost', [target.id]),
  ]);
  return { incomingDrafted: incoming.drafted, outgoingDrafted: outgoing.drafted };
}

export async function markNotAttending(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  member: PoolMember
): Promise<{ drafted: boolean }> {
  const hasAllocation = !!member.assigned_committee_id;
  await supabase.from('applications').update({
    attending: false,
    assigned_committee_id: null,
    assigned_country_code: null,
    assigned_country_name: null,
    status: member.status === 'assigned' ? 'accepted' : member.status,
  }).eq('id', member.id);
  if (hasAllocation) {
    await supabase.from('conference_allocations').delete().eq('application_id', member.id);
  }
  const result = await queueEventEmail(supabase, conferenceId, 'not_attending', [member.id]);
  return { drafted: result.drafted };
}

export async function undoNotAttending(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  member: PoolMember
): Promise<{ drafted: boolean }> {
  await supabase.from('applications').update({ attending: true, payment_status: 'unpaid' }).eq('id', member.id);
  const result = await queueEventEmail(supabase, conferenceId, 'attendance_restored', [member.id]);
  return { drafted: result.drafted };
}

// ── Small shared bits ────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500 }}>
      {children}
    </p>
  );
}

export function MemberAvatar({ name, url, size = 22 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: 'rgba(154,138,120,0.16)', border: '1px solid rgba(221,212,192,0.9)' }}
    >
      <User size={Math.round(size * 0.55)} strokeWidth={2} style={{ color: '#9A8A78' }} />
    </div>
  );
}

export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function pledgeText(m: PoolMember): string {
  if (m.pledge_type === 'own') return 'own fee';
  if (m.pledge_type === 'delegation') return `${m.spots_pledged ?? 0} delegation spots`;
  if (m.pledge_type === 'both') return `own fee + ${m.spots_pledged ?? 0} delegation spots`;
  return '';
}

// ── Chips ────────────────────────────────────────────────────────────────────

// A draggable / click-selectable chip. Used both for a delegation's own
// unpaid members (with a NOT ATTENDING action) and for cross-conference
// search results being dragged in as a substitute (no action, just a subtitle).
export function DraggableChip({
  name, avatarUrl, subtitle, selected, onSelect, onDragStart, onDragEnd, onNotAttending, dataId,
}: {
  name: string; avatarUrl: string | null; subtitle?: string; selected: boolean;
  onSelect: () => void; onDragStart: () => void; onDragEnd: () => void;
  onNotAttending?: () => void; dataId: string;
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
      <MemberAvatar name={name} url={avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
        {subtitle && (
          <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{subtitle}</p>
        )}
      </div>
      {selected && <Check size={13} style={{ color: '#3D7A52', flexShrink: 0 }} />}
      {onNotAttending && (
        <button
          onClick={e => { e.stopPropagation(); onNotAttending(); }}
          className="flex-shrink-0 focus:outline-none"
          style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          NOT ATTENDING
        </button>
      )}
    </div>
  );
}

export function WaivedChip({ member }: { member: PoolMember }) {
  const name = member.profiles?.display_name ?? 'Unknown';
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5"
      style={{ backgroundColor: 'rgba(184,132,74,0.06)', border: '1px solid rgba(184,132,74,0.3)' }}
    >
      <Lock size={12} style={{ color: '#9A6B2F', flexShrink: 0 }} />
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#9A6B2F', fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0 }}>WAIVED</span>
    </div>
  );
}

export function NotAttendingChip({ member, onUndo }: { member: PoolMember; onUndo: () => void }) {
  const name = member.profiles?.display_name ?? 'Unknown';
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5"
      style={{ backgroundColor: 'rgba(154,138,120,0.06)', border: '1px solid #F0EDE6', opacity: 0.7 }}
    >
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{name}</span>
      <button
        onClick={onUndo}
        className="flex-shrink-0 focus:outline-none"
        style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', fontFamily: MONO, letterSpacing: '0.04em' }}
      >
        UNDO
      </button>
    </div>
  );
}

export function PaidSlotChip({
  member, isDropTarget, clickable,
  onDragOver, onDragLeave, onDrop, onClickTarget, onNotAttending,
}: {
  member: PoolMember; isDropTarget: boolean; clickable: boolean;
  onDragOver: () => void; onDragLeave: () => void; onDrop: (sourceId: string) => void;
  onClickTarget: () => void; onNotAttending: () => void;
}) {
  const name = member.profiles?.display_name ?? 'Unknown';
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
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
        {member.assigned_committee_id && (
          <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            {member.assigned_committee?.abbreviation ?? member.assigned_committee?.name} — {member.assigned_country_name}
          </p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onNotAttending(); }}
        className="flex-shrink-0 focus:outline-none"
        style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
      >
        NOT ATTENDING
      </button>
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
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.08em' }}>OPEN SPOT</span>
    </div>
  );
}

// ── Swap confirmation modal ──────────────────────────────────────────────────

export function SwapConfirmModal({
  source, target, onCancel, onConfirm,
}: {
  source: NamedApp; target: PoolMember;
  onCancel: () => void; onConfirm: (transfer: boolean) => void;
}) {
  const [transfer, setTransfer] = useState(!!target.assigned_committee_id);
  const sourceName = source.profiles?.display_name ?? 'this delegate';
  const targetCommittee = target.assigned_committee?.abbreviation ?? target.assigned_committee?.name;

  return (
    <ModalOverlay onClose={onCancel}>
      <div
        className="rounded-2xl p-6"
        style={{ width: 'min(92vw, 440px)', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 20px 50px rgba(27,56,40,0.25)' }}
      >
        <h3 className="font-black text-base mb-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Switch delegates?</h3>
        <p className="text-sm mb-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          Are you sure you want to switch these two delegates and their payment status?
        </p>
        {target.assigned_committee_id && (
          <label className="flex items-start gap-2 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={transfer}
              onChange={e => setTransfer(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: '#1B3828' }}
            />
            <span className="text-xs" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Transfer committee assignment ({targetCommittee} — {target.assigned_country_name}) to {sourceName}
            </span>
          </label>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
          >
            CANCEL
          </button>
          <button
            onClick={() => onConfirm(transfer)}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            CONFIRM SWAP
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
