// STATIC demo rooms for the Sessions landing page: committees as the
// organiser's live status wall draws them (the real CommitteeCard from
// manage/[slug]/live, fed these objects). Nothing here is read from the
// database and no real conference or person appears: committees, topics,
// papers and chair names are invented, the countries are UN members.
//
// `now` is passed in once and never ticks, so every card is a still.

import type { LiveCommittee, CaucusJson } from '@/app/manage/[slug]/live/LiveModals';

type Room = {
  id: string;
  name: string;
  abbreviation: string;
  topic: string;
  logoUrl: string;
  chairs: [string, string];
  countries: string[];
  phase: 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus';
  speaker?: { country: string; spokeSec: number; slot: number };
  caucus?: CaucusJson;
  queue: string[];
  scores: [string, number][];
};

function build(now: number, r: Room): LiveCommittee {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  return {
    conf: {
      id: `demo-${r.id}`,
      name: r.name,
      abbreviation: r.abbreviation,
      logoUrl: r.logoUrl,
      topics: [r.topic],
      totalSlots: r.countries.length,
      sessionId: `demo-${r.id}`,
      sessionCode: r.id.toUpperCase(),
      releasedToChairsAt: iso(3 * 24 * 3600e3),
      delegationSize: 1,
      chairUserIds: [],
      chairs: r.chairs.map((name) => ({ id: null, name, avatarUrl: null })),
      pendingChairs: [],
    },
    session: {
      id: `demo-${r.id}`,
      code: r.id.toUpperCase(),
      name: r.name,
      phase: r.phase,
      caucus: r.caucus ?? null,
      chairNames: [...r.chairs],
      headChair: r.chairs[0],
      suspendedAt: null,
      endedAt: null,
      updatedAt: iso(20e3),
      resumingChair: null,
      quorumThreshold: 'simple',
      scoringFactors: [],
      factorScaleMax: 10,
    },
    currentSpeaker: r.speaker
      ? { country: r.speaker.country, timeRemaining: r.speaker.slot, startedAt: iso(r.speaker.spokeSec * 1000) }
      : null,
    delegates: r.countries.map((country, i) => ({
      country,
      status: i % 4 === 0 ? 'present-voting' : 'present',
      isObserver: false,
    })),
    gslQueue: r.phase === 'speakers-list' ? r.queue : [],
    caucusQueue: r.phase === 'moderated-caucus' ? r.queue : [],
    documents: [
      { type: 'working-paper', status: 'passed', docCode: 'WP 1.1', title: 'Working paper', sponsors: r.countries.slice(0, 2), fileUrl: null, fileName: null, content: null, createdAt: iso(3600e3) },
    ],
    speechLogs: r.countries.slice(0, 3).map((country, i) => ({
      country, seconds: 60 + i * 9, context: 'speakers-list', topic: r.topic, at: iso((i + 1) * 90e3),
    })),
    eventLogs: [],
    scores: r.scores.map(([country, total]) => ({ country, total })),
    lastActivityAt: iso(20e3),
    lastMessageAt: iso(60e3),
    hasHistory: true,
    feedback: [],
  };
}

/** Three rooms of one invented conference, as the live wall shows them. */
export function demoLiveRooms(now: number): LiveCommittee[] {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  return [
    build(now, {
      id: 'unsc', name: 'United Nations Security Council', abbreviation: 'UNSC', topic: 'Maintaining peace in the Sahel',
      logoUrl: '/logos/un.svg', chairs: ['Sofia Marín', 'Daniel Osei'],
      countries: ['China', 'France', 'United Kingdom', 'United States', 'Russia', 'Brazil', 'Kenya', 'India', 'Japan', 'Germany', 'Mexico', 'Egypt', 'Norway', 'Ghana', 'Indonesia'],
      phase: 'speakers-list', speaker: { country: 'Kenya', spokeSec: 28, slot: 90 },
      queue: ['France', 'Mexico', 'Norway', 'Ghana', 'United Kingdom', 'Indonesia', 'Brazil', 'Egypt'],
      scores: [['France', 34], ['Kenya', 29], ['China', 25]],
    }),
    build(now, {
      id: 'who', name: 'World Health Organization', abbreviation: 'WHO', topic: 'Vaccine access in low-income countries',
      logoUrl: '/logos/un.svg', chairs: ['Amira Haddad', 'Lucas Weber'],
      countries: ['Argentina', 'Australia', 'Canada', 'Chile', 'Colombia', 'Ethiopia', 'Italy', 'Morocco', 'Nigeria', 'Pakistan', 'Peru', 'Philippines', 'South Africa', 'Spain', 'Thailand', 'Turkey', 'Viet Nam', 'Zambia'],
      phase: 'moderated-caucus', speaker: { country: 'Nigeria', spokeSec: 21, slot: 60 },
      caucus: {
        type: 'moderated', motionLabel: 'Moderated Caucus', purpose: 'Funding local vaccine production',
        totalTime: 600, remainingTime: 412, speakingTime: 60, currentSpeaker: 'Nigeria', totalStartedAt: iso(21e3),
        spokenCountries: ['Canada', 'Peru', 'Italy'],
      },
      queue: ['Philippines', 'Chile', 'Morocco', 'Spain', 'Zambia'],
      scores: [['Nigeria', 31], ['Canada', 27], ['Peru', 22]],
    }),
    build(now, {
      id: 'disec', name: 'Disarmament and International Security Committee', abbreviation: 'DISEC', topic: 'Autonomous weapons systems',
      logoUrl: '/logos/un.svg', chairs: ['Hana Sato', 'Omar Farouk'],
      countries: ['Austria', 'Belgium', 'Bangladesh', 'Cuba', 'Denmark', 'Finland', 'Greece', 'Ireland', 'Israel', 'Jordan', 'Kazakhstan', 'Malaysia', 'Netherlands', 'New Zealand', 'Poland', 'Qatar', 'Senegal', 'Sweden', 'Switzerland', 'Uruguay'],
      phase: 'unmoderated-caucus',
      caucus: {
        type: 'unmoderated', motionLabel: 'Unmoderated Caucus', purpose: 'Drafting a working paper',
        totalTime: 900, remainingTime: 540, totalStartedAt: iso(95e3), spokenCountries: [],
      },
      queue: [],
      scores: [['Ireland', 28], ['Sweden', 24], ['Qatar', 19]],
    }),
  ];
}
