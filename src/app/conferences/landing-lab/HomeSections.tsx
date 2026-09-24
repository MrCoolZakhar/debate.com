// ─────────────────────────────────────────────────────────────────────────────
// Homepage sections added 24 Sep 2026 (owner's brief), mounted by
// VariantStagefront.tsx. Kept in their own file so the big composition stays a
// thin list of sections.
//
//   SessionsSection   second on the page: laptop | "Start a session" | phone
//   AboutCards        "What is Model United Nations?" (the SEO explainer, text
//                     unchanged) beside "What is Gavelling?"
//   LearnMunSection   six evergreen guides from src/app/blog/posts.ts, each a
//                     real <a href="/blog/<slug>"> in the server HTML
//
// No hooks, no state: everything here renders on the server with the page.
// Light grounds only (owner: never a full-width green band on a landing page).
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Check, Clock, Landmark, MonitorSmartphone } from 'lucide-react';
import { CardPhoto } from '@/components/blog/BlogPhoto';
import type { PhotoId } from '@/components/blog/photos';
import { CREAM, FOREST, GOLD, IVORY, PALE_GOLD, SANS } from './shared';

const INK = '#1C1410';
const INK_70 = '#4A4238';
const INK_55 = '#6B5F52';
const HAIR = '#DDD4C0';
const CARD = '#FFFDF8';
const PLAYFAIR = "'Playfair Display', serif";

const eyebrow: React.CSSProperties = {
  fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(12px, 0.8vw, 14px)', letterSpacing: '0.14em',
  textTransform: 'uppercase', color: GOLD, margin: '0 0 10px 0',
};

// ── 1. Running a committee ──────────────────────────────────────────────────

export function SessionsSection() {
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
        .hs-sess-cta { transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease; }
        .hs-sess-cta:hover { transform: translateY(-2px); background-color: #2A5A3C !important; box-shadow: 0 20px 38px rgba(27,56,40,0.30) !important; }
        .hs-sess-cta:active { transform: scale(0.97); }
        .hs-sess-join:hover { color: ${FOREST} !important; text-decoration-color: ${FOREST} !important; }
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
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(32px, 3.4vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.02em', color: INK, margin: 0, textWrap: 'balance' }}
          >
            Run the{' '}
            <span style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 400, color: GOLD }}>room</span>{' '}
            from one laptop.
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.1vw, 18px)', lineHeight: 1.6, color: INK_70, margin: '18px auto 0', maxWidth: '420px', textWrap: 'pretty' }}>
            The chair runs roll call, the speakers list, motions and votes from a laptop. Delegates follow and ask for the floor on their phones.
          </p>
          <div className="flex flex-col items-center gap-4" style={{ marginTop: '30px' }}>
            <Link
              href="/create"
              className="hs-sess-cta inline-flex items-center justify-center gap-3 focus:outline-none"
              style={{
                fontFamily: SANS, fontSize: 'clamp(16px, 1.15vw, 19px)', fontWeight: 800, letterSpacing: '0.01em',
                color: PALE_GOLD, backgroundColor: FOREST, padding: 'clamp(16px, 1.2vw, 20px) clamp(30px, 2.4vw, 42px)',
                borderRadius: '9999px', textDecoration: 'none', boxShadow: '0 16px 32px rgba(27,56,40,0.24)',
              }}
            >
              Start a session <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <Link
              href="/join"
              className="hs-sess-join focus:outline-none"
              style={{ fontFamily: SANS, fontSize: '14.5px', fontWeight: 700, color: INK_55, textDecoration: 'underline', textDecorationColor: HAIR, textUnderlineOffset: '4px' }}
            >
              Join with a code
            </Link>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" style={{ listStyle: 'none', padding: 0, margin: '26px 0 0 0' }}>
            {['Free forever', 'No account', 'Any phone'].map(t => (
              <li key={t} className="inline-flex items-center gap-1.5" style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: INK_55 }}>
                <Check size={14} strokeWidth={2.75} style={{ color: FOREST }} aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
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
              className="inline-flex items-center gap-1.5 focus:outline-none"
              style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 800, color: FOREST, textDecoration: 'none' }}
            >
              Sessions <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <Link
              href="/organisers"
              className="inline-flex items-center gap-1.5 focus:outline-none"
              style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 800, color: FOREST, textDecoration: 'none' }}
            >
              For organisers <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

// ── 3. Learn MUN (the blog) ─────────────────────────────────────────────────

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
      style={{ backgroundColor: IVORY, paddingTop: 'clamp(64px, 6vw, 100px)', paddingBottom: 'clamp(72px, 6vw, 108px)' }}
    >
      <style>{`
        .hs-guide { transition: transform 200ms ease, box-shadow 200ms ease; }
        .hs-guide:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(27,56,40,0.10), 0 26px 48px rgba(27,56,40,0.16) !important; }
        .hs-guide:hover .hs-guide-go { transform: translateX(3px); }
        .hs-guide-go { transition: transform 200ms ease; }
      `}</style>
      <div className="mx-auto" style={{ maxWidth: '1280px' }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2" style={{ ...eyebrow, margin: '0 0 8px 0' }}>
              <BookOpen size={14} strokeWidth={2.25} aria-hidden="true" /> MUN guides
            </p>
            <h2
              id="hs-learn-heading"
              style={{ fontFamily: SANS, fontWeight: 900, fontSize: 'clamp(28px, 3vw, 48px)', letterSpacing: '-0.015em', color: INK, margin: '0 0 6px 0', textWrap: 'balance' }}
            >
              Learn MUN
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(15px, 1.05vw, 18px)', lineHeight: 1.6, color: INK_55, margin: 0 }}>
              The guides delegates read before their first conference, and their tenth.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto focus:outline-none"
            style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: FOREST, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            All guides <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
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
                style={{ borderRadius: 22, backgroundColor: CARD, textDecoration: 'none', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 16px 34px rgba(27,56,40,0.09)' }}
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
                    <span className="hs-guide-go inline-flex items-center gap-1" style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 800, color: FOREST }}>
                      Read <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
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
