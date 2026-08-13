import type { Committee } from './types';
import { DEFAULT_MOTION_NAMES, type MotionNames } from './settingsStore';

// Single read path for DB-backed committee flags — works on any device (delegate,
// voting, advisor), since dbSettings comes from the committee row, not localStorage.
export function getCommitteeFlags(committee: Pick<Committee, 'dbSettings'>) {
  const s = committee.dbSettings ?? {};
  return {
    sponsorLabel: (s.sponsorLabel as string) || '',
    lockDelegateRollCall: (s.lockDelegateRollCall as boolean) ?? false,
    disableChat: (s.disableChat as boolean) ?? false,
    requireChairApproval: (s.requireChairApproval as boolean) ?? false,
  };
}

// The visible sponsor term — custom value wins, else the translated fallback.
export function sponsorLabel(committee: Pick<Committee, 'dbSettings'>, fallback: string): string {
  return (committee.dbSettings?.sponsorLabel as string)?.trim() || fallback;
}

// ── Motion display names ─────────────────────────────────────────────────────
//
// Chairs rename the motion types per committee (Settings → Motions). The custom
// names live in CommitteeSettings.motionNames, which SettingsPanel mirrors into
// the `committees.settings` JSONB on every change.
//
// Before this resolver existed, `motionNames` was read ONLY on the chair's
// MotionsModal, off the localStorage settings store. The delegate and advisor
// pages never hydrate that store (AGENTS.md rule 14), so they carried their own
// hardcoded per-locale tables and could only surface a rename through
// `caucus.motionLabel` — the snapshot the chair writes when a caucus STARTS.
// A rename therefore appeared to delegates only while a caucus of that type was
// actually running, and never at all for Suspend / End Debate.
//
// This is the same pure-function-of-the-committee-row pattern as `sponsorLabel`
// above and `docName` in ./docNames: it reads `dbSettings`, never localStorage,
// so it gives the identical answer on every device and every surface.
//
// NOTE on live caucuses: `caucus.motionLabel` still wins where it is set,
// because it records WHICH motion opened the caucus. A Tour de Table is stored
// with `caucus.type === 'moderated'` (MotionsModal writes the tour label onto a
// moderated caucus), so resolving purely from the caucus type would mislabel it.
// Prefer motionLabel, fall back to this resolver.

const MOTION_NAMES_LOCALIZED: Record<string, MotionNames> = {
  ar: {
    moderated: 'حوار منهجي', unmoderated: 'حوار حر', consultation: 'مشاورات الهيئة',
    tour: 'جولة المتحدثين', custom: 'مخصص',
    suspendDebate: 'تعليق النقاش', endDebate: 'إنهاء النقاش',
  },
  fr: {
    moderated: 'Caucus modéré', unmoderated: 'Caucus non modéré', consultation: "Consultation de l'assemblée",
    tour: 'Tour de table', custom: 'Personnalisée',
    suspendDebate: 'Suspension du débat', endDebate: 'Clôture du débat',
  },
  es: {
    moderated: 'Cáucus Moderado', unmoderated: 'Cáucus No Moderado', consultation: 'Consulta de Gabinete',
    tour: 'Round Robin', custom: 'Personalizada',
    suspendDebate: 'Suspender Debate', endDebate: 'Cerrar Debate',
  },
};

const MOTION_NAME_KEYS = Object.keys(DEFAULT_MOTION_NAMES) as (keyof MotionNames)[];

/**
 * The built-in motion names in this locale, ignoring any chair rename. Use this
 * where you need the DEFAULT to show alongside a custom value (the Settings
 * rename rows); use `motionNames()` for anything a delegate or advisor reads.
 */
export function localizedMotionDefaults(language: string): MotionNames {
  return { ...DEFAULT_MOTION_NAMES, ...(MOTION_NAMES_LOCALIZED[language] ?? {}) };
}

/**
 * Every motion type's display name for this committee, in this locale.
 *
 * A stored name that is empty, missing, or still exactly the canonical ENGLISH
 * default means "the chair never renamed this" — the localized default wins, so
 * a Spanish delegate keeps seeing "Cáucus Moderado". Anything else is a genuine
 * rename and is shown verbatim in every locale. Identical semantics to
 * `docName()` and to MotionsModal's chair-side resolution.
 */
export function motionNames(
  committee: Pick<Committee, 'dbSettings'> | null | undefined,
  language: string,
): MotionNames {
  const localized = MOTION_NAMES_LOCALIZED[language] ?? DEFAULT_MOTION_NAMES;
  const stored = committee?.dbSettings?.motionNames as Partial<MotionNames> | undefined;
  const out = { ...DEFAULT_MOTION_NAMES, ...localized };
  for (const key of MOTION_NAME_KEYS) {
    const raw = stored?.[key];
    const custom = typeof raw === 'string' ? raw.trim() : '';
    if (custom && custom !== DEFAULT_MOTION_NAMES[key]) out[key] = custom;
  }
  return out;
}

/** One motion type's display name. Convenience wrapper over `motionNames`. */
export function motionName(
  committee: Pick<Committee, 'dbSettings'> | null | undefined,
  key: keyof MotionNames,
  language: string,
): string {
  return motionNames(committee, language)[key];
}
