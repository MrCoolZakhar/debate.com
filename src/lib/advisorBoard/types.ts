// Shapes the Faculty Advisor board works with (24 Sep 2026). Everything here is read
// anonymously from the live session tables. `committees.settings` is NEVER read: it
// holds the chair code. Only the scoring LEDGER is read out of `messages`
// (recipient '__log__'), never chat, which includes private conversations.

import type { CaucusState } from '../types';

export interface RoomDelegate {
  id: string;
  country: string;
  isObserver: boolean;
  logoUrl: string | null;
  status: 'absent' | 'present' | 'present-voting' | string;
}

export interface RoomQueueRow {
  id: string;
  country: string;
  position: number;
}

export interface RoomCurrentSpeaker {
  country: string | null;
  timeRemaining: number;
  startedAt: string | null;
  timeGranted: number | null;
  seatedAt: string | null;
}

/** One `__log__` ledger event, reduced to what the board shows. */
export interface BoardLogEvent {
  type: 'speech' | 'motion-raised' | 'motion-passed' | 'motion-failed' | 'motion-edited' | 'right-of-reply' | 'other';
  country: string;
  timestamp: string | null;
  seconds?: number;
  context?: string;
  topic?: string;
  motionId?: string;
  motionType?: string;
  totalTime?: number;
  speakingTime?: number;
  outcome?: string;
  prevMotionId?: string;
}

export interface RoomDocument {
  type: 'working-paper' | 'draft-resolution' | string;
  status: string;
  docCode: string | null;
  title: string;
  sponsors: string[];
}

export interface RoomData {
  id: string;
  code: string;
  name: string;
  topic: string;
  phase: string;
  sessionOrigin: 'conference' | 'standalone';
  endedAt: string | null;
  suspendedAt: string | null;
  caucus: CaucusState | null;
  speakerTimeLimit: number;
  updatedAt: string | null;
  current: RoomCurrentSpeaker | null;
  gsl: RoomQueueRow[];
  caucusQueue: RoomQueueRow[];
  delegates: RoomDelegate[];
  events: BoardLogEvent[];
  documents: RoomDocument[];
  /** serverNow() when this room's data was read. */
  fetchedAt: number;
}

/** A delegation the board follows, whatever brought it here. */
export interface FollowedSeat {
  key: string;
  code: string | null;
  country: string;
  countryCode: string | null;
  /** First name: typed on this device, or the student's name from the conference. */
  name: string | null;
  /** From the advisor's conference delegation (verified), not typed by code. */
  verified: boolean;
  conferenceId: string | null;
  conferenceLabel: string | null;
  committeeName: string;
  committeeAbbreviation: string | null;
  /** When this device started following the room (epoch ms). */
  followingSince: number;
}
