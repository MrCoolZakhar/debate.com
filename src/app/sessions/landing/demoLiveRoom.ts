// A STATIC demo room for the Sessions landing page: one committee as the
// organiser's live status wall draws it (the real CommitteeCard from
// manage/[slug]/live, fed this object). Nothing here is read from the
// database and no real conference or person appears: the committee, topic,
// papers and chair names are invented, the countries are UN members.
//
// `now` is passed in once and never ticks, so the card is a still: Kenya has
// held the floor for 28 s of a 90 s speech (the clock reads 1:02).

import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';

const PRESENT = [
  'China', 'France', 'United Kingdom', 'United States', 'Russia', 'Brazil', 'Kenya', 'India',
  'Japan', 'Germany', 'Mexico', 'Egypt', 'Norway', 'Ghana', 'Indonesia',
];

export function demoLiveRoom(now: number): LiveCommittee {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  return {
    conf: {
      id: 'demo-unsc',
      name: 'United Nations Security Council',
      abbreviation: 'UNSC',
      logoUrl: '/logos/un.svg',
      topics: ['Maintaining peace in the Sahel'],
      totalSlots: 15,
      sessionId: 'demo-session',
      sessionCode: 'KYAH8V',
      releasedToChairsAt: iso(3 * 24 * 3600e3),
      delegationSize: 1,
      chairUserIds: [],
      chairs: [
        { id: null, name: 'Sofia Marín', avatarUrl: null },
        { id: null, name: 'Daniel Osei', avatarUrl: null },
      ],
      pendingChairs: [],
    },
    session: {
      id: 'demo-session',
      code: 'KYAH8V',
      name: 'UN Security Council',
      phase: 'speakers-list',
      caucus: null,
      chairNames: ['Sofia Marín', 'Daniel Osei'],
      headChair: 'Sofia Marín',
      suspendedAt: null,
      endedAt: null,
      updatedAt: iso(28e3),
      resumingChair: null,
      quorumThreshold: 'simple',
      scoringFactors: [],
      factorScaleMax: 10,
    },
    currentSpeaker: { country: 'Kenya', timeRemaining: 90, startedAt: iso(28e3) },
    delegates: PRESENT.map((country, i) => ({
      country,
      status: i % 4 === 0 ? 'present-voting' : 'present',
      isObserver: false,
    })),
    gslQueue: ['France', 'Mexico', 'Norway', 'Ghana', 'United Kingdom', 'Indonesia', 'Brazil', 'Egypt'],
    caucusQueue: [],
    documents: [
      { type: 'working-paper', status: 'passed', docCode: 'WP 1.1', title: 'Humanitarian corridors in the Sahel', sponsors: ['France', 'Ghana'], fileUrl: null, fileName: null, content: null, createdAt: iso(3600e3) },
      { type: 'draft-resolution', status: 'submitted', docCode: 'DR 1/1', title: 'Restoring stability and protecting civilians in the Sahel', sponsors: ['Kenya', 'Norway', 'Brazil'], fileUrl: null, fileName: null, content: null, createdAt: iso(1800e3) },
    ],
    speechLogs: [
      { country: 'China', seconds: 84, context: 'speakers-list', topic: 'Maintaining peace in the Sahel', at: iso(240e3) },
      { country: 'Egypt', seconds: 90, context: 'speakers-list', topic: 'Maintaining peace in the Sahel', at: iso(140e3) },
      { country: 'India', seconds: 71, context: 'speakers-list', topic: 'Maintaining peace in the Sahel', at: iso(60e3) },
    ],
    eventLogs: [],
    scores: [
      { country: 'France', total: 34 }, { country: 'Kenya', total: 29 }, { country: 'China', total: 25 },
      { country: 'Norway', total: 21 }, { country: 'Ghana', total: 18 },
    ],
    lastActivityAt: iso(28e3),
    lastMessageAt: iso(90e3),
    hasHistory: true,
    feedback: [],
  };
}
