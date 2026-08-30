'use client';

// Staff user directory. Every account on the platform, searchable and sortable,
// with a detail drawer holding the operational record (applications, conferences
// organised, MUN CV, money, what we have emailed them) and a draft-an-email pane.
//
// SECURITY: identical model to AdminClient — this component holds no access
// logic worth trusting. Both RPCs it calls are SECURITY DEFINER and raise
// 'not authorised' unless is_platform_admin(). A non-staff visitor gets an
// error from the database and an empty screen; the component being reachable
// leaks nothing.
//
// WHY A DRAWER AND NOT /cv/[id]: the public CV is served by get_public_cv(),
// which deliberately returns display_name / nationality / bio / entries and
// NOTHING operational — no email, no signup date, no applications, no payments.
// It is the delegate's shop window. Staff reviewing an account need exactly the
// fields that surface deliberately omits, so clicking a row opens the staff
// record; "View public CV" links out to /cv/[id] for the shop-window view.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, X, Mail, ArrowUpRight, Copy, Check, ExternalLink, Info,
} from 'lucide-react';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import { cvHref } from '@/lib/cvLink';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useScrollLock } from '@/hooks/useScrollLock';

const OUTFIT = "'Outfit', sans-serif";
const MONO = 'ui-monospace, monospace';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const FOREST = '#1B3828';
const GOLD = '#B6871F';
const GREEN = '#3D7A52';
const PANEL = '#FAF8F3';
const LINE = '#DDD4C0';
const PAGE = '#EDE7D8';

const PAGE_SIZE = 50;

// ── Types mirroring the RPC return shapes ───────────────────────────────────

interface UserRow {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  nationality: string | null;
  education_level: string | null;
  mun_experience_level: string | null;
  is_demo: boolean;
  is_ambassador: boolean;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  applications: number;
  conferences_organised: number;
  cv_entries: number;
  paid_total: number;
  total_count: number;
}

interface DetailApplication {
  id: string; conference: string; slug: string; role: string; status: string;
  payment_status: string; amount_paid: number; submitted_at: string;
  committee: string | null; country: string | null;
}
interface DetailConference {
  id: string; slug: string; name: string; role: string; is_public: boolean;
  created_at: string; applications: number;
}
interface DetailCvEntry {
  id: string; entry_type: string; conference_name: string; committee: string;
  allocation: string; awards: string[]; event_date: string | null; created_at: string;
}
interface DetailEmail {
  id: string; subject: string; status: string; created_at: string; sent_at: string | null;
}
interface UserDetail {
  profile: {
    id: string; display_name: string; email: string; avatar_url: string | null;
    bio: string | null; nationality: string | null; education_level: string | null;
    mun_experience_level: string | null; created_at: string; last_sign_in_at: string | null;
    is_demo: boolean; is_ambassador: boolean; is_admin: boolean;
    points_balance: number; credits_remaining: number;
  };
  applications: DetailApplication[];
  conferences: DetailConference[];
  cv_entries: DetailCvEntry[];
  emails: DetailEmail[];
}

type Sort = 'newest' | 'oldest' | 'name' | 'applications' | 'active';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
  { key: 'applications', label: 'Most applications' },
  { key: 'active', label: 'Recently active' },
];

// ── Formatting ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function money(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Small shared bits ───────────────────────────────────────────────────────

function Avatar({ url, name, size = 34 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt=""
        className="object-cover flex-shrink-0"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32),
        backgroundColor: FOREST, color: '#EED98A',
        fontFamily: OUTFIT, fontWeight: 900, fontSize: Math.round(size * 0.42),
      }}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}

function Chip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
      color: fg, backgroundColor: bg, padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

/** Read-only explainer. Opens on HOVER (and focus), never on click, and is
 *  portaled at fixed coordinates so no scroll container can clip it. */
function HoverHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 290;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    const below = window.innerHeight - r.bottom > 190;
    setPos({ top: below ? r.bottom + 8 : Math.max(8, r.top - 190), left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  // Small delay so the pointer can travel from the badge into the panel.
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 160); };

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-label={label}
        className="inline-flex items-center justify-center focus:outline-none"
        style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${LINE}`, color: MUTED, cursor: 'help' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Info size={10} />
      </span>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 290,
              backgroundColor: PANEL, border: `1px solid ${LINE}`, borderRadius: 14,
              padding: '11px 13px', boxShadow: '0 10px 30px rgba(27,56,40,0.18)',
              fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5, color: INK,
            }}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Email pane ──────────────────────────────────────────────────────────────

/**
 * DRAFT ONLY — this pane deliberately does not send.
 *
 * The existing EmailComposer (src/components/EmailComposer.tsx) cannot be
 * reused here: it requires `conference` + `conferenceId` and resolves {{tokens}}
 * against an applicant of that conference. A platform user has no conference,
 * so there is nothing honest to bind it to.
 *
 * So this composes the message and hands it to the operator's own mail client
 * (mailto:) or clipboard. Nothing is queued, nothing is sent from the app.
 *
 * email_outbox.conference_id is now nullable (NULL = a platform-level email),
 * so the real fix is a staff-send DB function queueing a conference_id = NULL
 * outbox row — the same shape as queue_gavelling_enquiry_notification, which
 * already does exactly this for the contact and ambassador forms. That is a
 * decision for Peter, not a side effect of this tab.
 */
function EmailDraft({ to, name }: { to: string; name: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy(what: 'subject' | 'body') {
    try {
      await navigator.clipboard.writeText(what === 'subject' ? subject : body);
      setCopied(what);
      setTimeout(() => setCopied(c => (c === what ? null : c)), 1600);
    } catch { /* clipboard blocked — the fields are selectable anyway */ }
  }

  return (
    <div className="rounded-2xl" style={{ backgroundColor: PAGE, border: `1px solid ${LINE}`, padding: 14 }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Mail size={13} style={{ color: GOLD }} />
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: GOLD }}>
          EMAIL {name.split(' ')[0]?.toUpperCase() || 'USER'}
        </p>
        <HoverHint label="Why this does not send from here">
          <strong>This drafts, it does not send.</strong> The app&apos;s email pipeline
          (<code>email_outbox</code>) requires a <code>conference_id</code> — there is no
          conference behind a platform-level message, so a user email has no honest row to
          write. Opening it in your mail client also means the reply lands in your inbox.
        </HoverHint>
      </div>

      <p className="mb-2.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED }}>
        To <span style={{ color: INK, fontWeight: 700 }}>{to}</span>
      </p>

      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-xl px-3 py-2 mb-2 focus:outline-none"
        style={{ border: `1px solid ${LINE}`, backgroundColor: PANEL, color: INK, fontFamily: OUTFIT, fontSize: 13 }}
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={`Hi ${name.split(' ')[0] || 'there'},`}
        rows={6}
        className="w-full rounded-xl px-3 py-2 focus:outline-none"
        style={{ border: `1px solid ${LINE}`, backgroundColor: PANEL, color: INK, fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
      />

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <a
          href={mailto}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2"
          style={{
            backgroundColor: subject || body ? FOREST : 'rgba(27,56,40,0.14)',
            color: subject || body ? '#EED98A' : MUTED,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, textDecoration: 'none',
            pointerEvents: subject || body ? 'auto' : 'none',
          }}
        >
          <ExternalLink size={12} /> OPEN IN MAIL APP
        </a>
        <button
          type="button"
          onClick={() => copy('subject')}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 focus:outline-none"
          style={{ border: `1px solid ${LINE}`, background: 'transparent', color: INK, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {copied === 'subject' ? <Check size={12} style={{ color: GREEN }} /> : <Copy size={12} />} Subject
        </button>
        <button
          type="button"
          onClick={() => copy('body')}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 focus:outline-none"
          style={{ border: `1px solid ${LINE}`, background: 'transparent', color: INK, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {copied === 'body' ? <Check size={12} style={{ color: GREEN }} /> : <Copy size={12} />} Body
        </button>
      </div>
    </div>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-2">
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: MUTED }}>
          {title.toUpperCase()}
        </p>
        {count !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2 mb-1.5" style={{ backgroundColor: PAGE, border: `1px solid ${LINE}` }}>
      {children}
    </div>
  );
}

function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) { setError('Not signed in.'); return; }
      const supabase = getAuthedClient(session.access_token);
      const { data, error: e } = await supabase.rpc('admin_user_detail', { p_user_id: userId });
      if (cancelled) return;
      if (e) { setError(e.message); return; }
      setDetail(data as UserDetail);
    })();
    return () => { cancelled = true; };
  }, [session, userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Modal: freeze the user list behind the detail drawer.
  useScrollLock(true);

  const p = detail?.profile;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl rounded-2xl overflow-y-auto"
          style={{ maxHeight: '88vh', backgroundColor: PANEL, border: `1px solid ${LINE}`, padding: 24 }}
          onClick={e => e.stopPropagation()}
        >
          {!detail && !error && (
            <div className="flex items-center justify-center py-16"><Loader /></div>
          )}

          {error && (
            <div className="py-10 text-center">
              <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020' }}>{error}</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-full px-4 py-2 focus:outline-none"
                style={{ border: `1px solid ${LINE}`, background: 'transparent', color: INK, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          )}

          {p && (
            <>
              <div className="flex items-start gap-3.5 mb-5">
                {/* Avatar + name open the public CV, matching the rest of the
                    product. Opens in a new tab so an admin mid-triage does not
                    lose the drawer they are reading. */}
                <ProfileLink userId={p.id} name={p.display_name} newTab className="flex-shrink-0">
                  <Avatar url={p.avatar_url} name={p.display_name} size={56} />
                </ProfileLink>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black truncate" style={{ color: INK, fontFamily: OUTFIT, fontSize: 20, letterSpacing: '-0.01em' }}>
                    <ProfileLink userId={p.id} name={p.display_name} newTab>
                      {p.display_name}
                    </ProfileLink>
                  </h2>
                  <p className="truncate" style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 12.5 }}>{p.email}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {p.is_admin && <Chip text="STAFF" bg="rgba(182,135,31,0.16)" fg={GOLD} />}
                    {p.is_ambassador && <Chip text="AMBASSADOR" bg="rgba(61,122,82,0.12)" fg={GREEN} />}
                    {p.is_demo && <Chip text="DEMO" bg="rgba(154,138,120,0.16)" fg={MUTED} />}
                    {p.nationality && <Chip text={p.nationality.toUpperCase()} bg="rgba(27,56,40,0.07)" fg={FOREST} />}
                    {p.mun_experience_level && <Chip text={p.mun_experience_level.toUpperCase()} bg="rgba(27,56,40,0.07)" fg={FOREST} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={cvHref(p.id, p.display_name) ?? `/cv/${p.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                    style={{ border: `1px solid ${LINE}`, color: FOREST, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}
                  >
                    Public CV <ArrowUpRight size={12} />
                  </Link>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex items-center justify-center rounded-lg focus:outline-none"
                    style={{ width: 30, height: 30, border: `1px solid ${LINE}`, color: MUTED, background: 'transparent', cursor: 'pointer' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                {[
                  { l: 'Joined', v: fmtDate(p.created_at) },
                  { l: 'Last seen', v: timeAgo(p.last_sign_in_at) },
                  { l: 'Credits left', v: String(p.credits_remaining ?? 0) },
                  { l: 'Points', v: String(p.points_balance ?? 0) },
                ].map(s => (
                  <div key={s.l} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: PAGE, border: `1px solid ${LINE}` }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{s.v}</p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: MUTED }}>{s.l}</p>
                  </div>
                ))}
              </div>

              {p.bio && (
                <Section title="Bio">
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK, lineHeight: 1.6 }}>{p.bio}</p>
                </Section>
              )}

              <Section title="Applications" count={detail.applications.length}>
                {detail.applications.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: MUTED }}>None.</p>
                  : detail.applications.map(a => (
                    <MiniRow key={a.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/manage/${a.slug}/applications`} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK, textDecoration: 'none' }}>
                          {a.conference}
                        </Link>
                        <Chip text={a.role.toUpperCase()} bg="rgba(27,56,40,0.07)" fg={FOREST} />
                        <Chip
                          text={a.status.toUpperCase()}
                          bg={a.status === 'rejected' ? 'rgba(139,32,32,0.10)' : 'rgba(61,122,82,0.12)'}
                          fg={a.status === 'rejected' ? '#8B2020' : GREEN}
                        />
                        <Chip
                          text={a.payment_status.toUpperCase()}
                          bg={a.payment_status === 'paid' ? 'rgba(61,122,82,0.12)' : 'rgba(154,138,120,0.14)'}
                          fg={a.payment_status === 'paid' ? GREEN : MUTED}
                        />
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDate(a.submitted_at)}
                        </span>
                      </div>
                      {(a.committee || a.country) && (
                        <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: MUTED }}>
                          {[a.committee, a.country].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </MiniRow>
                  ))}
              </Section>

              <Section title="Conferences organised" count={detail.conferences.length}>
                {detail.conferences.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: MUTED }}>None.</p>
                  : detail.conferences.map(c => (
                    <MiniRow key={c.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/manage/${c.slug}`} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: INK, textDecoration: 'none' }}>
                          {c.name}
                        </Link>
                        <Chip text={c.role.toUpperCase()} bg="rgba(182,135,31,0.14)" fg={GOLD} />
                        {c.is_public
                          ? <Chip text="PUBLISHED" bg="rgba(61,122,82,0.12)" fg={GREEN} />
                          : <Chip text="DRAFT" bg="rgba(154,138,120,0.14)" fg={MUTED} />}
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                          {c.applications} apps · {fmtDate(c.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </Section>

              <Section title="MUN CV" count={detail.cv_entries.length}>
                {detail.cv_entries.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: MUTED }}>No experience recorded.</p>
                  : detail.cv_entries.map(e => (
                    <MiniRow key={e.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: INK }}>{e.conference_name}</span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: MUTED }}>
                          {[e.committee, e.allocation].filter(Boolean).join(' · ')}
                        </span>
                        {(e.awards ?? []).filter(a => a && a !== 'None').map(a => (
                          <Chip key={a} text={a.toUpperCase()} bg="rgba(182,135,31,0.14)" fg={GOLD} />
                        ))}
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                          {e.event_date ? fmtDate(e.event_date) : fmtDate(e.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </Section>

              <Section title="Emails we sent" count={detail.emails.length}>
                {detail.emails.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: MUTED }}>Nothing on record.</p>
                  : detail.emails.map(m => (
                    <MiniRow key={m.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: INK, flex: 1 }}>{m.subject}</span>
                        <Chip
                          text={m.status.toUpperCase()}
                          bg={m.status === 'sent' ? 'rgba(61,122,82,0.12)' : m.status === 'failed' ? 'rgba(139,32,32,0.10)' : 'rgba(154,138,120,0.14)'}
                          fg={m.status === 'sent' ? GREEN : m.status === 'failed' ? '#8B2020' : MUTED}
                        />
                        <span style={{ fontFamily: OUTFIT, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDate(m.sent_at ?? m.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </Section>

              <EmailDraft to={p.email} name={p.display_name} />
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── UsersTab ────────────────────────────────────────────────────────────────

export default function UsersTab() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box so typing does not fire an RPC per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 260);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(async (offset: number) => {
    if (!session) { setError('Not signed in.'); setRows([]); return; }
    if (offset === 0) setLoading(true); else setMore(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_user_directory', {
      p_search: search || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    setLoading(false);
    setMore(false);
    if (e) {
      // 'not authorised' → not staff. Anything else (most likely the RPC not
      // being deployed yet) is shown verbatim rather than silently blanking.
      setError(e.message);
      setRows(r => (offset === 0 ? [] : r));
      return;
    }
    const page = (data ?? []) as UserRow[];
    // bigint/numeric can arrive as strings over PostgREST — coerce, never trust.
    setTotal(page.length ? Number(page[0].total_count) || 0 : offset === 0 ? 0 : total);
    setRows(r => (offset === 0 || !r ? page : [...r, ...page]));
  }, [session, search, sort, total]);

  useEffect(() => {
    if (authLoading) return;
    void fetchPage(0);
    // fetchPage changes with `total`, which would loop; key the reload on the
    // inputs that actually define page 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, search, sort]);

  const loadedAll = !!rows && rows.length >= total;

  const summary = useMemo(() => {
    if (!rows) return null;
    return `${rows.length.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}`;
  }, [rows, total]);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="flex items-center gap-2 rounded-full px-3 py-2"
              style={{ backgroundColor: PANEL, border: `1px solid ${LINE}` }}>
          <Search size={13} style={{ color: MUTED }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Name, email or user id…"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: INK, width: 220 }}
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear search" className="focus:outline-none"
                    style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', lineHeight: 0 }}>
              <X size={13} />
            </button>
          )}
        </span>

        {SORTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className="rounded-full px-3.5 py-2 focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', cursor: 'pointer',
              backgroundColor: sort === s.key ? FOREST : 'transparent',
              color: sort === s.key ? '#EED98A' : '#6B5F52',
              border: sort === s.key ? 'none' : `1px solid ${LINE}`,
            }}
          >
            {s.label}
          </button>
        ))}

        {summary && (
          <span className="ml-auto" style={{ fontFamily: MONO, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            {summary}
          </span>
        )}
      </div>

      {/* Column key — keeps the dense number columns readable at a glance. */}
      <div className="hidden md:flex items-center gap-3 px-4 pb-1.5">
        <span style={{ width: 34 }} />
        <span style={{ flex: 1, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: MUTED }}>USER</span>
        <span style={{ width: 92, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: MUTED, textAlign: 'right' }}>JOINED</span>
        <span style={{ width: 74, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: MUTED, textAlign: 'right' }}>SEEN</span>
        <span style={{ width: 150, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: MUTED, textAlign: 'right' }}>APPS · ORG · CV</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16"><Loader /></div>
      )}

      {!loading && error && (
        <div className="rounded-2xl px-4 py-5 text-center" style={{ backgroundColor: PANEL, border: '1px solid rgba(139,32,32,0.3)' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#8B2020' }}>Could not load users.</p>
          <p className="mt-1" style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{error}</p>
        </div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <p className="text-sm py-12 text-center" style={{ color: MUTED, fontFamily: OUTFIT }}>
          {search ? 'Nobody matches that search.' : 'No users yet.'}
        </p>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map(u => {
            const paid = Number(u.paid_total) || 0;
            return (
            <button
              key={u.id}
              onClick={() => setOpenId(u.id)}
              className="rounded-2xl px-4 py-3 text-left focus:outline-none transition-colors"
              style={{ backgroundColor: PANEL, border: `1px solid ${LINE}`, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFDF8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = PANEL; }}
            >
              <div className="flex items-center gap-3">
                <Avatar url={u.avatar_url} name={u.display_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black truncate" style={{ color: INK, fontFamily: OUTFIT, fontSize: 13.5, maxWidth: 260 }}>
                      {u.display_name || 'No name'}
                    </span>
                    {u.is_admin && <Chip text="STAFF" bg="rgba(182,135,31,0.16)" fg={GOLD} />}
                    {u.is_ambassador && <Chip text="AMB" bg="rgba(61,122,82,0.12)" fg={GREEN} />}
                    {u.is_demo && <Chip text="DEMO" bg="rgba(154,138,120,0.16)" fg={MUTED} />}
                  </div>
                  <p className="truncate" style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 11.5 }}>
                    {u.email}
                    {u.nationality && ` · ${u.nationality}`}
                    {paid > 0 && ` · £${money(paid)} paid`}
                  </p>
                </div>
                <span className="hidden md:block" style={{ width: 92, textAlign: 'right', fontFamily: OUTFIT, fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(u.created_at)}
                </span>
                <span className="hidden md:block" style={{ width: 74, textAlign: 'right', fontFamily: OUTFIT, fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {timeAgo(u.last_sign_in_at)}
                </span>
                <span style={{ width: 150, textAlign: 'right', fontFamily: OUTFIT, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: u.applications > 0 ? INK : MUTED, fontWeight: u.applications > 0 ? 800 : 400 }}>{u.applications}</span>
                  <span style={{ color: MUTED }}> · </span>
                  <span style={{ color: u.conferences_organised > 0 ? GOLD : MUTED, fontWeight: u.conferences_organised > 0 ? 800 : 400 }}>{u.conferences_organised}</span>
                  <span style={{ color: MUTED }}> · </span>
                  <span style={{ color: u.cv_entries > 0 ? INK : MUTED }}>{u.cv_entries}</span>
                </span>
              </div>
            </button>
            );
          })}

          {!loadedAll && (
            <button
              onClick={() => rows && fetchPage(rows.length)}
              disabled={more}
              className="rounded-2xl py-3 mt-1 focus:outline-none"
              style={{ backgroundColor: 'transparent', border: `1px solid ${LINE}`, color: FOREST, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, cursor: more ? 'default' : 'pointer' }}
            >
              {more ? 'LOADING…' : `LOAD ${Math.min(PAGE_SIZE, total - rows.length)} MORE`}
            </button>
          )}
        </div>
      )}

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
