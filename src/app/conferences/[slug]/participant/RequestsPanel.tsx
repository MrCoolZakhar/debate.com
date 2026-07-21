'use client';

// Questions & Requests, never gated. Participant's own conference_requests
// threads across every kind (question / swap_request / swap_notice), plus a
// delegation leader's society-wide swap threads (any leader sees the same
// state, not just whoever sent it — RLS permits this). List -> new-request
// form or thread view; only 'question' threads take a reply (swap threads
// are read-only here, no attachments).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, ChevronLeft, Plus, Send, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuInset, NeuIconDisc, NeuButton } from '@/components/neu';
import type { ParticipantApplication } from './types';

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
  user_id: string;
  metadata: SwapMetadata;
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
  const [lastMessages, setLastMessages] = useState<Map<string, RequestMessageRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RequestMessageRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!session || !user) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const SELECT = 'id, kind, subject, status, last_message_at, user_id, metadata';

    const [{ data: ownData }, { data: societyData }] = await Promise.all([
      supabase
        .from('conference_requests')
        .select(SELECT)
        .eq('conference_id', conferenceId)
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false }),
      leaderSocietyId
        ? supabase
            .from('conference_requests')
            .select(SELECT)
            .eq('conference_id', conferenceId)
            .in('kind', ['swap_request', 'swap_notice'])
            .eq('metadata->>society_id', leaderSocietyId)
            .order('last_message_at', { ascending: false })
        : Promise.resolve({ data: [] as RequestRow[] }),
    ]);

    const merged = new Map<string, RequestRow>();
    for (const row of ((ownData ?? []) as unknown as RequestRow[])) merged.set(row.id, row);
    for (const row of ((societyData ?? []) as unknown as RequestRow[])) merged.set(row.id, row);
    const sorted = Array.from(merged.values()).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
    setRequests(sorted);

    // Latest message per thread, drives the row snippet + the needs-
    // attention dot (organizer replied after the user's last message).
    const ids = sorted.map(r => r.id);
    if (ids.length > 0) {
      const { data: msgData } = await supabase
        .from('conference_request_messages')
        .select('id, request_id, sender_user_id, is_organizer, body, created_at')
        .in('request_id', ids)
        .order('created_at', { ascending: true });
      const map = new Map<string, RequestMessageRow>();
      for (const m of ((msgData ?? []) as RequestMessageRow[])) map.set(m.request_id, m); // ascending order, last write wins = latest
      setLastMessages(map);
    } else {
      setLastMessages(new Map());
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

  function needsAttention(r: RequestRow): boolean {
    if (r.status !== 'open') return false;
    const last = lastMessages.get(r.id);
    return !!last && last.is_organizer;
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
          QUESTIONS &amp; REQUESTS
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
        <div className="flex flex-col gap-2">
          {requests.map(r => {
            const kindChip = KIND_CHIP[r.kind] ?? KIND_CHIP.question;
            const statusChip = STATUS_CHIP[r.status] ?? STATUS_CHIP.open;
            const last = lastMessages.get(r.id);
            const attention = needsAttention(r);
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
                  onClick={() => setSelectedId(r.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {attention && <span className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, backgroundColor: NEU.deepGold }} />}
                      <p className="text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontWeight: attention ? 800 : 600, margin: 0 }}>
                        {r.subject}
                      </p>
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
    </NeuCard>
  );
}
