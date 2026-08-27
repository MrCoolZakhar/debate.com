'use client';

// TEMPORARY VERIFICATION HARNESS — DELETE BEFORE COMMITTING.
// Renders the SHIPPED CommitteeCard against synthetic rows covering every state.

import { CommitteeCard } from '@/app/manage/[slug]/live/CommitteeCard';
import { committeeIdentities } from '@/app/manage/[slug]/live/identity';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { useNowTick } from '@/app/manage/[slug]/live/PhaseVariants';
import { NEU, OUTFIT } from '@/components/neu';

const ISO = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function base(name: string, over: Partial<LiveCommittee> = {}): LiveCommittee {
  return {
    conf: {
      id: name, name, abbreviation: null, logoUrl: null, topics: null, totalSlots: 20,
      sessionId: 's', sessionCode: 'ABC123', chairUserIds: [],
      chairs: [{ id: '1', name: 'Alice Moreau', avatarUrl: null }, { id: '2', name: 'ben okafor', avatarUrl: null }],
    },
    session: {
      id: 's', code: 'ABC123', name, phase: 'speakers-list', caucus: null,
      chairNames: ['Alice'], suspendedAt: null, endedAt: null,
      updatedAt: ISO(30_000), resumingChair: null, quorumThreshold: 'none',
      scoringFactors: [], factorScaleMax: 100,
    },
    currentSpeaker: null,
    delegates: Array.from({ length: 20 }, (_, i) => ({
      country: ['France', 'Germany', 'Brazil', 'Japan', 'Kenya', 'Chile', 'India', 'Norway', 'Egypt', 'Peru',
        'Spain', 'Canada', 'Ghana', 'Nepal', 'Qatar', 'Serbia', 'Tunisia', 'Uruguay', 'Vietnam', 'Zambia'][i],
      status: i < 16 ? 'present-voting' : i < 18 ? 'present' : 'absent',
      isObserver: false,
    })),
    gslQueue: [], caucusQueue: [], pendingMotions: [],
    documents: [
      { type: 'working-paper', status: 'submitted', docCode: 'WP 1.1', title: 'Financing', sponsors: ['France'], fileUrl: null, fileName: null, content: null, createdAt: ISO(9e6) },
      { type: 'working-paper', status: 'passed', docCode: 'WP 1.2', title: 'Adaptation', sponsors: ['Kenya'], fileUrl: null, fileName: null, content: null, createdAt: ISO(8e6) },
      { type: 'draft-resolution', status: 'passed', docCode: 'DR 1.1', title: 'Loss and damage', sponsors: ['Brazil'], fileUrl: null, fileName: null, content: null, createdAt: ISO(7e6) },
    ],
    speechLogs: [], eventLogs: [],
    lastActivityAt: ISO(30_000), lastMessageAt: ISO(30_000), hasHistory: true, feedback: [],
    ...over,
  };
}

const merge = (name: string, o: Partial<LiveCommittee>, s: Partial<NonNullable<LiveCommittee['session']>> = {}) => {
  const b = base(name, o);
  return { ...b, session: { ...b.session!, ...s } };
};

const ROWS: LiveCommittee[] = [
  // 1 · live GSL with a speaker mid-speech
  merge('Disarmament and International Security Committee (DISEC)', {
    currentSpeaker: { country: 'France', timeRemaining: 120, startedAt: ISO(72_000) },
    gslQueue: ['Germany', 'Brazil', 'Japan'],
  }),
  // 2 · moderated caucus with a speaker
  merge('United Nations Security Council (UNSC)', {
    currentSpeaker: { country: 'Kenya', timeRemaining: 60, startedAt: ISO(22_000) },
    caucusQueue: ['Chile', 'India'],
  }, {
    phase: 'moderated-caucus',
    caucus: { active: true, type: 'moderated', purpose: 'Climate finance for small island states', totalTime: 600, remainingTime: 380, speakingTime: 60, currentSpeaker: 'Kenya', totalStartedAt: ISO(60_000), spokenCountries: ['Norway', 'Egypt', 'Peru'] },
  }),
  // 3 · Consultation of the Whole
  merge('Economic and Social Council (ECOSOC)', {}, {
    phase: 'unmoderated-caucus',
    caucus: { active: true, type: 'unmoderated', isConsultation: true, purpose: '', totalTime: 900, remainingTime: 540, speakingTime: 0, currentSpeaker: null, totalStartedAt: ISO(120_000), spokenCountries: [] },
  }),
  // 4 · Tour de Table
  merge('World Health Assembly (WHA)', { caucusQueue: ['Spain', 'Canada', 'Ghana'] }, {
    phase: 'moderated-caucus',
    caucus: { active: true, type: 'moderated', purpose: 'Tour de Table (Alphabetical)', totalTime: 600, remainingTime: 300, speakingTime: 30, currentSpeaker: 'Nepal', totalStartedAt: ISO(300_000), spokenCountries: ['Brazil', 'Chile', 'Egypt', 'France', 'Germany', 'India', 'Japan', 'Kenya', 'Nepal', 'Norway'] },
  }),
  // 5 · voting
  merge('Human Rights Council (HRC)', {
    documents: [
      { type: 'draft-resolution', status: 'introduced', docCode: 'DR 1.2', title: 'On the protection of journalists', sponsors: ['Norway', 'Chile'], fileUrl: null, fileName: null, content: null, createdAt: ISO(6e6) },
      { type: 'working-paper', status: 'passed', docCode: 'WP 1.1', title: 'Framework', sponsors: ['Peru'], fileUrl: null, fileName: null, content: null, createdAt: ISO(7e6) },
    ],
  }, { phase: 'voting' }),
  // 6 · a motion being decided
  merge('Special Political and Decolonization Committee (SPECPOL)', {
    currentSpeaker: { country: 'Japan', timeRemaining: 90, startedAt: ISO(30_000) },
    gslQueue: ['Egypt', 'Peru'],
    pendingMotions: [{ type: 'moderated', topic: 'Sovereignty of the seabed', proposedBy: 'Germany', totalTime: 600, createdAt: ISO(41_000) }],
  }),
  // 7 · a motion to suspend debate
  merge('Legal Committee (LEGAL)', {
    gslQueue: ['Spain'],
    pendingMotions: [{ type: 'suspend-debate', topic: '', proposedBy: 'Qatar', totalTime: 0, createdAt: ISO(8_000) }],
  }),
  // 8 · roll call
  merge('Commission on the Status of Women', {
    delegates: base('x').delegates.map((d, i) => ({ ...d, status: i < 7 ? 'present-voting' : 'absent' })),
  }, { phase: 'pre-session' }),
  // 9 · not started
  merge('International Atomic Energy Agency (IAEA)', { hasHistory: false, documents: [], delegates: [] },
    { phase: 'pre-session', chairNames: [] }),
  // 10 · idle floor, queue empty
  merge('United Nations Environment Programme', { gslQueue: [] },
    { updatedAt: ISO(11 * 60_000) }),
  // 11 · stalled
  merge('AD HOC: Council of the Gods', { gslQueue: ['Serbia', 'Tunisia'], lastActivityAt: ISO(70 * 60_000), lastMessageAt: ISO(70 * 60_000) },
    { updatedAt: ISO(70 * 60_000) }),
  // 12 · suspended, resume claimed and stuck
  merge('General Assembly Plenary (GAPLEN)', {}, {
    phase: 'adjourned', suspendedAt: ISO(22 * 60_000), resumingChair: 'Alice Moreau', updatedAt: ISO(9 * 60_000),
  }),
  // 13 · ended
  merge('Historical Crisis Committee 1956', {}, { phase: 'adjourned', endedAt: ISO(3 * 3600_000) }),
  // 14 · below quorum, live speaker, timer paused
  merge('North Atlantic Council (NAC)', {
    currentSpeaker: { country: 'Uruguay', timeRemaining: 45, startedAt: null },
    gslQueue: ['Vietnam'],
    delegates: base('x').delegates.map((d, i) => ({ ...d, status: i < 4 ? 'present' : 'absent' })),
  }, { quorumThreshold: '1-2' }),
  // 15 · unmoderated caucus with a purpose, clock expired
  merge('Organisation of American States (OAS)', {}, {
    phase: 'unmoderated-caucus',
    caucus: { active: true, type: 'unmoderated', purpose: 'Bloc negotiations on the operative clauses', totalTime: 300, remainingTime: 0, speakingTime: 0, currentSpeaker: null, totalStartedAt: ISO(400_000), spokenCountries: [] },
  }),
  // 16 · no chair, GSL next speaker only
  merge('UNICEF', { gslQueue: ['Zambia', 'Nepal'], conf: { ...base('UNICEF').conf, id: 'UNICEF', name: 'UNICEF', chairs: [] } },
    { chairNames: [] }),
];

export default function LiveLab() {
  const now = useNowTick(true);
  const identities = committeeIdentities(ROWS);
  const noop = () => {};
  return (
    <div style={{ backgroundColor: NEU.base, minHeight: '100vh', padding: 24, fontFamily: OUTFIT }}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch" id="lab-grid">
        {ROWS.map((r) => (
          <CommitteeCard
            key={r.conf.id}
            data={r}
            identity={identities.get(r.conf.id)!}
            now={now}
            onOpen={noop}
            onOpenRoster={noop}
            onOpenScoreboard={noop}
            onOpenDocuments={noop}
          />
        ))}
      </div>
    </div>
  );
}
