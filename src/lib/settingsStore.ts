import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MotionNames {
  moderated: string;
  unmoderated: string;
  consultation: string;
  tour: string;
  suspendDebate: string;
  endDebate: string;
}

export interface ScoreSource { id: string; name: string; value: number; enabled: boolean; builtin: boolean; }
export interface RankingFactor { id: string; name: string; enabled: boolean; }
export interface ScoringConfig {
  sources: ScoreSource[];            // built-ins below + chair-added custom ones
  factors: RankingFactor[];
  factorScaleMax: number;            // default 10
  scoreBlend: number;                // 0 = pure objective … 100 = pure quality (default 0)
  hideScoresFromDelegates: boolean;  // default false
}
export const DEFAULT_SCORING: ScoringConfig = {
  sources: [
    { id: 'attendance',         name: 'Attendance (P/PV)',  value: 5,  enabled: true, builtin: true },
    { id: 'gslSpeech',          name: 'GSL speech',         value: 10, enabled: true, builtin: true },
    { id: 'caucusSpeech',       name: 'Caucus speech',      value: 8,  enabled: true, builtin: true },
    { id: 'speakingTimePer10s', name: 'Speaking time /10s', value: 1,  enabled: true, builtin: true },
    { id: 'motionRaised',       name: 'Motion raised',      value: 10, enabled: true, builtin: true },
    { id: 'rightOfReply',       name: 'Right of reply',     value: 5,  enabled: true, builtin: true },
    { id: 'wpSponsor',          name: 'Working paper',      value: 10, enabled: true, builtin: true },
    { id: 'drSponsor',          name: 'Draft resolution',   value: 20, enabled: true, builtin: true },
    { id: 'drPassed',           name: 'DR passed',          value: 10, enabled: true, builtin: true },
  ],
  factors: [
    { id: 'diplomacy', name: 'Diplomacy', enabled: true },
    { id: 'speaking', name: 'Public Speaking', enabled: true },
    { id: 'collaboration', name: 'Collaboration', enabled: true },
    { id: 'content', name: 'Content & Research', enabled: true },
  ],
  factorScaleMax: 10, scoreBlend: 0, hideScoresFromDelegates: false,
};

export interface CommitteeSettings {
  // Tab 1 — Voting & Majorities
  proceduralThreshold: 'simple' | 'absolute';
  substantiveThreshold: 'simple' | 'supermajority-2-3' | 'consensus';
  amendmentThreshold: 'simple' | 'supermajority-2-3';
  allowAbstentions: boolean;
  vetoMode: 'none' | 'p5' | 'unanimous';
  p5Delegations: string[];
  vetoCountries: string[];
  quorumThreshold: 'none' | '1-4' | '1-3' | '1-2';
  // Tab 2 — Motions
  motionModeratedCaucus: boolean;
  motionUnmoderatedCaucus: boolean;
  motionCoW: boolean;
  cowTimerEnabled: boolean;     // optional standalone timer during Consultation of the Whole
  cowTimerSeconds: number;      // default duration for the CoW timer
  motionTourDeTable: boolean;
  motionNames: MotionNames;
  motionOrder: ('moderated' | 'unmoderated' | 'consultation' | 'tour')[];
  wpSubmissionLimit: number | null;  // null = unlimited
  drSubmissionLimit: number | null;
  // GSL behaviour
  gslRequireNextSpeaker: boolean;
  // Scoring & ranking
  scoring: ScoringConfig;
  // Tab 3 — Access & Identity
  chairJoinSuffix: string;
  requireChairApproval: boolean;
}

export const DEFAULT_MOTION_NAMES: MotionNames = {
  moderated: 'Moderated Caucus',
  unmoderated: 'Unmoderated Caucus',
  consultation: 'Consultation of the Whole',
  tour: 'Tour de Table',
  suspendDebate: 'Suspend Debate',
  endDebate: 'End Debate',
};

export const DEFAULT_SETTINGS: CommitteeSettings = {
  proceduralThreshold: 'simple',
  substantiveThreshold: 'simple',
  amendmentThreshold: 'simple',
  allowAbstentions: true,
  vetoMode: 'none',
  p5Delegations: ['China', 'France', 'Russia', 'United Kingdom', 'United States'],
  vetoCountries: ['China', 'France', 'Russia', 'United Kingdom', 'United States'],
  quorumThreshold: 'none',
  motionModeratedCaucus: true,
  motionUnmoderatedCaucus: true,
  motionCoW: true,
  cowTimerEnabled: false,
  cowTimerSeconds: 60,
  motionTourDeTable: true,
  motionNames: { ...DEFAULT_MOTION_NAMES },
  motionOrder: ['moderated', 'unmoderated', 'tour', 'consultation'],
  wpSubmissionLimit: null,
  drSubmissionLimit: null,
  chairJoinSuffix: '',
  requireChairApproval: false,
  gslRequireNextSpeaker: false,
  scoring: DEFAULT_SCORING,
};

interface SettingsStore {
  settings: Record<string, CommitteeSettings>;
  getSettings: (code: string) => CommitteeSettings;
  updateSetting: <K extends keyof CommitteeSettings>(code: string, key: K, value: CommitteeSettings[K]) => void;
  initSettings: (code: string, partial?: Partial<CommitteeSettings>) => void;
  hydrateSettings: (code: string, partial: Partial<CommitteeSettings>) => void;
  migrateSettings: (oldCode: string, newCode: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: {},
      getSettings: (code) => ({ ...DEFAULT_SETTINGS, ...(get().settings[code] ?? {}) }),
      updateSetting: (code, key, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            [code]: { ...DEFAULT_SETTINGS, ...(s.settings[code] ?? {}), [key]: value },
          },
        })),
      initSettings: (code, partial = {}) =>
        set((s) => ({
          settings: s.settings[code]
            ? s.settings
            : { ...s.settings, [code]: { ...DEFAULT_SETTINGS, ...partial } },
        })),
      // DB is the source of truth on load: merge stored DB values over the current entry.
      hydrateSettings: (code, partial) =>
        set((s) => ({
          settings: {
            ...s.settings,
            [code]: { ...DEFAULT_SETTINGS, ...(s.settings[code] ?? {}), ...partial },
          },
        })),
      migrateSettings: (oldCode, newCode) =>
        set((s) => {
          const existing = s.settings[oldCode] ?? DEFAULT_SETTINGS;
          const updated = { ...s.settings };
          delete updated[oldCode];
          updated[newCode] = { ...existing };
          return { settings: updated };
        }),
    }),
    { name: 'gavelling-settings' },
  ),
);
