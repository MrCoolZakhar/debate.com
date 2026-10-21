// The roll call's direct status picker and the resume line (owner, 21 Oct 2026).
// Each row's status is a three-segment control (Absent / Present / Present and voting;
// an observer gets Absent / Present), one tap sets that status; the letters A / P / PV
// are drawn, these full names are the titles and accessible names. On a roll call after
// a suspension (or a restart) one plain line says the statuses were kept. Read by
// src/components/RollCallPanel.tsx. Spread into every locale in translations.ts; every
// key exists in all five.
export const rollCallPickerTranslations = {
  en: {
    rollcall_resume_kept: 'Statuses kept from the last session. Change only who is different, then Begin Session.',
    rollcall_status_absent: 'Absent',
    rollcall_status_present: 'Present',
    rollcall_status_pv: 'Present and voting',
    rollcall_status_group: 'Status of {country}',
  },
  es: {
    rollcall_resume_kept: 'Se mantienen los estados de la sesión anterior. Cambia solo a quien sea distinto y pulsa Iniciar sesión.',
    rollcall_status_absent: 'Ausente',
    rollcall_status_present: 'Presente',
    rollcall_status_pv: 'Presente y votante',
    rollcall_status_group: 'Estado de {country}',
  },
  fr: {
    rollcall_resume_kept: "Les statuts de la dernière séance sont conservés. Changez seulement ceux qui diffèrent, puis ouvrez la séance.",
    rollcall_status_absent: 'Absent',
    rollcall_status_present: 'Présent',
    rollcall_status_pv: 'Présent et votant',
    rollcall_status_group: 'Statut de {country}',
  },
  ar: {
    rollcall_resume_kept: 'احتفظنا بالحالات من الجلسة السابقة. غيّر فقط من تغيّرت حالته، ثم ابدأ الجلسة.',
    rollcall_status_absent: 'غائب',
    rollcall_status_present: 'حاضر',
    rollcall_status_pv: 'حاضر ومصوّت',
    rollcall_status_group: 'حالة {country}',
  },
  pt: {
    rollcall_resume_kept: 'Os status da última sessão foram mantidos. Mude apenas quem estiver diferente e depois inicie a sessão.',
    rollcall_status_absent: 'Ausente',
    rollcall_status_present: 'Presente',
    rollcall_status_pv: 'Presente e votante',
    rollcall_status_group: 'Status de {country}',
  },
};
