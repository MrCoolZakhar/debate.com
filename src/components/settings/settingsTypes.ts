import type { Committee } from '@/lib/types';
import type { CommitteeSettings, ScoringConfig } from '@/lib/settingsStore';
import type { TranslationKey, Language } from '@/lib/translations';

export type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export type SettingsTab = 'access' | 'motions' | 'voting' | 'points' | 'people' | 'awards';

export type Upd = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => void;

/** Everything a tab needs. `upd` / `updScoring` are SettingsPanel's key-level patch writers
 *  (store first, then a debounced patch of only the changed keys) and are no-ops for a
 *  Commenter. */
export interface TabProps {
  committee: Committee;
  s: CommitteeSettings;
  upd: Upd;
  scoring: ScoringConfig;
  updScoring: (next: ScoringConfig) => void;
  isViewOnly: boolean;
  myChairName?: string;
  t: TFn;
  language: Language;
}
