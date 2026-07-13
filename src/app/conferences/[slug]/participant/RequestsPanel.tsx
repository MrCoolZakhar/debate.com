'use client';

// Questions & Requests, never gated. Participant's own conference_requests
// threads (kind='question'). Lightweight: list -> new-request form or thread
// view, reply box bumps last_message_at. No attachments.

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronLeft, Plus, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT } from './shared';

interface RequestRow {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
}

interface RequestMessageRow {
  id: string;
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

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  closed: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

export default function RequestsPanel({ conferenceId, applicationId }: {
  conferenceId: string;
  applicationId: string | null;
}) {
  const { user, session } = useAuth();

  const [requests, setRequests] = useState<RequestRow[]>([]);
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
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_requests')
      .select('id, subject, status, last_message_at')
      .eq('conference_id', conferenceId)
      .eq('kind', 'question')
      .order('last_message_at', { ascending: false });
    setRequests((data ?? []) as RequestRow[]);
    setLoading(false);
  }, [conferenceId, session]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const loadMessages = useCallback(async (requestId: string) => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_request_messages')
      .select('id, sender_user_id, is_organizer, body, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as RequestMessageRow[]);
  }, [session]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

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

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          QUESTIONS &amp; REQUESTS
        </p>
        {!selectedId && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.05em', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Plus size={12} /> NEW REQUEST
          </button>
        )}
      </div>

      {/* Thread view */}
      {selectedId && selectedRequest ? (
        <div className="flex flex-col">
          <button
            onClick={() => { setSelectedId(null); setMessages([]); }}
            className="flex items-center gap-1.5 mb-4 focus:outline-none"
            style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ChevronLeft size={13} /> BACK
          </button>
          <p className="font-semibold text-sm mb-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            {selectedRequest.subject}
          </p>
          <div className="flex flex-col gap-3 mb-4" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {messages.map(m => {
              const mine = m.sender_user_id === user?.id && !m.is_organizer;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="mb-1" style={{ fontSize: 10, fontWeight: 700, color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                      ORGANIZING TEAM
                    </span>
                  )}
                  <div
                    className="rounded-2xl px-4 py-2.5"
                    style={{
                      maxWidth: '78%',
                      backgroundColor: mine ? '#1B3828' : '#FAF8F3',
                      border: mine ? 'none' : '1px solid #DDD4C0',
                      color: mine ? '#EED98A' : '#1C1410',
                    }}
                  >
                    <p className="text-sm" style={{ fontFamily: OUTFIT, whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: 0 }}>{m.body}</p>
                  </div>
                  <span className="mt-1" style={{ fontSize: 10, color: '#9A8A78', fontFamily: OUTFIT }}>
                    {fmtDate(m.created_at)} · {fmtTime(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !replying) handleReply(); }}
              placeholder="Write a reply..."
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
            />
            <button
              onClick={handleReply}
              disabled={replying || !replyText.trim()}
              className="flex items-center justify-center rounded-xl px-3.5 focus:outline-none"
              style={{
                backgroundColor: replying || !replyText.trim() ? '#DDD4C0' : '#1B3828',
                color: replying || !replyText.trim() ? '#9A8A78' : '#EED98A',
                border: 'none', cursor: replying || !replyText.trim() ? 'default' : 'pointer',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : creating ? (
        /* New request form */
        <div className="flex flex-col gap-3">
          <input
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            placeholder="Subject"
            className="rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="What's your question?"
            rows={4}
            className="rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setCreating(false); setNewSubject(''); setNewBody(''); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: OUTFIT, backgroundColor: 'transparent' }}
            >
              CANCEL
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !newSubject.trim() || !newBody.trim()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
              style={{
                backgroundColor: submitting || !newSubject.trim() || !newBody.trim() ? '#DDD4C0' : '#1B3828',
                color: submitting || !newSubject.trim() || !newBody.trim() ? '#9A8A78' : '#EED98A',
                fontFamily: OUTFIT,
              }}
            >
              {submitting ? 'SENDING...' : 'SEND'}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <MessageSquare size={22} strokeWidth={1.8} style={{ color: '#9A8A78', marginBottom: 10 }} />
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            No questions yet. Send one to the organizing team.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map(r => {
            const s = STATUS_STYLES[r.status] ?? STATUS_STYLES.open;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus:outline-none"
                style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>{r.subject}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>{fmtDate(r.last_message_at)}</p>
                </div>
                <span
                  className="px-2.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ ...s, fontSize: '9px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  {r.status.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
