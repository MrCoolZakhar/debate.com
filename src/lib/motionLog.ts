// ============================================================
// src/lib/motionLog.ts
//
// MOTIONS ON THE LEDGER (18 Sep 2026, owner: "distinguish a motion raised from a
// motion that passed", "every motion raised gets a line in the History").
//
// The `motions` table is hard-deleted on accept AND on reject, so the only record a
// motion ever existed is what is written onto the `__log__` channel (logEvent). Four
// event types, all on that one channel:
//
//   • motion-raised  — the insert of a new motion landed (real UUID known). Scored by
//                      `motionRaised`. BEFORE 18 Sep 2026 this type was written only when
//                      a caucus motion was ACCEPTED, with no motion fields: those legacy
//                      rows (no `motionId`) are read as "a caucus motion that passed".
//   • motion-passed  — the chair accepted it: a caucus, a Custom motion, Suspend or End
//                      Debate "Yes". Scored by `motionPassed`. A caucus pass also opens a
//                      new History segment (sessionHistory.ts), which is what makes an
//                      unmoderated caucus with no speeches show as its own section.
//   • motion-failed  — rejected (✗), Suspend / End "No", or fell because another motion
//                      passed. `outcome` says which. Scores nothing.
//   • motion-edited  — an edit or an Undo re-raised the motion under a new id.
//                      `prevMotionId` links it to the original line, so an edit neither
//                      scores a second raise nor loses the line. Scores nothing.
//
// Every event carries the motion itself (type, total, speaking time, topic, tour order)
// so a line can be drawn from any one of them: a motion raised before this shipped and
// passed after it still gets a full line from its pass.
//
// Written only by the device that acts (the Moderator raising / accepting / rejecting in
// MotionsModal). Fire-and-forget like every other ledger write (RULE 5); nothing here
// touches committee state, `updateLocal` or `localUpdateTime`.
// ============================================================

import type { Committee, PendingMotion, PendingMotionType } from './types';
import { logEvent } from './committeeService';
import { motionNames } from './committeeFlags';
import type { MotionNames } from './settingsStore';

export type MotionOutcome = 'passed' | 'rejected' | 'failed' | 'fell';

/** What a motion event carries about the motion. */
export interface MotionFields {
  motionId?: string;
  motionType?: PendingMotionType;
  topic?: string;
  totalTime?: number;
  speakingTime?: number;
  tourOrder?: 'asc' | 'desc' | 'custom';
}

type LogTarget = Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix'>;
type MotionLike = Pick<PendingMotion, 'type' | 'proposedBy' | 'totalTime' | 'speakingTime' | 'topic'> & { tourOrder?: PendingMotion['tourOrder'] };

export function motionFields(id: string, m: MotionLike): MotionFields {
  return {
    motionId: id,
    motionType: m.type,
    topic: (m.topic ?? '').trim() || undefined,
    totalTime: Number.isFinite(m.totalTime) ? m.totalTime : undefined,
    speakingTime: Number.isFinite(m.speakingTime) ? m.speakingTime : undefined,
    tourOrder: m.tourOrder,
  };
}

const target = (c: LogTarget) => [c.code, c.dbChairJoinSuffix ?? undefined] as const;
// A Custom motion may have no proposer at all; the log still needs a country field.
const who = (m: MotionLike) => m.proposedBy || '__chair__';

export function logMotionRaised(committee: LogTarget, id: string, m: MotionLike): void {
  void logEvent(committee.id, { country: who(m), type: 'motion-raised', sourceId: 'motionRaised', ...motionFields(id, m) }, ...target(committee));
}

export function logMotionPassed(committee: LogTarget, m: PendingMotion): void {
  void logEvent(committee.id, { country: who(m), type: 'motion-passed', sourceId: 'motionPassed', ...motionFields(m.id, m) }, ...target(committee));
}

export function logMotionFailed(committee: LogTarget, m: PendingMotion, outcome: Exclude<MotionOutcome, 'passed'>): void {
  void logEvent(committee.id, { country: who(m), type: 'motion-failed', outcome, ...motionFields(m.id, m) }, ...target(committee));
}

export function logMotionEdited(committee: LogTarget, prevId: string, newId: string, m: MotionLike): void {
  void logEvent(committee.id, { country: who(m), type: 'motion-edited', prevMotionId: prevId, ...motionFields(newId, m) }, ...target(committee));
}

// ── Reading them back ─────────────────────────────────────────────────────────

const NAME_KEY: Record<PendingMotionType, keyof MotionNames> = {
  moderated: 'moderated',
  unmoderated: 'unmoderated',
  consultation: 'consultation',
  tour: 'tour',
  custom: 'custom',
  'suspend-debate': 'suspendDebate',
  'end-debate': 'endDebate',
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/**
 * "Moderated Caucus 10:00 / 1:00 · Climate finance", in the committee's own motion names
 * (renamed or localized, `motionNames`). A Custom motion is its name alone; Suspend and End
 * carry no times; a Tour de Table shows its per-speaker time. Null for a legacy event that
 * carries no motion type.
 */
export function describeMotion(
  committee: Pick<Committee, 'dbSettings'> | null | undefined,
  f: MotionFields,
  language: string,
): string | null {
  if (!f.motionType || !NAME_KEY[f.motionType]) return null;
  const names = motionNames(committee, language);
  const name = names[NAME_KEY[f.motionType]];
  const topic = (f.topic ?? '').trim();
  if (f.motionType === 'custom') return topic ? `${name}: ${topic}` : name;
  if (f.motionType === 'suspend-debate' || f.motionType === 'end-debate') return name;
  let times = '';
  if (f.motionType === 'moderated' && f.totalTime && f.speakingTime) times = `${clock(f.totalTime)} / ${clock(f.speakingTime)}`;
  else if ((f.motionType === 'unmoderated' || f.motionType === 'consultation') && f.totalTime) times = clock(f.totalTime);
  else if (f.motionType === 'tour' && f.speakingTime) times = clock(f.speakingTime);
  return [`${name}${times ? ` ${times}` : ''}`, topic].filter(Boolean).join(' · ');
}
