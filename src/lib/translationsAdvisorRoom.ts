// Keys for the Faculty Advisor tool (24 Sep 2026), kept in their own file so
// several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
//
// This file: the join page's way onto the advisor board (/advisor?add=CODE). The
// single-room view (/advisor/[code]) and its keys were removed on 24 Sep 2026; that
// route now redirects to the board.
export const advisorRoomTranslations = {
  en: {
    join_advisor_follow_title: 'Follow as an advisor',
    join_advisor_follow_body: 'Read only. Adds this room to your advisor board.',
    join_advisor_follow_btn: 'Follow on my board',
  },
  es: {
    join_advisor_follow_title: 'Seguir como asesor',
    join_advisor_follow_body: 'Solo lectura. Añade esta sala a tu panel de asesor.',
    join_advisor_follow_btn: 'Seguir en mi panel',
  },
  fr: {
    join_advisor_follow_title: 'Suivre en tant que superviseur',
    join_advisor_follow_body: 'Lecture seule. Ajoute cette salle à votre tableau de superviseur.',
    join_advisor_follow_btn: 'Suivre sur mon tableau',
  },
  ar: {
    join_advisor_follow_title: 'تابع كمستشار',
    join_advisor_follow_body: 'للقراءة فقط. تضيف هذه القاعة إلى لوحة المستشار.',
    join_advisor_follow_btn: 'تابع على لوحتي',
  },
} as const;
