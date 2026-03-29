import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Committee,
  Delegate,
  DelegateStatus,
  SessionPhase,
  Motion,
  MotionType,
  Resolution,
  CaucusState,
  ChatMessage,
  SpeakerEntry,
} from './types';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface CommitteeStore {
  committees: Record<string, Committee>;
  activeCommitteeId: string | null;

  // Committee lifecycle
  createCommittee: (name: string, topic: string, chairName: string, delegates: string[]) => string;
  joinCommittee: (code: string) => Committee | null;
  setActiveCommittee: (id: string) => void;

  // Roll call
  setDelegateStatus: (committeeId: string, delegateId: string, status: DelegateStatus) => void;
  completeRollCall: (committeeId: string) => void;
  addDelegate: (committeeId: string, country: string) => void;

  // Phase management
  setPhase: (committeeId: string, phase: SessionPhase) => void;

  // Speakers list
  addToSpeakersList: (committeeId: string, delegateId: string) => void;
  removeFromSpeakersList: (committeeId: string, delegateId: string) => void;
  nextSpeaker: (committeeId: string) => void;
  setSpeakerTimeLimit: (committeeId: string, seconds: number) => void;
  tickSpeakerTimer: (committeeId: string) => void;

  // Motions
  proposeMotion: (
    committeeId: string,
    type: MotionType,
    proposedBy: string,
    opts?: { totalTime?: number; speakingTime?: number; purpose?: string }
  ) => void;
  voteOnMotion: (committeeId: string, motionId: string, forCount: number, againstCount: number, abstainCount: number) => void;
  dismissMotion: (committeeId: string, motionId: string) => void;

  // Caucus
  startCaucus: (committeeId: string, caucus: Omit<CaucusState, 'remainingTime' | 'speakerTimeRemaining' | 'currentSpeaker'>) => void;
  tickCaucus: (committeeId: string) => void;
  endCaucus: (committeeId: string) => void;
  nextCaucusSpeaker: (committeeId: string, speakerCountry: string) => void;

  // Resolutions
  addResolution: (committeeId: string, title: string, sponsors: string[], content: string) => void;
  updateResolutionStatus: (committeeId: string, resolutionId: string, status: Resolution['status']) => void;

  // Chat
  sendMessage: (committeeId: string, sender: string, content: string, isPrivate?: boolean) => void;

  // Voting
  startVoting: (committeeId: string) => void;
}

export const useCommitteeStore = create<CommitteeStore>()(
  persist(
    (set, get) => ({
      committees: {},
      activeCommitteeId: null,

      createCommittee: (name, topic, chairName, delegateNames) => {
        const id = generateId();
        const code = generateCode();
        const delegates: Delegate[] = delegateNames.map((country) => ({
          id: generateId(),
          country,
          status: 'absent',
        }));

        const committee: Committee = {
          id,
          code,
          name,
          topic,
          chairName,
          delegates,
          phase: 'pre-session',
          speakersList: [],
          currentSpeaker: null,
          speakerTimeLimit: 90,
          speakerTimeRemaining: 90,
          motions: [],
          resolutions: [],
          caucus: null,
          messages: [],
          createdAt: new Date(),
        };

        set((state) => ({
          committees: { ...state.committees, [id]: committee },
          activeCommitteeId: id,
        }));

        return code;
      },

      joinCommittee: (code) => {
        const committees = get().committees;
        const committee = Object.values(committees).find((c) => c.code === code.toUpperCase());
        if (committee) {
          set({ activeCommitteeId: committee.id });
          return committee;
        }
        return null;
      },

      setActiveCommittee: (id) => set({ activeCommitteeId: id }),

      setDelegateStatus: (committeeId, delegateId, status) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              delegates: state.committees[committeeId].delegates.map((d) =>
                d.id === delegateId ? { ...d, status } : d
              ),
            },
          },
        })),

      completeRollCall: (committeeId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              phase: 'speakers-list',
            },
          },
        })),

      addDelegate: (committeeId, country) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee) return state;
          if (committee.delegates.some((d) => d.country === country)) return state;
          const newDelegate: Delegate = { id: Math.random().toString(36).substring(2, 11), country, status: 'absent' };
          return {
            committees: {
              ...state.committees,
              [committeeId]: { ...committee, delegates: [...committee.delegates, newDelegate] },
            },
          };
        }),

      setPhase: (committeeId, phase) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              phase,
            },
          },
        })),

      addToSpeakersList: (committeeId, delegateId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee) return state;
          const delegate = committee.delegates.find((d) => d.id === delegateId);
          if (!delegate) return state;
          const alreadyOnList = committee.speakersList.some((s) => s.delegateId === delegateId);
          if (alreadyOnList) return state;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                speakersList: [...committee.speakersList, { delegateId, country: delegate.country }],
              },
            },
          };
        }),

      removeFromSpeakersList: (committeeId, delegateId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee) return state;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                speakersList: committee.speakersList.filter((s) => s.delegateId !== delegateId),
              },
            },
          };
        }),

      nextSpeaker: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee) return state;
          const [next, ...rest] = committee.speakersList;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                currentSpeaker: next ?? null,
                speakersList: rest,
                speakerTimeRemaining: committee.speakerTimeLimit,
              },
            },
          };
        }),

      setSpeakerTimeLimit: (committeeId, seconds) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              speakerTimeLimit: seconds,
              speakerTimeRemaining: seconds,
            },
          },
        })),

      tickSpeakerTimer: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee || !committee.currentSpeaker) return state;
          const newTime = Math.max(0, committee.speakerTimeRemaining - 1);
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                speakerTimeRemaining: newTime,
              },
            },
          };
        }),

      proposeMotion: (committeeId, type, proposedBy, opts = {}) => {
        const motion: Motion = {
          id: generateId(),
          type,
          proposedBy,
          totalTime: opts.totalTime,
          speakingTime: opts.speakingTime,
          purpose: opts.purpose,
          votes: { for: 0, against: 0, abstain: 0 },
          status: 'pending',
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              motions: [...state.committees[committeeId].motions, motion],
            },
          },
        }));
      },

      voteOnMotion: (committeeId, motionId, forCount, againstCount, abstainCount) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee) return state;
          const presentCount = committee.delegates.filter((d) => d.status !== 'absent').length;
          const majority = Math.floor(presentCount / 2) + 1;
          const passed = forCount >= majority;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                motions: committee.motions.map((m) =>
                  m.id === motionId
                    ? { ...m, votes: { for: forCount, against: againstCount, abstain: abstainCount }, status: passed ? 'passed' : 'failed' }
                    : m
                ),
              },
            },
          };
        }),

      dismissMotion: (committeeId, motionId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              motions: state.committees[committeeId].motions.filter((m) => m.id !== motionId),
            },
          },
        })),

      startCaucus: (committeeId, caucusInput) => {
        const caucus: CaucusState = {
          ...caucusInput,
          remainingTime: caucusInput.totalTime,
          speakerTimeRemaining: caucusInput.speakingTime,
          currentSpeaker: null,
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              caucus,
              phase: caucusInput.type === 'moderated' ? 'moderated-caucus' : 'unmoderated-caucus',
            },
          },
        }));
      },

      tickCaucus: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const caucus = committee.caucus;
          const newTotal = Math.max(0, caucus.remainingTime - 1);
          const newSpeaker = caucus.currentSpeaker ? Math.max(0, caucus.speakerTimeRemaining - 1) : caucus.speakerTimeRemaining;
          const updatedCaucus = newTotal === 0 ? null : { ...caucus, remainingTime: newTotal, speakerTimeRemaining: newSpeaker };
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                phase: newTotal === 0 ? 'speakers-list' : committee.phase,
                caucus: updatedCaucus,
              },
            },
          };
        }),

      endCaucus: (committeeId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              caucus: null,
              phase: 'speakers-list',
            },
          },
        })),

      nextCaucusSpeaker: (committeeId, speakerCountry) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                caucus: {
                  ...committee.caucus,
                  currentSpeaker: speakerCountry,
                  speakerTimeRemaining: committee.caucus.speakingTime,
                },
              },
            },
          };
        }),

      addResolution: (committeeId, title, sponsors, content) => {
        const resolution: Resolution = {
          id: generateId(),
          title,
          sponsors,
          signatories: [],
          status: 'draft',
          content,
          submittedAt: new Date(),
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              resolutions: [...state.committees[committeeId].resolutions, resolution],
            },
          },
        }));
      },

      updateResolutionStatus: (committeeId, resolutionId, status) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              resolutions: state.committees[committeeId].resolutions.map((r) =>
                r.id === resolutionId ? { ...r, status } : r
              ),
            },
          },
        })),

      sendMessage: (committeeId, sender, content, isPrivate = false) => {
        const message: ChatMessage = {
          id: generateId(),
          sender,
          content,
          timestamp: new Date(),
          isPrivate,
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              messages: [...state.committees[committeeId].messages, message],
            },
          },
        }));
      },

      startVoting: (committeeId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              phase: 'voting',
            },
          },
        })),
    }),
    { name: 'mun-committees' }
  )
);
