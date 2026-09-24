'use client';

// "One room. Three seats." Chairs / Delegates / Faculty advisors. Every image
// is a REAL screen from a Gavelling session (public/sessions/*.png, captured
// from a throwaway room on 24 Sep 2026; alt text and provenance in
// public/sessions/clips.json). The stage has a fixed shape so switching tabs or
// screens never moves the page; every screen of the open tab is mounted and
// cross-faded, so a switch never waits for an image.

import { useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { Gavel, Smartphone, GraduationCap, type LucideIcon } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/lib/translations';
import { BRAND, INK, INK_SOFT, FOREST, GOLD, GOLD_TEXT, HAIR, IVORY } from './tokens';

type Clip = { key: TranslationKey; src: string; w: number; h: number; alt: string };
type Role = {
  id: 'chairs' | 'delegates' | 'advisors';
  tab: TranslationKey;
  Icon: LucideIcon;
  title: TranslationKey;
  lines: TranslationKey[];
  kind: 'desktop' | 'phone';
  clips: Clip[];
};

const ROLES: Role[] = [
  {
    id: 'chairs', tab: 'sl_tab_chairs', Icon: Gavel, title: 'sl_chair_title',
    lines: ['sl_chair_1', 'sl_chair_2', 'sl_chair_3'], kind: 'desktop',
    clips: [
      { key: 'sl_clip_floor', src: '/sessions/chair-floor.png', w: 2880, h: 1800, alt: "The chair's console on the General Speakers' List: Kenya has the floor with 1:02 left and the speakers list runs down the side." },
      { key: 'sl_clip_motions', src: '/sessions/chair-motions.png', w: 2342, h: 1618, alt: 'The Motions dialog ranking four motions on the floor, with Accept and Reject.' },
      { key: 'sl_clip_voting', src: '/sessions/chair-voting.png', w: 2880, h: 1800, alt: 'A roll call vote on a draft resolution: Indonesia is voting and the tally reads 5 for, 1 against.' },
    ],
  },
  {
    id: 'delegates', tab: 'sl_tab_delegates', Icon: Smartphone, title: 'sl_del_title',
    lines: ['sl_del_1', 'sl_del_2', 'sl_del_3'], kind: 'phone',
    clips: [
      { key: 'sl_clip_board', src: '/sessions/delegate-phone.png', w: 1170, h: 2532, alt: "A delegate's phone: Norway is 3rd in the queue, with the speakers list and buttons to submit a document or chat." },
      { key: 'sl_clip_chat', src: '/sessions/delegate-chat.png', w: 1170, h: 2532, alt: 'Delegate chat on a phone: France and Ghana agree to co-sponsor a working paper.' },
    ],
  },
  {
    id: 'advisors', tab: 'sl_tab_advisors', Icon: GraduationCap, title: 'sl_adv_title',
    lines: ['sl_adv_1', 'sl_adv_2', 'sl_adv_3'], kind: 'desktop',
    clips: [
      { key: 'sl_clip_advisor', src: '/sessions/advisor.png', w: 2880, h: 1480, alt: "The faculty advisor view: who is speaking, who is next, and France's card with its last motion and a nudge." },
    ],
  },
];

export default function RoleShowcase() {
  const t = useT();
  const [roleIdx, setRoleIdx] = useState(0);
  const [clipIdx, setClipIdx] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[roleIdx];

  const pickRole = (i: number) => { setRoleIdx(i); setClipIdx(0); };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    if (!dir && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? ROLES.length - 1 : (i + (rtl ? -dir : dir) + ROLES.length) % ROLES.length;
    pickRole(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="rs relative z-10 mx-auto w-full" style={{ fontFamily: BRAND }}>
      <style>{CSS}</style>
      <h2 className="rs-h2">{t('sl_roles_title')}</h2>
      <p className="rs-sub" style={{ color: INK_SOFT }}>{t('sl_roles_sub')}</p>

      <div role="tablist" aria-label={t('sl_roles_title')} className="rs-tabs">
        {ROLES.map((r, i) => {
          const on = i === roleIdx;
          return (
            <button
              key={r.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`rs-tab-${r.id}`}
              aria-selected={on}
              aria-controls="rs-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => pickRole(i)}
              onKeyDown={(e) => onTabKey(e, i)}
              className="rs-tab focus:outline-none"
              data-on={on || undefined}
            >
              <r.Icon size={20} strokeWidth={2.1} aria-hidden />
              <span>{t(r.tab)}</span>
            </button>
          );
        })}
      </div>

      <div id="rs-panel" role="tabpanel" aria-labelledby={`rs-tab-${role.id}`} className="rs-panel">
        <div className="rs-copy">
          <h3 className="rs-h3">{t(role.title)}</h3>
          <ul className="rs-lines">
            {role.lines.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
          {role.clips.length > 1 && (
            <div className="rs-clips" role="group" aria-label={t('sl_clips_label')}>
              {role.clips.map((c, i) => (
                <button
                  key={c.src}
                  type="button"
                  aria-pressed={i === clipIdx}
                  onClick={() => setClipIdx(i)}
                  className="rs-clip focus:outline-none"
                >
                  {t(c.key)}
                </button>
              ))}
            </div>
          )}
          <p className="rs-note" style={{ color: '#6B5F52' }}>{t('sl_clips_label')}</p>
        </div>

        <div className={`rs-stage rs-stage-${role.kind}`}>
          {role.kind === 'desktop'
            ? role.clips.map((c, i) => (
                <figure key={c.src} className="rs-shot" data-on={i === clipIdx || undefined} aria-hidden={i !== clipIdx}>
                  <Image src={c.src} alt={c.alt} width={c.w} height={c.h} sizes="(min-width: 1024px) 60vw, 94vw" className="rs-img" />
                </figure>
              ))
            : role.clips.map((c, i) => {
                const front = i === clipIdx;
                return (
                  <button
                    key={c.src}
                    type="button"
                    className="rs-phone focus:outline-none"
                    data-front={front || undefined}
                    data-slot={i}
                    onClick={() => setClipIdx(i)}
                    aria-label={t(c.key)}
                    aria-pressed={front}
                  >
                    <Image src={c.src} alt={c.alt} width={c.w} height={c.h} sizes="(min-width: 1024px) 18vw, 44vw" className="rs-img" />
                  </button>
                );
              })}
        </div>
      </div>
    </section>
  );
}

const CSS = `
.rs { max-width: 1520px; padding: clamp(40px, 4.4vw, 72px) clamp(16px, 4vw, 64px) 0; }
.rs-h2 { margin: 0; font-weight: 800; font-size: clamp(30px, 3.2vw, 50px); line-height: 1.05; letter-spacing: -0.03em; color: ${INK}; }
.rs-sub { margin: 10px 0 0; font-size: 16.5px; line-height: 1.55; max-width: 36em; }
.rs-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: clamp(20px, 2vw, 28px); padding: 5px; border-radius: 9999px; width: fit-content; max-width: 100%;
  background: rgba(255,255,255,.7); box-shadow: inset 0 0 0 1.5px ${HAIR}; }
.rs-tab { display: inline-flex; align-items: center; gap: 9px; height: 46px; padding: 0 20px; border: 0; border-radius: 9999px; background: transparent;
  font: 700 15px/1 ${BRAND}; color: ${INK_SOFT}; cursor: pointer; transition: background-color .2s, color .2s; }
.rs-tab:hover { color: ${FOREST}; background: rgba(27,56,40,.06); }
.rs-tab[data-on] { background: ${FOREST}; color: ${GOLD_TEXT}; }
.rs-tab:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
.rs-panel { display: grid; grid-template-columns: minmax(0, .72fr) minmax(0, 1.55fr); gap: clamp(20px, 3vw, 48px); align-items: center; margin-top: clamp(18px, 2vw, 28px); }
.rs-h3 { margin: 0; font-weight: 800; font-size: clamp(22px, 1.9vw, 30px); line-height: 1.12; letter-spacing: -0.02em; color: ${INK}; }
.rs-lines { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 9px; }
.rs-lines li { display: flex; gap: 12px; align-items: baseline; font-size: 16px; line-height: 1.45; color: ${INK}; }
.rs-lines li::before { content: ""; flex: none; width: 14px; height: 2px; background: ${GOLD}; transform: translateY(-5px); }
.rs-clips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.rs-clip { height: 38px; padding: 0 15px; border: 0; border-radius: 9999px; background: transparent; box-shadow: inset 0 0 0 1.5px ${HAIR};
  font: 600 13.5px/1 ${BRAND}; color: ${INK_SOFT}; cursor: pointer; transition: background-color .2s, color .2s, box-shadow .2s; }
.rs-clip:hover { color: ${FOREST}; box-shadow: inset 0 0 0 1.5px ${FOREST}; }
.rs-clip[aria-pressed="true"] { background: ${FOREST}; color: ${GOLD_TEXT}; box-shadow: none; }
.rs-clip:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
.rs-note { margin: 14px 0 0; font-size: 12.5px; }
.rs-stage { position: relative; border-radius: 26px; background: ${IVORY}; aspect-ratio: 16 / 10.2; overflow: hidden; box-shadow: inset 0 0 0 1.5px ${HAIR}; }
.rs-stage-desktop { padding: clamp(14px, 2vw, 28px); }
.rs-shot { position: absolute; inset: clamp(14px, 2vw, 28px); margin: 0; display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(.985); transition: opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1); pointer-events: none; }
.rs-shot[data-on] { opacity: 1; transform: none; }
.rs-shot .rs-img { width: 100%; height: 100%; object-fit: contain; border-radius: 14px; filter: drop-shadow(0 22px 34px rgba(27,56,40,.22)); }
.rs-stage-phone { background: linear-gradient(160deg, #F1EBDD, #E4DBC6); }
.rs-phone { position: absolute; top: 7%; height: 86%; aspect-ratio: 1170 / 2532; padding: 0; border: 0; background: #111; border-radius: 34px; overflow: hidden; cursor: pointer;
  box-shadow: 0 0 0 7px #111, 0 26px 44px -8px rgba(27,56,40,.4); transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .3s, filter .3s; }
.rs-phone .rs-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rs-phone[data-slot="0"] { inset-inline-start: 27%; }
.rs-phone[data-slot="1"] { inset-inline-start: 50%; }
.rs-phone:not([data-front]) { transform: scale(.9); opacity: .82; filter: saturate(.8); z-index: 1; }
.rs-phone[data-front] { z-index: 2; }
.rs-phone:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 10px; }
@media (max-width: 1023px) {
  .rs-panel { grid-template-columns: minmax(0, 1fr); }
  .rs-tab { height: 46px; padding: 0 16px; font-size: 15px; }
  .rs-stage-phone { aspect-ratio: 4 / 5; }
  .rs-phone[data-slot="0"] { inset-inline-start: 12%; }
  .rs-phone[data-slot="1"] { inset-inline-start: 44%; }
}
@media (max-width: 520px) { .rs-tabs { border-radius: 22px; } .rs-tab span { font-size: 14px; } }
@media (prefers-reduced-motion: reduce) { .rs-shot, .rs-phone { transition: none; } }
`;
