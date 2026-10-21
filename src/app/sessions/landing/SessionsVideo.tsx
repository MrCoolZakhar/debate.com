'use client';

// The chair guide video, right below the /sessions hero (owner, 19 Oct 2026:
// "the section shouldn't be huge, include the same thumbnail as from the video.
// Video on the left side, right side title and short description").
//
// Click to load, on purpose: the site loads no third party (CLAUDE.md §3), so
// the thumbnail is the video's own, stored in public/sessions/video-thumb.webp,
// and nothing is fetched from YouTube until the visitor presses play; the press
// swaps in the youtube-nocookie.com player, playing at once. The player itself is
// the shared src/components/YouTubeClickToLoad.tsx.

import { useState } from 'react';
import Link from 'next/link';
import { Play, Clapperboard } from 'lucide-react';
import YouTubeClickToLoad, { CHAIR_GUIDE_VIDEO_ID as VIDEO_ID } from '@/components/YouTubeClickToLoad';
import { useT } from '@/contexts/LanguageContext';
import { BRAND, INK, INK_SOFT, FOREST, WHITE, CTA_GRADIENT } from './tokens';

export default function SessionsVideo() {
  const t = useT();
  const [playing, setPlaying] = useState(false);

  return (
    <section className="sv" aria-labelledby="sv-title">
      <style>{CSS}</style>
      <div className="sv-card">
        <YouTubeClickToLoad
          videoId={VIDEO_ID}
          title={t('sl_video_title')}
          playLabel={t('sl_video_play')}
          thumbSrc="/sessions/video-thumb.webp"
          sizes="(min-width: 900px) 560px, 92vw"
          playing={playing}
          onPlay={() => setPlaying(true)}
        />
        <div className="sv-copy">
          <span className="sv-kicker"><Clapperboard size={16} strokeWidth={2.2} aria-hidden /> {t('sl_video_kicker')}</span>
          <h2 id="sv-title" className="sv-h2">{t('sl_video_title')}</h2>
          <p className="sv-line">{t('sl_video_line')}</p>
          <div className="sv-acts">
            {!playing && (
              <button type="button" className="sv-watch focus:outline-none" onClick={() => setPlaying(true)}>
                <Play size={15} strokeWidth={2.4} fill="currentColor" aria-hidden /> {t('sl_video_play')}
              </button>
            )}
            <Link href="/create/sessions" className="sv-link focus:outline-none">{t('sl_video_cta')}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.sv { max-width: 1120px; margin: 0 auto; padding: clamp(20px, 2.4vw, 36px) clamp(16px, 4vw, 64px) 0; font-family: ${BRAND}; }
.sv-card { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-items: center; gap: clamp(18px, 2.4vw, 36px);
  padding: clamp(12px, 1.2vw, 16px); background: ${WHITE}; border-radius: 22px;
  box-shadow: 0 1px 2px rgba(27,56,40,.06), 0 18px 40px -24px rgba(27,56,40,.4); }
.sv-copy { padding: 4px clamp(4px, 1vw, 16px) 4px 0; }
.sv-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: ${FOREST}; }
.sv-h2 { margin: 8px 0 0; font-weight: 800; font-size: clamp(22px, 2vw, 30px); line-height: 1.1; letter-spacing: -0.025em; color: ${INK}; }
.sv-line { margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: ${INK_SOFT}; max-width: 34em; }
.sv-acts { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.sv-watch { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 12px; cursor: pointer;
  background: ${CTA_GRADIENT}; color: ${WHITE}; font: 700 15px/1 ${BRAND}; box-shadow: 0 8px 18px -8px rgba(27,56,40,.55); }
.sv-watch:hover { filter: brightness(1.08); }
.sv-watch:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; }
.sv-link { color: ${FOREST}; font-weight: 700; font-size: 15px; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
.sv-link:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 3px; border-radius: 4px; }
@media (max-width: 899px) {
  .sv-card { grid-template-columns: 1fr; }
  .sv-copy { padding: 0 6px 6px; }
}
`;
