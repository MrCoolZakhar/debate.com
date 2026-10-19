'use client';

// "See how it works": the YouTube walkthrough of Gavelling, right below the
// /sessions hero (owner, 19 Oct 2026).
//
// Click to load, on purpose: the site loads no third party (CLAUDE.md §3), so
// until the visitor presses play this is our own poster (the hero's laptop and
// phone stills) and nothing is fetched from YouTube. The press swaps in the
// youtube-nocookie.com player, playing at once.

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { BRAND, INK, INK_SOFT, FOREST, WHITE, CTA_GRADIENT } from './tokens';

const VIDEO_ID = 'jaYmgylFMVs';

export default function SessionsVideo() {
  const t = useT();
  const [playing, setPlaying] = useState(false);

  return (
    <section className="sv" aria-labelledby="sv-title">
      <style>{CSS}</style>
      <h2 id="sv-title" className="sv-h2">{t('sl_video_title')}</h2>
      <div className="sv-frame">
        {playing ? (
          <iframe
            className="sv-player"
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title={t('sl_video_title')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" className="sv-poster focus:outline-none" onClick={() => setPlaying(true)} aria-label={t('sl_video_play')}>
            <Image src="/sessions/hero-laptop.webp" alt="" width={1000} height={610} sizes="(min-width: 1024px) 60vw, 92vw" className="sv-laptop" />
            <Image src="/sessions/hero-phone.webp" alt="" width={660} height={1141} sizes="(min-width: 1024px) 14vw, 26vw" className="sv-phone" />
            <span className="sv-play" aria-hidden><Play size={30} strokeWidth={2.2} fill={WHITE} /></span>
          </button>
        )}
      </div>
      {!playing && <p className="sv-note">{t('sl_video_note')}</p>}
    </section>
  );
}

const CSS = `
.sv { max-width: 1120px; margin: 0 auto; padding: clamp(24px, 3vw, 44px) clamp(16px, 4vw, 64px) clamp(8px, 1vw, 16px); font-family: ${BRAND}; }
.sv-h2 { margin: 0; text-align: center; font-weight: 800; font-size: clamp(22px, 2vw, 32px); line-height: 1.05; letter-spacing: -0.03em; color: ${INK}; }
.sv-frame { position: relative; margin-top: clamp(16px, 1.8vw, 24px); aspect-ratio: 16 / 9; border-radius: 22px; overflow: hidden; background: ${WHITE};
  box-shadow: 0 30px 60px -38px rgba(27,56,40,.6), 0 2px 6px rgba(27,56,40,.08); }
.sv-player { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.sv-poster { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; cursor: pointer; background: linear-gradient(180deg, #FFFFFF 0%, #F4EFE3 100%); }
.sv-laptop { position: absolute; left: 8%; top: 12%; width: 74%; height: auto; }
.sv-phone { position: absolute; right: 9%; bottom: 7%; width: 17%; height: auto; filter: drop-shadow(0 18px 30px rgba(27,56,40,.28)); }
.sv-play { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; margin: -38px 0 0 -38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: ${WHITE}; background: ${CTA_GRADIENT};
  box-shadow: 0 14px 30px -10px rgba(27,56,40,.65); transition: transform .2s cubic-bezier(.22,1,.36,1); }
.sv-play svg { margin-left: 4px; }
.sv-poster:hover .sv-play { transform: scale(1.06); }
.sv-poster:focus-visible .sv-play { outline: 3px solid ${FOREST}; outline-offset: 4px; }
.sv-note { margin: 10px 0 0; text-align: center; font-size: 13px; color: ${INK_SOFT}; }
@media (prefers-reduced-motion: reduce) { .sv-play { transition: none; } .sv-poster:hover .sv-play { transform: none; } }
`;
