'use client';

// "Running a whole conference?" The bridge from Sessions to Gavelling
// Conferences: organising a conference, every committee getting its session,
// and one committee drawn by the organiser's REAL live status card
// (CommitteeCard from manage/[slug]/live) fed static demo data
// (./demoLiveRoom). `now` is a fixed instant, so the server and the browser
// render the same card and nothing ticks; the card is inert (it is a picture
// of the product here, not a control).

import Link from 'next/link';
import { Inbox, LayoutGrid, Radio, type LucideIcon } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/lib/translations';
import { CommitteeCard } from '@/app/manage/[slug]/live/CommitteeCard';
import { committeeIdentity } from '@/app/manage/[slug]/live/identity';
import { demoLiveRoom } from './demoLiveRoom';
import { BRAND, FOREST, GOLD_TEXT, CREAM } from './tokens';

const DEMO_NOW = Date.parse('2026-09-24T10:00:00Z');
const DEMO = demoLiveRoom(DEMO_NOW);
const DEMO_IDENTITY = committeeIdentity(DEMO.conf);
const noop = () => {};

const STEPS: { Icon: LucideIcon; title: TranslationKey; body: TranslationKey }[] = [
  { Icon: Inbox, title: 'sl_conf_s1', body: 'sl_conf_s1_d' },
  { Icon: LayoutGrid, title: 'sl_conf_s2', body: 'sl_conf_s2_d' },
  { Icon: Radio, title: 'sl_conf_s3', body: 'sl_conf_s3_d' },
];

export default function ConferenceBridge() {
  const t = useT();
  return (
    <section className="cb relative z-10" style={{ fontFamily: BRAND }}>
      <style>{CSS}</style>
      <div className="cb-in mx-auto w-full">
        <div className="cb-copy">
          <h2 className="cb-h2">{t('sl_conf_title')}</h2>
          <p className="cb-body">{t('sl_conf_body')}</p>
          <ol className="cb-steps">
            {STEPS.map(({ Icon, title, body }) => (
              <li key={title}>
                <span className="cb-ico" aria-hidden><Icon size={20} strokeWidth={2.1} /></span>
                <span>
                  <strong>{t(title)}</strong>
                  <span className="cb-step-body">{t(body)}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="cb-act">
            <Link href="/organisers" className="cb-cta">{t('sl_conf_cta')}</Link>
            <span className="cb-free">{t('sl_conf_free')}</span>
          </div>
        </div>

        <figure className="cb-fig">
          <div className="cb-card" inert aria-hidden>
            <CommitteeCard
              data={DEMO}
              identity={DEMO_IDENTITY}
              now={DEMO_NOW}
              onOpen={noop}
              onOpenRoster={noop}
              onOpenScoreboard={noop}
              onOpenDocuments={noop}
              onOpenDelegate={noop}
            />
          </div>
          <figcaption className="cb-cap">{t('sl_conf_live_caption')}</figcaption>
        </figure>
      </div>
    </section>
  );
}

const CSS = `
.cb { margin-top: clamp(80px, 9vw, 150px); background: radial-gradient(1100px 620px at 85% 30%, #2A5A3C 0%, ${FOREST} 62%); color: ${CREAM}; }
.cb-in { max-width: 1520px; padding: clamp(64px, 7vw, 112px) clamp(16px, 4vw, 64px); display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(32px, 5vw, 88px); align-items: center; }
.cb-h2 { margin: 0; font-weight: 800; font-size: clamp(32px, 3.8vw, 60px); line-height: 1.04; letter-spacing: -0.03em; }
.cb-body { margin: 18px 0 0; font-size: clamp(16.5px, 1.25vw, 19px); line-height: 1.55; color: rgba(250,248,243,.78); max-width: 34em; }
.cb-steps { list-style: none; margin: 32px 0 0; padding: 0; display: grid; gap: 18px; }
.cb-steps li { display: flex; gap: 16px; align-items: flex-start; }
.cb-ico { flex: none; width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: rgba(238,217,138,.12); color: ${GOLD_TEXT};
  box-shadow: inset 0 0 0 1px rgba(238,217,138,.25); }
.cb-steps strong { display: block; font-size: 17px; font-weight: 700; color: ${CREAM}; }
.cb-step-body { display: block; margin-top: 3px; font-size: 15.5px; line-height: 1.5; color: rgba(250,248,243,.7); }
.cb-act { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 34px; }
.cb-cta { display: inline-flex; align-items: center; height: 56px; padding: 0 30px; border-radius: 9999px; background: ${GOLD_TEXT}; color: #14100B;
  font-weight: 700; font-size: 16px; text-decoration: none; box-shadow: 0 14px 30px -14px rgba(0,0,0,.6); transition: transform .16s cubic-bezier(.22,1,.36,1); }
.cb-cta:hover { transform: translateY(-1px); } .cb-cta:active { transform: scale(.97); }
.cb-cta:focus-visible { outline: 2px solid ${GOLD_TEXT}; outline-offset: 3px; }
.cb-free { font-size: 14px; color: rgba(250,248,243,.7); }
.cb-fig { margin: 0; justify-self: center; width: 100%; max-width: 460px; }
.cb-card { border-radius: 24px; box-shadow: 0 40px 70px -30px rgba(0,0,0,.65), 0 0 0 1px rgba(238,217,138,.18); transform: rotate(-1.2deg); }
.cb-cap { margin-top: 18px; font-size: 13.5px; line-height: 1.5; color: rgba(250,248,243,.65); text-align: center; }
@media (max-width: 1023px) { .cb-in { grid-template-columns: minmax(0, 1fr); } .cb-card { transform: none; } }
`;
