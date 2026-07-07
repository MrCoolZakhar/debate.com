'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, GripVertical, Lock, User, Check } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import type { Conference } from '@/app/manage/[slug]/layout';

// ── Shared bits (matches the visual language of the rest of this page) ─────────

const OUTFIT = "'Outfit', sans-serif";
// Typography rule on this page: no monospace — MONO resolves to Outfit (family swap only).
const MONO = "'Outfit', sans-serif";

// ── Pool accounting (adapted from applications/page.tsx's fillFreeSpots) ───────

type Pool = 'delegate' | 'advisor';

const POOL_ROLES: Record<Pool, string[]> = {
  delegate: ['delegate', 'head-delegate'],
  advisor: ['faculty-advisor'],
};

const POOL_SPOTS_COLUMN: Record<Pool, 'spots_purchased' | 'advisor_spots_purchased'> = {
  delegate: 'spots_purchased',
  advisor: 'advisor_spots_purchased',
};

function poolForRole(role: string): Pool | null {
  if (role === 'delegate' || role === 'head-delegate') return 'delegate';
  if (role === 'faculty-advisor') return 'advisor';
  return null;
}

/**
 * Promotes the oldest-submitted attending unpaid members of a pool to 'paid'
 * until the pool's purchased-spots column is full or candidates run out.
 * Idempotent — a no-op when the pool has no free spots.
 */
async function fillFreeSpots(
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

interface Society {
  id: string;
  name: string;
  spots_purchased: number;
  advisor_spots_purchased: number;
}

interface DelegationMember {
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

interface SearchApp {
  id: string;
  user_id: string;
  role: string;
  society_id: string | null;
  societies: { name: string } | null;
  profiles: { display_name: string } | null;
}

// ── Small shared bits ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500 }}>
      {children}
    </p>
  );
}

function MemberAvatar({ name, url, size = 22 }: { name: string; url: string | null; size?: number }) {
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

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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

function pledgeText(m: DelegationMember): string {
  if (m.pledge_type === 'own') return 'own fee';
  if (m.pledge_type === 'delegation') return `${m.spots_pledged ?? 0} delegation spots`;
  if (m.pledge_type === 'both') return `own fee + ${m.spots_pledged ?? 0} delegation spots`;
  return '';
}

// ── Card grid ────────────────────────────────────────────────────────────────

function DelegationCard({ society, members, onClick }: { society: Society; members: DelegationMember[]; onClick: () => void }) {
  const advisorCount = members.filter(m => m.role === 'faculty-advisor').length;
  const headDelCount = members.filter(m => m.is_head_delegate || m.role === 'head-delegate').length;
  const totalDelegates = members.filter(m => (m.role === 'delegate' || m.role === 'head-delegate') && m.attending).length;
  const pledgePending = members.some(m => (m.pledge_type === 'delegation' || m.pledge_type === 'both') && !m.pledge_confirmed_at);

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-5 transition-colors focus:outline-none"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-black text-base truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{society.name}</p>
        {pledgePending && (
          <span
            className="flex-shrink-0 px-2 py-0.5 rounded-full"
            style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.4)', fontFamily: OUTFIT }}
          >
            PLEDGE PENDING
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {[
          ['Advisors', advisorCount],
          ['Head Delegates', headDelCount],
          ['Total Delegates', totalDelegates],
          ['Paid Spots', society.spots_purchased],
        ].map(([label, value]) => (
          <div key={label as string} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{label}</span>
            <span className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── Expanded view — member chips ────────────────────────────────────────────

function UnpaidChip({
  member, selected, onSelect, onNotAttending, onDragStart, onDragEnd,
}: {
  member: DelegationMember; selected: boolean;
  onSelect: () => void; onNotAttending: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const name = member.profiles?.display_name ?? 'Unknown';
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', member.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
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
      <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</span>
      {selected && <Check size={13} style={{ color: '#3D7A52', flexShrink: 0 }} />}
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

function WaivedChip({ member }: { member: DelegationMember }) {
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

function NotAttendingChip({ member, onUndo }: { member: DelegationMember; onUndo: () => void }) {
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

function PaidSlotChip({
  member, isDropTarget, clickable,
  onDragOver, onDragLeave, onDrop, onClickTarget, onNotAttending,
}: {
  member: DelegationMember; isDropTarget: boolean; clickable: boolean;
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

function OpenSlot({
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

function SwapConfirmModal({
  source, target, onCancel, onConfirm,
}: {
  source: DelegationMember; target: DelegationMember;
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

// ── DelegationsView ──────────────────────────────────────────────────────────

interface DelegationsViewProps {
  conference: Conference;
  showFlash: (kind: 'ok' | 'err', msg: string) => void;
}

export default function DelegationsView({ conference, showFlash }: DelegationsViewProps) {
  const { session } = useAuth();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [members, setMembers] = useState<DelegationMember[]>([]);
  const [searchPool, setSearchPool] = useState<SearchApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dragMemberId, setDragMemberId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<{ sourceId: string; targetId: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!conference || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [socRes, memberRes, searchRes] = await Promise.all([
      supabase
        .from('societies')
        .select('id, name, spots_purchased, advisor_spots_purchased')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select(`
          id, user_id, role, status, is_head_delegate, payment_status, attending,
          pledge_type, spots_pledged, pledge_confirmed_at, submitted_at,
          assigned_committee_id, assigned_country_code, assigned_country_name, society_id,
          assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
          profiles (display_name, avatar_url)
        `)
        .eq('conference_id', conference.id)
        .in('status', ['accepted', 'assigned'])
        .not('society_id', 'is', null),
      supabase
        .from('applications')
        .select(`
          id, user_id, role, society_id, status,
          societies (name),
          profiles (display_name)
        `)
        .eq('conference_id', conference.id)
        .in('status', ['accepted', 'assigned'])
        .in('role', ['delegate', 'head-delegate']),
    ]);

    setSocieties((socRes.data ?? []) as unknown as Society[]);
    setMembers((memberRes.data ?? []) as unknown as DelegationMember[]);
    setSearchPool((searchRes.data ?? []) as unknown as SearchApp[]);
    setLoading(false);
  }, [conference, session?.access_token]);

  useEffect(() => { loadData(); }, [loadData]);

  const membersBySociety = useMemo(() => {
    const map = new Map<string, DelegationMember[]>();
    for (const m of members) {
      if (!m.society_id) continue;
      if (!map.has(m.society_id)) map.set(m.society_id, []);
      map.get(m.society_id)!.push(m);
    }
    return map;
  }, [members]);

  const expandedSociety = societies.find(s => s.id === expandedId) ?? null;
  const expandedMembers = expandedId ? membersBySociety.get(expandedId) ?? [] : [];

  // ── Mutations ────────────────────────────────────────────────────────────

  async function handleAddToDelegation(app: SearchApp, society: Society) {
    if (!session) return;
    if (app.society_id && app.society_id !== society.id) {
      const fromName = app.societies?.name ?? 'their delegation';
      if (!window.confirm(`Move ${app.profiles?.display_name ?? 'this delegate'} from ${fromName} to ${society.name}?`)) return;
    }
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ society_id: society.id }).eq('id', app.id);
    setSearchQuery('');
    await loadData();
  }

  async function handleMarkPledgeReceived(member: DelegationMember, societyId: string) {
    if (!session) return;
    if (!window.confirm('Confirm this pledge as paid? Spots will be added to the delegation.')) return;
    const supabase = getAuthedClient(session.access_token);

    if (member.pledge_type === 'delegation' || member.pledge_type === 'both') {
      const { data: soc } = await supabase.from('societies').select('spots_purchased').eq('id', societyId).single();
      const current = (soc as { spots_purchased: number } | null)?.spots_purchased ?? 0;
      await supabase.from('societies').update({ spots_purchased: current + (member.spots_pledged ?? 0) }).eq('id', societyId);
    }

    if (member.pledge_type === 'own' || member.pledge_type === 'both') {
      await supabase.from('applications').update({ payment_status: 'paid' }).eq('id', member.id);
      const pool = poolForRole(member.role);
      if (pool) {
        const spotsColumn = POOL_SPOTS_COLUMN[pool];
        const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', societyId).single();
        const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
        await supabase.from('societies').update({ [spotsColumn]: current + 1 }).eq('id', societyId);
      }
    }

    await supabase.from('applications').update({ pledge_confirmed_at: new Date().toISOString() }).eq('id', member.id);

    await fillFreeSpots(supabase, societyId, 'delegate');
    const pool = poolForRole(member.role);
    if (pool === 'advisor' && (member.pledge_type === 'own' || member.pledge_type === 'both')) {
      await fillFreeSpots(supabase, societyId, 'advisor');
    }

    showFlash('ok', 'Pledge marked received.');
    await loadData();
  }

  async function handleNotAttending(member: DelegationMember) {
    if (!session) return;
    const name = member.profiles?.display_name ?? 'this delegate';
    const hasAllocation = !!member.assigned_committee_id;
    let msg = `Mark ${name} as not attending? Their delegation spot stays with the delegation.`;
    if (hasAllocation) msg += ' Their committee assignment will be removed.';
    if (!window.confirm(msg)) return;

    const supabase = getAuthedClient(session.access_token);
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
    await loadData();
  }

  async function handleUndoNotAttending(member: DelegationMember) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ attending: true, payment_status: 'unpaid' }).eq('id', member.id);
    await loadData();
  }

  async function handleGiveOpenSpot(sourceId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ payment_status: 'paid' }).eq('id', sourceId);
    showFlash('ok', 'Delegate marked paid.');
    await loadData();
  }

  async function handleSwap(sourceId: string, targetId: string, transfer: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const source = members.find(m => m.id === sourceId);
    const target = members.find(m => m.id === targetId);
    if (!source || !target) return;

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

    setSwapConfirm(null);
    showFlash('ok', 'Delegates switched.');
    await loadData();
  }

  // ── Drop / click-target dispatch ──────────────────────────────────────────

  function interactWithPaidSlot(target: DelegationMember, draggedId?: string) {
    const sourceId = draggedId || selectedMemberId;
    setDropTargetKey(null);
    setDragMemberId(null);
    if (!sourceId || sourceId === target.id) { setSelectedMemberId(null); return; }
    setSelectedMemberId(null);
    setSwapConfirm({ sourceId, targetId: target.id });
  }

  function interactWithOpenSlot(draggedId?: string) {
    const sourceId = draggedId || selectedMemberId;
    setDropTargetKey(null);
    setDragMemberId(null);
    setSelectedMemberId(null);
    if (!sourceId) return;
    const source = members.find(m => m.id === sourceId);
    if (window.confirm(`Give this open paid spot to ${source?.profiles?.display_name ?? 'this delegate'}?`)) {
      handleGiveOpenSpot(sourceId);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // ── Card grid (default view) ──────────────────────────────────────────────

  if (!expandedSociety) {
    return (
      <div>
        <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: '#9A8A78', fontFamily: MONO }}>DELEGATIONS</p>
        <p className="text-sm mb-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Groups brought by a faculty advisor or head delegate. Click a delegation to manage its members, payments and spots.
        </p>
        {societies.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No delegations yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {societies.map(s => (
              <DelegationCard
                key={s.id}
                society={s}
                members={membersBySociety.get(s.id) ?? []}
                onClick={() => setExpandedId(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Expanded delegation view ──────────────────────────────────────────────

  const society = expandedSociety;
  const advisors = [...expandedMembers.filter(m => m.role === 'faculty-advisor')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const delegatePool = expandedMembers.filter(m => m.role === 'delegate' || m.role === 'head-delegate');
  const paidAttending = [...delegatePool.filter(m => m.attending && m.payment_status === 'paid')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const unpaidAttending = [...delegatePool.filter(m => m.attending && m.payment_status === 'unpaid')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const waivedMembers = [...delegatePool.filter(m => m.payment_status === 'waived')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const notAttendingMembers = [...delegatePool.filter(m => !m.attending && m.payment_status !== 'waived')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const pledgingMembers = expandedMembers.filter(m => m.pledge_type);
  const openCount = Math.max(0, society.spots_purchased - paidAttending.length);

  const searchResults = searchQuery.trim()
    ? searchPool
        .filter(a => a.society_id !== society.id)
        .filter(a => (a.profiles?.display_name ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const swapSource = swapConfirm ? members.find(m => m.id === swapConfirm.sourceId) ?? null : null;
  const swapTarget = swapConfirm ? members.find(m => m.id === swapConfirm.targetId) ?? null : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setExpandedId(null); setSelectedMemberId(null); setSearchQuery(''); }}
          className="flex items-center gap-1 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
          style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <ChevronLeft size={14} /> BACK
        </button>
        <h2 className="font-black text-xl truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{society.name}</h2>
      </div>

      {/* Advisors */}
      {advisors.length > 0 && (
        <div className="mb-6">
          <SectionLabel>ADVISORS</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            {advisors.map(a => {
              const paid = a.payment_status === 'paid';
              const name = a.profiles?.display_name ?? 'Unknown';
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1"
                  style={{
                    backgroundColor: paid ? '#1B3828' : 'transparent',
                    border: `1px solid ${paid ? '#1B3828' : '#DDD4C0'}`,
                  }}
                >
                  <MemberAvatar name={name} url={a.profiles?.avatar_url ?? null} size={20} />
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: OUTFIT, color: paid ? '#EED98A' : '#1C1410' }}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pledges */}
      {pledgingMembers.length > 0 && (
        <div className="mb-6 rounded-2xl p-4" style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.25)' }}>
          <SectionLabel>PLEDGES</SectionLabel>
          <div className="flex flex-col gap-2 mt-2">
            {pledgingMembers.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <p className="text-sm min-w-0 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  <span style={{ fontWeight: 700 }}>{m.profiles?.display_name ?? 'Unknown'}</span> pledged: {pledgeText(m)}
                </p>
                {m.pledge_confirmed_at ? (
                  <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, color: '#3D7A52', fontFamily: MONO }}>
                    <Check size={12} /> RECEIVED
                  </span>
                ) : (
                  <button
                    onClick={() => handleMarkPledgeReceived(m, society.id)}
                    className="flex-shrink-0 rounded-lg py-1 px-3 text-xs font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: OUTFIT }}
                  >
                    MARK RECEIVED
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column body — delegate pool only */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div>
          <SectionLabel>ADD DELEGATE</SectionLabel>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mt-2 mb-2" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search all applicants..."
              className="flex-1 text-sm outline-none"
              style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT }}
            />
          </div>
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-4">
              {searchResults.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#FAF8F3', border: '1px solid #F0EDE6' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{a.profiles?.display_name ?? 'Unknown'}</p>
                    <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{a.societies?.name ?? 'Independent'}</p>
                  </div>
                  <button
                    onClick={() => handleAddToDelegation(a, society)}
                    className="flex-shrink-0 rounded-lg py-1 px-3 text-xs font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    ADD
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-5">
            <SectionLabel>UNPAID ({unpaidAttending.length})</SectionLabel>
            <span style={{ fontSize: 9, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em', marginLeft: 'auto' }}>
              DRAG OR CLICK, THEN CLICK A SPOT
            </span>
          </div>
          <div className="mt-2">
            {unpaidAttending.length === 0 ? (
              <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No unpaid delegates.</p>
            ) : (
              unpaidAttending.map(m => (
                <UnpaidChip
                  key={m.id}
                  member={m}
                  selected={selectedMemberId === m.id}
                  onSelect={() => setSelectedMemberId(prev => (prev === m.id ? null : m.id))}
                  onNotAttending={() => handleNotAttending(m)}
                  onDragStart={() => setDragMemberId(m.id)}
                  onDragEnd={() => { setDragMemberId(null); setDropTargetKey(null); }}
                />
              ))
            )}
          </div>

          {waivedMembers.length > 0 && (
            <>
              <SectionLabel>WAIVED</SectionLabel>
              <div className="mt-2">
                {waivedMembers.map(m => <WaivedChip key={m.id} member={m} />)}
              </div>
            </>
          )}

          {notAttendingMembers.length > 0 && (
            <div className="mt-5">
              <SectionLabel>NOT ATTENDING</SectionLabel>
              <div className="mt-2">
                {notAttendingMembers.map(m => (
                  <NotAttendingChip key={m.id} member={m} onUndo={() => handleUndoNotAttending(m)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div>
          <SectionLabel>PAID SPOTS ({paidAttending.length}/{society.spots_purchased})</SectionLabel>
          <div className="mt-2">
            {paidAttending.map(m => (
              <PaidSlotChip
                key={m.id}
                member={m}
                isDropTarget={dropTargetKey === `paid-${m.id}`}
                clickable={selectedMemberId !== null}
                onDragOver={() => { if (dragMemberId) setDropTargetKey(`paid-${m.id}`); }}
                onDragLeave={() => setDropTargetKey(prev => (prev === `paid-${m.id}` ? null : prev))}
                onDrop={sourceId => interactWithPaidSlot(m, sourceId)}
                onClickTarget={() => interactWithPaidSlot(m)}
                onNotAttending={() => handleNotAttending(m)}
              />
            ))}
            {Array.from({ length: openCount }).map((_, i) => (
              <OpenSlot
                key={`open-${i}`}
                isDropTarget={dropTargetKey === `open-${i}`}
                clickable={selectedMemberId !== null}
                onDragOver={() => { if (dragMemberId) setDropTargetKey(`open-${i}`); }}
                onDragLeave={() => setDropTargetKey(prev => (prev === `open-${i}` ? null : prev))}
                onDrop={sourceId => interactWithOpenSlot(sourceId)}
                onClickTarget={() => interactWithOpenSlot()}
              />
            ))}
            {paidAttending.length === 0 && openCount === 0 && (
              <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No paid spots purchased yet.</p>
            )}
          </div>
        </div>
      </div>

      {swapConfirm && swapSource && swapTarget && (
        <SwapConfirmModal
          source={swapSource}
          target={swapTarget}
          onCancel={() => setSwapConfirm(null)}
          onConfirm={transfer => handleSwap(swapConfirm.sourceId, swapConfirm.targetId, transfer)}
        />
      )}
    </div>
  );
}
