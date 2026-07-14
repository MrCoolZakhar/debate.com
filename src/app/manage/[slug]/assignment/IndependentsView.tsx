'use client';

// Independents tab, a flat card grid, one card per independent delegate.
// Deliberately not a clone of DelegationsView: there's no delegation to drag
// members into or out of, so there's no drag-and-drop and no expanded
// two-column view. Payment and allocation are fully decoupled here, the
// only thing this file ever does to an allocation is display it; it never
// reads it for logic, writes it, transfers it, or deletes it. TRANSFER SPOT
// / GIVE SPOT always call performSwap with transfer=false, so only
// payment_status ever moves. Allocation cleanup on NOT ATTENDING is the
// shared markNotAttending handler's existing behavior, not duplicated here.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useConfirmModal } from '@/components/ConfirmModal';
import {
  OUTFIT, MONO, POOL_MEMBER_SELECT,
  fetchSearchPool, performSwap, markNotAttending, undoNotAttending, eligibleTransferRecipients,
  ModalOverlay,
  type PoolMember, type SearchApp,
} from '@/app/manage/[slug]/assignment/delegationShared';
import { PersonAvatar } from '@/app/manage/[slug]/assignment/page';
import { NEU, NeuCard, NeuInset, NeuButton } from '@/components/neu';

// ── Transfer / give-spot picker ─────────────────────────────────────────────
// Searchable list of the conference's accepted/assigned delegates and head
// delegates (any delegation or independent). Picking a name here only
// narrows down the recipient, the actual swap is confirmed via ConfirmModal
// by the caller.

function TransferSpotModal({
  holder, pool, onClose, onPick,
}: {
  holder: PoolMember; pool: SearchApp[]; onClose: () => void; onPick: (recipient: SearchApp) => void;
}) {
  const [query, setQuery] = useState('');
  // Only unpaid, attending candidates can meaningfully receive a paid spot —
  // waived or already-paid delegates have no use for it.
  const eligible = eligibleTransferRecipients(pool).filter(a => a.id !== holder.id);
  const results = eligible
    .filter(a => (a.profiles?.display_name ?? a.invited_name ?? '').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="p-6"
        style={{ width: 'min(92vw, 440px)', backgroundColor: NEU.surface, borderRadius: 24, maxHeight: '80vh', overflowY: 'auto', boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)` }}
      >
        <h3 className="font-black text-base mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Transfer spot</h3>
        <p className="text-xs mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Pick another accepted delegate or head delegate to receive {holder.profiles?.display_name ?? holder.invited_name ?? 'this delegate'}&apos;s paid spot.
        </p>
        <NeuInset className="mb-3 px-3.5 py-2.5" style={{ borderRadius: 999 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search delegates..."
            autoFocus
            className="w-full text-sm outline-none"
            style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT }}
          />
        </NeuInset>
        <div className="flex flex-col gap-1.5" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {eligible.length === 0 ? (
            <p className="text-xs py-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No unpaid delegates to receive this spot.</p>
          ) : results.length === 0 ? (
            <p className="text-xs py-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No matches.</p>
          ) : results.map(a => (
            <NeuInset key={a.id} small className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <PersonAvatar name={a.profiles?.display_name ?? a.invited_name ?? 'Unknown'} url={a.profiles?.avatar_url ?? null} size={30} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{a.profiles?.display_name ?? a.invited_name ?? 'Unknown'}</p>
                  <p className="text-xs truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{a.societies?.name ?? 'Independent'}</p>
                </div>
              </div>
              <NeuButton onClick={() => onPick(a)} style={{ padding: '7px 14px', fontSize: 10.5 }}>TRANSFER</NeuButton>
            </NeuInset>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 rounded-full py-2.5 font-bold text-sm focus:outline-none"
          style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: '0.04em' }}
        >
          CANCEL
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ActionButton({ label, onClick, danger, busy }: { label: string; onClick: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="focus:outline-none"
      style={{
        fontSize: 10, fontWeight: 800, color: danger ? NEU.muted : NEU.forest, fontFamily: MONO, letterSpacing: '0.06em',
        opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer',
      }}
      onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.color = danger ? '#8B2020' : NEU.green; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = danger ? NEU.muted : NEU.forest; }}
    >
      {busy ? '…' : label}
    </button>
  );
}

function IndependentCard({
  app, onTransfer, onNotAttending, onUndo, busy,
}: {
  app: PoolMember;
  onTransfer: () => void;
  onNotAttending: () => void;
  onUndo: () => void;
  busy?: boolean;
}) {
  const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
  const waived = app.payment_status === 'waived';
  const paid = app.payment_status === 'paid';
  const notAttending = !app.attending;
  const openSpot = paid && notAttending;
  const allocationLine = app.assigned_committee_id
    ? `${app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? 'Unknown committee'}, ${app.assigned_country_name}`
    : null;

  return (
    <NeuCard style={{ padding: 20, opacity: notAttending ? 0.75 : 1 }}>
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={name} url={app.profiles?.avatar_url ?? null} size={38} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{name}</p>
          {notAttending && (
            <span style={{ fontSize: 10, fontWeight: 800, color: NEU.muted, fontFamily: MONO, letterSpacing: '0.06em' }}>NOT ATTENDING</span>
          )}
        </div>
        {waived && <Lock size={14} style={{ color: '#9A6B2F', flexShrink: 0 }} />}
        <span
          className="flex-shrink-0 px-2.5 py-0.5 rounded-full"
          style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', fontFamily: OUTFIT, boxShadow: NEU.outSm, backgroundColor: NEU.surface, color: waived ? '#9A6B2F' : paid ? NEU.green : '#8A6614' }}
        >
          {waived ? 'WAIVED' : paid ? 'PAID' : 'UNPAID'}
        </span>
      </div>

      {allocationLine && (
        <p className="text-xs truncate mt-2.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{allocationLine}</p>
      )}

      {openSpot && (
        <NeuInset small className="mt-3 px-3 py-2">
          <p style={{ fontSize: 10, fontWeight: 800, color: NEU.muted, fontFamily: MONO, letterSpacing: '0.06em' }}>
            OPEN SPOT (held by {name})
          </p>
        </NeuInset>
      )}

      {!waived && (
        <div className="mt-3.5 flex items-center gap-4">
          {paid && !notAttending && <ActionButton label="TRANSFER SPOT" onClick={onTransfer} busy={busy} />}
          {openSpot && <ActionButton label="GIVE SPOT" onClick={onTransfer} busy={busy} />}
          {!notAttending && <ActionButton label="NOT ATTENDING" onClick={onNotAttending} danger busy={busy} />}
          {notAttending && <ActionButton label="UNDO" onClick={onUndo} busy={busy} />}
        </div>
      )}
    </NeuCard>
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

  // Monotonic guard so a slow older load never overwrites a newer one.
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference || !session) return;
    const seq = ++loadSeqRef.current;
    // silent: background refresh, keeps the card grid mounted (no spinner
    // wipe, scroll and open modals survive).
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [indepRes, search] = await Promise.all([
      supabase
        .from('applications')
        .select(POOL_MEMBER_SELECT)
        .eq('conference_id', conference.id)
        .is('society_id', null)
        .eq('role', 'delegate')
        .in('status', ['accepted', 'assigned']),
      fetchSearchPool(supabase, conference.id),
    ]);

    if (seq !== loadSeqRef.current) return; // stale response, a newer load superseded this one

    const list = ((indepRes.data ?? []) as unknown as PoolMember[])
      .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
    setIndependents(list);
    setSearchPool(search);
    setLoading(false);
  }, [conference, session?.access_token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Optimistic local patch helpers ─────────────────────────────────────────
  // Mutate exactly the affected card; rollbacks restore the exact snapshot.

  function patchIndependent(id: string, patch: Partial<PoolMember>) {
    setIndependents(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }
  function restoreIndependent(snapshot: PoolMember) {
    setIndependents(prev => prev.map(m => (m.id === snapshot.id ? snapshot : m)));
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  // Per-control double-click lock: one in-flight transfer per holder. Also
  // used as the busy set for not-attending/undo (disabled + guard).
  const inFlightTransferIds = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function handleTransferPicked(holder: PoolMember, recipient: SearchApp) {
    setTransferTarget(null);
    if (!session) return;
    if (inFlightTransferIds.current.has(holder.id)) return;
    const holderName = holder.profiles?.display_name ?? holder.invited_name ?? 'this delegate';
    const recipientName = recipient.profiles?.display_name ?? recipient.invited_name ?? 'this delegate';
    const { confirmed } = await confirm({
      title: 'Transfer this spot?',
      body: `Transfer ${holderName}'s paid spot to ${recipientName}? ${holderName} will become unpaid.`,
      confirmLabel: 'Transfer',
    });
    if (!confirmed) return;
    if (inFlightTransferIds.current.has(holder.id)) return;
    inFlightTransferIds.current.add(holder.id);

    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the holder's card flips to UNPAID at once. The recipient
    // may be an independent (patch their card too) or live in a delegation —
    // in that case the silent refetch reconciles the other tab's data.
    const holderSnapshot = independents.find(m => m.id === holder.id) ?? holder;
    const recipientSnapshot = independents.find(m => m.id === recipient.id) ?? null;
    patchIndependent(holder.id, { payment_status: 'unpaid', self_paid: false });
    if (recipientSnapshot) patchIndependent(recipient.id, { payment_status: 'paid', self_paid: false });
    showFlash('ok', 'Paid spot transferred.');

    const rollback = () => {
      restoreIndependent(holderSnapshot);
      if (recipientSnapshot) restoreIndependent(recipientSnapshot);
    };

    (async () => {
      // transfer=false always, allocations are managed in the Delegates tab
      // and are never read, written, transferred, or deleted from this tab.
      const emailResult = await performSwap(supabase, conference.id, recipient, holder, false);
      if (emailResult.error) {
        rollback();
        showFlash('err', 'Could not transfer this spot.');
        loadData({ silent: true }); // converge any partial writes
        return;
      }
      notifyIfNeeded(emailResult.incoming, pushDraftNotice);
      notifyIfNeeded(emailResult.outgoing, pushDraftNotice);
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not transfer this spot.');
    }).finally(() => inFlightTransferIds.current.delete(holder.id));
  }

  async function handleNotAttending(app: PoolMember) {
    if (!session || busyIds.has(app.id)) return;
    const name = app.profiles?.display_name ?? app.invited_name ?? 'this delegate';
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
    markBusy(app.id, true);

    // Optimistic: exactly what markNotAttending writes for this row.
    const snapshot = independents.find(m => m.id === app.id) ?? app;
    patchIndependent(app.id, {
      attending: false,
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      assigned_committee: null,
      status: app.status === 'assigned' ? 'accepted' : app.status,
    });

    (async () => {
      const result = await markNotAttending(supabase, conference.id, app);
      if (result.error) {
        restoreIndependent(snapshot);
        showFlash('err', `Could not mark ${name} as not attending.`);
        loadData({ silent: true });
        return;
      }
      notifyIfNeeded(result.result, pushDraftNotice);
      loadData({ silent: true });
    })().catch(() => {
      restoreIndependent(snapshot);
      showFlash('err', `Could not mark ${name} as not attending.`);
    }).finally(() => markBusy(app.id, false));
  }

  async function handleUndoNotAttending(app: PoolMember) {
    if (!session || busyIds.has(app.id)) return;
    const supabase = getAuthedClient(session.access_token);
    markBusy(app.id, true);

    // Optimistic: exactly what undoNotAttending writes for this row.
    const snapshot = independents.find(m => m.id === app.id) ?? app;
    patchIndependent(app.id, { attending: true, payment_status: 'unpaid' });

    (async () => {
      const result = await undoNotAttending(supabase, conference.id, app);
      if (result.error) {
        restoreIndependent(snapshot);
        showFlash('err', 'Could not restore attendance.');
        loadData({ silent: true });
        return;
      }
      notifyIfNeeded(result.result, pushDraftNotice);
      loadData({ silent: true });
    })().catch(() => {
      restoreIndependent(snapshot);
      showFlash('err', 'Could not restore attendance.');
    }).finally(() => markBusy(app.id, false));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <DraftNoticeList
        notices={draftNotices}
        conferenceSlug={conference.slug}
        onDismiss={dismissDraftNotice}
        onTurnOn={async (eventKey) => {
          if (!session) return;
          const supabase = getAuthedClient(session.access_token);
          await turnOnDefaultEmail(supabase, conference.id, eventKey);
        }}
      />
      <p className="text-xs font-bold tracking-widest mb-1" style={{ color: NEU.deepGold, fontFamily: MONO }}>INDEPENDENTS</p>
      <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Delegates applying without a high school or society. Manage payment and attendance below; allocations are managed in the Delegates tab.
      </p>
      {independents.length === 0 ? (
        <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No independent delegates yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {independents.map(app => (
            <IndependentCard
              key={app.id}
              app={app}
              busy={busyIds.has(app.id)}
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
