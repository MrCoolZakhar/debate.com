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

  const statusStyles: Record<string, { bg: string; color: string }> = {
    private:  { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
    public:   { bg: 'rgba(61,122,82,0.15)',   color: '#3D7A52' },
    archived: { bg: 'rgba(28,20,16,0.1)',     color: '#6A5A4A' },
  };
  const statusStyle = statusStyles[conference?.status ?? 'private'] ?? statusStyles.private;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={si}>
            {section.header && (
              <p
                className="px-4 pt-4 pb-1 text-[10px] tracking-[0.16em] font-medium"
                style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
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
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
              fontFamily: "'DM Mono', monospace",
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
        'predecessor_conference_id', 'predecessor_approved',
      ].join(', '))
      .eq('slug', slug)
      .single();

    if (!confData) {
      router.replace('/conferences');
      return;
    }

    // Ownership check: organizer_id on the conference OR conference_organizers table
    const isOwner = (confData as any).organizer_id === user!.id;
    if (!isOwner) {
      const { data: orgRow } = await supabase
        .from('conference_organizers')
        .select('user_id')
        .eq('user_id', user!.id)
        .eq('conference_id', (confData as any).id)
        .maybeSingle();
      if (!orgRow) {
        router.replace('/conferences');
        return;
      }
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
            className="text-sm font-medium"
            style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}
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

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col fixed left-0 bottom-0 overflow-hidden"
        style={{
          top: '56px',
          width: '220px',
          backgroundColor: '#FAF8F3',
          borderRight: '1px solid #DDD4C0',
          zIndex: 20,
        }}
      >
        <SidebarContent slug={slug} conference={conference} pathname={pathname} />
      </aside>

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

      {/* Main content */}
      <div
        className="relative z-10 md:ml-[220px]"
        style={{ marginTop: '56px', minHeight: 'calc(100vh - 56px)', backgroundColor: '#EDE7D8' }}
      >
        {children}
      </div>
    </ManageContext.Provider>
  );
}
