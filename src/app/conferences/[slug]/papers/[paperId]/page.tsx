'use client';

// Position paper detail page: PDF on the right, review chat thread on the
// left. Reachable by the delegate(s) who own the paper, their seatmates,
// chairs of the committee, and organizers, all through the same route.
// Access control comes entirely from RLS on position_papers and
// position_paper_messages, no separate permission check here, a paper that
// fails to load just renders the "not available" state.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Loader2, Send, X } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByCode } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { isPaperLate } from '@/lib/positionPapers';
import { NEU, NEU_GRADIENTS, EASE, OUTFIT, NeuCard } from '@/components/neu';

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

// ── House action button: same lift-on-hover, scale-on-press physics as
// neu.tsx's NeuButton, but reusable as either a <button> or a download <a>,
// and supports an outline visual for secondary/danger actions like Reject.

type ActionIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;

function ActionButton({
  as = 'button', href, download, target, rel, onClick, disabled, icon: Icon, children,
  background, hoverBackground, color, hoverColor, border, boxShadowColor, style,
}: {
  as?: 'button' | 'a';
  href?: string;
  download?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ActionIcon;
  children: React.ReactNode;
  background: string;
  hoverBackground?: string;
  color: string;
  hoverColor?: string;
  border?: string;
  boxShadowColor?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const shadowTint = boxShadowColor ?? 'rgba(27,56,40,0.2)';
  const sharedStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9999,
    border: border ?? 'none',
    background: disabled ? 'rgba(27,56,40,0.12)' : (hovered && hoverBackground) ? hoverBackground : background,
    color: disabled ? NEU.muted : (hovered && hoverColor) ? hoverColor : color,
    fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : hovered ? `0 6px 14px ${shadowTint}, ${NEU.outSmHover}` : `0 3px 8px ${shadowTint}, ${NEU.outSm}`,
    transform: disabled ? 'none' : pressed ? 'scale(0.96)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
    transition: `box-shadow 220ms ${EASE}, transform 140ms ${EASE}, background-color 180ms ${EASE}, color 180ms ${EASE}`,
    ...style,
  };
  const handlers = {
    onMouseEnter: () => { if (!disabled) setHovered(true); },
    onMouseLeave: () => { setHovered(false); setPressed(false); },
    onPointerDown: () => { if (!disabled) setPressed(true); },
    onPointerUp: () => setPressed(false),
  };
  if (as === 'a') {
    return (
      <a href={href} download={download} target={target} rel={rel} className="focus:outline-none" style={sharedStyle} {...handlers}>
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="focus:outline-none" style={sharedStyle} {...handlers}>
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// ── Circular send button, same physics, gradient-filled disc ──────────────

function SendButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => { if (!disabled) setHovered(true); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={() => { if (!disabled) setPressed(true); }}
      onPointerUp={() => setPressed(false)}
      className="flex items-center justify-center flex-shrink-0 focus:outline-none"
      style={{
        width: 38, height: 38, borderRadius: 12, border: 'none',
        background: disabled ? 'rgba(27,56,40,0.12)' : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        color: disabled ? NEU.muted : NEU.gold,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : hovered ? `0 6px 14px ${NEU_GRADIENTS.forest[0]}55, ${NEU.outSmHover}` : `0 3px 8px ${NEU_GRADIENTS.forest[0]}40, ${NEU.outSm}`,
        transform: disabled ? 'none' : pressed ? 'scale(0.94)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 220ms ${EASE}, transform 140ms ${EASE}`,
      }}
    >
      <Send size={15} />
    </button>
  );
}

export default function PositionPaperPage() {
  const params = useParams<{ slug: string; paperId: string }>();
  const { slug, paperId } = params;
  const router = useRouter();
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

  // History-aware back: if this tab actually has in-app history to return to
  // (we were navigated here, not opened fresh), go back to wherever that
  // was, organizer screen, chair roster, or delegate card alike. Only fall
  // back to the conference page when there's nothing to go back to.
  function handleBack() {
    let hasHistory = false;
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin) hasHistory = true;
    } catch {
      // Malformed referrer, treat as no usable history.
    }
    if (!hasHistory) {
      const navState = window.history.state as { idx?: number } | null;
      if (navState && typeof navState.idx === 'number' && navState.idx > 0) hasHistory = true;
    }
    if (hasHistory) {
      router.back();
    } else {
      router.push(`/conferences/${slug}?tab=participant`);
    }
  }

  const committee = paper?.conference_committees ?? null;
  const cName = paper ? (getCountryByCode(paper.country_code)?.name ?? paper.country_code) : '';
  const submitterNames = submitters.map(s => s.display_name).filter(Boolean).join(' & ');
  const late = paper ? isPaperLate(paper.submitted_at, committee?.position_paper_deadline ?? null) : false;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="flex-1 w-full max-w-[1100px] mx-auto px-6 py-10">
        <ActionButton
          onClick={handleBack}
          icon={ArrowLeft}
          background={NEU.surface}
          color={NEU.muted}
          hoverColor={NEU.forest}
          boxShadowColor="rgba(27,56,40,0.14)"
          style={{ marginBottom: 24, padding: '7px 14px', fontSize: 11.5 }}
        >
          Back
        </ActionButton>

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
                      <ActionButton
                        onClick={() => updateStatus('approved')}
                        disabled={savingStatus}
                        icon={Check}
                        background={`linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`}
                        color={NEU.gold}
                        boxShadowColor={`${NEU_GRADIENTS.green[0]}55`}
                      >
                        APPROVE
                      </ActionButton>
                    )}
                    {paper.status !== 'rejected' && (
                      <ActionButton
                        onClick={() => updateStatus('rejected')}
                        disabled={savingStatus}
                        icon={X}
                        background="rgba(139,32,32,0.07)"
                        hoverBackground="rgba(139,32,32,0.15)"
                        color="#8B2020"
                        border="1px solid rgba(139,32,32,0.28)"
                        boxShadowColor="rgba(139,32,32,0.18)"
                      >
                        REJECT
                      </ActionButton>
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
              <NeuCard style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, height: 560 }}>
                <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, textAlign: 'center', margin: 'auto 0' }}>
                      No messages yet. Start the conversation below.
                    </p>
                  ) : (
                    messages.map(m => {
                      if (m.is_system) {
                        return (
                          <p key={m.id} style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
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
                              backgroundColor: alignRight ? NEU.forest : '#FFFFFF',
                              color: alignRight ? '#F4EFE3' : NEU.ink,
                              border: alignRight ? 'none' : '1px solid rgba(221,212,192,0.9)',
                            }}
                          >
                            <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
                          </div>
                          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, margin: '3px 4px 0 4px' }}>
                            {senderName} · {fmtTime(m.created_at)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                  <input
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Write a message..."
                    className="flex-1 focus:outline-none"
                    style={{ border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, fontFamily: OUTFIT }}
                  />
                  <SendButton onClick={handleSend} disabled={!body.trim() || sending} />
                </div>
                {sendError && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', padding: '0 12px 10px 12px' }}>{sendError}</p>
                )}
              </NeuCard>

              {/* PDF */}
              <NeuCard style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, height: 560 }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(27,56,40,0.08)' }}>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: NEU.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {paper.file_name}
                  </p>
                  <ActionButton
                    as="a"
                    href={paper.file_url}
                    download={paper.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={Download}
                    background={`linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`}
                    color={NEU.gold}
                    boxShadowColor={`${NEU_GRADIENTS.forest[0]}55`}
                    style={{ flexShrink: 0 }}
                  >
                    DOWNLOAD
                  </ActionButton>
                </div>
                <iframe src={paper.file_url} title={paper.file_name} className="flex-1 w-full" style={{ border: 'none' }} />
              </NeuCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
