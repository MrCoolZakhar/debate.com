'use client';

import { useState, useEffect, useMemo } from 'react';
import { notifyOk } from '@/lib/appNotify';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Rocket, Mail, Gavel, UsersRound, UserPlus, Wallet, Palette,
  Inbox, Globe2, CheckCircle2, AlertCircle, ArrowRight,
  Activity, UserRoundCheck, MapPin, RotateCcw, Trophy,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { formatFee } from '@/lib/utils';
import { LogoDisc } from '@/components/LogoDisc';
import Avatar from '@/components/Avatar';
import ProfileLink from '@/components/ProfileLink';
import {
  NeuCard, NeuInset, NeuIconDisc, NeuProgress, NeuRing,
  NeuPill, NeuButton, NeuChecklistRow, Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE,
} from '@/components/neu';
import Portal from '@/components/Portal';
import DecorativeBleed from '@/components/DecorativeBleed';
import ParticipantsChart, { toCumulativeSeries } from '@/components/conferences/ParticipantsChart';
import ApplicantsDial from '@/components/conferences/ApplicantsDial';
import { conferencePaymentsReady, paymentGateBlocks, paymentGateMessage } from '@/lib/payments';
import { hasExploredEmails } from '@/lib/emailsExplored';
import { getAwardsConfig, chairDeadline } from '@/lib/awards';
import { useScrollLock } from '@/hooks/useScrollLock';

const RED = '#A8442F';

// ── Publish modal ──────────────────────────────────────────────────────────

function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; slug: string; full_name: string };
  onClose: () => void;
  onPublished: () => void;
}) {
  // Modal: freeze the dashboard behind it.
  useScrollLock(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const { session } = useAuth();

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    if (!session) { setPublishing(false); return; }
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id);
    if (error) {
      setPublishing(false);
      setPublishError(error.message);
      return;
    }
    // Fire-and-forget: ping search engines (IndexNow) so the newly public
    // conference page gets crawled right away.
    void fetch('/api/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: conference.slug }),
    }).catch(() => {});
    setPublishing(false);
    onPublished();
  }

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-xl mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Publish Conference?
        </h2>
        <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Your conference will appear publicly on gavelling.com/conferences and delegates will be able to apply.
        </p>
        {publishError && (
          <p className="text-sm mb-4" style={{ color: RED, fontFamily: OUTFIT }}>{publishError}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: publishing ? '#DDD4C0' : '#1B3828',
              color: publishing ? NEU.muted : NEU.gold,
              fontFamily: OUTFIT,
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {publishing ? 'PUBLISHING...' : 'PUBLISH NOW'}
          </button>
        </div>
      </div>
    </div></Portal>
  );
}

// ── First-delegate share modal ─────────────────────────────────────────────
// House recipe for "Get your first delegate": copy the public conference
// link, plus an Instagram-story prompt with a pre-written caption.

function ShareModal({
  conference,
  onClose,
}: {
  conference: { slug: string; full_name: string; acronym: string };
  onClose: () => void;
}) {
  // Modal: freeze the dashboard behind it.
  useScrollLock(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gavelling.com';
  const publicUrl = `${origin}/conferences/${conference.slug}`;
  const caption = `Applications for ${conference.full_name} are open! Apply as a delegate here ↓\n${publicUrl}`;

  async function copy(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (http / permissions), fall back silently.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <Emoji3D name="Megaphone" size={30} fallback={UserPlus} fallbackColor={NEU.forest} />
          <h2 className="font-black text-xl" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Get your first delegate
          </h2>
        </div>
        <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Share your conference page. Anyone who opens it can apply as a delegate.
        </p>

        {/* Public link + copy */}
        <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, marginBottom: 6 }}>
          YOUR PUBLIC LINK
        </p>
        <div className="flex items-center gap-2 mb-5">
          <NeuInset className="flex-1 min-w-0" style={{ padding: '9px 12px', borderRadius: 12 }}>
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}>
              {publicUrl}
            </p>
          </NeuInset>
          <button
            onClick={() => copy(publicUrl, setCopiedLink)}
            className="flex-shrink-0 rounded-xl py-2.5 px-4 font-bold text-xs tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: copiedLink ? '#3D7A52' : '#1B3828',
              color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em',
              border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!copiedLink) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!copiedLink) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {copiedLink ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>

        {/* Instagram story prompt */}
        <div className="rounded-xl p-4 mb-5" style={{ border: '1.5px solid rgba(182,135,31,0.35)', backgroundColor: 'rgba(238,217,138,0.14)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Emoji3D name="Camera with flash" size={20} fallback={ArrowRight} fallbackColor={NEU.deepGold} />
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', color: NEU.ink }}>
              SHARE TO YOUR STORY
            </p>
          </div>
          <p
            className="rounded-lg p-2.5 mb-2.5"
            style={{
              fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.45,
              backgroundColor: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-line', wordBreak: 'break-word',
            }}
          >
            {caption}
          </p>
          <div className="flex items-center justify-between gap-3">
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.4 }}>
              Paste the link into your story&apos;s link sticker.
            </p>
            <button
              onClick={() => copy(caption, setCopiedCaption)}
              className="flex-shrink-0 rounded-xl py-2 px-3.5 font-bold text-xs tracking-widest transition-colors focus:outline-none"
              style={{
                backgroundColor: 'transparent',
                color: copiedCaption ? '#3D7A52' : NEU.deepGold,
                border: `1.5px solid ${copiedCaption ? '#3D7A52' : 'rgba(182,135,31,0.5)'}`,
                fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {copiedCaption ? 'CAPTION COPIED ✓' : 'COPY CAPTION'}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
        >
          DONE
        </button>
      </div>
    </div></Portal>
  );
}

// ── Application row shape ─────────────────────────────────────────────────
// The dashboard's one raw feed of applications. It used to also serve a
// hand-rolled revenue bar chart (with its own 24H/7D/30D/ALL bucketing
// helpers); that chart and its bucketing were removed on request, so this is
// now read only by ParticipantsChart's cumulative roll and the dial counts.

interface AppRow {
  submitted_at: string;
  status: string;
  payment_status: string | null;
  role: string;
  society_id: string | null;
}

// ── Unallocated-delegates alert tile ───────────────────────────────────────
// Amber alarm while accepted delegates await committee allocation; calm
// green once everyone is placed. Links straight to the assignment board.

function UnallocatedTile({ count, href }: { count: number; href: string }) {
  const [hovered, setHovered] = useState(false);
  const ok = count === 0;
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col"
      style={{
        textDecoration: 'none',
        minWidth: 0,
        justifyContent: 'space-between',
        padding: '13px 15px',
        borderRadius: 22,
        backgroundColor: NEU.surface,
        backgroundImage: ok
          ? 'linear-gradient(rgba(61,122,82,0.10), rgba(61,122,82,0.10))'
          : 'linear-gradient(rgba(184,132,74,0.12), rgba(184,132,74,0.12))',
        border: ok ? '1.5px solid rgba(61,122,82,0.35)' : '1.5px solid rgba(184,132,74,0.4)',
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Emoji3D
          name={ok ? 'Check mark button' : 'Red exclamation mark'}
          size={32}
          fallback={ok ? CheckCircle2 : AlertCircle}
          fallbackColor={ok ? NEU.green : NEU.amber}
        />
        <ArrowRight size={13} style={{ color: ok ? NEU.green : NEU.amber, opacity: hovered ? 1 : 0.6, transform: hovered ? 'translateX(2px)' : 'none', transition: `transform 200ms ${EASE}` }} />
      </div>
      {ok ? (
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.green, lineHeight: 1.2 }}>
            All delegates allocated
          </p>
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, marginTop: 3 }}>
            Nothing waiting for assignment
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 27, fontWeight: 900, color: NEU.amber, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {count}
          </p>
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: '#8A5A2E', marginTop: 4 }}>
            Unallocated delegates
          </p>
        </div>
      )}
    </Link>
  );
}

// The old PipelineCell / "Delegates" pipeline card and the Applications +
// Accepted stat tiles were deleted here, not misplaced: the rewritten
// ApplicantsDial prints Applications / Accepted / Assigned / Paid in its key
// and deep-links each one, so those cards were the same four numbers a third
// and fourth time. Removing them is most of what bought the single screen.

// ── Dashboard data shape ───────────────────────────────────────────────────

interface DashData {
  apps: AppRow[];
  allocated: number;
  /**
   * `conference_allocations.created_at` for every allocation, newest or oldest
   * order irrelevant. The dashboard used to take a head-only COUNT here, which
   * is enough for a tile but gives the Assigned series no timestamps to plot —
   * ParticipantsChart needs the actual instants. `allocated` is now derived
   * from this array's length, so the two can never disagree.
   */
  allocatedAt: (string | null)[];
  committees: { id: string; chair_user_ids: string[] | null; committee_country_slots?: { delegation_size: number | null }[] | null }[];
  organizerCount: number;
  enabledEmailCount: number;
  /**
   * Committee ids with a still-pending chair invite. A dais with an invite out
   * counts as staffed for the set-up checklist — the organiser has done their
   * part; the rest is up to the invitee.
   */
  pendingChairInviteCommitteeIds: string[];
  /** Pending co-organizer invites — one is enough to clear the secretariat row. */
  pendingOrganizerInvites: number;
}

// ── Recent activity feed ───────────────────────────────────────────────────
// The dashboard above shows the STATE of the conference (how many accepted,
// paid, allocated). This bottom strip shows its MOMENTUM: a live "what just
// happened" timeline built from the timestamps that already exist on
// applications (submitted / paid / checked-in / resubmitted) and allocations.

type ActivityKind = 'application' | 'payment' | 'checkin' | 'resubmit' | 'allocation'
  | 'accepted' | 'rejected' | 'decision';

/**
 * Organiser decisions, keyed by the status the row LANDED on. The word is what
 * the feed prints, so it reads as an outcome rather than a database value.
 * A status missing from this map produces no row at all — better silent than
 * a line nobody can parse.
 *
 * 'checked-in' is absent on purpose: check-in has its own event (checked_in_at)
 * and nothing writes decided_at for it. 'assigned' is here for chair seatings,
 * but is suppressed below whenever an allocation event already tells it better.
 */
const DECISION_WORD: Record<string, string> = {
  accepted: 'accepted',
  rejected: 'rejected',
  waitlisted: 'waitlisted',
  assigned: 'assigned',
  withdrawn: 'withdrawn',
  submitted: 'reopened for review',
};

function decisionKind(status: string): ActivityKind {
  return status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : 'decision';
}

export interface ActivityEvent {
  key: string;
  ts: number;
  kind: ActivityKind;
  name: string;
  detail?: string;
  /**
   * The person the row is ABOUT. Carried so the full-list modal can show their
   * profile picture beside the sentence; the compact card deliberately does
   * not, because it already prints an event-kind disc and an actor chip in a
   * 34%-wide column and a third face per row would crowd both out.
   *
   * `id` is null for an invited-but-unclaimed applicant (no account yet) and
   * for a delegation-level allocation — in both cases there is no profile and
   * ProfileLink correctly renders the name unlinked.
   */
  subject?: { id: string | null; avatarUrl: string | null };
  /**
   * The ORGANISER who performed the action, when one is recorded and they are
   * not the subject of the row themselves. Self-service events (a delegate
   * applying, paying, resubmitting) never carry one — nor do rows written
   * before applications.checked_in_by / conference_allocations.assigned_by
   * existed, which are all null. Absent → the row renders exactly as before.
   */
  actor?: { id: string; name: string; avatarUrl: string | null };
}

const ACTIVITY_META: Record<ActivityKind, { icon: typeof Inbox; gradient: [string, string]; verb: string }> = {
  application: { icon: Inbox,          gradient: NEU_GRADIENTS.forest, verb: 'applied' },
  payment:     { icon: Wallet,         gradient: NEU_GRADIENTS.green,  verb: 'paid' },
  checkin:     { icon: UserRoundCheck, gradient: NEU_GRADIENTS.sage,   verb: 'checked in' },
  resubmit:    { icon: RotateCcw,      gradient: NEU_GRADIENTS.amber,  verb: 'resubmitted' },
  allocation:  { icon: MapPin,         gradient: NEU_GRADIENTS.gold,   verb: 'allocated' },
  accepted:    { icon: CheckCircle2,   gradient: NEU_GRADIENTS.green,  verb: 'accepted' },
  // Shares amber with resubmit; the AlertCircle glyph is what separates them.
  rejected:    { icon: AlertCircle,    gradient: NEU_GRADIENTS.amber,  verb: 'rejected' },
  decision:    { icon: Gavel,          gradient: NEU_GRADIENTS.forest, verb: 'decided' },
};

/** Compact relative time: "just now", "5m", "3h", "2d", "3w". */
function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.round(d / 7)}w ago`;
}

function roleWord(role: string): string {
  const map: Record<string, string> = {
    delegate: 'Delegate', 'head-delegate': 'Head delegate', chair: 'Chair',
    'faculty-advisor': 'Faculty advisor', observer: 'Observer',
  };
  return map[role] ?? 'Delegate';
}

/**
 * How many rows the dashboard card itself paints. The rest of the feed lives
 * one click away in ActivityModal — the state is one array either way, so this
 * is a display cap, not a fetch cap.
 */
const ACTIVITY_INLINE_LIMIT = 8;

/** Absolute stamp for the modal, where there is room to be exact. */
function activityStamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function ActivityLine({ ev, now }: { ev: ActivityEvent; now: number }) {
  const meta = ACTIVITY_META[ev.kind];
  // Every sentence LEADS with the subject's name. The feed now lives in the
  // narrower left column beside the actor chip, so the line truncates far
  // sooner than it used to — "New delegate application from Alice" lost the
  // only word that mattered. Name first survives any truncation.
  const label =
    ev.kind === 'application' ? <><b style={{ color: NEU.ink }}>{ev.name}</b> applied{ev.detail ? ` as ${ev.detail}` : ''}</>
    : ev.kind === 'payment'   ? <><b style={{ color: NEU.ink }}>{ev.name}</b> paid{ev.detail ? ` ${ev.detail}` : ''}</>
    : ev.kind === 'checkin'   ? <><b style={{ color: NEU.ink }}>{ev.name}</b> checked in</>
    : ev.kind === 'resubmit'  ? <><b style={{ color: NEU.ink }}>{ev.name}</b> edited and resubmitted their application</>
    : ev.kind === 'accepted'  ? <><b style={{ color: NEU.ink }}>{ev.name}</b> was accepted</>
    : ev.kind === 'rejected'  ? <><b style={{ color: NEU.ink }}>{ev.name}</b> was rejected</>
    : ev.kind === 'decision'  ? <><b style={{ color: NEU.ink }}>{ev.name}</b> was {ev.detail}</>
    :                           <><b style={{ color: NEU.ink }}>{ev.name}</b> allocated{ev.detail ? ` to ${ev.detail}` : ''}</>;
  return (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      <NeuIconDisc gradient={meta.gradient} icon={meta.icon} size={26} />
      <p className="flex-1 min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
        {label}
      </p>
      {/* Who did it. Only rendered for organiser actions on someone ELSE's
          row, so the common "you accepted them" case stays quiet. Logical
          gap/flex only, so it mirrors cleanly in RTL. */}
      {ev.actor && (
        <ProfileLink
          userId={ev.actor.id}
          name={ev.actor.name}
          /* `nested`: the whole card is a role="button" with an onClick that
             opens the full-list modal, so without this, clicking the actor
             would open BOTH their CV and the modal. The card is a div rather
             than a <button> precisely so this anchor is legal inside it. */
          nested
          className="flex items-center gap-1.5 flex-shrink-0 max-w-[38%]"
        >
          <Avatar url={ev.actor.avatarUrl} name={ev.actor.name} size={18} />
          <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted }}>
            {ev.actor.name}
          </span>
        </ProfileLink>
      )}
      <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
        {timeAgo(ev.ts, now)}
      </span>
    </div>
  );
}

/**
 * The feed now sits under the set-up checklist and CLAIMS the leftover height
 * of the left column (`flex: 1`), which is what removes the void that used to
 * open up beside the taller right column. The list itself scrolls inside the
 * card, so a busy conference never lengthens the page — the dashboard stays
 * one screen no matter how much has just happened.
 */
export function RecentActivity({ events, now }: { events: ActivityEvent[]; now: number }) {
  const [showAll, setShowAll] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Nothing to expand into: an empty feed opens an empty modal, which is a
  // dead end rather than a disclosure. The card stays inert until there is
  // something to show.
  const openable = events.length > 0;
  const hidden = Math.max(0, events.length - ACTIVITY_INLINE_LIMIT);

  return (
    <>
      {/*
        WHY A MODAL AND NOT A ROUTE
        The dashboard's whole design constraint is that it fits one screen; the
        feed is the overflow valve for that. A /manage/[slug]/activity route
        would need its own nav entry, its own copy of the three queries and the
        actor-attribution pass, AND a SECTION_PERMS decision in the manage
        layout — a permission key that has to be right or the URL is open to
        every organiser. A modal reads the array this card was already handed,
        adds no route, no permission surface and no second feed, and returns the
        organiser to the dashboard where they were looking.

        The card is a div with role="button", not a <button>: each row can
        contain a ProfileLink (an <a>), and an anchor inside a button is
        invalid HTML that browsers silently unnest. The links pass `nested` so
        their click does not also open the modal.
      */}
      {/*
        A plain div, NOT <NeuCard>. NeuCard's props are a closed set
        (children/hover/onClick/href/className/style) and its body forwards only
        those — role, tabIndex, aria-label and onKeyDown passed to it are
        silently DROPPED, which would leave this card mouse-clickable but
        invisible to the keyboard and to a screen reader. JSX spread does not
        excess-property-check, so that failure is silent at compile time too.
        The style below reproduces NeuCard's surface exactly (NEU.surface,
        radius 22, NEU.out) rather than modifying the shared component.
      */}
      <div
        role={openable ? 'button' : undefined}
        tabIndex={openable ? 0 : undefined}
        aria-label={openable ? `Recent activity, ${events.length} event${events.length === 1 ? '' : 's'}. Open the full list.` : undefined}
        onClick={openable ? () => setShowAll(true) : undefined}
        onKeyDown={openable ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAll(true); }
        } : undefined}
        onMouseEnter={openable ? () => setHovered(true) : undefined}
        onMouseLeave={openable ? () => setHovered(false) : undefined}
        /* focus-visible ring: the card is keyboard-operable, and without it a
           keyboard user gets no indication that Enter does anything. */
        className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{
          backgroundColor: NEU.surface, borderRadius: 22,
          padding: '13px 16px 14px', gap: 10, flex: 1, minHeight: 168,
          cursor: openable ? 'pointer' : 'default',
          boxShadow: openable && hovered ? NEU.outHover : NEU.out,
          transition: `box-shadow 220ms ${EASE}`,
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <Activity size={15} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
          <h2 style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.deepGold }}>
            Recent activity
          </h2>
          {openable && (
            <span
              className="inline-flex items-center gap-1 flex-shrink-0"
              style={{
                marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 10,
                fontWeight: 800, letterSpacing: '0.1em', color: NEU.deepGold,
                opacity: hovered ? 1 : 0.75, transition: `opacity 220ms ${EASE}`,
              }}
            >
              {hidden > 0 ? `+${hidden} MORE` : 'SEE ALL'}
              <ArrowRight size={11} />
            </span>
          )}
        </div>
        {events.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
            Activity will appear here as delegates apply, pay, get allocated, and check in.
          </p>
        ) : (
          <div className="flex flex-col gap-2" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {events.slice(0, ACTIVITY_INLINE_LIMIT).map(ev => <ActivityLine key={ev.key} ev={ev} now={now} />)}
          </div>
        )}
      </div>

      {showAll && <ActivityModal events={events} now={now} onClose={() => setShowAll(false)} />}
    </>
  );
}

/**
 * The full feed. Same array the card was given, no second query — the card
 * simply stops painting after ACTIVITY_INLINE_LIMIT rows.
 *
 * The extra width buys back what the 34%-wide card had to spend: the sentence
 * is no longer truncated, the subject gets their profile picture, and the time
 * is an absolute stamp instead of "3d ago".
 */
function ActivityModal({ events, now, onClose }: { events: ActivityEvent[]; now: number; onClose: () => void }) {
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All recent activity"
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out, maxHeight: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0" style={{ padding: '18px 20px 12px' }}>
          <Activity size={17} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
          <div className="min-w-0">
            <h2 style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 900, color: NEU.ink }}>Recent activity</h2>
            <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
              {events.length} event{events.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-xl focus:outline-none"
            style={{
              marginInlineStart: 'auto', padding: '7px 13px', border: '1.5px solid #DDD4C0',
              backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer',
            }}
          >
            CLOSE
          </button>
        </div>

        <div className="flex flex-col" style={{ padding: '0 12px 16px', gap: 2, overflowY: 'auto', minHeight: 0 }}>
          {events.map(ev => {
            const meta = ACTIVITY_META[ev.kind];
            return (
              <div key={ev.key} className="flex items-start gap-2.5" style={{ padding: '8px 8px', borderRadius: 12 }}>
                <NeuIconDisc gradient={meta.gradient} icon={meta.icon} size={26} />
                {/* The subject's own face. `id` null (invited-but-unclaimed
                    applicant, or a delegation-level allocation) → Avatar falls
                    back to the initial disc and ProfileLink renders it
                    unlinked, which is the whole point of both components. */}
                <ProfileLink userId={ev.subject?.id} name={ev.name} className="flex-shrink-0" style={{ marginTop: 2 }}>
                  <Avatar url={ev.subject?.avatarUrl ?? null} name={ev.name} size={22} />
                </ProfileLink>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                    <b style={{ color: NEU.ink }}>{ev.name}</b>
                    {' '}
                    {ev.kind === 'application' ? `applied${ev.detail ? ` as ${ev.detail}` : ''}`
                      : ev.kind === 'payment'  ? `paid${ev.detail ? ` ${ev.detail}` : ''}`
                      : ev.kind === 'checkin'  ? 'checked in'
                      : ev.kind === 'resubmit' ? 'edited and resubmitted their application'
                      : ev.kind === 'accepted' ? 'was accepted'
                      : ev.kind === 'rejected' ? 'was rejected'
                      : ev.kind === 'decision' ? `was ${ev.detail}`
                      : `allocated${ev.detail ? ` to ${ev.detail}` : ''}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 3 }}>
                    <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {activityStamp(ev.ts)} · {timeAgo(ev.ts, now)}
                    </span>
                    {ev.actor && (
                      <ProfileLink
                        userId={ev.actor.id}
                        name={ev.actor.name}
                        className="inline-flex items-center gap-1.5 min-w-0"
                      >
                        <Avatar url={ev.actor.avatarUrl} name={ev.actor.name} size={16} />
                        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.muted }}>
                          by {ev.actor.name}
                        </span>
                      </ProfileLink>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div></Portal>
  );
}

// ── Revenue read-out ───────────────────────────────────────────────────────
// Three numbers that answer "where is the money", without a second chart:
//   Collected       paid applicants x fee — what has actually landed
//   If everyone pays total applicants x fee — what the current pipeline is worth
//   At target       expected delegates x fee — the ceiling the organiser planned for
// A conference with no fee is a legitimate, finished state, not a zero — it
// says so in words rather than printing "0 / 0 / 0" as if something were wrong.

function RevenueReadout({
  fee, currency, paidCount, totalCount, expected, href,
}: {
  fee: number;
  currency: string;
  paidCount: number;
  totalCount: number;
  expected: number;
  href: string;
}) {
  if (fee <= 0) {
    return (
      <NeuInset small style={{ padding: '8px 12px', borderRadius: 14 }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>
          No delegate fee set — nothing to collect.{' '}
          <Link href={href} style={{ color: NEU.deepGold, fontWeight: 800, textDecoration: 'none' }}>
            Add one
          </Link>
        </p>
      </NeuInset>
    );
  }

  const cells: { label: string; value: number; hint: string; accent: string }[] = [
    { label: 'Collected', value: paidCount * fee, accent: NEU.deepGold, hint: `${paidCount} paid x ${formatFee(fee, currency)}` },
    { label: 'If everyone pays', value: totalCount * fee, accent: NEU.ink, hint: `${totalCount} applicant${totalCount === 1 ? '' : 's'} x ${formatFee(fee, currency)}` },
    { label: 'At target', value: expected * fee, accent: NEU.ink, hint: expected > 0 ? `${expected} expected x ${formatFee(fee, currency)}` : 'Set an expected delegate count' },
  ];

  return (
    <NeuInset small style={{ padding: '8px 4px', borderRadius: 14 }}>
      <div className="flex items-stretch">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="flex flex-col min-w-0 text-center"
            title={c.hint}
            style={{
              flex: 1,
              padding: '0 8px',
              borderInlineStart: i === 0 ? undefined : '1px solid rgba(27,56,40,0.10)',
            }}
          >
            <span
              className="truncate"
              style={{
                fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: NEU.muted,
              }}
            >
              {c.label}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: c.accent,
                fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1.1,
              }}
            >
              {c.value > 0 || c.label === 'Collected' ? formatFee(c.value, currency) : '—'}
            </span>
          </div>
        ))}
      </div>
    </NeuInset>
  );
}

// ── Dashboard home, single-viewport neumorphic grid, no scroll ────────────

export default function DashboardPage() {
  const router = useRouter();
  const { conference, refreshConferenceQuiet } = useManage();
  const { session } = useAuth();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  // `now` starts at 0 (same on server + client, no hydration mismatch) and is
  // set on mount, then ticked every minute so relative times stay fresh.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Success toast for a redirect from /invites/organizer/[token] after
  // accepting, read via window.location rather than useSearchParams so this
  // stays a plain client-side effect (matches the pattern used for the
  // account-deletion and password-reset homepage toasts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('organizerInvite') !== 'accepted') return;
    // Goes to the corner notification stack — the same cards the live committee
    // session raises — rather than a green strip that pushed the whole
    // dashboard down for five seconds. The store owns the countdown.
    notifyOk("Invite accepted. You're now part of the organizing team.", 'organizer-invite');
    const url = new URL(window.location.href);
    url.searchParams.delete('organizerInvite');
    window.history.replaceState({}, '', url.toString());
  }, []);

  useEffect(() => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    (async () => {
      const [appsRes, allocRes, committeesRes, orgRes, emailRes, chairInvRes, orgInvRes] = await Promise.all([
        supabase
          .from('applications')
          .select('submitted_at, status, payment_status, role, society_id')
          .eq('conference_id', confId),
        // created_at, not a head-only count: the Assigned series on
        // ParticipantsChart is plotted from these instants. The count the
        // tiles use is just this array's length.
        supabase
          .from('conference_allocations')
          .select('created_at')
          .eq('conference_id', confId),
        supabase
          .from('conference_committees')
          // committee_country_slots gives the SEAT count: a double-delegation
          // country seats two delegates, so capacity is the sum of
          // delegation_size, never a count of country rows.
          .select('id, chair_user_ids, committee_country_slots(delegation_size)')
          .eq('conference_id', confId),
        supabase
          .from('conference_organizers')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId),
        supabase
          .from('email_templates')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId)
          .eq('enabled', true),
        // Chair invites that are still out: their committee counts as staffed
        // for the "Invite chairs" checklist row. Only the committee id is
        // needed — never the invitee's email.
        supabase
          .from('conference_chair_invites')
          .select('committee_id')
          .eq('conference_id', confId)
          .eq('status', 'pending'),
        supabase
          .from('conference_organizer_invites')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId)
          .eq('status', 'pending'),
      ]);
      const allocRows = (allocRes.data ?? []) as { created_at: string | null }[];
      setDash({
        apps: (appsRes.data ?? []) as AppRow[],
        allocated: allocRows.length,
        allocatedAt: allocRows.map(r => r.created_at),
        committees: (committeesRes.data ?? []) as { id: string; chair_user_ids: string[] | null }[],
        organizerCount: orgRes.count ?? 0,
        enabledEmailCount: emailRes.count ?? 0,
        pendingChairInviteCommitteeIds: ((chairInvRes.data ?? []) as { committee_id: string | null }[])
          .map(r => r.committee_id)
          .filter((id): id is string => !!id),
        pendingOrganizerInvites: orgInvRes.count ?? 0,
      });
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Explore emails" is the one checklist item that is NOT a function of the
  // database: it is ticked once this browser has visited the communications
  // page (flag written there, see src/lib/emailsExplored.ts). Read in an effect,
  // never during render, so the server-rendered markup still matches.
  const [emailsExplored, setEmailsExplored] = useState(false);
  useEffect(() => {
    if (!conference) return;
    // localStorage is an external store; it can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmailsExplored(hasExploredEmails(conference.id));
  }, [conference?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent-activity feed: recent applications + allocations, expanded into
  // per-timestamp events (submitted / paid / checked-in / resubmitted /
  // allocated), merged newest-first.
  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    const currency = conference.fee_currency;
    let cancelled = false;
    (async () => {
      const [appsRes, allocRes, decisionRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, user_id, role, submitted_at, paid_at, paid_amount, amount_paid, checked_in_at, checked_in_by, resubmitted_at, invited_name, profiles(id, display_name, avatar_url)')
          .eq('conference_id', confId)
          .order('submitted_at', { ascending: false })
          .limit(25),
        supabase
          .from('conference_allocations')
          .select('id, created_at, country_name, user_id, application_id, assigned_by, conference_committees:conference_committee_id(name, abbreviation), profiles:user_id(id, display_name, avatar_url), societies:society_id(name)')
          .eq('conference_id', confId)
          .order('created_at', { ascending: false })
          .limit(15),
        // Decisions get their OWN window rather than riding along on the query
        // above. That one takes the newest 25 by submitted_at, so accepting a
        // six-month-old application — exactly the case a "who did this" feed
        // exists for — would fall outside it and never show. Ordering by
        // decided_at is also what the partial index is built for.
        supabase
          .from('applications')
          .select('id, user_id, status, decided_at, decided_by, invited_name, profiles(id, display_name, avatar_url)')
          .eq('conference_id', confId)
          .not('decided_at', 'is', null)
          .order('decided_at', { ascending: false })
          .limit(15),
      ]);
      if (cancelled) return;
      const evs: ActivityEvent[] = [];
      // Actor id -> subject id, collected as events are built. The actor
      // columns are FKs to auth.users, NOT to public.profiles, so PostgREST
      // has no relationship to embed a second profiles join through — the
      // names/avatars come from one follow-up lookup keyed by these ids.
      const actorBySubject: { key: string; actorId: string; subjectId: string | null }[] = [];

      type ActApp = { id: string; user_id: string | null; role: string; submitted_at: string | null; paid_at: string | null; paid_amount: number | null; amount_paid: number | null; checked_in_at: string | null; checked_in_by: string | null; resubmitted_at: string | null; invited_name: string | null; profiles: { id: string; display_name: string; avatar_url: string | null } | null };
      for (const a of (appsRes.data ?? []) as unknown as ActApp[]) {
        const name = a.profiles?.display_name ?? a.invited_name ?? 'Someone';
        const subject = { id: a.profiles?.id ?? null, avatarUrl: a.profiles?.avatar_url ?? null };
        // submitted / paid / resubmitted are the applicant's OWN doing —
        // self-service, so they deliberately carry no actor.
        if (a.submitted_at) evs.push({ key: `sub-${a.id}`, ts: new Date(a.submitted_at).getTime(), kind: 'application', name, subject, detail: roleWord(a.role).toLowerCase() });
        if (a.paid_at) {
          const amt = a.paid_amount ?? a.amount_paid;
          evs.push({ key: `pay-${a.id}`, ts: new Date(a.paid_at).getTime(), kind: 'payment', name, subject, detail: amt != null ? formatFee(Number(amt), currency) : undefined });
        }
        if (a.checked_in_at) {
          const key = `chk-${a.id}`;
          evs.push({ key, ts: new Date(a.checked_in_at).getTime(), kind: 'checkin', name, subject });
          if (a.checked_in_by) actorBySubject.push({ key, actorId: a.checked_in_by, subjectId: a.user_id });
        }
        if (a.resubmitted_at) evs.push({ key: `res-${a.id}`, ts: new Date(a.resubmitted_at).getTime(), kind: 'resubmit', name, subject });
      }

      type ActAlloc = { id: string; created_at: string | null; country_name: string | null; user_id: string | null; application_id: string | null; assigned_by: string | null; conference_committees: { name: string; abbreviation: string | null } | null; profiles: { id: string; display_name: string; avatar_url: string | null } | null; societies: { name: string } | null };
      // Applications that already have an allocation event this pass; their
      // 'assigned' decision is the same moment told twice, so it is dropped.
      const allocatedAppIds = new Set<string>();
      for (const al of (allocRes.data ?? []) as unknown as ActAlloc[]) {
        if (!al.created_at) continue;
        const who = al.profiles?.display_name ?? al.societies?.name ?? 'A delegation';
        const committee = al.conference_committees?.abbreviation ?? al.conference_committees?.name;
        const detail = [al.country_name, committee].filter(Boolean).join(' · ') || undefined;
        const key = `alloc-${al.id}`;
        evs.push({
          key, ts: new Date(al.created_at).getTime(), kind: 'allocation', name: who, detail,
          // A delegation-level allocation has no `profiles` row — `who` is the
          // society's name, which is an organisation and not a face.
          subject: { id: al.profiles?.id ?? null, avatarUrl: al.profiles?.avatar_url ?? null },
        });
        if (al.application_id) allocatedAppIds.add(al.application_id);
        if (al.assigned_by) actorBySubject.push({ key, actorId: al.assigned_by, subjectId: al.user_id });
      }

      // Organiser decisions — the "someone else did this" case the actor chip
      // exists for. Built from their own query so an old application decided
      // today is never outside the window.
      type ActDecision = { id: string; user_id: string | null; status: string; decided_at: string | null; decided_by: string | null; invited_name: string | null; profiles: { id: string; display_name: string; avatar_url: string | null } | null };
      for (const d of (decisionRes.data ?? []) as unknown as ActDecision[]) {
        if (!d.decided_at) continue;
        const word = DECISION_WORD[d.status];
        if (!word) continue;
        // The allocation event already says this, with country and committee.
        // Chair seatings have no allocation row, so they still come through.
        if (d.status === 'assigned' && allocatedAppIds.has(d.id)) continue;
        const key = `dec-${d.id}`;
        evs.push({
          key,
          ts: new Date(d.decided_at).getTime(),
          kind: decisionKind(d.status),
          name: d.profiles?.display_name ?? d.invited_name ?? 'Someone',
          subject: { id: d.profiles?.id ?? null, avatarUrl: d.profiles?.avatar_url ?? null },
          detail: word,
        });
        if (d.decided_by) actorBySubject.push({ key, actorId: d.decided_by, subjectId: d.user_id });
      }

      evs.sort((x, y) => y.ts - x.ts);

      // The WHOLE list is kept in state now, not the top 8. The card still
      // paints only its first few rows (ACTIVITY_INLINE_LIMIT) — clicking it
      // opens the rest in a modal, and that modal reads this same array. One
      // feed, one query, one attribution pass; no second fetch on open.
      //
      // Attribution therefore has to cover every event rather than only the
      // visible slice. That is still ONE lookup: the ids are de-duplicated,
      // and the three queries above are capped at 25/15/15 rows between them,
      // so the distinct actors are a handful of organisers however busy the
      // conference is.
      const pending = actorBySubject.filter(r => r.actorId !== r.subjectId);
      if (pending.length > 0) {
        const { data: actorRows } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', Array.from(new Set(pending.map(r => r.actorId))));
        if (cancelled) return;
        const byId = new Map(
          ((actorRows ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[])
            .map(p => [p.id, { id: p.id, name: p.display_name ?? 'An organiser', avatarUrl: p.avatar_url }]),
        );
        const actorByKey = new Map(pending.map(r => [r.key, byId.get(r.actorId)]));
        for (const ev of evs) {
          const actor = actorByKey.get(ev.key);
          if (actor) ev.actor = actor;
        }
      }
      setActivity(evs);
    })();
    return () => { cancelled = true; };
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cumulative funnel series for ParticipantsChart. Rolled here (before the
  // loading return, so hook order never changes) and only when the fetched
  // data actually changes — the roll is O(rows x buckets).
  const participantSeries = useMemo(
    () => (dash ? toCumulativeSeries(dash.apps, dash.allocatedAt) : []),
    [dash],
  );

  // ── Loading skeleton, mirrors the fixed one-viewport grid ───────────────
  if (!conference || !dash) {
    return (
      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 56px)', padding: '14px 20px 20px' }}>
        <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 48, backgroundColor: NEU.surface, boxShadow: NEU.out, marginBottom: 12 }} />
        <div className="flex flex-col xl:flex-row" style={{ alignItems: 'stretch', gap: 14 }}>
          <div className="flex flex-col w-full xl:basis-[34%] xl:shrink-0 xl:min-w-[320px]" style={{ gap: 14 }}>
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 450, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            <div className="rounded-[22px] animate-pulse" style={{ flex: 1, minHeight: 168, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          </div>
          <div className="flex flex-col" style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 254, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 368, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          </div>
        </div>
      </div>
    );
  }

  const slug = conference.slug;
  const confYear = conference.start_date ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  // ── Derived numbers ──────────────────────────────────────────────────────
  const totalApps = dash.apps.length;
  // Accepted = accepted-or-beyond. Allocating flips an application's status to
  // 'assigned' (and check-in to 'checked-in'), so a naive status === 'accepted'
  // count would exclude everyone already allocated and read *lower* than the
  // allocated number — an impossibility, since Allocated ⊆ Accepted. Counting
  // all three states keeps Allocated a true subset of Accepted.
  const acceptedApps = dash.apps.filter(
    a => a.status === 'accepted' || a.status === 'assigned' || a.status === 'checked-in'
  ).length;
  const paidApps = dash.apps.filter(a => a.payment_status === 'paid').length;
  const delegateApps = dash.apps.filter(a => a.role === 'delegate' || a.role === 'head-delegate').length;
  const societies = new Set(dash.apps.map(a => a.society_id).filter(Boolean)).size;
  const committeeCount = dash.committees.length;
  // A dais counts as handled once a chair is ASSIGNED (chair_user_ids) or
  // INVITED (a pending conference_chair_invites row). Chasing an organiser about
  // a committee whose invite is already sitting in someone's inbox is noise.
  const invitedChairCommittees = new Set(dash.pendingChairInviteCommitteeIds);
  const committeesNeedingChairs = dash.committees.filter(
    c => (!c.chair_user_ids || c.chair_user_ids.length === 0) && !invitedChairCommittees.has(c.id)
  ).length;
  // Seats delegates can actually occupy, vs how many the organiser says they
  // expect. 3 committees x 20 seats does not host 150 people.
  const seatCapacity = dash.committees.reduce(
    (sum, c) => sum + (c.committee_country_slots ?? []).reduce((n, s) => n + (s.delegation_size ?? 1), 0),
    0,
  );
  const expectedDelegates = conference.expected_delegates ?? 0;
  // Seats only need to cover 70% of the expected head count before we stop
  // flagging it: expected_delegates is an early guess, committees get added
  // over months, and demanding 100% meant this row nagged conferences that were
  // in perfectly good shape. The same 0.70 lives in conference_setup_status()
  // (which drives the nudge emails) and in admin/ConferencesTab isShortOnSeats
  // — change all three together or they will contradict each other again.
  const SEAT_COVERAGE = 0.70;
  const requiredSeats = expectedDelegates > 0 ? Math.ceil(expectedDelegates * SEAT_COVERAGE) : 0;
  const seatShortfall = expectedDelegates > 0 ? Math.max(0, requiredSeats - seatCapacity) : 0;
  // Allocated (dash.allocated = conference_allocations rows) is now always a
  // subset of Accepted, so unallocated = accepted − allocated is non-negative;
  // the Math.max stays purely as a defensive floor against transient races.
  const allocated = Math.min(dash.allocated, acceptedApps);
  const unallocated = Math.max(0, acceptedApps - allocated);
  const fee = conference.fee_amount ?? 0;

  // Funnel rings, outermost → innermost. Every value is an existing derived
  // const, so the dial can never contradict the pipeline cells or the stat
  // tiles beside it. Total ⊇ Accepted ⊇ Assigned holds by construction
  // (acceptedApps counts accepted/assigned/checked-in, and `allocated` is
  // already Math.min'd against it). Paid is a subset of Total but NOT of
  // Assigned — a delegate can pay before a committee seat is picked for them
  // — which is exactly why it is a separate ring rather than a stacked slice.
  //
  // Each key row deep-links into the applications table pre-filtered to the
  // matching rows. The ?status= words resolve, on that page, to the same
  // status GROUPS its own stat tiles use (accepted → accepted-or-beyond,
  // assigned → allocated-or-beyond), so the list a chair lands on always has
  // exactly the number of rows they just clicked. Paid is a payment state,
  // not a status, hence ?payment=paid.
  const dialStages = [
    { key: 'total', label: 'Applications', value: totalApps, href: `/manage/${slug}/applications` },
    { key: 'accepted', label: 'Accepted', value: acceptedApps, href: `/manage/${slug}/applications?status=accepted` },
    { key: 'assigned', label: 'Assigned', value: allocated, href: `/manage/${slug}/applications?status=assigned` },
    { key: 'paid', label: 'Paid', value: paidApps, href: `/manage/${slug}/applications?payment=paid` },
  ];

  // ── Set-up priorities: 9 detection checks, in journey order ──────────────
  // Base order = the natural build journey (page → committees → chairs → email →
  // secretariat → financials → delegate → awards → launch). Pending-first sort
  // runs on top of this and breaks ties by this order (see sortedChecklist).
  const awardsCfg = getAwardsConfig(conference.awards_config);
  const awardsDeadline = chairDeadline(awardsCfg, conference.end_date ?? null);
  const awardsCategoryCount = awardsCfg.types.filter(t => t.enabled).length;
  const checklist = [
    {
      key: 'page',
      icon: Palette,
      emoji: 'Artist palette',
      gradient: NEU_GRADIENTS.amber,
      title: 'Set up your conference page',
      sub: 'Add a banner and a description delegates will see.',
      done: !!conference.banner_url && !!conference.description?.trim(),
      onClick: () => router.push(`/manage/${slug}/settings?tab=conference`),
    },
    {
      key: 'committees',
      icon: Building2,
      emoji: 'Classical building',
      gradient: NEU_GRADIENTS.forest,
      title: 'Add committees',
      sub: committeeCount === 0
        ? 'Create committees and their topics.'
        : seatShortfall > 0
          // Only ever shown below 70% coverage, so the gap quoted is the gap to
          // that bar, not to the full expected head count.
          ? `Only ${seatCapacity} seats for ${expectedDelegates} expected delegates — ${seatShortfall} more covers most of them.`
          : `${committeeCount} committee${committeeCount === 1 ? '' : 's'}, ${seatCapacity} seats.`,
      done: committeeCount > 0 && seatShortfall === 0,
      onClick: () => router.push(`/manage/${slug}/committees`),
    },
    {
      key: 'chairs',
      icon: Gavel,
      emoji: 'Balance scale',
      gradient: NEU_GRADIENTS.gold,
      title: 'Invite chairs',
      sub: committeeCount === 0
        ? 'Add committees first, then invite a chair to each dais.'
        : committeesNeedingChairs === committeeCount
          ? 'Invite a chair to any one committee to get started.'
          : committeesNeedingChairs > 0
            ? `${committeesNeedingChairs} of ${committeeCount} still need someone on the dais.`
            : 'Every committee has a chair assigned or invited.',
      // ONE chair invited is enough to tick this. Requiring every dais staffed
      // made the bar scale with ambition and it was the single biggest killer
      // on the checklist: conferences with 1-2 committees passed 49% of the
      // time, those with 3-5 passed 14%. Harvard WorldMUN (10 committees) and
      // MUNBU Workshop (73 delegate applications already in) were both marked
      // incomplete for what is genuinely months of recruiting. Chasing the rest
      // is the job of the chair-reminder emails, not of a binary tick.
      done: committeeCount > 0 && committeesNeedingChairs < committeeCount,
      // Committees, not assignment: inviting a chair starts from the committee
      // you are staffing.
      onClick: () => router.push(`/manage/${slug}/committees`),
      action: (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/manage/${slug}/jobs`); }}
          className="focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            color: NEU.deepGold, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
          }}
        >
          RECRUIT
        </button>
      ),
    },
    {
      key: 'email',
      icon: Mail,
      emoji: 'Envelope',
      gradient: NEU_GRADIENTS.gold,
      title: 'Explore emails',
      sub: 'See what you can send applicants automatically.',
      // INTENTIONALLY CLIENT-LOCAL: ticked by visiting the communications page,
      // recorded in localStorage (src/lib/emailsExplored.ts). This is the only
      // checklist item the server-side mirror conference_setup_status() cannot
      // reproduce — a nudge email cannot read a browser's localStorage — so the
      // SQL keeps this item on `enabled_email_count > 0`. The divergence is
      // deliberate and documented in both places.
      done: emailsExplored,
      onClick: () => router.push(`/manage/${slug}/communications`),
    },
    {
      key: 'secretariat',
      icon: UsersRound,
      // "Handshake" reads instantly as bringing co-organizers on board, the
      // grey "Busts in silhouette" 3D asset was muddy on its tinted seat.
      emoji: 'Handshake',
      gradient: NEU_GRADIENTS.sage,
      title: 'Add your secretariat',
      sub: dash.organizerCount > 1
        ? `${dash.organizerCount} organizers on the team.`
        : dash.pendingOrganizerInvites > 0
          ? 'Invite sent — waiting for them to accept.'
          : 'Invite co-organizers and grant them access.',
      // One invite out is enough: the organiser has done the part they control,
      // and accepting is not theirs to do.
      done: dash.organizerCount > 1 || dash.pendingOrganizerInvites > 0,
      onClick: () => router.push(`/manage/${slug}/settings?tab=organizers`),
    },
    {
      key: 'financials',
      icon: Wallet,
      emoji: 'Money bag',
      gradient: NEU_GRADIENTS.amber,
      title: 'Add financial information',
      // Mirrors conference_payments_ready: a non-null fee_amount alone was
      // never a real signal (the creation page always writes one), this row
      // only clears once delegates actually have somewhere to pay.
      done: conferencePaymentsReady(conference),
      sub: 'Choose how you get paid so delegates can actually pay you.',
      onClick: () => router.push(`/manage/${slug}/financials/settings`),
    },
    {
      key: 'delegate',
      icon: UserPlus,
      emoji: 'Graduation cap',
      gradient: NEU_GRADIENTS.green,
      title: 'Get your first delegate',
      sub: delegateApps > 0 ? `${delegateApps} delegate application${delegateApps === 1 ? '' : 's'} received.` : 'Share your page and receive an application.',
      done: delegateApps > 0,
      // Pending: open the share popup (link + story recipe), no deep link.
      // Done: jump to the applications that came in.
      onClick: delegateApps > 0
        ? () => router.push(`/manage/${slug}/applications`)
        : () => setShowShareModal(true),
    },
    {
      // Awards are configured in advance and decided at the end, so this row
      // is a nudge, never a publish gate (handlePublishClick does not read it).
      // The platform default (Best / Outstanding / Honourable Mention / Best
      // Position Paper, secretariat ratifies) already works untouched, so the
      // row also clears once the organiser has saved the setup once, or has
      // switched awards off on purpose.
      key: 'awards',
      icon: Trophy,
      emoji: 'Trophy',
      gradient: NEU_GRADIENTS.gold,
      title: 'Set up awards',
      sub: !awardsCfg.enabled
        ? 'Awards are off for this conference.'
        : awardsCfg.configuredAt
          ? [
              `${awardsCategoryCount} categor${awardsCategoryCount === 1 ? 'y' : 'ies'}`,
              awardsCfg.requireApproval ? 'secretariat approves' : 'no ratification',
              awardsDeadline
                ? `deadline ${awardsDeadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'no deadline yet',
            ].join(' · ')
          : 'Best Delegate, Outstanding, Honourable Mentions and Best Position Paper are on by default. Adjust categories and quotas.',
      done: !awardsCfg.enabled || !!awardsCfg.configuredAt,
      onClick: () => router.push(`/manage/${slug}/settings?tab=awards`),
    },
    {
      // Compact publish CTA lives here as the checklist's launch row, the
      // big accent quick-actions card was removed with the one-page layout.
      key: 'publish',
      icon: Rocket,
      emoji: 'Rocket',
      gradient: NEU_GRADIENTS.forest,
      title: 'Launch delegate registrations',
      sub: conference.is_public ? 'Your conference is live.' : 'Publish your conference to gavelling.com.',
      done: conference.is_public,
      onClick: handlePublishClick,
    },
  ];
  const doneCount = checklist.filter(c => c.done).length;
  // Pending items first; done items sink to the bottom (stable sort keeps journey order within each group).
  const sortedChecklist = [...checklist].sort((a, b) => Number(a.done) - Number(b.done));

  function handlePublishClick() {
    if (committeeCount === 0) {
      setPublishBlockMsg('Add at least one committee before publishing.');
      setTimeout(() => setPublishBlockMsg(''), 3000);
      return;
    }
    if (conference && paymentGateBlocks(conference)) {
      setPublishBlockMsg(paymentGateMessage(conference));
      // Longer timeout than the committee check above: this is a longer
      // sentence and needs more time to actually be read.
      setTimeout(() => setPublishBlockMsg(''), 6000);
      return;
    }
    setShowPublishModal(true);
  }

  async function handlePublished() {
    // Quiet: swaps the conference row in without flipping the layout's
    // full-screen loading flag, no reason to unmount this page (and lose
    // the just-closed modal state) for a routine post-write confirmation.
    await refreshConferenceQuiet();
    setShowPublishModal(false);
  }

  return (
    <div
      className="relative flex flex-col"
      style={{ minHeight: 'calc(100vh - 56px)', padding: '14px 20px 20px', fontFamily: OUTFIT, isolation: 'isolate', overflowX: 'clip' }}
    >
      {/* Decorative bleed — faded organiser glyphs off the dashboard edges,
          tucked behind the content (zIndex -1). */}
      <DecorativeBleed
        zIndex={-1}
        items={[
          { Icon: Gavel, size: 170, top: '-30px', right: '-40px', opacity: 0.045, rotate: -12 },
          { Icon: UsersRound, size: 150, bottom: '-42px', left: '-38px', opacity: 0.04 },
          { Icon: Globe2, size: 110, top: '55%', right: '-24px', opacity: 0.035 },
        ]}
      />

      {/* ── Header, compact single row ── */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-3 min-w-0">
          <LogoDisc
            src={conference.logo_url}
            alt={conference.acronym}
            size={38}
            fallbackText={conference.acronym.slice(0, 2)}
          />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: NEU.deepGold }}>
              {conference.acronym}{confYear ? ` · ${confYear}` : ''} · DASHBOARD
            </p>
            <h1 className="font-black truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 18, lineHeight: 1.15, marginTop: 1 }}>
              {conference.full_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <NeuPill active={conference.is_public} gradient={NEU_GRADIENTS.green}>
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: conference.is_public ? '#FFFFFF' : NEU.amber, flexShrink: 0 }} />
            {conference.is_public ? 'LIVE' : 'DRAFT'}
          </NeuPill>
          {!conference.is_public && (
            <NeuButton gradient={NEU_GRADIENTS.forest} icon={Rocket} onClick={handlePublishClick} style={{ padding: '8px 16px', fontSize: 12 }}>
              PUBLISH
            </NeuButton>
          )}
        </div>
      </div>

      {/* ── Main layout, two stretched columns.
          `items-start` used to be the fix for the left card growing a hole
          underneath it — but the hole was ~200px of nothing beside a much
          taller right column, which is exactly the "wonky, gaps" complaint.
          The fix is to give the short column something to spend the height on
          instead of shrinking it: Recent activity now lives under the
          checklist with `flex: 1`, so BOTH columns end on the same line by
          construction and the leftover height becomes feed rows rather than
          dead cream. Hence items-stretch in both directions.
          The priorities card still keeps the top-left corner: it is first in
          the DOM, so nothing in the right column can push it down. ── */}
      <div className="flex flex-col xl:flex-row items-stretch" style={{ gap: 14 }}>

        {/* Left column: set-up priorities (natural height) + recent activity
            (claims the rest). 34% rather than 32% — every point given to the
            left narrows the right, and ParticipantsChart is a scaled viewBox
            whose HEIGHT is 0.32x its width, so a narrower right column is a
            shorter page. It also buys the activity lines room for the actor
            chip without truncating them to nothing. */}
        <div className="flex flex-col w-full xl:basis-[34%] xl:shrink-0 xl:min-w-[320px]" style={{ gap: 14 }}>

        <NeuCard className="flex flex-col flex-shrink-0" style={{ padding: '14px 15px 11px' }}>
          <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginBottom: 9 }}>
            <div className="min-w-0">
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>Set-up priorities</h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} of {checklist.length} done{doneCount === checklist.length ? '. You are all set.' : ''}
              </p>
            </div>
            <NeuRing value={doneCount} max={checklist.length} size={50} strokeWidth={7} gradient={NEU_GRADIENTS.gold}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 13, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {doneCount}<span style={{ fontSize: 9, color: NEU.muted }}>/{checklist.length}</span>
              </span>
            </NeuRing>
          </div>

          <NeuProgress value={doneCount} max={checklist.length} gradient={NEU_GRADIENTS.gold} thumb height={9} style={{ marginBottom: 10, flexShrink: 0 }} />

          {/* Natural-height snug stack, the card ends exactly at the last row,
              no leftover void below (rows sink done items to the bottom). */}
          <div className="flex flex-col" style={{ gap: 5 }}>
            {sortedChecklist.map(item => (
              <NeuChecklistRow
                key={item.key}
                done={item.done}
                icon={item.icon}
                emoji={item.emoji}
                gradient={item.gradient}
                title={item.title}
                sub={item.sub}
                action={'action' in item ? item.action : undefined}
                onClick={item.onClick}
                dense
              />
            ))}
          </div>
          {publishBlockMsg && (
            <p className="flex-shrink-0" style={{ fontSize: 11, marginTop: 7, color: NEU.amber, fontFamily: OUTFIT, fontWeight: 700 }}>{publishBlockMsg}</p>
          )}
        </NeuCard>

        {/* Momentum feed, fills whatever height the right column dictates. */}
        <RecentActivity events={activity} now={now} />

        </div>

        {/* Right column: applicants headline → chart */}
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0, gap: 14 }}>

        {/* Applicants against target — the headline read of the whole funnel.
            The dial is the left half; the right half carries the numbers that
            used to need their own tile row (allocation alert, money) so the
            card is full edge to edge instead of a big ring beside a
            paragraph. */}
        <NeuCard className="flex-shrink-0" style={{ padding: '15px 18px' }}>
          <div className="flex items-stretch flex-wrap" style={{ gap: 20 }}>
            {/* 224, not the 236 default: the dial's height IS this card's
                height, and 224 is what the vertical budget affords once the
                chart below has taken its 0.32 x width. */}
            <div className="flex-shrink-0">
              <ApplicantsDial
                stages={dialStages}
                expected={expectedDelegates}
                size={224}
                onNavigate={(href) => router.push(href)}
              />
            </div>
            <div
              className="flex flex-col min-w-0"
              style={{ flex: 1, minWidth: 240, gap: 9, justifyContent: 'space-between' }}
            >
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>
                Applicants against target
              </h2>
              <UnallocatedTile count={unallocated} href={`/manage/${slug}/assignment`} />
              <RevenueReadout
                fee={fee}
                currency={conference.fee_currency}
                paidCount={paidApps}
                totalCount={totalApps}
                expected={expectedDelegates}
                href={`/manage/${slug}/financials/settings`}
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {societies} delegation{societies === 1 ? '' : 's'} · {committeeCount} committee{committeeCount === 1 ? '' : 's'}
                </span>
                <Link
                  href={expectedDelegates > 0 ? `/manage/${slug}/applications` : `/manage/${slug}/settings?tab=conference`}
                  className="inline-flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-70"
                  style={{
                    fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
                    color: NEU.deepGold, textDecoration: 'none',
                  }}
                >
                  {expectedDelegates > 0 ? 'REVIEW APPLICATIONS' : 'SET AN EXPECTED HEAD COUNT'}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </NeuCard>

        {/* The participants chart, sole occupant of this slot. It used to
            share the card with a revenue chart behind a two-pill switch; the
            revenue chart and BOTH pills were removed on request, so the chart
            now carries its own title (the active pill used to name it, which
            is why `title` was empty before).
            Full right-column width on purpose: its SVG is a scaled viewBox,
            so squeezing it sideways shrinks the axis type with it. */}
        <NeuCard className="flex flex-col flex-shrink-0" style={{ padding: '12px 16px 12px' }}>
          <ParticipantsChart points={participantSeries} />
        </NeuCard>

        </div>
      </div>

      {showPublishModal && (
        <PublishModal
          conference={conference}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}

      {showShareModal && (
        <ShareModal
          conference={conference}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
