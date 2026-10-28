'use client';

/**
 * The click-to-load player behind <TutorialVideo> (TutorialVideo.tsx).
 *
 * PRIVACY. Before the press NOTHING comes from Google: no iframe, no
 * i.ytimg.com thumbnail, no script. The poster is ours (white card, the gavel
 * mark, the title, a forest play button). Pressing play swaps in the
 * privacy-enhanced youtube-nocookie.com embed, which is the first request to
 * YouTube. "Watch on YouTube" is a plain link with no referrer.
 *
 * RELEASE. `serverReleased` is what the server decided when it rendered the
 * page; the browser then checks the real clock (useSyncExternalStore, so the
 * first client render matches the server HTML) and wakes itself at the
 * release moment and whenever the tab becomes visible again. Once the server
 * has said released it stays released, whatever the viewer's clock says.
 *
 * LAYOUT. The frame's aspect ratio is reserved up front (16:9 for the long
 * video, 9:16 for a Short), so neither the poster nor the iframe shifts the
 * page.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import {
  tutorialVideo,
  videoReleaseMs,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  type TutorialVideoId,
} from '@/lib/tutorialVideos';

const INK = '#1C1410';
const INK_SOFT = '#55483C';

/** setTimeout holds at most a signed 32-bit delay (about 24.8 days). */
const MAX_TIMER_MS = 2 ** 31 - 1;

function useReleased(releaseMs: number, serverReleased: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (serverReleased) return () => {};
      const wait = releaseMs - Date.now();
      const timer = wait > 0 ? window.setTimeout(notify, Math.min(wait + 1000, MAX_TIMER_MS)) : undefined;
      // A laptop that slept past the release moment wakes on a visible tab.
      const onVisible = () => {
        if (document.visibilityState === 'visible') notify();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        if (timer !== undefined) window.clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
    [releaseMs, serverReleased],
  );
  const getSnapshot = useCallback(() => serverReleased || Date.now() >= releaseMs, [releaseMs, serverReleased]);
  const getServerSnapshot = useCallback(() => serverReleased, [serverReleased]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function TutorialVideoPlayer({
  id,
  serverReleased,
  children,
}: {
  id: TutorialVideoId;
  serverReleased: boolean;
  children?: React.ReactNode;
}) {
  const video = tutorialVideo(id);
  const released = useReleased(videoReleaseMs(video), serverReleased);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Keyboard users land inside the player they just started.
  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  if (!released) return null;

  const short = video.kind === 'short';
  const meta = video.duration ?? (short ? 'Short' : null);

  return (
    <>
      {children ? <p>{children}</p> : null}
      <figure className={`gv-video ${short ? 'gv-video-short' : ''}`}>
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{
            aspectRatio: short ? '9 / 16' : '16 / 9',
            background: playing ? INK : '#FFFFFF',
            boxShadow: '0 10px 26px rgba(27,56,40,0.16)',
          }}
        >
          {playing ? (
            <iframe
              ref={frameRef}
              src={youtubeEmbedUrl(video)}
              title={video.title}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play video: ${video.title}`}
              className="group absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between border-0 bg-transparent p-5 text-left focus:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[#B6871F] sm:p-6"
            >
              <span className="flex w-full items-center justify-between gap-3" aria-hidden="true">
                <span className="inline-flex items-center gap-2">
                  <Image src="/gavel-mark.webp" alt="" width={28} height={28} className="block h-7 w-7" />
                  <span className="text-[12.5px] font-semibold leading-none" style={{ color: INK_SOFT }}>
                    Gavelling tutorial
                  </span>
                </span>
                {meta ? (
                  <span className="text-[12.5px] font-semibold leading-none tabular-nums" style={{ color: INK_SOFT }}>
                    {meta}
                  </span>
                ) : null}
              </span>

              <span className="flex w-full flex-1 items-center justify-center" aria-hidden="true">
                <span
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full transition-transform duration-150 ease-out group-hover:scale-[1.06] group-active:scale-[0.96]"
                  style={{
                    background: 'linear-gradient(180deg, #2A5A3C 0%, #1B3828 100%)',
                    boxShadow: '0 10px 24px rgba(27,56,40,0.30)',
                  }}
                >
                  <Play size={28} strokeWidth={1.5} fill="#F6F1E4" color="#F6F1E4" className="ml-1" />
                </span>
              </span>

              <span
                className="block w-full text-[17px] font-semibold [overflow-wrap:anywhere] [text-wrap:balance] sm:text-[18px]"
                style={{ color: INK, lineHeight: 1.3 }}
                aria-hidden="true"
              >
                {video.title}
              </span>
            </button>
          )}
        </div>
        <figcaption>
          <a href={youtubeWatchUrl(video)} target="_blank" rel="noopener noreferrer">
            Watch on YouTube
          </a>
        </figcaption>
      </figure>
    </>
  );
}
