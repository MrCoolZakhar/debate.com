'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  User, ScrollText, CalendarDays, CalendarCheck, FileClock, Coins, Infinity as InfinityIcon, Ticket,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useUnlimitedStatus, isUnlimited } from '@/lib/unlimitedStatus';
import { useDraftCount } from '@/hooks/useDraftCount';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import Loader from '@/components/Loader';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FONT = "var(--font-brand), sans-serif";
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

// The rail sits under the 72px site header with a little air above it. It is
// ONE rail (the profile group, then Manage Account underneath) on every
// /account page: there is no second menu and no "Back to profile".
const RAIL_TOP = 96;
const RAIL_WIDTH = 248;

type NavLink = {
  label: string;
  href: string;
  Icon: LucideIcon;
  /** How "is this the current page" is decided. `prefix` also matches child paths. */
  match?: 'exact' | 'prefix';
  /** My conferences reads a touch warmer than the rest, with no stripe. */
  warm?: boolean;
  badge?: number;
};

type NavGroup = {
  /** Shown as a small heading above the group; the profile group has none. */
  heading?: string;
  links: NavLink[];
};

const PROFILE_LINKS: NavLink[] = [
  { label: 'My profile', href: '/account/profile', Icon: User },
  { label: 'MUN CV', href: '/account/cv', Icon: ScrollText },
  { label: 'Conference calendar', href: '/account/calendar', Icon: CalendarDays },
  { label: 'My conferences', href: '/account/conferences', Icon: CalendarCheck, match: 'prefix', warm: true },
];

const MANAGE_LINKS: NavLink[] = [
  { label: 'Credits and Usage', href: '/account/manage/credits', Icon: Coins, match: 'prefix' },
  { label: 'Subscription', href: '/account/manage/subscription', Icon: InfinityIcon, match: 'prefix' },
  { label: 'Promo Code', href: '/account/manage/promo', Icon: Ticket, match: 'prefix' },
];

function isActive(link: NavLink, pathname: string): boolean {
  // Query strings and hashes are not part of `pathname`, so the drafts row
  // (same page as My conferences, a different anchor) never lights up on its own.
  const path = link.href.split(/[?#]/)[0];
  return link.match === 'prefix' ? pathname.startsWith(path) : pathname === path;
}

function Badge({ n }: { n: number }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
      style={{
        minWidth: 20, height: 20, padding: '0 6px', fontSize: 11, fontWeight: 700,
        fontFamily: FONT, fontVariantNumeric: 'tabular-nums',
        backgroundColor: 'rgba(182,135,31,0.18)', color: '#B6871F',
      }}
      aria-label={`${n} to complete`}
    >
      {n}
    </span>
  );
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const unlimitedStatus = useUnlimitedStatus();
  const { count: draftCount } = useDraftCount();

  // Drafts to complete is a single destination row (the profile menu lists
  // one entry per draft; this rail does not), shown only while there is
  // something to finish, with the same count off the same hook.
  const profileLinks: NavLink[] = draftCount && draftCount > 0
    ? [
        ...PROFILE_LINKS,
        { label: 'Drafts to complete', href: '/account/conferences?tab=all#drafts', Icon: FileClock, badge: draftCount },
      ]
    : PROFILE_LINKS;

  const groups: NavGroup[] = [
    { links: profileLinks },
    { heading: 'Manage Account', links: MANAGE_LINKS },
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  // Bring the current tab of the phone rail into view. `inline: 'nearest'`
  // leaves an already visible tab where it is, `block: 'nearest'` keeps it
  // from scrolling the page. Read-only: it touches the rail's scrollLeft only.
  const tabRailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const rail = tabRailRef.current;
    if (!rail) return;
    const active = rail.querySelector('[data-acct-tab="active"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [pathname, draftCount]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <Loader size={72} label="Loading your account" />
      </div>
    );
  }

  if (!user) return null;

  const avatarInitial = (
    profile?.display_name?.[0] ?? user.email?.[0] ?? '?'
  ).toUpperCase();
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? '';
  const email = profile?.email ?? user.email ?? '';

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

        <style>{`
          .gv-acct-tabs{scrollbar-width:none;-ms-overflow-style:none}
          .gv-acct-tabs::-webkit-scrollbar{display:none}
          .gv-acct-row{transition:background-color 150ms ease-out,color 150ms ease-out}
          .gv-acct-row:hover{background-color:rgba(27,56,40,0.05);color:#1C1410}
          .gv-acct-row[data-active="true"]{background-color:rgba(27,56,40,0.09);color:#1B3828}
          .gv-acct-row[data-warm="true"]{background-color:rgba(238,217,138,0.22);color:#5E4416}
          .gv-acct-row[data-warm="true"]:hover{background-color:rgba(238,217,138,0.34)}
          .gv-acct-row[data-warm="true"][data-active="true"]{background-color:rgba(182,135,31,0.22);color:#4A3410}
          .gv-acct-signout{transition:background-color 150ms ease-out}
          .gv-acct-signout:hover{background-color:rgba(139,32,32,0.07)}
        `}</style>

        {/* Mobile tab bar: every entry of both groups in one horizontal
            scroller that bleeds to the screen edges, hides its scrollbar (the
            native bar drew over the active underline), contains its overscroll,
            and scrolls the current tab into view on mount. Rows are 44px so a
            thumb can hit them. A hairline separates the two groups. */}
        <div
          ref={tabRailRef}
          className="gv-acct-tabs md:hidden flex overflow-x-auto gap-0 px-4"
          style={{ borderBottom: '1px solid #DDD4C0', overscrollBehaviorX: 'contain' }}
          aria-label="Account"
        >
          {groups.map((group, gi) => (
            <div key={gi} className="flex flex-shrink-0 items-stretch">
              {gi > 0 && (
                <span aria-hidden className="self-center flex-shrink-0" style={{ width: 1, height: 20, backgroundColor: '#DDD4C0', margin: '0 6px' }} />
              )}
              {group.links.map((link) => {
                const active = isActive(link, pathname);
                const color = active ? '#1B3828' : link.warm ? '#B6871F' : '#5A5046';
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-acct-tab={active ? 'active' : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 ${FOCUS}`}
                    style={{
                      minHeight: 44,
                      color,
                      borderBottom: active ? '2px solid #1B3828' : '2px solid transparent',
                      textDecoration: 'none',
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: active ? 700 : 600,
                      whiteSpace: 'nowrap',
                      transition: 'color 150ms ease-out',
                    }}
                  >
                    <link.Icon size={14} strokeWidth={2.4} aria-hidden />
                    {link.label}
                    {link.badge !== undefined && <Badge n={link.badge} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Rail on the left edge, content column flexible. The content is
            rendered ONCE (a hidden desktop tree plus a visible mobile tree used
            to mount every page twice, portals included).

            Stickiness: the <aside> ITSELF is sticky with `align-self:
            flex-start`, so it is content-height and travels inside the flex row,
            which is as tall as the content column. (A sticky child of a
            content-height aside has nowhere to travel, which is what the old
            rail did.) No ancestor is a scroll container: html/body use
            `overflow-x: clip`, which never breaks sticky, and nothing between
            them and the aside sets overflow. */}
        <div className="flex">
          <aside
            className="hidden md:flex flex-col flex-shrink-0"
            style={{
              width: RAIL_WIDTH,
              paddingLeft: 24,
              paddingRight: 12,
              paddingTop: 16,
              position: 'sticky',
              top: RAIL_TOP,
              alignSelf: 'flex-start',
              // A very short window scrolls the rail itself; overflow on the
              // sticky element is fine, it is overflow on an ANCESTOR that breaks it.
              maxHeight: `calc(100vh - ${RAIL_TOP}px)`,
              overflowY: 'auto',
            }}
            aria-label="Account"
          >
            {/* Who */}
            <div className="flex items-center gap-3 px-3 pb-4">
              {profile?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="rounded-full object-cover flex-shrink-0"
                  style={{ width: 44, height: 44 }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 44, height: 44,
                    backgroundColor: '#1B3828',
                    color: '#EED98A',
                    fontFamily: FONT, fontWeight: 800, fontSize: 18,
                  }}
                  aria-hidden
                >
                  {avatarInitial}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate" style={{ margin: 0, color: '#1C1410', fontFamily: FONT, fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                  {displayName}
                </p>
                <p className="truncate" style={{ margin: 0, color: '#5A5046', fontFamily: FONT, fontWeight: 500, fontSize: 12, lineHeight: 1.4 }}>
                  {email}
                </p>
                {isUnlimited(unlimitedStatus) && (
                  <span
                    className="inline-flex items-center rounded-full mt-1"
                    style={{
                      padding: '1px 8px',
                      backgroundColor: '#1B3828',
                      color: '#EED98A',
                      fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.12em',
                    }}
                  >
                    UNLIMITED
                  </span>
                )}
              </div>
            </div>

            <nav className="flex flex-col" aria-label="Account pages">
              {groups.map((group, gi) => (
                <div key={gi} className="flex flex-col gap-0.5" style={{ marginTop: gi > 0 ? 18 : 0 }}>
                  {group.heading && (
                    <p
                      className="px-3"
                      style={{
                        margin: '0 0 4px',
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#B6871F',
                      }}
                    >
                      {group.heading}
                    </p>
                  )}
                  {group.links.map((link) => {
                    const active = isActive(link, pathname);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        data-active={active ? 'true' : 'false'}
                        data-warm={link.warm ? 'true' : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`gv-acct-row flex items-center gap-2.5 rounded-xl px-3 ${FOCUS}`}
                        style={{
                          minHeight: 44,
                          color: '#5A5046',
                          textDecoration: 'none',
                          fontFamily: FONT,
                          fontSize: 14,
                          fontWeight: active ? 700 : 600,
                        }}
                      >
                        <link.Icon size={16} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
                        <span className="flex-1 min-w-0 truncate">{link.label}</span>
                        {link.badge !== undefined && <Badge n={link.badge} />}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="mt-3 mb-1 mx-3" style={{ borderTop: '1px solid rgba(221,212,192,0.8)' }} />

            <button
              type="button"
              onClick={handleSignOut}
              className={`gv-acct-signout w-full rounded-xl px-3 text-left ${FOCUS}`}
              style={{
                minHeight: 44,
                color: '#8B2020',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              SIGN OUT
            </button>
          </aside>

          {/* Content column: flexible, its own measure, its own gutters. */}
          <div className="flex-1 min-w-0">
            <div
              className="w-full px-5 py-8 md:px-8 md:py-10 lg:px-10"
              style={{ maxWidth: 1100 }}
            >
              {children}
            </div>
          </div>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
