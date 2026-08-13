import type { ScoringConfig } from './settingsStore';

export type DelegateStatus = 'present' | 'absent' | 'present-voting';

export interface Delegate {
  id: string;
  country: string;
  status: DelegateStatus;
  isObserver?: boolean;
}

export type SessionPhase =
  | 'pre-session'
  | 'roll-call'
  | 'speakers-list'
  | 'moderated-caucus'
  | 'unmoderated-caucus'
  | 'voting'
  | 'adjourned';

export interface SpeakerEntry {
  delegateId: string;
  country: string;
}

export type MotionType =
  | 'moderated-caucus'
  | 'unmoderated-caucus'
  | 'close-debate'
  | 'adjourn'
  | 'extend-speakers-time'
  | 'set-speakers-time';

export interface Motion {
  id: string;
  type: MotionType;
  proposedBy: string;
  totalTime?: number;
  speakingTime?: number;
  purpose?: string;
  votes: { for: number; against: number; abstain: number };
  status: 'pending' | 'voting' | 'passed' | 'failed';
}

// ── Pending motions (floor entertainment + voting) ──
// 'custom' is a free-text placeholder for procedural business that happens
// verbally in the room. It carries no timings and ACCEPTING IT IS A NO-OP:
// it never changes phase, caucus, speakersList, caucusQueue or currentSpeaker.
export type PendingMotionType = 'moderated' | 'unmoderated' | 'consultation' | 'tour' | 'suspend-debate' | 'end-debate' | 'custom';

export interface PendingMotion {
  id: string;
  type: PendingMotionType;
  proposedBy: string;       // may be '' for a Custom motion (proposer is optional there)
  totalTime: number;        // seconds
  speakingTime: number;     // seconds per delegate
  topic: string;            // Custom motions reuse this column for their optional free-text name
  speakerList: string[];
  proposerPosition: 'first' | 'last' | null;
  disruptiveness: number;
  tourOrder?: 'asc' | 'desc' | 'custom'; // Tour de Table only: 'asc' = A→Z, 'desc' = Z→A, 'custom' = from proposer
}

export type ResolutionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'passed' | 'failed';

export interface Resolution {
  id: string;
  title: string;
  sponsors: string[];
  signatories: string[];
  status: ResolutionStatus;
  content: string;
  submittedAt: Date;
}

export type DocumentType = 'working-paper' | 'draft-resolution';
export type DocumentStatus = 'submitted' | 'on-floor' | 'introduced' | 'passed' | 'failed';

export interface CommitteeDocument {
  id: string;
  type: DocumentType;
  docCode: string;
  title: string;
  sponsors: string[];
  content: string;
  status: DocumentStatus;
  submittedAt: string;
  fileUrl?: string;
  fileName?: string;
  readingMinutes?: number;       // Chair-set reading time before presentation
  presentationMinutes?: number;
  qaMinutes?: number;
  signatories?: string[];
  approval?: 'approved' | 'rejected'; // chair approval gate (undefined = undecided)
}

export interface CaucusState {
  active: boolean;
  type: 'moderated' | 'unmoderated';
  motionLabel: string;
  totalTime: number;
  remainingTime: number;
  speakingTime: number;
  purpose: string;
  currentSpeaker: string | null;
  speakerTimeRemaining: number;
  proposedBy: string;
  proposerPosition: 'first' | 'last' | null;
  spokenCountries: string[];
  isConsultation?: boolean;  // true when this caucus is a Consultation of the Whole

  // ── Wall-clock ANCHOR for the TOTAL caucus countdown ────────────────────────
  // ISO timestamp of the instant the total clock last (re)started, or null when it is
  // paused. Written ONCE per start / pause / extend / speaker-advance — never per second
  // (a per-second write would re-arm the realtime debounce: RULE 4 / MUST NEVER HAPPEN #4).
  //
  // INVARIANT: `remainingTime` is always the value AT the anchor instant. So the live
  // value on ANY device is
  //     totalStartedAt ? max(0, remainingTime - (now - totalStartedAt)) : remainingTime
  // which is what caucusRemainingNow() in committeeService.ts computes. Every client
  // derives from the same fixed point instead of from each other, so no per-tick sync is
  // needed. This mirrors the proven current_speaker.started_at pattern.
  //
  // BACKWARD COMPATIBLE: absent/null on caucuses started before this field existed and on
  // any paused clock — readers then fall back to `remainingTime` verbatim, i.e. exactly
  // the old behaviour. Never render NaN.
  //
  // NOTE: written with the acting chair's client clock (`new Date().toISOString()`), the
  // same as startSpeakerTimer(). Readers use their own Date.now(), so device clock skew
  // offsets the displayed countdown by that skew. See caucusRemainingNow().
  totalStartedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isPrivate: boolean;
  recipient?: string;
  messageType?: 'general' | 'speech-comment'; // 'speech-comment' = refers to current speech
}

// Speaking log — stored as system messages, used for statistics
export interface SpeakingLogEntry {
  country: string;
  seconds: number; // actual seconds spoken (time_limit - time_remaining at stop)
  context: 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table';
  topic: string;   // caucus purpose or committee topic
  timestamp: string;
}

export interface Committee {
  id: string;
  code: string;
  name: string;
  topic: string;
  chairName: string;
  chairNames: string[];
  delegates: Delegate[];
  phase: SessionPhase;
  speakersList: SpeakerEntry[];     // GSL — permanent, never touched by caucuses
  caucusQueue: SpeakerEntry[];      // Caucus/Tour speakers — separate, wiped when caucus ends
  currentSpeaker: SpeakerEntry | null;
  speakerTimeLimit: number;
  speakerTimeRemaining: number;
  speakerStartedAt: string | null;
  motions: Motion[];
  pendingMotions: PendingMotion[];
  resolutions: Resolution[];
  documents: CommitteeDocument[];
  caucus: CaucusState | null;
  messages: ChatMessage[];
  createdAt: Date;
  suspendedAt?: string | null;
  endedAt?: string | null;
  expiresAt?: string | null;
  resumingChair?: string | null;
  dbChairJoinSuffix?: string | null;
  dbHeadChair?: string | null;   // persisted head-chair name (claim-at-will); null → creator (chairNames[0]) is head
  dbSeparateChairCode?: boolean;
  dbSettings?: Record<string, unknown> | null;
  dbScoring?: ScoringConfig | null;
}