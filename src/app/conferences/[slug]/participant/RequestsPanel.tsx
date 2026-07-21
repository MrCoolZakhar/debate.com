'use client';

// Questions & Requests, never gated. Participant's own conference_requests
// threads across every kind (question / swap_request / swap_notice), plus a
// delegation leader's society-wide swap threads (any leader sees the same
// state, not just whoever sent it — RLS permits this). List -> new-request
// form or thread view; only 'question' threads take a reply (swap threads
// are read-only here, no attachments).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, ChevronLeft, ChevronRight, Plus, Send, ArrowLeftRight, BadgeCheck, CalendarDays, ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuInset, NeuIconDisc, NeuButton } from '@/components/neu';
import { FilterPopoverShell, FilterGroup, FilterHeading, toggleIn } from '@/components/FilterPopover';
import { DatePicker } from '@/components/DatePicker';
import type { ParticipantApplication } from './types';

const MONO = "'DM Mono', monospace";
const PAGE_SIZE = 5;

interface SwapMetadata {
  society_id?: string;
  app_a?: string;
  app_b?: string;
  member_a?: string;
  member_b?: string;
  before?: { a?: string; b?: string };
  after?: { a?: string; b?: string };
}

interface RequestRow {
  id: string;
  kind: string;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
  user_id: string;
  metadata: SwapMetadata;
  participant_seen_at: string | null;
}

interface RequestMessageRow {
  id: string;
  request_id: string;
  sender_user_id: string;
  is_organizer: boolean;
  body: string;
  created_at: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Same kind/status colour language as the organizer inbox (communications/page.tsx).
const KIND_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  question: { label: 'QUESTION', bg: 'rgba(27,56,40,0.08)', color: '#1B3828' },
  swap_request: { label: 'SWAP REQUEST', bg: 'rgba(182,135,31,0.16)', color: '#8A6614' },
  swap_notice: { label: 'SWAP', bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: 'OPEN', bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  closed: { label: 'CLOSED', bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

const STATE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const KIND_FILTER_OPTIONS = [
  { value: 'question', label: 'Question' },
  { value: 'swap_request', label: 'Swap request' },
  { value: 'swap_notice', label: 'Swap' },
];

const NOTE_TONES = {
  amber: { color: '#B8844A', bg: 'rgba(184,132,74,0.1)', border: 'rgba(184,132,74,0.24)' },
  muted: { color: '#6E5F4E', bg: 'rgba(154,138,120,0.1)', border: 'rgba(154,138,120,0.24)' },
} as const;

function Note({ tone, icon: Icon, children }: { tone: keyof typeof NOTE_TONES; icon?: typeof ArrowLeftRight; children: React.ReactNode }) {
  const t = NOTE_TONES[tone];
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-4 py-3"
      style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
    >
      {Icon && <Icon size={14} style={{ color: t.color, flexShrink: 0, marginTop: 1 }} />}
      <p className="text-[13px]" style={{ color: t.color, fontFamily: OUTFIT, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    border: 'none', borderRadius: 12, backgroundColor: NEU.base, boxShadow: NEU.inSm,
    color: NEU.ink, fontFamily: OUTFIT, outline: 'none',
  };
}

// Compact pager, extruded arrows that press in (NEU.inSm) once disabled —
// the same "pressed = inactive" idiom NeuChecklistRow uses for done rows.
function Pager({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  const arrowStyle = (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 999, border: 'none',
    backgroundColor: NEU.surface,
    boxShadow: disabled ? NEU.inSm : NEU.outSm,
    color: disabled ? NEU.muted : NEU.ink,
    cursor: disabled ? 'default' : 'pointer',
  });
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button onClick={onPrev} disabled={page <= 1} className="flex items-center justify-center focus:outline-none" style={arrowStyle(page <= 1)}>
        <ChevronLeft size={14} />
      </button>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
        PAGE {page} OF {totalPages}
      </span>
      <button onClick={onNext} disabled={page >= totalPages} className="flex items-center justify-center focus:outline-none" style={arrowStyle(page >= totalPages)}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default function RequestsPanel({ conferenceId, applicationId, myApplications }: {
  conferenceId: string;
  applicationId: string | null;
  myApplications: ParticipantApplication[];
}) {
  const { user, session } = useAuth();

  // Delegation leader = any of the user's own applications here that's a
  // non-rejected/withdrawn head-delegate/faculty-advisor with a society —
  // same rule the pay page and DelegationPanel use for leader capabilities.
  const leaderSocietyId = useMemo(() => {
    const leader = myApplications.find(a =>
      a.status !== 'rejected' && a.status !== 'withdrawn'
      && (a.role === 'head-delegate' || a.role === 'faculty-advisor')
      && !!a.society_id
    );
    return leader?.society_id ?? null;
  }, [myApplications]);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [messagesByRequest, setMessagesByRequest] = useState<Map<string, RequestMessageRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RequestMessageRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // Filters + pagination, same semantics as the Applications page's FILTERS
  // popover: chips within a section OR together, sections AND together,
  // empty section = no constraint on that dimension. Search stays outside
  // the popover as a quick-access affordance, not counted in activeCount.
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadRequests = useCallback(async () => {
    if (!session || !user) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const SELECT = 'id, kind, subject, status, last_message_at, created_at, user_id, metadata, participant_seen_at';

    const [{ data: ownData }, { data: societyData }] = await Promise.all([
      supabase
        .from('conference_requests')
        .select(SELECT)
        .eq('conference_id', conferenceId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      leaderSocietyId
        ? supabase
            .from('conference_requests')
            .select(SELECT)
            .eq('conference_id', conferenceId)
            .in('kind', ['swap_request', 'swap_notice'])
            .eq('metadata->>society_id', leaderSocietyId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as RequestRow[] }),
    ]);

    const merged = new Map<string, RequestRow>();
    for (const row of ((ownData ?? []) as unknown as RequestRow[])) merged.set(row.id, row);
    for (const row of ((societyData ?? []) as unknown as RequestRow[])) merged.set(row.id, row);
    // Strictly newest-first by created_at — a status change never reorders.
    const sorted = Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRequests(sorted);

    // Every message per thread (not just the latest) — drives the row
    // snippet and the unread count (organizer messages newer than
    // participant_seen_at).
    const ids = sorted.map(r => r.id);
    if (ids.length > 0) {
      const { data: msgData } = await supabase
        .from('conference_request_messages')
        .select('id, request_id, sender_user_id, is_organizer, body, created_at')
        .in('request_id', ids)
        .order('created_at', { ascending: true });
      const map = new Map<string, RequestMessageRow[]>();
      for (const m of ((msgData ?? []) as RequestMessageRow[])) {
        const list = map.get(m.request_id) ?? [];
        list.push(m);
        map.set(m.request_id, list);
      }
      setMessagesByRequest(map);
    } else {
      setMessagesByRequest(new Map());
    }

    setLoading(false);
  }, [conferenceId, session, user, leaderSocietyId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const loadMessages = useCallback(async (requestId: string) => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_request_messages')
      .select('id, request_id, sender_user_id, is_organizer, body, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as RequestMessageRow[]);
  }, [session]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // Changing any filter resets to page one.
  useEffect(() => { setPage(1); }, [statusFilter, kindFilter, search, dateFrom, dateTo]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests
      .filter(r => (statusFilter.size === 0 ? true : statusFilter.has(r.status)))
      .filter(r => (kindFilter.size === 0 ? true : kindFilter.has(r.kind)))
      .filter(r => (q ? r.subject.toLowerCase().includes(q) : true))
      .filter(r => (dateFrom ? r.created_at.slice(0, 10) >= dateFrom : true))
      .filter(r => (dateTo ? r.created_at.slice(0, 10) <= dateTo : true))
      // Strictly newest-first by created_at — a status change (approved,
      // denied, closed) never reorders the list.
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [requests, statusFilter, kindFilter, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount =
    (statusFilter.size > 0 ? 1 : 0) +
    (kindFilter.size > 0 ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  function lastMessageOf(requestId: string): RequestMessageRow | null {
    const list = messagesByRequest.get(requestId);
    return list && list.length > 0 ? list[list.length - 1] : null;
  }

  // Unread = organizer messages newer than participant_seen_at; every
  // message counts when the stamp is null (never opened).
  function unreadCountOf(r: RequestRow): number {
    const msgs = messagesByRequest.get(r.id) ?? [];
    return msgs.filter(m => m.is_organizer && (!r.participant_seen_at || m.created_at > r.participant_seen_at)).length;
  }

  // Threads-with-unread count, over the whole list (unaffected by filters) —
  // the section header count.
  const unreadThreadCount = requests.filter(r => unreadCountOf(r) > 0).length;
  // MARK ALL READ only ever acts on the current page ("currently visible").
  const visibleUnreadCount = pagedRequests.filter(r => unreadCountOf(r) > 0).length;

  function handleOpenThread(id: string) {
    setSelectedId(id);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    // Optimistic mark-read: the unread badge clears instantly.
    setRequests(prev => prev.map(r => (r.id === id ? { ...r, participant_seen_at: new Date().toISOString() } : r)));
    void supabase.rpc('mark_request_seen', { p_request_id: id });
  }

  async function handleMarkAllRead() {
    if (!session || markingAllRead) return;
    const unreadIds = pagedRequests.filter(r => unreadCountOf(r) > 0).map(r => r.id);
    if (unreadIds.length === 0) return;
    setMarkingAllRead(true);
    const supabase = getAuthedClient(session.access_token);
    const nowIso = new Date().toISOString();
    setRequests(prev => prev.map(r => (unreadIds.includes(r.id) ? { ...r, participant_seen_at: nowIso } : r)));
    await Promise.all(unreadIds.map(id => supabase.rpc('mark_request_seen', { p_request_id: id })));
    setMarkingAllRead(false);
  }

  async function handleCreate() {
    if (!session || !user || !newSubject.trim() || !newBody.trim() || submitting) return;
    setSubmitting(true);
    const supabase = getAuthedClient(session.access_token);
    const { data: reqRow, error } = await supabase
      .from('conference_requests')
      .insert({
        conference_id: conferenceId,
        user_id: user.id,
        application_id: applicationId,
        subject: newSubject.trim(),
        kind: 'question',
      })
      .select('id')
      .single();
    if (error || !reqRow) { setSubmitting(false); return; }
    await supabase.from('conference_request_messages').insert({
      request_id: (reqRow as { id: string }).id,
      sender_user_id: user.id,
      is_organizer: false,
      body: newBody.trim(),
    });
    setSubmitting(false);
    setNewSubject('');
    setNewBody('');
    setCreating(false);
    await loadRequests();
    setSelectedId((reqRow as { id: string }).id);
  }

  async function handleReply() {
    if (!session || !user || !selectedId || !replyText.trim() || replying) return;
    setReplying(true);
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conference_request_messages').insert({
      request_id: selectedId,
      sender_user_id: user.id,
      is_organizer: false,
      body: replyText.trim(),
    });
    await supabase.from('conference_requests').update({
      last_message_at: new Date().toISOString(),
      seen_by_organizer: false,
    }).eq('id', selectedId);
    setReplyText('');
    setReplying(false);
    await loadMessages(selectedId);
    await loadRequests();
  }

  const selectedRequest = requests.find(r => r.id === selectedId) ?? null;
  const selectedKindChip = selectedRequest ? (KIND_CHIP[selectedRequest.kind] ?? KIND_CHIP.question) : null;
  const selectedStatusChip = selectedRequest ? (STATUS_CHIP[selectedRequest.status] ?? STATUS_CHIP.open) : null;
  const isSwapThread = selectedRequest?.kind === 'swap_request' || selectedRequest?.kind === 'swap_notice';

  return (
    <NeuCard className="p-6 md:p-7">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: NEU.deepGold, margin: 0 }}>
          QUESTIONS &amp; REQUESTS{unreadThreadCount > 0 ? ` (${unreadThreadCount})` : ''}
        </p>
        {!selectedId && !creating && (
          <NeuButton icon={Plus} onClick={() => setCreating(true)} style={{ padding: '7px 14px', fontSize: 11 }}>
            NEW REQUEST
          </NeuButton>
        )}
      </div>

      {/* Thread view */}
      {selectedId && selectedRequest ? (
        <div className="flex flex-col">
          <button
            onClick={() => { setSelectedId(null); setMessages([]); }}
            className="flex items-center gap-1.5 mb-4 focus:outline-none"
            style={{ fontSize: 11, fontWeight: 700, color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ChevronLeft size={13} /> BACK
          </button>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="rounded-full px-2.5 py-0.5"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: selectedKindChip!.bg, color: selectedKindChip!.color }}
            >
              {selectedKindChip!.label}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: selectedStatusChip!.bg, color: selectedStatusChip!.color }}
            >
              {selectedStatusChip!.label}
            </span>
          </div>
          <p className="font-semibold text-sm mb-4" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            {selectedRequest.subject}
          </p>

          {/* Swap details, before -> after per member. Doubles as the
              swap_notice "completed summary" and a preview on an open
              swap_request. */}
          {isSwapThread && (
            <NeuInset small className="px-4 py-3 mb-4">
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: NEU.deepGold, fontFamily: OUTFIT, margin: '0 0 6px 0' }}>
                SWAP DETAILS
              </p>
              <p className="text-sm" style={{ color: NEU.ink, fontFamily: OUTFIT, margin: 0 }}>
                {selectedRequest.metadata.member_a ?? 'Member A'}: {selectedRequest.metadata.before?.a ?? '—'} → {selectedRequest.metadata.after?.a ?? '—'}
              </p>
              <p className="text-sm mt-1" style={{ color: NEU.ink, fontFamily: OUTFIT, margin: '4px 0 0 0' }}>
                {selectedRequest.metadata.member_b ?? 'Member B'}: {selectedRequest.metadata.before?.b ?? '—'} → {selectedRequest.metadata.after?.b ?? '—'}
              </p>
            </NeuInset>
          )}
          {selectedRequest.kind === 'swap_request' && selectedRequest.status === 'open' && (
            <div className="mb-4">
              <Note tone="amber" icon={ArrowLeftRight}>Awaiting the organizing team.</Note>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-4" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {messages.map(m => {
              const mine = m.sender_user_id === user?.id && !m.is_organizer;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="mb-1" style={{ fontSize: 10, fontWeight: 700, color: NEU.deepGold, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                      ORGANIZING TEAM
                    </span>
                  )}
                  <div
                    className="rounded-2xl px-4 py-2.5"
                    style={{
                      maxWidth: '78%',
                      backgroundColor: mine ? NEU.forest : NEU.surface,
                      boxShadow: mine ? 'none' : NEU.outSm,
                      color: mine ? NEU.gold : NEU.ink,
                    }}
                  >
                    <p className="text-sm" style={{ fontFamily: OUTFIT, whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: 0 }}>{m.body}</p>
                  </div>
                  <span className="mt-1" style={{ fontSize: 10, color: NEU.muted, fontFamily: OUTFIT }}>
                    {fmtDate(m.created_at)} · {fmtTime(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Only question threads take a reply here, swap threads are
              read-only for participants (their outcome is driven by the
              organizer / DelegationPanel's own swap flow, not this panel). */}
          {selectedRequest.kind === 'question' && (
            <div className="flex gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !replying) handleReply(); }}
                placeholder="Write a reply..."
                className="flex-1 px-3.5 py-2.5 text-sm focus:outline-none"
                style={inputStyle()}
              />
              <button
                onClick={handleReply}
                disabled={replying || !replyText.trim()}
                className="flex items-center justify-center rounded-xl px-3.5 focus:outline-none"
                style={{
                  backgroundColor: replying || !replyText.trim() ? 'rgba(27,56,40,0.14)' : NEU.forest,
                  color: replying || !replyText.trim() ? NEU.muted : NEU.gold,
                  border: 'none', boxShadow: replying || !replyText.trim() ? 'none' : NEU.outSm,
                  cursor: replying || !replyText.trim() ? 'default' : 'pointer',
                }}
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>
      ) : creating ? (
        /* New request form */
        <div className="flex flex-col gap-3">
          <input
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            placeholder="Subject"
            className="px-3.5 py-2.5 text-sm focus:outline-none"
            style={inputStyle()}
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="What's your question?"
            rows={4}
            className="px-3.5 py-2.5 text-sm focus:outline-none resize-none"
            style={inputStyle()}
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setCreating(false); setNewSubject(''); setNewBody(''); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
              style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <NeuButton
              onClick={handleCreate}
              disabled={submitting || !newSubject.trim() || !newBody.trim()}
              style={{ flex: 1 }}
            >
              {submitting ? 'SENDING...' : 'SEND'}
            </NeuButton>
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={MessageSquare} size={44} style={{ marginBottom: 12 }} />
          <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            No threads yet. Send a question to the organizing team.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects..."
              className="px-3.5 py-2 text-sm focus:outline-none"
              style={{ ...inputStyle(), minWidth: 160, flex: '1 1 160px' }}
            />
            <div className="flex items-center gap-2 ml-auto">
              {visibleUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="focus:outline-none"
                  style={{
                    fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                    color: markingAllRead ? NEU.muted : NEU.forest,
                    background: 'none', border: 'none', cursor: markingAllRead ? 'default' : 'pointer',
                  }}
                >
                  {markingAllRead ? 'MARKING…' : 'MARK ALL READ'}
                </button>
              )}
              <FilterPopoverShell
                title="Filter requests"
                activeCount={activeFilterCount}
                onClearAll={() => { setStatusFilter(new Set()); setKindFilter(new Set()); setDateFrom(''); setDateTo(''); }}
              >
                <FilterGroup
                  title="State" icon={BadgeCheck} options={STATE_OPTIONS} selected={statusFilter}
                  onToggle={v => setStatusFilter(s => toggleIn(s, v))}
                  onAll={() => setStatusFilter(new Set(STATE_OPTIONS.map(o => o.value)))}
                  onNone={() => setStatusFilter(new Set())}
                />
                <FilterGroup
                  title="Kind" icon={MessageSquare} options={KIND_FILTER_OPTIONS} selected={kindFilter}
                  onToggle={v => setKindFilter(s => toggleIn(s, v))}
                  onAll={() => setKindFilter(new Set(KIND_FILTER_OPTIONS.map(o => o.value)))}
                  onNone={() => setKindFilter(new Set())}
                />
                <div>
                  <div className="mb-2">
                    <FilterHeading icon={CalendarDays}>Submitted between</FilterHeading>
                  </div>
                  <div className="flex items-center gap-2">
                    <div style={{ flex: 1 }}>
                      <DatePicker value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} placeholder="From" />
                    </div>
                    <ArrowRight size={13} style={{ color: NEU.muted, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <DatePicker value={dateTo} min={dateFrom || undefined} onChange={setDateTo} placeholder="To" />
                    </div>
                  </div>
                </div>
              </FilterPopoverShell>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              No threads match these filters.
            </p>
          ) : (
          <div className="flex flex-col gap-2">
          {pagedRequests.map(r => {
            const kindChip = KIND_CHIP[r.kind] ?? KIND_CHIP.question;
            const statusChip = STATUS_CHIP[r.status] ?? STATUS_CHIP.open;
            const last = lastMessageOf(r.id);
            const unread = unreadCountOf(r);
            const attention = unread > 0;
            return (
              <NeuInset
                key={r.id}
                small
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  cursor: 'pointer',
                  boxShadow: attention ? `0 0 0 1.5px ${NEU.deepGold}, ${NEU.inSm}` : NEU.inSm,
                }}
              >
                <button
                  onClick={() => handleOpenThread(r.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontWeight: attention ? 800 : 600, margin: 0 }}>
                        {r.subject}
                      </p>
                      {attention && (
                        <span
                          className="inline-flex items-center justify-center flex-shrink-0"
                          style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, backgroundColor: NEU.gold, color: NEU.forest, fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {unread}
                        </span>
                      )}
                    </div>
                    {last && (
                      <p className="text-xs truncate mt-0.5" style={{ color: NEU.muted, fontFamily: OUTFIT, margin: '2px 0 0 0' }}>
                        {last.is_organizer ? 'Organizing team: ' : ''}{last.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: kindChip.bg, color: kindChip.color }}
                      >
                        {kindChip.label}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: statusChip.bg, color: statusChip.color }}
                      >
                        {statusChip.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT }}>
                      {fmtDate(r.last_message_at)}
                    </span>
                  </div>
                </button>
              </NeuInset>
            );
          })}
          </div>
          )}

          {filteredRequests.length > PAGE_SIZE && (
            <Pager
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))}
            />
          )}
        </>
      )}
    </NeuCard>
  );
}
