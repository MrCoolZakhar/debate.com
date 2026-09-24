'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe, Languages } from 'lucide-react';
import LanguageRequestDialog from '@/components/LanguageRequestDialog';
import { isSessionsPath } from '@/lib/sessionRoutes';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import AuthLink from '@/components/auth/AuthLink';
import { useCredits } from '@/hooks/useCredits';
import { CreditCoin } from '@/components/CreditCoin';
import ActivityNotices from '@/components/profile/ActivityNotices';
import { useMyActivity, useOpenSeenState, markActivitySeen, isVisibleActivity } from '@/lib/myActivity';

const NAV_LINKS_CONFIG = [
  // Written in sentence case and set in capitals by CSS (textTransform), at
  // weight 800 (900 active) with light tracking (owner, 24 Sep 2026: caps; in
  // Albert Sans anything lighter than 800 reads too thin for the nav). The Sessions link reads
  // "Start Session": `kicker` is the small word stacked above the label.
  { en: 'Session',     es: 'Sesión',       fr: 'Session',         ar: 'جلسة',       href: '/sessions',
    kicker: { en: 'Start', es: 'Iniciar', fr: 'Lancer', ar: 'ابدأ' } },
  // "Explore Conferences", stacked like "Start Session" (owner, 25 Sep 2026).
  { en: 'Conferences', es: 'Conferencias', fr: 'Conférences',     ar: 'المؤتمرات',  href: '/conferences/explore',
    kicker: { en: 'Explore', es: 'Explorar', fr: 'Explorer', ar: 'استكشف' } },
  // HOME sits in the middle of the pill and is the lit item on the landing page
  // the moment someone opens it (owner, 25 Sep 2026).
  { en: 'Home',        es: 'Inicio',       fr: 'Accueil',         ar: 'الرئيسية',   href: '/' },
  { en: 'About us',    es: 'Nosotros',     fr: 'Qui sommes-nous', ar: 'من نحن',     href: '/about' },
  { en: 'Contact',     es: 'Contáctanos',  fr: 'Contact',         ar: 'تواصل معنا', href: '/contact' },
];

/** The CONFERENCES link opens the directory; it stays lit on any public
 *  conferences page (explore, map, roles, a conference page). */
function isNavLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/conferences/explore') return pathname.startsWith('/conferences');
  return pathname === href;
}

interface SiteNavProps {
  logoOverride?: { src: string; alt: string };
  /** Which wordmark to show, stated rather than inferred. `usePathname()` is
   *  not reliable during a static prerender — the homepage is ISR-rendered and
   *  has been shipping the SESSIONS mark in its prerendered HTML despite the
   *  path being '/', which no local build reproduces. A page that knows its own
   *  brand should say so instead of leaving it to a heuristic. */
  brand?: 'conferences' | 'sessions';
  /**
   * Overlay mode: the header floats transparently over the page's hero media
   * instead of occupying a 72px ivory strip that cuts the hero off at the top.
   * Ink-colored controls switch to light-on-dark treatment.
   */
  overlay?: boolean;
  /**
   * Hide the language (globe) toggle. Used on conference-side surfaces that
   * are not translated yet, so the toggle would offer no working choices.
   */
  hideLanguage?: boolean;
}

export default function SiteNav({ logoOverride, overlay = false, hideLanguage: hideLanguageProp = false, brand }: SiteNavProps = {}) {
  const pathname = usePathname();
  // Languages are a sessions feature: every conferences-side page is English
  // only and shows no switcher (owner, 18 Sep 2026).
  const hideLanguage = hideLanguageProp || !isSessionsPath(pathname);
  const [requestLangOpen, setRequestLangOpen] = useState(false);
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, session, signOut, loading: authLoading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { balance: creditBalance, loading: creditsLoading } = useCredits();
  // The hamburger sheet is where a phone user looks first, and the avatar menu
  // beside it is easy to miss, so the sheet hand-rolls its own account block
  // with the unfinished-application entries too (with its own lazy fetch, gated on the sheet being open).
  //
  // Mirrors the dropdown's treatment: one gold-washed row PER draft, tagged
  // UNFINISHED and linking straight back into that application's wizard —
  // never an aggregate row, and never something that reads like attendance.
  //
  // Since 23 Sep 2026 that block is the same "Needs your attention" section as
  // the avatar menu (src/lib/myActivity.ts, components/profile/ActivityNotices),
  // drafts included, and opening the sheet stamps news as seen just as the menu does.
  const activityUid = authLoading ? null : user?.id ?? null;
  const activityToken = session?.access_token ?? null;
  const { items: activity } = useMyActivity(activityUid, activityToken, { maxAgeMs: menuOpen ? 60_000 : Infinity });
  const sheetSeen = useOpenSeenState(activityUid);
  const sheetStamped = useRef(false);
  useEffect(() => {
    if (!menuOpen) { sheetStamped.current = false; return; }
    if (!activityUid || sheetStamped.current || !activity) return;
    sheetStamped.current = true;
    markActivitySeen(activityUid, activityToken);
  }, [menuOpen, activityUid, activity, activityToken]);
  const sheetAttention = useMemo(
    () => (activity ?? []).filter((i) => isVisibleActivity(i, sheetSeen)),
    [activity, sheetSeen],
  );
  const t = useT();
  const navLinks = NAV_LINKS_CONFIG.map(l => ({
    label: l[language],
    href: l.href,
    kicker: 'kicker' in l && l.kicker ? l.kicker[language] : null,
  }));

  // The sheet animates on max-height, so it needs a PIXEL height — but that
  // height used to be hand-computed arithmetic (480px plus a per-draft
  // allowance). Anything the arithmetic did not know about was simply cut off:
  // on a sessions path the language block (four locale buttons plus "Request a
  // language", ~150px) pushed the content to 537px against the 480px cap, so
  // SIGN OUT / SIGN IN — the last row, and the only way out of an account —
  // was clipped and untappable at EVERY phone size. Measure the content
  // instead, and clamp it to the room left under the 72px bar so a short phone
  // scrolls the sheet rather than losing its last row.
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetMax, setSheetMax] = useState(0);
  const [sheetScrolls, setSheetScrolls] = useState(false);
  useEffect(() => {
    // A closed sheet needs no measurement, and `sheetScrolls` is only ever read
    // together with `menuOpen`, so there is nothing to reset on the way out.
    if (!menuOpen) return;
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => {
      const content = el.scrollHeight;
      // Leave the bar itself plus a little breathing room below the sheet.
      const room = Math.max(200, window.innerHeight - 72 - 12);
      setSheetMax(Math.min(content, room));
      setSheetScrolls(content > room);
    };
    measure();
    // Drafts and the credit balance arrive after the sheet is already open, so
    // re-measure on content growth rather than guessing at a dependency list.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [menuOpen]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Brand-per-context: conferences-area pages get the "GAVELLING CONFERENCES"
  // logo lockup (/Conferences.webp, .png fallback) — the same mark the footer,
  // manage header and auth card use. Sessions pages get the "GAVELLING SESSIONS
  // APP" logo (/GavellingSessionsApp.png). This mirrors the wordmark text the
  // nav already switches per context.
  const CONFERENCES_PREFIXES = ['/conferences', '/manage', '/account', '/auth', '/my-conferences', '/invites'];
  // `!pathname` defaults to the CONFERENCES lockup on purpose. usePathname() can
  // resolve to null while a page is being statically prerendered, and when that
  // happened the homepage baked the SESSIONS logo into its static HTML — every
  // first-time visitor to gavelling.com saw the wrong brand until hydration
  // swapped it. Gavelling is conferences-first, so an unknown path must fall
  // back to conferences rather than to sessions.
  // An explicit `brand` always wins; the pathname heuristic is only the
  // fallback for pages that have not said which side of the product they are.
  const inConferencesArea =
    !logoOverride && (
      brand ? brand === 'conferences'
        : (!pathname || pathname === '/' || CONFERENCES_PREFIXES.some(p => pathname.startsWith(p)))
    );
  // Transparent WEBP: the original .png has NO alpha and carried a solid
  // #F2F2F2 plate, which showed as a pale block behind the mark on the
  // site's ivory. The .png remains as the onError fallback.
  const logoSrc = logoOverride?.src ?? '/GavellingSessionsApp.webp';
  const logoAlt = logoOverride?.alt ?? 'Gavelling Sessions';

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    window.location.href = '/';
  }

  /*
    The desktop pill nav. It sits in the MIDDLE of the header row, between the
    logo (left) and the language/auth controls (right).

    It used to be `position: fixed; top: 0; z-40`, so it stayed pinned to the
    viewport while the rest of its own header scrolled away — a translucent
    object floating over whatever the page put in its top 72px. That is a
    collision machine, and it collided: the conference detail page's sticky
    section tabs stick at `top: 12px` under a `z-30`, so the pill covered them
    outright; the public CV bar is `sticky top-0 z-20`; the apply wizard's step
    rail (PREFERENCES / EXPERIENCE ...) scrolled straight under it. Raising the
    pill's z-index is the wrong direction — it is the thing doing the covering.
    Giving pages an opt-out (a data attribute, an observer that hides the nav
    when a sticky bar is in view) means the nav vanishes and reappears as you
    scroll, which is the "controls that vanish or move" the rulebook rules out,
    and it would still need every page to cooperate.

    UPDATE 24 Sep 2026 (owner: "the nav pill now doesn't move with the page as it
    scrolls, fix"): the pill is FIXED again, at the same 72px band it sits in at scroll
    top, z-40. The collisions below are handled at the sticky bars instead: on desktop
    (lg+, the only widths the pill exists at: five items since 25 Sep 2026 need 1024px, so 768 to 1023 use the phone menu) every sticky bar on a page with this nav
    sticks at 84px or lower (conference page tabs and rail, explore filters; roles and
    account already did). A NEW sticky bar on a page with SiteNav must do the same.

    Before that (20 Sep): the pill was simply part of the header, like the two things beside it:
    absolutely centred inside `<nav>` (which is `relative`, or `absolute` in
    overlay mode — both are positioning contexts), at the exact y it already
    occupied at scroll top, so nothing moves visually. Nothing in the document
    is fixed to the top any more, so NO page can be covered by it, today or
    when a page grows a sticky bar tomorrow. The header is reachable the way
    the brand mark and the account menu already were: at the top of the page.

    Pointer events stay limited to the pill itself so the centred band cannot
    swallow a click meant for the logo row behind it.
  */
  const desktopPill = (
    <div
      className="hidden lg:flex fixed top-0 left-1/2 -translate-x-1/2 items-center pointer-events-none"
      style={{ zIndex: 40, height: 72 }}
    >
        <div
          className="flex items-center rounded-full pointer-events-auto"
          style={{
            backgroundColor: 'rgba(250, 248, 243, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(221, 212, 192, 0.85)',
            boxShadow: '0 8px 32px rgba(27, 56, 40, 0.12), 0 2px 8px rgba(27, 56, 40, 0.08)',
            padding: '6px 8px',
          }}
        >
          {navLinks.map((link) => {
            const active = isNavLinkActive(pathname, link.href);
            const hl = hovered === link.label;
            return (
              <Link
                key={link.label}
                href={link.href}
                onMouseEnter={() => setHovered(link.label)}
                onMouseLeave={() => setHovered(null)}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  position: 'relative',
                  // Five items since 25 Sep 2026 (HOME in the middle): never wrap a
                  // label, and tighten the padding on narrower desktops.
                  whiteSpace: 'nowrap',
                  padding: '8px clamp(9px, 1.15vw, 16px)',
                  fontSize: 'clamp(12px, 0.95vw, 13.5px)',
                  fontWeight: active ? 900 : 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: "var(--font-brand), sans-serif",
                  color: active ? '#EED98A' : hl ? '#1B3828' : 'rgba(28, 20, 16, 0.55)',
                  textDecoration: 'none',
                  borderRadius: '9999px',
                  transition: 'color 200ms cubic-bezier(0.22,1,0.36,1), background-color 200ms cubic-bezier(0.22,1,0.36,1), transform 200ms cubic-bezier(0.22,1,0.36,1)',
                  backgroundColor: active ? '#1B3828' : hl ? 'rgba(27, 56, 40, 0.06)' : 'transparent',
                  transform: hl && !active ? 'translateY(-1px)' : 'translateY(0)',
                }}
              >
                {link.kicker ? (
                  // "Start" small on top, the label beneath, one pill tall.
                  <span className="flex flex-col items-center" style={{ lineHeight: 1 }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.85, marginBottom: '2px' }}>{link.kicker} </span>
                    <span>{link.label}</span>
                  </span>
                ) : link.label}
                <span style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '16px',
                  right: '16px',
                  height: '1px',
                  backgroundColor: '#B6871F',
                  transform: hl && !active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 200ms ease',
                  borderRadius: '2px',
                }} />
              </Link>
            );
          })}
        </div>
    </div>
  );

  return (
    <>
      <nav
        className={`${overlay ? 'absolute top-0 left-0 right-0' : 'relative'} z-30 flex items-center justify-between px-6 md:px-14 shrink-0`}
        style={{ height: '72px' }}
      >
        {desktopPill}
        {/* Logo + language toggle (left side) */}
        <div className="flex items-center gap-1">
          <Link href="/" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
            {inConferencesArea ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/Conferences.webp"
                alt="Gavelling Conferences"
                width={144}
                height={36}
                decoding="async"
                loading="eager"
                fetchPriority="high"
                style={{
                  height: 36,
                  width: 'auto',
                  objectFit: 'contain',
                  // Until the bitmap arrives the browser paints the ALT TEXT
                  // (and a broken-image glyph) into the reserved 144x36 box —
                  // the ugly block that flashed on every cold load. Transparent
                  // text hides that flash; `alt` is untouched, so screen readers
                  // and crawlers still get the name.
                  color: 'transparent',
                  filter: overlay ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : undefined,
                }}
                onError={(e) => {
                  // .webp can intermittently fail to decode (cache/partial); fall
                  // back to the .png once before giving up, never hide outright.
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.src.endsWith('/Conferences.png')) img.src = '/Conferences.png';
                  else img.style.display = 'none';
                }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoSrc}
                alt={logoAlt}
                width={160}
                height={40}
                decoding="async"
                loading="eager"
                fetchPriority="high"
                className="h-8 md:h-10 w-auto object-contain"
                style={{
                  // Same alt-text flash guard as the conferences lockup above.
                  color: 'transparent',
                  ...(overlay
                    ? { filter: 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(500%) hue-rotate(5deg) brightness(105%) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }
                    : {}),
                }}
                onError={(e) => {
                  // Retry ONCE past a partial/failed cache entry. Never
                  // display:none — that was how the logo used to vanish for the
                  // rest of the session after a single transient failure.
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.dataset.retried) {
                    img.dataset.retried = '1';
                    img.src = `${logoSrc}?reload=1`;
                  }
                }}
              />
            )}
          </Link>

          {/* Language toggle (desktop only — mobile keeps its own toggle in the hamburger menu) */}
          {!hideLanguage && (
          <div className="hidden lg:block relative" ref={langMenuRef}>
            <div className="relative" suppressHydrationWarning>
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors focus:outline-none"
                style={{ color: overlay ? '#EDE7D8' : '#1B3828', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textShadow: overlay ? '0 1px 4px rgba(0,0,0,0.35)' : undefined }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = overlay ? 'rgba(250,248,243,0.14)' : 'rgba(27,56,40,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Globe size={14} strokeWidth={2} />
                <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, letterSpacing: '0.06em' }}>{language.toUpperCase()}</span>
              </button>
            </div>
            {showLangMenu && (
              <div
                className="absolute left-0 mt-1 w-36 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1px solid #DDD4C0',
                  boxShadow: '0 8px 24px rgba(27,56,40,0.12)',
                  zIndex: 50,
                }}
              >
                {(['en', 'es', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setShowLangMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                    style={{
                      color: language === lang ? '#1B3828' : '#9A8A78',
                      fontWeight: language === lang ? 800 : 600,
                      fontFamily: "var(--font-brand), sans-serif",
                      letterSpacing: '0.04em',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {lang === 'en' ? t('settings_english') : lang === 'es' ? t('settings_spanish') : lang === 'fr' ? t('settings_french') : 'العربية'}
                    {language === lang && <span className="ml-1" style={{ color: '#B6871F' }}>✓</span>}
                  </button>
                ))}
                <div style={{ height: 1, backgroundColor: '#DDD4C0' }} />
                <button
                  type="button"
                  onClick={() => { setShowLangMenu(false); setRequestLangOpen(true); }}
                  className="w-full flex items-center gap-2 text-start px-4 py-2.5 text-sm transition-colors focus:outline-none"
                  style={{ color: '#1B3828', fontWeight: 700, fontFamily: "var(--font-brand), sans-serif", backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <Languages size={14} strokeWidth={2.2} aria-hidden />
                  {t('lang_request_open')}
                </button>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Desktop right actions */}
        <div className="hidden lg:flex items-center gap-3">

          {/* Credit chip */}
          {user && (
            <Link
              href="/account/unlimited"
              data-credits-chip
              className="relative flex items-center gap-1.5 focus:outline-none"
              style={{
                backgroundColor: '#1B3828',
                color: '#EED98A',
                borderRadius: '9999px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                fontFamily: "var(--font-brand), sans-serif",
                textDecoration: 'none',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              <CreditCoin size={16} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{creditsLoading || creditBalance === null ? '—' : creditBalance}</span>
            </Link>
          )}

          {/* Auth section */}
          {user ? (
            /* Account button + shared dropdown */
            /* The avatar alone (picture, else initials) opens the shared menu. */
            <ProfileAvatarMenu size={60} />
          ) : (
            /* Signed-out: SIGN IN only */
            <AuthLink
              className="font-bold transition-colors focus:outline-none"
              style={{
                color: overlay ? '#EDE7D8' : '#1B3828',
                fontSize: '13.5px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: "var(--font-brand), sans-serif",
                textDecoration: 'none',
                textShadow: overlay ? '0 1px 4px rgba(0,0,0,0.35)' : undefined,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
            >
              Sign in
            </AuthLink>
          )}
        </div>

        {/* Mobile: avatar (signed in) + hamburger */}
        <div className="lg:hidden flex items-center gap-2">
        {user && <ProfileAvatarMenu size={56} />}
        <button
          // 44x44: the tap-target floor. This button only ever renders on a
          // phone (the wrapper is lg:hidden), so desktop is untouched.
          className="flex flex-col justify-center items-center w-11 h-11 gap-1.5"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span
            className="block w-6 h-0.5 rounded-full transition-[transform,background-color] duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-[opacity,background-color] duration-300"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-6 h-0.5 rounded-full transition-[transform,background-color] duration-300 origin-center"
            style={{
              backgroundColor: overlay ? '#EDE7D8' : '#1B3828',
              transform: menuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
        </div>
      </nav>

      {/* Mobile dropdown menu.
          In overlay mode the <nav> is absolutely positioned (out of flow), so a
          normal-flow dropdown would collapse to the top of the hero and the
          floating logo/hamburger would sit on top of its first item (SESSIONS).
          Pin it just below the 72px nav bar so every tab is visible. */}
      <div
        className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ${overlay ? 'absolute left-0 right-0 z-40' : 'relative z-20'}`}
        style={{
          top: overlay ? '72px' : undefined,
          // Measured, never guessed — see the sheetMax effect above.
          maxHeight: menuOpen ? `${sheetMax}px` : '0px',
          // Only a sheet that genuinely does not fit scrolls; `overflow-hidden`
          // (the class) still handles the closed state and the X axis.
          overflowY: menuOpen && sheetScrolls ? 'auto' : undefined,
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          backgroundColor: '#FAF8F3',
          borderBottom: menuOpen ? '1px solid #DDD4C0' : 'none',
        }}
      >
        <div ref={sheetRef} className="flex flex-col px-6 py-4 gap-1">
          {navLinks.map((link) => {
            const active = isNavLinkActive(pathname, link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  fontSize: '14.5px',
                  fontWeight: active ? 900 : 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: active ? '#1B3828' : 'rgba(28, 20, 16, 0.65)',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  backgroundColor: active ? 'rgba(27, 56, 40, 0.07)' : 'transparent',
                  borderLeft: active ? '3px solid #B6871F' : '3px solid transparent',
                  transition: 'color 150ms ease, background-color 150ms ease, border-left-color 150ms ease',
                }}
              >
                {link.kicker ? `${link.kicker} ${link.label}` : link.label}
              </Link>
            );
          })}

          {!hideLanguage && (
            <>
              <div style={{ height: '1px', backgroundColor: '#DDD4C0', margin: '8px 0' }} />

              {/* Mobile language toggle */}
              <div className="flex gap-2 px-2 pb-1">
                {(['en', 'es', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold focus:outline-none transition-colors"
                    style={{
                      backgroundColor: language === lang ? '#1B3828' : 'rgba(27,56,40,0.07)',
                      color: language === lang ? '#EED98A' : '#1B3828',
                      border: language === lang ? 'none' : '1px solid rgba(27,56,40,0.18)',
                      fontFamily: "var(--font-brand), sans-serif",
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'en' ? `EN: ${t('settings_english')}` : lang === 'es' ? `ES: ${t('settings_spanish')}` : lang === 'fr' ? `FR: ${t('settings_french')}` : 'AR: العربية'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setRequestLangOpen(true); }}
                className="mx-2 mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                style={{ width: 'calc(100% - 16px)', color: '#1B3828', fontFamily: "var(--font-brand), sans-serif", backgroundColor: 'transparent', border: '1px dashed rgba(27,56,40,0.3)', cursor: 'pointer' }}
              >
                <Languages size={15} strokeWidth={2.2} aria-hidden />
                {t('lang_request_open')}
              </button>
            </>
          )}

          <div style={{ height: '1px', backgroundColor: '#DDD4C0', margin: '8px 0' }} />

          {user ? (
            <>
              <div className="px-4 py-2">
                <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
                  {profile?.display_name ?? user.email?.split('@')[0]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
                  {profile?.email ?? user.email}
                </p>
              </div>

              {/* Needs your attention: invitations, payments, replies, drafts and
                  organiser work, each row a link to where it is done. */}
              <ActivityNotices items={sheetAttention} variant="sheet" onNavigate={() => setMenuOpen(false)} />

              <Link
                href="/account/unlimited"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 focus:outline-none"
                style={{
                  padding: '10px 16px',
                  margin: '0 0 4px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(27, 56, 40, 0.07)',
                  textDecoration: 'none',
                }}
              >
                <CreditCoin size={16} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B3828', fontFamily: "var(--font-brand), sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  {creditsLoading || creditBalance === null ? '—' : creditBalance}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif", letterSpacing: '0.02em' }}>
                  Credits &amp; Subscription
                </span>
              </Link>

              <button
                onClick={handleSignOut}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 16px',
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#8B2020',
                  backgroundColor: 'rgba(139, 32, 32, 0.08)',
                  border: '1px solid rgba(139, 32, 32, 0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: "var(--font-brand), sans-serif",
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <AuthLink
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block',
                padding: '13px 16px',
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#1B3828',
                backgroundColor: 'rgba(27, 56, 40, 0.07)',
                border: '1.5px solid rgba(27, 56, 40, 0.25)',
                borderRadius: '10px',
                textAlign: 'center',
                textDecoration: 'none',
                fontFamily: "var(--font-brand), sans-serif",
              }}
            >
              Sign in
            </AuthLink>
          )}
        </div>
      </div>
      {!hideLanguage && <LanguageRequestDialog open={requestLangOpen} onClose={() => setRequestLangOpen(false)} />}
    </>
  );
}
