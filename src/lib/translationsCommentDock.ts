// Keys for the Commenter comment dock (FeedbackLogPanel) (Oct 2026, the TY7ZZ3 / Asia WorldMUN fixes), kept in their own
// file so several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
export const commentDockTranslations = {
  en: {
    // Under a note the server has not confirmed after two attempts. The text is kept on
    // this device (and in its storage) and sent again by itself.
    fb_note_unsaved: 'Not saved yet. Your note is kept here and will be sent when the connection is back.',
  },
  es: {
    fb_note_unsaved: 'Aún no se ha guardado. Tu nota se conserva aquí y se enviará cuando vuelva la conexión.',
  },
  fr: {
    fb_note_unsaved: 'Pas encore enregistrée. Votre note est conservée ici et sera envoyée dès le retour de la connexion.',
  },
  ar: {
    fb_note_unsaved: 'لم تُحفظ بعد. ملاحظتك محفوظة هنا وستُرسل عند عودة الاتصال.',
  },
  // pt-BR: scaffold, values still English. Translate per .claude/pt-glossary.md.
  pt: {
    // Under a note the server has not confirmed after two attempts. The text is kept on
    // this device (and in its storage) and sent again by itself.
    fb_note_unsaved: 'Ainda não foi salva. Sua anotação fica guardada aqui e será enviada quando a conexão voltar.',
  },
};
