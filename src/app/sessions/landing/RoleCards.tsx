'use client';

// Who Sessions is for: three photo cards, Chairs, Delegates, Faculty advisors
// (25 Sep 2026, owner: "i dont like the one room - three seats part. previously,
// you used some stock images with cards to outline them, i think that looked
// better"). It replaced RoleShowcase's tabs of screen clippings. The photos are
// the ones the homepage already uses (public/roles/*, public/landing/*).
//
// Each card: the photo on top with the role's icon and name over its lower edge,
// then the one-line promise and three plain lines of what that seat gets. No
// pills (CLAUDE.md §8), nothing truncated.

import Image from 'next/image';
import { Check, Gavel, GraduationCap, Smartphone, type LucideIcon } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/lib/translations';
import { BRAND, INK, INK_SOFT, FOREST, GOLD, HAIR } from './tokens';

type Card = {
  id: string;
  who: TranslationKey;
  Icon: LucideIcon;
  title: TranslationKey;
  lines: TranslationKey[];
  src: string;
  alt: string;
  pos: string;
};

const CARDS: Card[] = [
  {
    id: 'chairs', who: 'sl_tab_chairs', Icon: Gavel, title: 'sl_chair_title',
    lines: ['sl_chair_1', 'sl_chair_2', 'sl_chair_3'],
    src: '/roles/chair-card.webp', alt: 'A committee dais: the chair brings down the gavel.', pos: '50% 40%',
  },
  {
    id: 'delegates', who: 'sl_tab_delegates', Icon: Smartphone, title: 'sl_del_title',
    lines: ['sl_del_1', 'sl_del_2', 'sl_del_3'],
    src: '/roles/delegate.jpg', alt: 'Delegates raising their country placards during a vote.', pos: '55% 50%',
  },
  {
    id: 'advisors', who: 'sl_tab_advisors', Icon: GraduationCap, title: 'sl_adv_title',
    lines: ['sl_adv_1', 'sl_adv_2', 'sl_adv_3'],
    src: '/landing/organiser-desk.jpg', alt: 'An advisor taking notes at a conference table.', pos: '40% 50%',
  },
];

export default function RoleCards() {
  const t = useT();
  return (
    <section className="rc relative z-10 mx-auto w-full" style={{ fontFamily: BRAND }}>
      <style>{CSS}</style>
      <div className="rc-head">
        <h2 className="rc-h2">{t('sl_roles_title')}</h2>
        <p className="rc-sub">{t('sl_roles_sub')}</p>
      </div>
      <div className="rc-grid">
        {CARDS.map(({ id, who, Icon, title, lines, src, alt, pos }) => (
          <article key={id} className="rc-card">
            <div className="rc-photo">
              <Image src={src} alt={alt} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: 'cover', objectPosition: pos }} />
              <div className="rc-shade" aria-hidden />
              <p className="rc-who">
                <span className="rc-icon" aria-hidden><Icon size={17} strokeWidth={2.3} /></span>
                {t(who)}
              </p>
            </div>
            <div className="rc-body">
              <h3 className="rc-h3">{t(title)}</h3>
              <ul className="rc-list">
                {lines.map((k) => (
                  <li key={k}>
                    <Check size={15} strokeWidth={2.8} aria-hidden className="rc-tick" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const CSS = `
.rc { max-width: 1520px; padding: clamp(56px, 6vw, 96px) clamp(16px, 4vw, 64px) clamp(40px, 4vw, 64px); }
.rc-head { max-width: 46em; }
.rc-h2 { margin: 0; font-weight: 800; font-size: clamp(30px, 3.2vw, 50px); line-height: 1.05; letter-spacing: -0.03em; color: ${INK}; }
.rc-sub { margin: 12px 0 0; font-size: 16.5px; line-height: 1.55; color: ${INK_SOFT}; }
.rc-grid { margin-top: clamp(24px, 2.6vw, 40px); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 1.6vw, 24px); }
.rc-card { display: flex; flex-direction: column; border-radius: 26px; overflow: hidden; background: #FFFDF8;
  box-shadow: inset 0 0 0 1.5px ${HAIR}, 0 26px 50px -34px rgba(27,56,40,.5), 0 2px 6px rgba(27,56,40,.06);
  transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s; }
@media (hover: hover) { .rc-card:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 1.5px ${HAIR}, 0 34px 60px -34px rgba(27,56,40,.55), 0 2px 6px rgba(27,56,40,.06); } }
.rc-photo { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: ${FOREST}; }
.rc-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,26,18,0) 45%, rgba(12,26,18,.72) 100%); }
.rc-who { position: absolute; inset-inline-start: 18px; bottom: 16px; margin: 0; display: inline-flex; align-items: center; gap: 10px;
  color: #FFFDF8; font-weight: 800; font-size: 19px; letter-spacing: -0.01em; }
.rc-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 999px;
  background: ${GOLD}; color: ${FOREST}; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
.rc-body { padding: 20px 22px 24px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
.rc-h3 { margin: 0; font-weight: 800; font-size: clamp(19px, 1.5vw, 23px); line-height: 1.2; letter-spacing: -0.015em; color: ${INK}; }
.rc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.rc-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; line-height: 1.5; color: ${INK_SOFT}; }
.rc-tick { flex-shrink: 0; margin-top: 3px; color: #8A6414; }
@media (max-width: 900px) { .rc-grid { grid-template-columns: minmax(0, 1fr); } .rc-photo { aspect-ratio: 16 / 9; } }
@media (prefers-reduced-motion: reduce) { .rc-card { transition: none; } }
`;
