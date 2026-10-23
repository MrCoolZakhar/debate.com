/**
 * A Gavelling tutorial video inside a blog post, and its structured data.
 *
 *   <TutorialVideo id="H3KBZVen978">One short lead-in sentence.</TutorialVideo>
 *   <TutorialVideoJsonLd ids={['H3KBZVen978']} />
 *
 * Server components. Each decides "released?" at render time (the page
 * revalidates hourly) and the player re-checks on the real clock in the
 * browser, so a scheduled video appears by itself once `publishAt` plus the
 * 2-hour margin has passed. Until then both render nothing at all, and the
 * lead-in sentence goes with the video, so a post never says "watch this"
 * over an empty space. The rules are in src/lib/tutorialVideos.ts.
 *
 * Privacy (CLAUDE.md §3, no third-party tracking): nothing is loaded from
 * Google until the reader presses play. See TutorialVideoPlayer.tsx.
 */

import {
  isVideoReleased,
  tutorialVideo,
  tutorialVideoSchemas,
  type TutorialVideoId,
} from '@/lib/tutorialVideos';
import TutorialVideoPlayer from './TutorialVideoPlayer';

export default function TutorialVideo({ id, children }: { id: TutorialVideoId; children?: React.ReactNode }) {
  const serverReleased = isVideoReleased(tutorialVideo(id));
  return (
    <TutorialVideoPlayer id={id} serverReleased={serverReleased}>
      {children}
    </TutorialVideoPlayer>
  );
}

/** The VideoObject blocks for the videos on this page that are out. Renders
 *  nothing while none are. */
export function TutorialVideoJsonLd({ ids }: { ids: readonly TutorialVideoId[] }) {
  const schemas = tutorialVideoSchemas(ids);
  if (schemas.length === 0) return null;
  return (
    <>
      {schemas.map((s) => (
        <script
          key={s.embedUrl}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
