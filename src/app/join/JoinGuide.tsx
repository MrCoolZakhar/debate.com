'use client';

// "How Joining Works": a short section under the /join card (item 17, Oct 2026).
//
// Mounted by ./layout.tsx AFTER the page, so it never touches the join card's
// fixed slots (code field, message rail, stage, Join button) and sits below the
// fold. It is server-rendered in English (the language provider's default), so
// the raw HTML has real, visible text for crawlers, and the FAQPage JSON-LD in
// the layout is built from the same English strings (sessionsSchema.ts). On the
// client the reader's own language replaces it, like every other sessions text.
//
// Look: no ground of its own (the page's fixed backdrop and the ivory body show through, so there is no seam), one white card with a soft forest-tinted
// shadow, questions as a roomy two-column list on wide screens. Below lg the
// phone tab bar (MobileTabBar, fixed, 62px + safe area) covers the foot, so the
// section pads for it.
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { GoldWord } from '@/components/BrandHeading';
import { C, SHADOW } from './joinUi';
import { JOIN_FAQ } from './sessionsSchema';

const BRAND = 'var(--font-brand), sans-serif';

export default function JoinGuide() {
  const t = useT();
  return (
    <section
      aria-labelledby="join-guide-title"
      className="relative z-10 w-full px-4 pt-10 pb-[calc(62px+env(safe-area-inset-bottom)+40px)] sm:px-6 lg:pb-16"
      style={{ fontFamily: BRAND }}
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <h2
          id="join-guide-title"
          className="m-0 text-[clamp(24px,2.4vw,34px)] font-extrabold tracking-[-0.02em]"
          style={{ color: C.ink, lineHeight: 1.1 }}
        >
          {t('cj_join_title_lead')} <GoldWord tone="light">{t('cj_join_title_accent')}</GoldWord>
        </h2>
        <dl
          className="m-0 mt-6 grid grid-cols-1 gap-x-10 gap-y-6 rounded-3xl bg-white p-6 sm:p-8 md:grid-cols-2"
          style={{ boxShadow: SHADOW.card }}
        >
          {JOIN_FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="text-[16px] font-bold" style={{ color: C.ink, lineHeight: 1.35 }}>{t(q)}</dt>
              <dd className="m-0 mt-1.5 text-[15px]" style={{ color: C.inkSoft, lineHeight: 1.55 }}>{t(a)}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 mt-5 text-[15px]" style={{ color: C.inkSoft }}>
          {t('cj_join_create_lead')}{' '}
          <Link href="/create/sessions" className="font-bold underline underline-offset-2 focus:outline-none focus-visible:rounded focus-visible:shadow-[0_0_0_2px_#1B3828]" style={{ color: C.forest }}>
            {t('cj_join_create_link')}
          </Link>
        </p>
      </div>
    </section>
  );
}
