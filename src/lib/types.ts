export type DelegateStatus = 'present' | 'absent' | 'present-voting';

export interface Delegate {
  id: string;
  country: string;
  status: DelegateStatus;
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
export type PendingMotionType = 'moderated' | 'unmoderated' | 'consultation' | 'tour' | 'suspend-debate' | 'end-debate';

export interface PendingMotion {
  id: string;
  type: PendingMotionType;
  proposedBy: string;
  totalTime: number;        // seconds
  speakingTime: number;     // seconds per delegate
  topic: string;
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
}

export interface CaucusState {
  active: boolean;
  type: 'moderated' | 'unmoderated';
  totalTime: number;
  remainingTime: number;
  speakingTime: number;
  purpose: string;
  currentSpeaker: string | null;
  speakerTimeRemaining: number;
  proposedBy: string;
  proposerPosition: 'first' | 'last' | null;
  spokenCountries: string[];
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
  dbSeparateChairCode?: boolean;
}