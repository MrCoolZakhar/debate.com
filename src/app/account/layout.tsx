'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, ScrollText, CalendarDays, Sparkles, CalendarCheck, ArrowRight, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import SiteNav from '@/components/SiteNav';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

type NavLink = { label: string; href: string; Icon: LucideIcon; highlight?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: 'MY PROFILE', href: '/account/profile', Icon: User },
  { label: 'MUN CV', href: '/account/cv', Icon: ScrollText },
  { label: 'CONFERENCE CALENDAR', href: '/account/calendar', Icon: CalendarDays },
  { label: 'GAVELLING UNLIMITED', href: '/account/unlimited', Icon: Sparkles },
];

// My Conferences is a headline destination — it lives in its own gold-accented
// floating block below the nav list and sign-out, not as another nav row.
const CONFERENCES_HREF = '/account/conferences';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div
          className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!user) return null;

  const avatarInitial = (
    profile?.display_name?.[0] ?? user.email?.[0] ?? '?'
  ).toUpperCase();

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDE7D8' }}>
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

      <div className="relative z-10">
        <SiteNav />

        <div className="max-w-[1000px] mx-auto px-6 py-10">

          {/* Mobile tab bar */}
          <div
            className="md:hidden flex overflow-x-auto gap-0 mb-6"
            style={{ borderBottom: '1px solid #DDD4C0' }}
          >
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              const accent = link.highlight ? '#B6871F' : '#1B3828';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 py-2 px-3 text-xs font-bold focus:outline-none"
                  style={{
                    color: active ? accent : link.highlight ? '#B6871F' : '#9A8A78',
                    borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                    fontFamily: "'Outfit', sans-serif",
                    whiteSpace: 'nowrap',
                    transition: 'color 150ms ease',
                  }}
                >
                  <link.Icon size={13} strokeWidth={2.4} />
                  {link.label}
                </Link>
              );
            })}
            {(() => {
              const confActive = pathname.startsWith('/account/conferences');
              return (
                <Link
                  href={CONFERENCES_HREF}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 py-2 px-3 text-xs font-bold focus:outline-none"
                  style={{
                    color: '#B6871F',
                    borderBottom: confActive ? '2px solid #B6871F' : '2px solid transparent',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                    fontFamily: "'Outfit', sans-serif",
                    whiteSpace: 'nowrap',
                    transition: 'color 150ms ease',
                  }}
                >
                  <CalendarCheck size={13} strokeWidth={2.4} />
                  MY CONFERENCES
                </Link>
              );
            })()}
          </div>

          {/* Desktop: sidebar + content */}
          <div className="hidden md:flex gap-8 items-start">
            {/* Sidebar */}
            <div style={{ width: '220px', flexShrink: 0 }}>
              <div className="sticky flex flex-col gap-3" style={{ top: '88px' }}>
              <div
                className="rounded-[22px] p-5"
                style={{
                  background: 'linear-gradient(180deg, rgba(252,250,246,0.95) 0%, rgba(245,241,232,0.9) 100%)',
                  backdropFilter: 'blur(16px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
                  border: '1px solid #D8CDB6',
                  boxShadow: '0 2px 4px rgba(27,56,40,0.05), 0 18px 44px rgba(27,56,40,0.11), inset 0 1px 0 rgba(255,255,255,0.7)',
                }}
              >
                {/* Avatar */}
                <div className="flex justify-center">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="rounded-full object-cover"
                      style={{ width: '64px', height: '64px', border: '2px solid #DDD4C0' }}
                    />
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center font-black text-2xl"
                      style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: 'rgba(27,56,40,0.1)',
                        border: '2px solid #DDD4C0',
                        color: '#1B3828',
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      {avatarInitial}
                    </div>
                  )}
                </div>

                <p
                  className="font-semibold text-sm text-center mt-3"
                  style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                >
                  {profile?.display_name ?? user.email?.split('@')[0] ?? ''}
                </p>

                <p
                  className="text-xs text-center mt-0.5"
                  style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}
                >
                  {profile?.email ?? user.email ?? ''}
                </p>

                {profile?.unlimited_status && profile.unlimited_status !== 'none' && (
                  <div className="flex justify-center mt-2">
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: 'rgba(238,217,138,0.22)',
                        border: '1px solid rgba(182,135,31,0.4)',
                        color: '#B6871F',
                        fontFamily: "'Outfit', sans-serif",
                        fontWeight: 700,
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                      }}
                    >
                      ✦ UNLIMITED
                    </span>
                  </div>
                )}

                <div className="mt-4 mb-3" style={{ borderTop: '1px solid rgba(221,212,192,0.7)' }} />

                <p
                  className="px-3 mb-1.5"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '8.5px', letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase' }}
                >
                  ACCOUNT
                </p>

                <nav className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => {
                    const active = pathname === link.href;

                    // MY CONFERENCES is a key destination — it gets a warmer,
                    // always-on gold treatment so it stands out from the rest.
                    if (link.highlight) {
                      const activeBg = 'linear-gradient(135deg, rgba(238,217,138,0.34), rgba(182,135,31,0.16))';
                      const idleBg = 'linear-gradient(135deg, rgba(238,217,138,0.20), rgba(182,135,31,0.08))';
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="group flex items-center gap-2 w-full py-2.5 px-3 rounded-xl text-sm font-bold focus:outline-none"
                          style={{
                            border: '1px solid rgba(182,135,31,0.45)',
                            background: active ? activeBg : idleBg,
                            color: '#7A5A20',
                            textDecoration: 'none',
                            fontFamily: "'Outfit', sans-serif",
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
                            transition: 'background 150ms ease, box-shadow 150ms ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = activeBg; }}
                          onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = idleBg; }}
                        >
                          <span
                            className="inline-flex items-center justify-center flex-shrink-0"
                            style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(150deg, #EED98A, #B6871F)', boxShadow: '0 2px 6px rgba(182,135,31,0.4)' }}
                          >
                            <link.Icon size={13} strokeWidth={2.6} style={{ color: '#FAF8F3' }} />
                          </span>
                          <span className="flex-1">{link.label}</span>
                          <ArrowRight size={14} strokeWidth={2.6} style={{ color: '#B6871F' }} />
                        </Link>
                      );
                    }

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-2.5 w-full py-2 px-3 rounded-xl text-sm font-semibold focus:outline-none"
                        style={{
                          borderLeft: active ? '3px solid #1B3828' : '3px solid transparent',
                          backgroundColor: active ? 'rgba(27,56,40,0.08)' : 'transparent',
                          color: active ? '#1B3828' : '#9A8A78',
                          textDecoration: 'none',
                          fontFamily: "'Outfit', sans-serif",
                          transition: 'background-color 150ms ease, color 150ms ease',
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
                        <link.Icon size={15} strokeWidth={2.2} style={{ color: active ? '#1B3828' : '#9A8A78', flexShrink: 0 }} />
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-2 mb-2" style={{ borderTop: '1px solid rgba(221,212,192,0.7)' }} />

                <button
                  onClick={handleSignOut}
                  className="w-full text-xs font-semibold rounded-xl py-2 px-3 text-left focus:outline-none"
                  style={{
                    color: '#8B2020',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'background-color 150ms ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  SIGN OUT
                </button>
              </div>

              {/* Floating "My Conferences" block — its own gold-accented card,
                  set apart from the nav list and sign-out above it. */}
              {(() => {
                const confActive = pathname.startsWith('/account/conferences');
                const activeBg = 'linear-gradient(135deg, rgba(238,217,138,0.42), rgba(182,135,31,0.20))';
                const idleBg = 'linear-gradient(135deg, rgba(238,217,138,0.22), rgba(182,135,31,0.10))';
                return (
                  <Link
                    href="/account/conferences"
                    className="group flex items-center gap-2.5 focus:outline-none"
                    style={{
                      padding: '13px 14px',
                      borderRadius: 18,
                      border: '1px solid rgba(182,135,31,0.5)',
                      background: confActive ? activeBg : idleBg,
                      boxShadow: confActive
                        ? '0 6px 18px rgba(182,135,31,0.26), inset 0 1px 0 rgba(255,255,255,0.6)'
                        : '0 4px 14px rgba(182,135,31,0.16), inset 0 1px 0 rgba(255,255,255,0.55)',
                      textDecoration: 'none',
                      transition: 'background 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      if (!confActive) (e.currentTarget as HTMLElement).style.background = activeBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      if (!confActive) (e.currentTarget as HTMLElement).style.background = idleBg;
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(150deg, #EED98A, #B6871F)', boxShadow: '0 3px 9px rgba(182,135,31,0.42)' }}
                    >
                      <CalendarCheck size={17} strokeWidth={2.5} style={{ color: '#FAF8F3' }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '8px', letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase' }}>
                        YOUR HUB
                      </span>
                      <span className="block" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '13.5px', color: '#7A5A20', letterSpacing: '0.01em' }}>
                        My Conferences
                      </span>
                    </span>
                    <ArrowRight
                      size={15}
                      strokeWidth={2.6}
                      className="transition-transform group-hover:translate-x-0.5"
                      style={{ color: '#B6871F', flexShrink: 0 }}
                    />
                  </Link>
                );
              })()}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>

          {/* Mobile content */}
          <div className="md:hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
