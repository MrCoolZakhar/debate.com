import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CommitteeSettings {
  // Tab 1 — Voting & Majorities
  proceduralThreshold: 'simple' | 'absolute';
  substantiveThreshold: 'simple' | 'supermajority-2-3' | 'consensus';
  amendmentThreshold: 'simple' | 'supermajority-2-3';
  allowAbstentions: boolean;
  vetoMode: 'none' | 'p5' | 'unanimous';
  p5Delegations: string[];
  quorumThreshold: 'none' | '1-4' | '1-3' | '1-2';
  // Tab 2 — Motions
  motionModeratedCaucus: boolean;
  motionUnmoderatedCaucus: boolean;
  motionCoW: boolean;
  motionTourDeTable: boolean;
  // Tab 3 — Access & Identity
  customSessionId: string;
  separateDelegateCode: boolean;
  requireChairApproval: boolean;
  allowMultipleCoChairs: boolean;
  chairSessionPersistence: boolean;
  chairTakeoverProtection: boolean;
  requireDelegationName: boolean;
}

export const DEFAULT_SETTINGS: CommitteeSettings = {
  proceduralThreshold: 'simple',
  substantiveThreshold: 'simple',
  amendmentThreshold: 'simple',
  allowAbstentions: true,
  vetoMode: 'none',
  p5Delegations: ['China', 'France', 'Russia', 'United Kingdom', 'United States'],
  quorumThreshold: 'none',
  motionModeratedCaucus: true,
  motionUnmoderatedCaucus: true,
  motionCoW: true,
  motionTourDeTable: true,
  customSessionId: '',
  separateDelegateCode: true,
  requireChairApproval: false,
  allowMultipleCoChairs: true,
  chairSessionPersistence: true,
  chairTakeoverProtection: true,
  requireDelegationName: true,
};

interface SettingsStore {
  settings: Record<string, CommitteeSettings>;
  getSettings: (code: string) => CommitteeSettings;
  updateSetting: <K extends keyof CommitteeSettings>(code: string, key: K, value: CommitteeSettings[K]) => void;
  initSettings: (code: string, partial?: Partial<CommitteeSettings>) => void;
  migrateSettings: (oldCode: string, newCode: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: {},
      getSettings: (code) => get().settings[code] ?? { ...DEFAULT_SETTINGS },
      updateSetting: (code, key, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            [code]: { ...(s.settings[code] ?? DEFAULT_SETTINGS), [key]: value },
          },
        })),
      initSettings: (code, partial = {}) =>
        set((s) => ({
          settings: s.settings[code]
            ? s.settings
            : { ...s.settings, [code]: { ...DEFAULT_SETTINGS, ...partial } },
        })),
      migrateSettings: (oldCode, newCode) =>
        set((s) => {
          const existing = s.settings[oldCode] ?? DEFAULT_SETTINGS;
          const updated = { ...s.settings };
          delete updated[oldCode];
          updated[newCode] = { ...existing, customSessionId: newCode };
          return { settings: updated };
        }),
    }),
    { name: 'gavelling-settings' },
  ),
);
