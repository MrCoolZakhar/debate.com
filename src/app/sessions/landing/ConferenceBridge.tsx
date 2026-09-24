'use client';

// "Running a whole conference?" The bridge from Sessions to Gavelling
// Conferences. The product carries the section: three committees drawn by the
// organiser's REAL live status card (CommitteeCard from manage/[slug]/live),
// fed static demo rooms (./demoLiveRoom), laid out the way the live wall lays
// them out. Light ground only (owner, 24 Sep 2026: no full-width green bands).
// `now` is a fixed instant, so the server and the browser render the same
// cards and nothing ticks; the cards are inert (a picture of the product
// here, not a control).

import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { CommitteeCard } from '@/app/manage/[slug]/live/CommitteeCard';
import { committeeIdentity } from '@/app/manage/[slug]/live/identity';
import { demoLiveRooms } from './demoLiveRoom';
import { BRAND, INK, INK_SOFT, FOREST, GOLD_TEXT, HAIR, IVORY } from './tokens';

const DEMO_NOW = Date.parse('2026-09-24T10:00:00Z');
const ROOMS = demoLiveRooms(DEMO_NOW).map((data) => ({ data, identity: committeeIdentity(data.conf) }));
const noop = () => {};

export default function ConferenceBridge() {
  const t = useT();
  return (
    <section className="cb relative z-10 mx-auto w-full" style={{ fontFamily: BRAND }}>
      <style>{CSS}</style>
      <div className="cb-head">
        <div>
          <h2 className="cb-h2">{t('sl_conf_title')}</h2>
          <p className="cb-body">{t('sl_conf_body')}</p>
        </div>
        <div className="cb-act">
          <Link href="/organisers" className="cb-cta">{t('sl_conf_cta')}</Link>
          <span className="cb-free">{t('sl_conf_free')}</span>
        </div>
      </div>

      <figure className="cb-wall">
        <div className="cb-cards" inert aria-hidden>
          {ROOMS.map(({ data, identity }) => (
            <div key={data.conf.id} className="cb-card">
              <CommitteeCard
                data={data}
                identity={identity}
                now={DEMO_NOW}
                onOpen={noop}
                onOpenRoster={noop}
                onOpenScoreboard={noop}
                onOpenDocuments={noop}
                onOpenDelegate={noop}
              />
            </div>
          ))}
        </div>
        <figcaption className="cb-cap">{t('sl_conf_live_caption')}</figcaption>
      </figure>
    </section>
  );
}

const CSS = `
.cb { max-width: 1520px; padding: clamp(56px, 6vw, 96px) clamp(16px, 4vw, 64px) clamp(56px, 6vw, 96px); }
.cb-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px 48px; flex-wrap: wrap; }
.cb-h2 { margin: 0; font-weight: 800; font-size: clamp(30px, 3.2vw, 50px); line-height: 1.05; letter-spacing: -0.03em; color: ${INK}; }
.cb-body { margin: 12px 0 0; font-size: 16.5px; line-height: 1.55; color: ${INK_SOFT}; max-width: 40em; }
.cb-act { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.cb-cta { display: inline-flex; align-items: center; height: 52px; padding: 0 26px; border-radius: 9999px; background: ${FOREST}; color: ${GOLD_TEXT};
  font-weight: 700; font-size: 15.5px; text-decoration: none; box-shadow: 0 14px 28px -16px rgba(27,56,40,.8); transition: transform .16s cubic-bezier(.22,1,.36,1), background-color .2s; }
.cb-cta:hover { background: #224733; } .cb-cta:active { transform: scale(.97); }
.cb-cta:focus-visible { outline: 2px solid #B6871F; outline-offset: 3px; }
.cb-free { font-size: 13.5px; color: #6B5F52; }
.cb-wall { margin: clamp(24px, 2.6vw, 36px) 0 0; padding: clamp(14px, 1.6vw, 22px); border-radius: 28px; background: ${IVORY};
  box-shadow: inset 0 0 0 1.5px ${HAIR}, 0 30px 60px -44px rgba(27,56,40,.45); }
.cb-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(12px, 1.4vw, 20px); align-items: start; }
.cb-cap { margin: 14px 4px 2px; font-size: 13px; color: #6B5F52; }
@media (max-width: 1100px) { .cb-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cb-card:nth-child(3) { display: none; } }
@media (max-width: 700px) { .cb-cards { grid-template-columns: minmax(0, 1fr); } .cb-card:nth-child(n+2) { display: none; } }
`;
