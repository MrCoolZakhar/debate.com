// Keys for scoreboard manual adjustments (Oct 2026, the TY7ZZ3 / Asia WorldMUN fixes), kept in their own
// file so several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
export const scoreAdjustTranslations = {
  en: {
    // The session loaders' accessible name (delegate and voting pages).
    session_loading_label: 'Loading',
    // Settings → People: a double delegation's two phones, each removable on its own.
    stg_kick_device: 'Device {n}',
    stg_kick_one_aria: 'Remove {name} from {country}',
    stg_kick_one_title: 'Remove {name} from {country}?',
    stg_kick_one_body: 'This device leaves the room now and cannot take this seat again for 10 minutes. The other person on {country} stays in. Their roll call status does not change.',
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} by {name}',
    // Deleting a paper that was voted on (or whose ballot started): the confirm says what goes with it.
    documents_delete_confirm_voted: 'Delete this paper? Its vote record and the points it earned go with it.',
  },
  es: {
    session_loading_label: 'Cargando',
    stg_kick_device: 'Dispositivo {n}',
    stg_kick_one_aria: 'Quitar a {name} de {country}',
    stg_kick_one_title: '¿Quitar a {name} de {country}?',
    stg_kick_one_body: 'Este dispositivo sale de la sala ahora y no puede volver a ocupar este puesto durante 10 minutos. La otra persona de {country} sigue dentro. Su estado de asistencia no cambia.',
    sb_adjust_by: '{action} por {name}',
    documents_delete_confirm_voted: '¿Eliminar este documento? Su registro de votación y los puntos que obtuvo se eliminan con él.',
  },
  fr: {
    session_loading_label: 'Chargement',
    stg_kick_device: 'Appareil {n}',
    stg_kick_one_aria: 'Retirer {name} de {country}',
    stg_kick_one_title: 'Retirer {name} de {country} ?',
    stg_kick_one_body: "Cet appareil quitte la salle maintenant et ne peut pas reprendre ce siège pendant 10 minutes. L'autre personne de {country} reste dans la salle. Son statut d'appel ne change pas.",
    sb_adjust_by: '{action} par {name}',
    documents_delete_confirm_voted: 'Supprimer ce document ? Son résultat de vote et les points obtenus disparaissent avec lui.',
  },
  ar: {
    session_loading_label: 'جارٍ التحميل',
    stg_kick_device: 'الجهاز {n}',
    stg_kick_one_aria: 'إزالة {name} من {country}',
    stg_kick_one_title: 'إزالة {name} من {country}؟',
    stg_kick_one_body: 'يغادر هذا الجهاز القاعة الآن ولا يمكنه أخذ هذا المقعد مجدداً لمدة 10 دقائق. يبقى الشخص الآخر في {country} داخل القاعة. لا تتغير حالة حضوره.',
    sb_adjust_by: '{action} بواسطة {name}',
    documents_delete_confirm_voted: 'هل تريد حذف هذه الورقة؟ سيُحذف معها سجل التصويت والنقاط التي حصلت عليها.',
  },
  // pt-BR: scaffold, values still English. Translate per .claude/pt-glossary.md.
  pt: {
    session_loading_label: 'Carregando',
    stg_kick_device: 'Dispositivo {n}',
    stg_kick_one_aria: 'Remover {name} de {country}',
    stg_kick_one_title: 'Remover {name} de {country}?',
    stg_kick_one_body: 'Este dispositivo sai da sala agora e não pode ocupar este lugar de novo por 10 minutos. A outra pessoa de {country} continua na sala. O status de presença não muda.',
    // A manual award or deduction with its author: "{action}" is sb_hist_award /
    // sb_hist_deduct ("points awarded"), "{name}" the chair's name.
    sb_adjust_by: '{action} por {name}',
    documents_delete_confirm_voted: 'Excluir este documento? O registro da votação e os pontos que ele rendeu vão junto.',
  },
};
