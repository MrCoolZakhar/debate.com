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
export type PendingMotionType = 'moderated' | 'unmoderated' | 'consultation' | 'tour';

export interface PendingMotion {
  id: string;
  type: PendingMotionType;
  proposedBy: string;
  totalTime: number;        // seconds
  speakingTime: number;     // seconds (0 for unmod/consultation/tour)
  topic: string;            // required for moderated
  speakerList: string[];    // ordered speaker countries (moderated only)
  proposerPosition: 'first' | 'last' | null;
  disruptiveness: number;   // higher = more disruptive
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
  docCode: string;        // e.g. "WP 1.1" or "DR 1/1"
  title: string;
  sponsors: string[];
  content: string;
  status: DocumentStatus;
  submittedAt: string;    // ISO string (avoid Date serialization issues with Zustand persist)
  fileUrl?: string;
  fileName?: string;
  presentationMinutes?: number;
  qaMinutes?: number;
  signatories?: string[]; // kept optional for backwards-compat, not used in UI
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
  speakersList: SpeakerEntry[];
  currentSpeaker: SpeakerEntry | null;
  speakerTimeLimit: number;
  speakerTimeRemaining: number;
  motions: Motion[];
  pendingMotions: PendingMotion[];
  resolutions: Resolution[];
  documents: CommitteeDocument[];
  caucus: CaucusState | null;
  messages: ChatMessage[];
  createdAt: Date;
}
