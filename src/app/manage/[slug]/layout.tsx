'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, MapPin, FileText,
  Mail, CreditCard, Settings, Briefcase, Menu, X, Radio, Upload, HeartHandshake,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { LogoDisc } from '@/components/LogoDisc';
import ProfileDropdown from '@/components/ProfileDropdown';
import type { EmailTheme } from '@/lib/emailHtml';

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
  payment_gate_exempt: boolean;
  predecessor_conference_id: string | null;
  predecessor_approved: boolean;
  min_age: number | null;
  allocation_swap_mode: string;
  email_theme: EmailTheme;
  financial_aid_enabled: boolean;
  aid_questions: unknown[];
  aid_intro: string | null;
}

// ── Context ────────────────────────────────────────────────────────────────

interface ManageContextType {
  conference: Conference | null;
  refreshConference: () => Promise<void>;
  /** Re-fetches the conference row and updates context state, without the
   *  full-screen loading flag `refreshConference` flips (which unmounts the
   *  page). Use this after a settings save to confirm DB truth in place. */
  refreshConferenceQuiet: () => Promise<void>;
}

const ManageContext = createContext<ManageContextType>({
  conference: null,
  refreshConference: async () => {},
  refreshConferenceQuiet: async () => {},
});

export function useManage() {
  return useContext(ManageContext);
}

const CONFERENCE_COLUMNS = [
  'id', 'slug', 'full_name', 'acronym', 'is_public', 'status',
  'logo_url', 'banner_url', 'start_date', 'end_date', 'dates_tbd', 'country', 'city',
  'format', 'expected_delegates', 'fee_amount', 'fee_currency',
  'contact_email', 'student_level', 'description',
  'instagram_url', 'facebook_url', 'tiktok_url', 'whatsapp_url', 'website_url',
  'stripe_account_id', 'connect_onboarding_status', 'payout_country', 'payment_method',
  'external_payment_url', 'external_payment_note', 'payment_gate_exempt', 'organizer_id',
  'predecessor_conference_id', 'predecessor_approved', 'min_age',
  'allocation_swap_mode', 'email_theme',
  'financial_aid_enabled', 'aid_questions', 'aid_intro',
].join(', ');

// ── Nav definition ─────────────────────────────────────────────────────────

const NAV_SECTIONS = (slug: string, communicationsBadge = 0) => [
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
      { icon: Users,     label: 'Applications', href: `/manage/${slug}/applications`, external: false, badge: 0 },
      { icon: MapPin,    label: 'Assignment',   href: `/manage/${slug}/assignment`,   external: false, badge: 0 },
      { icon: FileText,  label: 'Documents',    href: `/manage/${slug}/documents`,    external: false, badge: 0 },
    ],
  },
  {
    header: 'COMMUNICATE',
    items: [
      { icon: Mail, label: 'Email Builder', href: `/manage/${slug}/communications`, external: false, badge: communicationsBadge },
    ],
  },
  {
    header: 'FINANCIAL',
    items: [
      { icon: CreditCard,     label: 'Financials',    href: `/manage/${slug}/financials`,    external: false, badge: 0 },
      { icon: HeartHandshake, label: 'Financial Aid', href: `/manage/${slug}/financial-aid`, external: false, badge: 0 },
    ],
  },
  {
    header: 'SETTINGS',
    items: [
      { icon: Settings,  label: 'Settings',  href: `/manage/${slug}/settings`, external: false, badge: 0 },
      { icon: Briefcase, label: 'Job Board', href: `/manage/${slug}/jobs`,     external: false, badge: 0 },
      { icon: Upload,    label: 'Import',    href: `/manage/${slug}/import`,   external: false, badge: 0 },
    ],
  },
];

// ── Date range helper (mirrors communications page formatDateRange) ───────

function formatConfDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatConfDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  if (start === end) return formatConfDate(start);
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString('en-GB', { day: 'numeric' })} – ${formatConfDate(end)}`;
  }
  return `${formatConfDate(start)} – ${formatConfDate(end)}`;
}

// ── Status pill styles (shared by rail + mobile drawer) ───────────────────
// More vibrant than the old muted greys: saturated tints on translucent bases
// with matching borders, so state reads at a glance.

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  private:  { bg: 'rgba(184,132,74,0.14)', color: '#9A6B2F', border: 'rgba(184,132,74,0.4)',  dot: '#B8844A' },
  public:   { bg: 'rgba(61,122,82,0.16)',  color: '#2A5A3C', border: 'rgba(61,122,82,0.42)',  dot: '#3D7A52' },
  archived: { bg: 'rgba(28,20,16,0.08)',   color: '#6A5A4A', border: 'rgba(28,20,16,0.22)',   dot: '#9A8A78' },
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
  communicationsBadge = 0,
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
  communicationsBadge?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const sections = NAV_SECTIONS(slug, communicationsBadge);
  const statusStyle = STATUS_STYLES[conference?.status ?? 'private'] ?? STATUS_STYLES.private;
  const year = conference ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  return (
    <aside
      className="hidden md:flex flex-col fixed"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        left: '14px', top: '70px', bottom: '14px',
        width: expanded ? '256px' : '68px',
        zIndex: 25,
        // Neumorphic: same ivory family as the page (#EDE7D8), extruded via the
        // NEU dual-shadow pair (src/components/neu.tsx), no glass, no hard border.
        backgroundColor: '#F0EBDD',
        borderRadius: '26px',
        boxShadow: '-6px -6px 14px rgba(255,255,255,0.85), 8px 8px 20px rgba(27,56,40,0.16)',
        transition: 'width 280ms cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
      }}
    >
      {/* Conference identity, links to the public conference page */}
      <div
        className="flex-shrink-0"
        style={{
          padding: expanded ? '16px 16px 14px' : '14px 0',
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
            <span className="block text-[15px] font-extrabold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>
              {conference?.acronym ?? '…'}{year ? ` ${year}` : ''}
            </span>
            {conference && (
              <span
                className="block"
                style={{
                  fontSize: '10.5px', fontWeight: 600, color: '#9A8A78',
                  fontFamily: "'Outfit', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.3, marginTop: '1px',
                }}
              >
                {formatConfDateRange(conference.start_date, conference.end_date)}
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
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '9px', fontWeight: 800, letterSpacing: '0.16em',
                  color: '#B6871F',
                  padding: '4px 10px 3px',
                  margin: 0,
                  maxHeight: expanded ? '20px' : '0px',
                  opacity: expanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease 60ms',
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
                    gap: expanded ? '11px' : '0px',
                    padding: '9px 10px',
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
                    <Icon size={17} strokeWidth={2} />
                    {item.badge > 0 && (
                      <span
                        aria-label={`${item.badge} needing attention`}
                        className="absolute rounded-full"
                        style={{ top: -3, right: -4, width: 8, height: 8, backgroundColor: '#B6871F', border: '1.5px solid #FAF8F3' }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: '13px', fontWeight: 600,
                      whiteSpace: 'nowrap',
                      maxWidth: expanded ? '150px' : '0px',
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
                        minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 700,
                        fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums',
                        backgroundColor: active ? '#EED98A' : 'rgba(182,135,31,0.16)',
                        color: active ? '#1B3828' : '#8A6614',
                      }}
                    >
                      {item.badge}
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
              padding: expanded ? '3px 10px' : '5px',
              fontFamily: "'Outfit', sans-serif",
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
  communicationsBadge = 0,
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
  onNavClick?: () => void;
  communicationsBadge?: number;
}) {
  const sections = NAV_SECTIONS(slug, communicationsBadge);

  const statusStyle = STATUS_STYLES[conference?.status ?? 'private'] ?? STATUS_STYLES.private;
  const year = conference ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

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
          <span className="block text-sm font-extrabold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>
            {conference?.acronym ?? '…'}{year ? ` ${year}` : ''}
          </span>
          {conference && (
            <span
              className="block"
              style={{
                fontSize: '10.5px', fontWeight: 600, color: '#9A8A78',
                fontFamily: "'Outfit', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.3, marginTop: '1px',
              }}
            >
              {formatConfDateRange(conference.start_date, conference.end_date)}
            </span>
          )}
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={si}>
            {section.header && (
              <p
                className="px-4 pt-4 pb-1 text-[10px] tracking-[0.16em] font-extrabold"
                style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif" }}
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
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors"
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
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 700,
                        fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums',
                        backgroundColor: 'rgba(182,135,31,0.16)', color: '#8A6614',
                      }}
                    >
                      {item.badge}
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
            className="text-xs mb-1.5 truncate"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            {conference.full_name}
          </p>
          <span
            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              fontFamily: "'Outfit', sans-serif",
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

  const { user, session, profile, signOut, loading: authLoading } = useAuth();
  const [conference, setConference] = useState<Conference | null>(null);
  const [loadingConf, setLoadingConf] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inboxBadge, setInboxBadge] = useState(0);

  // Nav badge — same unread definition as the communications inbox
  // (unreadCountOf there): a thread counts as unread when it has a
  // participant-side message (is_organizer false) newer than
  // organizer_seen_at, or every message counts when that stamp is null.
  // Independent of `status` — a closed thread can still carry unread
  // messages. seen_by_organizer is a separate legacy flag (still read by
  // DelegationsView's unseen-society tracking) and is NOT this definition.
  const loadInboxBadge = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: reqData } = await supabase
      .from('conference_requests')
      .select('id, organizer_seen_at')
      .eq('conference_id', conference.id);
    const requests = (reqData ?? []) as { id: string; organizer_seen_at: string | null }[];
    if (requests.length === 0) { setInboxBadge(0); return; }

    const { data: msgData } = await supabase
      .from('conference_request_messages')
      .select('request_id, is_organizer, created_at')
      .in('request_id', requests.map(r => r.id))
      .eq('is_organizer', false);
    const messages = (msgData ?? []) as { request_id: string; is_organizer: boolean; created_at: string }[];

    const unreadCount = requests.filter(r =>
      messages.some(m => m.request_id === r.id && (!r.organizer_seen_at || m.created_at > r.organizer_seen_at))
    ).length;
    setInboxBadge(unreadCount);
  }, [conference?.id, session?.access_token]);

  useEffect(() => { loadInboxBadge(); }, [loadInboxBadge]);

  // The communications page marks threads read locally (optimistic state,
  // its own component tree) — this sidebar badge lives in the layout above
  // it and only ever loaded once on mount, so it needs an explicit nudge to
  // refetch whenever a mark (single open or MARK ALL READ) actually lands.
  useEffect(() => {
    function onInboxReadChanged() { loadInboxBadge(); }
    window.addEventListener('gv-inbox-read-changed', onInboxReadChanged);
    return () => window.removeEventListener('gv-inbox-read-changed', onInboxReadChanged);
  }, [loadInboxBadge]);

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
    setLoadingConf(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const { data: confData } = await supabase
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('slug', slug)
      .single();

    if (!confData) {
      router.replace('/');
      return;
    }

    // Ownership check: organizer_id on the conference OR conference_organizers table
    const owner = (confData as any).organizer_id === user!.id;
    setIsOwner(owner);
    if (!owner) {
      const { data: orgRow } = await supabase
        .from('conference_organizers')
        .select('user_id, permissions')
        .eq('user_id', user!.id)
        .eq('conference_id', (confData as any).id)
        .maybeSingle();
      if (!orgRow) {
        setAccessDenied(true);
        setLoadingConf(false);
        return;
      }
      setPermissions(((orgRow as any).permissions ?? {}) as Record<string, boolean>);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizer_id: _oid, ...conf } = confData as any;
    setConference(conf as Conference);
    setLoadingConf(false);
  }, [session, slug, user, router]);

  const refreshConference = useCallback(async () => {
    if (!user) return;
    await loadConference();
  }, [user, loadConference]);

  // Quiet variant: re-fetches the conference row and swaps it in directly,
  // without touching loadingConf, so settings saves can confirm DB truth
  // post-write without unmounting the page behind the full-screen spinner.
  const refreshConferenceQuiet = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: confData } = await supabase
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('slug', slug)
      .single();
    if (!confData) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizer_id: _oid, ...conf } = confData as any;
    setConference(conf as Conference);
  }, [user, session, slug]);

  // Fetch conference + ownership gate
  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    loadConference();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, session?.access_token]);

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  // Memoised so consumers (useManage()) only see a new context value when
  // the conference data or the (now-stable, useCallback'd) refresh functions
  // actually change, not on every layout render. Declared before the early
  // returns below, hooks can't run conditionally.
  const manageContextValue = useMemo(
    () => ({ conference, refreshConference, refreshConferenceQuiet }),
    [conference, refreshConference, refreshConferenceQuiet]
  );

  // Loading state
  if (authLoading || (user && loadingConf)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return null;

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-md w-full text-center rounded-2xl p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p style={{ fontSize: 10, color: '#B8844A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
            ACCESS DENIED
          </p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            You don&apos;t have access to manage this conference
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            You&apos;re not listed as an organizer of this conference. If you think this is a mistake, contact the conference&apos;s owner.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ← BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  const SECTION_PERMS: Record<string, string> = {
    committees: 'committees', applications: 'applications', import: 'import', assignment: 'assignment',
    documents: 'documents', communications: 'email_builder', financials: 'financials',
    'financial-aid': 'financials',
    settings: 'settings', jobs: 'job_board',
  };
  const currentSegment = pathname.split('/')[3] ?? '';
  const sectionKey = SECTION_PERMS[currentSegment];
  const sectionBlocked = !!conference && !isOwner && !!sectionKey && permissions[sectionKey] !== true;

  if (sectionBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="max-w-md w-full text-center rounded-2xl p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <p style={{ fontSize: 10, color: '#B8844A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
            SECTION RESTRICTED
          </p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            You don&apos;t have access to this section
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            Your organizer role for this conference doesn&apos;t include this section. Ask the conference owner to grant it.
          </p>
          <button
            onClick={() => router.push(`/manage/${slug}`)}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ← BACK TO DASHBOARD
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

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6"
        style={{ height: '56px', backgroundColor: '#1B3828', borderBottom: '1px solid rgba(61,122,82,0.3)' }}
      >
        {/* Left: logo + divider + acronym */}
        <div className="flex items-center gap-3">
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            {/* The Conferences logo asset, greyed (grayscale+brightness) so the
                forest-green wordmark reads on the dark /manage chrome. Same
                mark SiteNav and the auth card use, for one consistent brand. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Conferences.webp"
              alt="Gavelling Conferences"
              width={120}
              height={30}
              decoding="async"
              style={{ height: 30, width: 'auto', objectFit: 'contain', filter: 'grayscale(1) brightness(2.1)' }}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (!img.src.endsWith('/Conferences.png')) img.src = '/Conferences.png';
                else img.style.display = 'none';
              }}
            />
          </Link>
          <span style={{ color: 'rgba(238,217,138,0.3)', fontSize: '16px' }}>/</span>
          <Link
            href={`/manage/${slug}`}
            className="text-sm font-bold transition-opacity focus:outline-none"
            style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {conference?.acronym ?? '...'}
          </Link>
        </div>

        {/* Right: status pill + view page + avatar */}
        <div className="flex items-center gap-4">
          <Link
            href="/my-conferences"
            className="text-xs font-semibold hidden sm:inline-flex items-center gap-1 transition-colors focus:outline-none"
            style={{ color: 'rgba(238,217,138,0.7)', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.7)'; }}
          >
            ← BACK
          </Link>

          <Link
            href={`/conferences/${slug}`}
            className="text-xs font-semibold hidden sm:inline-block transition-colors focus:outline-none"
            style={{ color: 'rgba(238,217,138,0.7)', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.7)'; }}
          >
            VIEW PAGE →
          </Link>

          {/* Shared account menu (same hover-open dropdown as SiteNav) */}
          <ProfileDropdown
            panelStyle={{ zIndex: 60 }}
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                aria-label="Account menu"
                className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-black focus:outline-none transition-opacity hover:opacity-80 flex-shrink-0"
                style={{
                  backgroundColor: '#EED98A', color: '#1B3828',
                  fontFamily: "'Outfit', sans-serif",
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  avatarInitial
                )}
              </button>
            )}
          />

          {/* Mobile hamburger */}
          <button
            className="md:hidden focus:outline-none"
            onClick={() => setMobileMenuOpen(v => !v)}
            style={{ color: '#EED98A' }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Desktop floating rail, icons only, expands on hover */}
      <SideRail slug={slug} conference={conference} pathname={pathname} communicationsBadge={inboxBadge} />

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
              <SidebarContent
                slug={slug}
                conference={conference}
                pathname={pathname}
                onNavClick={() => setMobileMenuOpen(false)}
                communicationsBadge={inboxBadge}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content, rail is 68px + 14px inset, so content reclaims the old sidebar width */}
      <div
        className="relative z-10 md:ml-[96px]"
        style={{ marginTop: '56px', minHeight: 'calc(100vh - 56px)', backgroundColor: '#EDE7D8' }}
      >
        {children}
      </div>
    </ManageContext.Provider>
  );
}
