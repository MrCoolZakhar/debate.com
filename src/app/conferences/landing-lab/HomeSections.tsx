'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Homepage sections added 24 Sep 2026 (owner's brief), mounted by
// VariantStagefront.tsx. Kept in their own file so the big composition stays a
// thin list of sections.
//
//   SessionsSection   second on the page: laptop | "MUN done right." | phone, with
//                     START COMMITTEE and the join-with-a-code field the
//                     sessions landing hero has (25 Sep 2026)
//   LearnMunSection   third on the page: six evergreen guides from
//                     src/app/blog/posts.ts on a FOREST band (owner, 25 Sep
//                     2026), each a real <a href="/blog/<slug>"> in the HTML
//   AboutCards        last before the footer: "What is Model United Nations?"
//                     (the SEO explainer, text unchanged) beside "What is
//                     Gavelling?"
//
// Client module only for the code field's state and router; everything else
// is static markup that still renders on the server with the page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, ArrowRight, BookOpen, Clock, GraduationCap, Landmark, MonitorSmartphone } from 'lucide-react';
import { CardPhoto } from '@/components/blog/BlogPhoto';
import type { PhotoId } from '@/components/blog/photos';
import { GoldWord } from '@/components/BrandHeading';
import { CREAM, FOREST, GOLD, PALE_GOLD, SANS } from './shared';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const INK_55 = '#6B5F52';
const HAIR = '#DDD4C0';
const CARD = '#FFFDF8';

const eyebrow: React.CSSProperties = {
  fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(12px, 0.8vw, 14px)', letterSpacing: '0.14em',
  textTransform: 'uppercase', color: GOLD, margin: '0 0 10px 0',
};

// Every text link on the page is bold and underlined (owner, 25 Sep 2026).
const textLink: React.CSSProperties = {
  fontFamily: SANS, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationThickness: '1.5px',
};

// ── 1. Running a committee ──────────────────────────────────────────────────

export function SessionsSection() {
  const router = useRouter();
  const [code, setCode] = useState('');

  // Enter or JOIN: straight to the join page with the code. /join itself
  // recognises a chair code (CODE-1234) and opens the chair tab.
  const join = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push('/join?code=' + encodeURIComponent(c));
  };

  return (
    <section className="hs-sess" aria-labelledby="hs-sess-heading" style={{ backgroundColor: CREAM }}>
      <style>{`
        .hs-sess { position: relative; overflow-x: clip; padding: clamp(40px, 4vw, 64px) 0 clamp(32px, 3vw, 48px); }
        /* A soft ivory spotlight behind the copy: the stage the devices sit on. */
        .hs-sess::before {
          content: ''; position: absolute; inset: 8% 10% 0; pointer-events: none;
          background: radial-gradient(ellipse 50% 60% at 50% 55%, rgba(237,231,216,0.95), rgba(237,231,216,0) 70%);
        }
        .hs-sess-stage { position: relative; display: flex; flex-direction: column; align-items: center; gap: 36px; }
        .hs-sess-copy { position: relative; z-index: 3; text-align: center; padding: 0 24px; max-width: 520px; }
        .hs-sess-devices { position: relative; width: 100%; max-width: 720px; padding: 0 0 8% 0; }
        .hs-sess-laptop { position: relative; width: 100%; margin-left: 0; filter: drop-shadow(0 26px 40px rgba(27,56,40,0.22)); }
        .hs-sess-phone {
          position: absolute; right: 2%; bottom: -2%; width: 34%; z-index: 2;
          transform: rotate(5deg); filter: drop-shadow(0 24px 34px rgba(27,56,40,0.28));
        }
        .hs-sess-laptop img, .hs-sess-phone img { display: block; width: 100%; height: auto; }
        .hs-sess-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 68px;
          padding: 0 clamp(34px, 2.8vw, 48px); border: 0; border-radius: 14px; cursor: pointer;
          background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 55%, #1E4A31 100%); color: #FFFFFF; box-shadow: 0 16px 32px rgba(27,56,40,0.24);
          font: 700 clamp(18px, 1.4vw, 22px)/1 ${SANS};
          transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
        }
        .hs-sess-cta:hover { transform: translateY(-2px); box-shadow: 0 20px 38px rgba(27,56,40,0.30); }
        .hs-sess-cta:active { transform: scale(0.97); }
        .hs-sess-cta:focus { outline: none; }
        .hs-sess-cta:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; }
        /* The join field, the sessions landing hero's sl-join-box. */
        .hs-sess-join { display: flex; justify-content: center; width: 100%; margin-top: 14px; }
        .hs-sess-join-box {
          display: inline-flex; align-items: center; height: 60px; padding: 0 7px 0 22px; border-radius: 9999px;
          background: rgba(255,255,255,0.85); box-shadow: inset 0 0 0 1.5px ${HAIR};
        }
        .hs-sess-join-box:focus-within { box-shadow: inset 0 0 0 1.5px ${FOREST}; }
        .hs-sess-join-box input {
          width: 164px; border: 0; background: transparent; outline: none;
          font: 700 18px/1 ${SANS}; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK};
        }
        .hs-sess-join-box input::placeholder { letter-spacing: 0; text-transform: none; font-weight: 500; color: ${INK_55}; }
        .hs-sess-join-box button {
          width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 9999px; cursor: pointer;
          background: ${FOREST}; color: #FFFFFF;
          transition: background-color 160ms ease;
        }
        .hs-sess-join-box button:hover { background: #2A5A3C; }
        .hs-sess-join-box button:disabled { background: #D8CDB6; color: ${INK_55}; cursor: default; }
        .hs-sess-join-box button:focus { outline: none; }
        .hs-sess-join-box button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        @media (max-width: 479px) {
          .hs-sess-cta { width: 100%; }
          .hs-sess-join-box { flex: 1; }
          .hs-sess-join-box input { flex: 1; min-width: 0; width: auto; }
        }
        /* Desktop: the phone hangs a little over the hero's bottom edge (owner,
           25 Sep 2026: "the phone hanging over ever so slightly"). */
        @media (min-width: 1024px) {
          .hs-sess { z-index: 2; }
          .hs-sess-stage {
            display: grid; align-items: center; gap: 0;
            grid-template-columns: minmax(0, 1.45fr) minmax(380px, 480px) minmax(0, 0.62fr); max-width: 1440px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 48px);
          }
          .hs-sess-devices { display: contents; }
          .hs-sess-laptop {
            grid-column: 1; grid-row: 1; width: 104%; margin-left: -1%;
            transform: perspective(1800px) rotateY(12deg) rotateZ(-1deg); transform-origin: right center;
          }
          .hs-sess-copy { grid-column: 2; grid-row: 1; padding: 0 12px; max-width: none; }
          .hs-sess-phone {
            grid-column: 3; grid-row: 1; position: relative; right: auto; bottom: auto;
            width: min(92%, 330px); margin: clamp(-110px, -6vw, -60px) 0 0 clamp(0px, 3vw - 24px, 32px); transform: rotate(6deg); align-self: start;
          }
        }
      `}</style>

      <div className="hs-sess-stage">
        <div className="hs-sess-copy">
          <p className="inline-flex items-center gap-2" style={{ ...eyebrow, margin: '0 0 12px 0' }}>
            <MonitorSmartphone size={15} strokeWidth={2.25} aria-hidden="true" /> Gavelling Sessions
          </p>
          <h2
            id="hs-sess-heading"
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(40px, 4.2vw, 60px)', lineHeight: 1.02, letterSpacing: '-0.02em', color: INK, margin: 0, textWrap: 'balance' }}
          >
            MUN done <GoldWord>right.</GoldWord>
          </h2>
          {/* Two lines on purpose, so the tagline never runs under the devices. */}
          <p style={{ fontFamily: SANS, fontSize: 'clamp(18px, 1.5vw, 24px)', lineHeight: 1.4, color: INK_70, margin: '14px auto 0', maxWidth: '460px', whiteSpace: 'pre-line' }}>
            {'Roll Call, Motions, Voting, Scoring.\nAll in one Session.'}
          </p>
          <div className="flex flex-col items-center" style={{ marginTop: '26px' }}>
            <button type="button" onClick={() => router.push('/create/sessions')} className="hs-sess-cta">
              Start a committee
            </button>
            <form className="hs-sess-join" onSubmit={(e) => { e.preventDefault(); join(); }}>
              <span className="hs-sess-join-box">
                <input
                  id="hs-sess-code"
                  aria-label="Session code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Session code"
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" disabled={code.trim().length === 0} aria-label="Join">
                  <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </span>
            </form>
          </div>
        </div>

        <div className="hs-sess-devices">
          <div className="hs-sess-laptop">
            <Image
              src="/sessions/hero-laptop.webp"
              alt="The chair's screen in Gavelling Sessions: the speakers list, the delegation on the floor and its speaking clock"
              width={1000}
              height={610}
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
          </div>
          <div className="hs-sess-phone">
            <Image
              src="/sessions/hero-phone.webp"
              alt="A delegate's phone in Gavelling Sessions, with the speakers list and a Request to speak button"
              width={660}
              height={1141}
              sizes="(min-width: 1024px) 330px, 34vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 2. What is Model UN? + What is Gavelling? ───────────────────────────────

export function AboutCards() {
  // Half the text it had, and plain white cards with a soft forest-tinted
  // shadow (owner, 25 Sep 2026: "very text heavy, reduce by 50%", "cards don't
  // follow design rule"). No raised 3D card, no ivory card, no eyebrow.
  const card: React.CSSProperties = {
    borderRadius: 20,
    padding: 'clamp(22px, 2vw, 30px)',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 14px 32px rgba(27,56,40,0.09)',
  };
  const h2: React.CSSProperties = { fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(22px, 2vw, 30px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: INK, margin: 0 };
  const lead: React.CSSProperties = { fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: INK_70, margin: '10px 0 0 0' };
  const term: React.CSSProperties = { fontFamily: SANS, fontWeight: 800, fontSize: '15px', color: INK };
  const desc: React.CSSProperties = { fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.5, color: INK_70, margin: '2px 0 0 0' };
  return (
    <section
      className="px-5 md:px-14"
      style={{ backgroundColor: CREAM, paddingTop: 'clamp(40px, 4vw, 64px)', paddingBottom: 'clamp(40px, 4vw, 64px)' }}
    >
      <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5" style={{ maxWidth: '1280px' }}>
        {/* "What is Model UN?", the SEO explainer. */}
        <article style={card}>
          <h2 style={h2}>What is Model United Nations?</h2>
          <p style={lead}>
            Model United Nations, or <strong style={{ color: INK }}>MUN</strong>, is a simulation of
            the real UN. Students represent countries, debate world issues and write
            <strong style={{ color: INK }}> resolutions</strong> together. No experience needed.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2" style={{ listStyle: 'none', margin: '16px 0 0 0', padding: 0, gap: '12px 18px' }}>
            {[
              ['Pick a committee', 'From the Security Council to a historical crisis'],
              ['Represent a country', 'Speak, vote and negotiate on its behalf'],
              ['Debate and negotiate', 'Speeches, blocs and caucuses'],
              ['Draft resolutions', 'Write them together, then vote'],
            ].map(([t, d]) => (
              <li key={t} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="flex-shrink-0" style={{ width: 7, height: 7, marginTop: 8, borderRadius: 9999, backgroundColor: GOLD }} />
                <div>
                  <div style={term}>{t}</div>
                  <p style={desc}>{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        {/* "What is Gavelling?" */}
        <article className="flex flex-col" style={card}>
          <h2 style={h2}>What is Gavelling?</h2>
          <p style={lead}>Free software for Model UN, built for the people in the room.</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2" style={{ margin: '16px 0 0 0', gap: '12px 18px' }}>
            {[
              { icon: MonitorSmartphone, t: 'Sessions', d: 'Run a committee live, free, no account' },
              { icon: Landmark, t: 'Conferences', d: 'Applications, allocations and payments' },
              { icon: BookOpen, t: 'Your MUN CV', d: 'Every conference, verified and shareable' },
              { icon: GraduationCap, t: 'Learn MUN', d: 'Guides for your first conference and your tenth' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 30, height: 30, backgroundColor: PALE_GOLD, color: FOREST, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.18)' }}>
                  <Icon size={15} strokeWidth={2.2} />
                </span>
                <div>
                  <dt style={term}>{t}</dt>
                  <dd style={desc}>{d}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2" style={{ paddingTop: '16px' }}>
            <Link href="/sessions" className="inline-flex min-h-11 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={{ ...textLink, fontSize: '15px', color: FOREST }}>Sessions</Link>
            <Link href="/organisers" className="inline-flex min-h-11 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={{ ...textLink, fontSize: '15px', color: FOREST }}>For organisers</Link>
            <Link href="/blog" className="inline-flex min-h-11 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={{ ...textLink, fontSize: '15px', color: FOREST }}>Learn MUN</Link>
          </div>
        </article>
      </div>
    </section>
  );
}

// ── 3. Learn MUN (the blog), on forest ──────────────────────────────────────

/** A guide as the homepage needs it, picked on the server from the blog
 *  manifest (src/app/page.tsx), so the client bundle never carries the manifest. */
export interface HomeGuide {
  slug: string;
  title: string;
  description: string;
  readingMinutes: number;
  photo?: PhotoId;
  /** A premium guide (Unlimited): links to /guides/<slug>, shown with its
   *  title and description only, no photo. */
  premium?: boolean;
  /** Cover photo behind the frosted glass of a premium card. */
  cover?: string;
}

/** "How to Write a MUN Position Paper: Format, Tips & Examples" → the part
 *  before the colon, the words a reader scans for. */
function shortTitle(title: string): string {
  const i = title.indexOf(':');
  return i > 0 ? title.slice(0, i) : title;
}

export function LearnMunSection({ guides }: { guides: HomeGuide[] }) {
  if (guides.length === 0) return null;
  return (
    <section
      className="px-5 md:px-14"
      aria-labelledby="hs-learn-heading"
      style={{ backgroundColor: '#FFFFFF', paddingTop: 'clamp(40px, 4vw, 64px)', paddingBottom: 'clamp(40px, 4vw, 64px)' }}
    >
      <style>{`
        .hs-guide { transition: transform 200ms ease, box-shadow 200ms ease; }
        .hs-guide:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(27,56,40,0.10), 0 26px 48px rgba(27,56,40,0.16) !important; }
        .hs-guide:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 4px; }
        .hs-guide:hover .hs-guide-go { transform: translateX(3px); }
        .hs-guide-go { transition: transform 200ms ease; }
        .hs-learn-all { color: ${FOREST}; transition: color 160ms ease; }
        .hs-learn-all:hover { color: ${INK}; }
        .hs-learn-all:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; border-radius: 4px; }
      `}</style>
      <div className="mx-auto" style={{ maxWidth: '1280px' }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2" style={{ ...eyebrow, color: GOLD, margin: '0 0 8px 0' }}>
              <BookOpen size={14} strokeWidth={2.25} aria-hidden="true" /> MUN guides
            </p>
            <h2
              id="hs-learn-heading"
              style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(26px, 2.4vw, 40px)', letterSpacing: '-0.015em', color: INK, margin: '0 0 4px 0', textWrap: 'balance' }}
            >
              Learn <GoldWord>MUN</GoldWord>
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_70, margin: 0 }}>
              Explore guides written to sharpen your MUN
            </p>
          </div>
          <Link
            href="/blog"
            className="hs-learn-all inline-flex min-h-11 items-center gap-1.5 self-start sm:self-auto focus:outline-none"
            style={{ ...textLink, fontSize: '15px', whiteSpace: 'nowrap' }}
          >
            All guides
          </Link>
        </div>

        <ul
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5"
          style={{ listStyle: 'none', padding: 0, margin: '24px 0 0 0' }}
        >
          {guides.map(g => g.premium ? (
            // A premium guide looks premium (owner, 25 Sep 2026): a cover photo
            // under frosted glass, the lock, and "Unlock with Unlimited". Only
            // the title and description are shown; the guide itself is behind
            // the paywall on /guides/<slug>.
            <li key={g.slug} className="flex">
              <a
                href={`/guides/${g.slug}`}
                title={g.title}
                className="hs-guide relative flex w-full flex-col justify-end overflow-hidden focus:outline-none"
                style={{ borderRadius: 18, minHeight: 300, textDecoration: 'none', boxShadow: '0 0 0 1.5px rgba(184,148,58,0.55), 0 16px 34px rgba(27,56,40,0.16)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.cover ?? '/landing/organiser-desk.jpg'} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full" style={{ objectFit: 'cover' }} />
                <div
                  className="relative"
                  style={{
                    margin: 12,
                    padding: '18px 18px 16px',
                    borderRadius: 14,
                    background: 'rgba(255, 253, 248, 0.62)',
                    backdropFilter: 'blur(14px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px rgba(15,26,19,0.18)',
                  }}
                >
                  <span className="inline-flex items-center gap-1.5" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 800, color: '#8A6414' }}>
                    <Lock size={14} strokeWidth={2.4} aria-hidden="true" /> Premium guide
                  </span>
                  <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(18px, 1.35vw, 22px)', lineHeight: 1.2, letterSpacing: '-0.01em', color: INK, margin: '6px 0 0 0', textWrap: 'balance' }}>
                    {g.title}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.5, color: '#3A3128', margin: '6px 0 0 0', textWrap: 'pretty' }}>
                    {g.description}
                  </p>
                  <span
                    className="inline-flex items-center justify-center gap-2"
                    style={{ marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 12, background: 'linear-gradient(135deg, #F4E4A6 0%, #EED98A 38%, #D6B24C 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(120,86,14,0.25), 0 8px 20px -6px rgba(182,135,31,0.55)', color: '#1C1410', fontFamily: SANS, fontWeight: 800, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    <Lock size={15} strokeWidth={2.4} aria-hidden="true" /> Unlock with Unlimited
                  </span>
                </div>
              </a>
            </li>
          ) : (
            <li key={g.slug} className="flex">
              <a
                href={g.premium ? `/guides/${g.slug}` : `/blog/${g.slug}`}
                title={g.title}
                className="hs-guide flex w-full flex-col overflow-hidden focus:outline-none"
                style={{ borderRadius: 18, backgroundColor: g.premium ? '#FBF6E6' : CARD, textDecoration: 'none', boxShadow: g.premium ? '0 0 0 1.5px rgba(184,148,58,0.45), 0 14px 30px rgba(27,56,40,0.10)' : '0 0 0 1px rgba(27,56,40,0.08), 0 14px 30px rgba(27,56,40,0.10)' }}
              >
                {!g.premium && (
                  <div style={{ aspectRatio: '2.3 / 1', backgroundColor: '#E4DCCA' }}>
                    {g.photo ? (
                      <CardPhoto id={g.photo} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: FOREST }}>
                        <BookOpen size={32} strokeWidth={1.6} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-1 flex-col" style={{ padding: g.premium ? '22px 22px 18px' : '16px 18px 16px' }}>
                  {g.premium && (
                    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 800, color: GOLD, marginBottom: '10px' }}>
                      <Lock size={14} strokeWidth={2.4} aria-hidden="true" /> Premium guide
                    </span>
                  )}
                  <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: g.premium ? 'clamp(19px, 1.5vw, 24px)' : 'clamp(16px, 1.1vw, 18px)', lineHeight: 1.25, letterSpacing: '-0.01em', color: INK, margin: 0, textWrap: 'balance' }}>
                    {g.premium ? g.title : shortTitle(g.title)}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.5, color: INK_70, margin: '6px 0 0 0', textWrap: 'pretty' }}>
                    {g.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between" style={{ paddingTop: '12px' }}>
                    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: INK_55, fontVariantNumeric: 'tabular-nums' }}>
                      {g.premium ? 'With Unlimited' : <><Clock size={13} strokeWidth={2.25} aria-hidden="true" /> {g.readingMinutes} min read</>}
                    </span>
                    <span className="hs-guide-go" style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 800, color: FOREST, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                      Read
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
