import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isSecurityCouncil } from './presetNames';

export interface MotionNames {
  moderated: string;
  unmoderated: string;
  consultation: string;
  tour: string;
  custom: string;
  suspendDebate: string;
  endDebate: string;
}

// Chair-renameable display names for the two document types. Singular AND plural
// are stored because the UI needs both ("Submit a Working Paper" vs "Working Papers").
// Values are the canonical ENGLISH defaults until a chair overrides them — exactly
// like MotionNames — so a localized label never leaks into the store or the DB.
export interface DocumentNames {
  workingPaper: string;
  workingPapers: string;
  draftResolution: string;
  draftResolutions: string;
}

export interface ScoreSource { id: string; name: string; value: number; enabled: boolean; builtin: boolean; }
export interface RankingFactor { id: string; name: string; enabled: boolean; }
export interface ScoringConfig {
  sources: ScoreSource[];            // built-ins below + chair-added custom ones
  factors: RankingFactor[];
  // Whether chairs get the per-speech rating sliders at all. Default OFF.
  //
  // These shipped on by default and were, in practice, never used: across the whole
  // history of the product only a couple of ratings were ever recorded with a real
  // spread of values, and every other stored rating is a 0 or a 1 — the fingerprint of
  // a slider brushed by accident rather than set deliberately. `scoreBlend` also
  // defaults to 0, so even a deliberate rating moved no score. So the sliders occupied
  // half the comment dock and changed nothing. They are now opt-in, and a committee
  // that turns them on gets a 1–10 scale, which is what chairs actually mark on.
  // Ratings ALREADY recorded stay visible on the scoreboard regardless of this flag —
  // it gates the input, never the display, so turning it off can never hide data.
  factorRatingsEnabled: boolean;     // default false
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
  factorRatingsEnabled: false, factorScaleMax: 10, scoreBlend: 0, hideScoresFromDelegates: false,
};

export interface CommitteeSettings {
  // Tab 1 — Voting & Majorities
  substantiveThreshold: 'simple' | 'supermajority-2-3' | 'consensus';
  allowAbstentions: boolean;
  // false (default, historic behaviour) = abstentions are excluded from the
  // threshold denominator. true = they join For + Against, so abstaining makes
  // a resolution harder to pass. Enforced on the voting screen.
  abstentionsInDenominator: boolean;
  vetoMode: 'none' | 'p5' | 'unanimous' | 'custom';
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
  // Free-text placeholder motion for procedural business handled verbally in the
  // room. Accepting one is a deliberate no-op, so it has no order position — it
  // is always the least disruptive motion on the floor.
  motionCustom: boolean;
  motionNames: MotionNames;
  motionOrder: ('moderated' | 'unmoderated' | 'consultation' | 'tour')[];
  wpSubmissionLimit: number | null;  // null = unlimited
  drSubmissionLimit: number | null;
  requireDocApproval: boolean;       // default false — chair must approve WP/DR before it can be introduced
  documentNames: DocumentNames;      // chair-renameable labels for the two document types
  // GSL behaviour
  gslRequireNextSpeaker: boolean;
  // Scoring & ranking
  scoring: ScoringConfig;
  // Tab 3 — Access & Identity
  chairJoinSuffix: string;
  requireChairApproval: boolean;
  // Committee display & permissions
  sponsorLabel: string;          // default ''  (empty → use translated "Sponsors")
  lockDelegateRollCall: boolean; // default false
  disableChat: boolean;          // default false
}

export const DEFAULT_MOTION_NAMES: MotionNames = {
  moderated: 'Moderated Caucus',
  unmoderated: 'Unmoderated Caucus',
  consultation: 'Consultation of the Whole',
  tour: 'Tour de Table',
  custom: 'Custom',
  suspendDebate: 'Suspend Debate',
  endDebate: 'End Debate',
};

export const DEFAULT_DOCUMENT_NAMES: DocumentNames = {
  workingPaper: 'Working Paper',
  workingPapers: 'Working Papers',
  draftResolution: 'Draft Resolution',
  draftResolutions: 'Draft Resolutions',
};

export const DEFAULT_SETTINGS: CommitteeSettings = {
  substantiveThreshold: 'simple',
  allowAbstentions: true,
  abstentionsInDenominator: false,
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
  motionCustom: true,
  motionNames: { ...DEFAULT_MOTION_NAMES },
  motionOrder: ['consultation', 'tour', 'unmoderated', 'moderated'],
  wpSubmissionLimit: null,
  drSubmissionLimit: null,
  requireDocApproval: false,
  documentNames: { ...DEFAULT_DOCUMENT_NAMES },
  chairJoinSuffix: '',
  requireChairApproval: false,
  gslRequireNextSpeaker: false,
  scoring: DEFAULT_SCORING,
  sponsorLabel: '',
  lockDelegateRollCall: false,
  disableChat: false,
};

// ── Identity-implied defaults ────────────────────────────────────────────────
/**
 * Settings that a committee's IDENTITY implies when the chair has never made a
 * choice. Today there is exactly one: a Security Council starts with the P5 veto
 * switched on.
 *
 * THE ONE CORRECTNESS RULE: a key is only implied when it is ABSENT from the
 * committee's stored `committees.settings` jsonb. Any stored value — including a
 * chair deliberately setting `vetoMode: 'none'` — is an explicit choice and wins.
 * The moment the implied value is written back to the DB (or the chair changes any
 * rule, which persists the whole blob) the key becomes present, so this function
 * returns `{}` on every subsequent load and can never re-override the chair.
 *
 * Pure function of the committee row — it never reads localStorage, so it is safe
 * on the delegate/advisor surfaces too (AGENTS.md rule 14).
 */
export function impliedSettings(
  committeeName: string | null | undefined,
  storedSettings: Record<string, unknown> | null | undefined,
  abbreviation?: string | null,
): Partial<CommitteeSettings> {
  const stored = storedSettings ?? {};
  const implied: Partial<CommitteeSettings> = {};
  const vetoChosen = Object.prototype.hasOwnProperty.call(stored, 'vetoMode') && stored.vetoMode != null;
  if (!vetoChosen && isSecurityCouncil(committeeName, abbreviation)) implied.vetoMode = 'p5';
  return implied;
}

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
