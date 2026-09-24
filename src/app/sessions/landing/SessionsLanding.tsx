'use client';

// The Sessions landing page (/sessions), redesigned 24 Sep 2026.
//
//   1. Hero: the gavel film washed to ivory, "MUN done right." on ONE line in
//      every language, Start Committee as the one big action and a smaller
//      code field under it, the chair's laptop and a delegate's phone on the
//      right as still images (the owner removed the live ticking clock).
//   2. RoleShowcase: Chairs / Delegates / Faculty advisors tabs, each showing
//      REAL screenshots of a session (public/sessions/*.png, captured from a
//      throwaway room; see public/sessions/clips.json).
//   3. ConferenceBridge: running a whole conference, with one committee drawn
//      by the organiser's real live status card (static demo data).
//
// Sessions route, so every string goes through t() in all four languages
// (sl_* keys in src/lib/translations.ts).

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import RoleShowcase from './RoleShowcase';
import ConferenceBridge from './ConferenceBridge';
import { BRAND, INK, INK_SOFT, FOREST, GOLD_TEXT, BRONZE, HAIR } from './tokens';

type Lang = 'en' | 'es' | 'fr' | 'ar';

/** The headline, one line in every language, on its own row across the
 *  whole hero (it runs above the phone). `lg` from 1024px, `sm` below it
 *  (vw-based, so it never wraps on a phone). */
const HEADLINE: Record<Lang, { lead: string; accent: string; lg: string; sm: string }> = {
  en: { lead: 'MUN done', accent: 'right.', lg: 'clamp(64px, 8.4vw, 150px)', sm: 'clamp(34px, 10.4vw, 72px)' },
  es: { lead: 'MUN como se', accent: 'debe.', lg: 'clamp(54px, 6.9vw, 124px)', sm: 'clamp(30px, 8.6vw, 64px)' },
  fr: { lead: 'MUN comme il se', accent: 'doit.', lg: 'clamp(46px, 5.8vw, 104px)', sm: 'clamp(26px, 7.2vw, 56px)' },
  ar: { lead: 'النموذج الأممي', accent: 'كما يجب.', lg: 'clamp(52px, 6.6vw, 118px)', sm: 'clamp(28px, 8.2vw, 60px)' },
};

export default function SessionsLanding() {
  const router = useRouter();
  const t = useT();
  const { language } = useLanguage();
  const lang = (['en', 'es', 'fr', 'ar'].includes(language) ? language : 'en') as Lang;
  const head = HEADLINE[lang];
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
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: '#FAF8F3', fontFamily: BRAND, color: INK }}>
      <style>{CSS}</style>

      {/* Paper grain, as on every public page */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1]" style={GRAIN} />

      <div className="relative z-10">
        <SiteNav />

        {showDeletedNotice && (
          <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 px-4 w-full flex justify-center">
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg" style={{ backgroundColor: FOREST, border: '1px solid rgba(238,217,138,0.35)', maxWidth: 420 }}>
              <p className="text-sm font-semibold flex-1" style={{ color: '#EED98A', margin: 0 }}>Your account has been deleted.</p>
              <button onClick={() => setShowDeletedNotice(false)} className="text-xs font-bold focus:outline-none" style={{ color: 'rgba(238,217,138,0.75)' }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
        <section className="sl-hero relative overflow-hidden" style={{ marginTop: -72, backgroundColor: '#EDE7D8' }}>
          {/* Plays once and rests on its last frame (owner: no loop). */}
          <video className="sl-film" autoPlay muted playsInline preload="metadata" aria-hidden>
            <source src="/hero_no_audio.webm" type="video/webm" />
            <source src="/hero_no_audio.mp4" type="video/mp4" />
          </video>
          <div aria-hidden className="sl-wash" />

          <div className="sl-hero-in relative z-[2] mx-auto w-full">
            <h1
              className="sl-h1"
              style={{ '--h1-lg': head.lg, '--h1-sm': head.sm } as CSSProperties}
            >
              {head.lead}{' '}
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: BRONZE, letterSpacing: '-0.01em' }}>
                {head.accent}
              </span>
            </h1>
            <div className="sl-copy min-w-0">
              <p className="sl-lede" style={{ color: INK_SOFT }}>{t('sl_lede')}</p>

              {/* The one big action */}
              <button type="button" onClick={() => router.push('/create')} className="sl-start focus:outline-none">
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
              <p className="sl-free" style={{ color: '#6B5F52' }}>{t('sl_free')}</p>
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

        {/* ── 2. One room, three seats ─────────────────────────────────────── */}
        <RoleShowcase />

        {/* ── 3. Running a whole conference ────────────────────────────────── */}
        <ConferenceBridge />

        {/* ── Footer (unchanged from the old page) ─────────────────────────── */}
        <footer className="relative z-10 border-t px-6 py-8" style={{ borderColor: HAIR, backgroundColor: '#F6F1E9' }}>
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/GavellingLogo.webp"
              alt="Gavelling"
              loading="lazy"
              decoding="async"
              className="h-7 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            />
            <div className="flex items-center justify-center gap-4">
              <a href="https://www.instagram.com/wearegavelling/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="sl-social">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/gavelling/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="sl-social">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
            <div className="flex flex-col items-center gap-1 md:items-end">
              <p className="text-xs font-semibold" style={{ color: FOREST, margin: 0 }}>
                {t('home_footer_copy').replace('{year}', String(new Date().getFullYear()))}
              </p>
              <Link href="/privacy" className="text-xs sl-footlink">Privacy Policy</Link>
            </div>
          </div>
          <FooterLegal tone="ivory" />
        </footer>
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
.sl-film { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .42; filter: blur(2px) saturate(.75); }
.sl-wash { position: absolute; inset: 0; background:
  linear-gradient(90deg, #EDE7D8 0%, rgba(237,231,216,.93) 34%, rgba(237,231,216,.55) 62%, rgba(237,231,216,.35) 100%),
  linear-gradient(to bottom, rgba(237,231,216,0) 74%, #FAF8F3 100%); }
[dir="rtl"] .sl-wash { background:
  linear-gradient(270deg, #EDE7D8 0%, rgba(237,231,216,.93) 34%, rgba(237,231,216,.55) 62%, rgba(237,231,216,.35) 100%),
  linear-gradient(to bottom, rgba(237,231,216,0) 74%, #FAF8F3 100%); }
.sl-hero-in { max-width: 1520px; padding: 116px clamp(16px, 4vw, 64px) 72px; display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.22fr); grid-template-areas: "h h" "copy dev";
  column-gap: clamp(24px, 3vw, 56px); row-gap: clamp(8px, 1.2vw, 20px); align-items: start; }
.sl-h1 { grid-area: h; position: relative; z-index: 3; margin: 0; font-weight: 800; line-height: 0.98; letter-spacing: -0.04em; white-space: nowrap; color: ${INK}; font-size: var(--h1-lg); }
.sl-copy { grid-area: copy; padding-top: clamp(8px, 1.6vw, 28px); }
.sl-lede { font-size: 16.5px; line-height: 1.6; margin: 0; max-width: 31em; }
.sl-start { display: inline-flex; align-items: center; justify-content: center; margin-top: 28px; height: 64px; padding: 0 44px;
  border: 0; border-radius: 9999px; background: ${FOREST}; color: ${GOLD_TEXT}; font: 700 19px/1 ${BRAND}; letter-spacing: 0.01em; cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 18px 34px -16px rgba(27,56,40,.9);
  transition: transform 160ms cubic-bezier(.22,1,.36,1), background-color 200ms ease; }
.sl-start:hover { background: #224733; }
.sl-start:active { transform: scale(.97); }
.sl-start:focus-visible { outline: 2px solid #B6871F; outline-offset: 3px; }
.sl-join { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.sl-join-box { display: inline-flex; align-items: center; height: 44px; padding: 0 4px 0 16px; border-radius: 9999px; background: rgba(255,255,255,.85); box-shadow: inset 0 0 0 1.5px ${HAIR}; }
.sl-join-box input { width: 128px; border: 0; background: transparent; outline: none; font: 700 14.5px/1 ${BRAND}; letter-spacing: .1em; text-transform: uppercase; color: ${INK}; }
.sl-join-box input::placeholder { letter-spacing: 0; text-transform: none; font-weight: 500; color: #6B5F52; }
.sl-join-box button { height: 36px; padding: 0 16px; border: 0; border-radius: 9999px; background: ${FOREST}; color: ${GOLD_TEXT}; font: 700 13.5px/1 ${BRAND}; cursor: pointer; }
.sl-join-box button:disabled { background: #D8CDB6; color: #6B5F52; cursor: default; }
.sl-join-box:focus-within { box-shadow: inset 0 0 0 1.5px ${FOREST}; }
.sl-free { margin: 12px 0 0; font-size: 13px; }
.sl-devices { grid-area: dev; position: relative; margin-inline-end: calc(-1 * clamp(16px, 4vw, 64px) - 2vw); padding-bottom: 6%; }
.sl-laptop { display: block; width: 100%; height: auto; filter: drop-shadow(0 40px 46px rgba(40,30,15,.28)) drop-shadow(0 8px 12px rgba(40,30,15,.12)); }
.sl-phone { position: absolute; inset-inline-start: -19%; bottom: -12%; width: 31%; height: auto; filter: drop-shadow(0 34px 34px rgba(30,22,10,.38)) drop-shadow(0 6px 10px rgba(30,22,10,.18)); }
.sl-social { color: #9A8A78; transition: color .15s; } .sl-social:hover { color: ${FOREST}; }
.sl-footlink { color: #9A8A78; } .sl-footlink:hover { color: ${FOREST}; }
@media (prefers-reduced-motion: no-preference) {
  .sl-laptop { animation: sl-rise 1.2s cubic-bezier(.16,1,.3,1) both; }
  .sl-phone { animation: sl-rise 1.1s .22s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sl-rise { from { opacity: 0; transform: translateY(46px); } to { opacity: 1; transform: none; } }
}
@media (max-width: 1023px) {
  .sl-hero { min-height: 0; }
  .sl-hero-in { grid-template-columns: minmax(0, 1fr); grid-template-areas: "h" "copy" "dev"; padding-top: 104px; padding-bottom: 56px; }
  .sl-copy { padding-top: 6px; }
  .sl-h1 { font-size: var(--h1-sm); }
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
@media (prefers-reduced-motion: reduce) { .sl-film { display: none; } }
`;
