'use client';

// The Overview of every role that is not in a delegation (owner, 22 Oct 2026:
// "make sure the faculty advisor, really everything, the staff and press and
// everything looks how it should"). The same building blocks as the
// delegation Overview (DelegationOverview): two equal white lifted cards side
// by side on a laptop, stacked and compact on a phone, both inside one screen
// at 1280x800.
//   left    what you are and where you sit: a delegate's seat (SeatCard: the
//           round flag, the committee logo, topics, the guide and paper
//           tiles), else "Your Role" (YouCard: your avatar opening your MUN
//           CV, your name, the role, its status) with what the role gives
//           you (AccessRow: the committees an observer follows, the
//           organiser dashboard for the secretariat and staff)
//   right   "What's Next" (NextCard): the one next step with at most one
//           button (pay, join the room, hand in the paper), then where the
//           application and the fee stand, then a quiet way to the organisers
// Presentation only: every value comes from the page's reads, except the team
// row of a secretariat or staff member (useTeamSeat, their own
// conference_organizers row under RLS; a failed read draws the plain role).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown, ArrowRight, BadgeCheck, Briefcase, CheckCircle2, Crown, Eye, Flag, Gavel, GraduationCap,
  LayoutDashboard, Newspaper,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { ORGANIZER_SECTIONS, type PermissionMap } from '@/lib/organizerPermissions';
import LockedPayButton from './PaymentsLocked';
import { roleLabel } from './shared';
import { AppStatusMark, PaymentMark, type NextStep, type StatusRowInput } from './dashboardKit';
import { BTN_CLASS, cardStyle, CommitteeDisc, committeeEmblemSrc, CvAvatar, FONT, INK, INK_SOFT, LINE, linkStyle, OK_GREEN, secondaryBtn, STROKE } from './delegation/leaderKit';
import { CardTitle, OVERVIEW_CARD, mainBtn } from './delegation/overview/SeatCard';
import type { ParticipantCommittee } from './types';

const ROLE_ICON: Record<string, LucideIcon> = {
  delegate: Flag,
  'head-delegate': Crown,
  'faculty-advisor': GraduationCap,
  observer: Eye,
  chair: Gavel,
  secretariat: Briefcase,
  staff: BadgeCheck,
  press: Newspaper,
};

/** Two cards of exactly the same height side by side; stacked on a phone. */
export function OverviewPair({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="@container min-w-0">
      <div className="grid gap-4 sm:gap-6 @[760px]:grid-cols-2 items-stretch">
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">{left}</div>
        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">{right}</div>
      </div>
    </div>
  );
}

/** One thing the role gives you: a fine-line icon, a title, one plain line, an optional action. */
export function AccessRow({ icon: Icon, title, line, action, children }: {
  icon: LucideIcon;
  title: string;
  line?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 min-w-0" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
      <div className="flex items-start gap-3 min-w-0 flex-wrap">
        <Icon size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5" style={{ minWidth: 160 }}>
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{title}</span>
          {line && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45 }}>{line}</span>}
        </div>
        {action && <div className="flex-none">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** "Your Role": who you are here. The avatar opens your public MUN CV. */
export function YouCard({ role, status, title, children }: {
  role: string;
  status: string;
  /** A team title the organisers gave (Secretary-General), drawn over the role word. */
  title?: string | null;
  children?: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const name = profile?.display_name?.trim() || 'You';
  const Icon = ROLE_ICON[role] ?? Briefcase;
  const word = roleLabel(role);
  const named = (title ?? '').trim();
  return (
    <section aria-label="Your role" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Your Role</CardTitle>
      <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
        <span style={{ borderRadius: '50%', boxShadow: '0 10px 22px color-mix(in srgb, var(--gv-main) 16%, transparent)', lineHeight: 0 }}>
          <CvAvatar userId={user?.id ?? null} name={name} url={profile?.avatar_url ?? null} size={88} seed={user?.id ?? name} nested={false} />
        </span>
        <p className="[overflow-wrap:anywhere] max-w-full" style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: INK, margin: '6px 0 0 0', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {name}
        </p>
        <span className="inline-flex items-center gap-2 max-w-full" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>
          <Icon size={18} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
          <span className="[overflow-wrap:anywhere]">{named || word}</span>
        </span>
        {named && named.toLowerCase() !== word.toLowerCase() && (
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{word}</span>
        )}
        <span className="mt-1"><AppStatusMark status={status} size="sm" /></span>
      </div>
      {children}
    </section>
  );
}

/** The committees of the conference as a row of logos, the count beside them. */
export function CommitteesRow({ committees, line, onOpen }: {
  committees: ParticipantCommittee[];
  line: string;
  onOpen?: () => void;
}) {
  const shown = committees.slice(0, 6);
  const n = committees.length;
  return (
    <AccessRow
      icon={Eye}
      title={n === 0 ? 'Committees' : `${n} ${n === 1 ? 'committee' : 'committees'}`}
      line={n === 0 ? 'The organisers have not added committees yet.' : line}
      action={onOpen && n > 0 ? (
        <button type="button" onClick={onOpen} className={BTN_CLASS} style={secondaryBtn}>
          See committees <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </button>
      ) : undefined}
    >
      {shown.length > 0 && (
        <ul className="flex items-center flex-wrap" style={{ listStyle: 'none', margin: 0, padding: '0 0 0 34px' }} aria-label="Committees">
          {shown.map((c, i) => (
            <li key={c.id} title={c.name} style={{ marginLeft: i === 0 ? 0 : -6, borderRadius: '50%', boxShadow: '0 0 0 2px #FFFFFF', lineHeight: 0 }}>
              <CommitteeDisc src={committeeEmblemSrc(c.logo_url, c.name, c.abbreviation)} size={30} />
              <span className="sr-only">{c.name}</span>
            </li>
          ))}
          {n > shown.length && (
            <li style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT, marginLeft: 8 }}>+{n - shown.length}</li>
          )}
        </ul>
      )}
    </AccessRow>
  );
}

// ── The secretariat and staff: their own team row ────────────────────────────

export interface TeamSeat { role: string | null; publicTitle: string | null; permissions: PermissionMap }

/** The viewer's own conference_organizers row (RLS shows a team member their
 *  team). Keyed on the user id; null while reading, on a failed read or when
 *  they are not on the team. */
export function useTeamSeat(conferenceId: string, enabled: boolean): TeamSeat | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = enabled && userId ? `${userId}|${conferenceId}` : null;
  const [loaded, setLoaded] = useState<{ key: string; seat: TeamSeat | null } | null>(null);
  useEffect(() => {
    if (!key || !userId) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client
        .from('conference_organizers')
        .select('role, public_title, permissions')
        .eq('conference_id', conferenceId)
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const row = error ? null : (data as { role: string | null; public_title: string | null; permissions: PermissionMap | null } | null);
      setLoaded({ key, seat: row ? { role: row.role, publicTitle: row.public_title, permissions: row.permissions ?? {} } : null });
    })();
    return () => { cancelled = true; };
  }, [key, userId, conferenceId]);
  return key && loaded?.key === key ? loaded.seat : null;
}

/** What a team member can open in the organiser dashboard, as icon + word. */
export function TeamSections({ seat }: { seat: TeamSeat }) {
  const everything = seat.role === 'owner';
  const granted = ORGANIZER_SECTIONS.filter(s => everything || seat.permissions[s.key] === true);
  if (granted.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" style={{ listStyle: 'none', margin: 0, padding: '0 0 0 34px' }} aria-label="What you can open">
      {granted.map(s => {
        const Icon = s.icon;
        return (
          <li key={s.key} title={s.blurb} className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 13.5, color: INK }}>
            <Icon size={15} strokeWidth={STROKE} aria-hidden style={{ color: INK_SOFT }} />
            {s.label}
          </li>
        );
      })}
    </ul>
  );
}

// ── What's Next ───────────────────────────────────────────────────────────────

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** The step's one button, in the conference's own colour (the view's one primary). */
function StepButton({ action }: { action: NonNullable<NextStep['action']> }) {
  if ('href' in action && action.lockedSlug) {
    return <LockedPayButton slug={action.lockedSlug} label={<>{action.label}</>} className={`${BTN_CLASS} w-full sm:w-auto`} style={mainBtn} />;
  }
  if ('href' in action) {
    return action.external
      ? <a href={action.href} className={`${BTN_CLASS} w-full sm:w-auto`} style={mainBtn}>{action.label} <ArrowRight size={16} strokeWidth={STROKE} aria-hidden /></a>
      : <Link href={action.href} className={`${BTN_CLASS} w-full sm:w-auto`} style={mainBtn}>{action.label} <ArrowRight size={16} strokeWidth={STROKE} aria-hidden /></Link>;
  }
  return (
    <button type="button" onClick={() => scrollToAnchor(action.scrollTo)} className={`${BTN_CLASS} w-full sm:w-auto`} style={mainBtn}>
      {action.label} <ArrowDown size={16} strokeWidth={STROKE} aria-hidden />
    </button>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: INK_SOFT }}>{label}</span>
      {children}
    </div>
  );
}

export function NextCard({ step, fallbackLine, status, payment, onAsk }: {
  step: NextStep | null;
  /** The line when no step was worked out (nextStepSentence). */
  fallbackLine: string;
  status: string;
  payment: Pick<StatusRowInput, 'feeToday' | 'paymentStatus' | 'selfPaid' | 'amountPaid' | 'paymentTiming' | 'status'>;
  /** Opens Ask the Organisers. */
  onAsk?: () => void;
}) {
  const done = !step || step.kind === 'done';
  const line = step?.line ?? fallbackLine;
  const action = step?.kind === 'action' ? step.action : undefined;
  return (
    <section aria-label="What's next" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>What&apos;s Next</CardTitle>
      <div className="flex items-start gap-3 min-w-0">
        {done && <CheckCircle2 size={24} strokeWidth={STROKE} aria-hidden style={{ color: OK_GREEN, flexShrink: 0, marginTop: 1 }} />}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {done && <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, lineHeight: 1.3 }}>You&apos;re all set</span>}
          <p
            className="[overflow-wrap:anywhere]"
            style={done
              ? { fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, margin: 0, lineHeight: 1.5 }
              : { fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.4 }}
          >
            {line}
          </p>
        </div>
      </div>
      {action && <div><StepButton action={action} /></div>}

      <div className="mt-auto grid grid-cols-2 gap-4" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <Fact label="Application"><AppStatusMark status={status} size="md" /></Fact>
        <Fact label="Payment"><PaymentMark input={payment} size="md" /></Fact>
      </div>
      {onAsk && (
        <div className="flex justify-end">
          <button type="button" onClick={onAsk} className={`${BTN_CLASS} rounded-lg`} style={{ ...linkStyle, minHeight: 36, padding: '0 6px' }}>
            Ask the organisers
          </button>
        </div>
      )}
    </section>
  );
}

/** The team row's dashboard button: primary only when the step beside it has none. */
export function DashboardLink({ slug, primary }: { slug: string; primary: boolean }) {
  return (
    <Link href={`/manage/${slug}`} className={BTN_CLASS} style={primary ? mainBtn : secondaryBtn}>
      <LayoutDashboard size={16} strokeWidth={STROKE} aria-hidden />
      Open organiser dashboard
    </Link>
  );
}
