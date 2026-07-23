'use client';

// Position paper detail page: PDF on the right, review chat thread on the
// left. Reachable by the delegate(s) who own the paper, their seatmates,
// chairs of the committee, and organizers, all through the same route.
// Access control comes entirely from RLS on position_papers and
// position_paper_messages, no separate permission check here, a paper that
// fails to load just renders the "not available" state.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Loader2, Send, X } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByCode } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { isPaperLate } from '@/lib/positionPapers';
import { NEU, OUTFIT, NeuCard } from '@/components/neu';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

interface PaperCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  position_paper_deadline: string | null;
  conference_id: string;
  chair_user_ids: string[] | null;
}

interface PaperRow {
  id: string;
  conference_committee_id: string;
  country_code: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  conference_committees: PaperCommittee | null;
}

interface Submitter {
  user_id: string | null;
  display_name: string | null;
}

interface ChatMessage {
  id: string;
  sender_user_id: string;
  is_reviewer: boolean;
  is_system: boolean;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: 'rgba(238,217,138,0.2)', color: '#B8844A' },
  reviewed: { bg: 'rgba(154,138,120,0.15)', color: '#6E5F4E' },
  approved: { bg: 'rgba(61,122,82,0.12)', color: '#3D7A52' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status.toLowerCase()] ?? STATUS_STYLES.submitted;
  return (
    <span
      className="px-3 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PositionPaperPage() {
  const params = useParams<{ slug: string; paperId: string }>();
  const { slug, paperId } = params;
  const { user, session, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [paper, setPaper] = useState<PaperRow | null>(null);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [isReviewer, setIsReviewer] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusError, setStatusError] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const refetchMessages = useCallback(async () => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('position_paper_messages')
      .select('id, sender_user_id, is_reviewer, is_system, body, created_at, profiles (display_name)')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as unknown as ChatMessage[]);
  }, [session, paperId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getAuthedClient(session.access_token);

      const { data, error } = await supabase
        .from('position_papers')
        .select(`
          id, conference_committee_id, country_code, file_url, file_name, file_size_bytes,
          status, submitted_at, reviewed_at,
          conference_committees ( id, name, abbreviation, position_paper_deadline, conference_id, chair_user_ids )
        `)
        .eq('id', paperId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) { setPaper(null); setLoading(false); return; }
      const row = data as unknown as PaperRow;
      setPaper(row);

      const committee = row.conference_committees;
      const isChair = !!committee && (committee.chair_user_ids ?? []).includes(user.id);
      let reviewer = isChair;
      if (!reviewer && committee) {
        const { data: confRow } = await supabase.from('conferences').select('organizer_id').eq('id', committee.conference_id).maybeSingle();
        if ((confRow as { organizer_id: string | null } | null)?.organizer_id === user.id) {
          reviewer = true;
        } else {
          const { data: orgRow } = await supabase
            .from('conference_organizers')
            .select('user_id')
            .eq('conference_id', committee.conference_id)
            .eq('user_id', user.id)
            .maybeSingle();
          reviewer = !!orgRow;
        }
      }
      if (cancelled) return;
      setIsReviewer(reviewer);

      const [{ data: allocData }] = await Promise.all([
        committee
          ? supabase
              .from('conference_allocations')
              .select('user_id, profiles (display_name)')
              .eq('conference_committee_id', committee.id)
              .eq('country_code', row.country_code)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.rpc('mark_paper_seen', { p_paper_id: paperId }),
      ]);
      if (cancelled) return;
      setSubmitters(((allocData ?? []) as unknown as { user_id: string | null; profiles: { display_name: string } | null }[])
        .map(r => ({ user_id: r.user_id, display_name: r.profiles?.display_name ?? null })));

      await refetchMessages();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, authLoading, user?.id, session?.access_token]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  function updateStatus(status: 'approved' | 'rejected') {
    if (!user || !session || !paper || savingStatus) return;
    const previous = paper;
    const reviewedAt = new Date().toISOString();
    setPaper({ ...paper, status, reviewed_at: reviewedAt });
    setStatusError('');
    setSavingStatus(true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('position_papers').update({
      status, reviewed_by: user.id, reviewed_at: reviewedAt,
    }).eq('id', paper.id).then(({ error }) => {
      setSavingStatus(false);
      if (error) {
        setPaper(previous);
        setStatusError("Couldn't update the status. Please try again.");
      }
    });
  }

  async function handleSend() {
    const text = body.trim();
    if (!text || !user || !session || !paper || sending) return;
    setSending(true);
    setSendError('');
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`, sender_user_id: user.id, is_reviewer: isReviewer,
      is_system: false, body: text, created_at: new Date().toISOString(), profiles: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setBody('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('position_paper_messages').insert({
      paper_id: paper.id,
      sender_user_id: user.id,
      is_reviewer: isReviewer,
      is_system: false,
      body: text,
    });
    setSending(false);
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setSendError("Couldn't send your message. Please try again.");
      return;
    }
    await refetchMessages();
  }

  const committee = paper?.conference_committees ?? null;
  const cName = paper ? (getCountryByCode(paper.country_code)?.name ?? paper.country_code) : '';
  const submitterNames = submitters.map(s => s.display_name).filter(Boolean).join(' & ');
  const late = paper ? isPaperLate(paper.submitted_at, committee?.position_paper_deadline ?? null) : false;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="flex-1 w-full max-w-[1100px] mx-auto px-6 py-10">
        <Link
          href={`/conferences/${slug}?tab=participant`}
          className="inline-flex items-center gap-1.5 mb-6 focus:outline-none"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.muted, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} strokeWidth={2.4} />
          Back to conference
        </Link>

        {authLoading || loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={26} className="animate-spin" style={{ color: NEU.muted }} />
          </div>
        ) : !user ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>Sign in to continue</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              You need to be signed in to view this position paper.
            </p>
            <Link
              href={`/auth/signin?next=${encodeURIComponent(`/conferences/${slug}/papers/${paperId}`)}`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 mt-4 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
            >
              SIGN IN
            </Link>
          </NeuCard>
        ) : !paper ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>This paper isn&apos;t available</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              It may not exist, or you may not have access to it.
            </p>
          </NeuCard>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div className="flex items-center gap-3">
                <FlagImg code={paper.country_code} size={30} />
                <div>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 20, color: NEU.ink, margin: 0 }}>{cName}</p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, margin: '2px 0 0 0' }}>
                    {committee?.abbreviation ?? committee?.name}
                    {submitterNames && ` · ${submitterNames}`}
                    {` · Submitted ${fmtDate(paper.submitted_at)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {late && (
                  <span
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(184,132,74,0.16)', color: '#8A5A2E', fontSize: 10, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.08em' }}
                  >
                    LATE
                  </span>
                )}
                <StatusBadge status={paper.status} />
                {isReviewer && (
                  <>
                    {paper.status !== 'approved' && (
                      <button
                        onClick={() => updateStatus('approved')}
                        disabled={savingStatus}
                        className="inline-flex items-center gap-1.5 focus:outline-none"
                        style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: '#EED98A', backgroundColor: '#3D7A52', border: 'none', borderRadius: 9999, padding: '7px 14px', cursor: savingStatus ? 'default' : 'pointer' }}
                      >
                        <Check size={13} /> APPROVE
                      </button>
                    )}
                    {paper.status !== 'rejected' && (
                      <button
                        onClick={() => updateStatus('rejected')}
                        disabled={savingStatus}
                        className="inline-flex items-center gap-1.5 focus:outline-none"
                        style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)', borderRadius: 9999, padding: '7px 14px', cursor: savingStatus ? 'default' : 'pointer' }}
                      >
                        <X size={13} /> REJECT
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {statusError && (
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020', marginBottom: 16 }}>{statusError}</p>
            )}

            {/* Body: chat left, PDF right */}
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
              {/* Chat */}
              <div
                className="flex flex-col rounded-2xl overflow-hidden"
                style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', height: 560 }}
              >
                <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#9A8A78', textAlign: 'center', margin: 'auto 0' }}>
                      No messages yet. Start the conversation below.
                    </p>
                  ) : (
                    messages.map(m => {
                      if (m.is_system) {
                        return (
                          <p key={m.id} style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                            {m.body}
                          </p>
                        );
                      }
                      const mine = m.sender_user_id === user.id;
                      const senderName = mine ? 'You' : (m.profiles?.display_name ?? (m.is_reviewer ? 'Reviewer' : 'Delegate'));
                      const alignRight = m.is_reviewer;
                      return (
                        <div key={m.id} className="flex flex-col" style={{ alignItems: alignRight ? 'flex-end' : 'flex-start' }}>
                          <div
                            className="rounded-2xl px-3.5 py-2.5"
                            style={{
                              maxWidth: '82%',
                              backgroundColor: alignRight ? '#1B3828' : '#FFFFFF',
                              color: alignRight ? '#F4EFE3' : '#1C1410',
                              border: alignRight ? 'none' : '1px solid #DDD4C0',
                            }}
                          >
                            <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
                          </div>
                          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: '#9A8A78', margin: '3px 4px 0 4px' }}>
                            {senderName} · {fmtTime(m.created_at)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid #DDD4C0' }}>
                  <input
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Write a message..."
                    className="flex-1 focus:outline-none"
                    style={{ border: '1px solid #DDD4C0', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!body.trim() || sending}
                    className="flex items-center justify-center flex-shrink-0 focus:outline-none"
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: 'none',
                      backgroundColor: !body.trim() || sending ? '#DDD4C0' : '#1B3828',
                      color: !body.trim() || sending ? '#9A8A78' : '#EED98A',
                      cursor: !body.trim() || sending ? 'default' : 'pointer',
                    }}
                  >
                    <Send size={15} />
                  </button>
                </div>
                {sendError && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', padding: '0 12px 10px 12px' }}>{sendError}</p>
                )}
              </div>

              {/* PDF */}
              <div
                className="flex flex-col rounded-2xl overflow-hidden"
                style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', height: 560 }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: '#1C1410', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {paper.file_name}
                  </p>
                  <a
                    href={paper.file_url}
                    download={paper.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none"
                    style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 9999, padding: '6px 13px', textDecoration: 'none' }}
                  >
                    <Download size={13} /> DOWNLOAD
                  </a>
                </div>
                <iframe src={paper.file_url} title={paper.file_name} className="flex-1 w-full" style={{ border: 'none' }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
