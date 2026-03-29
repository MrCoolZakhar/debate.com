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
  totalTime?: number; // seconds
  speakingTime?: number; // seconds per speaker (moderated caucus)
  purpose?: string;
  votes: { for: number; against: number; abstain: number };
  status: 'pending' | 'voting' | 'passed' | 'failed';
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

export interface CaucusState {
  active: boolean;
  type: 'moderated' | 'unmoderated';
  totalTime: number;
  remainingTime: number;
  speakingTime: number;
  purpose: string;
  currentSpeaker: string | null;
  speakerTimeRemaining: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isPrivate: boolean;
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
  speakerTimeLimit: number; // seconds
  speakerTimeRemaining: number;
  motions: Motion[];
  resolutions: Resolution[];
  caucus: CaucusState | null;
  messages: ChatMessage[];
  createdAt: Date;
}
