'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { notify } from '@/lib/sessionNotifications';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Rocket, Mail, Gavel, UsersRound, UserPlus, Wallet, Palette,
  Inbox, Globe2, CheckCircle2, AlertCircle, ArrowRight,
  Activity, UserRoundCheck, MapPin, RotateCcw, CalendarDays,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { friendlyError } from '@/lib/friendlyError';
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
import { applicationsByRole, INVITE_ROLE_LABEL, type ChairInviteRow } from '@/components/conferences/InviteAcceptance';
import TrafficSourcesCard from '@/components/conferences/TrafficSourcesCard';
import UntoldSeatsRow from './UntoldSeatsRow';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { BENTO_BORDER, BENTO_WASH_FOREST } from '@/components/conferences/bento';
import { conferencePaymentsReady, paymentGateBlocks, paymentGateMessage } from '@/lib/payments';
import { hasExploredEmails } from '@/lib/emailsExplored';
import { getConferenceIntent, intentRank } from '@/lib/conferenceIntent';
import { outstandingPledgedSpots } from '@/lib/pledgedSpots';
import { useConferenceMoney } from '@/lib/conferenceMoney';
import RevenueReadout from '@/components/conferences/RevenueReadout';
import { fetchDelegatePrices, TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';
import { supabase } from '@/lib/supabase';
import { ShareLinkRow, ShareHero } from '@/components/conferences/ShareConferenceLink';
import { DASH_CSS, UnallocatedBadge, useDialSize } from '@/components/conferences/dashboardLayout';
import { useScrollLock } from '@/hooks/useScrollLock';
import VerifiedCheck, { minutesToCheckmarkLabel } from '@/components/VerifiedCheck';

const RED = '#A8442F';

// ── Publish modal ──────────────────────────────────────────────────────────

function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; slug: string; full_name: string; dates_tbd: boolean; start_date: string | null };
  onClose: () => void;
  onPublished: () => void;
}) {
  // Modal: freeze the dashboard behind it.
  useScrollLock(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Mirrors the database CHECK conferences_tbd_not_public: a conference with
  // dates still TBD, or no start date at all, can never go public. Caught
  // here rather than left to the write, so the organizer sees why and where
  // to fix it instead of a raw constraint error.
  const needsDates = conference.dates_tbd || !conference.start_date;

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPublishing(false);
      setPublishError('Your session has expired. Please refresh the page and sign in again.');
      return;
    }
    const { data, error } = await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id)
      .select('id');
    if (error || !data || data.length !== 1) {
      setPublishing(false);
      setPublishError(error
        ? friendlyError(error, "Couldn't publish your conference. Please try again.")
        : "Couldn't publish your conference. Please refresh and try again.");
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
        {needsDates ? (
          <>
            <h2 className="font-black text-xl mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Add your dates first
            </h2>
            <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              Your conference dates are set to TBD. A conference needs real dates before it can be listed publicly. You can keep taking applications while it stays private.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none gv-lift"
                style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                CANCEL
              </button>
              <Link
                href={`/manage/${conference.slug}/settings?tab=conference&focus=dates`}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none gv-lift flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1B3828', color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                <CalendarDays size={15} strokeWidth={2.2} />
                ADD DATES
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-black text-xl mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              Publish Conference?
            </h2>
            <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              Your conference will appear publicly on gavelling.com/conferences/explore and delegates will be able to apply.
            </p>
            {publishError && (
              <p className="text-sm mb-4" style={{ color: RED, fontFamily: OUTFIT }}>{publishError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none gv-lift"
                style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                CANCEL
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none gv-lift"
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
          </>
        )}
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
            className="flex-shrink-0 rounded-xl py-2.5 px-4 font-bold text-xs tracking-widest transition-colors focus:outline-none gv-lift"
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
              backgroundColor: 'color-mix(in srgb, var(--gv-main) 4%, var(--gv-surface))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--gv-main) 10%, transparent)', whiteSpace: 'pre-line', wordBreak: 'break-word',
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
  /** Pledge columns, so the headline can count a delegation's spots as the
   *  people they are. Arithmetic lives in src/lib/pledgedSpots.ts. */
  id: string;
  pledge_type: string | null;
  spots_pledged: number | null;
  advisors_pledged: number | null;
  /** Null for an imported / invited applicant who has not claimed the invite
   *  yet (claim_import_invite writes it). Read only as "is there an account";
   *  the dial counts on it (src/components/conferences/InviteAcceptance.ts). */
  user_id: string | null;
}

// ── Unallocated delegates ──────────────────────────────────────────────────
// A red count badge beside the applicants heading now (UnallocatedBadge in
// src/components/conferences/dashboardLayout.tsx). The full-width amber tile
// that used to sit here was the biggest single block of dead space on a
// laptop screen (owner, 21 Sep 2026).

// The old PipelineCell / "Delegates" pipeline card and the Applications +
// Accepted stat tiles were deleted here, not misplaced: the rewritten
// ApplicantsDial printed Applications / Accepted / Assigned / Paid in its key
// (it shows applied and accepted per role against the expected head count since 23 Sep 2026), so those cards were the same four numbers a third
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
  /** Pending and accepted chair invites (status + the invitee's account, never
   *  the email), for the invite-acceptance card. */
  chairInvites: ChairInviteRow[];
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
export function RecentActivity({ events, now, fill = false }: {
  events: ActivityEvent[];
  now: number;
  /** Paint every row, as many as the column's height shows (the rest scroll
   *  inside the card), instead of leaving a gap under eight. The dashboard
   *  always passes it: the gap showed whenever the priorities card was short,
   *  most of all once every priority was done. */
  fill?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Nothing to expand into: an empty feed opens an empty modal, which is a
  // dead end rather than a disclosure. The card stays inert until there is
  // something to show.
  const openable = events.length > 0;
  const inlineLimit = fill ? events.length : ACTIVITY_INLINE_LIMIT;
  const hidden = Math.max(0, events.length - inlineLimit);

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
          backgroundColor: NEU.surface, borderRadius: 22, border: BENTO_BORDER,
          padding: '13px 16px 14px', gap: 10, flex: 1, minHeight: 168,
          cursor: openable ? 'pointer' : 'default',
          boxShadow: openable && hovered ? NEU.outHover : NEU.out,
          transition: `box-shadow 220ms ${EASE}`,
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <Activity size={15} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
          <h2 style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.deepGold }}>
            Recent Activity
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
          fill ? (
            /* Absolutely placed rows add no height of their own, so the card
               takes exactly the space the column has left and fills it with
               as many rows as fit (the rest scroll), never a gap. */
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <div className="flex flex-col gap-2" style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
                {events.map(ev => <ActivityLine key={ev.key} ev={ev} now={now} />)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {events.slice(0, inlineLimit).map(ev => <ActivityLine key={ev.key} ev={ev} now={now} />)}
            </div>
          )
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
            <h2 style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 900, color: NEU.ink }}>Recent Activity</h2>
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

// Revenue read-out (money card): src/components/conferences/RevenueReadout.tsx

// ── Verification strip: the road to the blue checkmark ───────────────────
// The seven verification stages are the checklist minus the delegate row.
// Minutes come from conference_setup_status() through the manage context;
// these client estimates only fill the gap before that first answer lands.
const VERIFICATION_MINUTES: Record<string, number> = {
  page: 5, committees: 10, chairs: 5, email: 3, secretariat: 3, financials: 5, publish: 1,
};

function VerificationStrip({ fallbackMinutes }: { fallbackMinutes: number }) {
  const { conference, verification } = useManage();
  const verified = !!conference?.is_verified;
  const verifiedAt = conference?.verified_at ?? null;

  // A flip from unverified to verified during this visit earns a short
  // celebration. A conference that loads already verified gets none.
  const seenUnverified = useRef(false);
  const [justVerified, setJustVerified] = useState(false);
  useEffect(() => {
    if (!verified) { seenUnverified.current = true; return; }
    if (!seenUnverified.current) return;
    seenUnverified.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustVerified(true);
    const t = window.setTimeout(() => setJustVerified(false), 14000);
    return () => window.clearTimeout(t);
  }, [verified]);

  const minutes = verification ? verification.minutesLeft : fallbackMinutes;
  const headline = verified
    ? `Verified since ${verifiedAt ? new Date(verifiedAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'}`
    : minutes <= 0
      ? 'Your blue checkmark is one refresh away'
      : minutes === 1
        ? 'About a minute to your blue checkmark'
        : `About ${minutes} minutes to your blue checkmark`;

  return (
    <div className="flex-shrink-0" style={{ marginBottom: 9 }}>
      {justVerified && (
        <div
          role="status"
          className="flex items-start gap-2"
          style={{
            padding: '8px 10px', marginBottom: 8, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(238,217,138,0.55) 0%, rgba(238,217,138,0.25) 100%)',
            boxShadow: `inset 0 0 0 1px rgba(182,135,31,0.35)`,
          }}
        >
          <VerifiedCheck verified size={18} title="Verified conference" style={{ marginTop: 1 }} />
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.forest, lineHeight: 1.35, margin: 0 }}>
            Your conference is verified. The blue checkmark now shows on the directory and your page.
          </p>
        </div>
      )}
      <div className="flex items-center gap-1.5 min-w-0">
        <VerifiedCheck
          verified={verified}
          showUnverified
          size={16}
          title={verified
            ? 'Verified conference'
            : 'Earned automatically once page, committees, chairs, emails, secretariat, payment method and publishing are done.'}
        />
        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: verified ? NEU.forest : NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
          {headline}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders nothing. Asks the database to recompute the checkmark on mount and
 * whenever the checklist moves (cheap and idempotent: it only refetches the
 * row when the answer changed). It lived inside VerificationStrip, which is
 * not rendered once the priorities card collapses to the share hero, so it is
 * mounted on its own in both states.
 */
function VerificationRefresher({ doneCount }: { doneCount: number }) {
  const { refreshVerification } = useManage();
  useEffect(() => { void refreshVerification(); }, [doneCount, refreshVerification]);
  return null;
}

// ── Announcing a finished set-up priority ─────────────────────────────────
// A ticked row is REMOVED from the checklist rather than sunk to the bottom,
// so the tick itself is no longer the feedback: the row simply vanishes. The
// notification is what replaces it, and it has to say both what was finished
// and what that unlocked, because the organiser can no longer read the answer
// off a struck-through line.
//
// One sentence each, no second guessing: these fire at most nine times in the
// life of a conference.

/** Long enough to read two lines, short enough to leave on its own. */
const SETUP_NOTICE_TTL_MS = 8_000;

const SETUP_DONE_NOTICE: Record<string, { title: string; body: string }> = {
  page: {
    title: 'Your conference page is ready',
    body: 'Delegates opening your public page now see the banner and the description.',
  },
  committees: {
    title: 'Committees are ready',
    body: 'You have enough seats for the head count you are expecting.',
  },
  chairs: {
    title: 'Your dais has a chair',
    body: 'Chairs can run their committee sessions from their own dashboard.',
  },
  email: {
    title: 'Emails explored',
    body: 'You have seen what goes out to applicants automatically.',
  },
  secretariat: {
    // True whichever way the stage was cleared: a co-organizer invited, or the
    // organiser saying they are running this one on their own. This card is
    // raised by SetupCompletionNotices the moment the row flips, so the solo
    // path deliberately does not raise a second one of its own.
    title: 'Your secretariat is settled',
    body: 'That stage is done. You can invite co-organizers whenever you want the help.',
  },
  financials: {
    title: 'Financial information is set',
    body: 'Delegates finally have somewhere to pay their fee, so publishing is unblocked.',
  },
  delegate: {
    title: 'Your first delegate applied',
    body: 'Review applications and start accepting people into committees.',
  },
  publish: {
    title: 'Registrations are live',
    body: 'Your conference is on gavelling.com and open to applications.',
  },
};

/**
 * Renders nothing. Watches the checklist and raises one notification per row
 * that flips from pending to done DURING this visit.
 *
 * Notifications go through `sessionNotifications.notify()` because
 * `manage/[slug]/layout` already mounts the one `<NotificationStack/>` for
 * every organiser page; there is no second toast system to reach for and
 * nothing to mount from here. `appNotify`'s `notifyOk` is the usual organiser
 * front door but it is deliberately title-only and keyed per surface, which
 * would collapse two rows finished in the same breath into one card. These
 * need a body line and a per-item key, so they call the store directly.
 *
 * Key is `setup:<row>:<conferenceId>` — it names the THING (rule 1), not the
 * instant it happened, so a re-render, a refetch or a second tab cannot stack
 * duplicates. TTL is finite: nothing here is actionable, the work is already
 * done, and a sticky card would sit on the dashboard until dismissed by hand.
 *
 * FIRST LOAD IS SILENT. The previous done-set lives in a ref that starts null;
 * the first pass after mount only records the baseline. An organiser arriving
 * at a conference with six rows already ticked gets nothing, which is the
 * whole point — only genuine transitions are news. The ref is re-baselined on
 * a conference change too, so switching conferences is equally quiet.
 */
function SetupCompletionNotices({
  conferenceId,
  items,
}: {
  conferenceId: string;
  items: { key: string; done: boolean }[];
}) {
  const prevDone = useRef<Set<string> | null>(null);
  const prevConference = useRef<string | null>(null);
  // Compared by value, so the effect ignores the fresh array identity every
  // render produces and only wakes when a row actually flips.
  const doneSignature = items.filter(i => i.done).map(i => i.key).sort().join(',');

  useEffect(() => {
    const doneNow = new Set(doneSignature ? doneSignature.split(',') : []);
    const baseline = prevDone.current;
    const sameConference = prevConference.current === conferenceId;
    prevDone.current = doneNow;
    prevConference.current = conferenceId;
    // First pass for this conference: record where we started, say nothing.
    if (!baseline || !sameConference) return;
    for (const key of doneNow) {
      if (baseline.has(key)) continue;
      const copy = SETUP_DONE_NOTICE[key];
      if (!copy) continue;
      notify({
        key: `setup:${key}:${conferenceId}`,
        kind: 'info',
        level: 'ok',
        title: copy.title,
        body: copy.body,
        ttlMs: SETUP_NOTICE_TTL_MS,
      });
    }
  }, [doneSignature, conferenceId]);

  return null;
}

// ── Dashboard home, single-viewport neumorphic grid, no scroll ────────────

export default function DashboardPage() {
  const router = useRouter();
  const { conference, refreshConferenceQuiet, verification, refreshVerification } = useManage();
  const { session } = useAuth();
  const [soloSaving, setSoloSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);
  // The applicants card's width decides the dial's diameter (one-screen grid).
  const [dialCardRef, dialSize] = useDialSize();
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
      const [appsRes, allocRes, committeesRes, orgRes, emailRes, chairInvRes, orgInvRes, chairInvAllRes] = await Promise.all([
        // Paged: one request stops silently at 1,000 rows, which undercounted
        // every tile of a big conference.
        fetchAllRows((from, to) => supabase
          .from('applications')
          .select('id, user_id, submitted_at, status, payment_status, role, society_id, pledge_type, spots_pledged, advisors_pledged')
          .eq('conference_id', confId)
          .order('id', { ascending: true })
          .range(from, to)),
        // created_at, not a head-only count: the Assigned series on
        // ParticipantsChart is plotted from these instants. The count the
        // tiles use is just this array's length.
        fetchAllRows((from, to) => supabase
          .from('conference_allocations')
          .select('id, created_at')
          .eq('conference_id', confId)
          .order('id', { ascending: true })
          .range(from, to)),
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
        // Chair invites for the invite-acceptance card: who has accepted and
        // what is still out. Declined and revoked rows are not counted.
        supabase
          .from('conference_chair_invites')
          .select('status, invited_user_id')
          .eq('conference_id', confId)
          .in('status', ['pending', 'accepted']),
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
        chairInvites: (chairInvAllRes.data ?? []) as ChairInviteRow[],
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

  /** Is the "Explore emails" stage done, as THE SERVER counts it?
   *
   *  This row used to be ticked from localStorage alone, which made it the one
   *  checklist item that could disagree with the database. `conference_setup_status()`
   *  counts it done when `emails_explored_at IS NOT NULL` **OR** an enabled
   *  `email_templates` row exists — so an organiser who had already turned an
   *  email on, or who came back on a second device, in another browser, in a
   *  private window, or after clearing site data, was told to go and do a step
   *  the checkmark logic had already credited. It never cleared, because
   *  nothing they could do on the dashboard would write that browser's key.
   *
   *  The server is the only authority worth having here, and it is already on
   *  screen: the layout reads `verification_pending` from that same function.
   *  A verified conference has, by definition, no pending verification stage.
   *  localStorage survives only as the optimistic tick for the seconds between
   *  visiting the emails page and the row being refetched. */
  const emailStageDone = conference?.is_verified
    ? true
    // A UNION, deliberately, not a precedence chain. Any one of these being
    // true means the step is genuinely done, and reading them in priority
    // order is what made this row stick: `verification.pending` is fetched
    // once per conference, so coming back from the emails page it still
    // listed 'email', the row stayed unticked, `doneCount` never moved, and
    // VerificationStrip's refresh effect is keyed on `doneCount` — the stale
    // answer prevented the very refresh that would have corrected it.
    // localStorage ticks the instant they click through, the server column
    // arrives with refreshConferenceQuiet, and verification confirms it
    // later. None of them can now be outvoted by a stale sibling.
    : (!!conference?.emails_explored_at
        || emailsExplored
        || (!!verification && !verification.pending.includes('email')));

  // Money card: the payments ledger, never payment_status x fee.
  const { money } = useConferenceMoney(session?.access_token, conference?.id);
  const [delegatePrice, setDelegatePrice] = useState<DelegatePrice>(TBD_PRICE);
  useEffect(() => {
    if (!conference?.id) return;
    let alive = true;
    fetchDelegatePrices(supabase, [{ id: conference.id, fee_currency: conference.fee_currency }])
      .then(m => { if (alive) setDelegatePrice(m.get(conference.id) ?? TBD_PRICE); })
      .catch(() => { /* stays TBD: the read-out then says no fee, as before */ });
    return () => { alive = false; };
  }, [conference?.id, conference?.fee_currency]);

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
    const bone = (style: React.CSSProperties, className = '') => (
      <div className={`rounded-[22px] animate-pulse ${className}`} style={{ backgroundColor: NEU.surface, boxShadow: NEU.out, ...style }} />
    );
    return (
      <div className="gv-dash">
        <style>{DASH_CSS}</style>
        {bone({ height: 44, marginBottom: 12, flexShrink: 0 })}
        <div className="gv-dash-grid">
          <div className="gv-dash-col1">
            {bone({ height: 360 }, 'gv-dash-prio')}
            {bone({ minHeight: 170 }, 'gv-dash-activity')}
          </div>
          {bone({ height: 250 }, 'gv-dash-dial')}
          {bone({ height: 250 }, 'gv-dash-traffic')}
          {bone({}, 'gv-dash-chart')}
        </div>
      </div>
    );
  }

  const slug = conference.slug;
  // The organiser has said they are running this alone. It satisfies the
  // secretariat stage on its own; see handleSoloSecretariat.
  const soloSecretariat = !!conference.solo_secretariat_ack_at;

  /**
   * "I'm running this one on my own."
   *
   * The `secretariat` verification stage used to demand a SECOND organiser, so
   * a conference genuinely run by one person could never be verified however
   * ready everything else was. This is the other way to satisfy it: the
   * organiser says so, once, and we stamp when they said it. It is never set
   * for anybody automatically, and inviting someone later still works — the
   * stage is a UNION, not a switch.
   */
  async function handleSoloSecretariat() {
    if (!conference || !session || soloSaving) return;
    setSoloSaving(true);
    const supabase = getAuthedClient(session.access_token);
    // .select() so a zero-row write (RLS refusing us) is visible. supabase-js
    // resolves with error null on a write that matched nothing, so counting
    // the returned rows is the only honest confirmation.
    const { data, error } = await supabase
      .from('conferences')
      .update({ solo_secretariat_ack_at: new Date().toISOString() })
      .eq('id', conference.id)
      .select('id');
    setSoloSaving(false);
    if (error || !data || data.length === 0) {
      notifyErr('Could not save that. Try again in a moment.', 'solo-secretariat');
      return;
    }
    await refreshConferenceQuiet();
    void refreshVerification();
    // No success toast here: the checklist row flips to done on the refreshed
    // conference and SetupCompletionNotices raises the card. Two would be noise.
  }

  const confYear = conference.start_date ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  // ── Derived numbers ──────────────────────────────────────────────────────
  // Accepted = accepted-or-beyond. Allocating flips an application's status to
  // 'assigned' (and check-in to 'checked-in'), so a naive status === 'accepted'
  // count would exclude everyone already allocated and read *lower* than the
  // allocated number — an impossibility, since Allocated ⊆ Accepted. Counting
  // all three states keeps Allocated a true subset of Accepted.
  const acceptedApps = dash.apps.filter(
    a => a.status === 'accepted' || a.status === 'assigned' || a.status === 'checked-in'
  ).length;
  const delegateApps = dash.apps.filter(a => a.role === 'delegate' || a.role === 'head-delegate').length;
  const societies = new Set(dash.apps.map(a => a.society_id).filter(Boolean)).size;
  // People a delegation has pledged to bring who have no application row yet,
  // net of anyone already registered under that delegation, so a spot is never
  // counted twice (src/lib/pledgedSpots.ts). They join the dial's headline.
  const pledgedSpots = outstandingPledgedSpots(dash.apps);
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
  // The delegate price from the delegate role config (the same rule as the
  // public page, src/lib/publicFees.ts), never conferences.fee_amount, which is
  // a stale denormalised column: NMUN 2026 read 0 GBP there while its delegate
  // fee was a 150 INR phase, so the dashboard said "No delegate fee set".
  const fee = delegatePrice.kind === 'paid' ? delegatePrice.amount : 0;
  const feeCurrency = delegatePrice.kind === 'paid' ? delegatePrice.currency : (conference.fee_currency ?? 'USD');

  // Applied and accepted per role (delegates, faculty advisors, observers,
  // chairs), against the expected head count. The definitions are written at
  // the top of src/components/conferences/InviteAcceptance.ts. They feed the
  // dial: per role a solid accepted band and a tinted pending band, the centre
  // applied of expected. Chairs deep-link to the committees page, where chairs
  // are invited; the other roles to the applications table.
  const dialStages = applicationsByRole(dash.apps, dash.chairInvites).map(r => ({
    key: r.key,
    label: INVITE_ROLE_LABEL[r.key],
    applied: r.applied,
    accepted: r.accepted,
    href: r.key === 'chairs' ? `/manage/${slug}/committees` : `/manage/${slug}/applications`,
  }));

  // ── Set-up priorities: 8 detection checks, in journey order ──────────────
  // Base order = the natural build journey (page → committees → chairs → email →
  // secretariat → financials → delegate → launch). Done rows are
  // filtered out entirely rather than sorted to the bottom, and what is left is
  // then reordered around the organiser's stated intent — both in
  // `pendingChecklist` below, which is where the render order is decided.
  //
  // "Set up awards" was the ninth row. Awards are behind a coming-soon screen
  // in Settings, so nudging an organiser to configure them would be nudging
  // them at a holding page. The same row was removed from the SQL twin
  // `conference_setup_status()` (which drives the nudge emails and /admin) in
  // the same change. ("Get your first delegate" was removed on 8 Sep, so
  // setup_total is now 7 in both places, all of them verification stages.) It was never a
  // verification criterion, so the blue checkmark is untouched.
  // Client twin of conference_setup_status()'s 'page' item: real dates are
  // now part of what "set up" means, because a TBD conference can never be
  // public (CHECK conferences_tbd_not_public) — the same rule PublishModal
  // checks before it ever tries the write.
  const pageNeedsDates = conference.dates_tbd || !conference.start_date;
  const checklist = [
    {
      key: 'page',
      icon: Palette,
      emoji: 'Artist palette',
      gradient: NEU_GRADIENTS.amber,
      title: 'Set up your conference page',
      sub: pageNeedsDates
        ? ((!conference.banner_url || !conference.description?.trim())
          ? 'Add your conference dates, a banner and a description.'
          : "Add your conference dates. Without them it can't be published.")
        : 'Add a banner and a description delegates will see.',
      done: !!conference.banner_url && !!conference.description?.trim() && !conference.dates_tbd && !!conference.start_date,
      onClick: () => router.push(pageNeedsDates
        ? `/manage/${slug}/settings?tab=conference&focus=dates`
        : `/manage/${slug}/settings?tab=conference`),
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
          ? `Only ${seatCapacity} seats for ${expectedDelegates} expected delegates. ${seatShortfall} more covers most of them.`
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
      // Ticked by visiting the communications page, or by having any email
      // turned on. See `emailStageDone` above: the answer comes from
      // conference_setup_status() so this row cannot disagree with the
      // checkmark, which is exactly what it used to do.
      done: emailStageDone,
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
          ? 'Invite sent. Waiting for them to accept.'
          : soloSecretariat
            ? 'You are running this one on your own.'
            : 'Invite co-organizers and grant them access.',
      // One invite out is enough: the organiser has done the part they control,
      // and accepting is not theirs to do. A solo organiser who has said so is
      // the third way through: this stage gates the blue checkmark, and there
      // was no honest answer here for a conference that really is one person.
      done: dash.organizerCount > 1 || dash.pendingOrganizerInvites > 0 || soloSecretariat,
      onClick: () => router.push(`/manage/${slug}/settings?tab=organizers`),
      // Secondary, and quiet on purpose. The row's own click still goes to the
      // invite screen, which stays the thing we suggest; this is only here so
      // someone with nobody to invite is not stuck. Muted rather than gold,
      // and it never nags.
      action: (
        <button
          onClick={(e) => { e.stopPropagation(); void handleSoloSecretariat(); }}
          disabled={soloSaving}
          title="Marks this stage done so a one-person secretariat can still earn the checkmark. You can invite people any time."
          className="focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            color: NEU.muted, background: 'none', border: 'none',
            cursor: soloSaving ? 'default' : 'pointer', padding: '2px 4px',
            opacity: soloSaving ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {soloSaving ? 'SAVING…' : "I'M ON MY OWN"}
        </button>
      ),
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
      // Compact publish CTA lives here as the checklist's launch row, the
      // big accent quick-actions card was removed with the one-page layout.
      key: 'publish',
      icon: Rocket,
      emoji: 'Rocket',
      gradient: NEU_GRADIENTS.forest,
      title: 'Publish your conference',
      sub: conference.is_public ? 'Your conference is live.' : 'Publish your conference to gavelling.com.',
      done: conference.is_public,
      onClick: handlePublishClick,
    },
  ];
  const doneCount = checklist.filter(c => c.done).length;
  // Used only while the server's own estimate has not arrived yet: the
  // verification stages are the checklist minus the delegate row.
  const fallbackMinutes = checklist
    .filter(c => !c.done && c.key in VERIFICATION_MINUTES)
    .reduce((sum, c) => sum + VERIFICATION_MINUTES[c.key], 0);
  const sealTitle = conference.is_verified
    ? 'Verified conference'
    : verification ? minutesToCheckmarkLabel(verification.minutesLeft) : 'Not verified yet';
  // Done rows LEAVE the list. They used to sink to the bottom, which meant a
  // well-run conference spent the whole season looking at a card that was
  // mostly finished work; the priorities card is a to-do list, and a to-do
  // list that never shrinks stops reading as one. The completion itself is
  // reported by SetupCompletionNotices as the row disappears, so nothing is
  // lost by removing it.
  //
  // `doneCount` above is deliberately still counted over the FULL checklist —
  // the heading, the ring and the progress bar all report total progress, and
  // they would be meaningless read against a list that only holds what is
  // left. Only the rendered rows are filtered.
  //
  // The pending rows are then ordered around what the organiser told us at the
  // end of creation (`conferences.intent`). This is presentation only: the sort
  // runs on the FILTERED COPY, so `checklist` itself, `doneCount`, the ring, the
  // progress bar and SetupCompletionNotices all still read the full nine rows in
  // journey order and cannot disagree with each other. Nothing is ever dropped —
  // `financials` in particular gates the blue checkmark and publishing itself,
  // so a conference that hid it could neither publish nor be told why.
  //
  // Stable by construction: the comparator returns 0 for equal ranks, so within
  // each band the journey order survives untouched. An intent of `{}` (every
  // conference created before this shipped, and anyone who skipped) boosts
  // nothing, so every row scores 1 except `publish` at 2 — and `publish` is
  // already last in the array, which makes the order for them byte-identical to
  // what it was.
  const intent = getConferenceIntent(conference.intent);
  const intentRankOf = intentRank(intent);
  const pendingInJourneyOrder = checklist.filter(c => !c.done);
  const pendingChecklist = [...pendingInJourneyOrder]
    .sort((a, b) => intentRankOf(a.key) - intentRankOf(b.key));
  // Only worth a line when the answer actually moved a row on THIS screen.
  // Compared row by row rather than inferred from the answer, so a conference
  // whose order happens to come out identical (marketing boosts `page`, which
  // already leads) never claims a change the organiser cannot see.
  const intentReordered =
    intent.keys.length > 0 &&
    pendingChecklist.some((c, i) => c.key !== pendingInJourneyOrder[i].key);

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

  // Everything done AND verified: the priorities card collapses to one line
  // and the share action becomes its protagonist (owner, 21 Sep 2026).
  const allSetAndVerified = pendingChecklist.length === 0 && !!conference.is_verified;

  return (
    <div
      className="gv-dash relative"
      style={{ fontFamily: OUTFIT, isolation: 'isolate', overflowX: 'clip' }}
    >
      <style>{DASH_CSS}</style>
      {/* Decorative bleed: faded organiser glyphs off the dashboard edges,
          tucked behind the content (zIndex -1). */}
      <DecorativeBleed
        zIndex={-1}
        items={[
          { Icon: Gavel, size: 170, top: '-30px', right: '-40px', opacity: 0.045, rotate: -12 },
          // bottom 0, never negative: overflow-x is clipped but overflow-y is
          // not, so a glyph hanging below the page used to add a scroll of its own.
          { Icon: UsersRound, size: 150, bottom: 0, left: '-38px', opacity: 0.04 },
          { Icon: Globe2, size: 110, top: '55%', right: '-24px', opacity: 0.035 },
        ]}
      />

      {/* ── Header, one row: identity, the money strip, status ──
          The money is one line here now instead of a card inside the
          applicants tile (owner: "make the financials much smaller"). */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap flex-shrink-0" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-3 min-w-0" style={{ flex: '1 1 260px' }}>
          <LogoDisc
            src={conference.logo_url}
            alt={conference.acronym}
            size={36}
            fallbackText={conference.acronym.slice(0, 2)}
          />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: NEU.deepGold }}>
              {conference.acronym}{confYear ? ` · ${confYear}` : ''} · DASHBOARD
            </p>
            <h1 className="font-black flex items-center gap-1.5 min-w-0" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 18, lineHeight: 1.15, marginTop: 1 }}>
              <span className="truncate">{conference.full_name}</span>
              <VerifiedCheck verified={conference.is_verified} showUnverified size={18} title={sealTitle} />
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <RevenueReadout
            fee={fee}
            currency={feeCurrency}
            money={money}
            href={`/manage/${slug}/financials`}
          />
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

      {/* ── The one-screen grid (src/components/conferences/dashboardLayout.tsx).
          From 1024x600 up it takes exactly the window under the top bar and
          nothing grows the page; below that it stacks and scrolls. ── */}
      <div className="gv-dash-grid">

        {/* Column 1: priorities (shrinks, its rows scroll inside) over the
            activity feed (takes the rest). The feed rises as the priorities
            get done, and owns almost the whole column once they are. */}
        <div className="gv-dash-col1">

        {/* Headless: keeps the stored checkmark in step with the checklist in
            both card states. */}
        <VerificationRefresher doneCount={doneCount} />
        {/* Headless. Raises a card as each row leaves the list. */}
        <SetupCompletionNotices
          conferenceId={conference.id}
          items={checklist.map(c => ({ key: c.key, done: c.done }))}
        />

        {allSetAndVerified ? (
          <NeuCard className="gv-dash-prio flex flex-col" style={{ padding: '14px 15px', border: BENTO_BORDER, backgroundColor: BENTO_WASH_FOREST }}>
            <UntoldSeatsRow conferenceId={conference.id} slug={slug} />
            <ShareHero conference={conference} />
          </NeuCard>
        ) : (
        <NeuCard className="gv-dash-prio flex flex-col" style={{ padding: '13px 15px 11px', border: BENTO_BORDER, backgroundColor: BENTO_WASH_FOREST }}>
          <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginBottom: 7 }}>
            <div className="min-w-0">
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>Set-up Priorities</h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} of {checklist.length} done{doneCount === checklist.length ? '. You are all set.' : ''}
              </p>
            </div>
            <NeuRing value={doneCount} max={checklist.length} size={44} strokeWidth={6} gradient={NEU_GRADIENTS.gold}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 12, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {doneCount}<span style={{ fontSize: 9, color: NEU.muted }}>/{checklist.length}</span>
              </span>
            </NeuRing>
          </div>

          <VerificationStrip fallbackMinutes={fallbackMinutes} />

          <NeuProgress value={doneCount} max={checklist.length} gradient={NEU_GRADIENTS.gold} thumb height={8} style={{ marginBottom: 9, flexShrink: 0 }} />

          {/* The rows scroll inside the card in the one-screen grid, so a long
              list never pushes the feed below the fold. Finished rows are gone,
              not greyed; the share row is always last. */}
          <div className="gv-dash-prio-rows flex flex-col" style={{ gap: 5 }}>
            {/* Work, not set-up: outside `checklist`, so the ring never counts it. */}
            <UntoldSeatsRow conferenceId={conference.id} slug={slug} />
            {pendingChecklist.length === 0 ? (
              /* Every stage is done but the checkmark has not landed yet (the
                 database recomputes it on this visit). The share row below is
                 already the next thing to do. */
              <div
                className="flex items-center gap-2.5 flex-shrink-0"
                style={{
                  padding: '9px 12px', borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(61,122,82,0.18) 0%, rgba(61,122,82,0.06) 100%)',
                  boxShadow: 'inset 0 0 0 1px rgba(61,122,82,0.30)',
                }}
              >
                <Emoji3D name="Party popper" size={24} fallback={CheckCircle2} fallbackColor={NEU.forest} />
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.forest, margin: 0, lineHeight: 1.3 }}>
                  Every priority is done
                </p>
              </div>
            ) : (
              <>
                {/* One quiet line, and only when the answer actually moved a
                    row, so the order never looks arbitrary. */}
                {intentReordered && (
                  <p className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, margin: '0 0 1px 2px' }}>
                    Ordered around what you told us you need.{' '}
                    <Link
                      href={`/manage/${slug}/settings?tab=conference&focus=intent`}
                      className="focus:outline-none"
                      style={{ color: NEU.inkSoft, textDecoration: 'underline', textUnderlineOffset: 2 }}
                    >
                      Change this
                    </Link>
                  </p>
                )}
                {pendingChecklist.map(item => (
                  <div key={item.key} className="flex-shrink-0">
                    <NeuChecklistRow
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
                  </div>
                ))}
              </>
            )}
            <ShareLinkRow conference={conference} />
          </div>
          {publishBlockMsg && (
            <p className="flex-shrink-0" style={{ fontSize: 11, marginTop: 7, color: NEU.amber, fontFamily: OUTFIT, fontWeight: 700 }}>{publishBlockMsg}</p>
          )}
        </NeuCard>
        )}

        {/* Secretariat activity, fills whatever height column 1 has left. */}
        <div className="gv-dash-activity">
          <RecentActivity events={activity} now={now} fill />
        </div>

        </div>

        {/* Applicants against target, per role, on the original applicants dial
            (owner, 23 Sep 2026: applied against the expected head count, with
            accepted inside it). The red "to assign" badge beside the heading,
            one quiet footer line. */}
        <div className="gv-dash-dial gv-dash-cell">
        <NeuCard className="flex flex-col" style={{ padding: '13px 16px 12px', border: BENTO_BORDER, height: '100%' }}>
          <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginBottom: 6, minHeight: 28 }}>
            <h2 className="truncate" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>
              Applicants Against Target
            </h2>
            <UnallocatedBadge count={unallocated} href={`/manage/${slug}/assignment`} />
          </div>
          <div ref={dialCardRef} className="flex items-center" style={{ flex: 1, minHeight: 0 }}>
            <ApplicantsDial
              stages={dialStages}
              expected={expectedDelegates}
              pledged={pledgedSpots}
              size={dialSize}
              onNavigate={(href) => router.push(href)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginTop: 6 }}>
            <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
              {societies} delegation{societies === 1 ? '' : 's'} · {committeeCount} committee{committeeCount === 1 ? '' : 's'}
            </span>
            <Link
              href={expectedDelegates > 0 ? `/manage/${slug}/applications` : `/manage/${slug}/settings?tab=conference`}
              className="inline-flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-70 focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
                color: NEU.deepGold, textDecoration: 'none',
              }}
            >
              {expectedDelegates > 0 ? 'REVIEW APPLICATIONS' : 'SET AN EXPECTED HEAD COUNT'}
              <ArrowRight size={12} />
            </Link>
          </div>
        </NeuCard>
        </div>

        <div className="gv-dash-traffic gv-dash-cell">
          <TrafficSourcesCard conferenceId={conference.id} />
        </div>

        {/* Participants over time, across both right-hand columns, taking
            every pixel of height row 2 has (fill mode draws 1:1, so the axis
            type never scales with the card). */}
        <div className="gv-dash-chart gv-dash-cell">
        <NeuCard className="flex flex-col" style={{ padding: '12px 16px 12px', border: BENTO_BORDER, height: '100%' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ParticipantsChart points={participantSeries} fill />
          </div>
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
