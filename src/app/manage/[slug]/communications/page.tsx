'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { createAuthClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailSend {
  id: string;
  subject: string;
  recipient_filter: Record<string, string>;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  created_at: string;
  body_html: string | null;
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface AppCount {
  role: string;
  status: string;
  payment_status: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFilter(filter: Record<string, string> | null, committees: Committee[]): string {
  if (!filter || filter.audience === 'all') return 'All participants';
  if (filter.audience === 'role' && filter.role) {
    const labels: Record<string, string> = {
      delegate: 'Delegates', chair: 'Chairs', 'head-delegate': 'Head Delegates',
      'faculty-advisor': 'Faculty Advisors', observer: 'Observers',
    };
    return labels[filter.role] ?? filter.role;
  }
  if (filter.audience === 'committee' && filter.committee_id) {
    const c = committees.find(cm => cm.id === filter.committee_id);
    return c ? c.name : 'Committee';
  }
  if (filter.audience === 'status' && filter.status) {
    const labels: Record<string, string> = {
      submitted: 'Submitted', accepted: 'Accepted', assigned: 'Assigned',
      paid: 'Paid', unpaid: 'Unpaid',
    };
    return `${labels[filter.status] ?? filter.status} applicants`;
  }
  return 'All participants';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  sent:      { dot: '#3D7A52', text: '#3D7A52', bg: 'rgba(61,122,82,0.1)' },
  scheduled: { dot: '#B6871F', text: '#B6871F', bg: 'rgba(182,135,31,0.1)' },
  draft:     { dot: '#DDD4C0', text: '#9A8A78', bg: 'rgba(154,138,120,0.1)' },
  failed:    { dot: '#8B2020', text: '#8B2020', bg: 'rgba(139,32,32,0.1)' },
};

// ── RadioRow ──────────────────────────────────────────────────────────────────

function RadioRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-colors"
      style={{
        backgroundColor: selected ? 'rgba(27,56,40,0.06)' : 'transparent',
        border: selected ? '1px solid rgba(27,56,40,0.15)' : '1px solid transparent',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 16, height: 16,
          border: selected ? 'none' : '1.5px solid #DDD4C0',
          backgroundColor: selected ? '#1B3828' : 'transparent',
        }}
      >
        {selected && <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: 'white' }} />}
      </div>
      <span className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{children}</span>
    </div>
  );
}

// ── ToolbarButton ─────────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, title, children, mono }: {
  onClick: () => void; title: string; children: React.ReactNode; mono?: boolean;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex items-center justify-center rounded-lg focus:outline-none transition-colors"
      style={{
        width: 28, height: 28,
        color: '#1C1410', backgroundColor: 'transparent',
        fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
        fontSize: mono ? 11 : 14,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button>
  );
}

// ── CommunicationsPage ────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const { conference } = useManage();
  const { user } = useAuth();

  // ── Data state ──
  const [emailSends, setEmailSends] = useState<EmailSend[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [appCounts, setAppCounts] = useState<AppCount[]>([]);
  const [loading, setLoading] = useState(true);

  // ── View state ──
  const [composing, setComposing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Composer state ──
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'role' | 'committee' | 'status'>('all');
  const [audienceRole, setAudienceRole] = useState('');
  const [audienceCommitteeId, setAudienceCommitteeId] = useState('');
  const [audienceStatus, setAudienceStatus] = useState('');
  const [sendTimeMode, setSendTimeMode] = useState<'immediate' | 'later'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadEmailSends = useCallback(async () => {
    if (!conference) return;
    const supabase = createAuthClient();
    const { data } = await supabase
      .from('email_sends')
      .select('id, subject, recipient_filter, recipient_count, scheduled_at, sent_at, status, created_at, body_html')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    setEmailSends((data ?? []) as unknown as EmailSend[]);
  }, [conference]);

  const loadCommittees = useCallback(async () => {
    if (!conference) return;
    const supabase = createAuthClient();
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    setCommittees((data ?? []) as Committee[]);
  }, [conference]);

  const loadAppCounts = useCallback(async () => {
    if (!conference) return;
    const supabase = createAuthClient();
    const { data } = await supabase
      .from('applications')
      .select('role, status, payment_status')
      .eq('conference_id', conference.id);
    setAppCounts((data ?? []) as AppCount[]);
  }, [conference]);

  useEffect(() => {
    if (!conference) return;
    setLoading(true);
    Promise.all([loadEmailSends(), loadCommittees(), loadAppCounts()])
      .finally(() => setLoading(false));
  }, [conference, loadEmailSends, loadCommittees, loadAppCounts]);

  // ── Composer helpers ──────────────────────────────────────────────────────

  function insertMarkup(open: string, close: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = bodyHtml.substring(s, e);
    const newText = bodyHtml.substring(0, s) + open + selected + close + bodyHtml.substring(e);
    setBodyHtml(newText);
    setTimeout(() => {
      ta.focus();
      const cursor = s + open.length + selected.length + close.length;
      ta.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function handleLinkInsert() {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = bodyHtml.substring(s, e) || 'link text';
    const newText = bodyHtml.substring(0, s) + `<a href="${url}">${selected}</a>` + bodyHtml.substring(e);
    setBodyHtml(newText);
  }

  function buildRecipientFilter(): Record<string, string> {
    const filter: Record<string, string> = { audience: audienceType };
    if (audienceType === 'role' && audienceRole) filter.role = audienceRole;
    if (audienceType === 'committee' && audienceCommitteeId) filter.committee_id = audienceCommitteeId;
    if (audienceType === 'status' && audienceStatus) filter.status = audienceStatus;
    return filter;
  }

  // Returns -1 to signal "unknown" for committee-type audience (requires DB query)
  function computeRecipientCount(): number {
    if (audienceType === 'committee') return -1;
    let filtered = appCounts.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn');
    if (audienceType === 'role' && audienceRole) {
      filtered = filtered.filter(a => a.role === audienceRole);
    } else if (audienceType === 'status' && audienceStatus) {
      if (audienceStatus === 'paid') filtered = filtered.filter(a => a.payment_status === 'paid');
      else if (audienceStatus === 'unpaid') filtered = filtered.filter(a => a.payment_status === 'unpaid' && ['accepted', 'assigned'].includes(a.status));
      else filtered = filtered.filter(a => a.status === audienceStatus);
    }
    return filtered.length;
  }

  function resetComposer() {
    setSubject('');
    setBodyHtml('');
    setAudienceType('all');
    setAudienceRole('');
    setAudienceCommitteeId('');
    setAudienceStatus('');
    setSendTimeMode('immediate');
    setScheduledAt('');
    setEditingId(null);
    setSendError('');
    setPreviewing(false);
  }

  function loadIntoComposer(email: EmailSend) {
    setSubject(email.subject);
    setBodyHtml(email.body_html ?? '');
    setEditingId(email.id);
    const f = email.recipient_filter ?? {};
    setAudienceType((f.audience as 'all' | 'role' | 'committee' | 'status') ?? 'all');
    setAudienceRole(f.role ?? '');
    setAudienceCommitteeId(f.committee_id ?? '');
    setAudienceStatus(f.status ?? '');
    if (email.scheduled_at) {
      setSendTimeMode('later');
      setScheduledAt(email.scheduled_at.substring(0, 16));
    } else {
      setSendTimeMode('immediate');
      setScheduledAt('');
    }
    setPreviewing(false);
    setSendError('');
    setComposing(true);
  }

  // ── DB handlers ───────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!conference || !user) return;
    const supabase = createAuthClient();
    const recipientFilter = buildRecipientFilter();
    const count = computeRecipientCount();
    const recipientCount = count === -1 ? 0 : count;
    const schedAt = sendTimeMode === 'later' && scheduledAt ? scheduledAt : null;

    if (editingId) {
      await supabase.from('email_sends').update({
        subject, body_html: bodyHtml,
        recipient_filter: recipientFilter,
        recipient_count: recipientCount,
        scheduled_at: schedAt,
        status: 'draft',
      }).eq('id', editingId);
    } else {
      const { data } = await supabase.from('email_sends').insert({
        conference_id: conference.id,
        sent_by: user.id,
        subject, body_html: bodyHtml,
        recipient_filter: recipientFilter,
        recipient_count: recipientCount,
        scheduled_at: schedAt,
        status: 'draft',
      }).select('id').single();
      setEditingId(data?.id ?? null);
    }
    await loadEmailSends();
  }

  async function handleSend() {
    if (!conference || !user) return;
    if (!subject.trim() || !bodyHtml.trim()) {
      setSendError('Subject and message are required.');
      return;
    }
    setSending(true);
    setSendError('');

    const supabase = createAuthClient();
    const recipientFilter = buildRecipientFilter();
    const count = computeRecipientCount();
    const recipientCount = count === -1 ? 0 : count;
    const schedAt = sendTimeMode === 'later' && scheduledAt ? scheduledAt : null;

    // Save (or update) the record and capture the final id synchronously
    let finalId = editingId;
    if (editingId) {
      await supabase.from('email_sends').update({
        subject, body_html: bodyHtml,
        recipient_filter: recipientFilter,
        recipient_count: recipientCount,
        scheduled_at: schedAt,
        status: 'draft',
      }).eq('id', editingId);
    } else {
      const { data } = await supabase.from('email_sends').insert({
        conference_id: conference.id,
        sent_by: user.id,
        subject, body_html: bodyHtml,
        recipient_filter: recipientFilter,
        recipient_count: recipientCount,
        scheduled_at: schedAt,
        status: 'draft',
      }).select('id').single();
      finalId = data?.id ?? null;
      setEditingId(finalId);
    }

    // Mark as sent/scheduled (actual email delivery via API route — wired later)
    if (finalId) {
      const isScheduled = sendTimeMode === 'later' && scheduledAt;
      await supabase.from('email_sends').update({
        status: isScheduled ? 'scheduled' : 'sent',
        sent_at: isScheduled ? null : new Date().toISOString(),
      }).eq('id', finalId);
    }

    setSending(false);
    setComposing(false);
    resetComposer();
    await loadEmailSends();
  }

  async function handleDeleteDraft(id: string) {
    const supabase = createAuthClient();
    await supabase.from('email_sends').delete().eq('id', id);
    await loadEmailSends();
  }

  async function handleCancelScheduled(id: string) {
    const supabase = createAuthClient();
    await supabase.from('email_sends').update({ status: 'draft', scheduled_at: null }).eq('id', id);
    await loadEmailSends();
  }

  if (!conference) return null;

  // ── Derived values ────────────────────────────────────────────────────────

  const sentCount = emailSends.filter(e => e.status === 'sent').length;
  const scheduledCount = emailSends.filter(e => e.status === 'scheduled').length;
  const draftCount = emailSends.filter(e => e.status === 'draft').length;
  const recipientCount = computeRecipientCount();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 md:px-10 py-8">

      {/* ── History header ── */}
      {!composing && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
              {conference.acronym} / Communications
            </p>
            <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Communications
            </h1>
          </div>
          <button
            onClick={() => { resetComposer(); setComposing(true); }}
            className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828', color: '#EED98A',
              letterSpacing: '0.05em', fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            COMPOSE EMAIL
          </button>
        </div>
      )}

      {/* ── Composer header ── */}
      {composing && (
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setComposing(false); resetComposer(); }}
            className="text-sm font-semibold focus:outline-none transition-colors"
            style={{ color: '#9A8A78', backgroundColor: 'transparent', border: 'none', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            ← BACK TO HISTORY
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSaveDraft}
              className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors"
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              SAVE DRAFT
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {sending ? 'SENDING...' : 'SEND NOW'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SENT HISTORY VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {!composing && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Emails Sent', value: sentCount },
              { label: 'Scheduled', value: scheduledCount },
              { label: 'Drafts', value: draftCount },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
              >
                <p className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 10, color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                  {s.label.toUpperCase()}
                </p>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
            </div>
          )}

          {/* Empty state */}
          {!loading && emailSends.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <Mail size={40} style={{ color: '#9A8A78', marginBottom: 16 }} />
              <p className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                No emails yet
              </p>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                Compose your first email to get started.
              </p>
              <button
                onClick={() => { resetComposer(); setComposing(true); }}
                className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                COMPOSE EMAIL →
              </button>
            </div>
          )}

          {/* Email list */}
          {!loading && emailSends.length > 0 && (
            <div className="flex flex-col gap-3">
              {emailSends.map(email => {
                const sc = STATUS_COLORS[email.status] ?? STATUS_COLORS.draft;
                const isExpanded = expandedId === email.id;
                const filterText = formatFilter(email.recipient_filter, committees);

                return (
                  <div
                    key={email.id}
                    className="rounded-2xl p-5 transition-colors"
                    style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', cursor: 'default' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                  >
                    {/* Row 1: status dot + subject + badge */}
                    <div className="flex items-center gap-3">
                      <div
                        className="flex-shrink-0 rounded-full"
                        style={{ width: 8, height: 8, backgroundColor: sc.dot }}
                      />
                      <p className="font-semibold text-sm flex-1 truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        {email.subject || '(No subject)'}
                      </p>
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5"
                        style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 700, letterSpacing: '0.06em', backgroundColor: sc.bg, color: sc.text }}
                      >
                        {email.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Row 2: filter summary + date */}
                    <div className="flex items-center gap-4 mt-1" style={{ fontSize: 12, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      <span>
                        {filterText}
                        {email.recipient_count > 0 ? ` · ${email.recipient_count} recipients` : ''}
                      </span>
                      <span className="ml-auto flex-shrink-0">
                        {email.sent_at
                          ? `Sent ${formatDate(email.sent_at)}`
                          : email.scheduled_at
                          ? `Scheduled ${formatDate(email.scheduled_at)}`
                          : `Draft · ${formatDate(email.created_at)}`}
                      </span>
                    </div>

                    {/* Row 3: actions */}
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                      {email.status === 'draft' && (
                        <>
                          <button
                            onClick={() => loadIntoComposer(email)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDeleteDraft(email.id)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                            style={{ color: '#8B2020', backgroundColor: 'transparent', border: 'none', fontFamily: "'Outfit', sans-serif" }}
                          >
                            DELETE
                          </button>
                        </>
                      )}
                      {email.status === 'sent' && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : email.id)}
                          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                          style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          {isExpanded ? 'HIDE' : 'VIEW'}
                        </button>
                      )}
                      {email.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelScheduled(email.id)}
                          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                          style={{ color: '#8B2020', backgroundColor: 'transparent', border: 'none', fontFamily: "'Outfit', sans-serif" }}
                        >
                          CANCEL
                        </button>
                      )}
                    </div>

                    {/* Expanded body preview */}
                    {isExpanded && email.body_html && (
                      <div
                        className="mt-3 pt-3 text-sm leading-relaxed"
                        style={{ borderTop: '1px solid #F0EDE6', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                        dangerouslySetInnerHTML={{ __html: email.body_html }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          EMAIL COMPOSER VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {composing && (
        <>
          {/* Error banner */}
          {sendError && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(182,135,31,0.08)', border: '1px solid rgba(182,135,31,0.2)', color: '#B6871F', fontFamily: "'Outfit', sans-serif" }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {sendError}
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex flex-col md:flex-row gap-6">

            {/* ── Left: main composer ── */}
            <div className="flex-1 min-w-0">

              {/* Subject */}
              <div className="mb-4">
                <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Your allocation for TEIMUN 2026 is confirmed"
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                />
              </div>

              {/* Body */}
              <div className="mb-4">
                <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Message
                </label>

                {/* Toolbar */}
                <div
                  className="flex gap-1 p-2 rounded-t-xl"
                  style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', borderBottom: 'none' }}
                >
                  <ToolbarBtn onClick={() => insertMarkup('<strong>', '</strong>')} title="Bold">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>B</span>
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkup('<em>', '</em>')} title="Italic">
                    <span style={{ fontStyle: 'italic', fontSize: 14 }}>I</span>
                  </ToolbarBtn>
                  <ToolbarBtn onClick={handleLinkInsert} title="Link">
                    <LinkIcon size={14} />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkup('<h2>', '</h2>')} title="Heading" mono>H1</ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkup('<ul><li>', '</li></ul>')} title="List" mono>UL</ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkup('<hr>', '')} title="Divider" mono>HR</ToolbarBtn>
                </div>

                {/* Editor / Preview toggle */}
                {!previewing ? (
                  <textarea
                    ref={textareaRef}
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    placeholder="Write your message here... You can use the toolbar above to format text."
                    className="w-full rounded-b-xl px-4 py-3 text-sm font-mono focus:outline-none resize-y"
                    style={{
                      minHeight: 280,
                      border: '1px solid #DDD4C0',
                      borderTop: 'none',
                      color: '#1C1410',
                      backgroundColor: '#FAF8F3',
                    }}
                  />
                ) : (
                  <div
                    className="w-full rounded-b-xl px-4 py-3 text-sm leading-relaxed"
                    style={{
                      minHeight: 280,
                      border: '1px solid #DDD4C0',
                      borderTop: 'none',
                      color: '#1C1410',
                      backgroundColor: '#FAF8F3',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml || '<span style="color:#9A8A78">Nothing to preview yet.</span>' }}
                  />
                )}

                <button
                  onClick={() => setPreviewing(v => !v)}
                  className="mt-2 text-xs font-semibold focus:outline-none"
                  style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {previewing ? '← EDIT' : 'PREVIEW →'}
                </button>
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="md:w-[280px] flex-shrink-0">

              {/* Audience card */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                <p className="font-semibold text-sm mb-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Recipients
                </p>

                <RadioRow selected={audienceType === 'all'} onClick={() => setAudienceType('all')}>
                  All participants
                </RadioRow>
                <RadioRow selected={audienceType === 'role'} onClick={() => setAudienceType('role')}>
                  By role
                </RadioRow>
                <RadioRow selected={audienceType === 'committee'} onClick={() => setAudienceType('committee')}>
                  By committee
                </RadioRow>
                <RadioRow selected={audienceType === 'status'} onClick={() => setAudienceType('status')}>
                  By status
                </RadioRow>

                {audienceType === 'role' && (
                  <select
                    value={audienceRole}
                    onChange={e => setAudienceRole(e.target.value)}
                    className="w-full mt-2 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                  >
                    <option value="">Select role...</option>
                    <option value="delegate">Delegates</option>
                    <option value="chair">Chairs</option>
                    <option value="head-delegate">Head Delegates</option>
                    <option value="faculty-advisor">Faculty Advisors</option>
                    <option value="observer">Observers</option>
                  </select>
                )}

                {audienceType === 'committee' && (
                  <select
                    value={audienceCommitteeId}
                    onChange={e => setAudienceCommitteeId(e.target.value)}
                    className="w-full mt-2 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                  >
                    <option value="">Select committee...</option>
                    {committees.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.abbreviation ? ` (${c.abbreviation})` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {audienceType === 'status' && (
                  <select
                    value={audienceStatus}
                    onChange={e => setAudienceStatus(e.target.value)}
                    className="w-full mt-2 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                  >
                    <option value="">Select status...</option>
                    <option value="submitted">Submitted (pending)</option>
                    <option value="accepted">Accepted</option>
                    <option value="assigned">Assigned</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid (accepted/assigned)</option>
                  </select>
                )}

                {/* Recipient count preview */}
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                  {audienceType === 'committee' ? (
                    <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                      ? estimated recipients
                    </p>
                  ) : recipientCount === 0 ? (
                    <p style={{ fontSize: 11, color: '#B6871F', fontFamily: "'DM Mono', monospace" }}>
                      No recipients match this filter.
                    </p>
                  ) : (
                    <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                      {recipientCount} estimated recipient{recipientCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Send Time card */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                <p className="font-semibold text-sm mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Send Time
                </p>
                <RadioRow selected={sendTimeMode === 'immediate'} onClick={() => setSendTimeMode('immediate')}>
                  Send immediately
                </RadioRow>
                <RadioRow selected={sendTimeMode === 'later'} onClick={() => setSendTimeMode('later')}>
                  Schedule for later
                </RadioRow>
                {sendTimeMode === 'later' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="w-full mt-2 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                  />
                )}
              </div>

              {/* Warning card */}
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.2)' }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} style={{ color: '#B6871F', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    Emails are sent to delegates&apos; registered Gavelling email addresses. Make sure your subject and message are correct before sending. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
