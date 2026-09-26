'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Globe, Languages, Plus } from 'lucide-react';
import LanguageRequestDialog from '@/components/LanguageRequestDialog';
import { isSessionsPath } from '@/lib/sessionRoutes';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import BrandLogo from '@/components/BrandLogo';
import AuthLink from '@/components/auth/AuthLink';
import { useCredits } from '@/hooks/useCredits';
import { CreditCoin } from '@/components/CreditCoin';
import { openCreditsPopup } from '@/lib/purchasePopup';
import ActivityNotices from '@/components/profile/ActivityNotices';
import { useMyActivity, useOpenSeenState, markActivitySeen, isVisibleActivity } from '@/lib/myActivity';

// Five one-word items, in this order (owner, 25 Sep 2026): Sessions, Create,
// Explore, Pricing, Help. Sentence case since the owner's taste boards (25 Sep
// 2026: no tracked capitals; the active item is ink with a short forest
// underline, Airbnb's category-rail manner, not a forest pill). No stacked
// kicker words any more. CREATE is a plain link to /create, the chooser page
// (a committee or a conference; since 25 Sep 2026 the session creator lives at
// /create/sessions). Home, About us and Contact left the nav; the footer and
// the profile menu carry them. The five items are EQUAL columns.
// Two items carry a small kicker word stacked above them (owner, 25 Sep 2026:
// "'start' session with the start being smaller on top, the same with 'list
// your' conference"). They replace the old Sessions and Create items: Start /
// Session goes to the sessions landing, List your / Conference straight into
// creating a conference. The /create chooser is still reachable from those.
const NAV_LINKS_CONFIG: ReadonlyArray<{
  en: string; es: string; fr: string; ar: string;
  kicker?: { en: string; es: string; fr: string; ar: string };
  href: string;
}> = [
  { en: 'Session', es: 'Sesión', fr: 'Session', ar: 'جلسة', kicker: { en: 'Start', es: 'Iniciar', fr: 'Lancer', ar: 'ابدأ' }, href: '/sessions' },
  { en: 'Conference', es: 'Conferencia', fr: 'Conférence', ar: 'مؤتمر', kicker: { en: 'List your', es: 'Publica tu', fr: 'Publiez votre', ar: 'أضف' }, href: '/conferences/new' },
  { en: 'Explore',  es: 'Explorar', fr: 'Explorer', ar: 'استكشف',   href: '/conferences/explore' },
  { en: 'Pricing',  es: 'Precios',  fr: 'Tarifs',   ar: 'الأسعار',  href: '/pricing/credits' },
  { en: 'Help',     es: 'Ayuda',    fr: 'Aide',     ar: 'المساعدة', href: '/help' },
];

/** SESSIONS lights on every sessions path (isSessionsPath), CREATE on the
 *  chooser and the creator under it, EXPLORE on any public conferences page
 *  (explore, map, roles, a conference page), PRICING on every /pricing page,
 *  HELP on /help. */
function isNavLinkActive(pathname: string | null, href: string | null): boolean {
  if (!pathname || !href) return false;
  if (href === '/sessions') return isSessionsPath(pathname) && !pathname.startsWith('/create');
  if (href === '/conferences/new') return pathname.startsWith('/conferences/new');
  if (href === '/conferences/explore') return pathname.startsWith('/conferences') && !pathname.startsWith('/conferences/new');
  if (href === '/pricing/credits') return pathname.startsWith('/pricing');
  if (href === '/help') return pathname === '/help' || pathname.startsWith('/help/');
  return pathname === href;
}

interface SiteNavProps {
  /** No-op since 25 Sep 2026: there is ONE wordmark (BrandLogo). Still
   *  accepted because other pages pass it. */
  logoOverride?: { src: string; alt: string };
  /** No-op since 25 Sep 2026: the Conferences / Sessions lockups are retired
   *  and every header shows the one Gavelling wordmark. Still accepted because
   *  other pages pass it. */
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

export default function SiteNav(props: SiteNavProps = {}) {
  // `logoOverride` and `brand` are still accepted (other pages pass them) but
  // no longer read: there is ONE wordmark since 25 Sep 2026.
  const { overlay = false, hideLanguage: hideLanguageProp = false } = props;
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
    kicker: l.kicker ? l.kicker[language] : null,
    href: l.href,
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
    (lg+, the only widths the pill exists at: five one-word items (SESSIONS, CREATE, EXPLORE, PRICING, HELP since 25 Sep 2026) need 1024px, so 768 to 1023 use the phone menu) every sticky bar on a page with this nav
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
          className="rounded-full pointer-events-auto"
          // FIVE EQUAL COLUMNS (owner, 25 Sep 2026: shorter words bunched up on
          // the right). A grid of `1fr` columns on an auto-width pill sizes
          // every column to the widest label, so each item has the same hit
          // area and the same spacing, whatever the language.
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${navLinks.length}, 1fr)`,
            alignItems: 'center',
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
            // One style for every item. Five one-word labels in equal columns:
            // at 1024px (1vw = 10px) 12px type with 10px side padding, about
            // 410px of pill between a 240px logo group and a 200px account
            // group; at 1280px the clamp opens to 13.5px / 16px. Never wrap.
            const itemStyle: CSSProperties = {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              gap: '4px',
              position: 'relative',
              whiteSpace: 'nowrap',
              minHeight: 44,
              padding: '8px clamp(10px, 1.1vw, 16px)',
              fontSize: 'clamp(14px, 1.05vw, 15.5px)',
              fontWeight: active ? 800 : 600,
              letterSpacing: '0',
              fontFamily: "var(--font-brand), sans-serif",
              color: active ? '#1C1410' : hl ? '#1C1410' : 'rgba(28, 20, 16, 0.62)',
              textDecoration: 'none',
              borderRadius: '9999px',
              transition: 'color 200ms cubic-bezier(0.22,1,0.36,1), background-color 200ms cubic-bezier(0.22,1,0.36,1), transform 200ms cubic-bezier(0.22,1,0.36,1)',
              backgroundColor: hl && !active ? 'rgba(27, 56, 40, 0.06)' : 'transparent',
              transform: hl && !active ? 'translateY(-1px)' : 'translateY(0)',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1.2,
            };
            const itemClass = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]';
            const underline = (
              <span aria-hidden style={{
                position: 'absolute',
                bottom: '5px',
                left: '30%',
                right: '30%',
                height: '2px',
                backgroundColor: '#1B3828',
                transform: active ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'left',
                transition: 'transform 200ms ease',
                borderRadius: '2px',
              }} />
            );
            return (
              <Link
                key={link.label}
                href={link.href}
                onMouseEnter={() => setHovered(link.label)}
                onMouseLeave={() => setHovered(null)}
                aria-current={active ? 'page' : undefined}
                className={itemClass}
                style={link.kicker ? { ...itemStyle, flexDirection: 'column', gap: 0, lineHeight: 1.05, paddingTop: 5, paddingBottom: 7 } : itemStyle}
              >
                {link.kicker && (
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'rgba(28, 20, 16, 0.5)', letterSpacing: 0 }}>{link.kicker}</span>
                )}
                {link.label}
                {underline}
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
          {/* ONE wordmark (BrandLogo, /gavelling-logo.png), linked to /, white
              over hero media. `height` is the height of the visible WORD (the
              file carries large transparent margins that BrandLogo crops), so
              32px here is a normal, legible site logo in the 72px header. */}
          <span
            className="inline-flex items-center"
            onClick={() => setMenuOpen(false)}
            style={{ filter: overlay ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : undefined }}
          >
            <BrandLogo priority height={32} tone={overlay ? 'white' : 'ink'} />
          </span>

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

          {/* Credit chip: ONE button. The coin and the number are the whole
              pill, and a click anywhere on it opens the buy-credits pop-up
              without leaving the page (owner, 25 Sep 2026: it no longer links to
              Manage account, which the profile menu still does). The small gold
              + on its top-right corner is a signifier only (aria-hidden, takes no
              pointer). `data-credits-chip` stays on the button for the
              CreditsWelcomeModal spotlight. */}
          {user && (
            <button
              type="button"
              data-credits-chip
              aria-label="Buy credits"
              title="Buy credits"
              onClick={() => openCreditsPopup({ context: 'header' })}
              // 30px pill; on a touch screen a pseudo-element widens the hit
              // area to 44px without changing what is drawn.
              className="relative flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 [@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-y-[7px] [@media(pointer:coarse)]:before:inset-x-0 [@media(pointer:coarse)]:before:content-['']"
              style={{
                backgroundColor: '#1B3828',
                color: '#EED98A',
                border: 'none',
                cursor: 'pointer',
                padding: '7px 16px 7px 14px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                fontFamily: "var(--font-brand), sans-serif",
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              <CreditCoin size={16} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{creditsLoading || creditBalance === null ? '–' : creditBalance}</span>
              {/* The + badge: 18px gold disc with an ivory ring, overlapping the
                  pill's top-right edge. Purely a signifier. */}
              <span
                aria-hidden
                className="absolute flex items-center justify-center rounded-full pointer-events-none"
                style={{
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  backgroundColor: '#EED98A',
                  color: '#1B3828',
                  boxShadow: '0 0 0 1.5px #FAF8F3',
                }}
              >
                <Plus size={12} strokeWidth={3} />
              </span>
            </button>
          )}

          {/* Auth section */}
          {user ? (
            /* Account button + shared dropdown */
            /* The avatar alone (picture, else initials) opens the shared menu. */
            <ProfileAvatarMenu size={60} />
          ) : (
            /* Signed-out: SIGN IN as a text link, the way the site draws links
               (owner, 25 Sep 2026: the gradient pill was hard to see over the
               dark hero). Light over the overlay, forest ink on light pages. */
            <AuthLink
              className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2 rounded"
              style={{
                color: overlay ? '#FAF8F3' : '#1B3828',
                height: 42,
                padding: '0 6px',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: "var(--font-brand), sans-serif",
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
                textDecorationThickness: '1.5px',
                textShadow: overlay ? '0 1px 8px rgba(0,0,0,0.35)' : undefined,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = overlay ? '#EED98A' : '#B6871F'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = overlay ? '#FAF8F3' : '#1B3828'; }}
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
            const rowStyle: CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              minHeight: 44,
              padding: '12px 16px',
              fontSize: '16px',
              fontWeight: active ? 800 : 600,
              color: active ? '#1C1410' : 'rgba(28, 20, 16, 0.7)',
              textDecoration: 'none',
              borderRadius: '10px',
              backgroundColor: active ? 'rgba(27, 56, 40, 0.07)' : 'transparent',
              borderLeft: active ? '3px solid #1B3828' : '3px solid transparent',
              transition: 'color 150ms ease, background-color 150ms ease, border-left-color 150ms ease',
              fontFamily: "var(--font-brand), sans-serif",
              textAlign: 'start',
            };
            const rowClass = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-inset';
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={rowClass}
                style={rowStyle}
              >
                {link.kicker ? `${link.kicker} ${link.label.toLowerCase()}` : link.label}
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

              {/* The phone's credit counter: the same one control as the desktop
                  chip. The whole row is a button that closes the sheet and opens
                  the buy-credits pop-up; the + badge on its corner is a signifier. */}
              <button
                type="button"
                aria-label="Buy credits"
                title="Buy credits"
                onClick={() => { setMenuOpen(false); openCreditsPopup({ context: 'header' }); }}
                className="relative flex w-full items-center gap-2 rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
                style={{
                  margin: '0 0 4px',
                  padding: '12px 16px',
                  minHeight: 44,
                  backgroundColor: 'rgba(27, 56, 40, 0.07)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                }}
              >
                <CreditCoin size={16} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B3828', fontFamily: "var(--font-brand), sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  {creditsLoading || creditBalance === null ? '–' : creditBalance}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#1B3828', fontFamily: "var(--font-brand), sans-serif" }}>
                  Buy credits
                </span>
                <span
                  aria-hidden
                  className="absolute flex items-center justify-center rounded-full pointer-events-none"
                  style={{
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    backgroundColor: '#EED98A',
                    color: '#1B3828',
                    boxShadow: '0 0 0 1.5px #FAF8F3',
                  }}
                >
                  <Plus size={12} strokeWidth={3} />
                </span>
              </button>

              <button
                onClick={handleSignOut}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 16px',
                  fontSize: '15px',
                  fontWeight: 700,
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
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#1B3828',
                background: 'transparent',
                border: 'none',
                textAlign: 'center',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
                textDecorationThickness: '1.5px',
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
