/**
 * The three product banners every blog post (ArticleLayout) and premium guide
 * wears, so a reader who came for the answer can reach the product (owner,
 * 19 Oct 2026). Each has ONE button and a different message and layout:
 *
 *   TOP     a compact strip under the article header: the free live session
 *           tool, with the post's own `pitch` as its line (hidden on a phone).
 *   MIDDLE  inside the prose, before the middle H2 (insertBeforeMiddleH2 in
 *           prose.tsx): find a conference, the homepage's placard photo with
 *           the delegate's phone rising over it.
 *   BOTTOM  the landing-style banner after the article: organisers pay
 *           nothing, the laptop with the phone over its corner, plus one text
 *           link for chairs.
 *
 * Topic match, deterministic: a post that leads with the organiser message
 * (`leadsWithOrganisers`) swaps TOP and BOTTOM, so an organiser reads the
 * organiser banner first and the session one at the end.
 *
 * Server components: every link is a real <a href> in the HTML. Only the
 * click counter (BannerLink) runs on the client. The devices are the landing
 * page's own renders, never a drawn UI.
 */

import Image from 'next/image';
import { CalendarRange, MonitorSmartphone } from 'lucide-react';
import type { BlogCategory } from '@/app/blog/posts';
import BannerLink from './BannerLink';
import s from './ProductBanners.module.css';

export type BannerVariant = 'sessions' | 'organisers';

const LAPTOP = { src: '/sessions/hero-laptop.webp', width: 1000, height: 610 };
const PHONE = { src: '/sessions/hero-phone.webp', width: 660, height: 1141 };
const PLACARDS = { src: '/roles/delegate.jpg', width: 1024, height: 365 };

const LAPTOP_ALT = "The chair's screen in Gavelling Sessions: the speakers list, the delegation on the floor and its speaking clock";
const PHONE_ALT = "A delegate's phone in Gavelling Sessions, with the speakers list and a Request to speak button";

// Posts on the organisers shelf that are written for a club, a teacher or an
// advisor rather than for a conference's organisers. They keep the session
// banner on top. A new organiser post leads with the organiser banner unless
// it is added here.
const NOT_ORGANISER_LEAD = new Set([
  'mun-faculty-advisor-guide',
  'start-mun-club',
  'mun-chaperone-guide',
  'mun-club-curriculum',
  'mun-team-fundraising',
  'choosing-mun-conferences',
]);

export function leadsWithOrganisers(slug: string, category: BlogCategory): boolean {
  return category === 'organisers' && !NOT_ORGANISER_LEAD.has(slug);
}

const COPY: Record<BannerVariant, {
  topTitle: string;
  topLine: string;
  button: string;
  href: string;
  eyebrow: string;
  fullTitle: string;
  fullLine: string;
  altText: string;
  altHref: string;
}> = {
  sessions: {
    topTitle: 'Run Your Committee Free',
    topLine: 'Roll call, motions, voting and scoring in one session. Free, with no account.',
    button: 'Start a free session',
    href: '/create/sessions',
    eyebrow: 'Gavelling Sessions',
    fullTitle: 'Run Your Committee on Gavelling',
    fullLine: 'Roll call, motions, voting and scoring in one session, with every delegate on their own phone. Free, with no account.',
    altText: 'Organising a conference? See how it works',
    altHref: '/organisers',
  },
  organisers: {
    topTitle: 'Organise Your Conference Free',
    topLine: 'Applications, payments and live committees in one place. Organisers pay nothing.',
    button: 'List your conference free',
    href: '/conferences/new',
    eyebrow: 'For organisers',
    fullTitle: 'Organise Your Conference on Gavelling',
    fullLine: 'Applications, allocations, payments and live committees in one place. Organisers pay nothing.',
    altText: 'Chairing a committee? Start a free session',
    altHref: '/sessions',
  },
};

/** The laptop with the phone over its lower right corner. */
function DevicePair({ laptopSizes, phoneSizes, described, eager }: {
  laptopSizes: string;
  phoneSizes: string;
  /** Real alt text where the devices are the banner's subject; decorative otherwise. */
  described?: boolean;
  eager?: boolean;
}) {
  const loading = eager ? 'eager' : 'lazy';
  return (
    <div className={s.devices}>
      <Image
        className={s.laptop}
        src={LAPTOP.src}
        width={LAPTOP.width}
        height={LAPTOP.height}
        alt={described ? LAPTOP_ALT : ''}
        sizes={laptopSizes}
        loading={loading}
      />
      <Image
        className={s.phone}
        src={PHONE.src}
        width={PHONE.width}
        height={PHONE.height}
        alt={described ? PHONE_ALT : ''}
        sizes={phoneSizes}
        loading={loading}
      />
    </div>
  );
}

/** 1. TOP: a compact strip. `line` is the post's pitch when it has one. */
export function TopBanner({ variant, line }: { variant: BannerVariant; line?: string }) {
  const c = COPY[variant];
  // A pitch written for the old foot-of-article box may end in an arrow;
  // the button is the arrow now.
  const text = (line ?? c.topLine).replace(/\s*→\s*$/, '');
  return (
    <aside className={`${s.banner} ${s.card} ${s.top}`} aria-labelledby={`gv-banner-top-${variant}`}>
      <div className={s.topDevices}>
        <DevicePair laptopSizes="160px" phoneSizes="48px" eager />
      </div>
      <div className={s.topCopy}>
        <p id={`gv-banner-top-${variant}`} className={s.title}>{c.topTitle}</p>
        <p className={s.line}>{text}</p>
      </div>
      <div className={s.topCta}>
        <BannerLink href={c.href} count={`banner/top/${variant}`} className={s.btn}>
          {c.button}
        </BannerLink>
      </div>
    </aside>
  );
}

/** 2. MIDDLE: find a conference. Sits inside the prose column. */
export function MiddleBanner() {
  return (
    <aside className={`${s.banner} ${s.card} ${s.mid}`} aria-labelledby="gv-banner-middle">
      <div className={s.midPhoto}>
        <Image
          src={PLACARDS.src}
          width={PLACARDS.width}
          height={PLACARDS.height}
          alt=""
          sizes="(min-width: 640px) 544px, 100vw"
          loading="lazy"
        />
      </div>
      <div className={s.midBody}>
        <div className={s.midCopy}>
          <p id="gv-banner-middle" className={s.title}>Find Your Next Conference</p>
          <p className={s.line}>Real Model UN conferences around the world, with committees that run live on your phone.</p>
          <BannerLink href="/conferences/explore" count="banner/middle/conferences" className={s.btn}>
            Explore conferences
          </BannerLink>
        </div>
        <div className={s.midPhone}>
          <Image
            src={PHONE.src}
            width={PHONE.width}
            height={PHONE.height}
            alt=""
            sizes="132px"
            loading="lazy"
          />
        </div>
      </div>
    </aside>
  );
}

/** 3. BOTTOM: the landing-style banner, with one text link for the other reader. */
export function BottomBanner({ variant }: { variant: BannerVariant }) {
  const c = COPY[variant];
  const Icon = variant === 'organisers' ? CalendarRange : MonitorSmartphone;
  return (
    <aside className={`${s.banner} ${s.card} ${s.full}`} aria-labelledby={`gv-banner-bottom-${variant}`}>
      <div>
        <p className={s.eyebrow}>
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
          {c.eyebrow}
        </p>
        <p id={`gv-banner-bottom-${variant}`} className={s.title}>{c.fullTitle}</p>
        <p className={s.line}>{c.fullLine}</p>
        <div className={s.fullActions}>
          <BannerLink href={c.href} count={`banner/bottom/${variant}`} className={s.btn}>
            {c.button}
          </BannerLink>
          <BannerLink href={c.altHref} count={`banner/bottom/${variant}-link`} className={s.textLink}>
            {c.altText}
          </BannerLink>
        </div>
      </div>
      <div className={s.fullDevices}>
        <DevicePair laptopSizes="(min-width: 768px) 420px, 90vw" phoneSizes="(min-width: 768px) 140px, 30vw" described />
      </div>
    </aside>
  );
}
