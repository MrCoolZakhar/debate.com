'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Homepage sections added 24 Sep 2026 (owner's brief), mounted by
// VariantStagefront.tsx. Kept in their own file so the big composition stays a
// thin list of sections.
//
//   SessionsSection   second on the page: laptop | "Run the room" | phone, with
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
import { ArrowRight, BookOpen, Clock, GraduationCap, Landmark, MonitorSmartphone } from 'lucide-react';
import { CardPhoto } from '@/components/blog/BlogPhoto';
import type { PhotoId } from '@/components/blog/photos';
import { GoldWord } from '@/components/BrandHeading';
import { CREAM, FOREST, GOLD, IVORY, PALE_GOLD, SANS } from './shared';

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
        .hs-sess { position: relative; overflow-x: clip; padding: clamp(56px, 6vw, 104px) 0 clamp(64px, 6vw, 112px); }
        /* A soft ivory spotlight behind the copy: the stage the devices sit on. */
        .hs-sess::before {
          content: ''; position: absolute; inset: 8% 10% 0; pointer-events: none;
          background: radial-gradient(ellipse 50% 60% at 50% 55%, rgba(237,231,216,0.95), rgba(237,231,216,0) 70%);
        }
        .hs-sess-stage { position: relative; display: flex; flex-direction: column; align-items: center; gap: 36px; }
        .hs-sess-copy { position: relative; z-index: 3; text-align: center; padding: 0 24px; max-width: 520px; }
        .hs-sess-devices { position: relative; width: 100%; max-width: 720px; padding: 0 0 8% 0; }
        .hs-sess-laptop { position: relative; width: 104%; margin-left: -12%; filter: drop-shadow(0 26px 40px rgba(27,56,40,0.22)); }
        .hs-sess-phone {
          position: absolute; right: 2%; bottom: -2%; width: 34%; z-index: 2;
          transform: rotate(5deg); filter: drop-shadow(0 24px 34px rgba(27,56,40,0.28));
        }
        .hs-sess-laptop img, .hs-sess-phone img { display: block; width: 100%; height: auto; }
        .hs-sess-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 60px;
          padding: 0 clamp(30px, 2.4vw, 42px); border: 0; border-radius: 9999px; cursor: pointer;
          background: ${FOREST}; color: ${PALE_GOLD}; box-shadow: 0 16px 32px rgba(27,56,40,0.24);
          font: 800 clamp(15px, 1.1vw, 17px)/1 ${SANS}; letter-spacing: 0.08em; text-transform: uppercase;
          transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
        }
        .hs-sess-cta:hover { transform: translateY(-2px); background-color: #2A5A3C; box-shadow: 0 20px 38px rgba(27,56,40,0.30); }
        .hs-sess-cta:active { transform: scale(0.97); }
        .hs-sess-cta:focus { outline: none; }
        .hs-sess-cta:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; }
        /* The join field, the sessions landing hero's sl-join-box. */
        .hs-sess-join { display: flex; justify-content: center; width: 100%; margin-top: 14px; }
        .hs-sess-join-box {
          display: inline-flex; align-items: center; height: 48px; padding: 0 4px 0 18px; border-radius: 9999px;
          background: rgba(255,255,255,0.85); box-shadow: inset 0 0 0 1.5px ${HAIR};
        }
        .hs-sess-join-box:focus-within { box-shadow: inset 0 0 0 1.5px ${FOREST}; }
        .hs-sess-join-box input {
          width: 148px; border: 0; background: transparent; outline: none;
          font: 700 16px/1 ${SANS}; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK};
        }
        .hs-sess-join-box input::placeholder { letter-spacing: 0; text-transform: none; font-weight: 500; color: ${INK_55}; }
        .hs-sess-join-box button {
          height: 40px; min-width: 44px; padding: 0 18px; border: 0; border-radius: 9999px; cursor: pointer;
          background: ${FOREST}; color: ${PALE_GOLD}; font: 800 13.5px/1 ${SANS}; letter-spacing: 0.08em; text-transform: uppercase;
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
        @media (min-width: 1024px) {
          .hs-sess-stage {
            display: grid; align-items: center; gap: 0;
            grid-template-columns: minmax(0, 1.05fr) minmax(360px, 440px) minmax(0, 0.62fr);
          }
          .hs-sess-devices { display: contents; }
          .hs-sess-laptop {
            grid-column: 1; grid-row: 1; width: 122%; margin-left: -20%;
            transform: perspective(1800px) rotateY(18deg) rotateZ(-1deg); transform-origin: right center;
          }
          .hs-sess-copy { grid-column: 2; grid-row: 1; padding: 0 12px; max-width: none; }
          .hs-sess-phone {
            grid-column: 3; grid-row: 1; position: relative; right: auto; bottom: auto;
            width: min(92%, 330px); margin: 40px 0 0 clamp(0px, 3vw - 24px, 32px); transform: rotate(6deg);
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
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(35px, 3.75vw, 62px)', lineHeight: 1.02, letterSpacing: '-0.02em', color: INK, margin: 0, textWrap: 'balance' }}
          >
            Run the <GoldWord>room</GoldWord>
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.15vw, 19px)', lineHeight: 1.5, color: INK_70, margin: '14px auto 0', maxWidth: '420px', textWrap: 'balance' }}>
            From initial roll call to final voting. One session, any device.
          </p>
          <div className="flex flex-col items-center" style={{ marginTop: '30px' }}>
            <button type="button" onClick={() => router.push('/create/sessions')} className="hs-sess-cta">
              START COMMITTEE <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
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
                <button type="submit" disabled={code.trim().length === 0}>
                  JOIN
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
  const card: React.CSSProperties = {
    borderRadius: 28,
    padding: 'clamp(28px, 3vw, 52px)',
  };
  return (
    <section
      className="px-5 md:px-14"
      style={{ backgroundColor: CREAM, paddingTop: 'clamp(64px, 6vw, 104px)', paddingBottom: 'clamp(64px, 6vw, 104px)' }}
    >
      <div className="mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5 lg:gap-7" style={{ maxWidth: '1280px' }}>
        {/* "What is Model UN?", the SEO explainer. Text and headings unchanged. */}
        <article
          style={{ ...card, backgroundColor: CARD, boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 0 0 1px rgba(27,56,40,0.07), 0 24px 50px rgba(27,56,40,0.10)' }}
        >
          <p style={eyebrow}>New to the circuit?</p>
          <h2
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(28px, 3vw, 48px)', lineHeight: 1.03, letterSpacing: '-0.02em', color: INK, margin: 0 }}
          >
            What is Model United Nations?
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.1vw, 19px)', lineHeight: 1.7, color: INK_70, margin: '20px 0 0 0', maxWidth: '760px' }}>
            Model United Nations, or <strong style={{ color: INK }}>MUN</strong>, is an academic
            simulation of the real United Nations. Students step into the shoes of diplomats,
            each representing a country, and debate the world&rsquo;s biggest challenges, from
            climate change to global security, in committees modelled on the UN&rsquo;s own.
            It&rsquo;s part debate, part public speaking, part teamwork, and one of the best ways
            to sharpen the skills that carry into university and beyond.
          </p>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.1vw, 19px)', lineHeight: 1.7, color: INK_70, margin: '18px 0 0 0', maxWidth: '760px' }}>
            At a conference, delegates research their country&rsquo;s position, deliver speeches,
            negotiate with allies and rivals, and work together to draft <strong style={{ color: INK }}>resolutions</strong>:
            the written proposals a committee votes on. A chairperson keeps the debate flowing,
            and awards recognise the delegates who lead the room. No experience is needed to
            start: everyone gives their first speech eventually.
          </p>

          <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(19px, 1.4vw, 24px)', letterSpacing: '-0.01em', color: FOREST, margin: 'clamp(28px, 2.6vw, 40px) 0 16px 0' }}>
            How a Model UN conference works
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '14px', maxWidth: '760px' }}>
            {[
              ['Pick a committee', 'Conferences run committees: the Security Council, historical crises, specialised agencies and more, each with its own topic and pace.'],
              ['Represent a country', 'You’re assigned a country (or a character) and speak, vote and negotiate on its behalf throughout the weekend.'],
              ['Debate and negotiate', 'Delegates make speeches, form blocs, and hammer out compromises through moderated and unmoderated caucuses.'],
              ['Draft resolutions', 'Working together, committees write and amend resolutions, then vote: the heart of every MUN session.'],
            ].map(([term, desc]) => (
              <li key={term} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex-shrink-0"
                  style={{ width: 10, height: 10, marginTop: 9, borderRadius: 9999, backgroundColor: GOLD, boxShadow: '0 0 0 4px rgba(184,148,58,0.16)' }}
                />
                <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.02vw, 17.5px)', lineHeight: 1.6, color: INK_70, margin: 0 }}>
                  <strong style={{ color: INK }}>{term}.</strong>{' '}{desc}
                </p>
              </li>
            ))}
          </ul>

          <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.02vw, 17.5px)', lineHeight: 1.7, color: INK_55, margin: 'clamp(24px, 2.2vw, 36px) 0 0 0', maxWidth: '760px' }}>
            Whether you&rsquo;re a total beginner looking for your first conference or a seasoned
            delegate chasing the next gavel, Gavelling helps you find the right room. Browse
            conferences above and apply in minutes.
          </p>
        </article>

        {/* "What is Gavelling?" */}
        <article
          className="relative flex flex-col overflow-hidden"
          style={{ ...card, backgroundColor: IVORY, boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 24px 50px rgba(27,56,40,0.10)' }}
        >
          {/* The Gavelling mark, large and faint in the corner. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gavelling-mark.png"
            alt=""
            aria-hidden="true"
            width={512}
            height={512}
            loading="lazy"
            className="pointer-events-none absolute"
            style={{ width: 'min(78%, 360px)', height: 'auto', right: '-14%', bottom: '-10%', opacity: 0.07 }}
          />
          <p style={eyebrow}>The platform</p>
          <h2
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(28px, 3vw, 48px)', lineHeight: 1.03, letterSpacing: '-0.02em', color: INK, margin: 0 }}
          >
            What is Gavelling?
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(16px, 1.1vw, 19px)', lineHeight: 1.7, color: INK_70, margin: '20px 0 0 0' }}>
            Gavelling is free software for Model UN, built for the people in the room.
          </p>
          <dl className="relative" style={{ margin: 'clamp(22px, 2vw, 30px) 0 0 0', display: 'grid', gap: '18px' }}>
            {[
              { icon: MonitorSmartphone, term: 'Sessions', desc: 'Runs a committee live. The chair works from a laptop and delegates follow on their phones. Free, and no account needed.' },
              { icon: Landmark, term: 'Conferences', desc: 'Gives a secretariat applications, allocations, payments and the live status of every room. Free for organisers.' },
              { icon: BookOpen, term: 'Your MUN CV', desc: 'Every conference you attend on Gavelling goes on a CV you can share, verified by the conference.' },
              { icon: GraduationCap, term: 'Learn MUN', desc: 'Guides on position papers, speeches, rules of procedure and resolutions, written for a first conference and a tenth.' },
            ].map(({ icon: Icon, term, desc }) => (
              <div key={term} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex flex-shrink-0 items-center justify-center rounded-full"
                  style={{ width: 38, height: 38, backgroundColor: FOREST, color: PALE_GOLD, boxShadow: '0 6px 14px rgba(27,56,40,0.20)' }}
                >
                  <Icon size={18} strokeWidth={2.1} />
                </span>
                <div>
                  <dt style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(15.5px, 1.05vw, 18px)', color: INK }}>{term}</dt>
                  <dd style={{ fontFamily: SANS, fontSize: 'clamp(14.5px, 0.98vw, 16.5px)', lineHeight: 1.6, color: INK_70, margin: '3px 0 0 0' }}>{desc}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="relative mt-auto flex flex-wrap items-center gap-x-6 gap-y-3" style={{ paddingTop: 'clamp(28px, 2.6vw, 40px)' }}>
            <Link
              href="/sessions"
              className="inline-flex min-h-11 items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
              style={{ ...textLink, fontSize: '15px', color: FOREST }}
            >
              Sessions <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <Link
              href="/organisers"
              className="inline-flex min-h-11 items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
              style={{ ...textLink, fontSize: '15px', color: FOREST }}
            >
              For organisers <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <Link
              href="/blog"
              className="inline-flex min-h-11 items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
              style={{ ...textLink, fontSize: '15px', color: FOREST }}
            >
              Learn MUN <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </Link>
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
      style={{ backgroundColor: FOREST, paddingTop: 'clamp(64px, 6vw, 100px)', paddingBottom: 'clamp(72px, 6vw, 108px)' }}
    >
      <style>{`
        .hs-guide { transition: transform 200ms ease, box-shadow 200ms ease; }
        .hs-guide:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(238,217,138,0.35), 0 26px 48px rgba(0,0,0,0.32) !important; }
        .hs-guide:focus-visible { outline: 2px solid ${PALE_GOLD}; outline-offset: 4px; }
        .hs-guide:hover .hs-guide-go { transform: translateX(3px); }
        .hs-guide-go { transition: transform 200ms ease; }
        .hs-learn-all { color: ${PALE_GOLD}; transition: color 160ms ease; }
        .hs-learn-all:hover { color: #FFFFFF; }
        .hs-learn-all:focus-visible { outline: 2px solid ${PALE_GOLD}; outline-offset: 3px; border-radius: 4px; }
      `}</style>
      <div className="mx-auto" style={{ maxWidth: '1280px' }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2" style={{ ...eyebrow, color: PALE_GOLD, margin: '0 0 8px 0' }}>
              <BookOpen size={14} strokeWidth={2.25} aria-hidden="true" /> MUN guides
            </p>
            <h2
              id="hs-learn-heading"
              style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(28px, 3vw, 48px)', letterSpacing: '-0.015em', color: '#FFFFFF', margin: '0 0 6px 0', textWrap: 'balance' }}
            >
              Learn <GoldWord tone="dark">MUN</GoldWord>
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: 'rgba(237,231,216,0.78)', margin: 0 }}>
              Explore guides written to sharpen your MUN
            </p>
          </div>
          <Link
            href="/blog"
            className="hs-learn-all inline-flex min-h-11 items-center gap-1.5 self-start sm:self-auto focus:outline-none"
            style={{ ...textLink, fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
          >
            ALL GUIDES <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>

        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
          style={{ listStyle: 'none', padding: 0, margin: '32px 0 0 0' }}
        >
          {guides.map(g => (
            <li key={g.slug} className="flex">
              <a
                href={`/blog/${g.slug}`}
                title={g.title}
                className="hs-guide flex w-full flex-col overflow-hidden focus:outline-none"
                style={{ borderRadius: 22, backgroundColor: CARD, textDecoration: 'none', boxShadow: '0 0 0 1px rgba(238,217,138,0.18), 0 16px 34px rgba(0,0,0,0.26)' }}
              >
                <div style={{ aspectRatio: '16 / 9', backgroundColor: '#E4DCCA' }}>
                  {g.photo ? (
                    <CardPhoto id={g.photo} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ color: FOREST }}>
                      <BookOpen size={40} strokeWidth={1.6} aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col" style={{ padding: '20px 22px 22px' }}>
                  <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 'clamp(17px, 1.2vw, 20px)', lineHeight: 1.25, letterSpacing: '-0.01em', color: INK, margin: 0, textWrap: 'balance' }}>
                    {shortTitle(g.title)}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.55, color: INK_70, margin: '8px 0 0 0', textWrap: 'pretty' }}>
                    {g.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between" style={{ paddingTop: '18px' }}>
                    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: INK_55, fontVariantNumeric: 'tabular-nums' }}>
                      <Clock size={13} strokeWidth={2.25} aria-hidden="true" /> {g.readingMinutes} min read
                    </span>
                    <span className="hs-guide-go inline-flex items-center gap-1" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD }}>
                      READ <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
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
