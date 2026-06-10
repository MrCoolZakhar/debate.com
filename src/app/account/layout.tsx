'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import SiteNav from '@/components/SiteNav';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const NAV_LINKS = [
  { label: 'MY PROFILE', href: '/account/profile' },
  { label: 'MUN CV', href: '/account/cv' },
  { label: 'CONFERENCE CALENDAR', href: '/account/calendar' },
  { label: 'GAVELLING POINTS', href: '/account/points' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div
          className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

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
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex-shrink-0 py-2 px-3 text-xs font-bold focus:outline-none"
                  style={{
                    color: active ? '#1B3828' : '#9A8A78',
                    borderBottom: active ? '2px solid #1B3828' : '2px solid transparent',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                    fontFamily: "'Outfit', sans-serif",
                    whiteSpace: 'nowrap',
                    transition: 'color 150ms ease',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop: sidebar + content */}
          <div className="hidden md:flex gap-8 items-start">
            {/* Sidebar */}
            <div style={{ width: '220px', flexShrink: 0 }}>
              <div
                className="rounded-2xl p-5 sticky"
                style={{ top: '88px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
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
                  style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
                >
                  {profile?.email ?? user.email ?? ''}
                </p>

                {profile?.unlimited_status && profile.unlimited_status !== 'none' && (
                  <div className="flex justify-center mt-2">
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: 'rgba(238,217,138,0.2)',
                        color: '#B6871F',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '9px',
                      }}
                    >
                      ✦ UNLIMITED
                    </span>
                  </div>
                )}

                <div className="mt-4 mb-2" style={{ borderTop: '1px solid #DDD4C0' }} />

                <nav className="flex flex-col gap-0.5">
                  {NAV_LINKS.map((link) => {
                    const active = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block w-full py-2 px-3 rounded-xl text-sm font-semibold focus:outline-none"
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
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-2 mb-2" style={{ borderTop: '1px solid #DDD4C0' }} />

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
