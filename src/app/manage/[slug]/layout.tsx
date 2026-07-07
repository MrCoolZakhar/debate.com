'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Globe, Building2, Users, MapPin, FileText,
  Mail, CreditCard, Settings, Briefcase, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

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
  predecessor_conference_id: string | null;
  predecessor_approved: boolean;
  min_age: number | null;
}

// ── Context ────────────────────────────────────────────────────────────────

interface ManageContextType {
  conference: Conference | null;
  refreshConference: () => Promise<void>;
}

const ManageContext = createContext<ManageContextType>({
  conference: null,
  refreshConference: async () => {},
});

export function useManage() {
  return useContext(ManageContext);
}

// ── Nav definition ─────────────────────────────────────────────────────────

const NAV_SECTIONS = (slug: string) => [
  {
    header: null,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',  href: `/manage/${slug}`,                    external: false },
      { icon: Globe,           label: 'View Page',  href: `/conferences/${slug}`,               external: true  },
    ],
  },
  {
    header: 'MANAGE',
    items: [
      { icon: Building2, label: 'Committees',   href: `/manage/${slug}/committees`,   external: false },
      { icon: Users,     label: 'Applications', href: `/manage/${slug}/applications`, external: false },
      { icon: MapPin,    label: 'Assignment',   href: `/manage/${slug}/assignment`,   external: false },
      { icon: FileText,  label: 'Documents',    href: `/manage/${slug}/documents`,    external: false },
    ],
  },
  {
    header: 'COMMUNICATE',
    items: [
      { icon: Mail, label: 'Email Builder', href: `/manage/${slug}/communications`, external: false },
    ],
  },
  {
    header: 'FINANCIAL',
    items: [
      { icon: CreditCard, label: 'Financials', href: `/manage/${slug}/financials`, external: false },
    ],
  },
  {
    header: 'SETTINGS',
    items: [
      { icon: Settings,  label: 'Settings',  href: `/manage/${slug}/settings`, external: false },
      { icon: Briefcase, label: 'Job Board', href: `/manage/${slug}/jobs`,     external: false },
    ],
  },
];

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
// identity ("ACRONYM YEAR"), section headers and labels — content keeps the
// reclaimed horizontal space.

function SideRail({
  slug,
  conference,
  pathname,
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sections = NAV_SECTIONS(slug);
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
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(18px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.3)',
        border: '1px solid rgba(221,212,192,0.9)',
        borderRadius: '26px',
        boxShadow: '0 12px 40px rgba(27,56,40,0.13), 0 2px 8px rgba(27,56,40,0.06)',
        transition: 'width 280ms cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
      }}
    >
      {/* Conference identity */}
      <div
        className="flex-shrink-0 flex items-center"
        style={{
          gap: expanded ? '12px' : '0px',
          padding: expanded ? '16px 16px 14px' : '14px 0',
          justifyContent: expanded ? 'flex-start' : 'center',
          borderBottom: '1px solid rgba(221,212,192,0.65)',
          transition: 'padding 280ms cubic-bezier(0.22,1,0.36,1), gap 280ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {conference?.logo_url ? (
          <img
            src={conference.logo_url}
            alt={conference.acronym}
            style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 3px 8px rgba(27,56,40,0.25))' }}
          />
        ) : (
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: '40px', height: '40px', borderRadius: '13px',
              background: 'linear-gradient(135deg, #16301F, #2A5A3C)',
              color: '#EED98A', fontSize: '13px', fontWeight: 800, fontFamily: "'Outfit', sans-serif",
            }}
          >
            {(conference?.acronym ?? '?').slice(0, 2)}
          </span>
        )}
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
          <span className="text-[15px] font-extrabold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {conference?.acronym ?? '…'}{year ? ` ${year}` : ''}
          </span>
        </div>
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
                  <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
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
}: {
  slug: string;
  conference: Conference | null;
  pathname: string;
  onNavClick?: () => void;
}) {
  const sections = NAV_SECTIONS(slug);

  const statusStyle = STATUS_STYLES[conference?.status ?? 'private'] ?? STATUS_STYLES.private;

  return (
    <div className="flex flex-col h-full">
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
                  {item.label}
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

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=/manage/${slug}`);
    }
  }, [authLoading, user, router, slug]);

  // Fetch conference + ownership gate
  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    loadConference();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, session?.access_token]);

  async function loadConference() {
    setLoadingConf(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const { data: confData } = await supabase
      .from('conferences')
      .select([
        'id', 'slug', 'full_name', 'acronym', 'is_public', 'status',
        'logo_url', 'banner_url', 'start_date', 'end_date', 'country', 'city',
        'format', 'expected_delegates', 'fee_amount', 'fee_currency',
        'contact_email', 'student_level', 'description',
        'instagram_url', 'facebook_url', 'tiktok_url', 'whatsapp_url', 'website_url',
        'stripe_account_id', 'organizer_id',
        'predecessor_conference_id', 'predecessor_approved', 'min_age',
      ].join(', '))
      .eq('slug', slug)
      .single();

    if (!confData) {
      router.replace('/conferences');
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
  }

  async function refreshConference() {
    if (!user) return;
    await loadConference();
  }

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

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
            onClick={() => router.push('/conferences')}
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
    committees: 'committees', applications: 'applications', assignment: 'assignment',
    documents: 'documents', communications: 'email_builder', financials: 'financials',
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
    <ManageContext.Provider value={{ conference, refreshConference }}>
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6"
        style={{ height: '56px', backgroundColor: '#1B3828', borderBottom: '1px solid rgba(61,122,82,0.3)' }}
      >
        {/* Left: logo + divider + acronym */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <img src="/GavellingLogo.png" alt="Gavelling" className="h-6 w-auto object-contain brightness-200 saturate-0" />
          </Link>
          <span style={{ color: 'rgba(238,217,138,0.3)', fontSize: '16px' }}>/</span>
          <span
            className="text-sm font-bold"
            style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em' }}
          >
            {conference?.acronym ?? '...'}
          </span>
        </div>

        {/* Right: status pill + view page + avatar */}
        <div className="flex items-center gap-4">
          <Link
            href="/conferences/organise"
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

          <Link
            href="/account/profile"
            className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-black focus:outline-none transition-opacity hover:opacity-80 flex-shrink-0"
            style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              avatarInitial
            )}
          </Link>

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

      {/* Desktop floating rail — icons only, expands on hover */}
      <SideRail slug={slug} conference={conference} pathname={pathname} />

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 flex flex-col"
            style={{ width: '280px', backgroundColor: '#FAF8F3', borderRight: '1px solid #DDD4C0' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 flex items-center px-4" style={{ borderBottom: '1px solid #DDD4C0' }}>
              <span className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Menu</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent
                slug={slug}
                conference={conference}
                pathname={pathname}
                onNavClick={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content — rail is 68px + 14px inset, so content reclaims the old sidebar width */}
      <div
        className="relative z-10 md:ml-[96px]"
        style={{ marginTop: '56px', minHeight: 'calc(100vh - 56px)', backgroundColor: '#EDE7D8' }}
      >
        {children}
      </div>
    </ManageContext.Provider>
  );
}
