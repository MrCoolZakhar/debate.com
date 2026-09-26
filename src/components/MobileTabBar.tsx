'use client';

// The phone tab bar (owner's taste board two, 25 Sep 2026: Airbnb's bottom bar,
// "no saved but rather join"). Phones and tablets only (below lg), on every page
// that has the site nav. Five tabs: Explore, Join, Create, Conferences, Profile.
// An Inbox tab waits for a participant inbox page (there is none yet).
// The page gets bottom padding so the bar never covers the footer.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Ticket, PlusCircle, Landmark, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AuthLink from '@/components/auth/AuthLink';

const BAR_H = 62;

type Tab = { label: string; href: string; icon: LucideIcon; active: (p: string) => boolean; needsAuth?: boolean };

const TABS: Tab[] = [
  { label: 'Explore', href: '/conferences/explore', icon: Search, active: (p) => p.startsWith('/conferences') && !p.startsWith('/conferences/new') },
  { label: 'Join', href: '/join', icon: Ticket, active: (p) => p === '/join' || p === '/sessions' },
  { label: 'Create', href: '/create', icon: PlusCircle, active: (p) => p.startsWith('/create') || p.startsWith('/conferences/new') },
  { label: 'Conferences', href: '/account/conferences', icon: Landmark, active: (p) => p.startsWith('/account/conferences'), needsAuth: true },
  { label: 'Profile', href: '/account/profile', icon: UserRound, active: (p) => p.startsWith('/account') && !p.startsWith('/account/conferences'), needsAuth: true },
];

export default function MobileTabBar() {
  const pathname = usePathname() ?? '';
  const { user, loading } = useAuth();

  return (
    <>
      <style>{`
        @media (max-width: 1023px) { body { padding-bottom: calc(${BAR_H}px + env(safe-area-inset-bottom, 0px)); } }
        .gv-tabbar a:focus-visible { outline: 2px solid #1B3828; outline-offset: -4px; border-radius: 10px; }
      `}</style>
      <nav
        aria-label="Main"
        className="gv-tabbar lg:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5"
        style={{
          height: `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid rgba(28,20,16,0.10)',
          boxShadow: '0 -6px 20px rgba(27,56,40,0.06)',
        }}
      >
        {TABS.map(({ label, href, icon: Icon, active, needsAuth }) => {
          const on = active(pathname);
          const inner = (
            <>
              <Icon size={23} strokeWidth={on ? 2.3 : 1.8} aria-hidden="true" />
              <span style={{ fontSize: 11, fontWeight: on ? 800 : 600, lineHeight: 1 }}>
                {needsAuth && !user && !loading && label === 'Profile' ? 'Log in' : label}
              </span>
            </>
          );
          const cls = 'flex flex-col items-center justify-center gap-1 focus:outline-none';
          const style = { color: on ? '#1B3828' : 'rgba(28,20,16,0.55)', fontFamily: 'var(--font-brand), sans-serif', textDecoration: 'none' } as const;
          if (needsAuth && !user && !loading) {
            return <AuthLink key={label} next={href} className={cls} style={style}>{inner}</AuthLink>;
          }
          return (
            <Link key={label} href={href} aria-current={on ? 'page' : undefined} className={cls} style={style}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
