'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  User, ScrollText, CalendarCheck, FileClock, Coins, Infinity as InfinityIcon, Ticket,
  Settings2, LogOut, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useUnlimitedStatus, isUnlimited } from '@/lib/unlimitedStatus';
import { useDraftCount } from '@/hooks/useDraftCount';
import { useCredits } from '@/hooks/useCredits';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import Loader from '@/components/Loader';
import { AccountStyles, DuoIcon, RAISED, FOREST, DEEP_GOLD, INK, INK_SOFT } from './accountShell';

// The account area (26 Sep 2026 redesign). ONE sticky side nav on desktop,
// built as a raised white card: the person at the top (avatar, name that
// wraps, the plan as a plain word), then the pages with duotone icons, then
// Manage account with its three parts (anchors on the one page) beneath it, and a quiet
// Sign out at the foot. On phones and tablets the same entries are a
// horizontal row of pills under the site header that scrolls sideways; the
// site's own bottom tab bar (MobileTabBar, mounted by SiteNav) keeps its
// clearance because nothing here is fixed to the bottom.

const FONT = "var(--font-brand), sans-serif";
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

// The rail sits under the 72px site header with air above it.
const RAIL_TOP = 92;
const RAIL_WIDTH = 272;

type NavLink = {
  label: string;
  href: string;
  Icon: LucideIcon;
  /** How "is this the current page" is decided. `prefix` also matches child paths. */
  match?: 'exact' | 'prefix';
  badge?: number;
  /** Drawn indented under its parent (the Manage account sub-pages). */
  sub?: boolean;
};

const PROFILE_LINKS: NavLink[] = [
  { label: 'Profile', href: '/account/profile', Icon: User },
  { label: 'MUN CV', href: '/account/cv', Icon: ScrollText },
  { label: 'My conferences', href: '/account/conferences', Icon: CalendarCheck, match: 'prefix' },
];

// Manage account is ONE page (26 Sep 2026); its three parts are anchors on it.
const MANAGE_PARENT: NavLink = { label: 'Manage account', href: '/account/manage', Icon: Settings2, match: 'prefix' };

const MANAGE_LINKS: NavLink[] = [
  { label: 'Credits', href: '/account/manage#credits', Icon: Coins, sub: true },
  { label: 'Subscription', href: '/account/manage#subscription', Icon: InfinityIcon, sub: true },
  { label: 'Promo code', href: '/account/manage#promo', Icon: Ticket, sub: true },
];

function isActive(link: NavLink, pathname: string): boolean {
  // Query strings and hashes are not part of `pathname`, so the drafts row
  // (same page as My conferences, a different anchor) and the Manage account
  // anchors never light up on their own.
  if (link.sub || link.badge !== undefined) return false;
  const path = link.href.split(/[?#]/)[0];
  return link.match === 'prefix' ? pathname.startsWith(path) : pathname === path;
}

/** A count beside a nav label: a plain gold number, no pill. */
function NavCount({ n }: { n: number }) {
  return (
    <span
      className="flex-shrink-0"
      style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: DEEP_GOLD, fontVariantNumeric: 'tabular-nums' }}
      aria-label={`${n} to complete`}
    >
      {n}
    </span>
  );
}

function Avatar({ url, initial, size }: { url: string | null | undefined; initial: string; size: number }) {
  // A rimmed round portrait: white ring, then a hairline, then a soft drop.
  const ring = '0 0 0 3px #FFFFFF, 0 0 0 4px rgba(27,56,40,0.10), 0 6px 14px -4px rgba(27,56,40,0.30)';
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size, boxShadow: ring }} />
    );
  }
  return (
    <span
      aria-hidden
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, boxShadow: ring,
        background: 'linear-gradient(150deg, rgba(238,217,138,0.55), rgba(238,217,138,0.25))',
        color: FOREST, fontFamily: FONT, fontWeight: 800, fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const unlimitedStatus = useUnlimitedStatus();
  const { count: draftCount } = useDraftCount();
  const { balance } = useCredits();

  // Drafts to complete is a single destination row, shown only while there is
  // something to finish, with the same count off the same hook.
  const profileLinks: NavLink[] = draftCount && draftCount > 0
    ? [
        ...PROFILE_LINKS,
        { label: 'Drafts to complete', href: '/account/conferences#drafts', Icon: FileClock, badge: draftCount },
      ]
    : PROFILE_LINKS;

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  // Bring the current pill of the phone row into view. `inline: 'nearest'`
  // leaves an already visible pill where it is, `block: 'nearest'` keeps it
  // from scrolling the page. Read-only: it touches the row's scrollLeft only.
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

  const avatarInitial = (profile?.display_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase();
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? '';
  const unlimited = isUnlimited(unlimitedStatus);

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  // Every entry of the phone row, in rail order.
  const phoneLinks: NavLink[] = [...profileLinks, MANAGE_PARENT];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDE7D8' }}>
      <AccountStyles />
      <style>{`
        .gv-acct-tabs{scrollbar-width:none;-ms-overflow-style:none}
        .gv-acct-tabs::-webkit-scrollbar{display:none}
        .gv-acct-row{position:relative;transition:background-color 150ms ease-out,color 150ms ease-out,box-shadow 180ms ease-out}
        .gv-acct-row:hover{background-color:rgba(27,56,40,0.045);color:${INK}}
        .gv-acct-row[data-active="true"]{background:linear-gradient(180deg,#FFFFFF,#F7F3EA);color:${FOREST};
          box-shadow:inset 0 1px 0 #FFFFFF,0 0 0 1px rgba(27,56,40,0.08),0 4px 10px -4px rgba(27,56,40,0.28)}
        .gv-acct-row[data-active="true"]::before{content:'';position:absolute;left:-2px;top:10px;bottom:10px;width:3px;border-radius:3px;background:${DEEP_GOLD}}
        .gv-acct-pill{transition:background-color 150ms ease-out,box-shadow 180ms ease-out}
        .gv-acct-signout{transition:background-color 150ms ease-out,color 150ms ease-out}
        .gv-acct-signout:hover{background-color:rgba(139,32,32,0.06);color:#8B2020}
      `}</style>

      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.16,
        }}
      />

      <div className="relative z-10">
        <SiteNav />

        {/* ── Phone and tablet: who, then the pages as a sideways row of pills ── */}
        <div className="lg:hidden px-4 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar url={profile?.avatar_url} initial={avatarInitial} size={40} />
            <div className="min-w-0 flex-1">
              <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: FONT, fontWeight: 800, fontSize: 16, lineHeight: 1.25, color: INK }}>
                {displayName}
              </p>
              <PlanLine unlimited={unlimited} balance={balance} />
            </div>
          </div>
          <nav
            ref={tabRailRef}
            className="gv-acct-tabs flex overflow-x-auto gap-2 -mx-4 px-4 pb-3 pt-1"
            style={{ overscrollBehaviorX: 'contain' }}
            aria-label="Account pages"
          >
            {phoneLinks.map((link) => {
              const active = isActive(link, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-acct-tab={active ? 'active' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`gv-acct-pill flex-shrink-0 inline-flex items-center gap-2 px-3.5 rounded-full ${FOCUS}`}
                  style={{
                    minHeight: 44,
                    color: active ? FOREST : INK_SOFT,
                    background: active ? 'linear-gradient(180deg,#FFFFFF,#F7F3EA)' : 'rgba(255,255,255,0.55)',
                    boxShadow: active
                      ? 'inset 0 1px 0 #FFFFFF,0 0 0 1.5px rgba(27,56,40,0.55),0 4px 10px -4px rgba(27,56,40,0.28)'
                      : '0 0 0 1px rgba(27,56,40,0.08)',
                    textDecoration: 'none',
                    fontFamily: FONT,
                    fontSize: 14,
                    fontWeight: active ? 800 : 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <DuoIcon Icon={link.Icon} size={16} active={active} />
                  {link.label}
                  {link.badge !== undefined && <NavCount n={link.badge} />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rail on the left, content column flexible. The content is rendered
            ONCE. Stickiness: the <aside> ITSELF is sticky with
            `align-self: flex-start`, so it travels inside the flex row, which
            is as tall as the content column. No ancestor is a scroll container. */}
        <div className="flex gap-2 lg:px-6 xl:px-8">
          <aside
            className="hidden lg:block flex-shrink-0"
            style={{
              width: RAIL_WIDTH,
              paddingTop: 24,
              position: 'sticky',
              top: RAIL_TOP,
              alignSelf: 'flex-start',
              // A very short window scrolls the rail itself; overflow on the
              // sticky element is fine, it is overflow on an ANCESTOR that breaks it.
              maxHeight: `calc(100vh - ${RAIL_TOP}px)`,
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}
            aria-label="Account"
          >
            <div
              className="rounded-[24px] p-3"
              style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF8F1 100%)', boxShadow: RAISED, marginBottom: 16 }}
            >
              {/* Who */}
              <Link
                href="/account/profile"
                className={`flex items-center gap-3 rounded-[18px] px-2.5 py-3 ${FOCUS}`}
                style={{ textDecoration: 'none' }}
              >
                <Avatar url={profile?.avatar_url} initial={avatarInitial} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere]" style={{ margin: 0, color: INK, fontFamily: FONT, fontWeight: 800, fontSize: 16, lineHeight: 1.25 }}>
                    {displayName}
                  </p>
                  <PlanLine unlimited={unlimited} balance={balance} />
                </div>
              </Link>

              <div aria-hidden style={{ height: 1, background: 'rgba(27,56,40,0.08)', margin: '6px 10px 10px' }} />

              <nav className="flex flex-col gap-1" aria-label="Account pages">
                {profileLinks.map((link) => (
                  <RailRow key={link.href} link={link} active={isActive(link, pathname)} />
                ))}

                <div aria-hidden style={{ height: 1, background: 'rgba(27,56,40,0.08)', margin: '8px 10px' }} />

                <RailRow link={MANAGE_PARENT} active={isActive(MANAGE_PARENT, pathname)} />
                <div className="relative flex flex-col gap-1" style={{ marginLeft: 22, paddingLeft: 10 }}>
                  <span aria-hidden className="absolute" style={{ left: 0, top: 6, bottom: 6, width: 1.5, borderRadius: 2, background: 'rgba(27,56,40,0.12)' }} />
                  {MANAGE_LINKS.map((link) => (
                    <RailRow key={link.href} link={link} active={isActive(link, pathname)} />
                  ))}
                </div>
              </nav>

              <div aria-hidden style={{ height: 1, background: 'rgba(27,56,40,0.08)', margin: '10px 10px 6px' }} />

              <button
                type="button"
                onClick={handleSignOut}
                className={`gv-acct-signout w-full flex items-center gap-2.5 rounded-xl px-3 text-left ${FOCUS}`}
                style={{
                  minHeight: 44, color: INK_SOFT, backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: FONT, fontSize: 14, fontWeight: 600,
                }}
              >
                <LogOut size={16} strokeWidth={2} aria-hidden />
                Sign out
              </button>
            </div>
          </aside>

          {/* Content column: flexible, its own measure, its own gutters. */}
          <div className="flex-1 min-w-0">
            <div className="w-full px-4 pt-2 pb-12 sm:px-5 lg:px-2 lg:pt-6" style={{ maxWidth: 1120 }}>
              {children}
            </div>
          </div>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}

function RailRow({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      data-active={active ? 'true' : 'false'}
      aria-current={active ? 'page' : undefined}
      className={`gv-acct-row flex items-center gap-3 rounded-[14px] ${link.sub ? 'px-2.5' : 'px-3'} ${FOCUS}`}
      style={{
        minHeight: link.sub ? 40 : 44,
        color: INK_SOFT,
        textDecoration: 'none',
        fontFamily: FONT,
        fontSize: link.sub ? 14 : 15,
        fontWeight: active ? 800 : 600,
      }}
    >
      <DuoIcon Icon={link.Icon} size={link.sub ? 16 : 18} active={active} />
      <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{link.label}</span>
      {link.badge !== undefined && <NavCount n={link.badge} />}
    </Link>
  );
}

/** The plan as a plain word (Free / Unlimited), and the credits held. */
function PlanLine({ unlimited, balance }: { unlimited: boolean; balance: number | null }) {
  return (
    <p className="flex items-center flex-wrap gap-x-2 gap-y-0.5" style={{ margin: '3px 0 0', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
      <span className="inline-flex items-center gap-1" style={{ fontWeight: 700, color: unlimited ? FOREST : INK_SOFT }}>
        {unlimited
          ? <InfinityIcon size={14} strokeWidth={2.4} style={{ color: DEEP_GOLD }} aria-hidden />
          : <Sparkles size={13} strokeWidth={2.2} style={{ color: DEEP_GOLD }} aria-hidden />}
        {unlimited ? 'Unlimited' : 'Free'}
      </span>
      {!unlimited && balance !== null && (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{balance}</span>
          {balance === 1 ? 'credit' : 'credits'}
        </span>
      )}
    </p>
  );
}
