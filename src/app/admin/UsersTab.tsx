'use client';

// Staff user directory. Every account on the platform, searchable and sortable,
// with a detail drawer holding the operational record (applications, conferences
// organised, MUN CV, money, what we have emailed them) and a draft-an-email pane.
// Beside it, a Pending tab for the people we know by email who have no account
// yet (see PendingTab.tsx).
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
//
// LOOK: this used to carry its own flat palette and hairline-bordered cards.
// It now reads from the same neu token set as the Data tab (NeuCard, NeuInset,
// NeuStatTile, NeuIconDisc), so the two staff surfaces are one design rather
// than two. No local colour constants live here any more.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, X, Mail, ArrowUpRight, Copy, Check, ExternalLink, Info,
  Users, Building2, FileText, BadgeCheck, Globe2, UserSearch,
} from 'lucide-react';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import Avatar from '@/components/Avatar';
import { FlagImg } from '@/components/FlagImg';
import { cvHref } from '@/lib/cvLink';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { useScrollLock } from '@/hooks/useScrollLock';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuStatTile,
} from '@/components/neu';
import { Chip, Eyebrow, MONO, NUM, RED, fmtDate, int, timeAgo } from './staffBits';
import PendingTab from './PendingTab';

const PAGE_SIZE = 50;

// Chip tints, defined once. Every one is a colour-mix over a theme variable, so
// a themed surface repaints them with the rest of the neu set.
const TINT = {
  gold: 'color-mix(in srgb, var(--gv-accent) 14%, transparent)',
  green: 'color-mix(in srgb, var(--gv-main-light) 14%, transparent)',
  forest: 'color-mix(in srgb, var(--gv-main) 10%, transparent)',
  grey: 'rgba(27,56,40,0.07)',
  red: 'rgba(139,32,32,0.10)',
} as const;

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
  /** Added to admin_user_directory as its LAST out column. Age is never stored,
   *  always derived by ageAt() at render. */
  date_of_birth: string | null;
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

function money(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Nationality is a full country name in profiles, and only about a quarter of
 *  accounts have one, so the no-flag case is the normal case. Returns null
 *  rather than a placeholder glyph: an empty slot is quieter than a broken
 *  flag or a globe on three rows in four. */
function nationalityFlag(nationality: string | null, size = 14) {
  if (!nationality) return null;
  const code = getCountryByName(nationality)?.code;
  if (!code) return null;
  return <FlagImg code={code} size={size} style={{ borderRadius: 3, flexShrink: 0 }} />;
}

// ── Small shared bits ───────────────────────────────────────────────────────

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
        style={{
          width: 17, height: 17, borderRadius: 999, color: NEU.inkSoft, cursor: 'help',
          backgroundColor: NEU.base, boxShadow: NEU.inSm,
        }}
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
              backgroundColor: NEU.surface, borderRadius: 14,
              padding: '11px 13px', boxShadow: '0 12px 32px rgba(27,56,40,0.20)',
              fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5, color: NEU.ink,
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

  const ready = !!(subject || body);

  return (
    <NeuInset style={{ padding: 15 }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Mail size={13} style={{ color: NEU.deepGold }} />
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: NEU.deepGold }}>
          EMAIL {name.split(' ')[0]?.toUpperCase() || 'USER'}
        </p>
        <HoverHint label="Why this does not send from here">
          <strong>This drafts, it does not send.</strong> The app&apos;s email pipeline
          (<code>email_outbox</code>) requires a <code>conference_id</code>, and there is no
          conference behind a platform-level message, so a user email has no honest row to
          write. Opening it in your mail client also means the reply lands in your inbox.
        </HoverHint>
      </div>

      <p className="mb-2.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
        To <span style={{ color: NEU.ink, fontWeight: 700 }}>{to}</span>
      </p>

      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-xl px-3 py-2 mb-2 focus:outline-none"
        style={{
          border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.inSm,
          color: NEU.ink, fontFamily: OUTFIT, fontSize: 13,
        }}
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={`Hi ${name.split(' ')[0] || 'there'},`}
        rows={6}
        className="w-full rounded-xl px-3 py-2 focus:outline-none"
        style={{
          border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.inSm,
          color: NEU.ink, fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.6, resize: 'vertical',
        }}
      />

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <a
          href={mailto}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2"
          style={{
            background: ready
              ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`
              : NEU.base,
            boxShadow: ready ? NEU.outSm : NEU.inSm,
            color: ready ? NEU.gold : NEU.muted,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, textDecoration: 'none',
            letterSpacing: '0.04em',
            pointerEvents: ready ? 'auto' : 'none',
          }}
        >
          <ExternalLink size={12} /> OPEN IN MAIL APP
        </a>
        {(['subject', 'body'] as const).map(what => (
          <button
            key={what}
            type="button"
            onClick={() => void copy(what)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 focus:outline-none"
            style={{
              border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.outSm,
              color: NEU.ink, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {copied === what ? <Check size={12} style={{ color: NEU.green }} /> : <Copy size={12} />}
            {what === 'subject' ? 'Subject' : 'Body'}
          </button>
        ))}
      </div>
    </NeuInset>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────

function DrawerSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-2">
        <Eyebrow>{title}</Eyebrow>
        {count !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: NEU.muted, ...NUM }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniRow({ children }: { children: React.ReactNode }) {
  return (
    <NeuInset small style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 13 }}>
      {children}
    </NeuInset>
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
          className="w-full max-w-3xl overflow-y-auto"
          style={{
            maxHeight: '88vh', backgroundColor: NEU.surface, borderRadius: 24,
            boxShadow: '0 24px 60px rgba(27,56,40,0.30)', padding: 24,
          }}
          onClick={e => e.stopPropagation()}
        >
          {!detail && !error && (
            <div className="flex items-center justify-center py-16"><Loader /></div>
          )}

          {error && (
            <div className="py-10 text-center">
              <p style={{ fontFamily: OUTFIT, fontSize: 13, color: RED }}>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-full px-4 py-2 focus:outline-none"
                style={{
                  border: 'none', backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                  color: NEU.ink, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          )}

          {p && detail && (
            <>
              <div className="flex items-start gap-3.5 mb-5">
                {/* Avatar + name open the public CV, matching the rest of the
                    product. Opens in a new tab so an admin mid-triage does not
                    lose the drawer they are reading. */}
                <ProfileLink userId={p.id} name={p.display_name} newTab className="flex-shrink-0">
                  <Avatar url={p.avatar_url} name={p.display_name} size={56} />
                </ProfileLink>
                <div className="flex-1 min-w-0">
                  <h2 className="truncate flex items-center gap-2" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em' }}>
                    <ProfileLink userId={p.id} name={p.display_name} newTab>
                      {p.display_name}
                    </ProfileLink>
                    {nationalityFlag(p.nationality, 18)}
                  </h2>
                  <p className="truncate" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: 12.5 }}>{p.email}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {p.is_admin && <Chip text="STAFF" bg={TINT.gold} fg={NEU.deepGold} />}
                    {p.is_ambassador && <Chip text="AMBASSADOR" bg={TINT.green} fg={NEU.green} />}
                    {p.is_demo && <Chip text="DEMO" bg={TINT.grey} fg={NEU.inkSoft} />}
                    {p.nationality && <Chip text={p.nationality.toUpperCase()} bg={TINT.forest} fg={NEU.forest} />}
                    {p.mun_experience_level && <Chip text={p.mun_experience_level.toUpperCase()} bg={TINT.forest} fg={NEU.forest} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={cvHref(p.id, p.display_name) ?? `/cv/${p.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                    style={{
                      backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest,
                      fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, textDecoration: 'none',
                    }}
                  >
                    Public CV <ArrowUpRight size={12} />
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex items-center justify-center rounded-lg focus:outline-none"
                    style={{
                      width: 30, height: 30, border: 'none', borderRadius: 11,
                      backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                      color: NEU.inkSoft, cursor: 'pointer',
                    }}
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
                  <NeuInset key={s.l} small style={{ padding: '9px 12px', borderRadius: 13 }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: NEU.ink, ...NUM }}>{s.v}</p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.inkSoft }}>{s.l}</p>
                  </NeuInset>
                ))}
              </div>

              {p.bio && (
                <DrawerSection title="Bio">
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.6 }}>{p.bio}</p>
                </DrawerSection>
              )}

              <DrawerSection title="Applications" count={detail.applications.length}>
                {detail.applications.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>None.</p>
                  : detail.applications.map(a => (
                    <MiniRow key={a.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/manage/${a.slug}/applications`} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, textDecoration: 'none' }}>
                          {a.conference}
                        </Link>
                        <Chip text={a.role.toUpperCase()} bg={TINT.forest} fg={NEU.forest} />
                        <Chip
                          text={a.status.toUpperCase()}
                          bg={a.status === 'rejected' ? TINT.red : TINT.green}
                          fg={a.status === 'rejected' ? RED : NEU.green}
                        />
                        <Chip
                          text={a.payment_status.toUpperCase()}
                          bg={a.payment_status === 'paid' ? TINT.green : TINT.grey}
                          fg={a.payment_status === 'paid' ? NEU.green : NEU.inkSoft}
                        />
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, ...NUM }}>
                          {fmtDate(a.submitted_at)}
                        </span>
                      </div>
                      {(a.committee || a.country) && (
                        <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft }}>
                          {[a.committee, a.country].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </MiniRow>
                  ))}
              </DrawerSection>

              <DrawerSection title="Conferences organised" count={detail.conferences.length}>
                {detail.conferences.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>None.</p>
                  : detail.conferences.map(c => (
                    <MiniRow key={c.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/manage/${c.slug}`} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, textDecoration: 'none' }}>
                          {c.name}
                        </Link>
                        <Chip text={c.role.toUpperCase()} bg={TINT.gold} fg={NEU.deepGold} />
                        {c.is_public
                          ? <Chip text="PUBLISHED" bg={TINT.green} fg={NEU.green} />
                          : <Chip text="DRAFT" bg={TINT.grey} fg={NEU.inkSoft} />}
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, ...NUM }}>
                          {c.applications} apps · {fmtDate(c.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </DrawerSection>

              <DrawerSection title="MUN CV" count={detail.cv_entries.length}>
                {detail.cv_entries.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No experience recorded.</p>
                  : detail.cv_entries.map(e => (
                    <MiniRow key={e.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{e.conference_name}</span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
                          {[e.committee, e.allocation].filter(Boolean).join(' · ')}
                        </span>
                        {(e.awards ?? []).filter(a => a && a !== 'None').map(a => (
                          <Chip key={a} text={a.toUpperCase()} bg={TINT.gold} fg={NEU.deepGold} />
                        ))}
                        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, ...NUM }}>
                          {e.event_date ? fmtDate(e.event_date) : fmtDate(e.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </DrawerSection>

              <DrawerSection title="Emails we sent" count={detail.emails.length}>
                {detail.emails.length === 0
                  ? <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nothing on record.</p>
                  : detail.emails.map(m => (
                    <MiniRow key={m.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, flex: 1 }}>{m.subject}</span>
                        <Chip
                          text={m.status.toUpperCase()}
                          bg={m.status === 'sent' ? TINT.green : m.status === 'failed' ? TINT.red : TINT.grey}
                          fg={m.status === 'sent' ? NEU.green : m.status === 'failed' ? RED : NEU.inkSoft}
                        />
                        <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft, ...NUM }}>
                          {fmtDate(m.sent_at ?? m.created_at)}
                        </span>
                      </div>
                    </MiniRow>
                  ))}
              </DrawerSection>

              <EmailDraft to={p.email} name={p.display_name} />
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── One row of the directory ────────────────────────────────────────────────

function UserRowCard({ u, onOpen }: { u: UserRow; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const paid = Number(u.paid_total) || 0;
  const age = ageAt(u.date_of_birth);
  const flag = nationalityFlag(u.nationality);

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left focus:outline-none w-full"
      style={{
        padding: '11px 16px', borderRadius: 18, border: 'none', cursor: 'pointer',
        backgroundColor: NEU.surface,
        boxShadow: hover ? NEU.outSmHover : NEU.outSm,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: `box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar url={u.avatar_url} name={u.display_name || '?'} size={34} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 900, maxWidth: 260 }}>
              {u.display_name || 'No name'}
            </span>
            {flag}
            {u.is_admin && <Chip text="STAFF" bg={TINT.gold} fg={NEU.deepGold} />}
            {u.is_ambassador && <Chip text="AMB" bg={TINT.green} fg={NEU.green} />}
            {u.is_demo && <Chip text="DEMO" bg={TINT.grey} fg={NEU.inkSoft} />}
          </div>
          <p className="truncate" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: 11.5, marginTop: 1 }}>
            {u.email}
            {u.nationality && ` · ${u.nationality}`}
            {paid > 0 && ` · £${money(paid)} paid`}
          </p>
        </div>

        {/* Age is sparse (about half of profiles carry a date of birth), so the
            cell stays blank rather than printing a placeholder on every other
            row. The column still holds its width, so the numbers line up. */}
        <span className="hidden md:block" style={{ width: 40, textAlign: 'end', fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, ...NUM }}>
          {age !== null && age >= 0 && age < 120 ? age : ''}
        </span>
        <span className="hidden md:block" style={{ width: 92, textAlign: 'end', fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, ...NUM }}>
          {fmtDate(u.created_at)}
        </span>
        <span className="hidden md:block" style={{ width: 74, textAlign: 'end', fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, ...NUM }}>
          {timeAgo(u.last_sign_in_at)}
        </span>
        <span style={{ width: 150, textAlign: 'end', fontFamily: OUTFIT, fontSize: 11.5, ...NUM }}>
          <span style={{ color: u.applications > 0 ? NEU.ink : NEU.muted, fontWeight: u.applications > 0 ? 800 : 400 }}>{u.applications}</span>
          <span style={{ color: NEU.muted }}> · </span>
          <span style={{ color: u.conferences_organised > 0 ? NEU.deepGold : NEU.muted, fontWeight: u.conferences_organised > 0 ? 800 : 400 }}>{u.conferences_organised}</span>
          <span style={{ color: NEU.muted }}> · </span>
          <span style={{ color: u.cv_entries > 0 ? NEU.ink : NEU.muted }}>{u.cv_entries}</span>
        </span>
      </div>
    </button>
  );
}

// ── The directory ───────────────────────────────────────────────────────────

function Directory() {
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
    setTotal(t => (page.length ? Number(page[0].total_count) || 0 : offset === 0 ? 0 : t));
    setRows(r => (offset === 0 || !r ? page : [...r, ...page]));
  }, [session, search, sort]);

  useEffect(() => {
    if (authLoading) return;
    void fetchPage(0);
  }, [authLoading, fetchPage]);

  const loadedAll = !!rows && rows.length >= total;

  // Everything below the first tile is derived from the rows LOADED so far, not
  // from the whole table — the RPC returns one page plus a total, and no other
  // aggregate. The caption under the tiles says so; a number without its
  // denominator would be the lie here.
  const derived = useMemo(() => {
    const r = rows ?? [];
    return {
      loaded: r.length,
      organisers: r.filter(u => u.conferences_organised > 0).length,
      applied: r.filter(u => u.applications > 0).length,
      ambassadors: r.filter(u => u.is_ambassador).length,
      staff: r.filter(u => u.is_admin).length,
      demo: r.filter(u => u.is_demo).length,
      withNationality: r.filter(u => !!u.nationality).length,
      withAge: r.filter(u => ageAt(u.date_of_birth) !== null).length,
    };
  }, [rows]);

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>

      {/* ── Tiles ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <NeuStatTile compact gradient={NEU_GRADIENTS.forest} icon={Users} value={int(total)} label={search ? 'Accounts matching' : 'Accounts'} />
        <NeuStatTile compact gradient={NEU_GRADIENTS.gold} icon={Building2} value={int(derived.organisers)} label="Organisers loaded" />
        <NeuStatTile compact gradient={NEU_GRADIENTS.sage} icon={FileText} value={int(derived.applied)} label="Have applied" />
        <NeuStatTile compact gradient={NEU_GRADIENTS.green} icon={BadgeCheck} value={int(derived.ambassadors)} label="Ambassadors loaded" />
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft }}>
        <HoverHint label="What these four count">
          <p style={{ fontWeight: 800, marginBottom: 6 }}>Only the first tile counts the whole table.</p>
          <p>
            Accounts is every profile matching the current search, straight from the directory
            function. The other three count the {int(derived.loaded)} rows loaded on this screen so
            far, because a page of results is all the function returns.
          </p>
          <p style={{ marginTop: 6, color: NEU.inkSoft }}>
            Load more, and they grow. They are a read of what is in front of you, not a platform
            aggregate. The Data tab owns the platform aggregates.
          </p>
        </HoverHint>
        <span style={NUM}>
          {int(derived.loaded)} of {int(total)} loaded · {int(derived.staff)} staff · {int(derived.demo)} demo
        </span>
      </p>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <NeuInset small className="flex items-center gap-2" style={{ padding: '8px 14px', borderRadius: 999 }}>
          <Search size={13} style={{ color: NEU.muted }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Name, email or user id…"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 220 }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="focus:outline-none"
              style={{ background: 'transparent', border: 'none', color: NEU.muted, cursor: 'pointer', lineHeight: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </NeuInset>

        {SORTS.map(s => {
          const on = sort === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className="rounded-full px-3.5 py-2 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                cursor: 'pointer', border: 'none',
                background: on
                  ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`
                  : NEU.surface,
                color: on ? NEU.gold : NEU.ink,
                boxShadow: on ? `0 4px 12px color-mix(in srgb, var(--gv-main) 28%, transparent), ${NEU.outSm}` : NEU.outSm,
                transition: `box-shadow 220ms ${EASE}, background 220ms ${EASE}, color 220ms ${EASE}`,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Coverage line. The two sparse profile fields, said out loud, so a blank
          age or a missing flag reads as an unfilled field and not as a bug. */}
      {rows && rows.length > 0 && (
        <NeuInset small style={{ padding: '7px 13px' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.ink, ...NUM }}>
            <Globe2 size={11} style={{ display: 'inline', marginRight: 5, color: NEU.deepGold }} />
            <strong>{int(derived.withNationality)}</strong>
            <span style={{ color: NEU.inkSoft }}> of {int(derived.loaded)} loaded stated a nationality</span>
            <span style={{ color: NEU.muted }}> · </span>
            <strong>{int(derived.withAge)}</strong>
            <span style={{ color: NEU.inkSoft }}> gave a date of birth. Both are optional, so a blank cell is an unanswered field.</span>
          </p>
        </NeuInset>
      )}

      {/* Column key — keeps the dense number columns readable at a glance. */}
      <div className="hidden md:flex items-center gap-3 px-4" style={{ marginBottom: -8 }}>
        <span style={{ width: 34 }} />
        <span style={{ flex: 1, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: NEU.muted }}>USER</span>
        <span style={{ width: 40, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: NEU.muted, textAlign: 'end' }}>AGE</span>
        <span style={{ width: 92, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: NEU.muted, textAlign: 'end' }}>JOINED</span>
        <span style={{ width: 74, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: NEU.muted, textAlign: 'end' }}>SEEN</span>
        <span style={{ width: 150, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: NEU.muted, textAlign: 'end' }}>APPS · ORG · CV</span>
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader /></div>}

      {!loading && error && (
        <NeuCard style={{ padding: '18px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: RED }}>Could not load users.</p>
          <p className="mt-1" style={{ fontFamily: MONO, fontSize: 11, color: NEU.inkSoft }}>{error}</p>
        </NeuCard>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <p className="py-12 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          {search ? 'Nobody matches that search.' : 'No users yet.'}
        </p>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {rows.map(u => <UserRowCard key={u.id} u={u} onOpen={() => setOpenId(u.id)} />)}

          {!loadedAll && (
            <button
              type="button"
              onClick={() => rows && void fetchPage(rows.length)}
              disabled={more}
              className="focus:outline-none"
              style={{
                marginTop: 4, padding: '12px 0', borderRadius: 999, border: 'none',
                backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest,
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
                cursor: more ? 'default' : 'pointer', opacity: more ? 0.6 : 1,
                transition: `box-shadow 200ms ${EASE}`,
              }}
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

// ── UsersTab: the two halves and the switch between them ────────────────────

type Half = 'users' | 'pending';

const HALVES: { key: Half; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Accounts', icon: Users },
  { key: 'pending', label: 'Pending', icon: UserSearch },
];

export default function UsersTab() {
  const [half, setHalf] = useState<Half>('users');

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {/* A pressed-in track holding two extruded pills, the same control the
          console's own tab bar uses one level up. Arrow keys move between them,
          matching the ARIA tabs pattern. */}
      <div
        role="tablist"
        aria-label="User directory sections"
        className="inline-flex items-center gap-1 self-start"
        style={{ padding: 4, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
      >
        {HALVES.map((h, i) => {
          const on = half === h.key;
          const Icon = h.icon;
          return (
            <button
              key={h.key}
              role="tab"
              id={`users-half-${h.key}`}
              aria-selected={on}
              aria-controls={`users-panel-${h.key}`}
              tabIndex={on ? 0 : -1}
              type="button"
              onClick={() => setHalf(h.key)}
              onKeyDown={e => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const next = HALVES[(i + (e.key === 'ArrowRight' ? 1 : HALVES.length - 1)) % HALVES.length];
                setHalf(next.key);
                document.getElementById(`users-half-${next.key}`)?.focus();
              }}
              className="inline-flex items-center gap-2 focus:outline-none"
              style={{
                padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: on ? NEU.gold : NEU.ink,
                background: on
                  ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`
                  : 'transparent',
                boxShadow: on ? `0 4px 12px color-mix(in srgb, var(--gv-main) 28%, transparent), ${NEU.outSm}` : 'none',
                transition: `box-shadow 240ms ${EASE}, color 240ms ${EASE}, background 240ms ${EASE}`,
              }}
            >
              <Icon size={13} strokeWidth={2.5} style={{ color: on ? NEU.gold : NEU.deepGold }} />
              {h.label}
            </button>
          );
        })}
      </div>

      {/* Only the selected half mounts, so the other one never fetches until a
          staff member actually opens it. */}
      <div role="tabpanel" id={`users-panel-${half}`} aria-labelledby={`users-half-${half}`}>
        {half === 'users' ? <Directory /> : <PendingTab />}
      </div>
    </div>
  );
}
