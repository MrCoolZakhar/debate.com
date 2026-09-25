'use client';

// "Built for every role in the *room*" (25 Sep 2026). One tall photo panel per
// role in the homepage's role pattern ("Find your seat"): the photo, a dark
// scrim at the foot, the role word big, ONE short line and a real action.
//
//   Chairs            CREATE YOUR SESSION           -> /create
//   Delegates         code field + FIND A SESSION   -> /join?code=CODE
//   Faculty advisors  code field + FIND A SESSION   -> /join?code=CODE&mode=advisor
//                     and the inline link "Open your board" -> /advisor
//
// Three-up from 900px; below that one swipeable scroll-snap row (native
// scrolling, no script), the next panel peeking so the swipe is discoverable.
// The photos are the ones the homepage already uses (public/roles/*,
// public/landing/*). No pills, no check marks, no tags (owner's taste).

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@/contexts/LanguageContext';
import { GoldWord } from '@/components/BrandHeading';
import { GoldButton } from '@/components/GoldButton';
import type { TranslationKey } from '@/lib/translations';
import { BRAND, INK, FOREST, GOLD_TEXT, CREAM, WHITE } from './tokens';

type Role = {
  id: 'chairs' | 'delegates' | 'advisors';
  word: TranslationKey;
  line: TranslationKey;
  alt: TranslationKey;
  src: string;
  pos: string;
};

const ROLES: Role[] = [
  { id: 'chairs', word: 'sl_role_chairs', line: 'sl_role_chairs_line', alt: 'sl_role_chairs_alt', src: '/roles/chair-card.webp', pos: '50% 40%' },
  { id: 'delegates', word: 'sl_role_delegates', line: 'sl_role_delegates_line', alt: 'sl_role_delegates_alt', src: '/roles/delegate.jpg', pos: '55% 50%' },
  { id: 'advisors', word: 'sl_role_advisors', line: 'sl_role_advisors_line', alt: 'sl_role_advisors_alt', src: '/landing/organiser-desk.jpg', pos: '40% 50%' },
];

/** The join-code field beside FIND A SESSION. With a code it opens
 *  /join?code=CODE (plus mode=advisor for the advisor panel); with nothing
 *  typed it still opens /join, so the button is never a dead end. */
function FindSession({ id, advisor }: { id: string; advisor: boolean }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState('');
  const go = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const params = new URLSearchParams();
    if (c) params.set('code', c);
    if (advisor) params.set('mode', 'advisor');
    const q = params.toString();
    router.push(`/join${q ? `?${q}` : ''}`);
  };
  return (
    <form className="rc-find" onSubmit={go}>
      <input
        id={`rc-code-${id}`}
        className="rc-code"
        aria-label={t('sl_code_placeholder')}
        placeholder={t('sl_code_placeholder')}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={20}
        autoComplete="off"
        spellCheck={false}
      />
      <GoldButton type="submit" className="rc-cta">{t('sl_role_find')}</GoldButton>
    </form>
  );
}

export default function RoleCards() {
  const t = useT();
  return (
    <section className="rc relative z-10 mx-auto w-full" style={{ fontFamily: BRAND }} aria-labelledby="rc-title">
      <style>{CSS}</style>
      <h2 id="rc-title" className="rc-h2">
        {t('sl_roles_lead')}{' '}
        <GoldWord tone="light">{t('sl_roles_accent')}</GoldWord>
      </h2>

      <div className="rc-row">
        {ROLES.map(({ id, word, line, alt, src, pos }) => (
          <article key={id} className="rc-panel">
            <Image src={src} alt={t(alt)} fill sizes="(max-width: 899px) 84vw, 33vw" style={{ objectFit: 'cover', objectPosition: pos }} />
            <div className="rc-scrim" aria-hidden />
            <div className="rc-foot">
              <h3 className="rc-word">{t(word)}</h3>
              <p className="rc-line">{t(line)}</p>
              <div className="rc-act">
                {id === 'chairs' && (
                  <GoldButton href="/create" className="rc-cta">{t('sl_role_chairs_cta')}</GoldButton>
                )}
                {id === 'delegates' && <FindSession id={id} advisor={false} />}
                {id === 'advisors' && (
                  <>
                    <FindSession id={id} advisor />
                    <Link href="/advisor" className="rc-link">{t('sl_role_advisors_link')}</Link>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const CSS = `
.rc { max-width: 1520px; padding: clamp(56px, 6vw, 96px) clamp(16px, 4vw, 64px) clamp(40px, 4vw, 64px); }
.rc-h2 { margin: 0; text-align: center; font-weight: 800; font-size: clamp(32px, 3.6vw, 56px); line-height: 1.05; letter-spacing: -0.03em; color: ${INK}; }
.rc-row { margin-top: clamp(28px, 3vw, 48px); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 1.6vw, 24px); }
.rc-panel { position: relative; overflow: hidden; border-radius: 28px; background: ${FOREST}; aspect-ratio: 3 / 4; min-height: 520px;
  box-shadow: 0 30px 60px -38px rgba(27,56,40,.6), 0 2px 6px rgba(27,56,40,.08); transition: transform .25s cubic-bezier(.22,1,.36,1); }
@media (hover: hover) { .rc-panel:hover { transform: translateY(-3px); } }
.rc-panel img { user-select: none; }
.rc-scrim { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,48,31,0) 30%, rgba(20,48,31,.42) 55%, rgba(20,48,31,.9) 78%, rgba(20,48,31,.97) 100%); }
.rc-foot { position: absolute; inset-inline: 0; bottom: 0; padding: 0 clamp(20px, 2vw, 30px) clamp(22px, 2.2vw, 32px); display: flex; flex-direction: column; }
.rc-word { margin: 0; font-weight: 800; font-size: clamp(34px, 3vw, 46px); line-height: 1; letter-spacing: -0.03em; color: ${CREAM}; }
.rc-line { margin: 10px 0 0; font-size: clamp(15px, 1.05vw, 16.5px); line-height: 1.45; color: rgba(250,248,243,.9); max-width: 26em; }
.rc-act { margin-top: 18px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.rc-find { display: flex; align-items: stretch; gap: 8px; width: 100%; flex-wrap: wrap; }
.rc-code { flex: 1 1 120px; min-width: 0; height: 52px; padding: 0 16px; border: 0; border-radius: 12px; background: rgba(255,255,255,.92); color: ${INK};
  font: 700 15px/1 ${BRAND}; letter-spacing: .1em; text-transform: uppercase; outline: none; box-shadow: inset 0 0 0 1.5px rgba(27,56,40,.14); }
.rc-code::placeholder { letter-spacing: 0; text-transform: none; font-weight: 500; color: #5A5046; }
.rc-code:focus { background: ${WHITE}; box-shadow: inset 0 0 0 2px ${GOLD_TEXT}; }
.rc-cta { white-space: nowrap; }
.rc-link { display: inline-flex; align-items: center; min-height: 44px; color: ${GOLD_TEXT}; font-weight: 800; font-size: 15px; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
.rc-link:hover { color: ${WHITE}; }
.rc-link:focus-visible { outline: 2px solid ${GOLD_TEXT}; outline-offset: 3px; border-radius: 6px; }
@media (max-width: 899px) {
  .rc { padding-inline: 0; }
  .rc-h2 { padding-inline: 16px; }
  .rc-row { display: flex; gap: 12px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; padding: 4px 16px 20px;
    -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .rc-row::-webkit-scrollbar { display: none; }
  .rc-panel { flex: 0 0 84vw; max-width: 420px; min-height: 460px; aspect-ratio: 3 / 4; scroll-snap-align: center; }
  .rc-panel:hover { transform: none; }
}
@media (prefers-reduced-motion: reduce) { .rc-panel { transition: none; } .rc-row { scroll-behavior: auto; } }
`;
