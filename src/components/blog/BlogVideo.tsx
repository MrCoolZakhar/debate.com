'use client';

// The full chair guide video at the bottom of every blog post (owner, 31 Oct 2026: "in the
// blogs on the bottom add my full youtube video, the one that is also on sessions").
// The same video and card as /sessions (SessionsVideo.tsx), in English like the rest of the
// blog. Click to load: nothing is fetched from YouTube until the reader presses play
// (CLAUDE.md §3); the poster is our own copy of the thumbnail.

import { useState } from 'react';
import Link from 'next/link';
import { Play, Clapperboard } from 'lucide-react';
import YouTubeClickToLoad, { CHAIR_GUIDE_VIDEO_ID, CHAIR_GUIDE_THUMB } from '@/components/YouTubeClickToLoad';

const TITLE = 'Your First Committee, Start to Finish';

export default function BlogVideo() {
  const [playing, setPlaying] = useState(false);
  return (
    <section className="bv" aria-labelledby="bv-title">
      <style>{CSS}</style>
      <div className="bv-card">
        <YouTubeClickToLoad
          videoId={CHAIR_GUIDE_VIDEO_ID}
          title={TITLE}
          playLabel="Watch the guide"
          thumbSrc={CHAIR_GUIDE_THUMB}
          sizes="(min-width: 900px) 560px, 92vw"
          playing={playing}
          onPlay={() => setPlaying(true)}
        />
        <div className="bv-copy">
          <span className="bv-kicker"><Clapperboard size={16} strokeWidth={1.6} aria-hidden /> Chair guide</span>
          <h2 id="bv-title" className="bv-h2">{TITLE}</h2>
          <p className="bv-line">Watch a full session run on Gavelling: roll call, the speakers list, caucuses and the vote, all from one laptop while delegates follow on their phones.</p>
          <div className="bv-acts">
            {!playing && (
              <button type="button" className="bv-watch focus:outline-none" onClick={() => setPlaying(true)}>
                <Play size={15} strokeWidth={2.4} fill="currentColor" aria-hidden /> Watch the guide
              </button>
            )}
            <Link href="/create/sessions" className="bv-link focus:outline-none">Or start a free session</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.bv { font-family: var(--font-brand), system-ui, sans-serif; }
.bv-card { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-items: center; gap: clamp(18px, 2.4vw, 36px);
  padding: clamp(12px, 1.2vw, 16px); background: #FFFFFF; border-radius: 22px;
  box-shadow: 0 1px 2px rgba(27,56,40,.06), 0 18px 40px -24px rgba(27,56,40,.4); }
.bv-copy { padding: 4px clamp(4px, 1vw, 16px) 4px 0; }
.bv-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #1B3828; }
.bv-h2 { margin: 8px 0 0; font-weight: 800; font-size: clamp(22px, 2vw, 30px); line-height: 1.1; letter-spacing: -0.025em; color: #1C1410; }
.bv-line { margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: #5A5046; max-width: 34em; }
.bv-acts { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.bv-watch { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 12px; cursor: pointer;
  background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 55%, #1E4A31 100%); color: #FFFFFF; font: 700 15px/1 var(--font-brand), system-ui, sans-serif;
  box-shadow: 0 8px 18px -8px rgba(27,56,40,.55); }
.bv-watch:hover { filter: brightness(1.08); }
.bv-watch:focus-visible { outline: 2px solid #1B3828; outline-offset: 3px; }
.bv-link { color: #1B3828; font-weight: 700; font-size: 15px; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
.bv-link:focus-visible { outline: 2px solid #1B3828; outline-offset: 3px; border-radius: 4px; }
@media (max-width: 899px) {
  .bv-card { grid-template-columns: 1fr; }
  .bv-copy { padding: 0 6px 6px; }
}
`;
