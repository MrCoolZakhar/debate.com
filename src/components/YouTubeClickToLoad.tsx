'use client';

// A YouTube video that loads nothing from YouTube until it is pressed (CLAUDE.md §3:
// no third party loads before a press). Before the press it is our own thumbnail
// (a file in public/) or, without one, a plain forest poster, with a play disc; the
// press swaps in the youtube-nocookie.com player, playing at once.
//
// Used by the /sessions chair guide (src/app/sessions/landing/SessionsVideo.tsx, which
// also starts it from its own "Watch the guide" button, so `playing` can be controlled)
// and by the chair tutorial's first card (src/components/TutorialOverlay.tsx).

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

/** The chair guide ("How to Chair a MUN Committee"), on /sessions and the tutorial's first card.
 *  Its thumbnail is public/sessions/video-thumb.webp. */
export const CHAIR_GUIDE_VIDEO_ID = 'jaYmgylFMVs';
export const CHAIR_GUIDE_THUMB = '/sessions/video-thumb.webp';

const CTA_GRADIENT = 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 55%, #1E4A31 100%)';

export default function YouTubeClickToLoad({
  videoId, title, playLabel, thumbSrc = null, sizes = '560px', playing: playingProp, onPlay,
  radius = 14, discPx = 62, caption, className = '',
}: {
  videoId: string;
  /** The iframe's title (the video's name). */
  title: string;
  /** The poster button's accessible name ("Watch the guide"). */
  playLabel: string;
  /** Our own copy of the thumbnail in public/, or null for the plain poster. Never a YouTube URL. */
  thumbSrc?: string | null;
  sizes?: string;
  /** Controlled: the caller starts it from a button of its own. Omit to let the poster own it. */
  playing?: boolean;
  onPlay?: () => void;
  radius?: number;
  discPx?: number;
  /** A short line on the plain poster (no thumbnail), under the disc. */
  caption?: string;
  className?: string;
}) {
  const [ownPlaying, setOwnPlaying] = useState(false);
  const playing = playingProp ?? ownPlaying;
  const start = () => { setOwnPlaying(true); onPlay?.(); };

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: '16 / 9', borderRadius: radius, backgroundColor: '#1C1410', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full border-0"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={playLabel}
          className="group absolute inset-0 h-full w-full cursor-pointer border-0 p-0 focus:outline-none"
          style={{ background: thumbSrc ? 'transparent' : 'linear-gradient(135deg, #2A5A3C 0%, #1B3828 60%, #14301F 100%)' }}
        >
          {thumbSrc && (
            <Image
              src={thumbSrc} alt="" fill sizes={sizes}
              className="object-cover transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          )}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full text-white transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.07] group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-4 group-focus-visible:outline-white motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            style={{
              width: discPx, height: discPx, marginLeft: -discPx / 2, marginTop: -discPx / 2,
              background: CTA_GRADIENT,
              boxShadow: `0 0 0 ${Math.round(discPx / 10)}px rgba(255,255,255,.28), 0 14px 30px -10px rgba(0,0,0,.55)`,
            }}
          >
            <Play size={Math.round(discPx * 0.42)} strokeWidth={2.2} fill="#FFFFFF" style={{ marginLeft: Math.round(discPx / 20) }} />
          </span>
          {!thumbSrc && caption && (
            <span
              aria-hidden
              className="absolute inset-x-0 text-center font-semibold text-white/90 [text-wrap:balance]"
              style={{ top: `calc(50% + ${discPx / 2 + 12}px)`, fontSize: 13, paddingInline: 12 }}
            >
              {caption}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
