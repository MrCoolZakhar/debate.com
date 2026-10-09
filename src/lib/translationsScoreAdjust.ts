// Keys for scoreboard manual adjustments (Oct 2026, the TY7ZZ3 / Asia WorldMUN fixes), kept in their own
// file so several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
export const scoreAdjustTranslations = {
  en: {
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} by {name}',
  },
  es: {
    sb_adjust_by: '{action} por {name}',
  },
  fr: {
    sb_adjust_by: '{action} par {name}',
  },
  ar: {
    sb_adjust_by: '{action} بواسطة {name}',
  },
  // pt-BR: scaffold, values still English. Translate per .claude/pt-glossary.md.
  pt: {
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} por {name}',
  },
};
