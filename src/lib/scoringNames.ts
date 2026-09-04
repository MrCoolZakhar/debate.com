/**
 * Localized display names for the BUILT-IN scoring factors and point sources.
 *
 * `ScoringConfig.factors[].name` and `.sources[].name` are chair-authored strings
 * persisted in `committees.settings`, seeded with English defaults. So a Spanish
 * committee that never renamed anything still showed "Diplomacy" and "GSL speech"
 * in the comment dock, on the scoreboard and in Settings, while every other string
 * on the page was Spanish.
 *
 * Same contract as `motionNames()` in committeeFlags.ts, deliberately: a stored name
 * that is empty, missing, or still EXACTLY the canonical English default means the
 * chair never renamed it, so the localized default wins. Anything else is a genuine
 * rename and is shown verbatim in every locale — a chair who types "Rhetoric" gets
 * "Rhetoric" in Arabic too, because that is what they chose to call it.
 *
 * Chair-added custom factors and sources have ids outside these tables and are always
 * shown verbatim; there is nothing to localize.
 *
 * These are display-only. Ids, stored values and the scoring arithmetic never change.
 */

/** Canonical English, byte-identical to DEFAULT_SCORING in settingsStore.ts. */
export const DEFAULT_FACTOR_NAMES: Record<string, string> = {
  diplomacy: 'Diplomacy',
  speaking: 'Public Speaking',
  collaboration: 'Collaboration',
  content: 'Content & Research',
};

export const DEFAULT_SOURCE_NAMES: Record<string, string> = {
  attendance: 'Attendance (P/PV)',
  gslSpeech: 'GSL speech',
  caucusSpeech: 'Caucus speech',
  speakingTimePer10s: 'Speaking time /10s',
  motionRaised: 'Motion raised',
  rightOfReply: 'Right of reply',
  wpSponsor: 'Working paper',
  drSponsor: 'Draft resolution',
  drPassed: 'DR passed',
};

const FACTOR_NAMES_LOCALIZED: Record<string, Record<string, string>> = {
  es: {
    diplomacy: 'Diplomacia',
    speaking: 'Oratoria',
    collaboration: 'Colaboración',
    content: 'Contenido e investigación',
  },
  fr: {
    diplomacy: 'Diplomatie',
    speaking: 'Prise de parole',
    collaboration: 'Collaboration',
    content: 'Contenu et recherche',
  },
  ar: {
    diplomacy: 'الدبلوماسية',
    speaking: 'الإلقاء',
    collaboration: 'التعاون',
    content: 'المحتوى والبحث',
  },
};

const SOURCE_NAMES_LOCALIZED: Record<string, Record<string, string>> = {
  es: {
    attendance: 'Asistencia (P/PV)',
    gslSpeech: 'Discurso en la LGO',
    caucusSpeech: 'Discurso en cáucus',
    speakingTimePer10s: 'Tiempo de palabra /10s',
    motionRaised: 'Moción presentada',
    rightOfReply: 'Derecho de réplica',
    wpSponsor: 'Documento de trabajo',
    drSponsor: 'Proyecto de resolución',
    drPassed: 'Resolución aprobada',
  },
  fr: {
    attendance: 'Présence (P/PV)',
    gslSpeech: 'Discours sur la LGO',
    caucusSpeech: 'Discours en caucus',
    speakingTimePer10s: 'Temps de parole /10s',
    motionRaised: 'Motion déposée',
    rightOfReply: 'Droit de réponse',
    wpSponsor: 'Document de travail',
    drSponsor: 'Projet de résolution',
    drPassed: 'Résolution adoptée',
  },
  ar: {
    attendance: 'الحضور (ح/ح+ت)',
    gslSpeech: 'كلمة في القائمة العامة',
    caucusSpeech: 'كلمة في الجلسة الفرعية',
    speakingTimePer10s: 'مدة الكلام /10 ثوان',
    motionRaised: 'اقتراح مقدَّم',
    rightOfReply: 'حق الرد',
    wpSponsor: 'ورقة عمل',
    drSponsor: 'مشروع قرار',
    drPassed: 'قرار مُعتمد',
  },
};

function resolve(
  defaults: Record<string, string>,
  localized: Record<string, Record<string, string>>,
  id: string,
  stored: string | undefined,
  language: string,
): string {
  const canonical = defaults[id];
  const name = typeof stored === 'string' ? stored.trim() : '';
  // Not a built-in: a chair-added entry. Nothing to localize.
  if (!canonical) return name;
  // Renamed by a chair — honour it in every locale.
  if (name && name !== canonical) return name;
  return localized[language]?.[id] ?? canonical;
}

/** Display name for one quality factor. */
export function factorName(factor: { id: string; name: string }, language: string): string {
  return resolve(DEFAULT_FACTOR_NAMES, FACTOR_NAMES_LOCALIZED, factor.id, factor.name, language);
}

/** Display name for one point source. */
export function sourceName(source: { id: string; name: string }, language: string): string {
  return resolve(DEFAULT_SOURCE_NAMES, SOURCE_NAMES_LOCALIZED, source.id, source.name, language);
}

/** The localized default for a built-in, for use as a rename field's placeholder. */
export function localizedFactorDefault(id: string, language: string): string {
  return FACTOR_NAMES_LOCALIZED[language]?.[id] ?? DEFAULT_FACTOR_NAMES[id] ?? '';
}
export function localizedSourceDefault(id: string, language: string): string {
  return SOURCE_NAMES_LOCALIZED[language]?.[id] ?? DEFAULT_SOURCE_NAMES[id] ?? '';
}
