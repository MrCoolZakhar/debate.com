'use client';

// /admin → one account, as a pop-up. Everything this person has done on
// Gavelling in one place: conferences they organise (and what they came for),
// their applications with the seat they were given, the committees they chair,
// the session rooms they sat in, their delegations, awards, MUN CV, money and
// the emails we sent them.
//
// Modelled on ConferenceDetailDialog: a forest hero, then flat hairline
// sections with logos and round flags. It grows out of whatever opened it
// (GrowDialog uses the focused element when no selector is given).
//
// DATA: one read, admin_user_record(p_user_id) (migration admin_user_record),
// SECURITY DEFINER, raises unless is_platform_admin(). Read only. The payments
// block is the payments LEDGER, never applications.payment_status (CLAUDE.md §3).
//
// SESSIONS, HONESTLY: `committees` has no creator column. A session room is
// anonymous: a code, a chair suffix, typed names. The only links from an
// account to a room are chair_device_claims (a signed-in chair who opened the
// chair page) and delegate_seat_claims held as 'u:<uid>' (a signed-in
// delegate). Both rows are deleted with the room, and standalone rooms are
// deleted about an hour after they end. So the Sessions section lists rooms
// still on record that this account sat in while signed in, and says so. It
// can never list "every room this person created".
//
// This dialog can open on top of the conference pop-up, so Escape is taken in
// the capture phase and consumed here: it closes only this layer.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Award, BadgeCheck, Building2, CalendarClock, Check, Copy, CreditCard,
  ExternalLink, FileText, Gavel, Globe, History, Mail, Mic, Send, PencilLine, ScrollText,
  ShieldCheck, Sparkles, Target, Ticket, Users, Wallet, X, XCircle, Clock, Crown, Star,
} from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import Avatar from '@/components/Avatar';
import { LogoDisc } from '@/components/LogoDisc';
import { CircleFlag } from '@/components/CircleFlag';
import VerifiedCheck from '@/components/VerifiedCheck';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getConferenceIntent, intentLabels } from '@/lib/conferenceIntent';
import { getCountryByName } from '@/lib/countries';
import { moneyFromCents } from '@/lib/conferenceMoney';
import { formatFee } from '@/lib/utils';
import { ageAt } from '@/lib/age';
import { cvHref } from '@/lib/cvLink';
import { useScrollLock } from '@/hooks/useScrollLock';
import { OUTFIT } from '@/components/neu';
import { NUM, RED, fmtDate, int, timeAgo } from './staffBits';

// Same palette as ConferenceDetailDialog (rulebook §3): flat, hairline
// bordered, forest-tinted shadows, colour where it matters.
const C = {
  forest: '#1B3828', forestMid: '#2A5A3C', forestLight: '#3D7A52',
  gold: '#EED98A', goldDeep: '#8A6414', amber: '#9A5B1E',
  ivory: '#EDE7D8', cream: '#FAF8F3', parchment: '#DDD4C0', track: '#E6DECB',
  ink: '#1C1410', inkSoft: '#5E5145', sky: '#2F6076', plum: '#6B4A82',
} as const;
const HAIRLINE = '1px solid rgba(27,56,40,0.12)';
const TINT_FOREST = 'rgba(27,56,40,0.045)';
const TINT_GOLD = 'rgba(238,217,138,0.28)';

// ── Types mirroring admin_user_record ───────────────────────────────────────

interface Profile {
  id: string; display_name: string | null; email: string | null; avatar_url: string | null;
  bio: string | null; nationality: string | null; date_of_birth: string | null;
  education_level: string | null; mun_experience_level: string | null;
  created_at: string; last_sign_in_at: string | null;
  is_demo: boolean; is_ambassador: boolean; is_admin: boolean; pre_registered: boolean | null;
  points_balance: number | null; credits_remaining: number; credits_bought: number; credits_used: number;
  unlimited: { plan: string; status: string; current_period_end: string | null } | null;
}
interface Organised {
  id: string; slug: string; full_name: string; acronym: string | null; logo_url: string | null;
  country: string | null; city: string | null; start_date: string | null; end_date: string | null;
  dates_tbd: boolean | null; is_public: boolean; is_verified: boolean; is_demo: boolean;
  role: string; intent: unknown; created_at: string; applications: number; committees: number;
}
interface Application {
  id: string; conference_id: string; slug: string; conference: string; conference_full: string;
  logo_url: string | null; role: string; status: string; payment_status: string;
  is_head_delegate: boolean | null; submitted_at: string | null;
  committee: string | null; committee_full: string | null; committee_logo: string | null;
  country_name: string | null; country_code: string | null; society: string | null;
}
interface ChairRole {
  id: string; committee: string; committee_full: string; committee_logo: string | null;
  conference: string; conference_logo: string | null; slug: string;
  session_code: string | null; room_phase: string | null; room_ended_at: string | null;
  awards_submitted_at: string | null;
}
interface SessionRow {
  committee_id: string; code: string; name: string | null; topic: string | null;
  origin: string; phase: string | null; created_at: string; ended_at: string | null;
  as: 'chair' | 'delegate'; country: string | null; first_seen: string; last_seen: string | null;
  delegates: number; conference: string | null; conference_logo: string | null;
}
interface Delegation {
  id: string; name: string; conference: string; conference_logo: string | null; slug: string;
  is_advisor: boolean; is_head: boolean; members: number; spots_purchased: number | null;
}
interface CvEntry {
  id: string; entry_type: string | null; conference_name: string | null; committee: string | null;
  allocation: string | null; awards: string[] | null; award: string | null; source: string | null;
  logo_url: string | null; conference_logo: string | null; event_date: string | null; created_at: string;
}
interface AwardRow {
  id: string; label: string; status: string; country_name: string | null; country_code: string | null;
  committee: string | null; conference: string; conference_logo: string | null; slug: string;
  points: number | null; published_at: string | null;
}
interface Payments {
  by_currency: { currency: string; stripe_cents: number | null; offline_cents: number | null; pending: number }[];
  recent: {
    id: string; amount_cents: number; currency: string; status: string; method: string;
    created_at: string; conference: string; conference_logo: string | null;
  }[];
}
interface EmailRow { id: string; subject: string; status: string; created_at: string; sent_at: string | null }

export interface UserRecord {
  profile: Profile;
  organised: Organised[];
  applications: Application[];
  chair_roles: ChairRole[];
  sessions: SessionRow[];
  delegations: Delegation[];
  cv_entries: CvEntry[];
  awards: AwardRow[];
  payments: Payments;
  emails: EmailRow[];
}

// ── Small helpers ───────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : null;
}
function datesLabel(o: { start_date: string | null; end_date: string | null; dates_tbd?: boolean | null }): string {
  if (o.dates_tbd) return 'Dates to be decided';
  const s = dayLabel(o.start_date), e = dayLabel(o.end_date);
  if (s && e && o.start_date !== o.end_date) return `${s} to ${e}`;
  return s ?? e ?? 'No dates set';
}
function roleLabel(role: string): string {
  return role.replace(/[-_]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}
function money(cents: number | null | undefined, currency: string): string {
  return formatFee(moneyFromCents(cents), currency);
}

/** Application status as an icon and a plain coloured word (no pills). */
function statusLook(status: string): { icon: typeof Check; colour: string; word: string } {
  const s = status.toLowerCase();
  if (s === 'accepted' || s === 'assigned' || s === 'confirmed') return { icon: Check, colour: C.forestLight, word: roleLabel(s) };
  if (s === 'rejected') return { icon: XCircle, colour: RED, word: 'Rejected' };
  if (s === 'withdrawn' || s === 'cancelled') return { icon: History, colour: C.inkSoft, word: roleLabel(s) };
  if (s === 'waitlisted') return { icon: Clock, colour: C.amber, word: 'Waitlisted' };
  return { icon: Clock, colour: C.sky, word: roleLabel(s || 'submitted') };
}

const PHASE_LABEL: Record<string, string> = {
  'pre-session': 'Roll call', 'roll-call': 'Roll call', 'speakers-list': "General Speakers' List",
  'moderated-caucus': 'Moderated caucus', 'unmoderated-caucus': 'Unmoderated caucus',
  voting: 'Voting', adjourned: 'Suspended',
};
function roomState(phase: string | null, endedAt: string | null): { word: string; colour: string; live: boolean } {
  if (endedAt) return { word: 'Ended', colour: C.inkSoft, live: false };
  if (!phase) return { word: 'No room yet', colour: C.inkSoft, live: false };
  if (phase === 'adjourned') return { word: 'Suspended', colour: C.amber, live: false };
  if (phase === 'pre-session') return { word: 'Not started', colour: C.sky, live: false };
  return { word: PHASE_LABEL[phase] ?? roleLabel(phase), colour: C.forestLight, live: true };
}

// ── Layout pieces ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, tint, title, count, children, note,
}: {
  icon: typeof Globe; tint: string; title: string; count?: number; note?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = `adm-user-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="mb-7">
      <h3 id={id} className="flex items-center gap-2 mb-1.5" style={{ fontSize: 13, fontWeight: 800, color: C.forest }}>
        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, borderRadius: 999, background: `${tint}1F`, color: tint }}>
          <Icon size={13} strokeWidth={2.4} aria-hidden />
        </span>
        {title}
        {count !== undefined && <span style={{ color: C.inkSoft, fontWeight: 700, ...NUM }}>{int(count)}</span>}
      </h3>
      {note && <div className="mb-2" style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>{note}</div>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: C.inkSoft, padding: '8px 0', borderTop: HAIRLINE }}>{children}</p>;
}

/** One row: a leading picture, a title line, a detail line, a trailing column. */
function Row({
  lead, title, detail, trail, href, highlight,
}: {
  lead: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; trail?: React.ReactNode;
  href?: string; highlight?: boolean;
}) {
  const body = (
    <>
      <span className="flex-shrink-0">{lead}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{title}</span>
        {detail && <span className="block mt-0.5" style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.45 }}>{detail}</span>}
      </span>
      {trail && <span className="flex-shrink-0 text-end" style={{ fontSize: 11.5, color: C.inkSoft, ...NUM }}>{trail}</span>}
      {href && <ArrowUpRight size={14} aria-hidden className="flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: C.forest }} />}
    </>
  );
  const style: React.CSSProperties = {
    padding: highlight ? '10px 10px' : '10px 2px', borderTop: HAIRLINE, textDecoration: 'none',
    background: highlight ? TINT_FOREST : 'transparent', borderRadius: highlight ? 12 : 0,
  };
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2" style={style}>
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-3" style={style}>{body}</div>
  );
}

/** A logo with a small round flag (or a second logo) on its corner. */
function LogoWithBadge({ src, text, size = 40, badge }: { src: string | null; text: string; size?: number; badge?: React.ReactNode }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <LogoDisc src={src} alt="" size={size} fallbackText={text.slice(0, 3)} />
      {badge && (
        <span className="absolute" style={{ right: -4, bottom: -3, borderRadius: 999, border: `2px solid ${C.cream}`, lineHeight: 0 }}>
          {badge}
        </span>
      )}
    </span>
  );
}

function Word({ icon: Icon, colour, children }: { icon: typeof Globe; colour: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: colour, fontWeight: 700 }}>
      <Icon size={12} strokeWidth={2.5} aria-hidden />{children}
    </span>
  );
}

// ── Email draft (moved from UsersTab; still does not send) ──────────────────

/**
 * DRAFT ONLY: composes a message and hands it to the operator's own mail client
 * (mailto:) or clipboard. Nothing is queued and nothing is sent from the app.
 */
function EmailDraft({ to, name }: { to: string; name: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const ready = !!(subject || body);
  const first = name.split(' ')[0] || 'there';

  async function copy(what: 'subject' | 'body') {
    try {
      await navigator.clipboard.writeText(what === 'subject' ? subject : body);
      setCopied(what);
      setTimeout(() => setCopied(c => (c === what ? null : c)), 1600);
    } catch { /* clipboard blocked: the fields are selectable anyway */ }
  }

  const field: React.CSSProperties = {
    width: '100%', borderRadius: 12, padding: '9px 12px', backgroundColor: '#FFFFFF',
    border: `1.5px solid ${C.parchment}`, color: C.ink, fontFamily: OUTFIT, fontSize: 13, outline: 'none',
  };
  return (
    <div style={{ padding: 16, borderRadius: 16, background: '#FFFFFF', border: HAIRLINE }}>
      <p className="mb-2.5" style={{ fontSize: 11.5, color: C.inkSoft }} title="Drafts only. Opens in your own mail app, so replies land in your inbox.">
        To <strong style={{ color: C.ink }}>{to}</strong>. Opens in your mail app; nothing is sent from here.
      </p>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...field, marginBottom: 8 }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={`Hi ${first},`} rows={5}
        style={{ ...field, lineHeight: 1.6, resize: 'vertical' }} />
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <a
          href={mailto}
          aria-disabled={!ready}
          className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
          style={{
            padding: '8px 15px', borderRadius: 999, border: `1.5px solid ${ready ? C.forest : C.parchment}`,
            background: ready ? C.forest : C.cream, color: ready ? C.gold : C.inkSoft,
            fontSize: 12, fontWeight: 800, textDecoration: 'none', pointerEvents: ready ? 'auto' : 'none',
          }}
        >
          <ExternalLink size={13} aria-hidden /> Open in mail app
        </a>
        {(['subject', 'body'] as const).map(what => (
          <button
            key={what}
            type="button"
            onClick={() => void copy(what)}
            className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
            style={{
              padding: '8px 13px', borderRadius: 999, border: `1.5px solid ${C.parchment}`, background: C.cream,
              color: C.forest, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {copied === what ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            Copy {what}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── The dialog ──────────────────────────────────────────────────────────────

export default function UserDetailDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { session } = useAuth();
  const [rec, setRec] = useState<UserRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useScrollLock(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) { setError('Not signed in.'); return; }
      const supabase = getAuthedClient(session.access_token);
      const { data, error: e } = await supabase.rpc('admin_user_record', { p_user_id: userId });
      if (cancelled) return;
      // Admin console: raw errors are kept on purpose (CLAUDE.md §8).
      if (e) { setError(e.message); return; }
      if (!data) { setError('No account found for this person.'); return; }
      setRec(data as UserRecord);
    })();
    return () => { cancelled = true; };
  }, [session, userId]);

  // Capture phase and consumed: this can sit on top of the conference pop-up,
  // whose own Escape handler skips an event that is already prevented.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      (closeRef.current ?? onClose)();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const p = rec?.profile;
  const name = p?.display_name?.trim() || 'No name';
  const age = ageAt(p?.date_of_birth ?? null);
  const paid = rec?.payments.by_currency ?? [];

  return (
    <Portal>
      <GrowDialog
        onClose={onClose}
        closeRef={closeRef}
        ariaLabel={p ? name : 'Account'}
        panelClassName="w-full max-w-5xl overflow-y-auto"
        panelStyle={{
          maxHeight: '90vh', backgroundColor: C.cream, borderRadius: 26, fontFamily: OUTFIT,
          border: HAIRLINE, boxShadow: '0 28px 70px rgba(27,56,40,0.32)',
        }}
        backdropStyle={{ background: 'rgba(16,28,20,0.5)' }}
      >
        {requestClose => (
          <>
            {!rec && !error && <div className="flex items-center justify-center py-20"><Loader /></div>}

            {error && (
              <div className="py-12 px-6 text-center">
                <p style={{ fontSize: 13, color: RED }}>{error}</p>
                <button type="button" onClick={requestClose} className="mt-4 focus:outline-none focus-visible:ring-2"
                  style={{ padding: '8px 15px', borderRadius: 999, border: `1.5px solid ${C.parchment}`, background: C.cream, color: C.forest, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            )}

            {rec && p && (
              <>
                {/* ── Hero ── */}
                <header
                  className="relative flex items-center gap-5 flex-wrap"
                  style={{
                    padding: '26px 28px 24px',
                    background: `radial-gradient(120% 140% at 0% 0%, ${C.forestMid} 0%, ${C.forest} 60%)`,
                    borderRadius: '24px 24px 0 0', color: C.ivory,
                  }}
                >
                  <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
                    <span className="block" style={{ borderRadius: 999, border: `2px solid ${C.gold}`, boxShadow: '0 10px 26px rgba(8,20,12,0.35)', lineHeight: 0 }}>
                      <Avatar url={p.avatar_url} name={name} size={92} rounded />
                    </span>
                    {p.nationality && (
                      <span className="absolute" style={{ right: -6, bottom: -4, borderRadius: 999, border: `2.5px solid ${C.forest}`, boxShadow: '0 4px 12px rgba(8,20,12,0.3)', lineHeight: 0 }}>
                        <CircleFlag country={p.nationality} size={34} ring={false} loading="eager" label={p.nationality}
                          fallback={<Globe size={15} style={{ color: C.forest }} />} />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0" style={{ minWidth: 220 }}>
                    <h2 className="flex items-center gap-2.5 flex-wrap" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, color: '#FFFFFF' }}>
                      <span className="truncate">{name}</span>
                      {p.is_admin && <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 800, color: C.gold }}><ShieldCheck size={14} aria-hidden />Staff</span>}
                      {p.is_ambassador && <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 800, color: '#A8E0B8' }}><Sparkles size={14} aria-hidden />Ambassador</span>}
                      {p.is_demo && <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(237,231,216,0.7)' }}>Demo</span>}
                    </h2>
                    <p className="truncate mt-1" style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{p.email}</p>
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5" style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(237,231,216,0.85)' }}>
                      <span className="inline-flex items-center gap-1.5"><Globe size={14} aria-hidden style={{ color: C.gold }} />{p.nationality || 'No nationality'}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} aria-hidden style={{ color: C.gold }} />
                        {age !== null && age >= 0 && age < 120 ? `${age} years old` : 'No date of birth'}
                      </span>
                      <span className="inline-flex items-center gap-1.5"><History size={14} aria-hidden style={{ color: C.gold }} />Joined {fmtDate(p.created_at)}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden style={{ color: C.gold }} />Seen {timeAgo(p.last_sign_in_at)}</span>
                      {p.mun_experience_level && <span>{roleLabel(p.mun_experience_level)}</span>}
                      {p.education_level && <span>{roleLabel(p.education_level)}</span>}
                    </div>
                  </div>

                  <div className="absolute flex items-center gap-2" style={{ top: 16, right: 16 }}>
                    <Link
                      href={cvHref(p.id, p.display_name) ?? `/cv/${p.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2"
                      style={{ padding: '7px 12px', borderRadius: 999, border: '1.5px solid rgba(238,217,138,0.35)', background: 'rgba(0,0,0,0.18)', color: C.ivory, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}
                    >
                      Public CV <ArrowUpRight size={13} aria-hidden />
                    </Link>
                    <button
                      type="button"
                      onClick={requestClose}
                      aria-label="Close"
                      className="flex items-center justify-center focus:outline-none focus-visible:ring-2"
                      style={{ width: 34, height: 34, borderRadius: 999, cursor: 'pointer', border: '1.5px solid rgba(238,217,138,0.35)', background: 'rgba(0,0,0,0.18)', color: C.ivory }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </header>

                {/* ── Numbers strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ background: C.ivory, borderBottom: HAIRLINE }}>
                  {[
                    {
                      icon: Ticket, tint: C.goldDeep, label: p.unlimited ? 'Plan' : 'Credits left',
                      value: p.unlimited ? `Unlimited${p.unlimited.status === 'trialing' ? ' (trial)' : ''}` : int(p.credits_remaining),
                    },
                    { icon: FileText, tint: C.sky, label: 'Credits used', value: int(p.credits_used) },
                    { icon: CreditCard, tint: C.goldDeep, label: 'Credits bought', value: int(p.credits_bought) },
                    { icon: Star, tint: C.plum, label: 'Points', value: int(p.points_balance) },
                    {
                      icon: Wallet, tint: C.forestLight, label: 'Paid via Gavelling',
                      value: paid.filter(x => (x.stripe_cents ?? 0) > 0).map(x => money(x.stripe_cents, x.currency)).join(' + ') || 'Nothing',
                    },
                    { icon: Building2, tint: C.forest, label: 'Organises', value: int(rec.organised.length) },
                  ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} style={{ padding: '14px 18px', borderInlineStart: i === 0 ? 'none' : HAIRLINE }}>
                        <p className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
                          <Icon size={13} strokeWidth={2.4} style={{ color: s.tint }} aria-hidden />{s.label}
                        </p>
                        <p className="mt-1 truncate" style={{ fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: '-0.02em', ...NUM }}>{s.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: '22px 28px 28px' }}>
                  {p.bio && (
                    <p className="mb-6" style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, padding: '10px 14px', borderRadius: 14, background: TINT_FOREST, borderInlineStart: `3px solid ${C.forestLight}` }}>
                      {p.bio}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr]" style={{ gap: 32 }}>
                    {/* ── Left: what they run and what they applied to ── */}
                    <div className="min-w-0">
                      <Section icon={Building2} tint={C.goldDeep} title="Conferences they organise" count={rec.organised.length}>
                        {rec.organised.length === 0 ? <Empty>None.</Empty> : rec.organised.map(o => {
                          const title = o.acronym?.trim() || o.full_name;
                          const intent = getConferenceIntent(o.intent);
                          const labels = intentLabels(intent);
                          return (
                            <div key={o.id} style={{ borderTop: HAIRLINE, padding: '11px 2px' }}>
                              <a href={`/manage/${o.slug}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2" style={{ textDecoration: 'none' }}>
                                <LogoWithBadge src={o.logo_url} text={title} size={46}
                                  badge={o.country ? <CircleFlag country={o.country} size={18} ring={false} decorative /> : undefined} />
                                <span className="flex-1 min-w-0">
                                  <span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>
                                    <span className="truncate">{title}</span>
                                    <VerifiedCheck verified={o.is_verified} showUnverified size={15} title={o.is_verified ? 'Verified' : 'Not verified yet'} />
                                  </span>
                                  <span className="block truncate" style={{ fontSize: 12, color: C.inkSoft }}>
                                    {title !== o.full_name && <>{o.full_name} · </>}{datesLabel(o)}{o.city || o.country ? ` · ${[o.city, o.country].filter(Boolean).join(', ')}` : ''}
                                  </span>
                                  <span className="flex items-center gap-3 mt-0.5" style={{ fontSize: 11.5 }}>
                                    <span style={{ fontWeight: 800, color: o.role === 'owner' ? C.goldDeep : C.inkSoft }}>{roleLabel(o.role)}</span>
                                    {o.is_public ? <Word icon={Globe} colour={C.forestLight}>Published</Word> : <Word icon={PencilLine} colour={C.inkSoft}>Draft</Word>}
                                    {o.is_demo && <span style={{ color: C.inkSoft }}>Demo</span>}
                                    <span style={{ color: C.inkSoft, ...NUM }}>{int(o.applications)} applications · {int(o.committees)} committees</span>
                                  </span>
                                </span>
                                <ArrowUpRight size={14} aria-hidden className="flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: C.forest }} />
                              </a>
                              {/* What they came for: the creation wizard's intent answer. */}
                              <div className="mt-2 flex items-start gap-2" style={{ padding: '7px 10px', borderRadius: 10, background: labels.length ? TINT_GOLD : TINT_FOREST, fontSize: 12 }}>
                                <Target size={13} strokeWidth={2.4} aria-hidden style={{ color: C.goldDeep, marginTop: 2, flexShrink: 0 }} />
                                <span style={{ color: C.ink }}>
                                  <strong style={{ fontWeight: 800 }}>Came for </strong>
                                  {labels.length
                                    ? labels.join(' · ')
                                    : intent.skipped ? <span style={{ color: C.inkSoft }}>skipped the question</span>
                                    : <span style={{ color: C.inkSoft }}>never asked (created before the question existed)</span>}
                                  {intent.other && <span style={{ color: C.inkSoft }}> · “{intent.other}”</span>}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </Section>

                      <Section icon={FileText} tint={C.sky} title="Applications" count={rec.applications.length}>
                        {rec.applications.length === 0 ? <Empty>None.</Empty> : rec.applications.map(a => {
                          const st = statusLook(a.status);
                          const seat = a.country_name || a.country_code;
                          return (
                            <Row
                              key={a.id}
                              href={`/manage/${a.slug}/applications`}
                              lead={<LogoWithBadge src={a.logo_url} text={a.conference} size={42}
                                badge={a.committee_logo ? <LogoDisc src={a.committee_logo} alt="" size={18} fallbackText={(a.committee ?? '').slice(0, 2)} /> : undefined} />}
                              title={<>
                                <span className="truncate">{a.conference}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>{roleLabel(a.role)}{a.is_head_delegate ? ' (head)' : ''}</span>
                              </>}
                              detail={<span className="flex items-center gap-2 flex-wrap">
                                <Word icon={st.icon} colour={st.colour}>{st.word}</Word>
                                {a.committee && <span title={a.committee_full ?? undefined}>{a.committee}</span>}
                                {seat && (
                                  <span className="inline-flex items-center gap-1.5" style={{ color: C.ink, fontWeight: 700 }}>
                                    <CircleFlag code={a.country_code} country={a.country_name} size={16} decorative />
                                    {a.country_name || a.country_code}
                                  </span>
                                )}
                                {a.society && <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden />{a.society}</span>}
                              </span>}
                              trail={a.submitted_at ? fmtDate(a.submitted_at) : 'Not submitted'}
                            />
                          );
                        })}
                      </Section>

                      <Section icon={Gavel} tint={C.forestLight} title="Chairs at conferences" count={rec.chair_roles.length}>
                        {rec.chair_roles.length === 0 ? <Empty>Not on any dais.</Empty> : rec.chair_roles.map(r => {
                          const room = roomState(r.room_phase, r.room_ended_at);
                          return (
                            <Row
                              key={r.id}
                              highlight={room.live}
                              href={`/manage/${r.slug}/committees`}
                              lead={<LogoWithBadge src={r.committee_logo} text={r.committee} size={42}
                                badge={<LogoDisc src={r.conference_logo} alt="" size={18} fallbackText={r.conference.slice(0, 2)} />} />}
                              title={<><span className="truncate" title={r.committee_full}>{r.committee}</span><span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>{r.conference}</span></>}
                              detail={<span className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1" style={{ color: room.colour, fontWeight: 700 }}>
                                  {room.live && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: room.colour }} />}
                                  {room.word}
                                </span>
                                {r.session_code && <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>{r.session_code}</span>}
                                {r.awards_submitted_at && <Word icon={Award} colour={C.goldDeep}>Awards submitted</Word>}
                              </span>}
                            />
                          );
                        })}
                      </Section>

                      <Section
                        icon={Mic}
                        tint={C.plum}
                        title="Session rooms"
                        count={rec.sessions.length}
                        note={
                          <p style={{ padding: '8px 11px', borderRadius: 10, background: TINT_FOREST, color: C.ink }}>
                            <strong>Gavelling does not record who creates a room.</strong>{' '}
                            <span style={{ color: C.inkSoft }}>
                              Sessions are anonymous (a code and typed names). These are the rooms still on record that
                              this account opened while signed in, as a chair or in a delegate seat. Standalone rooms are
                              deleted about an hour after they end, so older ones are gone.
                            </span>
                          </p>
                        }
                      >
                        {rec.sessions.length === 0 ? <Empty>No room on record for this account.</Empty> : rec.sessions.map(s => {
                          const room = roomState(s.phase, s.ended_at);
                          const standalone = s.origin !== 'conference';
                          return (
                            <Row
                              key={`${s.committee_id}-${s.as}`}
                              highlight={room.live}
                              lead={s.as === 'delegate' && s.country
                                ? <CircleFlag country={s.country} size={40} label={s.country} />
                                : standalone
                                  ? <span className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: `${C.plum}1F`, color: C.plum }}><Gavel size={18} aria-hidden /></span>
                                  : <LogoDisc src={s.conference_logo} alt="" size={40} fallbackText={(s.conference ?? 'MUN').slice(0, 3)} />}
                              title={<>
                                <span className="truncate">{s.name || 'Untitled room'}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
                                  {s.as === 'chair' ? 'Chair' : `Delegate${s.country ? `, ${s.country}` : ''}`}
                                </span>
                              </>}
                              detail={<>
                                {s.topic && s.topic !== 'TBD' && <span className="block truncate" style={{ color: C.ink }}>Topic: {s.topic}</span>}
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span style={{ color: room.colour, fontWeight: 700 }}>{room.word}</span>
                                  <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>{s.code}</span>
                                  <span>{standalone ? 'Standalone' : s.conference ?? 'Conference'}</span>
                                  <span style={NUM}>{int(s.delegates)} delegations</span>
                                </span>
                              </>}
                              trail={<>
                                <span className="block">{fmtDate(s.first_seen)}</span>
                                <span className="block">seen {timeAgo(s.last_seen)}</span>
                              </>}
                            />
                          );
                        })}
                      </Section>
                    </div>

                    {/* ── Right: delegations, honours, money, email ── */}
                    <div className="min-w-0">
                      <Section icon={Users} tint={C.forestLight} title="Delegations" count={rec.delegations.length}>
                        {rec.delegations.length === 0 ? <Empty>None.</Empty> : rec.delegations.map(d => (
                          <Row
                            key={d.id}
                            href={`/manage/${d.slug}/applications`}
                            lead={<LogoDisc src={d.conference_logo} alt="" size={38} fallbackText={d.conference.slice(0, 3)} />}
                            title={<span className="truncate">{d.name}</span>}
                            detail={<span className="flex items-center gap-2 flex-wrap">
                              <span>{d.conference}</span>
                              {d.is_advisor && <Word icon={ScrollText} colour={C.sky}>Faculty advisor</Word>}
                              {d.is_head && <Word icon={Crown} colour={C.goldDeep}>Head delegate</Word>}
                              {!d.is_advisor && !d.is_head && <span>Member</span>}
                              <span style={NUM}>{int(d.members)} members</span>
                            </span>}
                          />
                        ))}
                      </Section>

                      <Section icon={Award} tint={C.goldDeep} title="Awards" count={rec.awards.length}>
                        {rec.awards.length === 0 ? <Empty>None.</Empty> : rec.awards.map(w => (
                          <Row
                            key={w.id}
                            highlight={w.status === 'published'}
                            lead={<LogoWithBadge src={w.conference_logo} text={w.conference} size={38}
                              badge={w.country_name || w.country_code ? <CircleFlag code={w.country_code} country={w.country_name} size={16} ring={false} decorative /> : undefined} />}
                            title={<span className="truncate">{w.label}</span>}
                            detail={<span className="flex items-center gap-2 flex-wrap">
                              <span>{[w.conference, w.committee, w.country_name].filter(Boolean).join(' · ')}</span>
                              {w.status === 'published'
                                ? <Word icon={BadgeCheck} colour={C.forestLight}>Published</Word>
                                : <Word icon={Clock} colour={C.amber}>{roleLabel(w.status)}, not public</Word>}
                            </span>}
                            trail={w.points ? `${int(w.points)} pts` : undefined}
                          />
                        ))}
                      </Section>

                      <Section icon={ScrollText} tint={C.sky} title="MUN CV" count={rec.cv_entries.length}>
                        {rec.cv_entries.length === 0 ? <Empty>No experience recorded.</Empty> : rec.cv_entries.map(e => {
                          const awards = (e.awards ?? []).filter(a => a && a !== 'None');
                          const verified = e.source === 'gavelling_verified';
                          const title = e.conference_name || 'Untitled';
                          return (
                            <Row
                              key={e.id}
                              lead={<LogoWithBadge src={e.logo_url || e.conference_logo} text={title} size={38}
                                badge={e.allocation && getCountryByName(e.allocation) ? <CircleFlag country={e.allocation} size={16} ring={false} decorative /> : undefined} />}
                              title={<><span className="truncate">{title}</span><VerifiedCheck verified={verified} showUnverified size={13} title={verified ? 'Verified by Gavelling' : 'Self-reported'} /></>}
                              detail={<span className="flex items-center gap-2 flex-wrap">
                                <span>{[e.entry_type ? roleLabel(e.entry_type) : null, e.committee, e.allocation].filter(Boolean).join(' · ')}</span>
                                {awards.map(a => <Word key={a} icon={Award} colour={C.goldDeep}>{a}</Word>)}
                              </span>}
                              trail={e.event_date ? dayLabel(e.event_date) : fmtDate(e.created_at)}
                            />
                          );
                        })}
                      </Section>

                      <Section icon={Wallet} tint={C.forestLight} title="Payments">
                        {paid.length === 0 ? <Empty>No payment on record.</Empty> : (
                          <div className="mb-2 flex flex-col" style={{ gap: 6 }}>
                            {paid.map(x => (
                              <div key={x.currency} className="flex items-baseline gap-3 flex-wrap" style={{ padding: '9px 12px', borderRadius: 12, background: TINT_FOREST, fontSize: 12, color: C.inkSoft }}>
                                <span><strong style={{ fontSize: 17, fontWeight: 900, color: C.ink, ...NUM }}>{money(x.stripe_cents, x.currency)}</strong> via Gavelling</span>
                                {(x.offline_cents ?? 0) > 0 && <span><strong style={{ color: C.ink, ...NUM }}>{money(x.offline_cents, x.currency)}</strong> recorded offline</span>}
                                {x.pending > 0 && <span style={NUM}>{int(x.pending)} pending</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {rec.payments.recent.map(py => (
                          <Row
                            key={py.id}
                            lead={<LogoDisc src={py.conference_logo} alt="" size={30} fallbackText={py.conference.slice(0, 3)} />}
                            title={<span style={{ fontSize: 13, ...NUM }}>{money(py.amount_cents, py.currency)}</span>}
                            detail={<>{py.conference} · {py.method === 'stripe' ? 'Card' : 'Offline'} · <span style={{ color: py.status === 'succeeded' ? C.forestLight : C.amber, fontWeight: 700 }}>{roleLabel(py.status)}</span></>}
                            trail={fmtDate(py.created_at)}
                          />
                        ))}
                      </Section>

                      <Section icon={Mail} tint={C.sky} title="Emails we sent" count={rec.emails.length}>
                        {rec.emails.length === 0 ? <Empty>Nothing on record.</Empty> : rec.emails.map(m => (
                          <div key={m.id} className="flex items-center gap-2" style={{ padding: '8px 2px', borderTop: HAIRLINE, fontSize: 12 }}>
                            <span className="truncate flex-1" style={{ color: C.ink }}>{m.subject}</span>
                            <span style={{ fontWeight: 700, color: m.status === 'sent' ? C.forestLight : m.status === 'failed' ? RED : C.inkSoft }}>{roleLabel(m.status)}</span>
                            <span style={{ color: C.inkSoft, ...NUM }}>{fmtDate(m.sent_at ?? m.created_at)}</span>
                          </div>
                        ))}
                      </Section>

                      {p.email && (
                        <Section icon={Send} tint={C.goldDeep} title={`Email ${name.split(' ')[0]}`}>
                          <EmailDraft to={p.email} name={name} />
                        </Section>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </GrowDialog>
    </Portal>
  );
}
