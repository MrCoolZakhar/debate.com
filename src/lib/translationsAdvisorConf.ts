// Keys for the Faculty Advisor tool (24 Sep 2026), kept in their own file so
// several changes can land without colliding in translations.ts. Spread into
// each locale there; every key must exist in all four locales.
//
// advconf_live_*: the "Your room is live" pop-up and the profile menu's Live now
// entry for a faculty advisor: ONE entry per conference, linking to /advisor.
export const advisorConfTranslations = {
  en: {
    advconf_live_title: '{name}, follow your delegation.',
    advconf_live_title_anon: 'Follow your delegation.',
    advconf_live_open: 'Follow your delegation',
    advconf_live_students_label: 'of your students in live rooms',
    advconf_live_rooms_label: 'committees live',
    advconf_live_note: 'Where every student is in the speaking queue, on one screen.',
    advconf_live_students_one: '1 student live',
    advconf_live_students_many: '{n} students live',
    advconf_live_rooms_one: '1 committee live',
    advconf_live_rooms_many: '{n} committees live',
  },
  es: {
    advconf_live_title: '{name}, sigue a tu delegación.',
    advconf_live_title_anon: 'Sigue a tu delegación.',
    advconf_live_open: 'Seguir a tu delegación',
    advconf_live_students_label: 'de tus estudiantes en salas en vivo',
    advconf_live_rooms_label: 'comités en vivo',
    advconf_live_note: 'Dónde está cada estudiante en la lista de oradores, en una sola pantalla.',
    advconf_live_students_one: '1 estudiante en vivo',
    advconf_live_students_many: '{n} estudiantes en vivo',
    advconf_live_rooms_one: '1 comité en vivo',
    advconf_live_rooms_many: '{n} comités en vivo',
  },
  fr: {
    advconf_live_title: '{name}, suivez votre délégation.',
    advconf_live_title_anon: 'Suivez votre délégation.',
    advconf_live_open: 'Suivre votre délégation',
    advconf_live_students_label: 'de vos élèves dans des salles en direct',
    advconf_live_rooms_label: 'comités en direct',
    advconf_live_note: 'La place de chaque élève dans la liste des orateurs, sur un seul écran.',
    advconf_live_students_one: '1 élève en direct',
    advconf_live_students_many: '{n} élèves en direct',
    advconf_live_rooms_one: '1 comité en direct',
    advconf_live_rooms_many: '{n} comités en direct',
  },
  ar: {
    advconf_live_title: '{name}، تابع وفدك.',
    advconf_live_title_anon: 'تابع وفدك.',
    advconf_live_open: 'تابع وفدك',
    advconf_live_students_label: 'من طلابك في قاعات مباشرة',
    advconf_live_rooms_label: 'لجان مباشرة',
    advconf_live_note: 'مكان كل طالب في قائمة المتحدثين، على شاشة واحدة.',
    advconf_live_students_one: 'طالب واحد مباشر',
    advconf_live_students_many: '{n} طلاب مباشرون',
    advconf_live_rooms_one: 'لجنة واحدة مباشرة',
    advconf_live_rooms_many: '{n} لجان مباشرة',
  },
} as const;
