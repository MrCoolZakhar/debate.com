'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import type { Conference } from '@/app/manage/[slug]/layout';
import { queueEventEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import {
  OUTFIT, MONO, POOL_MEMBER_SELECT, POOL_SPOTS_COLUMN,
  poolForRole, fillFreeSpots, fetchSearchPool, fetchAdvisorPool, performSwap, markApplicationPaid,
  markNotAttending, undoNotAttending, removeFromDelegation, pledgeSatisfied, eligibleTransferRecipients,
  SectionLabel, MemberAvatar, DraggableChip, WaivedChip, NotAttendingChip, PaidSlotChip, OpenSlot, SwapConfirmModal, ModalOverlay, pledgeText,
  type PoolMember, type SearchApp,
} from '@/app/manage/[slug]/assignment/delegationShared';

function isHeadDelegate(m: PoolMember): boolean {
  return m.is_head_delegate || m.role === 'head-delegate';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Society {
  id: string;
  name: string;
  spots_purchased: number;
  advisor_spots_purchased: number;
}

// ── Card grid ────────────────────────────────────────────────────────────────

function DelegationCard({ society, members, hasUnseenSwap, onClick }: { society: Society; members: PoolMember[]; hasUnseenSwap: boolean; onClick: () => void }) {
  const advisorCount = members.filter(m => m.role === 'faculty-advisor').length;
  const headDelCount = members.filter(m => m.is_head_delegate || m.role === 'head-delegate').length;
  const totalDelegates = members.filter(m => (m.role === 'delegate' || m.role === 'head-delegate') && m.attending).length;
  const pledgePending = members.some(m => !!m.pledge_type && !pledgeSatisfied(m));

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-5 transition-colors focus:outline-none"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {hasUnseenSwap && (
            <span
              title="New allocation swap activity"
              className="flex-shrink-0"
              style={{ width: 7, height: 7, borderRadius: '9999px', backgroundColor: '#B6871F' }}
            />
          )}
          <p className="font-black text-base truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{society.name}</p>
        </div>
        {pledgePending && (
          <span
            className="flex-shrink-0 px-2 py-0.5 rounded-full"
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.4)', fontFamily: OUTFIT }}
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

// ── Advisor transfer picker (F18) ───────────────────────────────────────────
// ConfirmModal-based flow: this picker narrows down to a recipient, then the
// caller runs a second ConfirmModal (useConfirmModal) to finalize the swap.

function AdvisorTransferModal({
  advisor, pool, onClose, onPick,
}: {
  advisor: PoolMember; pool: SearchApp[]; onClose: () => void; onPick: (recipient: SearchApp) => void;
}) {
  const [query, setQuery] = useState('');
  // Only unpaid, attending advisors can meaningfully receive a paid spot —
  // waived or already-paid advisors have no use for it.
  const eligible = eligibleTransferRecipients(pool).filter(a => a.id !== advisor.id);
  const results = eligible
    .filter(a => (a.profiles?.display_name ?? a.invited_name ?? '').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="rounded-2xl p-6"
        style={{ width: 'min(92vw, 440px)', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(27,56,40,0.25)' }}
      >
        <h3 className="font-black text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Transfer spot</h3>
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Pick another accepted faculty advisor to receive {advisor.profiles?.display_name ?? advisor.invited_name ?? 'this advisor'}&apos;s paid spot.
        </p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search advisors..."
          autoFocus
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3"
          style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
        />
        <div className="flex flex-col gap-1.5" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {eligible.length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No unpaid delegates to receive this spot.</p>
          ) : results.length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No matches.</p>
          ) : results.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <MemberAvatar name={a.profiles?.display_name ?? a.invited_name ?? 'Unknown'} url={a.profiles?.avatar_url ?? null} size={30} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{a.profiles?.display_name ?? a.invited_name ?? 'Unknown'}</p>
                  <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{a.societies?.name ?? 'Independent'}</p>
                </div>
              </div>
              <button
                onClick={() => onPick(a)}
                className="flex-shrink-0 rounded-lg py-1 px-3 text-xs font-bold focus:outline-none transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                TRANSFER
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 rounded-xl py-2 font-bold text-sm focus:outline-none transition-colors"
          style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
        >
          CANCEL
        </button>
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
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [searchPool, setSearchPool] = useState<SearchApp[]>([]);
  const [advisorPool, setAdvisorPool] = useState<SearchApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dragMemberId, setDragMemberId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [advisorTransferPicker, setAdvisorTransferPicker] = useState<PoolMember | null>(null);
  const [unseenSwapSocietyIds, setUnseenSwapSocietyIds] = useState<Set<string>>(new Set());
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();

  // Monotonic guard so a slow older load never overwrites a newer one.
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference || !session) return;
    const seq = ++loadSeqRef.current;
    // silent: background refresh, keeps the list mounted (no spinner wipe,
    // expanded delegation and scroll survive).
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [socRes, memberRes, search, advisors, swapReqRes] = await Promise.all([
      supabase
        .from('societies')
        .select('id, name, spots_purchased, advisor_spots_purchased')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select(POOL_MEMBER_SELECT)
        .eq('conference_id', conference.id)
        .in('status', ['accepted', 'assigned'])
        .not('society_id', 'is', null),
      fetchSearchPool(supabase, conference.id),
      fetchAdvisorPool(supabase, conference.id),
      supabase
        .from('conference_requests')
        .select('metadata')
        .eq('conference_id', conference.id)
        .in('kind', ['swap_request', 'swap_notice'])
        .eq('seen_by_organizer', false),
    ]);

    if (seq !== loadSeqRef.current) return; // stale response

    setSocieties((socRes.data ?? []) as unknown as Society[]);
    setMembers((memberRes.data ?? []) as unknown as PoolMember[]);
    setUnseenSwapSocietyIds(new Set(
      ((swapReqRes.data ?? []) as { metadata: { society_id?: string } }[])
        .map(r => r.metadata?.society_id)
        .filter((id): id is string => !!id)
    ));
    setSearchPool(search);
    setAdvisorPool(advisors);
    setLoading(false);
  }, [conference, session?.access_token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Opening a delegation marks its pending swap_request/swap_notice rows
  // seen, optimistic locally, fire-and-forget on the DB.
  function handleExpandSociety(societyId: string) {
    setExpandedId(societyId);
    if (!unseenSwapSocietyIds.has(societyId) || !session) return;
    setUnseenSwapSocietyIds(prev => { const next = new Set(prev); next.delete(societyId); return next; });
    const supabase = getAuthedClient(session.access_token);
    supabase
      .from('conference_requests')
      .update({ seen_by_organizer: true })
      .eq('conference_id', conference.id)
      .in('kind', ['swap_request', 'swap_notice'])
      .eq('seen_by_organizer', false)
      .eq('metadata->>society_id', societyId)
      .then();
  }

  const membersBySociety = useMemo(() => {
    const map = new Map<string, PoolMember[]>();
    for (const m of members) {
      if (!m.society_id) continue;
      if (!map.has(m.society_id)) map.set(m.society_id, []);
      map.get(m.society_id)!.push(m);
    }
    return map;
  }, [members]);

  const expandedSociety = societies.find(s => s.id === expandedId) ?? null;
  const expandedMembers = expandedId ? membersBySociety.get(expandedId) ?? [] : [];

  // ── Optimistic local patch helpers ─────────────────────────────────────────
  // Mutate exactly the affected rows; rollbacks restore the exact snapshots.

  function patchMember(id: string, patch: Partial<PoolMember>) {
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }
  function restoreMember(snapshot: PoolMember) {
    setMembers(prev => prev.map(m => (m.id === snapshot.id ? snapshot : m)));
  }
  function patchSociety(id: string, patch: Partial<Society>) {
    setSocieties(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }
  function restoreSociety(snapshot: Society) {
    setSocieties(prev => prev.map(s => (s.id === snapshot.id ? snapshot : s)));
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  async function handleAddToDelegation(app: SearchApp, society: Society) {
    if (!session) return;
    if (app.society_id && app.society_id !== society.id) {
      const fromName = app.societies?.name ?? 'their delegation';
      const { confirmed } = await confirm({
        title: `Move ${app.profiles?.display_name ?? app.invited_name ?? 'this delegate'}?`,
        body: `Move them from ${fromName} to ${society.name}?`,
        confirmLabel: 'Move',
      });
      if (!confirmed) return;
    }
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the search result reflects the move immediately; the full
    // PoolMember row (payment, pledge, etc.) arrives via silent refetch.
    const prevSearchEntry = searchPool.find(a => a.id === app.id) ?? null;
    setSearchPool(prev => prev.map(a =>
      a.id === app.id ? { ...a, society_id: society.id, societies: { name: society.name } } : a
    ));
    setSearchQuery('');

    (async () => {
      // is_independent is a derived convenience kept in sync on every
      // mutation for read paths that haven't been ported, society_id IS
      // NULL is the actual source of truth, never read is_independent for logic.
      const { error } = await supabase.from('applications').update({ society_id: society.id, is_independent: false }).eq('id', app.id);
      if (error) {
        if (prevSearchEntry) setSearchPool(prev => prev.map(a => (a.id === app.id ? prevSearchEntry : a)));
        showFlash('err', `Could not add ${app.profiles?.display_name ?? 'this delegate'} to ${society.name}.`);
        return;
      }
      try {
        const result = await queueEventEmail(supabase, conference.id, 'added_to_delegation', [app.id]);
        if (!result.drafted) pushDraftNotice('added_to_delegation');
      } catch {
        showFlash('err', 'Added, but the notification email could not be queued.');
      }
      loadData({ silent: true });
    })().catch(() => {
      if (prevSearchEntry) setSearchPool(prev => prev.map(a => (a.id === app.id ? prevSearchEntry : a)));
      showFlash('err', `Could not add ${app.profiles?.display_name ?? 'this delegate'} to ${society.name}.`);
    });
  }

  async function handleMarkPledgeReceived(member: PoolMember, societyId: string) {
    if (!session) return;
    // F21: fully idempotent, nothing left to do once the pledge is satisfied.
    if (pledgeSatisfied(member)) return;
    const { confirmed } = await confirm({
      title: 'Confirm this pledge as paid?',
      body: 'Spots will be added to the delegation.',
      confirmLabel: 'Confirm',
    });
    if (!confirmed) return;
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: pledge shows COVERED, society spot count grows —
    // immediately. fillFreeSpots promotions land via silent refetch after
    // the writes.
    const memberSnapshot = members.find(m => m.id === member.id) ?? member;
    const societySnapshot = societies.find(s => s.id === societyId) ?? null;
    patchMember(member.id, { pledge_confirmed_at: new Date().toISOString() });
    if (societySnapshot) {
      patchSociety(societyId, { spots_purchased: societySnapshot.spots_purchased + (member.spots_pledged ?? 0) });
    }
    showFlash('ok', 'Pledge marked received.');

    const rollback = () => {
      restoreMember(memberSnapshot);
      if (societySnapshot) restoreSociety(societySnapshot);
    };

    (async () => {
      let firstError: string | null = null;
      const note = (e: { message: string } | null) => { if (e && !firstError) firstError = e.message; };

      const { data: soc } = await supabase.from('societies').select('spots_purchased').eq('id', societyId).single();
      const current = (soc as { spots_purchased: number } | null)?.spots_purchased ?? 0;
      const { error } = await supabase.from('societies').update({ spots_purchased: current + (member.spots_pledged ?? 0) }).eq('id', societyId);
      note(error);

      const { error: confirmErr } = await supabase.from('applications').update({ pledge_confirmed_at: new Date().toISOString() }).eq('id', member.id);
      note(confirmErr);

      await fillFreeSpots(supabase, societyId, 'delegate');

      if (firstError) {
        rollback();
        showFlash('err', 'Could not confirm this pledge.');
        loadData({ silent: true }); // converge any partial writes
        return;
      }

      try {
        const headDelegateIds = members
          .filter(m => m.society_id === societyId && isHeadDelegate(m))
          .map(m => m.id);
        const pledgeRecipientIds = Array.from(new Set([member.id, ...headDelegateIds]));
        const result = await queueEventEmail(supabase, conference.id, 'pledge_received', pledgeRecipientIds);
        if (!result.drafted) pushDraftNotice('pledge_received');
      } catch {
        showFlash('err', 'Pledge confirmed, but the notification email could not be queued.');
      }

      loadData({ silent: true }); // brings in fillFreeSpots promotions
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not confirm this pledge.');
      loadData({ silent: true });
    });
  }

  async function handleNotAttending(member: PoolMember) {
    if (!session) return;
    const name = member.profiles?.display_name ?? member.invited_name ?? 'this delegate';
    const hasAllocation = !!member.assigned_committee_id;
    const { confirmed } = await confirm({
      title: `Mark ${name} as not attending?`,
      body: hasAllocation
        ? 'Their delegation spot stays with the delegation. Their committee assignment will be removed.'
        : 'Their delegation spot stays with the delegation.',
      confirmLabel: 'Mark Not Attending',
      danger: true,
    });
    if (!confirmed) return;

    const supabase = getAuthedClient(session.access_token);

    // Optimistic: exactly what markNotAttending writes for this row.
    const snapshot = members.find(m => m.id === member.id) ?? member;
    patchMember(member.id, {
      attending: false,
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      assigned_committee: null,
      status: member.status === 'assigned' ? 'accepted' : member.status,
    });

    (async () => {
      const result = await markNotAttending(supabase, conference.id, member);
      if (result.error) {
        restoreMember(snapshot);
        showFlash('err', `Could not mark ${name} as not attending.`);
        loadData({ silent: true });
        return;
      }
      if (!result.drafted) pushDraftNotice('not_attending');
      loadData({ silent: true });
    })().catch(() => {
      restoreMember(snapshot);
      showFlash('err', `Could not mark ${name} as not attending.`);
    });
  }

  async function handleUndoNotAttending(member: PoolMember) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: exactly what undoNotAttending writes for this row.
    const snapshot = members.find(m => m.id === member.id) ?? member;
    patchMember(member.id, { attending: true, payment_status: 'unpaid' });

    (async () => {
      const result = await undoNotAttending(supabase, conference.id, member);
      if (result.error) {
        restoreMember(snapshot);
        showFlash('err', 'Could not restore attendance.');
        loadData({ silent: true });
        return;
      }
      if (!result.drafted) pushDraftNotice('attendance_restored');
      loadData({ silent: true });
    })().catch(() => {
      restoreMember(snapshot);
      showFlash('err', 'Could not restore attendance.');
    });
  }

  async function handleRemove(member: PoolMember, societyName: string) {
    if (!session) return;
    const name = member.profiles?.display_name ?? member.invited_name ?? 'this delegate';
    const hasAllocation = !!member.assigned_committee_id;
    const selfFundedPaidSpot = member.payment_status === 'paid' && !!member.self_paid;
    const outcome = member.payment_status === 'waived'
      ? 'Their fee waiver is personal and stays with them.'
      : selfFundedPaidSpot
      ? 'Their paid spot was self-funded, so it leaves with them. They become a paid independent.'
      : member.payment_status === 'paid'
      ? "Their spot was covered by the delegation's purchased spots, so it stays behind. It will show as open."
      : 'They leave unpaid.';

    const { confirmed, checked } = await confirm({
      title: `Remove ${name} from ${societyName}?`,
      body: outcome,
      confirmLabel: 'Remove',
      danger: true,
      checkbox: hasAllocation ? { label: 'Keep their committee allocation', defaultChecked: true } : undefined,
    });
    if (!confirmed) return;

    const supabase = getAuthedClient(session.access_token);
    const keepAllocation = hasAllocation ? checked : false;

    // Optimistic: mirror removeFromDelegation's writes for this row —
    // society_id -> null drops them out of this delegation's lists at once.
    const snapshot = members.find(m => m.id === member.id) ?? member;
    const societySnapshot = societies.find(s => s.id === member.society_id) ?? null;
    const memberPatch: Partial<PoolMember> = { society_id: null };
    if (member.payment_status === 'paid' && !member.self_paid) memberPatch.payment_status = 'unpaid';
    if (!keepAllocation) {
      memberPatch.assigned_committee_id = null;
      memberPatch.assigned_country_code = null;
      memberPatch.assigned_country_name = null;
      memberPatch.assigned_committee = null;
      if (member.status === 'assigned') memberPatch.status = 'accepted';
    }
    patchMember(member.id, memberPatch);
    const pool = poolForRole(member.role);
    if (selfFundedPaidSpot && pool && member.society_id && societySnapshot) {
      const col = POOL_SPOTS_COLUMN[pool];
      patchSociety(member.society_id, { [col]: Math.max(0, societySnapshot[col] - 1) });
    }
    showFlash('ok', `${name} removed from the delegation.`);

    const rollback = () => {
      restoreMember(snapshot);
      if (societySnapshot) restoreSociety(societySnapshot);
    };

    (async () => {
      const result = await removeFromDelegation(supabase, conference.id, member, keepAllocation);
      if (result.error) {
        rollback();
        showFlash('err', `Could not remove ${name} from the delegation.`);
        loadData({ silent: true });
        return;
      }
      if (!result.drafted) pushDraftNotice('removed_from_delegation');
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', `Could not remove ${name} from the delegation.`);
    });
  }

  async function handleAdvisorTransfer(paidAdvisor: PoolMember, recipient: SearchApp) {
    setAdvisorTransferPicker(null);
    if (!session) return;
    const { confirmed } = await confirm({
      title: 'Transfer this spot?',
      body: `Transfer ${paidAdvisor.profiles?.display_name ?? paidAdvisor.invited_name ?? 'this advisor'}'s paid spot to ${recipient.profiles?.display_name ?? recipient.invited_name ?? 'this advisor'}?`,
      confirmLabel: 'Transfer',
    });
    if (!confirmed) return;

    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the outgoing advisor drops to unpaid at once; the recipient
    // (who may live outside this delegation's member list) turns paid if
    // they're local, otherwise the silent refetch brings them in.
    const outgoingSnapshot = members.find(m => m.id === paidAdvisor.id) ?? paidAdvisor;
    const incomingSnapshot = members.find(m => m.id === recipient.id) ?? null;
    patchMember(paidAdvisor.id, { payment_status: 'unpaid', self_paid: false });
    if (incomingSnapshot) patchMember(recipient.id, { payment_status: 'paid', self_paid: false });
    showFlash('ok', 'Advisor spot transferred.');

    const rollback = () => {
      restoreMember(outgoingSnapshot);
      if (incomingSnapshot) restoreMember(incomingSnapshot);
    };

    (async () => {
      // Advisors never hold committee allocations, so transfer=false always.
      const emailResult = await performSwap(supabase, conference.id, recipient, paidAdvisor, false);
      if (emailResult.error) {
        rollback();
        showFlash('err', 'Could not transfer this spot.');
        loadData({ silent: true });
        return;
      }
      if (!emailResult.incomingDrafted) pushDraftNotice('spot_received');
      if (!emailResult.outgoingDrafted) pushDraftNotice('spot_lost');
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not transfer this spot.');
    });
  }

  async function handleGiveOpenSpot(sourceId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the delegate fills the open paid slot immediately.
    const snapshot = members.find(m => m.id === sourceId);
    patchMember(sourceId, { payment_status: 'paid', self_paid: false });
    showFlash('ok', 'Delegate marked paid.');

    (async () => {
      const { error } = await markApplicationPaid(supabase, sourceId);
      if (error) {
        if (snapshot) restoreMember(snapshot);
        showFlash('err', 'Could not mark this delegate paid.');
      }
    })().catch(() => {
      if (snapshot) restoreMember(snapshot);
      showFlash('err', 'Could not mark this delegate paid.');
    });
  }

  async function handleSwap(sourceId: string, targetId: string, transfer: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const source = members.find(m => m.id === sourceId);
    const target = members.find(m => m.id === targetId);
    if (!source || !target) return;

    // Optimistic: mirror performSwap's writes, payment flips both ways, and
    // the allocation moves only under the same guard the helper enforces.
    const sourceSnapshot = source;
    const targetSnapshot = target;
    const canTransferAllocation = transfer && !!target.assigned_committee_id && !source.assigned_committee_id;
    patchMember(source.id, {
      payment_status: 'paid',
      self_paid: false,
      ...(canTransferAllocation ? {
        status: 'assigned',
        assigned_committee_id: target.assigned_committee_id,
        assigned_country_code: target.assigned_country_code,
        assigned_country_name: target.assigned_country_name,
        assigned_committee: target.assigned_committee,
      } : {}),
    });
    patchMember(target.id, {
      payment_status: 'unpaid',
      self_paid: false,
      ...(canTransferAllocation ? {
        status: 'accepted',
        assigned_committee_id: null,
        assigned_country_code: null,
        assigned_country_name: null,
        assigned_committee: null,
      } : {}),
    });
    setSwapConfirm(null);
    showFlash('ok', 'Delegates switched.');

    const rollback = () => {
      restoreMember(sourceSnapshot);
      restoreMember(targetSnapshot);
    };

    (async () => {
      const emailResult = await performSwap(supabase, conference.id, source, target, transfer);
      if (emailResult.error) {
        rollback();
        showFlash('err', 'Could not switch these delegates.');
        loadData({ silent: true });
        return;
      }
      if (!emailResult.incomingDrafted) pushDraftNotice('spot_received');
      if (!emailResult.outgoingDrafted) pushDraftNotice('spot_lost');
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not switch these delegates.');
    });
  }

  // ── Drop / click-target dispatch ──────────────────────────────────────────

  function interactWithPaidSlot(target: PoolMember, draggedId?: string) {
    const sourceId = draggedId || selectedMemberId;
    setDropTargetKey(null);
    setDragMemberId(null);
    if (!sourceId || sourceId === target.id) { setSelectedMemberId(null); return; }
    setSelectedMemberId(null);
    setSwapConfirm({ sourceId, targetId: target.id });
  }

  async function interactWithOpenSlot(draggedId?: string) {
    const sourceId = draggedId || selectedMemberId;
    setDropTargetKey(null);
    setDragMemberId(null);
    setSelectedMemberId(null);
    if (!sourceId) return;
    const source = members.find(m => m.id === sourceId);
    const { confirmed } = await confirm({
      title: 'Give this open paid spot?',
      body: `Give this open paid spot to ${source?.profiles?.display_name ?? source?.invited_name ?? 'this delegate'}?`,
      confirmLabel: 'Give Spot',
    });
    if (confirmed) handleGiveOpenSpot(sourceId);
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
        <DraftNoticeList notices={draftNotices} conferenceSlug={conference.slug} onDismiss={dismissDraftNotice} />
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
                hasUnseenSwap={unseenSwapSocietyIds.has(s.id)}
                onClick={() => handleExpandSociety(s.id)}
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
  const advisorPaidCount = advisors.filter(a => a.attending && a.payment_status === 'paid').length;
  const delegatePool = expandedMembers.filter(m => m.role === 'delegate' || m.role === 'head-delegate');
  // Head delegates keep counting toward every fill/accounting figure below, but
  // their own row is their home in the UI (F17), pulled out of the generic lists.
  const headDelegates = [...delegatePool.filter(isHeadDelegate)]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const nonHDPool = delegatePool.filter(m => !isHeadDelegate(m));
  const paidAttending = [...delegatePool.filter(m => m.attending && m.payment_status === 'paid')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const unpaidAttending = [...nonHDPool.filter(m => m.attending && m.payment_status === 'unpaid')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const waivedMembers = [...nonHDPool.filter(m => m.payment_status === 'waived')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const notAttendingMembers = [...nonHDPool.filter(m => !m.attending && m.payment_status !== 'waived')]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  const pledgingMembers = expandedMembers.filter(m => m.pledge_type);
  const openCount = Math.max(0, society.spots_purchased - paidAttending.length);

  const searchResults = searchQuery.trim()
    ? searchPool
        .filter(a => a.society_id !== society.id)
        .filter(a => (a.profiles?.display_name ?? a.invited_name ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const swapSource = swapConfirm ? members.find(m => m.id === swapConfirm.sourceId) ?? null : null;
  const swapTarget = swapConfirm ? members.find(m => m.id === swapConfirm.targetId) ?? null : null;

  return (
    <div>
      <DraftNoticeList notices={draftNotices} conferenceSlug={conference.slug} onDismiss={dismissDraftNotice} />
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

      {/* Advisors (F18) */}
      {advisors.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <SectionLabel>ADVISORS</SectionLabel>
            <span style={{ fontSize: 11, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
              {advisorPaidCount}/{society.advisor_spots_purchased} SPOTS
            </span>
          </div>
          <div className="mt-2">
            {advisors.map(a => {
              if (a.payment_status === 'waived') {
                return <WaivedChip key={a.id} member={a} onRemove={() => handleRemove(a, society.name)} />;
              }
              if (!a.attending) {
                return (
                  <NotAttendingChip
                    key={a.id}
                    member={a}
                    onUndo={() => handleUndoNotAttending(a)}
                    onRemove={() => handleRemove(a, society.name)}
                  />
                );
              }
              const paid = a.payment_status === 'paid';
              const name = a.profiles?.display_name ?? a.invited_name ?? 'Unknown';
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5"
                  style={{ backgroundColor: paid ? '#1B3828' : '#FAF8F3', border: `1.5px solid ${paid ? '#1B3828' : '#DDD4C0'}` }}
                >
                  <MemberAvatar name={name} url={a.profiles?.avatar_url ?? null} />
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ fontFamily: OUTFIT, color: paid ? '#EED98A' : '#1C1410' }}>
                    {name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: paid ? '#EED98A' : '#9A6B2F', fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0, opacity: paid ? 0.9 : 1 }}>
                    {paid ? 'PAID' : 'UNPAID'}
                  </span>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {paid && (
                      <button
                        onClick={() => setAdvisorTransferPicker(a)}
                        className="focus:outline-none"
                        style={{ fontSize: 10, fontWeight: 700, color: '#EED98A', fontFamily: MONO, letterSpacing: '0.04em', opacity: 0.85 }}
                      >
                        TRANSFER SPOT
                      </button>
                    )}
                    <button
                      onClick={() => handleNotAttending(a)}
                      className="focus:outline-none"
                      style={{ fontSize: 10, fontWeight: 700, color: paid ? '#EED98A' : '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em', opacity: paid ? 0.85 : 1 }}
                    >
                      NOT ATTENDING
                    </button>
                    <button
                      onClick={() => handleRemove(a, society.name)}
                      className="focus:outline-none"
                      style={{ fontSize: 10, fontWeight: 700, color: paid ? '#EED98A' : '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em', opacity: paid ? 0.85 : 1 }}
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Head delegates (F17), full delegate-pool members, own row */}
      {headDelegates.length > 0 && (
        <div className="mb-6">
          <SectionLabel>HEAD DELEGATES</SectionLabel>
          <div className="mt-2">
            {headDelegates.map(m => {
              if (m.payment_status === 'waived') {
                return <WaivedChip key={m.id} member={m} onRemove={() => handleRemove(m, society.name)} />;
              }
              if (!m.attending) {
                return (
                  <NotAttendingChip
                    key={m.id}
                    member={m}
                    onUndo={() => handleUndoNotAttending(m)}
                    onRemove={() => handleRemove(m, society.name)}
                  />
                );
              }
              if (m.payment_status === 'unpaid') {
                return (
                  <DraggableChip
                    key={m.id}
                    dataId={m.id}
                    name={m.profiles?.display_name ?? m.invited_name ?? 'Unknown'}
                    avatarUrl={m.profiles?.avatar_url ?? null}
                    subtitle="Head delegate"
                    selected={selectedMemberId === m.id}
                    onSelect={() => setSelectedMemberId(prev => (prev === m.id ? null : m.id))}
                    onNotAttending={() => handleNotAttending(m)}
                    onRemove={() => handleRemove(m, society.name)}
                    onDragStart={() => setDragMemberId(m.id)}
                    onDragEnd={() => { setDragMemberId(null); setDropTargetKey(null); }}
                  />
                );
              }
              // Paid, this card is informational; the actual paid slot they
              // occupy is the tagged HD entry in the right-hand ledger below.
              const name = m.profiles?.display_name ?? m.invited_name ?? 'Unknown';
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-1.5"
                  style={{ backgroundColor: '#1B3828', border: '1.5px solid #1B3828' }}
                >
                  <MemberAvatar name={name} url={m.profiles?.avatar_url ?? null} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#EED98A', fontFamily: OUTFIT }}>{name}</p>
                    {m.assigned_committee_id && (
                      <p className="text-xs truncate" style={{ color: 'rgba(238,217,138,0.7)', fontFamily: OUTFIT }}>
                        {m.assigned_committee?.abbreviation ?? m.assigned_committee?.name}, {m.assigned_country_name}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#EED98A', fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0, opacity: 0.9 }}>PAID</span>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <button
                      onClick={() => handleNotAttending(m)}
                      className="focus:outline-none"
                      style={{ fontSize: 10, fontWeight: 700, color: '#EED98A', fontFamily: MONO, letterSpacing: '0.04em', opacity: 0.85 }}
                    >
                      NOT ATTENDING
                    </button>
                    <button
                      onClick={() => handleRemove(m, society.name)}
                      className="focus:outline-none"
                      style={{ fontSize: 10, fontWeight: 700, color: '#EED98A', fontFamily: MONO, letterSpacing: '0.04em', opacity: 0.85 }}
                    >
                      REMOVE
                    </button>
                  </div>
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar name={m.profiles?.display_name ?? m.invited_name ?? 'Unknown'} url={m.profiles?.avatar_url ?? null} size={26} />
                  <p className="text-sm min-w-0 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    <span style={{ fontWeight: 700 }}>{m.profiles?.display_name ?? m.invited_name ?? 'Unknown'}</span> pledged: {pledgeText(m)}
                  </p>
                </div>
                {pledgeSatisfied(m) ? (
                  <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, color: '#3D7A52', fontFamily: MONO }}>
                    <Check size={13} /> COVERED
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

      {/* Two-column body, delegate pool only */}
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar name={a.profiles?.display_name ?? a.invited_name ?? 'Unknown'} url={a.profiles?.avatar_url ?? null} size={30} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{a.profiles?.display_name ?? a.invited_name ?? 'Unknown'}</p>
                      <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{a.societies?.name ?? 'Independent'}</p>
                    </div>
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
            <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em', marginLeft: 'auto' }}>
              DRAG OR CLICK, THEN CLICK A SPOT
            </span>
          </div>
          <div className="mt-2">
            {unpaidAttending.length === 0 ? (
              <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No unpaid delegates.</p>
            ) : (
              unpaidAttending.map(m => (
                <DraggableChip
                  key={m.id}
                  dataId={m.id}
                  name={m.profiles?.display_name ?? m.invited_name ?? 'Unknown'}
                  avatarUrl={m.profiles?.avatar_url ?? null}
                  selected={selectedMemberId === m.id}
                  onSelect={() => setSelectedMemberId(prev => (prev === m.id ? null : m.id))}
                  onNotAttending={() => handleNotAttending(m)}
                  onRemove={() => handleRemove(m, society.name)}
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
                {waivedMembers.map(m => (
                  <WaivedChip key={m.id} member={m} onRemove={() => handleRemove(m, society.name)} />
                ))}
              </div>
            </>
          )}

          {notAttendingMembers.length > 0 && (
            <div className="mt-5">
              <SectionLabel>NOT ATTENDING</SectionLabel>
              <div className="mt-2">
                {notAttendingMembers.map(m => (
                  <NotAttendingChip
                    key={m.id}
                    member={m}
                    onUndo={() => handleUndoNotAttending(m)}
                    onRemove={() => handleRemove(m, society.name)}
                  />
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
                hdTag={isHeadDelegate(m)}
                isDropTarget={dropTargetKey === `paid-${m.id}`}
                clickable={selectedMemberId !== null}
                onDragOver={() => { if (dragMemberId) setDropTargetKey(`paid-${m.id}`); }}
                onDragLeave={() => setDropTargetKey(prev => (prev === `paid-${m.id}` ? null : prev))}
                onDrop={sourceId => interactWithPaidSlot(m, sourceId)}
                onClickTarget={() => interactWithPaidSlot(m)}
                onNotAttending={() => handleNotAttending(m)}
                onRemove={() => handleRemove(m, society.name)}
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

      {advisorTransferPicker && (
        <AdvisorTransferModal
          advisor={advisorTransferPicker}
          pool={advisorPool}
          onClose={() => setAdvisorTransferPicker(null)}
          onPick={recipient => handleAdvisorTransfer(advisorTransferPicker, recipient)}
        />
      )}

      {confirmModal}
    </div>
  );
}
