'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, MessageCircle, Music, Users, GraduationCap, Monitor, Mail, Landmark, ChevronDown, ChevronLeft, ChevronRight, Check, X, Plus, ArrowUp, ArrowDown, ArrowUpDown, Star, LayoutDashboard, ArrowRight, UserRound, Gavel, Eye, Loader2, PartyPopper, Clock, ScrollText, CreditCard } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import DecorativeBleed from '@/components/DecorativeBleed';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { OrganizerPencil } from '@/components/OrganizerPencil';
import ProfileLink from '@/components/ProfileLink';
import { LogoDisc } from '@/components/LogoDisc';
import { LogoCropModal } from '@/components/LogoCropModal';
import { uploadConferenceAsset } from '@/lib/conferenceAssets';
// Compact: public price displays abbreviate at 10k (Rp300000 -> Rp300k).
// Checkout/invoice surfaces deliberately keep the exact formatFee.
import { formatFeeCompact } from '@/lib/utils';
import { activeFeePhase, activePhaseFee, type FeePhase } from '@/lib/finance';
import { fetchDelegateFees, type ResolvedFee } from '@/lib/publicFees';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { normalizeBlocks } from '@/lib/customQuestions';
import { appendEditionYear } from '@/lib/presetNames';
import { conferenceAcronymLabel, conferenceFullNameLabel, conferenceLabels } from '@/lib/conferenceLabels';
import ConferencePartners, { type PartnerEntry } from '@/components/ConferencePartners';
import { formatConferenceDates } from '@/lib/conferenceDates';
import ParticipantView from '@/app/conferences/[slug]/participant/ParticipantView';
import type { ParticipantAllocation } from '@/app/conferences/[slug]/participant/types';
import { NEU, NEU_GRADIENTS, NeuIconDisc } from '@/components/neu';
import { SidebarCardSkeleton } from '@/components/Skeleton';
import Loader from '@/components/Loader';
import {
  CommitteeEditorModal,
  ModalOverlay,
  type EditableCommittee,
} from '@/components/CommitteeEditorModal';
import { useScrollLock } from '@/hooks/useScrollLock';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

// Bundled banner presets, same list as manage/[slug]/settings BANNER_PRESETS.
const BANNER_PRESETS = [
  '/banners/preset-1.jpg',
  '/banners/preset-2.jpg',
  '/banners/preset-3.jpg',
  '/banners/preset-4.jpg',
  '/banners/preset-5.jpg',
];

// House modal form styles, same recipe as CommitteeEditorModal.
const modalInputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #DDD4C0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#1C1410',
  backgroundColor: '#FAF8F3',
  outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6E5F4E',
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: '0.01em',
  marginBottom: 4,
};

// ── Types ──────────────────────────────────────────────────────────────────

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  country: string;
  city: string;
  format: string;
  student_level: string;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean | null;
  fee_amount: number;
  fee_currency: string;
  expected_delegates: number;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_public: boolean;
  status: string;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
  website_url: string | null;
  contact_email: string | null;
  organizer_id: string;
  min_age: number | null;
  max_age: number | null;
  allocation_swap_mode: string;
  display_secretariat: SecretariatMember[] | null;
  connect_onboarding_status: string;
  /** The ACTIVE payout method ('stripe' | 'manual' | null) — mutually
   *  exclusive, but each keeps its own setup dormant while inactive. */
  payment_method: string | null;
  external_payment_url: string | null;
  external_payment_note: string | null;
  financial_aid_enabled: boolean;
  aid_questions: unknown[];
  aid_intro: string | null;
}

interface SecretariatMember {
  name: string;
  avatar_url: string | null;
  title: string | null;
}

interface PartnerConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
}

/** One `conference_partners` row as this page reads it. Either shape: a linked
 *  conference (partner_conference_id set) or a company typed in by the
 *  organiser (partner_conference_id null + company_* columns). */
interface PartnerLinkRow {
  id: string;
  partner_conference_id: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  company_description: string | null;
  sort_order: number;
}

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number | null;
  delegation_size: number;
  display_chairs: DisplayChair[] | null;
  chair_user_ids: string[] | null;
  logo_url: string | null;
}

interface CommitteeSlot {
  country_code: string;
  country_name: string;
  delegation_size: number;
}

interface RoleConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_amount: number | null;
  fee_currency: string | null;
  auto_accept: boolean;
  payment_timing: string;
  allow_partial_payments: boolean;
  fee_phases: FeePhase[] | null;
  allow_resubmission: boolean;
}

interface MyApplication {
  id: string;
  role: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  society_id: string | null;
  self_paid: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
  organizer_note: string | null;
}

interface ConferenceReview {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  display_name: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null): string {
  return formatConferenceDates(start, end, { style: 'dmy-end-year-spaced' });
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(61,122,82,0.13)',   color: '#2A5A3C' },
  intermediate: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced:     { bg: 'rgba(184,132,74,0.16)',  color: '#B8844A' },
  expert:       { bg: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
};

const ROLE_LABELS: Record<string, string> = {
  delegate: 'Delegate',
  chair: 'Chair',
  'head-delegate': 'Head Delegate',
  'faculty-advisor': 'Faculty Advisor',
  observer: 'Observer',
  crisis: 'Crisis Staff',
  press: 'Press',
  staff: 'Staff',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? capitalize(role.replace(/-/g, ' '));
}

function fmtReviewDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso);
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────

/** Small age-limit chip shown near the apply CTA on the dark green card.
 *  Reads "16+", "up to 26" or "16–26" depending on which bounds are set. */
function MinAgeChip({ minAge, maxAge }: { minAge: number | null; maxAge: number | null }) {
  const label =
    minAge != null && maxAge != null ? `${minAge}–${maxAge}`
      : minAge != null ? `${minAge}+`
        : `UP TO ${maxAge}`;
  const requirement =
    minAge != null && maxAge != null ? `between ${minAge} and ${maxAge} years old`
      : minAge != null ? `at least ${minAge} years old`
        : `no older than ${maxAge}`;
  return (
    <span
      title={`This conference requires delegates to be ${requirement} at its start date`}
      className="flex-shrink-0 inline-flex items-center rounded-full"
      style={{
        padding: '3px 9px',
        backgroundColor: 'rgba(238,217,138,0.14)',
        border: '1px solid rgba(238,217,138,0.4)',
        color: '#EED98A',
        fontFamily: "'Outfit', sans-serif",
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </span>
  );
}

/** Big gold role glyph shown beside each role in the APPLY NOW picker.
 *  Delegate = a plain user; chair = a user holding a gavel (user + gavel
 *  badge); head-delegate = a group; observer = an eye; faculty advisor = a
 *  graduation cap. Purely decorative, in the conference gold. */
function RoleApplyGlyph({ role, size = 30 }: { role: string; size?: number }) {
  const GOLD = '#EED98A';
  if (role === 'chair') {
    return (
      <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }} aria-hidden>
        <UserRound size={size} strokeWidth={2.1} style={{ color: GOLD }} />
        <Gavel
          size={Math.round(size * 0.56)}
          strokeWidth={2.4}
          style={{ color: GOLD, position: 'absolute', right: -5, bottom: -4, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}
        />
      </span>
    );
  }
  const Icon = role === 'head-delegate' ? Users
    : role === 'observer' ? Eye
    : role === 'faculty-advisor' ? GraduationCap
    : UserRound; // delegate
  return <Icon size={size} strokeWidth={2.1} style={{ color: GOLD, flexShrink: 0 }} aria-hidden />;
}

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.8}
          style={{
            color: i <= rating ? '#B6871F' : 'rgba(154,138,120,0.4)',
            fill: i <= rating ? '#B6871F' : 'none',
          }}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: ConferenceReview }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: '30px', height: '30px', borderRadius: '9999px',
              backgroundColor: '#1B3828', color: '#EED98A',
              fontSize: '12px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
            }}
          >
            {(review.display_name ?? 'V').charAt(0).toUpperCase()}
          </span>
          <span className="text-[13.5px] font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {review.display_name ?? 'Verified delegate'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StarRow rating={review.rating} />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: '10px', color: '#9A8A78', letterSpacing: '0.01em' }}>
            {fmtReviewDate(review.created_at)}
          </span>
        </div>
      </div>
      {review.review_text && (
        <p className="text-[13.5px] mt-3" style={{ color: '#3B342C', fontFamily: "'Outfit', sans-serif", lineHeight: 1.75, margin: '12px 0 0 0' }}>
          {review.review_text}
        </p>
      )}
    </div>
  );
}

function SortButton({ label, dir, onClick }: { label: string; dir: 'asc' | 'desc' | null; onClick: () => void }) {
  const active = dir !== null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10.5px] font-bold transition-colors focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'rgba(237,231,216,0.5)',
        color: active ? '#EED98A' : '#6B5F52',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.09em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
      {dir === 'asc' ? (
        <ArrowDown size={12} strokeWidth={2.4} />
      ) : dir === 'desc' ? (
        <ArrowUp size={12} strokeWidth={2.4} />
      ) : (
        <ArrowUpDown size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
      )}
    </button>
  );
}

/** Cycling committee-type filter pill: all → GA only → crisis only → all. Shares the SortButton pill styling. */
function TypeFilterButton({ mode, onClick }: { mode: 'ga' | 'crisis' | null; onClick: () => void }) {
  const active = mode !== null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10.5px] font-bold transition-colors focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'rgba(237,231,216,0.5)',
        color: active ? '#EED98A' : '#6B5F52',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.09em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {mode === 'ga' ? 'GA ONLY' : mode === 'crisis' ? 'CRISIS ONLY' : 'GA / CRISIS'}
      {active ? (
        <Check size={12} strokeWidth={2.4} />
      ) : (
        <ArrowUpDown size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
      )}
    </button>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] p-6 md:p-7 ${className}`}
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        boxShadow: '0 1px 3px rgba(27,56,40,0.04)',
      }}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type TabKey = 'overview' | 'participant' | 'reviews';
/** Left-to-right order of the tab strip. A switch slides the incoming pane in
 *  from the right when moving forward through this list, from the left when
 *  moving back. */
const TAB_ORDER: readonly TabKey[] = ['overview', 'participant', 'reviews'];

export interface ConferenceDetailClientProps {
  /** Which route segment mounted this component: the plain landing page
   *  (description-only), a /role or /role/[role] participant route, or
   *  /reviews. Seeds the tab, so every one of those URLs stays a real,
   *  shareable deep link; thin page.tsx files pass it in explicitly from
   *  their own route rather than the component guessing it from the URL.
   *  After mount the tab is client state — see `showTab`. */
  initialView: TabKey;
  /** The conference row, fetched on the server so the page's real content —
   *  name, acronym, dates, place — is in the HTML a crawler receives rather
   *  than arriving later behind a spinner. Null for a private conference,
   *  where the server deliberately fetches nothing and the client's authed
   *  path takes over. */
  initialConference?: Conference | null;
  /** Committee names and topics, same reason. */
  initialCommittees?: Committee[];
  /** The role segment from /conferences/[slug]/role/[role], or null on the
   *  bare /role resolver route (initialView === 'overview' | 'reviews'
   *  never carry a role). Seeds `activeRole`. */
  initialRole?: string | null;
}

export default function ConferenceDetailClient({ initialView, initialRole = null, initialConference = null, initialCommittees = [] }: ConferenceDetailClientProps) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { user, session, profile, loading: authLoading } = useAuth();

  const [conference, setConference] = useState<Conference | null>(initialConference);
  const [committees, setCommittees] = useState<Committee[]>(initialCommittees);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  /* Pricing read through the RLS-bypassing fees view, so an unpublished
     conference still shows its real price to a visitor holding the link. */
  const [viewFee, setViewFee] = useState<ResolvedFee | null>(null);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(!initialConference);
  const [notFound, setNotFound] = useState(false);
  const [myAllocation, setMyAllocation] = useState<ParticipantAllocation | null>(null);
  // Distinct from `loading`: the conference/committees essentials resolve
  // (and clear `loading`) before this signed-in viewer's own applications and
  // allocation are fetched, further down in the same fetchAll pass. Without
  // this its own flag, the participant column and sidebar card would render
  // their real empty states ("No open applications", not-assigned copy) for a
  // beat before the actual data lands and overwrites them — an empty state
  // must be a conclusion, never a placeholder. True whenever auth is still
  // resolving too, since there's nothing to show until we know who's asking.
  const [participantDataLoading, setParticipantDataLoading] = useState(true);
  // Existing-user claim (claim_my_imported_applications): a person who
  // already had an account when an organizer imported them never went
  // through the signup claim flow. Attempted once per conference per page
  // load (the ref survives re-renders and silent refreshes alike, so it
  // never re-fires just because fetchAll runs again), before the
  // applications/allocation fetch below so a newly-attached row shows up in
  // the very first real fetch rather than needing a second reload.
  const claimAttemptedForRef = useRef<string | null>(null);
  const [justClaimedCount, setJustClaimedCount] = useState(0);
  // Which tab is showing is client state, seeded from whichever route mounted
  // this component. /conferences/[slug], /role[/role] and /reviews all remain
  // real routes and valid deep links — they just decide where you land.
  // Switching afterwards never navigates: `showTab` moves this state and
  // rewrites the URL with history.pushState, so the conference, committees,
  // reviews, applications and allocation are fetched once per visit rather
  // than once per tab, and coming back to a tab shows what's already here.
  const [activeTab, setActiveTab] = useState<TabKey>(initialView);
  const [activeRole, setActiveRole] = useState<string | null>(initialRole);
  /** +1 = the incoming pane slides in from the right, -1 from the left. */
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  // The pane animation is for *switching*, not for arriving. Without this the
  // keyframes (which start at opacity 0) would also run on first paint, giving
  // every page load a gratuitous fade — and leaving the column invisible until
  // shown if the page was opened in a background tab, where Chrome freezes
  // animations. Nothing animates until the reader actually changes tab.
  const [hasSwitchedTab, setHasSwitchedTab] = useState(false);
  // Read by popstate and by callbacks that would otherwise close over a stale
  // tab; assigned eagerly in showTab so back-to-back switches read the truth.
  const activeTabRef = useRef<TabKey>(initialView);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const tabHref = useCallback((tab: TabKey, role: string | null) => {
    if (tab === 'reviews') return `/conferences/${slug}/reviews`;
    if (tab === 'participant') {
      return role ? `/conferences/${slug}/role/${encodeURIComponent(role)}` : `/conferences/${slug}/role`;
    }
    return `/conferences/${slug}`;
  }, [slug]);

  /**
   * Switch tab without navigating.
   *
   * `historyMode`: 'push' leaves a history entry so Back returns to the
   * previous tab, 'replace' rewrites in place (URL cleanups, role resolution),
   * 'none' skips the write entirely (used when *responding* to popstate).
   *
   * Native pushState rather than router.push on purpose: Next patches
   * pushState/replaceState so usePathname stays in sync and the internal route
   * tree is copied onto the new entry — which means popstate later restores
   * (ACTION_RESTORE) instead of reloading, and nothing remounts or refetches.
   */
  const showTab = useCallback((
    tab: TabKey,
    role: string | null = null,
    historyMode: 'push' | 'replace' | 'none' = 'push',
  ) => {
    const from = TAB_ORDER.indexOf(activeTabRef.current);
    const to = TAB_ORDER.indexOf(tab);
    if (to !== from) {
      setSlideDir(to > from ? 1 : -1);
      setHasSwitchedTab(true);
    }
    activeTabRef.current = tab;
    setActiveTab(tab);
    setActiveRole(tab === 'participant' ? role : null);
    if (historyMode !== 'none') {
      const href = tabHref(tab, tab === 'participant' ? role : null);
      // A leftover query (?payment=…, legacy ?tab=…) counts as a difference —
      // the rewrite is what strips it.
      if (href !== window.location.pathname || window.location.search) {
        window.history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', href);
      }
    }
  }, [tabHref]);

  // Scroll correction, AFTER the swap has actually laid out — measuring inside
  // showTab reads the outgoing pane and is useless. The panes are wildly
  // different heights (Reviews is short, Overview carries the committee
  // carousel), and when the short one grows Chrome's scroll anchoring keeps the
  // footer put by shoving scrollY down — observed jumping a reader from 874 to
  // 3530, i.e. into the middle of a pane they'd never seen the top of. If the
  // pane has ended up above the viewport, put them back at its top. Instant,
  // not smooth: a second-long glide across 2500px reads as the page running
  // away, and this way there is no motion to reduce. Already-in-view (the
  // normal case, switching from the top) is left alone.
  useEffect(() => {
    if (!hasSwitchedTab) return;
    const el = paneRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0) return;
    window.scrollTo({ top: Math.max(0, window.scrollY + top - 78), behavior: 'auto' });
  }, [activeTab, hasSwitchedTab]);

  // Stable identities: ParticipantView's role-resolution effect depends on
  // these, and a fresh arrow every render would re-run it every render.
  const resolveRole = useCallback((role: string) => showTab('participant', role, 'replace'), [showTab]);
  const selectRole = useCallback((role: string) => showTab('participant', role), [showTab]);

  // Back/Forward. Next's own popstate handler restores its route tree (which
  // is identical across these three entries, so it re-renders nothing); this
  // reads the tab back out of the URL it landed on. Any other path belongs to
  // a genuinely different route — leave it to Next.
  useEffect(() => {
    const base = `/conferences/${slug}`;
    const onPop = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === base) showTab('overview', null, 'none');
      else if (path === `${base}/reviews`) showTab('reviews', null, 'none');
      else if (path === `${base}/role`) showTab('participant', null, 'none');
      else if (path.startsWith(`${base}/role/`)) {
        showTab('participant', decodeURIComponent(path.slice(`${base}/role/`.length)), 'none');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [slug, showTab]);

  // NOTE ON <title>: each of the three URLs is still its own route with its own
  // generateMetadata, and anyone arriving at one directly — a person, a crawler,
  // a link unfurler — gets that route's server-rendered title, canonical and OG
  // tags exactly as before. What no longer happens is the title changing as you
  // move between tabs in a session: the mounted route is the one you entered on,
  // and React keeps that route's <title> in the head. Setting document.title
  // imperatively here does NOT fix it (React re-inserts the mounted route's
  // title above it in tree order, so the browser reads the old one and you're
  // left with two disagreeing title elements) — don't reach for that again.

  // Backward compatibility: the tab/role state used to live in query params
  // on this one URL (?tab=participant, ?tab=reviews, ?role=<x>), so every
  // link already sent in an email or bookmarked still carries them. They can
  // only ever arrive on the plain landing route (the only URL that existed
  // before /role and /reviews did), translate once, on mount — in place now,
  // so an old link costs one render instead of a second page load.
  useEffect(() => {
    if (initialView !== 'overview') return;
    const qs = new URLSearchParams(window.location.search);
    const tab = qs.get('tab');
    const role = qs.get('role');
    if (tab === 'reviews') {
      showTab('reviews', null, 'replace');
      return;
    }
    if (tab === 'participant' || role) {
      showTab('participant', role, 'replace');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Perceived-perf: warm the apply route's JS chunk + loading UI so the "Apply"
  // CTA (which navigates via router.push) feels instant. Prefetch is a no-op in
  // dev and safe/idempotent in prod; does not change any data semantics.
  useEffect(() => {
    if (!slug) return;
    router.prefetch(`/conferences/${slug}/apply`);
  }, [slug, router]);
  // Stripe checkout return (?payment=success|cancelled from create-checkout's
  // success_url/cancel_url, still targets the plain landing URL). Off the
  // participant tab, switch to it in place so the confirmation banner below
  // actually has somewhere to render (this used to be a router.replace to
  // /role, i.e. a second full page load on the way back from Stripe). Either
  // way the query is consumed once and stripped, so a refresh never
  // re-triggers it.
  const [paymentReturn, setPaymentReturn] = useState<'success' | 'cancelled' | null>(null);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const pollStartedRef = useRef(false);
  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment');
    if (payment !== 'success' && payment !== 'cancelled') return;
    if (initialView !== 'participant') showTab('participant', null, 'replace');
    else window.history.replaceState(null, '', window.location.pathname);
    setPaymentReturn(payment);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The webhook is the only authority on payment state — this just polls the
  // application row every 2s (max ~20s) waiting for it to reflect what the
  // webhook already applied, then refreshes the panel. Never marks anything
  // paid client-side.
  useEffect(() => {
    if (paymentReturn !== 'success') return;
    if (authLoading || loading || !user || !session || !conference) return;
    if (pollStartedRef.current) return;
    pollStartedRef.current = true;

    setPaymentConfirming(true);
    const conferenceId = conference.id;
    const userId = user.id;
    const accessToken = session.access_token;
    const snapshot = new Map(myApplications.map(a => [a.id, `${a.payment_status}:${a.amount_paid}`]));
    let attempts = 0;
    let cancelled = false;

    const tick = async () => {
      attempts++;
      const authed = getAuthedClient(accessToken);
      const { data } = await authed
        .from('applications')
        .select('id, payment_status, amount_paid')
        .eq('conference_id', conferenceId)
        .eq('user_id', userId);
      if (cancelled) return;
      const rows = (data ?? []) as { id: string; payment_status: string; amount_paid: number }[];
      const changed = rows.some(r => {
        const prev = snapshot.get(r.id);
        return prev !== undefined && prev !== `${r.payment_status}:${r.amount_paid}`;
      });
      if (changed) {
        setPaymentConfirming(false);
        setPaymentConfirmed(true);
        fetchAll({ silent: true });
        return;
      }
      if (attempts >= 10) {
        setPaymentConfirming(false);
        setPaymentTimedOut(true);
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentReturn, authLoading, loading, user, session, conference]);
  // Committee roster / occupancy (public reads)
  const [committeeSlots, setCommitteeSlots] = useState<Record<string, CommitteeSlot[]>>({});
  // Per committee, country_code -> seats_taken (1 or 2) — a double country
  // can be half-filled, so this needs the count, not just membership.
  const [committeeOccupied, setCommitteeOccupied] = useState<Record<string, Record<string, number>>>({});
  const [expandedRoster, setExpandedRoster] = useState<string | null>(null);
  // The committee roster modal is a modal — freeze the conference page behind it.
  useScrollLock(!!expandedRoster);
  const [pricingOpen, setPricingOpen] = useState(false);
  // Committee carousel + sorting (click: asc -> desc -> reset)
  const carouselRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<'' | 'difficulty' | 'availability' | 'type'>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Anchor the committee slider to the MIDDLE: when the set fits, `justify-content: safe center`
  // (on the track's inline style) centers it; when it overflows, start scrolled to the centre so
  // the user pans out to the sides. Re-centres on a new arrangement (list / sort / tab change) and
  // on resize, but never fights the user once they've scrolled.
  const committeeUserScrolledRef = useRef(false);
  const committeeProgrammaticScrollRef = useRef(false);
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    // New arrangement: allow a fresh re-centre.
    committeeUserScrolledRef.current = false;
    const centre = () => {
      const node = carouselRef.current;
      if (!node) return;
      const overflow = node.scrollWidth - node.clientWidth;
      if (overflow > 1 && !committeeUserScrolledRef.current) {
        committeeProgrammaticScrollRef.current = true;
        node.scrollLeft = overflow / 2;
        requestAnimationFrame(() => { committeeProgrammaticScrollRef.current = false; });
      }
    };
    const onScroll = () => {
      if (committeeProgrammaticScrollRef.current) return;
      committeeUserScrolledRef.current = true; // honour manual scrolling
    };
    const onResize = () => centre();
    // Measure after paint so scrollWidth/clientWidth are final. rAF handles the normal
    // (visible) case; a short timeout is a fallback for when rAF is throttled (e.g. the
    // page mounts in a hidden/background tab).
    const raf = requestAnimationFrame(centre);
    const to = setTimeout(centre, 80);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // `loading` / `authLoading` matter because the whole page early-returns a skeleton
    // while either is true — the carousel (and its ref) only mounts once they clear.
  }, [committees, sortKey, sortDir, activeTab, loading, authLoading]);
  // Role-aware sidebar: organizer detection + one-button apply role picker
  const [organizerRole, setOrganizerRole] = useState<string | null>(null);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  // Reviews
  const [reviews, setReviews] = useState<ConferenceReview[]>([]);
  const [predReviews, setPredReviews] = useState<ConferenceReview[]>([]);
  const [predAcronym, setPredAcronym] = useState<string | null>(null);
  const [reviewPromptDismissed, setReviewPromptDismissed] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  // Partners: mutually-approved conferences and organiser-added companies,
  // flattened into one display shape by the loader below.
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  // Organizer in-place editing (only reachable when isOrganizerViewer)
  const [editModal, setEditModal] = useState<null | 'banner' | 'logo' | 'description' | 'about'>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [assetUploading, setAssetUploading] = useState(false);
  // Logo picked but not yet uploaded, the drag-to-fit crop modal is open.
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [aboutDraft, setAboutDraft] = useState({
    contact_email: '', instagram_url: '', facebook_url: '', tiktok_url: '', whatsapp_url: '', website_url: '',
  });
  // Committee editor, { committee: null } = create flow, set = edit flow
  const [committeeEditor, setCommitteeEditor] = useState<{ committee: EditableCommittee | null } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, authLoading, user?.id]);

  async function fetchAll(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    if (!opts?.silent) setParticipantDataLoading(true);
    const supabase = anonSupabase;

    let { data: confData } = await supabase
      .from('conferences')
      .select(`
        id, slug, full_name, acronym, country, city, format, student_level,
        start_date, end_date, dates_tbd, fee_amount, fee_currency, expected_delegates,
        description, logo_url, banner_url, is_public, status,
        instagram_url, facebook_url, tiktok_url, whatsapp_url, website_url,
        contact_email, organizer_id, min_age, max_age, allocation_swap_mode, display_secretariat,
        connect_onboarding_status, payment_method, external_payment_url, external_payment_note,
        financial_aid_enabled, aid_questions, aid_intro
      `)
      .eq('slug', slug)
      .single();

    if (!confData) {
      // Retry with authed client, may be a private conference the logged-in user owns
      if (session) {
        const authedRetry = getAuthedClient(session.access_token);
        const { data: privateConfData } = await authedRetry
          .from('conferences')
          .select(`
            id, slug, full_name, acronym, country, city, format, student_level,
            start_date, end_date, dates_tbd, fee_amount, fee_currency, expected_delegates,
            description, logo_url, banner_url, is_public, status,
            instagram_url, facebook_url, tiktok_url, whatsapp_url, website_url,
            contact_email, organizer_id, min_age, max_age, allocation_swap_mode, display_secretariat,
            connect_onboarding_status, payment_method, external_payment_url, external_payment_note,
            financial_aid_enabled, aid_questions, aid_intro
          `)
          .eq('slug', slug)
          .single();
        if (!privateConfData) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        // Continue with privateConfData, reassign and fall through
        confData = privateConfData;
      } else {
        setNotFound(true);
        setLoading(false);
        return;
      }
    }

    const conf = confData as Conference;

    setConference(conf);

    const [committeesRes, roleConfigsRes] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, delegation_size, display_chairs, chair_user_ids, logo_url')
        .eq('conference_id', conf.id)
        .order('name', { ascending: true }),
      supabase
        .from('application_role_configs')
        .select('role, is_enabled, applications_open_at, applications_close_at, fee_amount, fee_currency, auto_accept, payment_timing, allow_partial_payments, fee_phases, allow_resubmission')
        .eq('conference_id', conf.id),
    ]);

    setCommittees((committeesRes.data as Committee[]) ?? []);
    setRoleConfigs((roleConfigsRes.data as RoleConfig[]) ?? []);

    /* Only needed when the role-config read was refused — i.e. an unpublished
       conference seen by someone who is not an organiser. Skipping it when the
       configs came through keeps the published path at its current query count. */
    if (!roleConfigsRes.data || roleConfigsRes.data.length === 0) {
      const fees = await fetchDelegateFees(supabase, [conf.id]);
      setViewFee(fees.get(conf.id) ?? null);
    }

    // Paint NOW. The hero, stat strip, committees and apply CTA only need the
    // conference + committees + role configs above. Everything below (partner
    // conferences, reviews, previous edition, live occupancy, and the viewer's
    // own applications) streams in afterward via its own state — no reason to
    // hold a full-page spinner on ~6 more sequential round-trips.
    setLoading(false);

    // Partners, anon reads; RLS only exposes approved links on public
    // conferences, and private partner conferences drop out of the details
    // select. A row is a linked conference (partner_conference_id set) or a
    // free-form company (partner_conference_id null + company_* columns) —
    // never both, per the conference_partners_one_shape check constraint.
    const { data: partnerLinks } = await supabase
      .from('conference_partners')
      .select('id, partner_conference_id, company_name, company_logo_url, company_description, sort_order')
      .eq('conference_id', conf.id)
      .eq('approved', true)
      .order('sort_order', { ascending: true });
    const partnerRows = (partnerLinks ?? []) as PartnerLinkRow[];
    const partnerIds = partnerRows
      .map(r => r.partner_conference_id)
      .filter((id): id is string => id !== null);

    let confById = new Map<string, PartnerConference>();
    if (partnerIds.length > 0) {
      const { data: partnerConfs } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, logo_url, city, country, start_date')
        .in('id', partnerIds);
      confById = new Map(((partnerConfs ?? []) as PartnerConference[]).map(c => [c.id, c]));
    }

    // Sort order is already applied by the query; mapping in place keeps it.
    // A conference partner whose row RLS hid (it went private) has no details
    // to show, so it is dropped rather than rendered as an unnamed disc.
    setPartners(
      partnerRows.flatMap<PartnerEntry>(row => {
        if (row.partner_conference_id === null) {
          return [{
            id: row.id,
            kind: 'company',
            name: (row.company_name ?? '').trim() || 'Partner',
            fullName: null,
            logoUrl: row.company_logo_url,
            description: row.company_description,
            href: null,
            location: null,
          }];
        }
        const c = confById.get(row.partner_conference_id);
        if (!c) return [];
        const labels = conferenceLabels(c);
        return [{
          id: row.id,
          kind: 'conference',
          name: labels.primary,
          fullName: labels.secondary,
          logoUrl: c.logo_url,
          description: null,
          href: `/conferences/${c.slug}`,
          location: [c.city, c.country].filter(Boolean).join(', ') || null,
        }];
      })
    );

    // Reviews, public content, anon client
    const { data: reviewsData } = await supabase
      .from('conference_reviews')
      .select('id, user_id, rating, review_text, display_name, created_at')
      .eq('conference_id', conf.id)
      .order('created_at', { ascending: false });
    setReviews((reviewsData as ConferenceReview[]) ?? []);

    // Previous edition, defensive: the predecessor columns may not exist yet.
    // Separate select so a missing-column error never breaks the page.
    setPredReviews([]);
    setPredAcronym(null);
    try {
      const { data: predRow, error: predError } = await supabase
        .from('conferences')
        .select('predecessor_conference_id, predecessor_approved')
        .eq('id', conf.id)
        .maybeSingle();
      const predId = !predError ? (predRow as { predecessor_conference_id?: string | null; predecessor_approved?: boolean | null } | null)?.predecessor_conference_id : null;
      const predApproved = !predError ? (predRow as { predecessor_approved?: boolean | null } | null)?.predecessor_approved : false;
      if (predId && predApproved) {
        const [predConfRes, predReviewsRes] = await Promise.all([
          supabase.from('conferences').select('acronym').eq('id', predId).maybeSingle(),
          supabase
            .from('conference_reviews')
            .select('id, user_id, rating, review_text, display_name, created_at')
            .eq('conference_id', predId)
            .order('created_at', { ascending: false }),
        ]);
        setPredAcronym((predConfRes.data as { acronym?: string } | null)?.acronym ?? null);
        setPredReviews((predReviewsRes.data as ConferenceReview[]) ?? []);
      }
    } catch {
      // Columns not deployed yet, ignore.
    }

    // Review prompt dismissal persists per conference
    try {
      setReviewPromptDismissed(localStorage.getItem(`review-prompt-${conf.id}`) === 'dismissed');
    } catch {
      setReviewPromptDismissed(false);
    }

    // Public committee extras: full rosters, live occupancy
    const ccIds = ((committeesRes.data as Committee[]) ?? []).map(c => c.id);
    if (ccIds.length > 0) {
      const [slotsRes, occRes] = await Promise.all([
        supabase
          .from('committee_country_slots')
          .select('conference_committee_id, country_code, country_name, delegation_size')
          .in('conference_committee_id', ccIds)
          .order('country_name', { ascending: true }),
        supabase.rpc('get_committee_occupancy', { p_committee_ids: ccIds }),
      ]);
      const slotsMap: Record<string, CommitteeSlot[]> = {};
      for (const row of ((slotsRes.data ?? []) as (CommitteeSlot & { conference_committee_id: string })[])) {
        (slotsMap[row.conference_committee_id] ??= []).push({ country_code: row.country_code, country_name: row.country_name, delegation_size: row.delegation_size });
      }
      const occMap: Record<string, Record<string, number>> = {};
      for (const row of ((occRes.data ?? []) as { conference_committee_id: string; country_code: string; seats_taken: number }[])) {
        (occMap[row.conference_committee_id] ??= {})[row.country_code] = row.seats_taken;
      }
      setCommitteeSlots(slotsMap);
      setCommitteeOccupied(occMap);
    }

    if (user && session) {
      const authedSupabase = getAuthedClient(session.access_token);

      // Existing-user claim: attaches any imported applications/allocations
      // matching this signed-in user's email. Idempotent server-side, but
      // only actually called once per conference per page load here.
      if (claimAttemptedForRef.current !== conf.id) {
        claimAttemptedForRef.current = conf.id;
        const { data: claimData } = await authedSupabase.rpc('claim_my_imported_applications');
        const claimResult = claimData as { ok?: boolean; claimed?: number } | null;
        if (claimResult?.ok && (claimResult.claimed ?? 0) > 0) {
          setJustClaimedCount(claimResult.claimed ?? 0);
        }
      }

      // Organizer/secretariat detection, RLS only exposes rows to organizers themselves,
      // so this returns the viewer's own row or nothing.
      const { data: orgRow } = await authedSupabase
        .from('conference_organizers')
        .select('role')
        .eq('conference_id', conf.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setOrganizerRole(
        (orgRow as { role: string } | null)?.role ?? (user.id === conf.organizer_id ? 'owner' : null)
      );

      const { data: appsData } = await authedSupabase
        .from('applications')
        .select('id, role, status, payment_status, society_id, self_paid, pledge_type, spots_pledged, pledge_confirmed_at, organizer_note')
        .eq('conference_id', conf.id)
        .eq('user_id', user.id);

      // amount_paid is added by the finance ledger work and may not exist yet —
      // a separate defensive select so a missing column never breaks the page.
      const amountPaidMap = new Map<string, number>();
      const { data: amountData, error: amountErr } = await authedSupabase
        .from('applications')
        .select('id, amount_paid')
        .eq('conference_id', conf.id)
        .eq('user_id', user.id);
      if (!amountErr) {
        for (const row of (amountData ?? []) as { id: string; amount_paid: number | null }[]) {
          amountPaidMap.set(row.id, row.amount_paid ?? 0);
        }
      }
      setMyApplications(
        ((appsData ?? []) as Omit<MyApplication, 'amount_paid'>[]).map(a => ({ ...a, amount_paid: amountPaidMap.get(a.id) ?? 0 }))
      );

      const committeeIds = (committeesRes.data as Committee[] ?? []).map(c => c.id);
      if (committeeIds.length > 0) {
        const { data: allocData } = await authedSupabase
          .from('conference_allocations')
          .select('id, country_code, country_name, conference_committee_id, conference_committees (name, position_paper_deadline, session_code, released_to_delegates_at)')
          .eq('user_id', user.id)
          .in('conference_committee_id', committeeIds)
          .maybeSingle();
        setMyAllocation((allocData as unknown as ParticipantAllocation) ?? null);
      }
    } else {
      setOrganizerRole(null);
      setMyApplications([]);
      setMyAllocation(null);
    }
    // loading was already cleared right after the essentials loaded above;
    // participantDataLoading only clears once applications/allocation are
    // actually known (either branch above), so the sidebar and participant
    // column never render an empty state before it's true.
    setParticipantDataLoading(false);
  }

  async function refreshReviews(conferenceId: string) {
    const { data } = await anonSupabase
      .from('conference_reviews')
      .select('id, user_id, rating, review_text, display_name, created_at')
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: false });
    setReviews((data as ConferenceReview[]) ?? []);
  }

  async function handleSubmitReview() {
    if (!user || !session || !conference || reviewRating < 1 || reviewSubmitting) return;
    setReviewSubmitting(true);
    setReviewError('');
    const authed = getAuthedClient(session.access_token);
    const { error } = await authed.from('conference_reviews').insert({
      conference_id: conference.id,
      user_id: user.id,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
      display_name: profile?.display_name ?? null,
    });
    if (error) {
      setReviewError('Your review could not be saved. Only attendees can leave a review.');
      setReviewSubmitting(false);
      return;
    }
    await refreshReviews(conference.id);
    setReviewRating(0);
    setReviewText('');
    setReviewSubmitting(false);
  }

  function dismissReviewPrompt() {
    setReviewPromptDismissed(true);
    if (conference) {
      try { localStorage.setItem(`review-prompt-${conference.id}`, 'dismissed'); } catch { /* ignore */ }
    }
  }

  // Study guides / position paper submission now live entirely in the
  // participant/ tree (StudyGuideCard, PositionPaperCard), driven only by
  // myAllocation above.

  // ── Organizer in-place editing ────────────────────────────────────────────
  // Every save: authed conferences.update(...) then a silent fetchAll() so the
  // page re-renders with fresh data without flashing the loading spinner.

  function openEdit(modal: 'banner' | 'logo' | 'description' | 'about') {
    if (!conference) return;
    setEditError('');
    if (modal === 'description') setDescDraft(conference.description ?? '');
    if (modal === 'about') {
      setAboutDraft({
        contact_email: conference.contact_email ?? '',
        instagram_url: conference.instagram_url ?? '',
        facebook_url: conference.facebook_url ?? '',
        tiktok_url: conference.tiktok_url ?? '',
        whatsapp_url: conference.whatsapp_url ?? '',
        website_url: conference.website_url ?? '',
      });
    }
    setEditModal(modal);
  }

  async function saveConferenceFields(fields: Record<string, string | null>): Promise<boolean> {
    if (!session || !conference) return false;
    setEditSaving(true);
    setEditError('');
    const authed = getAuthedClient(session.access_token);
    const { error } = await authed.from('conferences').update(fields).eq('id', conference.id);
    if (error) {
      setEditError('Could not save: ' + error.message);
      setEditSaving(false);
      return false;
    }
    await fetchAll({ silent: true });
    setEditSaving(false);
    return true;
  }

  async function handleSaveDescription() {
    const ok = await saveConferenceFields({ description: descDraft.trim() || null });
    if (ok) setEditModal(null);
  }

  async function handleSaveAbout() {
    const ok = await saveConferenceFields({
      contact_email: aboutDraft.contact_email.trim() || null,
      instagram_url: aboutDraft.instagram_url.trim() || null,
      facebook_url: aboutDraft.facebook_url.trim() || null,
      tiktok_url: aboutDraft.tiktok_url.trim() || null,
      whatsapp_url: aboutDraft.whatsapp_url.trim() || null,
      website_url: aboutDraft.website_url.trim() || null,
    });
    if (ok) setEditModal(null);
  }

  async function handleAssetSelect(folder: 'banners' | 'logos', file: File) {
    if (!session || !conference || assetUploading) return;
    setEditError('');
    setAssetUploading(true);
    const authed = getAuthedClient(session.access_token);
    const res = await uploadConferenceAsset(authed, folder, conference.id, file);
    if (res.error !== undefined) {
      setEditError(res.error);
      setAssetUploading(false);
      return;
    }
    const ok = await saveConferenceFields(folder === 'banners' ? { banner_url: res.url } : { logo_url: res.url });
    setAssetUploading(false);
    if (ok) setEditModal(null);
  }

  async function handleBannerPreset(path: string) {
    if (assetUploading || editSaving) return;
    const ok = await saveConferenceFields({ banner_url: path });
    if (ok) setEditModal(null);
  }

  // Committee pencil, the public select lacks session_id, so fetch the full
  // editable row with the authed client before opening the shared editor.
  async function openCommitteeEditor(committeeId: string) {
    if (!session) return;
    const authed = getAuthedClient(session.access_token);
    const { data } = await authed
      .from('conference_committees')
      .select('id, name, abbreviation, topics, difficulty, committee_type, session_id, logo_url')
      .eq('id', committeeId)
      .single();
    if (data) setCommitteeEditor({ committee: data as EditableCommittee });
  }

  // Loading.
  //
  // `authLoading` is true during the server render and on first client paint,
  // so gating on it alone meant this component ALWAYS returned a spinner to a
  // crawler — the whole page was invisible to search. With a server-seeded
  // conference there is something real to draw immediately, and the viewer's
  // own applications/allocation arrive under `participantDataLoading` without
  // holding the page back.
  if ((authLoading && !conference) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <Loader size={72} label="Loading conference" />
      </div>
    );
  }

  // 404
  if (notFound || !conference) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <SiteNav />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-xs font-mono tracking-widest mb-4" style={{ color: '#9A8A78' }}>404</p>
          <h1 className="font-black text-2xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Not Found</h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>This conference may be private or doesn&apos;t exist.</p>
          <Link
            href="/conferences/explore"
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
          >
            EXPLORE CONFERENCES →
          </Link>
        </div>
      </div>
    );
  }

  // Derived
  const isOrganizer = user?.id === conference.organizer_id;
  const countryObj = getCountryByName(conference.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const enabledRoles = roleConfigs.filter(r => r.is_enabled);
  const now = new Date();
  // Single source of truth for public fee displays (hero circle, cards): the
  // delegate role config's fee, falling back to the conference-level fee
  // only when no delegate role config exists yet.
  const delegateRoleConfig = roleConfigs.find(r => r.role === 'delegate') ?? null;
  // Phase-aware: a conference whose delegate fee is split into fee_phases has a
  // flat fee_amount of 0, which would otherwise advertise it as FREE. Resolve
  // through activePhaseFee so the hero shows today's actual price.
  //
  // Three sources, in order. `viewFee` exists because the role-config query
  // above is RLS-gated on `is_public`, so on an UNPUBLISHED conference it comes
  // back empty for anonymous visitors — while this page itself still renders,
  // since `conferences` is readable by anyone with the link. Without the view
  // the hero silently fell back to the stale conference column and advertised
  // the wrong price on every private conference. The role config is still
  // preferred when readable: it is the same data and saves a render pass.
  const resolvedRoleFee = delegateRoleConfig
    ? activePhaseFee({ fee_amount: delegateRoleConfig.fee_amount, fee_phases: delegateRoleConfig.fee_phases }, now)
    : null;
  const heroFeeAmount = resolvedRoleFee
    ? resolvedRoleFee.amount
    : viewFee
      ? viewFee.amount
      : conference.fee_amount;
  const heroFeeCurrency = delegateRoleConfig
    ? (delegateRoleConfig.fee_currency ?? conference.fee_currency)
    : viewFee
      ? viewFee.currency
      : conference.fee_currency;

  function getRoleWindowStatus(r: RoleConfig): 'open' | 'closed' | 'opens-soon' | 'open-always' {
    if (!r.applications_open_at && !r.applications_close_at) return 'open-always';
    const openAt = r.applications_open_at ? new Date(r.applications_open_at) : null;
    const closeAt = r.applications_close_at ? new Date(r.applications_close_at) : null;
    if (closeAt && now > closeAt) return 'closed';
    if (openAt && now < openAt) return 'opens-soon';
    return 'open';
  }

  function isRoleOpen(r: RoleConfig): boolean {
    const s = getRoleWindowStatus(r);
    return s === 'open' || s === 'open-always';
  }

  const openRoles = enabledRoles.filter(isRoleOpen);
  const hasOpenRoles = openRoles.length > 0;

  const isOnline = conference.format === 'online';

  // Role-aware sidebar state
  const isOrganizerViewer = !!organizerRole || isOrganizer;
  const myApp = myApplications[0] ?? null;
  const attended = myApplications.some(a => a.status === 'assigned' || a.status === 'checked-in') || !!myAllocation;
  const myReview = user ? reviews.find(r => r.user_id === user.id) : undefined;
  const canReview = !!user && attended && !myReview;
  const showReviewPrompt = canReview && !reviewPromptDismissed;

  // Reviews aggregates, current edition + approved predecessor edition
  const allReviews = [...reviews, ...predReviews];
  const reviewCount = allReviews.length;
  const avgRating = reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

  /* Show the TIME, not just the day.
     An open moment is a timestamp, and rendering only "28 Aug" for a window
     that opens at 18:00 that same day reads as broken to anyone looking on the
     28th: the date has arrived, the button has not. That is not a gate bug —
     it is this label omitting the half of the value that matters.
     `new Date(iso)` puts it in the viewer's own timezone, which is what an
     applicant needs; a Turkish organiser opening at 21:00 local should not
     have a Spanish applicant reading a UTC time. */
  const fmtWindowDate = (iso: string) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(iso);
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
    if (days === 0) return `today ${time}`;
    if (days === 1) return `tomorrow ${time}`;
    return `${d.getDate()} ${months[d.getMonth()]}, ${time}`;
  };

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8', overflowX: 'clip' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Overlay nav: floats over the hero so the banner reaches the very top */}
        <SiteNav overlay />

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden flex-shrink-0"
          style={{ height: 'clamp(392px, 44vw, 512px)' }}
        >
          {conference.banner_url ? (
            <>
              <img
                src={conference.banner_url}
                alt={conference.full_name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Layered scrim, deep at the base, airy on top */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(16,28,21,0.88) 0%, rgba(20,36,27,0.45) 42%, rgba(20,36,27,0.18) 75%, rgba(20,36,27,0.3) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(100deg, rgba(16,28,21,0.55) 0%, transparent 55%)',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #16301F 0%, #1B3828 55%, #234A31 100%)' }} />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: GRAIN,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '300px 300px',
                  mixBlendMode: 'overlay',
                  opacity: 0.08,
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute', right: '4%', bottom: '-24px',
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(120px, 18vw, 240px)', lineHeight: 1,
                  color: 'rgba(238,217,138,0.07)', userSelect: 'none', pointerEvents: 'none',
                }}
              >
                {conference.acronym.slice(0, 5)}
              </span>
            </>
          )}

          {/* Top-right pills */}
          <div className="absolute right-6 md:right-14 flex gap-2 z-10" style={{ top: '84px' }}>
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '0.12em',
                color: 'white',
                backgroundColor: 'rgba(16,28,21,0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '5px 14px',
                borderRadius: '9999px',
              }}
            >
              {conference.format.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          {/* Bottom-left content */}
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-14 z-10" style={{ paddingBottom: '68px' }}>
            <div className="flex items-end gap-5">
              {conference.logo_url ? (
                <div className="hidden sm:block relative flex-shrink-0" style={{ width: '150px', height: '150px' }}>
                  <LogoDisc
                    src={conference.logo_url}
                    alt={conference.acronym}
                    size={150}
                    fallbackText={conference.acronym.slice(0, 3)}
                    style={{ boxShadow: '0 14px 28px rgba(0,0,0,0.45)' }}
                  />
                  {isOrganizerViewer && (
                    <OrganizerPencil
                      variant="cover"
                      ariaLabel="Edit logo"
                      onClick={() => openEdit('logo')}
                      style={{ zIndex: 30, borderRadius: '9999px' }}
                    />
                  )}
                </div>
              ) : isOrganizerViewer ? (
                <button
                  type="button"
                  onClick={() => openEdit('logo')}
                  className="hidden sm:flex relative flex-col items-center justify-center gap-2 flex-shrink-0 focus:outline-none"
                  style={{
                    width: '150px', height: '150px', borderRadius: '20px',
                    border: '1.5px dashed rgba(255,255,255,0.55)',
                    backgroundColor: 'rgba(16,28,21,0.28)',
                    color: '#FFFFFF', cursor: 'pointer', zIndex: 30,
                    transition: `background-color 250ms ${EASE}, border-color 250ms ${EASE}`,
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(16,28,21,0.5)'; el.style.borderColor = 'rgba(255,255,255,0.85)'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(16,28,21,0.28)'; el.style.borderColor = 'rgba(255,255,255,0.55)'; }}
                >
                  <Plus size={20} strokeWidth={2.2} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.16em' }}>
                    ADD LOGO
                  </span>
                </button>
              ) : null}
              <div className="min-w-0">
                <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11px', color: '#EED98A', letterSpacing: '0.14em', marginBottom: '6px' }}>
                  {conferenceAcronymLabel(conference)}
                </p>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, color: 'white', fontSize: 'clamp(26px, 4vw, 54px)', lineHeight: 1.05, marginBottom: '10px', textShadow: '0 2px 24px rgba(0,0,0,0.3)' }}>
                  {conferenceFullNameLabel(conference)}
                </h1>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-2">
                    {!isOnline && flagUrl && (
                      <img
                        src={flagUrl}
                        alt={conference.country}
                        style={{ width: '20px', height: '14px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                      />
                    )}
                    <span style={{ fontSize: '14px', color: 'rgba(237,231,216,0.92)', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
                      {/* City in full, country as its ISO code, the flag already
                          names the country, so the full name would repeat it. */}
                      {isOnline ? 'Online' : `${conference.city}, ${(countryObj?.code ?? conference.country).toUpperCase()}`}
                    </span>
                  </span>
                  {/* Dates are hidden when TBD or missing. The organizer alone
                      still sees a subtle "Dates: TBD" chip so the state is clear. */}
                  {!conference.dates_tbd && conference.start_date ? (
                    <>
                      <span aria-hidden style={{ color: 'rgba(238,217,138,0.5)', fontSize: '10px' }}>◆</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em', fontSize: '12px', color: 'rgba(237,231,216,0.78)' }}>
                        {formatDateRange(conference.start_date, conference.end_date)}
                      </span>
                    </>
                  ) : isOrganizerViewer ? (
                    <>
                      <span aria-hidden style={{ color: 'rgba(238,217,138,0.5)', fontSize: '10px' }}>◆</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', color: '#EED98A', backgroundColor: 'rgba(238,217,138,0.14)', border: '1px solid rgba(238,217,138,0.32)', padding: '2px 9px', borderRadius: '9999px' }}>
                        Dates: TBD
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Organizer: hover grey-out + pencil over the banner. Sits below the
              z-10 hero content so the title, pills and logo stay crisp and the
              logo keeps its own cover pencil. */}
          {isOrganizerViewer && (
            <OrganizerPencil
              variant="cover"
              label="EDIT BANNER"
              ariaLabel="Edit banner"
              onClick={() => openEdit('banner')}
              style={{ zIndex: 5 }}
            />
          )}
        </div>

        {/* ── Neu stat strip, three soft tiles overlapping the hero ──── */}
        <div className="relative z-20 px-6 md:px-14" style={{ marginTop: '-44px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {/* Dates + location live in the hero overlay (flag, city, date
                  range), only facts NOT already shown above appear here.
                  Each fact is its own extruded neu tile. On phones the tiles
                  shrink to compact icon+value bubbles (label hidden, stacked)
                  so the three markers fit one tight row instead of three tall
                  stacked cards; on ≥sm they open into the full label/value row. */}
              {[
                { icon: Monitor, gradient: NEU_GRADIENTS.forest, label: 'Format', value: capitalize(conference.format.replace('-', ' ')) },
                { icon: GraduationCap, gradient: NEU_GRADIENTS.amber, label: 'Level', value: conference.student_level === 'school' ? 'High School' : capitalize(conference.student_level) },
                { icon: Users, gradient: NEU_GRADIENTS.green, label: 'Delegates', value: conference.expected_delegates.toLocaleString() },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3.5 text-center sm:text-left px-1.5 py-2.5 sm:px-4 sm:py-3.5"
                  style={{
                    backgroundColor: NEU.surface,
                    borderRadius: 18,
                    boxShadow: NEU.outSm,
                    minWidth: 0,
                  }}
                >
                  <span className="sm:hidden">
                    <NeuIconDisc gradient={cell.gradient} icon={cell.icon} size={30} />
                  </span>
                  <span className="hidden sm:block">
                    <NeuIconDisc gradient={cell.gradient} icon={cell.icon} size={46} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="hidden sm:block"
                      style={{
                        fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9.5px',
                        letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.muted, margin: '0 0 3px 0',
                      }}
                    >
                      {cell.label}
                    </p>
                    <p
                      className="text-[12px] sm:text-[16px] font-extrabold leading-tight"
                      style={{ color: NEU.ink, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums', margin: 0 }}
                    >
                      {cell.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', isolation: 'isolate' }} className="relative px-6 md:px-14 pt-10 pb-14 flex-1">
          {/* Decorative bleed — faded MUN glyphs tucked behind the main content
              column (zIndex -1; the page root already clips overflow-x). */}
          <DecorativeBleed
            zIndex={-1}
            items={[
              { Icon: Gavel, size: 160, top: '10px', right: '-30px', opacity: 0.045, rotate: -10 },
              { Icon: ScrollText, size: 130, bottom: '80px', left: '-34px', opacity: 0.04 },
            ]}
          />
          <div className="relative flex flex-col md:flex-row gap-8" style={{ zIndex: 1 }}>

            {/* Left column */}
            <div className="flex-1 min-w-0">

              {/* Review prompt, attendees who haven't reviewed yet */}
              {showReviewPrompt && (
                <div
                  className="relative flex items-center gap-4 rounded-[18px] px-5 py-4 mb-5"
                  style={{
                    backgroundColor: 'rgba(250,248,243,0.88)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    border: '1px solid rgba(182,135,31,0.35)',
                    boxShadow: '0 8px 24px rgba(27,56,40,0.08)',
                  }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: 'rgba(182,135,31,0.12)' }}
                  >
                    <Star size={17} strokeWidth={2} style={{ color: '#B6871F', fill: '#B6871F' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      How was {conference.acronym}?
                    </p>
                    <p className="text-[12px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: '1px 0 0 0' }}>
                      Leave a review to help future delegates.
                    </p>
                  </div>
                  <button
                    onClick={() => showTab('reviews')}
                    className="flex-shrink-0 rounded-xl py-2 px-4 text-[11px] font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    LEAVE A REVIEW
                  </button>
                  <button
                    onClick={dismissReviewPrompt}
                    aria-label="Dismiss review prompt"
                    className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-colors"
                    style={{ width: '26px', height: '26px', border: 'none', backgroundColor: 'transparent', color: '#9A8A78', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Floating glass tab pill */}
              <div className="sticky z-30 mb-7" style={{ top: '12px' }}>
                <div
                  className="inline-flex items-center gap-1 p-1"
                  style={{
                    backgroundColor: 'rgba(250,248,243,0.72)',
                    backdropFilter: 'blur(18px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
                    border: '1px solid rgba(221,212,192,0.85)',
                    borderRadius: '9999px',
                    boxShadow: '0 8px 28px rgba(27,56,40,0.1)',
                  }}
                >
                  {/* Real anchors, so the tab a visitor is on is still copyable,
                      middle-clickable and openable in a new tab — but a plain
                      left click is handled in place by showTab and never
                      navigates. Modified clicks fall through to the browser. */}
                  {([
                    { key: 'overview' as const, label: 'Overview', icon: Landmark },
                    { key: 'participant' as const, label: 'You', icon: UserRound },
                    { key: 'reviews' as const, label: 'Reviews', icon: Star },
                  ]).map(({ key, label, icon: TabIcon }) => (
                    <a
                      key={key}
                      href={tabHref(key, key === 'participant' ? activeRole : null)}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        showTab(key, key === 'participant' ? activeRole : null);
                      }}
                      aria-label={label}
                      aria-current={activeTab === key ? 'page' : undefined}
                      title={label}
                      className="relative flex items-center justify-center rounded-full focus:outline-none"
                      style={
                        activeTab === key
                          ? { width: '72px', height: '46px', backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 10px rgba(27,56,40,0.32)', textDecoration: 'none', transition: `width 260ms ${EASE}, background-color 260ms ${EASE}, color 260ms ${EASE}, box-shadow 260ms ${EASE}` }
                          : { width: '72px', height: '46px', backgroundColor: 'transparent', color: '#8A7D6C', textDecoration: 'none', transition: `width 260ms ${EASE}, background-color 260ms ${EASE}, color 260ms ${EASE}, box-shadow 260ms ${EASE}` }
                      }
                    >
                      <TabIcon size={21} strokeWidth={1.9} />
                    </a>
                  ))}
                </div>
              </div>

              {/* Tab panes. Only the active one is mounted (as before), but the
                  swap is now a state change rather than a navigation, so the
                  incoming pane is animated in from the direction of travel.
                  overflow-x: clip (not hidden — it must not become a scroll
                  container, sticky children depend on that) keeps the 26px
                  slide from widening the page on a narrow screen. */}
              <div ref={paneRef} style={{ overflowX: 'clip' }}>
              <div
                key={activeTab}
                className={hasSwitchedTab ? 'conf-tab-pane' : undefined}
                style={{ '--conf-slide-from': slideDir > 0 ? '26px' : '-26px' } as React.CSSProperties}
              >

              {/* About */}
              {activeTab === 'overview' && (conference.description || isOrganizerViewer) && (
                <SectionCard className="mb-6 relative">
                  {isOrganizerViewer && conference.description && (
                    <OrganizerPencil
                      variant="corner"
                      ariaLabel="Edit description"
                      onClick={() => openEdit('description')}
                      style={{ position: 'absolute', top: 12, right: 12 }}
                    />
                  )}
                  {conference.description ? (
                    <p className="text-[15px]" style={{ color: '#3B342C', fontFamily: "'Outfit', sans-serif", whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                      {conference.description}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEdit('description')}
                      className="w-full rounded-2xl py-6 text-[13.5px] font-semibold focus:outline-none transition-colors"
                      style={{
                        border: '1.5px dashed rgba(154,138,120,0.6)',
                        backgroundColor: 'rgba(237,231,216,0.25)',
                        color: '#9A8A78',
                        fontFamily: "'Outfit', sans-serif",
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#1B3828'; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(154,138,120,0.6)'; el.style.color = '#9A8A78'; el.style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
                    >
                      Add a description, tell delegates what your conference is about
                    </button>
                  )}
                </SectionCard>
              )}


              {/* Organiser */}
              {activeTab === 'overview' && (
                <SectionCard className="mb-6 relative">
                  {isOrganizerViewer && (
                    <OrganizerPencil
                      variant="corner"
                      ariaLabel="Edit contact and social links"
                      onClick={() => openEdit('about')}
                      style={{ position: 'absolute', top: 12, right: 12 }}
                    />
                  )}
                  <p className="mb-3" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
                    ORGANISED BY
                  </p>
                  <div
                    className="flex items-center gap-4"
                    style={{ backgroundColor: NEU.base, borderRadius: 16, boxShadow: NEU.inSm, padding: '14px 16px' }}
                  >
                    {conference.logo_url && (
                      <LogoDisc
                        src={conference.logo_url}
                        alt={conference.acronym}
                        size={80}
                        fallbackText={conference.acronym.slice(0, 3)}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{conference.full_name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 500, margin: 0 }}>{conference.acronym}</p>
                      {conference.contact_email && (
                        <a
                          href={`mailto:${conference.contact_email}`}
                          className="flex items-center gap-1.5 text-xs mt-1 transition-colors"
                          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <Mail size={12} />
                          {conference.contact_email}
                        </a>
                      )}
                    </div>
                  </div>
                  {(conference.instagram_url || conference.facebook_url || conference.tiktok_url || conference.whatsapp_url || conference.website_url) && (
                    <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                      {conference.instagram_url && (
                        <a
                          href={normalizeSocialUrl(conference.instagram_url, 'instagram') ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: '38px', height: '38px', color: '#9A8A78', backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, transform 200ms ${EASE}` }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.boxShadow = NEU.outSmHover; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.boxShadow = NEU.outSm; el.style.transform = 'translateY(0)'; }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                          </svg>
                        </a>
                      )}
                      {conference.facebook_url && (
                        <a
                          href={normalizeSocialUrl(conference.facebook_url, 'facebook') ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: '38px', height: '38px', color: '#9A8A78', backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, transform 200ms ${EASE}` }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.boxShadow = NEU.outSmHover; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.boxShadow = NEU.outSm; el.style.transform = 'translateY(0)'; }}
                        >
                          <Globe size={15} />
                        </a>
                      )}
                      {conference.tiktok_url && (
                        <a
                          href={normalizeSocialUrl(conference.tiktok_url, 'tiktok') ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: '38px', height: '38px', color: '#9A8A78', backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, transform 200ms ${EASE}` }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.boxShadow = NEU.outSmHover; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.boxShadow = NEU.outSm; el.style.transform = 'translateY(0)'; }}
                        >
                          <Music size={15} />
                        </a>
                      )}
                      {conference.whatsapp_url && (
                        <a
                          href={normalizeSocialUrl(conference.whatsapp_url, 'whatsapp') ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: '38px', height: '38px', color: '#9A8A78', backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, transform 200ms ${EASE}` }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.boxShadow = NEU.outSmHover; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.boxShadow = NEU.outSm; el.style.transform = 'translateY(0)'; }}
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      {conference.website_url && (
                        <a
                          href={normalizeSocialUrl(conference.website_url) ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: '38px', height: '38px', color: '#9A8A78', backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, transform 200ms ${EASE}` }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.boxShadow = NEU.outSmHover; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.boxShadow = NEU.outSm; el.style.transform = 'translateY(0)'; }}
                        >
                          <Globe size={15} />
                        </a>
                      )}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* The Secretariat, trigger-maintained public roster */}
              {activeTab === 'overview' && (conference.display_secretariat?.length ?? 0) > 0 && (
                <SectionCard className="mb-6">
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 18px 0' }}>
                    THE SECRETARIAT
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-7 gap-y-6">
                    {(conference.display_secretariat ?? []).map((m, i) => (
                      <div key={`${m.name}-${i}`} className="flex flex-col items-center text-center" style={{ width: '108px' }}>
                        {m.avatar_url ? (
                          <img
                            src={m.avatar_url}
                            alt={m.name}
                            style={{
                              width: '72px', height: '72px', borderRadius: '9999px', objectFit: 'cover',
                              boxShadow: '0 6px 16px rgba(27,56,40,0.22)',
                              backgroundColor: '#EDE7D8',
                              outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: '-1px',
                            }}
                          />
                        ) : (
                          <span
                            className="flex items-center justify-center"
                            style={{
                              width: '72px', height: '72px', borderRadius: '9999px',
                              backgroundColor: '#1B3828', color: '#EED98A',
                              fontSize: '22px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 6px 16px rgba(27,56,40,0.22)',
                            }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[13.5px] font-semibold mt-2.5 leading-tight" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                          {m.name}
                        </span>
                        {m.title && (
                          <span className="mt-1" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.1em', color: '#B6871F', textTransform: 'uppercase' }}>
                            {m.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Person tab, participant view */}
              {activeTab === 'participant' && (
                <>
                  {paymentReturn === 'success' && (
                    <SectionCard className="!py-4 !px-5 mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 38, height: 38, borderRadius: '9999px',
                            backgroundColor: paymentConfirmed ? 'rgba(61,122,82,0.13)' : 'rgba(184,132,74,0.14)',
                          }}
                        >
                          {paymentConfirmed ? (
                            <PartyPopper size={17} style={{ color: '#2A5A3C' }} />
                          ) : paymentTimedOut ? (
                            <Clock size={17} style={{ color: '#B8844A' }} />
                          ) : (
                            <Loader2 size={17} className={paymentConfirming ? 'animate-spin' : ''} style={{ color: '#B8844A' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                            {paymentConfirmed ? 'Payment received!' : paymentTimedOut ? 'Your payment is processing' : 'Payment received — confirming...'}
                          </p>
                          <p className="text-[12.5px] mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                            {paymentConfirmed
                              ? 'Your registration is up to date.'
                              : paymentTimedOut
                                ? 'This page will reflect it shortly — no need to try again.'
                                : 'Stripe confirmed your checkout, waiting for it to land here.'}
                          </p>
                        </div>
                        <button
                          onClick={() => setPaymentReturn(null)}
                          className="flex-shrink-0 focus:outline-none"
                          style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          aria-label="Dismiss"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </SectionCard>
                  )}
                  {paymentReturn === 'cancelled' && (
                    <SectionCard className="!py-3 !px-5 mb-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px]" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif" }}>
                          Payment cancelled — you can try again anytime.
                        </p>
                        <button
                          onClick={() => setPaymentReturn(null)}
                          className="flex-shrink-0 focus:outline-none"
                          style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          aria-label="Dismiss"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </SectionCard>
                  )}
                <ParticipantView
                  conferenceId={conference.id}
                  conferenceSlug={conference.slug}
                  conferenceStartDate={conference.start_date}
                  isOrganizer={isOrganizerViewer}
                  myApplications={myApplications}
                  roleConfigs={roleConfigs}
                  myAllocation={myAllocation}
                  committees={committees}
                  allocationSwapMode={conference.allocation_swap_mode}
                  financialAidEnabled={conference.financial_aid_enabled}
                  aidBlocks={normalizeBlocks(conference.aid_questions)}
                  aidIntro={conference.aid_intro}
                  initialRole={activeRole}
                  // Role selection is a URL change inside the same tab. It used
                  // to be router.replace/router.push, i.e. a reload for what is
                  // really just picking one of the applications already in
                  // memory here; both now stay on the page.
                  onResolveRole={resolveRole}
                  onSelectRole={selectRole}
                  participantDataLoading={authLoading || participantDataLoading}
                  justClaimedCount={justClaimedCount}
                />
                </>
              )}

              {/* Reviews tab */}
              {activeTab === 'reviews' && (
                <div className="flex flex-col gap-6">
                  <SectionCard>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 14px 0' }}>
                      DELEGATE REVIEWS
                    </p>
                    {reviewCount === 0 ? (
                      <div className="flex flex-col items-center text-center py-8">
                        <div
                          className="flex items-center justify-center mb-4"
                          style={{ width: '56px', height: '56px', borderRadius: '9999px', backgroundColor: 'rgba(182,135,31,0.1)', border: '1px solid rgba(182,135,31,0.25)' }}
                        >
                          <Star size={22} strokeWidth={1.8} style={{ color: '#B6871F' }} />
                        </div>
                        <p className="text-[14px] font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                          No reviews yet
                        </p>
                        <p className="text-[13px] max-w-[360px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
                          Reviews appear once delegates attend an edition of this conference.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-5">
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: '44px', color: '#1C1410', lineHeight: 1 }}>
                          {avgRating.toFixed(1)}
                        </span>
                        <div className="flex flex-col gap-1">
                          <StarRow rating={Math.round(avgRating)} size={16} />
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '10.5px', letterSpacing: '0.1em', color: '#9A8A78' }}>
                            {reviewCount} {reviewCount === 1 ? 'REVIEW' : 'REVIEWS'}
                          </span>
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  {/* Write a review, attendees only */}
                  {canReview && (
                    <SectionCard>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
                        YOUR REVIEW
                      </p>
                      <div className="flex items-center gap-1.5 mb-4" onMouseLeave={() => setReviewHover(0)}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <button
                            key={i}
                            onClick={() => setReviewRating(i)}
                            onMouseEnter={() => setReviewHover(i)}
                            aria-label={`Rate ${i} out of 5`}
                            className="focus:outline-none"
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer' }}
                          >
                            <Star
                              size={26}
                              strokeWidth={1.6}
                              style={{
                                color: i <= (reviewHover || reviewRating) ? '#B6871F' : 'rgba(154,138,120,0.45)',
                                fill: i <= (reviewHover || reviewRating) ? '#B6871F' : 'none',
                                transition: 'color 120ms ease',
                              }}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        rows={4}
                        placeholder="What should future delegates know about this conference?"
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                        style={{ border: '1px solid #DDD4C0', backgroundColor: 'rgba(237,231,216,0.25)', color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                      />
                      {reviewError && (
                        <p className="text-[12px] mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '8px 0 0 0' }}>
                          {reviewError}
                        </p>
                      )}
                      <button
                        onClick={handleSubmitReview}
                        disabled={reviewRating < 1 || reviewSubmitting}
                        className="mt-4 rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
                        style={{
                          backgroundColor: reviewRating < 1 || reviewSubmitting ? '#DDD4C0' : '#1B3828',
                          color: reviewRating < 1 || reviewSubmitting ? '#9A8A78' : '#EED98A',
                          fontFamily: "'Outfit', sans-serif",
                          letterSpacing: '0.06em',
                          border: 'none',
                          cursor: reviewRating < 1 || reviewSubmitting ? 'default' : 'pointer',
                        }}
                      >
                        {reviewSubmitting ? 'SAVING...' : 'SUBMIT REVIEW'}
                      </button>
                    </SectionCard>
                  )}

                  {/* Current edition reviews */}
                  {reviews.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                    </div>
                  )}

                  {/* Previous edition reviews */}
                  {predReviews.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex-1" style={{ height: '1px', backgroundColor: 'rgba(221,212,192,0.9)' }} />
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                          FROM PREVIOUS EDITION{predAcronym ? ` · ${predAcronym.toUpperCase()}` : ''}
                        </span>
                        <span className="flex-1" style={{ height: '1px', backgroundColor: 'rgba(221,212,192,0.9)' }} />
                      </div>
                      {predReviews.map(r => <ReviewCard key={r.id} review={r} />)}
                    </div>
                  )}
                </div>
              )}

              </div>
              </div>

            </div>

            {/* Right column, sticky rail — on mobile it jumps to the very top so
                the Apply CTA is the first thing a delegate reaches. */}
            <div className="w-full md:w-[340px] md:flex-shrink-0 order-first md:order-none">
              <div className="flex flex-col gap-4 md:sticky" style={{ top: '12px' }}>

                {/* Apply CTA, always first */}
                <div
                  className="relative rounded-[20px] p-6 overflow-hidden"
                  style={{ backgroundColor: '#1B3828', boxShadow: '0 16px 40px rgba(27,56,40,0.28)' }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute"
                    style={{
                      top: '-60px', right: '-40px', width: '200px', height: '200px',
                      background: 'radial-gradient(circle, rgba(238,217,138,0.14) 0%, transparent 65%)',
                    }}
                  />
                  <div className="relative">
                    {(authLoading || participantDataLoading) ? (
                      /* 0, Applications/allocation not yet resolved: skeleton,
                         never the empty/apply states below, which are only
                         ever true conclusions once the data has landed. */
                      <SidebarCardSkeleton />
                    ) : isOrganizerViewer ? (
                      /* 1, Organizer/secretariat: manage affordances, never apply buttons */
                      <>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#EED98A', margin: '0 0 8px 0' }}>
                          {(organizerRole ?? 'owner').toUpperCase()}
                        </p>
                        <p className="font-bold text-base mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          You run this conference
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
                          Manage applications, committees, and your public page.
                        </p>
                        {myApp && (
                          <div
                            className="flex items-center justify-between rounded-xl px-3.5 py-2.5 mb-3"
                            style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.18)' }}
                          >
                            <span className="text-[12px] font-semibold" style={{ color: 'rgba(237,231,216,0.9)', fontFamily: "'Outfit', sans-serif" }}>
                              Also applied as {roleLabel(myApp.role)}
                            </span>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.1em', color: '#EED98A' }}>
                              {myApp.status.toUpperCase()}
                            </span>
                          </div>
                        )}
                        <Link
                          href={`/manage/${slug}`}
                          className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-bold text-sm transition-colors focus:outline-none"
                          style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textDecoration: 'none' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                        >
                          <LayoutDashboard size={15} strokeWidth={2.2} />
                          MANAGE CONFERENCE
                        </Link>
                      </>
                    ) : myApp ? (
                      /* 2, Existing applicant/participant: status card, no apply buttons */
                      (() => {
                        const STATUS_META: Record<string, { label: string; bg: string; color: string; hint: string }> = {
                          submitted:    { label: 'SUBMITTED',    bg: 'rgba(238,217,138,0.15)', color: '#EED98A',              hint: 'Your application is under review.' },
                          accepted:     { label: 'ACCEPTED',     bg: 'rgba(61,122,82,0.35)',   color: '#A8D5B8',              hint: 'You are in. Your allocation will follow.' },
                          assigned:     { label: 'ASSIGNED',     bg: 'rgba(61,122,82,0.35)',   color: '#A8D5B8',              hint: '' },
                          'checked-in': { label: 'CHECKED IN',   bg: 'rgba(61,122,82,0.35)',   color: '#A8D5B8',              hint: '' },
                          waitlisted:   { label: 'WAITLISTED',   bg: 'rgba(237,231,216,0.12)', color: 'rgba(237,231,216,0.8)', hint: 'You are on the waitlist. We will notify you if a spot opens.' },
                          rejected:     { label: 'NOT ACCEPTED', bg: 'rgba(139,32,32,0.35)',   color: '#E8A9A9',              hint: 'Your application was not accepted this time.' },
                        };
                        const meta = STATUS_META[myApp.status] ?? { label: myApp.status.toUpperCase(), bg: 'rgba(237,231,216,0.12)', color: 'rgba(237,231,216,0.8)', hint: '' };
                        const allocCountry = myAllocation ? getCountryByName(myAllocation.country_name) : null;
                        const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;
                        // The conference application fee (if any) is always
                        // payable pre-acceptance, so the entry point shows as
                        // soon as the application is submitted, regardless of
                        // the role fee's own payment_timing.
                        const payable = myApp.status === 'submitted' || myApp.status === 'accepted'
                          || myApp.status === 'assigned' || myApp.status === 'checked-in';
                        return (
                          <>
                            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#EED98A', margin: '0 0 8px 0' }}>
                              YOUR APPLICATION
                            </p>
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <p className="font-bold text-base text-white" style={{ fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                                {roleLabel(myApp.role)}
                              </p>
                              <span
                                className="flex-shrink-0"
                                style={{ backgroundColor: meta.bg, color: meta.color, fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', letterSpacing: '0.1em' }}
                              >
                                {meta.label}
                              </span>
                            </div>
                            {meta.hint && (
                              <p className="text-xs" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6, margin: '4px 0 0 0' }}>
                                {meta.hint}
                              </p>
                            )}
                            {payable && (
                              <Link
                                href={`/conferences/${slug}/pay`}
                                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-4 font-bold text-sm transition-colors focus:outline-none"
                                style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textDecoration: 'none' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                              >
                                <CreditCard size={15} strokeWidth={2.2} />
                                PAY AND REQUEST AID
                              </Link>
                            )}
                            {myAllocation && (
                              <div
                                className="mt-4 rounded-xl px-4 py-3.5"
                                style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.18)' }}
                              >
                                <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: 'rgba(238,217,138,0.75)', margin: '0 0 6px 0' }}>
                                  YOUR ALLOCATION
                                </p>
                                <p className="text-[13.5px] font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                                  {myAllocation.conference_committees?.name ?? 'Committee'}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {allocFlag && (
                                    <img
                                      src={allocFlag}
                                      alt=""
                                      style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                                    />
                                  )}
                                  <span className="text-[12.5px] font-semibold" style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
                                    {myAllocation.country_name}
                                  </span>
                                </div>
                              </div>
                            )}
                            {/* Still a real link (copy/new-tab work), but a plain
                                click is the same in-place tab switch as the
                                strip above rather than a page load. */}
                            <a
                              href={`/conferences/${slug}/role/${myApp.role}`}
                              onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                                e.preventDefault();
                                showTab('participant', myApp.role);
                              }}
                              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mt-3 font-bold text-xs transition-colors focus:outline-none"
                              style={{ backgroundColor: 'rgba(238,217,138,0.08)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.22)', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', textDecoration: 'none' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.16)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.08)'; }}
                            >
                              VIEW YOUR DASHBOARD
                            </a>
                          </>
                        );
                      })()
                    ) : !user ? (
                      /* 4, Signed out: one elegant APPLY NOW routing through sign-in */
                      <>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-bold text-base text-white" style={{ fontFamily: "'Outfit', sans-serif", margin: 0 }}>Ready to take the floor?</p>
                          {(conference.min_age != null || conference.max_age != null) && <MinAgeChip minAge={conference.min_age} maxAge={conference.max_age} />}
                        </div>
                        <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
                          Sign in with a free account to start your application.
                        </p>
                        <button
                          onClick={() => router.push(`/auth/signin?next=/conferences/${slug}`)}
                          className="w-full rounded-xl py-3 font-bold text-sm focus:outline-none"
                          style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', transition: `background-color 200ms ${EASE}, transform 160ms ${EASE}` }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                          onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
                          onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                          onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                          APPLY NOW →
                        </button>
                      </>
                    ) : enabledRoles.length === 0 ? (
                      <>
                        <p className="font-bold text-base text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>No open applications</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
                          Check back when applications open.
                        </p>
                      </>
                    ) : (
                      /* 3, Signed in, no involvement: one APPLY NOW revealing a role picker */
                      <>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-bold text-base text-white" style={{ fontFamily: "'Outfit', sans-serif", margin: 0 }}>Apply to this Conference</p>
                          {(conference.min_age != null || conference.max_age != null) && <MinAgeChip minAge={conference.min_age} maxAge={conference.max_age} />}
                        </div>
                        <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
                          {hasOpenRoles ? 'Applications are open.' : 'Applications are currently closed.'}
                        </p>
                        <button
                          onClick={() => setRolePickerOpen(v => !v)}
                          aria-expanded={rolePickerOpen}
                          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none"
                          style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer', transition: `background-color 200ms ${EASE}, transform 160ms ${EASE}` }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                          onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
                          onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                          onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                          APPLY NOW
                          <ChevronDown
                            size={15}
                            strokeWidth={2.4}
                            style={{ transform: rolePickerOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 240ms ease' }}
                          />
                        </button>
                        {rolePickerOpen && (
                          <div className="mt-3 flex flex-col gap-1.5">
                            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: 'rgba(238,217,138,0.75)', margin: '4px 0 2px 0' }}>
                              CHOOSE YOUR ROLE
                            </p>
                            {enabledRoles.map(r => {
                              const windowStatus = getRoleWindowStatus(r);
                              const open = windowStatus === 'open' || windowStatus === 'open-always';
                              // Today's price: the active fee phase when one covers
                              // today's date, otherwise the flat role fee.
                              const resolved = activePhaseFee({ fee_amount: r.fee_amount, fee_phases: r.fee_phases });
                              const fee = resolved.amount > 0
                                ? formatFeeCompact(resolved.amount, r.fee_currency ?? conference.fee_currency)
                                : 'Free';
                              const reason = windowStatus === 'closed'
                                ? 'Applications closed'
                                : windowStatus === 'opens-soon' && r.applications_open_at
                                  ? `Opens ${fmtWindowDate(r.applications_open_at)}`
                                  : 'Not yet open';
                              return (
                                <button
                                  key={r.role}
                                  disabled={!open}
                                  onClick={() => { if (open) router.push(`/conferences/${slug}/apply?role=${r.role}`); }}
                                  className="w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors focus:outline-none"
                                  style={{
                                    backgroundColor: open ? 'rgba(238,217,138,0.08)' : 'rgba(237,231,216,0.04)',
                                    border: open ? '1px solid rgba(238,217,138,0.22)' : '1px solid rgba(237,231,216,0.08)',
                                    cursor: open ? 'pointer' : 'default',
                                    opacity: open ? 1 : 0.55,
                                  }}
                                  onMouseEnter={(e) => { if (open) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(238,217,138,0.16)'; el.style.borderColor = 'rgba(238,217,138,0.45)'; } }}
                                  onMouseLeave={(e) => { if (open) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(238,217,138,0.08)'; el.style.borderColor = 'rgba(238,217,138,0.22)'; } }}
                                >
                                  <span className="flex items-center gap-3 min-w-0">
                                    <RoleApplyGlyph role={r.role} size={30} />
                                    <span className="min-w-0">
                                      <span className="block text-[13px] font-bold text-white truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {roleLabel(r.role)}
                                      </span>
                                      <span
                                        className="block mt-0.5"
                                        style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '10px', letterSpacing: '0.08em', color: open ? '#EED98A' : 'rgba(237,231,216,0.55)' }}
                                      >
                                        {open ? fee : reason}
                                      </span>
                                    </span>
                                  </span>
                                  {open && <ArrowRight size={15} strokeWidth={2.2} style={{ color: '#EED98A', flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Pricing medallion */}
                <SectionCard>
                  <div className="flex flex-col items-center pt-2">
                    <div
                      className="relative flex flex-col items-center justify-center"
                      style={{
                        width: '150px', height: '150px', borderRadius: '9999px',
                        background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.3) 0%, rgba(250,248,243,0) 72%)',
                        border: '1.5px solid rgba(182,135,31,0.42)',
                        boxShadow: '0 10px 30px rgba(27,56,40,0.1), 0 0 0 8px rgba(238,217,138,0.12)',
                      }}
                    >
                      {(() => {
                        // Headline = today's delegate price: the delegate role's
                        // active fee phase when one covers today, else the
                        // unified role-config flat fee (falls back to the
                        // conference fee when no role config exists).
                        const delegatePhase = activeFeePhase(roleConfigs.find(r => r.role === 'delegate')?.fee_phases);
                        const headlineFee = delegatePhase ? Number(delegatePhase.amount) : heroFeeAmount;
                        return headlineFee === 0 ? (
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '30px', color: '#1B3828', lineHeight: 1 }}>FREE</span>
                        ) : (
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: '38px', color: '#1C1410', lineHeight: 1 }}>
                            {formatFeeCompact(headlineFee, heroFeeCurrency)}
                          </span>
                        );
                      })()}
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: '#9A8A78', marginTop: '7px' }}>
                        PER DELEGATE
                      </span>
                    </div>

                    <button
                      onClick={() => setPricingOpen(v => !v)}
                      className="mt-4 flex items-center gap-1.5 text-[11px] font-bold focus:outline-none transition-colors"
                      style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#B6871F'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                    >
                      PRICING DETAILS
                      <ChevronDown
                        size={13}
                        style={{ transform: pricingOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 240ms ease' }}
                      />
                    </button>

                    {pricingOpen && (
                      <div className="w-full mt-4 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                        {enabledRoles.map((r, i) => {
                          const phases = r.fee_phases ?? [];
                          const activePhase = activeFeePhase(phases);
                          const currency = r.fee_currency ?? conference.fee_currency;
                          const fmtPhaseDate = (iso: string) =>
                            new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                          return (
                            <div key={r.role} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(221,212,192,0.4)' }}>
                              <div className="flex items-center justify-between py-2">
                                <span className="text-[13px] font-medium" style={{ color: '#4A4238', fontFamily: "'Outfit', sans-serif" }}>
                                  {capitalize(r.role.replace(/-/g, ' '))}
                                </span>
                                <span className="text-[13px] font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                                  {(() => {
                                    const resolved = activePhaseFee({ fee_amount: r.fee_amount, fee_phases: phases });
                                    return resolved.amount > 0 ? formatFeeCompact(resolved.amount, currency) : 'Free';
                                  })()}
                                </span>
                              </div>
                              {/* Fee phases breakdown, rendered only when the
                                  organizer configured date-windowed pricing */}
                              {phases.length > 0 && (
                                <div className="pb-2 flex flex-col gap-1">
                                  {phases.map((p, pi) => {
                                    const isCurrent = activePhase !== null && p === activePhase;
                                    return (
                                      <div
                                        key={pi}
                                        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                                        style={{
                                          backgroundColor: isCurrent ? 'rgba(27,56,40,0.08)' : 'transparent',
                                          border: isCurrent ? '1px solid rgba(27,56,40,0.25)' : '1px solid transparent',
                                        }}
                                      >
                                        <span className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className="text-[11.5px] font-semibold truncate"
                                            style={{ color: isCurrent ? '#1B3828' : '#4A4238', fontFamily: "'Outfit', sans-serif" }}
                                          >
                                            {p.label || 'Phase'}
                                          </span>
                                          {isCurrent && (
                                            <span
                                              className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full"
                                              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em' }}
                                            >
                                              CURRENT
                                            </span>
                                          )}
                                        </span>
                                        <span className="flex items-center gap-2 flex-shrink-0">
                                          {p.start_date && p.end_date && (
                                            <span className="text-[10.5px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                              {fmtPhaseDate(p.start_date)} – {fmtPhaseDate(p.end_date)}
                                            </span>
                                          )}
                                          <span
                                            className="text-[11.5px] font-bold"
                                            style={{ color: isCurrent ? '#1B3828' : '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}
                                          >
                                            {p.amount > 0 ? formatFeeCompact(p.amount, currency) : 'Free'}
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </SectionCard>

              </div>
            </div>
          </div>

              {/* The rest of Overview, full width below the two columns. Fades
                  rather than slides — see .conf-tab-fade in globals.css. */}
              {activeTab === 'overview' && (
              <div className={hasSwitchedTab ? 'conf-tab-fade' : undefined}>

              {/* Committees, sortable horizontal slider */}
              {(() => {
                const committeeStats = (c: Committee) => {
                  const slots = committeeSlots[c.id] ?? [];
                  const occ = committeeOccupied[c.id] ?? {};
                  const isCrisis = c.committee_type === 'crisis';
                  const countryCapacity = slots.length || c.total_slots || 0;
                  const countriesTaken = Object.values(occ).filter(n => n > 0).length;
                  const seatsTaken = Object.values(occ).reduce((sum, n) => sum + n, 0);
                  // Crisis committees are always 1 seat per role regardless of what a
                  // slot's delegation_size happens to hold.
                  const seatCapacity = slots.length > 0
                    ? slots.reduce((sum, s) => sum + (isCrisis ? 1 : (s.delegation_size || 1)), 0)
                    : countryCapacity;
                  // Seats and countries coincide when nothing is a double, so this pct
                  // is already correct for single-seat committees too.
                  const pct = seatCapacity > 0 ? Math.min(100, Math.round((seatsTaken / seatCapacity) * 100)) : 0;
                  return { slots, countryCapacity, countriesTaken, seatCapacity, seatsTaken, pct, hasDoubles: seatCapacity !== countryCapacity };
                };
                const DIFF_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
                let sortedCommittees = [...committees];
                if (sortKey === 'type') {
                  // Filter, not sort: first click shows GA-style committees only,
                  // second click shows crisis only, third click resets.
                  const wantCrisis = sortDir === 'desc';
                  sortedCommittees = sortedCommittees.filter(c => (c.committee_type === 'crisis') === wantCrisis);
                } else if (sortKey) {
                  sortedCommittees.sort((a, b) => {
                    let va = 0, vb = 0;
                    if (sortKey === 'difficulty') {
                      va = DIFF_ORDER[(a.difficulty ?? '').toLowerCase()] ?? 99;
                      vb = DIFF_ORDER[(b.difficulty ?? '').toLowerCase()] ?? 99;
                    } else {
                      // Availability = open seats (seatCapacity minus seatsTaken).
                      const sa = committeeStats(a);
                      const sb = committeeStats(b);
                      va = sa.seatCapacity - sa.seatsTaken;
                      vb = sb.seatCapacity - sb.seatsTaken;
                    }
                    return sortDir === 'asc' ? va - vb : vb - va;
                  });
                }
                const cycleSort = (key: 'difficulty' | 'availability' | 'type') => {
                  if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
                  else if (sortDir === 'asc') { setSortDir('desc'); }
                  else { setSortKey(''); setSortDir('asc'); }
                };
                const ROMAN = ['I', 'II', 'III'];
                const rosterCommittee = expandedRoster ? committees.find(x => x.id === expandedRoster) : null;

                return (
                  <div
                    className="mb-6"
                    style={{
                      // Full-bleed: break out of the centered 1200px column so the
                      // committee slider spans the entire viewport width and many
                      // more committees are visible at once.
                      width: '100vw',
                      marginLeft: 'calc(50% - 50vw)',
                      marginRight: 'calc(50% - 50vw)',
                      paddingLeft: 'clamp(20px, 4vw, 56px)',
                      paddingRight: 'clamp(20px, 4vw, 56px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Sort bar */}
                    {committees.length > 1 && (
                      <div
                        className="inline-flex flex-wrap items-center gap-1.5 rounded-full px-2 py-1.5 mb-4"
                        style={{
                          backgroundColor: 'rgba(250,248,243,0.72)',
                          backdropFilter: 'blur(16px) saturate(1.4)',
                          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                          border: '1px solid rgba(221,212,192,0.85)',
                          boxShadow: '0 6px 20px rgba(27,56,40,0.07)',
                        }}
                      >
                        <SortButton
                          label="DIFFICULTY"
                          dir={sortKey === 'difficulty' ? sortDir : null}
                          onClick={() => cycleSort('difficulty')}
                        />
                        <SortButton
                          label="AVAILABILITY"
                          dir={sortKey === 'availability' ? sortDir : null}
                          onClick={() => cycleSort('availability')}
                        />
                        <TypeFilterButton
                          mode={sortKey === 'type' ? (sortDir === 'asc' ? 'ga' : 'crisis') : null}
                          onClick={() => cycleSort('type')}
                        />
                      </div>
                    )}

                    {committees.length === 0 && !isOrganizerViewer ? (
                      <SectionCard>
                        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          Committees will be announced soon.
                        </p>
                      </SectionCard>
                    ) : sortedCommittees.length === 0 && !isOrganizerViewer ? (
                      <SectionCard>
                        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          No {sortDir === 'desc' ? 'crisis' : 'General Assembly'} committees at this conference.
                        </p>
                      </SectionCard>
                    ) : (
                      <div className="relative">
                        {/* Slider arrows */}
                        {sortedCommittees.length > 2 && (
                          <>
                            <button
                              aria-label="Scroll committees left"
                              onClick={() => carouselRef.current?.scrollBy({ left: -324, behavior: 'smooth' })}
                              className="hidden md:flex items-center justify-center absolute z-20 focus:outline-none"
                              style={{
                                left: '-16px', top: '50%', transform: 'translateY(-50%)',
                                width: '38px', height: '38px', borderRadius: '9999px',
                                backgroundColor: 'rgba(250,248,243,0.88)',
                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                border: '1px solid rgba(221,212,192,0.95)',
                                boxShadow: '0 6px 18px rgba(27,56,40,0.16)',
                                color: '#1B3828', cursor: 'pointer',
                              }}
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              aria-label="Scroll committees right"
                              onClick={() => carouselRef.current?.scrollBy({ left: 324, behavior: 'smooth' })}
                              className="hidden md:flex items-center justify-center absolute z-20 focus:outline-none"
                              style={{
                                right: '-16px', top: '50%', transform: 'translateY(-50%)',
                                width: '38px', height: '38px', borderRadius: '9999px',
                                backgroundColor: 'rgba(250,248,243,0.88)',
                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                border: '1px solid rgba(221,212,192,0.95)',
                                boxShadow: '0 6px 18px rgba(27,56,40,0.16)',
                                color: '#1B3828', cursor: 'pointer',
                              }}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </>
                        )}

                        {/* Card slider */}
                        <div
                          ref={carouselRef}
                          className="flex gap-4 overflow-x-auto"
                          style={{
                            // `safe center` centres the set when it fits, and falls back to
                            // start-alignment (no clipping, scroll still reaches the first card)
                            // when it overflows — the effect then scrolls to the middle.
                            justifyContent: 'safe center',
                            scrollSnapType: 'x mandatory',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            padding: '4px 4px 12px 4px',
                            margin: '-4px -4px 0 -4px',
                          }}
                        >
                          {sortedCommittees.map(c => {
                            const diff = c.difficulty?.toLowerCase() ?? '';
                            const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
                            const isCrisis = c.committee_type === 'crisis';
                            const monogram = (c.abbreviation || c.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                            const chairs = c.display_chairs ?? [];
                            const chairIds = c.chair_user_ids ?? [];
                            // Link a chair to their public MUN CV only when we can safely
                            // correlate display_chairs[i] ↔ chair_user_ids[i] (equal lengths ⇒
                            // same order from the sync trigger); mismatched ⇒ don't link, to
                            // avoid ever pointing at the wrong person's CV.
                            const chairsLinkable = chairIds.length === chairs.length;
                            const { countryCapacity, countriesTaken, seatCapacity, seatsTaken, pct, hasDoubles } = committeeStats(c);

                            return (
                              <article
                                key={c.id}
                                className="relative flex-shrink-0 flex flex-col rounded-[24px]"
                                style={{
                                  width: '298px',
                                  scrollSnapAlign: 'start',
                                  backgroundColor: 'rgba(250,248,243,0.82)',
                                  backdropFilter: 'blur(12px)',
                                  WebkitBackdropFilter: 'blur(12px)',
                                  border: '1px solid rgba(221,212,192,0.95)',
                                  boxShadow: '0 10px 30px rgba(27,56,40,0.08)',
                                }}
                              >
                                {isOrganizerViewer && (
                                  <OrganizerPencil
                                    variant="corner"
                                    ariaLabel={`Edit ${c.abbreviation ?? c.name}`}
                                    onClick={() => openCommitteeEditor(c.id)}
                                    style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
                                  />
                                )}
                                <div className="flex flex-col items-center px-5 pt-7 flex-1">
                                  {/* Emblem, free-floating */}
                                  {c.logo_url ? (
                                    <img
                                      src={c.logo_url}
                                      alt={c.abbreviation ?? c.name}
                                      style={{
                                        width: '104px', height: '104px', objectFit: 'contain', flexShrink: 0,
                                        filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))',
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
                                      style={{
                                        width: '96px', height: '96px', borderRadius: '9999px',
                                        background: isCrisis
                                          ? 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)'
                                          : 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
                                        boxShadow: '0 10px 24px rgba(27,56,40,0.26)',
                                      }}
                                    >
                                      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
                                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: monogram.length > 4 ? '13px' : '16px', fontWeight: 700, color: '#EED98A', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                                        {monogram}
                                      </span>
                                    </div>
                                  )}

                                  {/* Name */}
                                  <h3
                                    className="text-center font-bold text-[15.5px] leading-snug"
                                    style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: '18px 0 0 0', minHeight: '2.6em' }}
                                  >
                                    {c.name}
                                  </h3>

                                  {/* Meta row */}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {c.difficulty && (
                                      <span
                                        className="px-2.5 py-0.5 rounded-full"
                                        style={{ ...diffStyle, fontSize: '10px', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}
                                      >
                                        {capitalize(diff)}
                                      </span>
                                    )}
                                    <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                                    <span className="text-[12px] font-semibold" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif" }}>
                                      {!isCrisis && c.delegation_size >= 2 ? `${countryCapacity} countries · 2 delegates each` : `${countryCapacity} ${isCrisis ? 'roles' : 'seats'}`}
                                    </span>
                                    {isCrisis && (
                                      <>
                                        <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                                        <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}>
                                          CRISIS
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Topics, roman numerals */}
                                  {c.topics && c.topics.length > 0 && (
                                    <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                                      {c.topics.map((topic, ti) => (
                                        <div key={topic} className="flex items-start gap-2.5 py-1">
                                          <span
                                            className="flex-shrink-0 text-right"
                                            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}
                                          >
                                            {ROMAN[ti] ?? String(ti + 1)}.
                                          </span>
                                          <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55 }}>
                                            {topic}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Dais, pinned to the card bottom — shown only when chairs are assigned */}
                                  <div className="w-full mt-auto">
                                  {chairs.length > 0 && (
                                  <div className="w-full mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                                    <div className="flex items-start justify-center gap-6">
                                      {chairs.map((ch, ci) => {
                                        const uid = chairsLinkable ? chairIds[ci] : null;
                                        const inner = (
                                          <>
                                            {ch.avatar_url ? (
                                              /* eslint-disable-next-line @next/next/no-img-element */
                                              <img
                                                src={ch.avatar_url}
                                                alt={ch.name}
                                                style={{
                                                  width: '52px', height: '52px', borderRadius: '9999px', objectFit: 'cover',
                                                  boxShadow: '0 4px 12px rgba(27,56,40,0.22)',
                                                  backgroundColor: '#EDE7D8',
                                                  outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: '-1px',
                                                }}
                                              />
                                            ) : (
                                              <span
                                                className="flex items-center justify-center"
                                                style={{
                                                  width: '52px', height: '52px', borderRadius: '9999px',
                                                  backgroundColor: '#1B3828', color: '#EED98A',
                                                  fontSize: '17px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                                                }}
                                              >
                                                {ch.name.charAt(0)}
                                              </span>
                                            )}
                                            <span className="text-[11.5px] font-semibold mt-2 leading-tight" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                              {ch.name}
                                            </span>
                                          </>
                                        );
                                        return uid ? (
                                          <ProfileLink
                                            key={ch.name}
                                            userId={uid}
                                            name={ch.name}
                                            className="flex flex-col items-center text-center transition-transform hover:-translate-y-0.5"
                                            style={{ width: '96px' }}
                                          >
                                            {inner}
                                          </ProfileLink>
                                        ) : (
                                          <div key={ch.name} className="flex flex-col items-center text-center" style={{ width: '96px' }}>
                                            {inner}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  )}

                                  {/* Capacity */}
                                  <div className="w-full mt-4">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '9.5px', letterSpacing: '0.08em', color: '#6B5F52' }}>
                                        {hasDoubles
                                          ? `${countriesTaken}/${countryCapacity} · ${seatsTaken}/${seatCapacity} seats`
                                          : `${countriesTaken}/${countryCapacity} FILLED`}
                                      </span>
                                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '9.5px', color: '#9A8A78' }}>
                                        {pct}%
                                      </span>
                                    </div>
                                    <div className="rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: 'rgba(221,212,192,0.65)' }}>
                                      <div
                                        style={{
                                          width: `${pct}%`, height: '100%', borderRadius: '9999px',
                                          background: 'linear-gradient(to right, #2A5A3C, #3D7A52)',
                                          transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  </div>
                                </div>

                                {/* View members */}
                                <div className="px-5 pb-5 pt-4">
                                  <button
                                    onClick={() => setExpandedRoster(c.id)}
                                    className="w-full rounded-xl py-2.5 text-[11px] font-bold transition-colors focus:outline-none"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: '#1B3828',
                                      border: '1.5px solid rgba(27,56,40,0.35)',
                                      fontFamily: "'Outfit', sans-serif",
                                      letterSpacing: '0.1em',
                                      cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; }}
                                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; }}
                                  >
                                    VIEW {isCrisis ? 'ROLES' : 'MEMBERS'}
                                  </button>
                                </div>
                              </article>
                            );
                          })}

                          {/* Organizer: add a committee straight from the public page */}
                          {isOrganizerViewer && (
                            <button
                              type="button"
                              onClick={() => setCommitteeEditor({ committee: null })}
                              className="flex-shrink-0 flex flex-col items-center justify-center gap-3 rounded-[24px] focus:outline-none"
                              style={{
                                width: '298px',
                                minHeight: '320px',
                                scrollSnapAlign: 'start',
                                border: '1.5px dashed rgba(27,56,40,0.4)',
                                backgroundColor: 'rgba(27,56,40,0.03)',
                                color: '#1B3828',
                                cursor: 'pointer',
                                transition: `background-color 250ms ${EASE}, border-color 250ms ${EASE}`,
                              }}
                              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(27,56,40,0.07)'; el.style.borderColor = 'rgba(27,56,40,0.6)'; }}
                              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(27,56,40,0.03)'; el.style.borderColor = 'rgba(27,56,40,0.4)'; }}
                            >
                              <span
                                className="flex items-center justify-center"
                                style={{
                                  width: '52px', height: '52px', borderRadius: '9999px',
                                  border: '1.5px dashed rgba(27,56,40,0.4)',
                                  backgroundColor: 'rgba(27,56,40,0.04)',
                                }}
                              >
                                <Plus size={20} strokeWidth={2.2} />
                              </span>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.14em' }}>
                                ADD COMMITTEE
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Roster modal, list format */}
                    {rosterCommittee && (() => {
                      const c = rosterCommittee;
                      const isCrisis = c.committee_type === 'crisis';
                      const { slots, countryCapacity, countriesTaken, seatCapacity, seatsTaken, pct, hasDoubles } = committeeStats(c);
                      const occ = committeeOccupied[c.id] ?? {};
                      return (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center px-6"
                          style={{ backgroundColor: 'rgba(28,20,16,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                          onClick={() => setExpandedRoster(null)}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-[24px] overflow-hidden"
                            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 28px 72px rgba(16,28,21,0.35)' }}
                          >
                            <div className="px-6 pt-6 pb-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="font-bold text-[16px] leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                                    {c.name}
                                  </p>
                                  <p className="mt-1" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '10px', letterSpacing: '0.1em', color: '#9A8A78', margin: '4px 0 0 0' }}>
                                    {hasDoubles
                                      ? `${seatsTaken}/${seatCapacity} SEATS FILLED`
                                      : `${countriesTaken}/${countryCapacity} ${isCrisis ? 'ROLES' : 'SEATS'} FILLED`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setExpandedRoster(null)}
                                  aria-label="Close"
                                  className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-colors"
                                  style={{ width: '32px', height: '32px', border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', cursor: 'pointer' }}
                                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.borderColor = '#9A8A78'; }}
                                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.borderColor = '#DDD4C0'; }}
                                >
                                  <X size={15} />
                                </button>
                              </div>
                              <div className="mt-3 rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: 'rgba(221,212,192,0.65)' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: 'linear-gradient(to right, #2A5A3C, #3D7A52)' }} />
                              </div>
                            </div>
                            <div className="px-3 pb-4 overflow-y-auto" style={{ maxHeight: '54vh' }}>
                              {slots.length === 0 ? (
                                <p className="text-sm px-3 py-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                  The {isCrisis ? 'character' : 'country'} roster will be announced soon.
                                </p>
                              ) : (
                                slots.map((s, i) => {
                                  // Crisis roles are always 1 per slot regardless of what
                                  // delegation_size holds, same rule as committeeStats.
                                  const seatSize = isCrisis ? 1 : (s.delegation_size || 1);
                                  // Bad data could have seats_taken exceed delegation_size;
                                  // never render more TAKEN chips than the slot actually has.
                                  const seatsTakenHere = Math.min(occ[s.country_code] ?? 0, seatSize);
                                  const openHere = seatSize - seatsTakenHere;
                                  const co = getCountryByName(s.country_name);
                                  const flag = co ? getFlagUrl(co.code) : null;
                                  return (
                                    <div
                                      key={s.country_code}
                                      className="flex items-center gap-3 px-3 py-2.5"
                                      style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(221,212,192,0.45)' }}
                                    >
                                      {flag ? (
                                        <img
                                          src={flag}
                                          alt=""
                                          style={{ width: '22px', height: '15px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(27,56,40,0.25)' }}
                                        />
                                      ) : (
                                        <span
                                          className="flex items-center justify-center flex-shrink-0"
                                          style={{ width: '22px', height: '22px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.08)', fontFamily: "'Outfit', sans-serif", fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', color: '#1B3828' }}
                                        >
                                          {s.country_code.slice(0, 2)}
                                        </span>
                                      )}
                                      <span
                                        className="flex-1 text-[13px] font-medium truncate"
                                        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                                      >
                                        {s.country_name}
                                      </span>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {Array.from({ length: seatsTakenHere }, (_, ti) => (
                                          <span
                                            key={`taken-${ti}`}
                                            className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
                                          >
                                            <Check size={10} strokeWidth={2.6} />
                                            TAKEN
                                          </span>
                                        ))}
                                        {Array.from({ length: openHere }, (_, oi) => (
                                          <span
                                            key={`open-${oi}`}
                                            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: 'rgba(61,122,82,0.1)', color: '#2A5A3C', border: '1px solid rgba(61,122,82,0.25)', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
                                          >
                                            OPEN
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Partners — logo + name only, everything else behind the
                  popup. Floats in the left gutter on a wide screen and falls
                  back to an inline strip when there is no room; see
                  components/ConferencePartners.tsx. */}
              <ConferencePartners partners={partners} />

              </div>
              )}
        </div>

        {/* ── Organizer edit modals ──────────────────────────────────── */}
        {isOrganizerViewer && editModal === 'banner' && (
          <ModalOverlay onClose={() => { if (!assetUploading && !editSaving) setEditModal(null); }}>
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 'min(520px, 92vw)', maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>Conference Banner</p>
                <button onClick={() => { if (!assetUploading && !editSaving) setEditModal(null); }} className="focus:outline-none" style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close"><X size={18} /></button>
              </div>
              <div
                onClick={() => { if (!assetUploading && !editSaving) document.getElementById('public-banner-upload')?.click(); }}
                className="rounded-2xl"
                style={{
                  border: '1.5px dashed rgba(154,138,120,0.6)', padding: '26px 12px', textAlign: 'center',
                  cursor: assetUploading || editSaving ? 'wait' : 'pointer', backgroundColor: 'rgba(237,231,216,0.25)',
                  transition: `border-color 200ms ${EASE}, background-color 200ms ${EASE}`,
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(154,138,120,0.6)'; el.style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
              >
                {assetUploading ? (
                  <div className="flex justify-center py-2">
                    <Loader size={48} />
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: "'Outfit', sans-serif", marginBottom: 4 }}>Click to upload a banner</p>
                    <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>Recommended 1200x630px · max 5MB</p>
                  </>
                )}
              </div>
              <input
                id="public-banner-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAssetSelect('banners', f); e.target.value = ''; }}
              />
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: '#7A6E5E', margin: '16px 0 8px 0' }}>
                Or pick a preset
              </p>
              <div className="flex flex-wrap gap-2">
                {BANNER_PRESETS.map(p => {
                  const selected = conference.banner_url === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleBannerPreset(p)}
                      disabled={assetUploading || editSaving}
                      aria-label={'Use preset banner ' + p}
                      style={{
                        width: 84, height: 48, padding: 0, borderRadius: 10, overflow: 'hidden',
                        cursor: assetUploading || editSaving ? 'wait' : 'pointer',
                        border: selected ? '2px solid #B6871F' : '1.5px solid #DDD4C0',
                        boxShadow: selected ? '0 0 0 3px rgba(238,217,138,0.55)' : 'none',
                        opacity: (assetUploading || editSaving) && !selected ? 0.6 : 1,
                        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                        backgroundColor: '#EDE7D8',
                      }}
                      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  );
                })}
              </div>
              {editError && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '12px 0 0 0' }}>{editError}</p>}
            </div>
          </ModalOverlay>
        )}

        {isOrganizerViewer && editModal === 'logo' && (
          <ModalOverlay onClose={() => { if (!assetUploading && !editSaving) setEditModal(null); }}>
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 'min(420px, 92vw)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>Conference Logo</p>
                <button onClick={() => { if (!assetUploading && !editSaving) setEditModal(null); }} className="focus:outline-none" style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => { if (!assetUploading && !editSaving) document.getElementById('public-logo-upload')?.click(); }}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 96, height: 96, borderRadius: 20,
                    border: '1.5px dashed #DDD4C0', backgroundColor: '#FFFFFF',
                    overflow: 'hidden', cursor: assetUploading || editSaving ? 'wait' : 'pointer',
                    transition: `border-color 200ms ${EASE}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                >
                  {assetUploading ? (
                    <Loader size={48} />
                  ) : conference.logo_url ? (
                    <LogoDisc src={conference.logo_url} alt={conference.acronym} size={80} fallbackText={conference.acronym.slice(0, 3)} />
                  ) : (
                    <Plus size={20} strokeWidth={2.2} style={{ color: '#9A8A78' }} />
                  )}
                </div>
                <p className="text-[12px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6, margin: 0 }}>
                  Click the box to upload a new logo. Square, transparent PNG works best. Max 5MB.
                </p>
              </div>
              <input
                id="public-logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) { setEditError('Image must be under 5MB.'); return; }
                  setEditError('');
                  setLogoCropFile(f);
                }}
              />
              {editError && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '12px 0 0 0' }}>{editError}</p>}
            </div>
          </ModalOverlay>
        )}

        {/* Drag-to-fit crop step, flattens the chosen framing into a square
            transparent PNG, then hands off to the existing upload path. */}
        {isOrganizerViewer && logoCropFile && (
          <LogoCropModal
            file={logoCropFile}
            onCancel={() => setLogoCropFile(null)}
            onSave={(blob) => {
              setLogoCropFile(null);
              handleAssetSelect('logos', new File([blob], 'logo.png', { type: 'image/png' }));
            }}
          />
        )}

        {isOrganizerViewer && editModal === 'description' && (
          <ModalOverlay onClose={() => { if (!editSaving) setEditModal(null); }}>
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 'min(560px, 92vw)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>About the Conference</p>
                <button onClick={() => { if (!editSaving) setEditModal(null); }} className="focus:outline-none" style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close"><X size={18} /></button>
              </div>
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={9}
                placeholder="Tell delegates what your conference is about: history, venue, what makes it special..."
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                style={{ border: '1px solid #DDD4C0', backgroundColor: 'rgba(237,231,216,0.25)', color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
              {editError && <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '8px 0 0 0' }}>{editError}</p>}
              <div className="flex gap-3 mt-5">
                <button onClick={() => { if (!editSaving) setEditModal(null); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}>CANCEL</button>
                <button onClick={handleSaveDescription} disabled={editSaving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: editSaving ? '#DDD4C0' : '#1B3828', color: editSaving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", border: 'none', cursor: editSaving ? 'default' : 'pointer' }}>{editSaving ? 'SAVING...' : 'SAVE'}</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {isOrganizerViewer && editModal === 'about' && (
          <ModalOverlay onClose={() => { if (!editSaving) setEditModal(null); }}>
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 'min(480px, 92vw)', maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>Contact &amp; Social Links</p>
                <button onClick={() => { if (!editSaving) setEditModal(null); }} className="focus:outline-none" style={{ color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="flex flex-col gap-3.5">
                {([
                  { key: 'contact_email' as const, label: 'Contact Email', placeholder: 'hello@yourmun.org', type: 'email' },
                  { key: 'instagram_url' as const, label: 'Instagram URL', placeholder: 'https://instagram.com/...', type: 'url' },
                  { key: 'facebook_url' as const, label: 'Facebook URL', placeholder: 'https://facebook.com/...', type: 'url' },
                  { key: 'tiktok_url' as const, label: 'TikTok URL', placeholder: 'https://tiktok.com/@...', type: 'url' },
                  { key: 'whatsapp_url' as const, label: 'WhatsApp URL', placeholder: 'https://chat.whatsapp.com/...', type: 'url' },
                  { key: 'website_url' as const, label: 'Website URL', placeholder: 'https://yourmun.org', type: 'url' },
                ]).map(f => (
                  <div key={f.key}>
                    <label style={modalLabelStyle}>{f.label}</label>
                    <input
                      type={f.type}
                      value={aboutDraft[f.key]}
                      onChange={(e) => setAboutDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={modalInputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                    />
                  </div>
                ))}
              </div>
              {editError && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '12px 0 0 0' }}>{editError}</p>}
              <div className="flex gap-3 mt-5">
                <button onClick={() => { if (!editSaving) setEditModal(null); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}>CANCEL</button>
                <button onClick={handleSaveAbout} disabled={editSaving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: editSaving ? '#DDD4C0' : '#1B3828', color: editSaving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", border: 'none', cursor: editSaving ? 'default' : 'pointer' }}>{editSaving ? 'SAVING...' : 'SAVE'}</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* Shared committee editor, create (committee: null) and edit flows */}
        {isOrganizerViewer && committeeEditor && (
          <CommitteeEditorModal
            conference={{ id: conference.id }}
            committee={committeeEditor.committee}
            onSaved={() => { fetchAll({ silent: true }); }}
            onClose={() => setCommitteeEditor(null)}
          />
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer
          className="relative z-10 border-t border-[#DDD4C0] px-6 py-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '300px 300px',
            backgroundColor: '#EDE7D8',
          }}
        >
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
            <img
              src="/GavellingLogo.png"
              alt="Gavelling"
              className="h-7 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.instagram.com/wearegavelling/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              </span>
            </div>
            <p className="text-xs font-semibold text-[#1B3828] md:text-right">
              © {new Date().getFullYear()} Gavelling. Built for the MUN community.
            </p>
          </div>
          <FooterLegal tone="ivory" />
        </footer>
      </div>
    </div>
  );
}
