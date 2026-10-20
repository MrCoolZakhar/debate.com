'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import {
  LayoutDashboard, Building2, Users, MapPin, FileText,
  Mail, CreditCard, Settings, Briefcase, Menu, X, Radio, Upload, Store, Clock,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { LogoDisc } from '@/components/LogoDisc';
import Loader from '@/components/Loader';
import { loadAwardsWaiting } from '@/lib/awardsWaiting';
import { listedProblemCount, SETTINGS_FLAGS_EVENT, fixLabel, fixBadgeText } from '@/lib/roleSetupProblems';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import type { EmailTheme } from '@/lib/emailHtml';
import type { ConferenceTheme } from '@/lib/theme';
import { financialsAreReadOnly, isConferenceOwner } from '@/lib/organizerPermissions';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { useScrollLock } from '@/hooks/useScrollLock';
import NotificationStack from '@/components/notifications/NotificationStack';
import VerifiedCheck, { minutesToCheckmarkLabel } from '@/components/VerifiedCheck';
import { formatConferenceDates } from '@/lib/conferenceDates';
import { NEU } from '@/components/neu';
import { waitingSince } from './communications/waitingOnReply';
import PublishControls from './PublishControls';

// ── Conference type ────────────────────────────────────────────────────────

export interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  is_public: boolean;
  status: string;
  logo_url: string | null;
  banner_url: string | null;
  /** When a never-published draft goes live by itself (20 Oct 2026): created
   *  + 3 days, only once it has a logo (publish_due_conferences, every 15
   *  minutes). Null once it has been published or unpublished by hand. */
  auto_publish_at: string | null;
  start_date: string;
  end_date: string;
  /** Dates "to be decided": start/end are null and the conference cannot be
   *  published (enforced by the conferences_tbd_not_public CHECK) until real
   *  dates are set. Applications can still open. */
  dates_tbd: boolean;
  country: string;
  city: string;
  format: string;
  expected_delegates: number;
  fee_amount: number;
  fee_currency: string;
  contact_email: string;
  student_level: string;
  description: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
  website_url: string | null;
  stripe_account_id: string | null;
  connect_onboarding_status: string;
  payout_country: string | null;
  /** The ACTIVE payout method ('stripe' | 'manual' | null) — the two are
   *  mutually exclusive but each keeps its own setup (Stripe account,
   *  payment link/note) dormant while inactive, so switching is one click. */
  payment_method: string | null;
  external_payment_url: string | null;
  external_payment_note: string | null;
  /** Which manual way to pay (prompt 94): a link, a QR code or bank details; in person since prompt 114. */
  manual_kind: 'link' | 'qr' | 'bank' | 'in_person' | null;
  /** A path in the public conference-assets bucket (manual_kind 'qr'). */
  payment_qr_path: string | null;
  bank_details: { account_name?: string; account_number?: string; swift?: string; bank_name?: string; reference?: string } | null;
  /** Stripe's own list of what it still needs (account.updated); may be null. */
  connect_requirements: {
    currently_due?: string[]; past_due?: string[]; eventually_due?: string[];
    disabled_reason?: string | null; current_deadline?: number | string | null;
    charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean;
  } | null;
  payment_gate_exempt: boolean;
  /** Card payments charged on Gavelling's own Stripe account (no Connect
   *  needed). conference_payments_ready() treats it as ready. */
  platform_collects: boolean;
  predecessor_conference_id: string | null;
  predecessor_approved: boolean;
  min_age: number | null;
  max_age: number | null;
  allocation_swap_mode: string;
  /** Delegation leaders may import their own delegates, one of their credits
   *  each (Settings → Delegations). Off by default. */
  allow_delegation_import: boolean;
  /** TRUE (default) = seating a delegate emails them their allocation right
   *  away. FALSE = the organiser releases allocation emails in waves from the
   *  Assignment page. Per-delegate send state is on conference_allocations. */
  allocation_email_auto: boolean;
  email_theme: EmailTheme;
  financial_aid_enabled: boolean;
  aid_questions: unknown[];
  aid_intro: string | null;
  /** Raw `conferences.awards_config` JSONB. Always read it through
   *  `getAwardsConfig()` in `src/lib/awards.ts`; never trust the shape here. */
  awards_config: unknown;
  /** The ceremony moment: set once by `publish_conference_awards()`. */
  awards_published_at: string | null;
  /** Raw `conferences.intent` JSONB: what the organiser said they came here to
   *  do, asked once at the end of the creation wizard. Always read it through
   *  `getConferenceIntent()` in `src/lib/conferenceIntent.ts`; never trust the
   *  shape here. `{}` means the question was never put to them. */
  intent: unknown;
  /** The PUBLISHED colour theme. Empty object means "use Gavelling's own
   *  palette" — see src/lib/theme.ts. */
  theme: ConferenceTheme;
  /** The unpublished draft, edited freely; publish_conference_theme() copies
   *  this into `theme`. */
  theme_draft: ConferenceTheme;
  /** The blue checkmark. COMPUTED by `refresh_conference_verification()` once
   *  every verification stage is done; a guard trigger rejects direct writes. */
  is_verified: boolean;
  verified_at: string | null;
  /** Stamped once by the communications page on first visit: the server-side
   *  twin of the localStorage "Explore emails" tick (src/lib/emailsExplored.ts). */
  emails_explored_at: string | null;
  /** Stamped when the organiser says they are running this conference on their
   *  own. It satisfies the `secretariat` verification stage in place of a
   *  second organiser — see conference_setup_status(). Plenty of conferences
   *  really are a one-person job, and before this column existed those could
   *  never earn the blue checkmark however ready they were. Never set for
   *  anyone automatically: it is a statement the organiser makes. */
  solo_secretariat_ack_at: string | null;
}

/** What is left before the checkmark, from `conference_setup_status()`. */
export interface VerificationStatus {
  minutesLeft: number;
  pending: string[];
}

// ── Context ────────────────────────────────────────────────────────────────

interface ManageContextType {
  conference: Conference | null;
  /** True when this organizer's bundle marks financials read-only (the ADMIN
   *  bundle). Financial pages render, the numbers are all visible, and every
   *  mutation is refused by can_write_financials() in the database — this flag
   *  is only so the interface can say so instead of letting a click fail. */
  financialsReadOnly: boolean;
  refreshConference: () => Promise<void>;
  /** Re-fetches the conference row and updates context state, without the
   *  full-screen loading flag `refreshConference` flips (which unmounts the
   *  page). Use this after a settings save to confirm DB truth in place. */
  refreshConferenceQuiet: () => Promise<void>;
  /** Minutes left and pending stage keys toward the blue checkmark. Null once
   *  the conference is verified (nothing left to do) and before the first load. */
  verification: VerificationStatus | null;
  /** Asks the database to recompute the mark. Cheap and idempotent. When the
   *  answer differs from the row in context, the row is refetched in place. */
  refreshVerification: () => Promise<void>;
}

const ManageContext = createContext<ManageContextType>({
  conference: null,
  financialsReadOnly: false,
  refreshConference: async () => {},
  refreshConferenceQuiet: async () => {},
  verification: null,
  refreshVerification: async () => {},
});

export function useManage() {
  return useContext(ManageContext);
}

const CONFERENCE_COLUMNS = [
  'id', 'slug', 'full_name', 'acronym', 'is_public', 'status',
  'logo_url', 'banner_url', 'auto_publish_at', 'start_date', 'end_date', 'dates_tbd', 'country', 'city',
  'format', 'expected_delegates', 'fee_amount', 'fee_currency',
  'contact_email', 'student_level', 'description',
  'instagram_url', 'facebook_url', 'tiktok_url', 'whatsapp_url', 'website_url',
  'stripe_account_id', 'connect_onboarding_status', 'payout_country', 'payment_method',
  'external_payment_url', 'external_payment_note', 'manual_kind', 'payment_qr_path', 'bank_details', 'connect_requirements', 'payment_gate_exempt', 'platform_collects', 'organizer_id',
  'predecessor_conference_id', 'predecessor_approved', 'min_age', 'max_age',
  'allocation_swap_mode', 'allow_delegation_import', 'allocation_email_auto', 'email_theme',
  'financial_aid_enabled', 'aid_questions', 'aid_intro',
  'awards_config', 'awards_published_at', 'intent',
  'theme', 'theme_draft',
  'is_verified', 'verified_at', 'emails_explored_at', 'solo_secretariat_ack_at',
].join(', ');

// ── Nav definition ─────────────────────────────────────────────────────────

/** Unhandled work, per rail entry. Every number is a real count of things
 *  waiting on the organiser — applications nobody has decided on, accepted
 *  delegates with no committee yet, participant threads waiting on a reply,
 *  financial aid requests still pending. Never a decoration: a zero renders
 *  nothing at all.
 *
 *  Shown as the existing badge treatment, which is a single gold DOT on the
 *  collapsed rail (the count lives in its aria-label) and the number itself
 *  only once the label beside it is legible. */
export interface NavBadges {
  applications: number;
  assignment: number;
  communications: number;
  financialAid: number;
  /** Proofs waiting plus open money to-dos (money_things_to_do_count). */
  financials: number;
  /** Role set-ups that need fixing (src/lib/roleSetupProblems.ts) plus award
   *  slates waiting for approval (src/lib/awardsWaiting.ts), 13 Oct 2026. */
  settings: number;
}

const NO_BADGES: NavBadges = { applications: 0, assignment: 0, communications: 0, financialAid: 0, financials: 0, settings: 0 };

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  external: boolean;
  badge: number;
  /** Settings' count is things to fix (13 Oct 2026): its own wording and 9+. */
  fixes?: boolean;
  /** A small gold tag at the end of the row (e.g. COMING SOON). Uppercase, no full stop. */
  tag?: string;
}

interface NavSection {
  header: string | null;
  items: NavItem[];
}

const NAV_SECTIONS = (slug: string, badges: NavBadges = NO_BADGES): NavSection[] => [
  {
    header: null,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',   href: `/manage/${slug}`,        external: false, badge: 0 },
      { icon: Radio,           label: 'Live Status', href: `/manage/${slug}/live`,   external: false, badge: 0 },
    ],
  },
  {
    header: 'MANAGE',
    items: [
      { icon: Building2, label: 'Committees',   href: `/manage/${slug}/committees`,   external: false, badge: 0 },
      { icon: Users,     label: 'Applications', href: `/manage/${slug}/applications`, external: false, badge: badges.applications },
      { icon: MapPin,    label: 'Assignment',   href: `/manage/${slug}/assignment`,   external: false, badge: badges.assignment },
      { icon: FileText,  label: 'Documents',    href: `/manage/${slug}/documents`,    external: false, badge: 0 },
      // Scoreboard is deliberately NOT a nav item. Delegate performance is a
      // property of a committee, not of the dashboard, so it opens from a
      // committee on Live Status (the card's "Points & performance" footer and
      // the Points block in its recap). The /manage/[slug]/scoreboard route is
      // still reachable by URL for the cross-committee comparison and the CSV
      // export, and is linked from inside the per-committee view.
    ],
  },
  {
    header: 'COMMUNICATE',
    items: [
      { icon: Mail, label: 'Communications', href: `/manage/${slug}/communications`, external: false, badge: badges.communications },
    ],
  },
  {
    header: 'FINANCIAL',
    items: [
      // Financial aid is a sub-page of Financials (/financials/aid) since 9 Oct
      // 2026, so its pending requests count on the Financials badge. The Store
      // sits directly under Financials (owner, same day).
      { icon: CreditCard, label: 'Financials', href: `/manage/${slug}/financials`, external: false, badge: badges.financials + badges.financialAid },
      { icon: Store,      label: 'Store',      href: `/manage/${slug}/store`,      external: false, badge: 0 },
    ],
  },
  // POST CONFERENCE / Awards used to sit here. Awards are now a tab inside
  // Settings and that tab is a "coming soon" holding screen, so there is no
  // destination worth a rail entry. /manage/[slug]/awards still exists and
  // redirects to Settings → Awards, so old bookmarks do not 404. Restore this
  // group (and the Trophy import) when the feature comes back.
  {
    header: 'SETTINGS',
    items: [
      { icon: Settings,  label: 'Settings',  href: `/manage/${slug}/settings`, external: false, badge: badges.settings, fixes: true },
      { icon: Briefcase, label: 'Job Board', href: `/manage/${slug}/jobs`,     external: false, badge: 0 },
      { icon: Upload,    label: 'Import',    href: `/manage/${slug}/import`,   external: false, badge: 0 },
    ],
  },
];


// ── Status pill styles (shared by rail + mobile drawer) ───────────────────
// More vibrant than the old muted greys: saturated tints on translucent bases
// with matching borders, so state reads at a glance.

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  private:  { bg: 'rgba(184,132,74,0.14)', color: '#9A6B2F', border: 'rgba(184,132,74,0.4)',  dot: '#B8844A' },
  public:   { bg: 'rgba(61,122,82,0.16)',  color: '#2A5A3C', border: 'rgba(61,122,82,0.42)',  dot: '#3D7A52' },
};

// ── Desktop floating rail ──────────────────────────────────────────────────
// Collapsed: a slim glass pill of floating icons, each perfectly centred on
// the pill's vertical axis. Expands on hover to reveal the conference
// identity ("ACRONYM YEAR"), section headers and labels, content keeps the
// reclaimed horizontal space.

function SideRail({
  slug,
  conference,
  pathname,
  badges = NO_BADGES,
  sealTitle,
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
  badges?: NavBadges;
  sealTitle: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sections = NAV_SECTIONS(slug, badges);
  const statusStyle = STATUS_STYLES[conference?.status ?? 'private'] ?? STATUS_STYLES.private;
  const year = conference?.start_date ? Number(conference.start_date.slice(0, 4)) : null;

  return (
    <aside
      className="hidden md:flex flex-col fixed"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        left: '14px', top: '70px', bottom: '14px',
        width: expanded ? '256px' : '68px',
        zIndex: 25,
        // Same ivory family as the page (#EDE7D8), raised by the NEU elevation
        // token (src/components/neu.tsx): hairline ring + soft forest drop.
        backgroundColor: '#F0EBDD',
        borderRadius: '26px',
        boxShadow: NEU.out,
        transition: 'width 280ms cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
      }}
    >
      {/* Conference identity, links to the public conference page */}
      <div
        className="flex-shrink-0"
        style={{
          // The same vertical padding open or closed (owner, 16 Oct 2026: the
          // rail must not get taller when it opens); only the sides change.
          padding: expanded ? '14px 16px' : '14px 0',
          borderBottom: '1px solid rgba(221,212,192,0.65)',
          transition: 'padding 280ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <Link
          href={`/conferences/${slug}`}
          title="View public page"
          className="flex items-center"
          style={{
            gap: expanded ? '12px' : '0px',
            justifyContent: expanded ? 'flex-start' : 'center',
            textDecoration: 'none',
            transition: 'gap 280ms cubic-bezier(0.22,1,0.36,1), opacity 150ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.72'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <LogoDisc
            src={conference?.logo_url}
            alt={conference?.acronym}
            size={40}
            fallbackText={(conference?.acronym ?? '?').slice(0, 2)}
          />
          <div
            className="min-w-0"
            style={{
              maxWidth: expanded ? '170px' : '0px',
              opacity: expanded ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-width 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease 60ms',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif", lineHeight: 1.2 }}>
              {conference ? conferenceAcronymLabel({ acronym: conference.acronym, year }) : '…'}
              {conference && <VerifiedCheck verified={conference.is_verified} showUnverified size={16} title={sealTitle} />}
            </span>
            {conference && (
              <span
                className="block"
                style={{
                  fontSize: '12px', fontWeight: 600, color: '#7A6E5E',
                  fontFamily: "var(--font-brand), sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.3, marginTop: '1px',
                }}
              >
                {formatConferenceDates(conference.start_date, conference.end_date, { style: 'dmy-end-year-spaced', fallback: 'Dates TBD' })}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '8px 12px', scrollbarWidth: 'none' }}>
        {sections.map((section, si) => (
          <div
            key={si}
            style={si > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)', marginTop: '7px', paddingTop: '5px' } : undefined}
          >
            {section.header && (
              <p
                style={{
                  fontFamily: "var(--font-brand), sans-serif",
                  fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em',
                  color: '#9A6E14',
                  padding: '5px 10px 3px',
                  margin: 0,
                  // Always 24px tall, only faded out when closed, so opening
                  // the rail never pushes the icons down.
                  height: '24px', boxSizing: 'border-box',
                  opacity: expanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'opacity 200ms ease 60ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {section.header}
              </p>
            )}
            {section.items.map(item => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  title={expanded ? undefined : item.label}
                  className="flex items-center rounded-xl transition-colors"
                  style={{
                    gap: expanded ? '12px' : '0px',
                    padding: '0 11px',
                    height: '42px', boxSizing: 'border-box',
                    margin: '2px 0',
                    justifyContent: expanded ? 'flex-start' : 'center',
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#7A6E5E',
                    textDecoration: 'none',
                    boxShadow: active ? '0 4px 14px rgba(27,56,40,0.28)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)';
                      (e.currentTarget as HTMLElement).style.color = '#1C1410';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#7A6E5E';
                    }
                  }}
                >
                  <span className="relative flex-shrink-0" style={{ lineHeight: 0 }}>
                    <Icon size={19} strokeWidth={2} />
                    {item.badge > 0 && (
                      <span
                        aria-label={item.fixes ? fixLabel(item.badge) : `${item.badge} needing attention`}
                        className="absolute rounded-full"
                        style={{ top: -3, right: -4, width: 8, height: 8, backgroundColor: '#B6871F', border: '1.5px solid #FAF8F3' }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-brand), sans-serif",
                      fontSize: '14.5px', fontWeight: 600,
                      whiteSpace: 'nowrap',
                      maxWidth: expanded ? '165px' : '0px',
                      opacity: expanded ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-width 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease 60ms',
                    }}
                  >
                    {item.label}
                  </span>
                  {expanded && item.badge > 0 && (
                    <span
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        minWidth: 20, height: 20, padding: '0 6px', fontSize: 12, fontWeight: 700,
                        fontFamily: "var(--font-brand), sans-serif", fontVariantNumeric: 'tabular-nums',
                        backgroundColor: active ? '#EED98A' : 'rgba(182,135,31,0.16)',
                        color: active ? '#1B3828' : '#8A6614',
                      }}
                      aria-label={item.fixes ? fixLabel(item.badge) : undefined}
                    >
                      {item.fixes ? fixBadgeText(item.badge) : item.badge}
                    </span>
                  )}
                  {expanded && item.tag && (
                    <span
                      className="flex-shrink-0 inline-flex items-center gap-1"
                      style={{
                        marginLeft: 'auto', fontSize: 12, fontWeight: 700,
                        lineHeight: 1.2, whiteSpace: 'nowrap',
                        fontFamily: "var(--font-brand), sans-serif",
                        color: active ? '#EED98A' : '#8A6614',
                      }}
                    >
                      <Clock size={13} strokeWidth={2.2} aria-hidden />
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer: status */}
      {conference && (
        <div
          className="flex-shrink-0 flex items-center"
          style={{
            padding: expanded ? '12px 16px' : '12px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            borderTop: '1px solid rgba(221,212,192,0.65)',
            transition: 'padding 280ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              gap: expanded ? '6px' : '0px',
              backgroundColor: statusStyle.bg,
              border: `1px solid ${statusStyle.border}`,
              color: statusStyle.color,
              height: '20px', boxSizing: 'border-box',
              padding: expanded ? '0 10px' : '0 6px',
              fontFamily: "var(--font-brand), sans-serif",
              fontSize: '9.5px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: statusStyle.dot, flexShrink: 0 }} />
            <span
              style={{
                maxWidth: expanded ? '90px' : '0px',
                opacity: expanded ? 1 : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'max-width 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease 60ms',
              }}
            >
              {conference.status}
            </span>
          </span>
        </div>
      )}
    </aside>
  );
}

// ── Sidebar content ────────────────────────────────────────────────────────

function SidebarContent({
  slug,
  conference,
  pathname,
  onNavClick,
  badges = NO_BADGES,
  sealTitle,
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
  onNavClick?: () => void;
  badges?: NavBadges;
  sealTitle: string;
}) {
  const sections = NAV_SECTIONS(slug, badges);

  const statusStyle = STATUS_STYLES[conference?.status ?? 'private'] ?? STATUS_STYLES.private;
  const year = conference?.start_date ? Number(conference.start_date.slice(0, 4)) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Conference identity, links to the public conference page */}
      <Link
        href={`/conferences/${slug}`}
        title="View public page"
        onClick={onNavClick}
        className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 transition-opacity"
        style={{ borderBottom: '1px solid #DDD4C0', textDecoration: 'none' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.72'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        <LogoDisc
          src={conference?.logo_url}
          alt={conference?.acronym}
          size={36}
          fallbackText={(conference?.acronym ?? '?').slice(0, 2)}
        />
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 min-w-0 text-sm font-extrabold" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif", lineHeight: 1.2 }}>
            <span className="min-w-0 [overflow-wrap:anywhere]">{conference ? conferenceAcronymLabel({ acronym: conference.acronym, year }) : '…'}</span>
            {conference && <VerifiedCheck verified={conference.is_verified} showUnverified size={16} title={sealTitle} />}
          </span>
          {conference && (
            <span
              className="block"
              style={{
                fontSize: '10.5px', fontWeight: 600, color: '#9A8A78',
                fontFamily: "var(--font-brand), sans-serif",
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.3, marginTop: '1px',
              }}
            >
              {formatConferenceDates(conference.start_date, conference.end_date, { style: 'dmy-end-year-spaced', fallback: 'Dates TBD' })}
            </span>
          )}
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={si}>
            {section.header && (
              <p
                className="px-4 pt-4 pb-1 text-[12px] tracking-[0.12em] font-extrabold"
                style={{ color: '#9A6E14', fontFamily: "var(--font-brand), sans-serif" }}
              >
                {section.header}
              </p>
            )}
            {section.items.map(item => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={onNavClick}
                  className="flex items-center gap-3 px-4 py-3 text-[15px] font-semibold transition-colors"
                  style={{
                    borderLeft: active ? '3px solid #1B3828' : '3px solid transparent',
                    backgroundColor: active ? 'rgba(27,56,40,0.08)' : 'transparent',
                    color: active ? '#1B3828' : '#9A8A78',
                    textDecoration: 'none',
                    display: 'flex',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)';
                      (e.currentTarget as HTMLElement).style.color = '#1C1410';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#9A8A78';
                    }
                  }}
                >
                  <Icon size={19} style={{ flexShrink: 0 }} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        minWidth: 21, height: 21, padding: '0 6px', fontSize: 12, fontWeight: 700,
                        fontFamily: "var(--font-brand), sans-serif", fontVariantNumeric: 'tabular-nums',
                        backgroundColor: 'rgba(182,135,31,0.16)', color: '#8A6614',
                      }}
                      aria-label={item.fixes ? fixLabel(item.badge) : undefined}
                    >
                      {item.fixes ? fixBadgeText(item.badge) : item.badge}
                    </span>
                  )}
                  {item.tag && (
                    <span
                      className="flex-shrink-0 inline-flex items-center gap-1"
                      style={{
                        fontSize: 12, fontWeight: 700,
                        lineHeight: 1.2, whiteSpace: 'nowrap',
                        fontFamily: "var(--font-brand), sans-serif",
                        color: '#8A6614',
                      }}
                    >
                      <Clock size={13} strokeWidth={2.2} aria-hidden />
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar footer */}
      {conference && (
        <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
          <p
            className="text-xs mb-1.5 [overflow-wrap:anywhere]"
            style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}
          >
            {conference.full_name}
          </p>
          <span
            className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              fontFamily: "var(--font-brand), sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {conference.status}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { user, session, signOut, loading: authLoading } = useAuth();
  /** The two stable primitives the inbox badge keys on. AuthProvider replaces
   *  the session OBJECT on every auth event (token refresh, tab focus), so
   *  depending on it would refetch the badge on each of those; the token is a
   *  string and only changes when it really changes — including the first time
   *  it arrives, which is the transition an auth-guarded loader has to catch.
   *  `conference` is likewise an object a background refresh can swap for an
   *  equal-but-new one, so the id is what belongs in the dep array. */
  const accessToken = session?.access_token;
  /** The session and user as of the latest render, read by the loaders below
   *  at CALL time so their identities (and the context value built from them)
   *  never change because a token was refreshed (11 Oct 2026). getAuthedClient
   *  always sends the SDK's current token anyway (supabase-auth.ts). */
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const userRef = useRef(user);
  userRef.current = user;
  /** The account and slug (`user|slug`) whose conference is on screen. Only the FIRST load of a slug
   *  shows the full-screen loader; every later re-read (a token refresh, a
   *  consumer's refreshConference after a save) swaps the data in place.
   *  It used to unmount the whole console behind the loader and draw it
   *  again, which is the "weird reload" the owner kept seeing. */
  const shownSlugRef = useRef<string | null>(null);
  const [conference, setConference] = useState<Conference | null>(null);
  const conferenceId = conference?.id;
  const [loadingConf, setLoadingConf] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  /** The conference read failed (as opposed to came back empty). Keeps the
   *  organiser on their own URL with a Try again button instead of silently
   *  evicting them to the homepage over a dropped request. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // The mobile nav drawer is a modal surface — the page behind it must not
  // scroll while it is open (this is the phone case, so iOS matters).
  useScrollLock(mobileMenuOpen);
  const [inboxBadge, setInboxBadge] = useState(0);
  /** The other three rail badges: applications nobody has decided on, accepted
   *  delegates with no committee yet, pending financial aid requests. Their own
   *  state, refreshed on navigation, so a stale count never outlives the page
   *  the organiser just cleared. */
  const [workBadges, setWorkBadges] = useState({ applications: 0, assignment: 0, financialAid: 0, financials: 0, settings: 0 });

  // Nav badge: threads WAITING ON A REPLY (waitingOnReply.ts, the same
  // definition the Communications inbox rows use). Open, not a swap notice,
  // and the newest message is from the participant side. Opening a thread
  // does not clear it; answering (or closing) it does.
  const loadInboxBadge = useCallback(async () => {
    if (!conferenceId || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const { data: reqData } = await supabase
      .from('conference_requests')
      .select('id, status, kind')
      .eq('conference_id', conferenceId)
      .neq('status', 'closed');
    const requests = (reqData ?? []) as { id: string; status: string; kind: string }[];
    if (requests.length === 0) { setInboxBadge(0); return; }

    const { data: msgData } = await supabase
      .from('conference_request_messages')
      .select('request_id, is_organizer, created_at')
      .in('request_id', requests.map(r => r.id));
    const byRequest = new Map<string, { is_organizer: boolean; created_at: string }[]>();
    for (const m of (msgData ?? []) as { request_id: string; is_organizer: boolean; created_at: string }[]) {
      const list = byRequest.get(m.request_id) ?? [];
      list.push(m);
      byRequest.set(m.request_id, list);
    }
    setInboxBadge(requests.filter(r => waitingSince(r, byRequest.get(r.id) ?? []) !== null).length);
  }, [conferenceId, accessToken]);

  useEffect(() => { loadInboxBadge(); }, [loadInboxBadge, pathname]);

  // ── The other unhandled-work counts ───────────────────────────────────────
  // Three head-only counts, so nothing but a number crosses the wire and no
  // applicant detail is loaded to render a dot.
  //
  //  • Applications: `status = 'submitted'` is exactly "waiting on a decision".
  //  • Assignment: `status = 'accepted'` and nothing further. Allocating an
  //    application moves it to 'assigned' (and check-in to 'checked-in'), so
  //    'accepted' alone IS the unallocated set — the same definition the
  //    dashboard's Unallocated tile draws, kept deliberately in step with it.
  //    Only the roles that take a committee seat, and never someone marked
  //    not attending.
  //  • Financial aid: requests still 'pending' review.
  //
  // `pathname` is a dependency on purpose: the counts are what the organiser
  // just went and cleared, so they refresh as they move between sections.
  const loadWorkBadges = useCallback(async () => {
    if (!conferenceId || !accessToken) return;
    const supabase = getAuthedClient(accessToken);
    const [pendingApps, unallocated, pendingAid, moneyTodo, roleRows, awardsWaiting] = await Promise.all([
      supabase.from('applications').select('id', { count: 'exact', head: true })
        .eq('conference_id', conferenceId).eq('status', 'submitted'),
      supabase.from('applications').select('id', { count: 'exact', head: true })
        .eq('conference_id', conferenceId).eq('status', 'accepted')
        .in('role', ['delegate', 'head-delegate']).eq('attending', true),
      supabase.from('financial_aid_requests').select('id', { count: 'exact', head: true })
        .eq('conference_id', conferenceId).eq('status', 'pending'),
      // Financials: proofs waiting plus open money to-dos (1 Oct 2026).
      supabase.rpc('money_things_to_do_count', { p_conference_id: conferenceId }),
      // Settings: role set-ups that need fixing (roleSetupProblems, 13 Oct 2026).
      supabase.from('application_role_configs')
        .select('role, is_enabled, applications_open_at, applications_close_at, fee_phases')
        .eq('conference_id', conferenceId),
      // Settings: award slates the chairs sent for approval (13 Oct 2026).
      loadAwardsWaiting(supabase, conferenceId).catch(() => 0),
    ]);
    // Roles taken off with "Remove this role" on this browser are not listed.
    let removedRoles: string[] = [];
    try {
      const raw = window.localStorage.getItem(`gavelling-settings-removed-roles:${conferenceId}`);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) removedRoles = parsed.filter((r): r is string => typeof r === 'string');
    } catch { /* storage blocked: count every role */ }
    // A failed read leaves that badge at zero rather than inventing a number.
    setWorkBadges({
      applications: pendingApps.count ?? 0,
      assignment: unallocated.count ?? 0,
      financialAid: pendingAid.count ?? 0,
      financials: !moneyTodo.error && typeof moneyTodo.data === 'number' ? moneyTodo.data : 0,
      settings: (!roleRows.error && roleRows.data ? listedProblemCount(roleRows.data, removedRoles) : 0) + awardsWaiting,
    });
  }, [conferenceId, accessToken]);

  useEffect(() => { loadWorkBadges(); }, [loadWorkBadges, pathname]);

  const navBadges = useMemo(
    () => ({ ...workBadges, communications: inboxBadge }),
    [workBadges, inboxBadge],
  );

  // The communications page marks threads read locally (optimistic state,
  // its own component tree) — this sidebar badge lives in the layout above
  // it and only ever loaded once on mount, so it needs an explicit nudge to
  // refetch whenever a mark (single open or MARK ALL READ) actually lands.
  useEffect(() => {
    function onInboxReadChanged() { loadInboxBadge(); }
    window.addEventListener('gv-inbox-read-changed', onInboxReadChanged);
    return () => window.removeEventListener('gv-inbox-read-changed', onInboxReadChanged);
  }, [loadInboxBadge]);

  // Every role save on Settings nudges the rail (the Settings count).
  useEffect(() => {
    function onFlagsChanged() { void loadWorkBadges(); }
    window.addEventListener(SETTINGS_FLAGS_EVENT, onFlagsChanged);
    return () => window.removeEventListener(SETTINGS_FLAGS_EVENT, onFlagsChanged);
  }, [loadWorkBadges]);

  // The Financials Things to do pop-up nudges the rail after each action.
  useEffect(() => {
    function onMoneyTodoChanged() { void loadWorkBadges(); }
    window.addEventListener('gv-financials-todo-changed', onMoneyTodoChanged);
    return () => window.removeEventListener('gv-financials-todo-changed', onMoneyTodoChanged);
  }, [loadWorkBadges]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=/manage/${slug}`);
    }
  }, [authLoading, user, router, slug]);

  // Stable identity across renders (useCallback), so the memoised context
  // value below only changes when it genuinely should, never on every
  // layout render, that's what let a background refresh cascade into
  // re-running every consumer's effects.
  const loadConference = useCallback(async () => {
    const session = sessionRef.current;
    const user = userRef.current;
    if (!session || !user) return;
    // A conference already on screen for this slug stays there while it is
    // read again; only a first load (or another slug) shows the loader.
    const quiet = shownSlugRef.current === `${user.id}|${slug}`;
    if (!quiet) setLoadingConf(true);
    const supabase = getAuthedClient(session.access_token);

    const { data: confData, error: confError } = await supabase
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('slug', slug)
      .single();

    // `data` is null for BOTH "no such conference" and "the request failed",
    // and this used to redirect to the homepage on either. That threw an
    // organiser out of the console mid-work over a dropped request, an
    // expired token (getAuthedClient pins the token from React state and
    // never refreshes it) or a transient 5xx, with nothing on screen to say
    // why. Only a real zero-row answer means the conference is not there.
    // PGRST116 is PostgREST's "0 rows for .single()"; anything else is a
    // failure we must show, not navigate away from.
    if (confError && confError.code !== 'PGRST116') {
      // A re-read that failed is not a verdict: keep the console on screen.
      if (!quiet) setLoadFailed(true);
      setLoadingConf(false);
      return;
    }
    if (!confData) {
      router.replace('/');
      return;
    }
    setLoadFailed(false);

    // Ownership check: organizer_id on the conference OR an owner row in
    // conference_organizers (isConferenceOwner, the client twin of
    // is_conference_owner()). The row is read below when the creator check fails.
    const confRow = confData as unknown as { id: string; organizer_id: string | null } & Record<string, unknown>;
    const owner = isConferenceOwner(user!.id, confRow.organizer_id, null);
    setIsOwner(owner);
    if (!owner) {
      const { data: orgRow } = await supabase
        .from('conference_organizers')
        .select('user_id, role, permissions')
        .eq('user_id', user!.id)
        .eq('conference_id', confRow.id)
        .maybeSingle();
      if (!orgRow) {
        // Gavelling staff can open any conference's dashboard. The real gate is
        // is_conference_organizer() in the database, which already returns true
        // for platform admins — this only stops the UI denying them first.
        const { data: staff } = await supabase.rpc('is_platform_admin');
        if (staff !== true) {
          setAccessDenied(true);
          setLoadingConf(false);
          return;
        }
        // Staff are treated as owners: sectionBlocked keys off !isOwner, so this
        // opens every section. There is no organizer row to read permissions
        // from — reading one here is what previously threw and blanked the page.
        setIsOwner(true);
      } else {
        // A co-owner row (role 'owner') is an owner, exactly as
        // is_conference_owner() says in the database. Its permissions are
        // usually '{}', so reading them as a section list locked a co-owner
        // out of every section but the dashboard.
        if (isConferenceOwner(user!.id, confRow.organizer_id, (orgRow as { role?: string | null }).role ?? null)) setIsOwner(true);
        setPermissions((orgRow.permissions ?? {}) as Record<string, boolean>);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizer_id: _oid, ...conf } = confData as unknown as { organizer_id?: unknown } & Record<string, unknown>;
    setConference(conf as unknown as Conference);
    shownSlugRef.current = `${user!.id}|${slug}`;
    setLoadingConf(false);
  }, [slug, router]);

  const refreshConference = useCallback(async () => {
    if (!userRef.current) return;
    await loadConference();
  }, [loadConference]);

  // Quiet variant: re-fetches the conference row and swaps it in directly,
  // without touching loadingConf, so settings saves can confirm DB truth
  // post-write without unmounting the page behind the full-screen spinner.
  const refreshConferenceQuiet = useCallback(async () => {
    const session = sessionRef.current;
    if (!userRef.current || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: confData } = await supabase
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('slug', slug)
      .single();
    if (!confData) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizer_id: _oid, ...conf } = confData as unknown as { organizer_id?: unknown } & Record<string, unknown>;
    setConference(conf as unknown as Conference);
  }, [slug]);

  // ── Verification (the blue checkmark) ──────────────────────────────────
  // What is left is read once per conference from conference_setup_status().
  // The stored mark itself is only ever recomputed by the database
  // (refresh_conference_verification), which the dashboard asks for whenever
  // its checklist moves. `conferenceId` is the one declared beside `conference`.
  const conferenceVerified = conference?.is_verified ?? false;
  const [verificationState, setVerificationState] = useState<VerificationStatus | null>(null);

  const loadVerification = useCallback(async (id: string) => {
    const session = sessionRef.current;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('conference_setup_status', { p_conference_id: id });
    const status = data as { verification_minutes_left?: number | null; verification_pending?: string[] | null } | null;
    if (!status || typeof status !== 'object') return;
    setVerificationState({
      minutesLeft: Math.max(0, Math.round(Number(status.verification_minutes_left ?? 0))),
      pending: Array.isArray(status.verification_pending) ? status.verification_pending : [],
    });
  }, []);

  useEffect(() => {
    if (!conferenceId || conferenceVerified) return;
    loadVerification(conferenceId);
  }, [conferenceId, conferenceVerified, loadVerification]);

  const refreshVerification = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !conferenceId) return;
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('refresh_conference_verification', { p_conference: conferenceId });
    if (error || typeof data !== 'boolean') return;
    if (data !== conferenceVerified) await refreshConferenceQuiet();
    if (!data) await loadVerification(conferenceId);
  }, [conferenceId, conferenceVerified, refreshConferenceQuiet, loadVerification]);

  // Verified means nothing is pending: consumers never see stale minutes.
  const verification = conferenceVerified ? null : verificationState;
  const sealTitle = conferenceVerified
    ? 'Verified conference'
    : verification ? minutesToCheckmarkLabel(verification.minutesLeft) : 'Not verified yet';

  // Fetch conference + ownership gate
  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    loadConference();
  // Keyed on the user id, never the token: a token refresh is not a reason
  // to read the conference again (see shownSlugRef).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug]);

  // Memoised so consumers (useManage()) only see a new context value when
  // the conference data or the (now-stable, useCallback'd) refresh functions
  // actually change, not on every layout render. Declared before the early
  // returns below, hooks can't run conditionally.
  // Owners and platform admins (isOwner is set true for staff above) are never
  // read-only; everyone else takes it from their stored bundle.
  const financialsReadOnly = !isOwner && financialsAreReadOnly(permissions);

  const manageContextValue = useMemo(
    () => ({ conference, financialsReadOnly, refreshConference, refreshConferenceQuiet, verification, refreshVerification }),
    [conference, financialsReadOnly, refreshConference, refreshConferenceQuiet, verification, refreshVerification]
  );

  // Loading state
  if (authLoading || (user && loadingConf)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <Loader size={72} label="Loading conference console" />
      </div>
    );
  }

  if (!user) return null;

  // The read failed rather than came back empty. Stay on this URL and offer a
  // retry: this is the difference between "your conference is gone" and "that
  // one request did not land", and only one of those is worth throwing an
  // organiser out of the console for.
  if (loadFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-md w-full text-center rounded-2xl p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p style={{ fontSize: 10, color: '#B8844A', fontFamily: "var(--font-brand), sans-serif", letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
            COULD NOT LOAD
          </p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
            We Could Not Load This Conference
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
            The connection dropped or your session went stale. Your conference is safe. Try again, and if it keeps happening, sign out and back in.
          </p>
          <button
            onClick={() => { setLoadFailed(false); void loadConference(); }}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "var(--font-brand), sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-md w-full text-center rounded-2xl p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p style={{ fontSize: 10, color: '#B8844A', fontFamily: "var(--font-brand), sans-serif", letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
            ACCESS DENIED
          </p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
            You Don&apos;t Have Access to Manage This Conference
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
            You&apos;re not listed as an organizer of this conference. If you think this is a mistake, contact the conference&apos;s owner.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "var(--font-brand), sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  const SECTION_PERMS: Record<string, string> = {
    committees: 'committees', applications: 'applications', import: 'import', assignment: 'assignment',
    documents: 'documents',
    // The scoreboard is no longer a nav section, but the route is still
    // reachable by URL — so its permission mapping MUST stay. Deleting it would
    // turn a URL that used to be gated into one any organiser could open,
    // which is the opposite of removing a tab. It reuses the Committees key
    // because it is that section's live-session performance data.
    scoreboard: 'committees',
    // Awards are the closing act of the committees' work (chair slates,
    // scoreboard evidence), so they sit under the same permission key.
    awards: 'committees',
    communications: 'email_builder', financials: 'financials',
    'financial-aid': 'financials',
    settings: 'settings', jobs: 'job_board',
    store: 'store',
  };
  const currentSegment = pathname.split('/')[3] ?? '';
  const sectionKey = SECTION_PERMS[currentSegment];
  // The Store is also open to `team` holders, as can_use_store() is in the
  // database, so a super admin saved before the Store existed keeps it.
  const sectionBlocked = !!conference && !isOwner && !!sectionKey && permissions[sectionKey] !== true
    && !(sectionKey === 'store' && permissions.team === true);

  if (sectionBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-md w-full text-center rounded-2xl p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p style={{ fontSize: 10, color: '#B8844A', fontFamily: "var(--font-brand), sans-serif", letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
            SECTION RESTRICTED
          </p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
            You Don&apos;t Have Access to This Section
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
            Your organizer role for this conference doesn&apos;t include this section. Ask the conference owner to grant it.
          </p>
          <button
            onClick={() => router.push(`/manage/${slug}`)}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "var(--font-brand), sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <ManageContext.Provider value={manageContextValue}>
      {/* Base surface, one continuous ivory behind rail + content (body is white;
          without this the strip behind the rail reads as a different background) */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundColor: '#EDE7D8' }} />

      {/* The organiser-side notification host — the SAME stack and the same store
          the live committee session uses (`@/lib/sessionNotifications`), which is
          headless and has never been coupled to a committee. Exactly ONE host may
          be mounted per surface: it owns the single interval that advances every
          TTL, so a second one would run every countdown at double speed. This is
          that one for all of /manage.

          `topPx` clears this layout's 56px top bar (the chair cockpit's is 44px,
          which is the component default). Portaled to `document.body` — there is
          no `#fit-root` here — so no ancestor `overflow` can clip it. */}
      <NotificationStack topPx={64} />

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6"
        style={{ height: '56px', backgroundColor: '#1B3828', borderBottom: '1px solid rgba(61,122,82,0.3)' }}
      >
        {/* Left: logo + divider + acronym */}
        <div className="flex min-w-0 items-center gap-3">
          {/* The ONE wordmark (src/components/BrandLogo.tsx), in white on the
              dark /manage chrome; the same mark the site header and footer use.
              Below sm the ~134px lockup pushed the menu button off a phone
              screen, so phones get the gavel mark alone (public/README.md). */}
          <span className="hidden sm:inline-flex">
            <BrandLogo height={26} tone="white" priority />
          </span>
          <Link
            href="/"
            aria-label="Gavelling home"
            className="inline-flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] sm:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gavel-mark.png" alt="Gavelling" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
          </Link>
          <span className="shrink-0" style={{ color: 'rgba(238,217,138,0.3)', fontSize: '16px' }}>/</span>
          <Link
            href={`/manage/${slug}`}
            className="min-w-0 text-sm font-bold leading-tight transition-opacity focus:outline-none inline-flex items-center gap-1.5"
            style={{ color: '#EED98A', fontFamily: "var(--font-brand), sans-serif", letterSpacing: '0.03em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {/* Wraps to two rows on a narrow phone, never an ellipsis (CLAUDE.md §8). */}
            <span className="min-w-0 [overflow-wrap:anywhere]">{conference ? conferenceAcronymLabel(conference) : '...'}</span>
            {conference && <span className="inline-flex shrink-0"><VerifiedCheck verified={conference.is_verified} showUnverified size={16} title={sealTitle} /></span>}
          </Link>
          {/* View page sits beside the acronym (prompt 106). Hidden on phones,
              where it lives in the menu, so it can never squeeze the acronym. */}
          <Link
            href={`/conferences/${slug}`}
            className="text-xs font-semibold hidden sm:inline-flex items-center gap-1 shrink-0 transition-colors focus:outline-none focus-visible:underline"
            style={{ color: 'rgba(238,217,138,0.7)', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.7)'; }}
          >
            View page <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Right: status pill + Publish / Unpublish (prompt 106) + avatar. On
            phones the pill and the button move into the menu (390px has room
            for the acronym, the avatar and the menu button only). */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {conference && (
            <span className="hidden sm:inline-flex">
              <PublishControls conference={conference} onChanged={refreshConferenceQuiet} />
            </span>
          )}

          {/* Shared account menu (same hover-open dropdown as SiteNav) */}
          <ProfileAvatarMenu size={44} tone="dark" panelStyle={{ zIndex: 60 }} />

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            style={{ color: '#EED98A' }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Desktop floating rail, icons only, expands on hover */}
      <SideRail slug={slug} conference={conference} pathname={pathname} badges={navBadges} sealTitle={sealTitle} />

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 flex flex-col"
            style={{ width: '280px', backgroundColor: '#F0EBDD', boxShadow: '8px 0 28px rgba(27,56,40,0.22)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto">
              {/* Phones: the status, Publish / Unpublish and View page live here (prompt 106). */}
              {conference && (
                <div className="sm:hidden flex flex-col gap-3 px-5 pt-5 pb-1">
                  <PublishControls conference={conference} onChanged={refreshConferenceQuiet} light />
                  <Link
                    href={`/conferences/${slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-bold focus:outline-none focus-visible:underline"
                    style={{ color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    View page →
                  </Link>
                </div>
              )}
              <SidebarContent
                slug={slug}
                conference={conference}
                pathname={pathname}
                onNavClick={() => setMobileMenuOpen(false)}
                badges={navBadges}
                sealTitle={sealTitle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content, rail is 68px + 14px inset, so content reclaims the old sidebar width.
          The header offset is PADDING, not margin: a 56px top margin here collapsed
          through <body> (no border / padding), so body (min-height 100%) started at
          56px and every manage page scrolled by 56px, dashboard included. */}
      <div
        className="relative z-10 md:ml-[96px]"
        style={{ paddingTop: '56px', minHeight: '100vh', backgroundColor: '#EDE7D8' }}
      >
        {/* Read-only money banner. The ADMIN bundle opens every financial page
            in full and can change none of it; saying that up front beats a
            button that silently fails. */}
        {financialsReadOnly && (currentSegment === 'financials' || currentSegment === 'financial-aid') && (
          <div className="px-4 sm:px-6 md:px-10 pt-6">
            <p
              role="status"
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                color: '#7A5A10', backgroundColor: 'rgba(182,135,31,0.12)',
                border: '1px solid rgba(182,135,31,0.32)', fontFamily: "var(--font-brand), sans-serif",
                lineHeight: 1.5, textWrap: 'pretty', maxWidth: 1080,
              }}
            >
              <strong style={{ fontWeight: 800 }}>View only.</strong>{' '}
              Your organizer role can see every financial detail here but cannot change any of
              them: fees, add-ons, vouchers, payout settings and invoice status are all locked.
            </p>
          </div>
        )}
        {children}
      </div>
    </ManageContext.Provider>
  );
}
