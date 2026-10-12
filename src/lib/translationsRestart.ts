// Keys for restarting a committee that ended (owner, 7 Oct 2026: "when someone ends debate,
// going onto the same session within 24 hours, it still allows them back in to restart it.
// This happened in some committees where they accidentally ended it").
//
// Read by the chair End View (src/app/chair/[code]/page.tsx, SessionEndedContent) and the
// rejoin prompt (src/components/liveRooms/LiveRoomsDialog.tsx). Kept in its own file so
// several changes can land without colliding in translations.ts; spread into each locale
// there. Every key must exist in all four locales.
//
// Copy rules (CLAUDE.md §8): buttons in sentence case, no em dashes, no full stop on a
// button or a one-line caption, and say what happens next.
export const restartTranslations = {
  en: {
    // The End View's restart control, shown only inside the 24 h window.
    session_restart_btn: 'Restart the session',
    // Asked before it is written: an accidental restart is also an accident.
    session_restart_ask: 'Restart this committee? It goes back to roll call and the record is kept',
    session_restart_yes: 'Restart it',
    session_restart_no: 'Keep it closed',
    session_restart_failed: 'Could not restart the session. The change did not reach the server. Check your connection and press Restart the session again.',
    // The rejoin card, when the room it offers is one that ended but can still be restarted.
    srp_rejoin_ended_note: 'This committee was ended. Opening it gives you the restart button.',
  },
  es: {
    session_restart_btn: 'Reiniciar la sesión',
    session_restart_ask: '¿Reiniciar este comité? Volverá al pase de lista y se conserva el registro',
    session_restart_yes: 'Reiniciarlo',
    session_restart_no: 'Dejarlo cerrado',
    session_restart_failed: 'No se pudo reiniciar la sesión: el cambio no llegó al servidor. Revisa tu conexión y vuelve a pulsar Reiniciar la sesión.',
    srp_rejoin_ended_note: 'Este comité se dio por finalizado. Al abrirlo verás el botón de reinicio.',
  },
  fr: {
    session_restart_btn: 'Redémarrer la session',
    session_restart_ask: 'Redémarrer ce comité ? Il revient à l’appel et le compte rendu est conservé',
    session_restart_yes: 'Le redémarrer',
    session_restart_no: 'Le laisser clos',
    session_restart_failed: "Impossible de redémarrer la session : la modification n'a pas atteint le serveur. Vérifiez votre connexion et appuyez de nouveau sur Redémarrer la session.",
    srp_rejoin_ended_note: 'Ce comité a été clos. En l’ouvrant, vous trouverez le bouton de redémarrage.',
  },
  ar: {
    session_restart_btn: 'إعادة تشغيل الجلسة',
    session_restart_ask: 'إعادة تشغيل هذه اللجنة؟ ستعود إلى تسجيل الحضور ويُحفظ السجل',
    session_restart_yes: 'إعادة تشغيلها',
    session_restart_no: 'إبقاؤها مغلقة',
    session_restart_failed: 'تعذّر إعادة تشغيل الجلسة: لم يصل التغيير إلى الخادم. تحقّق من اتصالك ثم اضغط إعادة تشغيل الجلسة مجدداً.',
    srp_rejoin_ended_note: 'أُنهيت هذه اللجنة. بفتحها يظهر لك زر إعادة التشغيل.',
  },
  // pt-BR: scaffold, values still English. Translate per .claude/pt-glossary.md.
  pt: {
    // The End View's restart control, shown only inside the 24 h window.
    session_restart_btn: 'Reiniciar a sessão',
    // Asked before it is written: an accidental restart is also an accident.
    session_restart_ask: 'Reiniciar este comitê? Ele volta para a chamada e o registro é mantido',
    session_restart_yes: 'Reiniciar',
    session_restart_no: 'Manter encerrado',
    session_restart_failed: 'Não foi possível reiniciar a sessão. A mudança não chegou ao servidor. Verifique sua conexão e pressione Reiniciar a sessão de novo.',
    // The rejoin card, when the room it offers is one that ended but can still be restarted.
    srp_rejoin_ended_note: 'Este comitê foi encerrado. Ao abri-lo, você verá o botão de reiniciar.',
  },
};
