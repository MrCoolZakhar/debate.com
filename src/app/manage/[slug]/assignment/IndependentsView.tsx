'use client';

// Independents tab — a flat card grid, one card per independent delegate.
// Deliberately not a clone of DelegationsView: there's no delegation to drag
// members into or out of, so there's no drag-and-drop and no expanded
// two-column view. Payment and allocation are fully decoupled here — the
// only thing this file ever does to an allocation is display it; it never
// reads it for logic, writes it, transfers it, or deletes it. TRANSFER SPOT
// / GIVE SPOT always call performSwap with transfer=false, so only
// payment_status ever moves. Allocation cleanup on NOT ATTENDING is the
// shared markNotAttending handler's existing behavior, not duplicated here.

import { useState, useEffect, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import {
  OUTFIT, MONO, POOL_MEMBER_SELECT,
  fetchSearchPool, performSwap, markNotAttending, undoNotAttending,
  MemberAvatar, ModalOverlay,
  type PoolMember, type SearchApp,
} from '@/app/manage/[slug]/assignment/delegationShared';

// ── Transfer / give-spot picker ─────────────────────────────────────────────
// Searchable list of the conference's accepted/assigned delegates and head
// delegates (any delegation or independent). Picking a name here only
// narrows down the recipient — the actual swap is confirmed via ConfirmModal
// by the caller.

function TransferSpotModal({
  holder, pool, onClose, onPick,
}: {
  holder: PoolMember; pool: SearchApp[]; onClose: () => void; onPick: (recipient: SearchApp) => void;
}) {
  const [query, setQuery] = useState('');
  const results = pool
    .filter(a => a.id !== holder.id)
    .filter(a => (a.profiles?.display_name ?? '').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="rounded-2xl p-6"
        style={{ width: 'min(92vw, 440px)', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(27,56,40,0.25)' }}
      >
        <h3 className="font-black text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Transfer spot</h3>
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Pick another accepted delegate or head delegate to receive {holder.profiles?.display_name ?? 'this delegate'}&apos;s paid spot.
        </p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search delegates..."
          autoFocus
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3"
          style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
        />
        <div className="flex flex-col gap-1.5" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No matches.</p>
          ) : results.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{a.profiles?.display_name ?? 'Unknown'}</p>
                <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{a.societies?.name ?? 'Independent'}</p>
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

// ── Card ─────────────────────────────────────────────────────────────────────

function badgeStyle(kind: 'paid' | 'unpaid' | 'waived') {
  if (kind === 'waived') return { backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.4)' };
  if (kind === 'paid') return { backgroundColor: 'rgba(61,122,82,0.14)', color: '#2A5A3C', border: '1px solid rgba(61,122,82,0.35)' };
  return { backgroundColor: 'rgba(182,135,31,0.14)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.4)' };
}

function ActionButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="focus:outline-none"
      style={{ fontSize: 9, fontWeight: 700, color: danger ? '#9A8A78' : '#1B3828', fontFamily: MONO, letterSpacing: '0.06em' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = danger ? '#8B2020' : '#2A5A3C'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = danger ? '#9A8A78' : '#1B3828'; }}
    >
      {label}
    </button>
  );
}

function IndependentCard({
  app, onTransfer, onNotAttending, onUndo,
}: {
  app: PoolMember;
  onTransfer: () => void;
  onNotAttending: () => void;
  onUndo: () => void;
}) {
  const name = app.profiles?.display_name ?? 'Unknown';
  const waived = app.payment_status === 'waived';
  const paid = app.payment_status === 'paid';
  const notAttending = !app.attending;
  const openSpot = paid && notAttending;
  const allocationLine = app.assigned_committee_id
    ? `${app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? 'Unknown committee'} — ${app.assigned_country_name}`
    : null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: waived ? 'rgba(184,132,74,0.06)' : '#FAF8F3',
        border: `1px solid ${waived ? 'rgba(184,132,74,0.3)' : '#DDD4C0'}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <MemberAvatar name={name} url={app.profiles?.avatar_url ?? null} size={30} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
          {notAttending && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.06em' }}>NOT ATTENDING</span>
          )}
        </div>
        {waived && <Lock size={13} style={{ color: '#9A6B2F', flexShrink: 0 }} />}
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded-full"
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, ...badgeStyle(waived ? 'waived' : paid ? 'paid' : 'unpaid') }}
        >
          {waived ? 'WAIVED' : paid ? 'PAID' : 'UNPAID'}
        </span>
      </div>

      {allocationLine && (
        <p className="text-xs truncate mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{allocationLine}</p>
      )}

      {openSpot && (
        <div className="mt-3 rounded-xl px-3 py-2" style={{ border: '1.5px dashed #DDD4C0' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.06em' }}>
            OPEN SPOT — held by {name}
          </p>
        </div>
      )}

      {!waived && (
        <div className="mt-3 flex items-center gap-4">
          {paid && !notAttending && <ActionButton label="TRANSFER SPOT" onClick={onTransfer} />}
          {openSpot && <ActionButton label="GIVE SPOT" onClick={onTransfer} />}
          {!notAttending && <ActionButton label="NOT ATTENDING" onClick={onNotAttending} danger />}
          {notAttending && <ActionButton label="UNDO" onClick={onUndo} />}
        </div>
      )}
    </div>
  );
}

// ── IndependentsView ─────────────────────────────────────────────────────────

interface IndependentsViewProps {
  conference: Conference;
  showFlash: (kind: 'ok' | 'err', msg: string) => void;
}

export default function IndependentsView({ conference, showFlash }: IndependentsViewProps) {
  const { session } = useAuth();
  const [independents, setIndependents] = useState<PoolMember[]>([]);
  const [searchPool, setSearchPool] = useState<SearchApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState<PoolMember | null>(null);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const loadData = useCallback(async () => {
    if (!conference || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [indepRes, search] = await Promise.all([
      supabase
        .from('applications')
        .select(POOL_MEMBER_SELECT)
        .eq('conference_id', conference.id)
        .eq('is_independent', true)
        .eq('role', 'delegate')
        .in('status', ['accepted', 'assigned']),
      fetchSearchPool(supabase, conference.id),
    ]);

    const list = ((indepRes.data ?? []) as unknown as PoolMember[])
      .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
    setIndependents(list);
    setSearchPool(search);
    setLoading(false);
  }, [conference, session?.access_token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Mutations ────────────────────────────────────────────────────────────

  async function handleTransferPicked(holder: PoolMember, recipient: SearchApp) {
    setTransferTarget(null);
    if (!session) return;
    const holderName = holder.profiles?.display_name ?? 'this delegate';
    const recipientName = recipient.profiles?.display_name ?? 'this delegate';
    const { confirmed } = await confirm({
      title: 'Transfer this spot?',
      body: `Transfer ${holderName}'s paid spot to ${recipientName}? ${holderName} will become unpaid.`,
      confirmLabel: 'Transfer',
    });
    if (!confirmed) return;

    const supabase = getAuthedClient(session.access_token);
    // transfer=false always — allocations are managed in the Delegates tab
    // and are never read, written, transferred, or deleted from this tab.
    const emailResult = await performSwap(supabase, conference.id, recipient, holder, false);
    if (!emailResult.incomingDrafted) pushDraftNotice('spot_received');
    if (!emailResult.outgoingDrafted) pushDraftNotice('spot_lost');
    showFlash('ok', 'Paid spot transferred.');
    await loadData();
  }

  async function handleNotAttending(app: PoolMember) {
    if (!session) return;
    const name = app.profiles?.display_name ?? 'this delegate';
    const hasAllocation = !!app.assigned_committee_id;
    const isPaid = app.payment_status === 'paid';
    const bodyParts: string[] = [];
    if (isPaid) bodyParts.push("Their paid spot stays theirs until you transfer it to someone else.");
    if (hasAllocation) bodyParts.push('Their committee assignment will be removed.');
    const { confirmed } = await confirm({
      title: `Mark ${name} as not attending?`,
      body: bodyParts.length > 0 ? bodyParts.join(' ') : `${name} will be marked not attending.`,
      confirmLabel: 'Mark Not Attending',
      danger: true,
    });
    if (!confirmed) return;

    const supabase = getAuthedClient(session.access_token);
    const result = await markNotAttending(supabase, conference.id, app);
    if (!result.drafted) pushDraftNotice('not_attending');
    await loadData();
  }

  async function handleUndoNotAttending(app: PoolMember) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const result = await undoNotAttending(supabase, conference.id, app);
    if (!result.drafted) pushDraftNotice('attendance_restored');
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <DraftNoticeList notices={draftNotices} conferenceSlug={conference.slug} onDismiss={dismissDraftNotice} />
      <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: '#9A8A78', fontFamily: MONO }}>INDEPENDENTS</p>
      <p className="text-sm mb-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Delegates applying without a school or society. Manage payment and attendance below — allocations are managed in the Delegates tab.
      </p>
      {independents.length === 0 ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No independent delegates yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {independents.map(app => (
            <IndependentCard
              key={app.id}
              app={app}
              onTransfer={() => setTransferTarget(app)}
              onNotAttending={() => handleNotAttending(app)}
              onUndo={() => handleUndoNotAttending(app)}
            />
          ))}
        </div>
      )}

      {transferTarget && (
        <TransferSpotModal
          holder={transferTarget}
          pool={searchPool}
          onClose={() => setTransferTarget(null)}
          onPick={recipient => handleTransferPicked(transferTarget, recipient)}
        />
      )}

      {confirmModal}
    </div>
  );
}
