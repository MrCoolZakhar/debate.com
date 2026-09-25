'use client';

// The Sessions landing page (/sessions), redesigned 24 Sep 2026, reworked
// 25 Sep 2026 to the owner's taste boards (sentence-case Airbnb buttons in the
// forest gradient, the last word of a title in gold, ivory and white only, the
// hero dissolving into the page through a mask, never a painted fade).
//
//   1. Hero: the gavel film washed to ivory, "Run the *room*" on ONE line in
//      every language, "Start committee" as the one big action and a
//      smaller code field with Join under it, the chair's laptop and a delegate's
//      phone on the right as still images.
//   2. RoleCards: "Built for every role in the *room*", one tall photo panel
//      per role (Chairs, Delegates, Faculty advisors) with the role word, one
//      line and a real action, in the homepage's role pattern.
//   3. ConferenceBridge: running a whole conference, with three committees
//      drawn by the organiser's real live status card (static demo data).
//   4. SiteFooter, the one footer every public page shares.
//
// Sessions route, so every string goes through t() in all four languages
// (sl_* keys in src/lib/translations.ts).

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { GoldButtonStyles } from '@/components/GoldButton';
import { GoldWord } from '@/components/BrandHeading';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import RoleCards from './RoleCards';
import ConferenceBridge from './ConferenceBridge';
import { BRAND, INK, INK_SOFT, FOREST, GOLD, GOLD_TEXT, HAIR, IVORY, CREAM, WHITE, CTA_GRADIENT } from './tokens';

type Lang = 'en' | 'es' | 'fr' | 'ar';

/** The headline sits on one line in every language, on its own row across
 *  the whole hero. Only the SIZE is per language (the words come from t()):
 *  `lg` from 1024px, `sm` below it (vw-based, so it never wraps on a phone).
 *  About 10% bigger than the 24 Sep sizes; French is the longest line. */
const HEADLINE_SIZE: Record<Lang, { lg: string; sm: string }> = {
  en: { lg: 'clamp(48px, 5.7vw, 95px)', sm: 'clamp(38px, 11.4vw, 80px)' },
  es: { lg: 'clamp(46px, 5.4vw, 92px)', sm: 'clamp(36px, 10.6vw, 78px)' },
  fr: { lg: 'clamp(42px, 5vw, 86px)', sm: 'clamp(32px, 9.4vw, 72px)' },
  ar: { lg: 'clamp(46px, 5.4vw, 92px)', sm: 'clamp(36px, 10.6vw, 78px)' },
};

export default function SessionsLanding() {
  const router = useRouter();
  const t = useT();
  const { language } = useLanguage();
  const lang = (['en', 'es', 'fr', 'ar'].includes(language) ? language : 'en') as Lang;
  const size = HEADLINE_SIZE[lang];
  const [joinCode, setJoinCode] = useState('');
  const [showDeletedNotice, setShowDeletedNotice] = useState(false);

  // One-off notice after an account deletion (kept from the old page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('accountDeleted') !== '1') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('accountDeleted');
    window.history.replaceState({}, '', url.toString());
    const id = window.setTimeout(() => setShowDeletedNotice(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Same routing as before: a chair code (CODE-1234) opens the chair tab.
  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    const isChairCode = code.includes('-') && code.split('-').pop()?.length === 4;
    router.push(`/join?code=${encodeURIComponent(code)}${isChairCode ? '&mode=chair' : ''}`);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: CREAM, fontFamily: BRAND, color: INK }}>
      <style>{CSS}</style>
      <GoldButtonStyles />

      {/* Paper grain, as on every public page */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1]" style={GRAIN} />

      <div className="relative z-10">
        <SiteNav />

        {showDeletedNotice && (
          <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 px-4 w-full flex justify-center" role="status">
            <div className="flex items-center gap-3 rounded-xl px-4 py-2 shadow-lg" style={{ backgroundColor: FOREST, border: '1px solid rgba(238,217,138,0.35)', maxWidth: 440 }}>
              <p className="text-sm font-semibold flex-1" style={{ color: GOLD_TEXT, margin: 0 }}>{t('sl_deleted_notice')}</p>
              <button type="button" onClick={() => setShowDeletedNotice(false)} className="sl-dismiss focus:outline-none">
                {t('sl_dismiss')}
              </button>
            </div>
          </div>
        )}

        {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
        <section className="sl-hero relative overflow-hidden" style={{ marginTop: -72 }}>
          {/* Plays once and rests on its last frame (owner: no loop). */}
          <video className="sl-film" autoPlay muted playsInline preload="metadata" aria-hidden>
            <source src="/hero_no_audio.webm" type="video/webm" />
            <source src="/hero_no_audio.mp4" type="video/mp4" />
          </video>
          <div aria-hidden className="sl-wash" />

          <div className="sl-hero-in relative z-[2] mx-auto w-full">
            <h1
              className="sl-h1"
              style={{ '--h1-lg': size.lg, '--h1-sm': size.sm } as CSSProperties}
            >
              {t('sl_h1_lead')}{' '}
              <GoldWord tone="light">{t('sl_h1_accent')}</GoldWord>
            </h1>
            <div className="sl-copy min-w-0">
              <p className="sl-lede" style={{ color: INK_SOFT }}>{t('sl_lede')}</p>

              {/* The one big action */}
              <button type="button" onClick={() => router.push('/create/sessions')} className="sl-start focus:outline-none">
                {t('sl_start')}
              </button>

              {/* Joining: a smaller, quieter second path */}
              <form
                className="sl-join"
                onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
              >
                <span className="sl-join-box">
                  <input
                    id="sl-code"
                    aria-label={t('sl_code_placeholder')}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder={t('sl_code_placeholder')}
                    maxLength={20}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="submit" className="focus:outline-none" disabled={joinCode.trim().length < 4}>
                    {t('sl_join')}
                  </button>
                </span>
              </form>
              <p className="sl-free" style={{ color: INK_SOFT }}>{t('sl_free')}</p>
            </div>

            <div className="sl-devices" aria-label={`${t('sl_alt_laptop')} ${t('sl_alt_phone')}`} role="img">
              <Image
                src="/sessions/hero-laptop.webp"
                alt=""
                width={1000}
                height={610}
                priority
                sizes="(min-width: 1024px) 56vw, 92vw"
                className="sl-laptop"
              />
              <Image
                src="/sessions/hero-phone.webp"
                alt=""
                width={660}
                height={1141}
                priority
                sizes="(min-width: 1024px) 18vw, 30vw"
                className="sl-phone"
              />
            </div>
          </div>
        </section>

        {/* ── 2. Built for every role in the room ──────────────────────────── */}
        <RoleCards />

        {/* ── 3. Running a whole conference ────────────────────────────────── */}
        <ConferenceBridge />

        {/* ── Footer: the one shared footer ────────────────────────────────── */}
        <SiteFooter copy={t('home_footer_copy')} />
      </div>
    </div>
  );
}

const GRAIN: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'repeat',
  backgroundSize: '300px 300px',
  mixBlendMode: 'multiply',
  opacity: 0.14,
};

const CSS = `
.sl-hero { min-height: min(100svh, 960px); display: flex; align-items: center; }
.sl-film { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .42; filter: blur(2px) saturate(.75);
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%); mask-image: linear-gradient(to bottom, #000 78%, transparent 100%); }
.sl-wash { position: absolute; inset: 0; background:
  linear-gradient(90deg, ${IVORY} 0%, rgba(237,231,216,.93) 34%, rgba(237,231,216,.55) 62%, rgba(237,231,216,.35) 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%); mask-image: linear-gradient(to bottom, #000 78%, transparent 100%); }
[dir="rtl"] .sl-wash { background:
  linear-gradient(270deg, ${IVORY} 0%, rgba(237,231,216,.93) 34%, rgba(237,231,216,.55) 62%, rgba(237,231,216,.35) 100%); }
.sl-hero-in { max-width: 1520px; padding: 116px clamp(16px, 4vw, 64px) 72px; display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.22fr); grid-template-areas: "h dev" "copy dev"; grid-template-rows: auto 1fr;
  column-gap: clamp(24px, 3vw, 56px); row-gap: 0; align-items: start; }
.sl-h1 { grid-area: h; align-self: end; padding-top: clamp(12px, 2.4vw, 44px); position: relative; z-index: 3; margin: 0; font-weight: 800; line-height: 0.98; letter-spacing: -0.04em; white-space: nowrap; color: ${INK}; font-size: var(--h1-lg); }
.sl-copy { grid-area: copy; padding-top: clamp(14px, 1.4vw, 22px); }
.sl-lede { font-size: clamp(18px, 1.4vw, 21px); font-weight: 500; line-height: 1.4; margin: 0; max-width: 28em; letter-spacing: -0.005em; }
.sl-start { display: inline-flex; align-items: center; justify-content: center; margin-top: 28px; min-height: 56px; padding: 0 32px;
  border: 0; border-radius: 12px; background: ${CTA_GRADIENT}; color: ${WHITE}; font: 700 17px/1 ${BRAND}; cursor: pointer;
  box-shadow: 0 10px 24px -14px rgba(27,56,40,.8);
  transition: transform 160ms cubic-bezier(.22,1,.36,1), filter 200ms ease; }
.sl-start:hover { filter: brightness(1.08); }
.sl-start:active { transform: scale(.97); }
.sl-start:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; }
.sl-join { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.sl-join-box { display: inline-flex; align-items: center; height: 52px; padding: 0 4px 0 16px; border-radius: 12px; background: rgba(255,255,255,.85); box-shadow: inset 0 0 0 1.5px ${HAIR}; }
.sl-join-box input { width: 136px; height: 44px; border: 0; background: transparent; outline: none; font: 700 15px/1 ${BRAND}; letter-spacing: .1em; text-transform: uppercase; color: ${INK}; }
.sl-join-box input::placeholder { letter-spacing: 0; text-transform: none; font-weight: 500; color: ${INK_SOFT}; }
.sl-join-box button { min-height: 44px; padding: 0 18px; border: 0; border-radius: 10px; background: ${CTA_GRADIENT}; color: ${WHITE}; font: 700 15px/1 ${BRAND}; cursor: pointer; transition: filter 200ms ease; }
.sl-join-box button:hover:not(:disabled) { filter: brightness(1.08); }
.sl-join-box button:disabled { background: ${IVORY}; color: ${INK_SOFT}; cursor: default; }
.sl-join-box button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
.sl-join-box:focus-within { box-shadow: inset 0 0 0 1.5px ${FOREST}; background: ${WHITE}; }
.sl-free { margin: 12px 0 0; font-size: 13.5px; font-weight: 500; }
.sl-dismiss { min-height: 44px; padding: 0 8px; background: transparent; border: 0; color: rgba(238,217,138,.85); font: 700 14px/1 ${BRAND}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.sl-dismiss:hover { color: ${GOLD_TEXT}; }
.sl-dismiss:focus-visible { outline: 2px solid ${GOLD_TEXT}; outline-offset: 2px; border-radius: 6px; }
.sl-devices { grid-area: dev; align-self: center; position: relative; margin-inline-end: calc(-1 * clamp(16px, 4vw, 64px) - 2vw); padding-bottom: 6%; }
.sl-laptop { display: block; width: 100%; height: auto; filter: drop-shadow(0 40px 46px rgba(28,20,16,.28)) drop-shadow(0 8px 12px rgba(28,20,16,.12)); }
.sl-phone { position: absolute; inset-inline-start: -19%; bottom: -12%; width: 31%; height: auto; filter: drop-shadow(0 34px 34px rgba(28,20,16,.38)) drop-shadow(0 6px 10px rgba(28,20,16,.18)); }
@media (prefers-reduced-motion: no-preference) {
  .sl-laptop { animation: sl-rise 1.2s cubic-bezier(.16,1,.3,1) both; }
  .sl-phone { animation: sl-rise 1.1s .22s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sl-rise { from { opacity: 0; transform: translateY(46px); } to { opacity: 1; transform: none; } }
}
@media (max-width: 1023px) {
  .sl-hero { min-height: 0; }
  .sl-hero-in { grid-template-columns: minmax(0, 1fr); grid-template-areas: "h" "copy" "dev"; grid-template-rows: auto; padding-top: 104px; padding-bottom: 56px; }
  .sl-copy { padding-top: 6px; }
  .sl-h1 { font-size: var(--h1-sm); padding-top: 0; }
  .sl-devices { margin: 40px -8% 24px 17%; }
  [dir="rtl"] .sl-devices { margin: 40px 17% 24px -8%; }
  .sl-phone { inset-inline-start: -22%; bottom: -16%; }
}
@media (max-width: 520px) {
  .sl-start { width: 100%; }
  .sl-join { width: 100%; }
  .sl-join-box { flex: 1; }
  .sl-join-box input { flex: 1; min-width: 0; width: auto; }
}
@media (prefers-reduced-motion: reduce) { .sl-film { display: none; } .sl-start, .sl-join-box button { transition: none; } }
`;
