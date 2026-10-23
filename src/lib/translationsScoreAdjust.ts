// Keys for scoreboard manual adjustments (Oct 2026, the TY7ZZ3 / Asia WorldMUN fixes), kept in their own
// file so several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
export const scoreAdjustTranslations = {
  en: {
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} by {name}',
    // Deleting a paper that was voted on (or whose ballot started): the confirm says what goes with it.
    documents_delete_confirm_voted: 'Delete this paper? Its vote record and the points it earned go with it.',
  },
  es: {
    sb_adjust_by: '{action} por {name}',
    documents_delete_confirm_voted: '¿Eliminar este documento? Su registro de votación y los puntos que obtuvo se eliminan con él.',
  },
  fr: {
    sb_adjust_by: '{action} par {name}',
    documents_delete_confirm_voted: 'Supprimer ce document ? Son résultat de vote et les points obtenus disparaissent avec lui.',
  },
  ar: {
    sb_adjust_by: '{action} بواسطة {name}',
    documents_delete_confirm_voted: 'هل تريد حذف هذه الورقة؟ سيُحذف معها سجل التصويت والنقاط التي حصلت عليها.',
  },
  // pt-BR: scaffold, values still English. Translate per .claude/pt-glossary.md.
  pt: {
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} por {name}',
    documents_delete_confirm_voted: 'Excluir este documento? O registro da votação e os pontos que ele rendeu vão junto.',
  },
};
