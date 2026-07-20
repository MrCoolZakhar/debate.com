'use client';

// Delegation panel, shared between the advisor view and the head-delegate
// view (rendered below their own R2 delegate view). Read-only-style mirror
// of the organizer's delegation view: advisors row, head delegates row,
// delegates list, paid-spots counter, pledges block, plus the allocation
// swap control (item C). Visibility of every row here is granted by the
// "Members read society leadership" / "Leaders read society members" RLS
// policies (leaders, advisors/head-delegates, read the whole roster; any
// member reads just the leaders) via the my_society_ids()/is_society_leader()
// SECURITY DEFINER helpers, so this just works with the viewer's own authed
// client.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { FlagImg } from '@/components/FlagImg';
import { useConfirmModal } from '@/components/ConfirmModal';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { queueEventEmail } from '@/lib/emailEvents';
import {
  POOL_MEMBER_SELECT, pledgeSatisfied, pledgeText, MemberAvatar,
  type PoolMember,
} from '@/app/manage/[slug]/assignment/delegationShared';
import { SectionCard, OUTFIT, CHIP_STYLES, derivePaymentChip, formatReleaseDate } from './shared';

interface Society {
  id: string;
  name: string;
  spots_purchased: number;
}

// A swap_request or swap_notice row on conference_requests, the shape both
// the pending banner and the recent-notice line read from.
interface SwapActivityRow {
  id: string;
  user_id: string;
  created_at: string;
  metadata: { society_id?: string; member_a?: string; member_b?: string };
}

// "A few days" window for the quiet completed-swap notice.
const RECENT_SWAP_NOTICE_MS = 3 * 24 * 60 * 60 * 1000;

function allocationLabel(m: PoolMember): string | null {
  if (!m.assigned_committee_id) return null;
  return `${m.assigned_committee?.abbreviation ?? m.assigned_committee?.name ?? 'Committee'}: ${m.assigned_country_name}`;
}

function pledgeStatusLabel(m: PoolMember): string {
  return pledgeSatisfied(m) ? 'covered ✓' : 'pending';
}

// ── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, swapMode, swapSelectable, swapSelected, onToggleSwap, covered }: {
  member: PoolMember;
  swapMode: boolean;
  swapSelectable: boolean;
  swapSelected: boolean;
  onToggleSwap: () => void;
  covered?: boolean;
}) {
  const name = member.profiles?.display_name ?? 'Unknown';
  const chip = derivePaymentChip(member.payment_status ?? 'unpaid', !!member.self_paid, 0);
  const alloc = allocationLabel(member);
  const dimmed = member.attending === false;

  return (
    <div
      onClick={() => { if (swapMode && swapSelectable) onToggleSwap(); }}
      className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{
        backgroundColor: swapSelected ? 'rgba(61,122,82,0.08)' : '#FAF8F3',
        border: `1.5px solid ${swapSelected ? '#1B3828' : '#DDD4C0'}`,
        opacity: dimmed ? 0.55 : swapMode && !swapSelectable ? 0.45 : 1,
        cursor: swapMode && swapSelectable ? 'pointer' : 'default',
      }}
      title={swapMode && !swapSelectable ? 'No allocation yet, not swappable' : undefined}
    >
      {covered && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/gavel-mark.png"
          alt=""
          title="Gavelling Credit Covered"
          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, objectFit: 'contain' }}
        />
      )}
      <div className="relative flex-shrink-0">
        <MemberAvatar name={name} url={member.profiles?.avatar_url ?? null} size={28} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
          {member.is_head_delegate && member.role === 'delegate' && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-full"
              style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: OUTFIT }}
            >
              HD
            </span>
          )}
          {dimmed && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.05em' }}>
              NOT ATTENDING
            </span>
          )}
        </div>
        {alloc && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {member.assigned_country_code && <FlagImg code={member.assigned_country_code} size={13} />}
            <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{alloc}</p>
          </div>
        )}
      </div>
      {!dimmed && (
        <span
          className="px-2.5 py-0.5 rounded-full flex-shrink-0"
          style={{ ...CHIP_STYLES[chip], fontSize: '9px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
        >
          {chip}
        </span>
      )}
      {swapMode && (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 18, height: 18, borderRadius: '9999px',
            border: `1.5px solid ${swapSelected ? '#1B3828' : '#DDD4C0'}`,
            backgroundColor: swapSelected ? '#1B3828' : 'transparent',
          }}
        >
          {swapSelected && <span style={{ width: 7, height: 7, borderRadius: '9999px', backgroundColor: '#EED98A' }} />}
        </div>
      )}
    </div>
  );
}

// ── Swap result modal ───────────────────────────────────────────────────────
// One-button acknowledgement, same ivory/forest card recipe as the shared
// ConfirmModal, used after both a self-serve swap and a swap request so the
// leader gets visible confirmation instead of the panel just quietly
// resetting (self-serve swaps do execute, but with no on-screen feedback the
// action reads as a no-op).

interface SwapResultInfo {
  title: string;
  body: string;
  detail?: string;
}

function SwapResultModal({ info, onClose }: { info: SwapResultInfo; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400, maxWidth: '90vw' }}
      >
        <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{info.title}</p>
        <div style={{ color: '#4A4238', fontFamily: OUTFIT, lineHeight: 1.55 }}>
          <p className="text-sm">{info.body}</p>
          {info.detail && <p className="text-sm mt-1.5">{info.detail}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl py-2.5 font-bold text-sm focus:outline-none"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT, cursor: 'pointer' }}
        >
          DONE
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export interface DelegationPanelProps {
  conferenceId: string;
  societyId: string;
  allocationSwapMode: string;
}

export default function DelegationPanel({ conferenceId, societyId, allocationSwapMode }: DelegationPanelProps) {
  const { user, session } = useAuth();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [society, setSociety] = useState<Society | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [coveredIds, setCoveredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<string[]>([]);
  const [swapError, setSwapError] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<SwapResultInfo | null>(null);
  const [pendingSwapRequest, setPendingSwapRequest] = useState<SwapActivityRow | null>(null);
  const [recentSwapNotice, setRecentSwapNotice] = useState<SwapActivityRow | null>(null);

  const load = useCallback(async () => {
    if (!societyId || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data: societyRow }, { data: memberRows }, { data: coveredRows }] = await Promise.all([
      supabase.from('societies').select('id, name, spots_purchased').eq('id', societyId).maybeSingle(),
      supabase.from('applications').select(POOL_MEMBER_SELECT).eq('society_id', societyId).in('status', ['accepted', 'assigned']),
      supabase.rpc('society_credit_covered_apps', { p_society: societyId }),
    ]);
    setSociety((societyRow as Society | null) ?? null);
    setMembers((memberRows ?? []) as unknown as PoolMember[]);
    setCoveredIds(new Set((coveredRows ?? []) as string[]));
    setLoading(false);
  }, [societyId, session]);

  useEffect(() => { load(); }, [load]);

  // The delegation's swap activity, an open swap_request plus the most recent
  // swap_notice. RLS now lets any leader of this society read
  // conference_requests rows (and their messages) of kind 'swap_request' or
  // 'swap_notice' whose metadata->>'society_id' matches their society, so
  // every leader sees the same state, not just whoever sent it.
  const loadSwapActivity = useCallback(async () => {
    if (!societyId || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const [{ data: reqData }, { data: noticeData }] = await Promise.all([
      supabase
        .from('conference_requests')
        .select('id, user_id, created_at, metadata')
        .eq('conference_id', conferenceId)
        .eq('kind', 'swap_request')
        .eq('status', 'open')
        .eq('metadata->>society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('conference_requests')
        .select('id, user_id, created_at, metadata')
        .eq('conference_id', conferenceId)
        .eq('kind', 'swap_notice')
        .eq('metadata->>society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPendingSwapRequest((reqData as SwapActivityRow | null) ?? null);
    const notice = (noticeData as SwapActivityRow | null) ?? null;
    setRecentSwapNotice(
      notice && Date.now() - new Date(notice.created_at).getTime() < RECENT_SWAP_NOTICE_MS ? notice : null
    );
  }, [societyId, conferenceId, session]);

  useEffect(() => { loadSwapActivity(); }, [loadSwapActivity]);

  const advisors = useMemo(() => members.filter(m => m.role === 'faculty-advisor'), [members]);
  const headDelegates = useMemo(() => members.filter(m => m.role === 'head-delegate'), [members]);
  const delegates = useMemo(() => members.filter(m => m.role === 'delegate'), [members]);
  const delegatePool = useMemo(() => members.filter(m => m.role === 'delegate' || m.role === 'head-delegate'), [members]);
  const paidCount = delegatePool.filter(m => m.payment_status === 'paid').length;
  const pledgingMembers = useMemo(() => members.filter(m => !!m.pledge_type), [members]);

  function toggleSwapSelect(memberId: string) {
    setSwapError('');
    setSwapSelection(prev => {
      if (prev.includes(memberId)) return prev.filter(id => id !== memberId);
      if (prev.length >= 2) return prev;
      return [...prev, memberId];
    });
  }

  const swapA = swapSelection[0] ? members.find(m => m.id === swapSelection[0]) ?? null : null;
  const swapB = swapSelection[1] ? members.find(m => m.id === swapSelection[1]) ?? null : null;

  async function handleConfirmSwap() {
    if (!swapA || !swapB || !session || !user) return;
    const nameA = swapA.profiles?.display_name ?? 'Member A';
    const nameB = swapB.profiles?.display_name ?? 'Member B';
    const allocA = allocationLabel(swapA) ?? 'their allocation';
    const allocB = allocationLabel(swapB) ?? 'their allocation';

    const { confirmed } = await confirm({
      title: 'Swap allocations?',
      body: `${nameA}: ${allocA} ↔ ${nameB}: ${allocB}`,
      confirmLabel: allocationSwapMode === 'self_serve' ? 'Swap' : 'Request Swap',
    });
    if (!confirmed) return;

    setSwapping(true);
    setSwapError('');
    const supabase = getAuthedClient(session.access_token);
    const subject = `Allocation swap in ${society?.name ?? 'this delegation'}`;
    const metadata = {
      society_id: societyId,
      app_a: swapA.id, app_b: swapB.id,
      member_a: nameA, member_b: nameB,
      before: { a: allocA, b: allocB },
      after: { a: allocB, b: allocA },
    };

    if (allocationSwapMode === 'self_serve') {
      const { data, error } = await supabase.rpc('perform_delegation_swap', { p_app_a: swapA.id, p_app_b: swapB.id });
      if (error) { setSwapError(error.message || 'Could not swap allocations.'); setSwapping(false); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { setSwapError(result.error ?? 'Could not swap allocations.'); setSwapping(false); return; }

      const { data: reqRow } = await supabase.from('conference_requests').insert({
        conference_id: conferenceId, user_id: user.id, kind: 'swap_notice', subject, metadata,
      }).select('id').single();
      if (reqRow) {
        await supabase.from('conference_request_messages').insert({
          request_id: (reqRow as { id: string }).id, sender_user_id: user.id, is_organizer: false,
          body: `${nameA} and ${nameB} swapped allocations: ${nameA} is now ${allocB}, ${nameB} is now ${allocA}.`,
        });
      }
      // NOTE: queueEventEmail reads email_templates and writes email_outbox,
      // both organizer-only under current RLS ("Organizers manage email
      // templates/outbox"). Calling it here from a leader's (non-organizer)
      // session will silently no-op (template lookup returns nothing, so it
      // returns { drafted: false } without ever attempting the insert). This
      // is a known, reported gap, not worked around, pending either a
      // SECURITY DEFINER queue-email RPC or a scoped outbox insert policy
      // for society leaders.
      await queueEventEmail(supabase, conferenceId, 'delegation_swap', [swapA.id, swapB.id]);

      setSwapMode(false);
      setSwapSelection([]);
      // Refresh the allocation list and swap activity BEFORE showing the
      // confirmation, so dismissing the modal reveals the already-updated
      // state rather than the old one flashing in behind it.
      await Promise.all([load(), loadSwapActivity()]);
      setSwapping(false);
      setSwapResult({ title: 'Allocations swapped', body: `${nameA} is now ${allocB}, and ${nameB} is now ${allocA}.` });
    } else {
      const { data: reqRow, error } = await supabase.from('conference_requests').insert({
        conference_id: conferenceId, user_id: user.id, kind: 'swap_request', subject, metadata,
      }).select('id').single();
      if (error || !reqRow) { setSwapError(error?.message ?? 'Could not send the swap request.'); setSwapping(false); return; }
      await supabase.from('conference_request_messages').insert({
        request_id: (reqRow as { id: string }).id, sender_user_id: user.id, is_organizer: false,
        body: `Requesting to swap allocations: ${nameA} (${allocA}) ↔ ${nameB} (${allocB}).`,
      });
      // See NOTE above, same organizer-only RLS gap applies to request mode.
      await queueEventEmail(supabase, conferenceId, 'delegation_swap', [swapA.id, swapB.id]);

      setSwapMode(false);
      setSwapSelection([]);
      await loadSwapActivity();
      setSwapping(false);
      setSwapResult({
        title: 'Swap requested',
        body: "An allocation swap has been requested to the conference's organizers.",
        detail: `${nameA} and ${nameB}.`,
      });
    }
  }

  const pendingRequesterName = pendingSwapRequest
    ? members.find(m => m.user_id === pendingSwapRequest.user_id)?.profiles?.display_name ?? 'A delegation leader'
    : null;

  if (loading) {
    return (
      <SectionCard>
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          DELEGATION
        </p>
        <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Paid spots: <span style={{ fontWeight: 700, color: '#1C1410' }}>{paidCount}/{society?.spots_purchased ?? 0}</span>
        </p>
      </div>
      <p className="font-bold text-[17px] mb-5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {society?.name ?? 'Delegation'}
      </p>

      {pendingSwapRequest && (
        <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 mb-4" style={{ backgroundColor: 'rgba(238,217,138,0.16)', border: '1px solid rgba(182,135,31,0.3)' }}>
          <ArrowLeftRight size={14} style={{ color: '#8A6614', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
              A swap of {pendingSwapRequest.metadata.member_a ?? 'a delegate'} and {pendingSwapRequest.metadata.member_b ?? 'a delegate'} is awaiting the organizing team.
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Requested by {pendingRequesterName} on {formatReleaseDate(new Date(pendingSwapRequest.created_at).getTime())}.
            </p>
          </div>
        </div>
      )}

      {recentSwapNotice && (
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          {recentSwapNotice.metadata.member_a ?? 'A delegate'} and {recentSwapNotice.metadata.member_b ?? 'a delegate'} swapped allocations on {formatReleaseDate(new Date(recentSwapNotice.created_at).getTime())}.
        </p>
      )}

      {advisors.length > 0 && (
        <div className="mb-5">
          <p className="mb-2" style={{ fontSize: 9, fontWeight: 700, color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>ADVISORS</p>
          <div className="flex flex-col gap-1.5">
            {advisors.map(m => (
              <MemberRow key={m.id} member={m} swapMode={false} swapSelectable={false} swapSelected={false} onToggleSwap={() => {}} />
            ))}
          </div>
        </div>
      )}

      {headDelegates.length > 0 && (
        <div className="mb-5">
          <p className="mb-2" style={{ fontSize: 9, fontWeight: 700, color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>HEAD DELEGATES</p>
          <div className="flex flex-col gap-1.5">
            {headDelegates.map(m => (
              <MemberRow
                key={m.id} member={m} swapMode={swapMode}
                swapSelectable={!!m.assigned_committee_id}
                swapSelected={swapSelection.includes(m.id)}
                onToggleSwap={() => toggleSwapSelect(m.id)}
                covered={coveredIds.has(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2" style={{ fontSize: 9, fontWeight: 700, color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>DELEGATES</p>
        {delegates.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No delegates yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {delegates.map(m => (
              <MemberRow
                key={m.id} member={m} swapMode={swapMode}
                swapSelectable={!!m.assigned_committee_id}
                swapSelected={swapSelection.includes(m.id)}
                onToggleSwap={() => toggleSwapSelect(m.id)}
                covered={coveredIds.has(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {pledgingMembers.length > 0 && (
        <div className="mb-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          <p className="mb-2" style={{ fontSize: 9, fontWeight: 700, color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>PLEDGES</p>
          <div className="flex flex-col gap-1">
            {pledgingMembers.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 py-1">
                <span className="text-xs truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  {m.profiles?.display_name ?? 'Unknown'} <span style={{ color: '#9A8A78' }}>· {pledgeText(m)}</span>
                </span>
                <span
                  className="flex-shrink-0"
                  style={{ fontSize: 11, fontWeight: 700, fontFamily: OUTFIT, color: pledgeSatisfied(m) ? '#3D7A52' : '#B8844A' }}
                >
                  {pledgeStatusLabel(m)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allocationSwapMode !== 'off' && (
        <div className="pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
          {!swapMode ? (
            <button
              onClick={() => { setSwapMode(true); setSwapSelection([]); setSwapError(''); }}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none transition-colors"
              style={{ border: '1.5px solid rgba(27,56,40,0.35)', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; }}
            >
              <ArrowLeftRight size={13} /> SWAP ALLOCATIONS
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Select two allocated members to swap.
                </p>
                <button
                  onClick={() => { setSwapMode(false); setSwapSelection([]); setSwapError(''); }}
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: '#9A8A78' }}
                >
                  <X size={15} />
                </button>
              </div>
              {swapA && swapB && (
                <div className="rounded-xl px-3.5 py-2.5 mb-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
                  <p className="text-xs mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
                    {swapA.profiles?.display_name}: {allocationLabel(swapA)} ↔ {swapB.profiles?.display_name}: {allocationLabel(swapB)}
                  </p>
                  <button
                    onClick={handleConfirmSwap}
                    disabled={swapping}
                    className="rounded-lg px-4 py-2 text-xs font-bold focus:outline-none"
                    style={{ backgroundColor: swapping ? '#DDD4C0' : '#1B3828', color: swapping ? '#9A8A78' : '#EED98A', border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em', cursor: swapping ? 'default' : 'pointer' }}
                  >
                    {swapping ? 'PROCESSING...' : allocationSwapMode === 'self_serve' ? 'CONFIRM SWAP' : 'CONFIRM REQUEST'}
                  </button>
                </div>
              )}
              {swapError && <p className="text-xs mb-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{swapError}</p>}
            </div>
          )}
        </div>
      )}

      {confirmModal}
      {swapResult && <SwapResultModal info={swapResult} onClose={() => setSwapResult(null)} />}
    </SectionCard>
  );
}
