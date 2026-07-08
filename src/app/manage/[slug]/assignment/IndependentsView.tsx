'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import {
  OUTFIT, MONO, POOL_MEMBER_SELECT,
  fetchSearchPool, performSwap, markApplicationPaid, markNotAttending, undoNotAttending,
  SectionLabel, MemberAvatar, DraggableChip, WaivedChip, NotAttendingChip, PaidSlotChip, OpenSlot, SwapConfirmModal,
  type PoolMember, type SearchApp,
} from '@/app/manage/[slug]/assignment/delegationShared';

// ── Card grid ────────────────────────────────────────────────────────────────

function IndependentCard({ app, onClick }: { app: PoolMember; onClick: () => void }) {
  const name = app.profiles?.display_name ?? 'Unknown';
  const paid = app.payment_status === 'paid';
  const waived = app.payment_status === 'waived';

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-5 transition-colors focus:outline-none"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
    >
      <div className="flex items-center gap-2.5">
        <MemberAvatar name={name} url={app.profiles?.avatar_url ?? null} size={30} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</p>
          {!app.attending && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.06em' }}>NOT ATTENDING</span>
          )}
        </div>
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded-full"
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT,
            backgroundColor: waived ? 'rgba(184,132,74,0.16)' : paid ? 'rgba(61,122,82,0.14)' : 'rgba(182,135,31,0.14)',
            color: waived ? '#9A6B2F' : paid ? '#2A5A3C' : '#8A6614',
            border: `1px solid ${waived ? 'rgba(184,132,74,0.4)' : paid ? 'rgba(61,122,82,0.35)' : 'rgba(182,135,31,0.4)'}`,
          }}
        >
          {waived ? 'WAIVED' : paid ? 'PAID' : 'UNPAID'}
        </span>
      </div>
      {app.assigned_committee_id && (
        <p className="text-xs truncate mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          {app.assigned_committee?.abbreviation ?? app.assigned_committee?.name} — {app.assigned_country_name}
        </p>
      )}
    </button>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<'paid' | 'open' | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<{ source: SearchApp; target: PoolMember } | null>(null);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();

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

  const expandedApp = expandedId ? independents.find(a => a.id === expandedId) ?? null : null;

  // ── Mutations ────────────────────────────────────────────────────────────

  async function handleGiveOpenSpot(sourceId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await markApplicationPaid(supabase, sourceId);
    showFlash('ok', 'Delegate marked paid.');
    await loadData();
  }

  async function handleSwap(source: SearchApp, target: PoolMember, transfer: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const emailResult = await performSwap(supabase, conference.id, source, target, transfer);
    if (!emailResult.incomingDrafted) pushDraftNotice('spot_received');
    if (!emailResult.outgoingDrafted) pushDraftNotice('spot_lost');
    setSwapConfirm(null);
    showFlash('ok', 'Delegates switched.');
    await loadData();
  }

  async function handleNotAttending(app: PoolMember) {
    if (!session) return;
    const name = app.profiles?.display_name ?? 'this delegate';
    const hasAllocation = !!app.assigned_committee_id;
    let msg = `Mark ${name} as not attending? Their spot survives them as an open spot.`;
    if (hasAllocation) msg += ' Their committee assignment will be removed.';
    if (!window.confirm(msg)) return;

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

  // ── Drop / click-target dispatch ──────────────────────────────────────────

  function interactWithPaidSlot(target: PoolMember, draggedId?: string) {
    const sourceId = draggedId || selectedSourceId;
    setDropTargetKey(null);
    setDragSourceId(null);
    setSelectedSourceId(null);
    if (!sourceId) return;
    const source = searchPool.find(a => a.id === sourceId);
    if (!source) return;
    setSwapConfirm({ source, target });
  }

  function interactWithOpenSlot(draggedId?: string) {
    const sourceId = draggedId || selectedSourceId;
    setDropTargetKey(null);
    setDragSourceId(null);
    setSelectedSourceId(null);
    if (!sourceId) return;
    const source = searchPool.find(a => a.id === sourceId);
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

  if (!expandedApp) {
    return (
      <div>
        <DraftNoticeList notices={draftNotices} conferenceSlug={conference.slug} onDismiss={dismissDraftNotice} />
        <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: '#9A8A78', fontFamily: MONO }}>INDEPENDENTS</p>
        <p className="text-sm mb-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Delegates applying without a school or society. Click one to manage payment, attendance and allocation.
        </p>
        {independents.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No independent delegates yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {independents.map(app => (
              <IndependentCard key={app.id} app={app} onClick={() => setExpandedId(app.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Expanded view — pool of exactly one ───────────────────────────────────

  const app = expandedApp;
  const name = app.profiles?.display_name ?? 'Unknown';
  const searchResults = searchQuery.trim()
    ? searchPool
        .filter(a => a.id !== app.id)
        .filter(a => (a.profiles?.display_name ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div>
      <DraftNoticeList notices={draftNotices} conferenceSlug={conference.slug} onDismiss={dismissDraftNotice} />
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setExpandedId(null); setSelectedSourceId(null); setSearchQuery(''); }}
          className="flex items-center gap-1 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
          style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <ChevronLeft size={14} /> BACK
        </button>
        <h2 className="font-black text-xl truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — search for a substitute */}
        <div>
          <SectionLabel>FIND A SUBSTITUTE</SectionLabel>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mt-2 mb-2" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search all applicants..."
              className="flex-1 text-sm outline-none"
              style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT }}
            />
          </div>
          {searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No matches.</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-2">
              <span style={{ fontSize: 9, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}>
                DRAG OR CLICK, THEN CLICK THE SPOT
              </span>
              <div className="mt-2">
                {searchResults.map(a => (
                  <DraggableChip
                    key={a.id}
                    dataId={a.id}
                    name={a.profiles?.display_name ?? 'Unknown'}
                    avatarUrl={null}
                    subtitle={a.societies?.name ?? 'Independent'}
                    selected={selectedSourceId === a.id}
                    onSelect={() => setSelectedSourceId(prev => (prev === a.id ? null : a.id))}
                    onDragStart={() => setDragSourceId(a.id)}
                    onDragEnd={() => { setDragSourceId(null); setDropTargetKey(null); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — the one-person pool */}
        <div>
          <SectionLabel>SPOT</SectionLabel>
          <div className="mt-2">
            {app.payment_status === 'waived' ? (
              <WaivedChip member={app} />
            ) : !app.attending ? (
              <>
                {app.payment_status === 'paid' && (
                  <OpenSlot
                    isDropTarget={dropTargetKey === 'open'}
                    clickable={selectedSourceId !== null}
                    onDragOver={() => { if (dragSourceId) setDropTargetKey('open'); }}
                    onDragLeave={() => setDropTargetKey(prev => (prev === 'open' ? null : prev))}
                    onDrop={sourceId => interactWithOpenSlot(sourceId)}
                    onClickTarget={() => interactWithOpenSlot()}
                  />
                )}
                <NotAttendingChip member={app} onUndo={() => handleUndoNotAttending(app)} />
              </>
            ) : app.payment_status === 'paid' ? (
              <PaidSlotChip
                member={app}
                isDropTarget={dropTargetKey === 'paid'}
                clickable={selectedSourceId !== null}
                onDragOver={() => { if (dragSourceId) setDropTargetKey('paid'); }}
                onDragLeave={() => setDropTargetKey(prev => (prev === 'paid' ? null : prev))}
                onDrop={sourceId => interactWithPaidSlot(app, sourceId)}
                onClickTarget={() => interactWithPaidSlot(app)}
                onNotAttending={() => handleNotAttending(app)}
              />
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9A6B2F', fontFamily: MONO, letterSpacing: '0.06em' }}>UNPAID</span>
                <button
                  onClick={() => handleNotAttending(app)}
                  className="focus:outline-none"
                  style={{ fontSize: 9, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.04em' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                >
                  NOT ATTENDING
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {swapConfirm && (
        <SwapConfirmModal
          source={swapConfirm.source}
          target={swapConfirm.target}
          onCancel={() => setSwapConfirm(null)}
          onConfirm={transfer => handleSwap(swapConfirm.source, swapConfirm.target, transfer)}
        />
      )}
    </div>
  );
}
