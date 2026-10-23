// ── Gavelling's YouTube tutorials: the one list ─────────────────────────────
//
// Every tutorial video the blog embeds is listed here, once. The embed
// (src/components/blog/TutorialVideo.tsx) and the VideoObject JSON-LD
// (TutorialVideoJsonLd in the same file) both read it, so a video can never be
// on a page and missing from its structured data, or the other way round.
//
// RELEASE GATING (owner, 23 Oct 2026). Scheduled videos are private until the
// channel publishes them, so each one is hidden until `publishAt` plus
// RELEASE_MARGIN_MS (2 hours, in case the channel's time zone is not the one
// written here). Before that, an embed renders NOTHING: no placeholder, no
// "coming soon". The check runs twice:
//   • on the server, when the page is rendered (blog pages with a video export
//     `revalidate = 3600`, so the server HTML and the JSON-LD catch up within
//     an hour of release, no redeploy), and
//   • in the browser, on the real current time, so a cached page shows the
//     video the moment its margin passes.
//
// Times are the channel's local time, UTC+08:00. To add a video: add a row,
// then place <TutorialVideo id="..."> where the post talks about that exact
// thing and add the id to that page's <TutorialVideoJsonLd ids={[...]} />.

export type TutorialVideoKind = 'long' | 'short';

export interface TutorialVideoDef {
  /** The YouTube video id. */
  id: string;
  /** The title as it is on YouTube. Title Case. */
  title: string;
  /** 'long' is a 16:9 video; 'short' is a 9:16 YouTube Short. */
  kind: TutorialVideoKind;
  /** When the channel publishes it, ISO 8601 with the +08:00 offset. */
  publishAt: string;
  /** "20:19". Optional: shown on the poster and written to the JSON-LD only
   *  when known. */
  duration?: string;
  /** One plain line: what the viewer sees. Used as the JSON-LD description. */
  description: string;
  topics: readonly string[];
}

/** How long after `publishAt` a video is first shown. */
export const RELEASE_MARGIN_MS = 2 * 60 * 60 * 1000;

const VIDEOS = [
  {
    id: 'jaYmgylFMVs',
    title: 'How to Chair a MUN Committee in 2026 (Gavelling Chair Guide)',
    kind: 'long',
    publishAt: '2026-10-18T00:00:00+08:00',
    duration: '20:19',
    description:
      'A full walk through chairing a Model UN committee on Gavelling, from roll call and the speakers list to caucuses, motions, documents and voting.',
    topics: ['chairing', 'roll-call', 'speakers-list', 'caucus', 'motions', 'voting'],
  },
  {
    id: 'H3KBZVen978',
    title: 'The Fastest Way to Do Roll Call in MUN',
    kind: 'short',
    publishAt: '2026-10-22T00:00:00+08:00',
    description: 'Mark everyone at once or one by one, check quorum and begin the session.',
    topics: ['roll-call', 'quorum'],
  },
  {
    id: 'Dxkui5yPPXQ',
    title: 'Choosing MUN Awards Just Got Easier',
    kind: 'short',
    publishAt: '2026-10-22T00:00:00+08:00',
    description:
      'See the best performing delegates, where every point came from and the full committee history, and adjust points by hand.',
    topics: ['awards', 'scoreboard', 'points'],
  },
  {
    id: 'aFiXg0WtvH8',
    title: 'Two MUN Chairs, One Room: How Co-Chairing Works',
    kind: 'short',
    publishAt: '2026-10-22T00:00:00+08:00',
    description:
      'A co-chair joins as a Commenter with private notes and ratings for every speech, and the gavel can be handed over at any time.',
    topics: ['co-chair', 'notes', 'ratings', 'gavel'],
  },
  {
    id: 'BCQyOGywPOg',
    title: 'Make MUN Rules of Procedure Work Your Way',
    kind: 'short',
    publishAt: '2026-10-23T00:00:00+08:00',
    description:
      'Choose what delegates can do, set the timer sound, reorder and rename motions and build your own points system.',
    topics: ['settings', 'rules-of-procedure', 'motions', 'points'],
  },
  {
    id: 'Itr-yHCyDto',
    title: 'Everything MUN Chairs Can Do That Delegates Never See',
    kind: 'short',
    publishAt: '2026-10-23T00:00:00+08:00',
    description:
      'Show the session code as a QR code, read announcements, message delegates, make group chats and send GIFs.',
    topics: ['chat', 'session-code', 'announcements'],
  },
  {
    id: 'LhT8mic1ffQ',
    title: 'What Happens When a P5 Member Votes Against?',
    kind: 'short',
    publishAt: '2026-10-23T20:00:00+08:00',
    description:
      'Vote one delegation at a time, with rights, record a veto and show the result to the room.',
    topics: ['voting', 'veto', 'security-council'],
  },
  {
    id: 'YhjHfNBSEKM',
    title: 'Introduce a Draft Resolution Without a Second Tab',
    kind: 'short',
    publishAt: '2026-10-24T10:00:00+08:00',
    description:
      'Submit a draft resolution with sponsors and a PDF, set reading, presentation and Q&A times, and run the introduction with the document and timer in one place.',
    topics: ['documents', 'draft-resolution', 'introduction'],
  },
  {
    id: '9hvQhvp5rzA',
    title: 'Consultation of the Whole and Tour de Table, Finally Easy',
    kind: 'short',
    publishAt: '2026-10-24T16:00:00+08:00',
    description: 'Run a Consultation of the Whole and a Tour de Table with the timer and the speaking order handled for you.',
    topics: ['consultation', 'tour-de-table', 'caucus'],
  },
  {
    id: 'Sw4KzPPyYxE',
    title: 'Stop Counting How Many Speakers Fit in a Mod',
    kind: 'short',
    publishAt: '2026-10-24T20:00:00+08:00',
    description:
      'Set the topic and times and Gavelling says how many delegates can speak; run the unmoderated caucus timer and extend it in one click.',
    topics: ['moderated-caucus', 'unmoderated-caucus'],
  },
  {
    id: 'NRMjbXmLqaY',
    title: '15 MUN Motions on the Floor, Ranked for You',
    kind: 'short',
    publishAt: '2026-10-25T10:00:00+08:00',
    description: 'Motions ranked by disruptiveness, edited, dragged into a new order and accepted.',
    topics: ['motions'],
  },
  {
    id: '-_DeJkfr43I',
    title: 'Right of Reply, Yields and Extra Time in MUN, Made Easy',
    kind: 'short',
    publishAt: '2026-10-25T16:00:00+08:00',
    description: 'Grant a right of reply, yield the floor and add extra time to a speaker without stopping the debate.',
    topics: ['right-of-reply', 'yields', 'speakers-list'],
  },
  {
    id: 'uHzB4DfkfrA',
    title: 'Run Your MUN Speakers List in One Tap',
    kind: 'short',
    publishAt: '2026-10-25T21:00:00+08:00',
    description: 'Add delegations to the speakers list, start the clock and move to the next speaker in one tap.',
    topics: ['speakers-list'],
  },
  {
    id: 'vcL53n4CRJM',
    title: 'How to Set Up an MUN Committee in Under a Minute',
    kind: 'short',
    publishAt: '2026-10-26T10:00:00+08:00',
    description:
      'Create the committee, add countries, observers and the co-chair, and get a session code delegates join on their phones.',
    topics: ['setup', 'session-code'],
  },
] as const satisfies readonly TutorialVideoDef[];

export type TutorialVideoId = (typeof VIDEOS)[number]['id'];

export const TUTORIAL_VIDEOS: readonly TutorialVideoDef[] = VIDEOS;

export function tutorialVideo(id: TutorialVideoId): TutorialVideoDef {
  // The id type comes from the list itself, so this always finds one.
  return TUTORIAL_VIDEOS.find((v) => v.id === id) as TutorialVideoDef;
}

/** The moment a video is first shown: `publishAt` plus the safety margin. */
export function videoReleaseMs(video: TutorialVideoDef): number {
  return Date.parse(video.publishAt) + RELEASE_MARGIN_MS;
}

/** Whether a video may be shown at `nowMs` (defaults to now). */
export function isVideoReleased(video: TutorialVideoDef, nowMs: number = Date.now()): boolean {
  return nowMs >= videoReleaseMs(video);
}

/** Where "Watch on YouTube" goes. */
export function youtubeWatchUrl(video: TutorialVideoDef): string {
  return video.kind === 'short'
    ? `https://www.youtube.com/shorts/${video.id}`
    : `https://www.youtube.com/watch?v=${video.id}`;
}

/** The privacy-enhanced embed, loaded only after the reader presses play. */
export function youtubeEmbedUrl(video: TutorialVideoDef, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${video.id}?${autoplay ? 'autoplay=1&' : ''}rel=0`;
}

/** "20:19" → "PT20M19S" for schema.org; undefined when not known. */
export function isoDuration(duration: string | undefined): string | undefined {
  if (!duration) return undefined;
  const parts = duration.split(':').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s}S`;
}

/**
 * schema.org VideoObject blocks for the videos in `ids` that are released at
 * `nowMs`. Plain data for an ld+json script: the thumbnail URL is YouTube's,
 * but it is text in the page for crawlers and nothing in the browser loads it.
 */
export function tutorialVideoSchemas(ids: readonly TutorialVideoId[], nowMs: number = Date.now()) {
  return ids
    .map(tutorialVideo)
    .filter((v) => isVideoReleased(v, nowMs))
    .map((v) => {
      const duration = isoDuration(v.duration);
      return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: v.title,
        description: v.description,
        thumbnailUrl: [`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`],
        uploadDate: v.publishAt,
        ...(duration ? { duration } : {}),
        embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`,
        url: youtubeWatchUrl(v),
        publisher: {
          '@type': 'Organization',
          name: 'Gavelling',
          url: 'https://gavelling.com',
        },
      };
    });
}
