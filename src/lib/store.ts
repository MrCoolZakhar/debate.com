import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Committee,
  Delegate,
  DelegateStatus,
  SessionPhase,
  Motion,
  MotionType,
  PendingMotion,
  PendingMotionType,
  Resolution,
  CommitteeDocument,
  DocumentStatus,
  CaucusState,
  ChatMessage,
  SpeakerEntry,
} from './types';

function calcDisruptiveness(type: PendingMotionType, totalTime: number): number {
  const base: Record<PendingMotionType, number> = {
    'end-debate': 6_000_000, 'suspend-debate': 5_000_000,
    consultation: 4_000_000, tour: 3_000_000, unmoderated: 2_000_000, moderated: 1_000_000,
  };
  return base[type] + totalTime;
}

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
  createCommittee: (name: string, topic: string, chairNames: string[], delegates: string[]) => string;
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

  // Pending motions (floor + voting)
  addPendingMotion: (committeeId: string, motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => void;
  removePendingMotion: (committeeId: string, motionId: string) => void;
  updatePendingMotion: (committeeId: string, motionId: string, updates: Partial<Omit<PendingMotion, 'id'>>) => void;
  enactPendingMotion: (committeeId: string, motionId: string, speakerList?: string[]) => void;
  clearPendingMotions: (committeeId: string) => void;

  // Caucus
  startCaucus: (committeeId: string, caucus: Omit<CaucusState, 'remainingTime' | 'speakerTimeRemaining' | 'currentSpeaker'>) => void;
  tickCaucus: (committeeId: string) => void;
  tickCaucusTotalOnly: (committeeId: string) => void;
  tickCaucusSpeakerOnly: (committeeId: string) => void;
  tickCaucusBoth: (committeeId: string) => void;
  advanceCaucusSpeaker: (committeeId: string) => void;
  setProposerPosition: (committeeId: string, position: 'first' | 'last') => void;
  endCaucus: (committeeId: string) => void;
  nextCaucusSpeaker: (committeeId: string, speakerCountry: string) => void;

  // Resolutions
  addResolution: (committeeId: string, title: string, sponsors: string[], content: string) => void;
  updateResolutionStatus: (committeeId: string, resolutionId: string, status: Resolution['status']) => void;

  // Documents
  addDocument: (committeeId: string, doc: Omit<CommitteeDocument, 'id' | 'submittedAt'>) => void;
  updateDocumentStatus: (committeeId: string, docId: string, status: DocumentStatus) => void;
  updateDocument: (committeeId: string, docId: string, updates: Partial<CommitteeDocument>) => void;
  removeDocument: (committeeId: string, docId: string) => void;

  // Chat
  sendMessage: (committeeId: string, sender: string, content: string, isPrivate?: boolean, recipient?: string) => void;

  // Voting
  startVoting: (committeeId: string) => void;
}

export const useCommitteeStore = create<CommitteeStore>()(
  persist(
    (set, get) => ({
      committees: {},
      activeCommitteeId: null,

      createCommittee: (name, topic, chairNames, delegateNames) => {
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
          chairName: chairNames[0] ?? 'Chair',
          chairNames,
          delegates,
          phase: 'pre-session',
          speakersList: [],
          caucusQueue: [],
          currentSpeaker: null,
          speakerTimeLimit: 90,
          speakerTimeRemaining: 90,
          speakerStartedAt: null,
          motions: [],
          pendingMotions: [],
          resolutions: [],
          documents: [],
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

      addPendingMotion: (committeeId, motionData) => {
        const motion: PendingMotion = {
          ...motionData,
          id: generateId(),
          disruptiveness: calcDisruptiveness(motionData.type, motionData.totalTime),
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              pendingMotions: [...(state.committees[committeeId].pendingMotions ?? []), motion],
            },
          },
        }));
      },

      removePendingMotion: (committeeId, motionId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              pendingMotions: (state.committees[committeeId].pendingMotions ?? []).filter((m) => m.id !== motionId),
            },
          },
        })),

      updatePendingMotion: (committeeId, motionId, updates) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              pendingMotions: (state.committees[committeeId].pendingMotions ?? []).map((m) =>
                m.id === motionId
                  ? { ...m, ...updates, disruptiveness: calcDisruptiveness(m.type, (updates.totalTime ?? m.totalTime)) }
                  : m
              ),
            },
          },
        })),

      enactPendingMotion: (committeeId, motionId, speakerListArg) => {
        const state = get();
        const committee = state.committees[committeeId];
        if (!committee) return;
        const motion = (committee.pendingMotions ?? []).find((m) => m.id === motionId);
        if (!motion) return;

        if (motion.type === 'tour') {
          const present = committee.delegates.filter((d) => d.status !== 'absent');
          const entries: SpeakerEntry[] = present.map((d) => ({ delegateId: d.id, country: d.country }));
          set((s) => ({
            committees: {
              ...s.committees,
              [committeeId]: {
                ...s.committees[committeeId],
                speakersList: entries,
                pendingMotions: [],
              },
            },
          }));
          return;
        }

        if (motion.type === 'moderated') {
          // Start caucus with empty speaker list — proposer position chosen on the caucus page
          const caucus: CaucusState = {
            active: true,
            type: 'moderated',
            totalTime: motion.totalTime,
            remainingTime: motion.totalTime,
            speakingTime: motion.speakingTime,
            speakerTimeRemaining: motion.speakingTime,
            purpose: motion.topic,
            currentSpeaker: null,
            proposedBy: motion.proposedBy,
            proposerPosition: null,
            spokenCountries: [],
          };
          set((s) => ({
            committees: {
              ...s.committees,
              [committeeId]: {
                ...s.committees[committeeId],
                caucus,
                phase: 'moderated-caucus',
                speakersList: [],
                pendingMotions: [],
              },
            },
          }));
          return;
        }

        // unmoderated / consultation
        const caucus: CaucusState = {
          active: true,
          type: 'unmoderated',
          totalTime: motion.totalTime,
          remainingTime: motion.totalTime,
          speakingTime: 0,
          speakerTimeRemaining: 0,
          purpose: motion.type === 'consultation' ? 'Consultation of the Whole' : (motion.topic || ''),
          currentSpeaker: null,
          proposedBy: motion.proposedBy,
          proposerPosition: null,
          spokenCountries: [],
        };
        set((s) => ({
          committees: {
            ...s.committees,
            [committeeId]: {
              ...s.committees[committeeId],
              caucus,
              phase: 'unmoderated-caucus',
              pendingMotions: [],
            },
          },
        }));
      },

      clearPendingMotions: (committeeId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              pendingMotions: [],
            },
          },
        })),

      startCaucus: (committeeId, caucusInput) => {
        const caucus: CaucusState = {
          ...caucusInput,
          remainingTime: caucusInput.totalTime,
          speakerTimeRemaining: caucusInput.speakingTime,
          currentSpeaker: null,
          proposedBy: (caucusInput as CaucusState).proposedBy ?? '',
          proposerPosition: (caucusInput as CaucusState).proposerPosition ?? null,
          spokenCountries: (caucusInput as CaucusState).spokenCountries ?? [],
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

      tickCaucusTotalOnly: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const newTotal = Math.max(0, committee.caucus.remainingTime - 1);
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                phase: newTotal === 0 ? 'speakers-list' : committee.phase,
                caucus: newTotal === 0 ? null : { ...committee.caucus, remainingTime: newTotal },
              },
            },
          };
        }),

      tickCaucusSpeakerOnly: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const newSpeaker = Math.max(0, committee.caucus.speakerTimeRemaining - 1);
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                caucus: { ...committee.caucus, speakerTimeRemaining: newSpeaker },
              },
            },
          };
        }),

      tickCaucusBoth: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const newTotal = Math.max(0, committee.caucus.remainingTime - 1);
          const newSpeaker = Math.max(0, committee.caucus.speakerTimeRemaining - 1);
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                phase: newTotal === 0 ? 'speakers-list' : committee.phase,
                caucus: newTotal === 0 ? null : {
                  ...committee.caucus,
                  remainingTime: newTotal,
                  speakerTimeRemaining: newSpeaker,
                },
              },
            },
          };
        }),

      advanceCaucusSpeaker: (committeeId) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const prev = committee.caucus.currentSpeaker;
          const spokenCountries = prev && !committee.caucus.spokenCountries.includes(prev)
            ? [...committee.caucus.spokenCountries, prev]
            : committee.caucus.spokenCountries;
          const [next, ...rest] = committee.speakersList;
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                speakersList: rest,
                caucus: {
                  ...committee.caucus,
                  currentSpeaker: next?.country ?? null,
                  speakerTimeRemaining: committee.caucus.speakingTime,
                  spokenCountries,
                },
              },
            },
          };
        }),

      setProposerPosition: (committeeId, position) =>
        set((state) => {
          const committee = state.committees[committeeId];
          if (!committee?.caucus) return state;
          const proposer = committee.caucus.proposedBy;
          const delegate = committee.delegates.find((d) => d.country === proposer);
          if (!delegate) return state;
          const entry: SpeakerEntry = { delegateId: delegate.id, country: proposer };
          const without = committee.speakersList.filter((s) => s.delegateId !== delegate.id);
          const newList = position === 'first' ? [entry, ...without] : [...without, entry];
          return {
            committees: {
              ...state.committees,
              [committeeId]: {
                ...committee,
                speakersList: newList,
                caucus: { ...committee.caucus, proposerPosition: position },
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

      addDocument: (committeeId, docData) => {
        const doc: CommitteeDocument = {
          ...docData,
          id: generateId(),
          submittedAt: new Date().toISOString(),
        };
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              documents: [...(state.committees[committeeId].documents ?? []), doc],
            },
          },
        }));
      },

      updateDocumentStatus: (committeeId, docId, status) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              documents: (state.committees[committeeId].documents ?? []).map((d) =>
                d.id === docId ? { ...d, status } : d
              ),
            },
          },
        })),

      updateDocument: (committeeId, docId, updates) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              documents: (state.committees[committeeId].documents ?? []).map((d) =>
                d.id === docId ? { ...d, ...updates } : d
              ),
            },
          },
        })),

      removeDocument: (committeeId, docId) =>
        set((state) => ({
          committees: {
            ...state.committees,
            [committeeId]: {
              ...state.committees[committeeId],
              documents: (state.committees[committeeId].documents ?? []).filter((d) => d.id !== docId),
            },
          },
        })),

      sendMessage: (committeeId, sender, content, isPrivate = false, recipient) => {
        const message: ChatMessage = {
          id: generateId(),
          sender,
          content,
          timestamp: new Date(),
          isPrivate,
          ...(recipient ? { recipient } : {}),
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
