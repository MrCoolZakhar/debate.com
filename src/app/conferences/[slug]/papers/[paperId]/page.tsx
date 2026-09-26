'use client';

// Position paper detail page: PDF on the right, review chat thread on the
// left. Reachable by the delegate(s) who own the paper, their seatmates,
// chairs of the committee, and organizers, all through the same route.
// Access control comes entirely from RLS on position_papers and
// position_paper_messages, no separate permission check here, a paper that
// fails to load just renders the "not available" state.

import AuthLink from '@/components/auth/AuthLink';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Download, ExternalLink, FileText, Send, X } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByCode } from '@/lib/countries';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import Avatar from '@/components/Avatar';
import { isPaperLate, signedPositionPaperUrl } from '@/lib/positionPapers';
import { NEU, NEU_GRADIENTS, EASE, OUTFIT, NeuCard } from '@/components/neu';
import { ActionButton } from '@/components/PositionPaperButtons';

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
  // public.profiles.avatar_url, joined off conference_allocations below.
  avatar_url: string | null;
}

interface ChatMessage {
  id: string;
  sender_user_id: string;
  is_reviewer: boolean;
  is_system: boolean;
  body: string;
  created_at: string;
  // public.profiles, joined off position_paper_messages.sender_user_id.
  profiles: { display_name: string; avatar_url: string | null } | null;
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
        boxShadow: disabled ? 'none' : hovered ? `0 6px 14px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 33%, transparent), ${NEU.outSmHover}` : `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 25%, transparent), ${NEU.outSm}`,
        transform: disabled ? 'none' : pressed ? 'scale(0.94)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 220ms ${EASE}, transform 140ms ${EASE}`,
      }}
    >
      <Send size={15} />
    </button>
  );
}

// ── Sign-in link, same physics but stays a next/link for client nav ───────

function SignInLink({ next }: { next: string }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <AuthLink
      next={next}
      className="inline-flex items-center justify-center rounded-full mt-4 focus:outline-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      style={{
        padding: '9px 22px',
        background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        color: NEU.gold, fontFamily: OUTFIT, fontWeight: 800, fontSize: 13,
        textDecoration: 'none',
        boxShadow: hovered ? `0 6px 14px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 33%, transparent), ${NEU.outSmHover}` : `0 3px 8px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 25%, transparent), ${NEU.outSm}`,
        transform: pressed ? 'scale(0.96)' : hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 220ms ${EASE}, transform 140ms ${EASE}`,
      }}
    >
      Sign in
    </AuthLink>
  );
}

// ── The paper, below `lg` ────────────────────────────────────────────────────
//
// An <iframe src="*.pdf"> is not a PDF viewer on iOS Safari. It renders the
// FIRST page, scaled to the frame, and nothing scrolls: page 2 of a position
// paper simply does not exist on an iPhone. Android Chrome is no better — it
// shows a download strip instead of the document.
//
// So below `lg` the paper is handed to the platform. The phone's own viewer
// pinches, scrolls, searches, prints and shares; it is a better reader than
// anything this page could draw, and it costs no bundle.
//
// The repo's pdf.js viewer (src/components/documents/PdfViewer.tsx) was the
// other candidate and was NOT chosen. It is built for the chair's introduction
// screen: a floating toolbar, zoom steps driven by ctrl+wheel (a trackpad
// gesture, not a touch one), canvases drawn at devicePixelRatio × the
// FitToScreen scale, and no touch pinch or double-tap path at all. On a phone
// it would be a worse reader than the native one AND pull pdfjs-dist onto a
// screen that is mostly a review thread. If it ever grows real touch gestures,
// this is the place to reconsider.
//
// Rendered as a sibling of the desktop card and toggled by `hidden lg:*` on
// both, so which one shows is CSS, never a JS width guess that flashes the
// wrong one before hydration.
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PaperHandoff({ fileName, fileUrl, sizeBytes }: { fileName: string; fileUrl: string; sizeBytes: number }) {
  const size = formatBytes(sizeBytes);
  return (
    /* `display` stays in the className, never the inline style: NeuCard spreads
       `style` last, and an inline `display: flex` would beat `lg:hidden` and
       leave this card on screen beside the desktop embed. */
    <NeuCard className="lg:hidden flex flex-col" style={{ padding: 20, flexDirection: 'column', gap: 16 }}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 46, height: 46, borderRadius: 14,
            background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
            color: NEU.gold, boxShadow: `0 4px 12px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 25%, transparent)`,
          }}
        >
          <FileText size={22} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink, margin: 0, overflowWrap: 'anywhere' }}>
            {fileName}
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, margin: '3px 0 0 0' }}>
            PDF{size ? ` · ${size}` : ''}
          </p>
        </div>
      </div>

      {/* Primary: full width, 48px, icon leading the word (rulebook §7). */}
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 focus:outline-none"
        style={{
          minHeight: 48, borderRadius: 14, textDecoration: 'none',
          background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
          color: NEU.gold, fontFamily: OUTFIT, fontWeight: 800, fontSize: 14,
          boxShadow: `0 6px 16px color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 27%, transparent)`,
        }}
      >
        <ExternalLink size={17} strokeWidth={2.2} />
        Open the PDF
      </a>

      <a
        href={fileUrl}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 focus:outline-none"
        style={{
          minHeight: 44, borderRadius: 14, textDecoration: 'none',
          backgroundColor: NEU.surface, border: '1.5px solid #D8CDB6',
          color: NEU.forest, fontFamily: OUTFIT, fontWeight: 700, fontSize: 13,
        }}
      >
        <Download size={16} strokeWidth={2.2} />
        Download
      </a>

      <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
        Opens in your phone&apos;s PDF reader, so you can pinch to zoom and read every page.
      </p>
    </NeuCard>
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
      .select('id, sender_user_id, is_reviewer, is_system, body, created_at, profiles:profile_cards (display_name, avatar_url)')
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
      // The bucket is private: open the file through a signed URL minted for this viewer.
      row.file_url = await signedPositionPaperUrl(supabase, row.file_url);
      if (cancelled) return;
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
              .select('user_id, profiles:profile_cards (display_name, avatar_url)')
              .eq('conference_committee_id', committee.id)
              .eq('country_code', row.country_code)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.rpc('mark_paper_seen', { p_paper_id: paperId }),
      ]);
      if (cancelled) return;
      setSubmitters(((allocData ?? []) as unknown as { user_id: string | null; profiles: { display_name: string; avatar_url: string | null } | null }[])
        .map(r => ({
          user_id: r.user_id,
          display_name: r.profiles?.display_name ?? null,
          avatar_url: r.profiles?.avatar_url ?? null,
        })));

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
      router.push(`/conferences/${slug}/role`);
    }
  }

  const committee = paper?.conference_committees ?? null;
  const cName = paper ? (getCountryByCode(paper.country_code)?.name ?? paper.country_code) : '';
  // Each submitter is kept WHOLE (the row, not just its display_name) rather
  // than pre-joined into one string, so every named seat-holder can link to
  // their own MUN CV. The ' & ' that used to be the join separator is now
  // rendered between the links.
  const namedSubmitters = submitters.filter(s => !!s.display_name);
  const late = paper ? isPaperLate(paper.submitted_at, committee?.position_paper_deadline ?? null) : false;

  return (
    <div
      className="flex flex-col min-h-screen lg:min-h-0 lg:h-[100dvh] overflow-visible lg:overflow-hidden"
      style={{ backgroundColor: NEU.base }}
    >
      <SiteNav />
      <div
        /* 88px of top padding was written for the desktop floating nav pill.
           On a phone SiteNav's bar is already in normal flow above this, so
           the same 88 was 88px of dead space at the top of a 667px screen. */
        className="flex-1 w-full max-w-[1100px] mx-auto px-6 pt-4 lg:pt-[88px]"
        style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', paddingBottom: 24 }}
      >
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
            <Loader size={72} label="Loading paper" />
          </div>
        ) : !user ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>Sign in to continue</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              You need to be signed in to view this position paper.
            </p>
            <SignInLink next={`/conferences/${slug}/papers/${paperId}`} />
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
                <CircleFlag code={paper.country_code} size={34} />
                <div className="min-w-0">
                  <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 20, color: NEU.ink, margin: 0, overflowWrap: 'anywhere' }}>{cName}</p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, margin: '2px 0 0 0' }}>
                    {committee?.abbreviation ?? committee?.name}
                    {namedSubmitters.length > 0 && ' · '}
                    {namedSubmitters.map((s, i) => (
                      <Fragment key={`${s.user_id ?? s.display_name}-${i}`}>
                        {i > 0 && ' & '}
                        {/* Header line sits in a plain div — no clickable
                            ancestor, so no `nested`. A seat with no account
                            has no user_id and stays plain text.
                            avatar_url comes from public.profiles, joined onto
                            conference_allocations in the loader above; null
                            for an unclaimed seat, which Avatar draws as an
                            initial disc. inline-flex keeps the picture on the
                            name's baseline inside this flowing sentence, and
                            min-w-0 lets a long name still wrap at 375px. */}
                        <ProfileLink userId={s.user_id} name={s.display_name}>
                          <span className="inline-flex items-center gap-1.5 align-middle" style={{ maxWidth: '100%' }}>
                            <Avatar url={s.avatar_url} name={s.display_name ?? '?'} size={20} />
                            <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{s.display_name}</span>
                          </span>
                        </ProfileLink>
                      </Fragment>
                    ))}
                    {` · Submitted ${fmtDate(paper.submitted_at)}`}
                    {committee?.position_paper_deadline && ` · Due ${fmtDate(committee.position_paper_deadline)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {late && (
                  <span
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(184,132,74,0.16)', color: '#8A5A2E', fontSize: 11, fontFamily: OUTFIT, fontWeight: 700 }}
                  >
                    Late
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
                        boxShadowColor={`color-mix(in srgb, ${NEU_GRADIENTS.green[0]} 33%, transparent)`}
                      >
                        Approve
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
                        Reject
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
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6" style={{ flex: 1, minHeight: 0 }}>
              {/* Chat */}
              <NeuCard className="h-[min(480px,62dvh)] lg:h-full" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, minHeight: 0 }}>
                <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3" style={{ minHeight: 0 }}>
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
                            {/* Sender label links to that person's MUN CV. The
                                bubble is a plain div, so no `nested`. Passing
                                null for your own messages keeps "You" as plain
                                text — a self-link off your own thread is noise.
                                avatar_url comes from public.profiles, joined
                                onto position_paper_messages by sender_user_id
                                in refetchMessages. A just-sent optimistic
                                message has no joined profile yet, so its own
                                picture is held back for the moment until the
                                refetch lands rather than flashing a "Y" disc. */}
                            <ProfileLink userId={mine ? null : m.sender_user_id} name={m.profiles?.display_name}>
                              <span className="inline-flex items-center gap-1.5 align-middle" style={{ maxWidth: '100%' }}>
                                {(m.profiles || !mine) && (
                                  <Avatar url={m.profiles?.avatar_url ?? null} name={m.profiles?.display_name ?? senderName} size={20} />
                                )}
                                <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{senderName}</span>
                              </span>
                            </ProfileLink> · {fmtTime(m.created_at)}
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
                    /* 16px on a phone: iOS zooms the whole page in on any
                       focused field under 16px and never zooms back out, which
                       leaves the delegate panning a magnified thread. The
                       13px it had is restored from `sm` up. */
                    className="flex-1 min-w-0 text-base sm:text-[13px] focus:outline-none"
                    style={{ border: 'none', borderRadius: 12, padding: '10px 14px', color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, fontFamily: OUTFIT }}
                  />
                  <SendButton onClick={handleSend} disabled={!body.trim() || sending} />
                </div>
                {sendError && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', padding: '0 12px 10px 12px' }}>{sendError}</p>
                )}
              </NeuCard>

              {/* PDF, desktop: embedded, the paper is the protagonist */}
              <NeuCard className="hidden lg:flex lg:h-full" style={{ flexDirection: 'column', overflow: 'hidden', padding: 0, minHeight: 0 }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(27,56,40,0.08)' }}>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: NEU.ink, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
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
                    boxShadowColor={`color-mix(in srgb, ${NEU_GRADIENTS.forest[0]} 33%, transparent)`}
                    style={{ flexShrink: 0 }}
                  >
                    Download
                  </ActionButton>
                </div>
                <iframe src={paper.file_url} title={paper.file_name} className="flex-1 w-full" style={{ border: 'none' }} />
              </NeuCard>

              {/* PDF, phone and tablet: hand it to the native viewer. */}
              <PaperHandoff fileName={paper.file_name} fileUrl={paper.file_url} sizeBytes={paper.file_size_bytes} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
