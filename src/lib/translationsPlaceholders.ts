// Empty-value words for session surfaces (Oct 2026). The owner's rule: no dash ("–" / "—")
// is ever shown as a placeholder for a missing value; a short muted word is shown instead.
// Kept in their own file so several changes can land without colliding in translations.ts.
// Spread into each locale there; every key must exist in all four locales.
export const placeholderTranslations = {
  en: {
    // A quality factor a Commenter has not rated yet (the comment dock).
    fb_not_rated: 'Not rated',
    // The scoreboard Matrix's quality column for a delegation with no ratings.
    sb_quality_none: 'None',
    // The GavelChip label when nobody holds the gavel ("Moderator: Nobody yet").
    gavel_nobody: 'Nobody yet',
    // The voting roll call's "To pass" figure while nobody is marked present.
    voting_rc_needed_none: 'None',
  },
  es: {
    fb_not_rated: 'Sin calificar',
    sb_quality_none: 'Ninguna',
    gavel_nobody: 'Nadie aún',
    voting_rc_needed_none: 'Ninguno',
  },
  fr: {
    fb_not_rated: 'Non noté',
    sb_quality_none: 'Aucune',
    gavel_nobody: 'Personne',
    voting_rc_needed_none: 'Aucun',
  },
  ar: {
    fb_not_rated: 'بلا تقييم',
    sb_quality_none: 'لا يوجد',
    gavel_nobody: 'لا أحد بعد',
    voting_rc_needed_none: 'لا يوجد',
  },
};
