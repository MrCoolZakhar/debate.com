export const PRESET_LOGOS: Record<string, string> = {
  'UN Security Council': '/logos/un.svg',
  'UN Environment Programme': '/logos/UNEP.png',
  'World Health Organization': '/logos/who.png',
  'International Monetary Fund': '/logos/IMF.png',
  'World Bank': '/logos/worldbank.svg',
  'UN General Assembly': '/logos/un.svg',
  'UN Human Rights Council': '/logos/UNHRC.png',
  'Economic and Social Council': '/logos/un.svg',
  'NATO': '/logos/nato.png',
  'G20': '/logos/g20.svg',
  'European Union': '/logos/eu.png',
  'African Union': '/logos/AU.png',
  'Arab League': '/logos/arab-league.png',
  'ASEAN': '/logos/asean.png',
};

export const PRESET_NAME_ES: Record<string, string> = {
  'UN Security Council': 'Consejo de Seguridad de la ONU',
  'UN Environment Programme': 'Programa de Medio Ambiente de la ONU',
  'World Health Organization': 'Organización Mundial de la Salud',
  'International Monetary Fund': 'Fondo Monetario Internacional',
  'World Bank': 'Banco Mundial',
  'UN General Assembly': 'Asamblea General de la ONU',
  'UN Human Rights Council': 'Consejo de Derechos Humanos de la ONU',
  'Economic and Social Council': 'Consejo Económico y Social',
  'NATO': 'OTAN',
  'G20': 'G20',
  'European Union': 'Unión Europea',
  'African Union': 'Unión Africana',
  'Arab League': 'Liga Árabe',
  'ASEAN': 'ASEAN',
};

export const PRESET_NAME_FR: Record<string, string> = {
  'UN Security Council': "Conseil de sécurité de l'ONU",
  'UN Environment Programme': "Programme des Nations Unies pour l'environnement",
  'World Health Organization': 'Organisation mondiale de la santé',
  'International Monetary Fund': 'Fonds monétaire international',
  'World Bank': 'Banque mondiale',
  'UN General Assembly': "Assemblée générale de l'ONU",
  'UN Human Rights Council': "Conseil des droits de l'homme de l'ONU",
  'Economic and Social Council': 'Conseil économique et social',
  'NATO': 'OTAN',
  'G20': 'G20',
  'European Union': 'Union européenne',
  'African Union': 'Union africaine',
  'Arab League': 'Ligue arabe',
  'ASEAN': 'ASEAN',
};

export const PRESET_NAME_AR: Record<string, string> = {
  'UN Security Council': 'مجلس الأمن التابع للأمم المتحدة',
  'UN Environment Programme': 'برنامج الأمم المتحدة للبيئة',
  'World Health Organization': 'منظمة الصحة العالمية',
  'International Monetary Fund': 'صندوق النقد الدولي',
  'World Bank': 'البنك الدولي',
  'UN General Assembly': 'الجمعية العامة للأمم المتحدة',
  'UN Human Rights Council': 'مجلس حقوق الإنسان التابع للأمم المتحدة',
  'Economic and Social Council': 'المجلس الاقتصادي والاجتماعي',
  'NATO': 'حلف شمال الأطلسي',
  'G20': 'مجموعة العشرين',
  'European Union': 'الاتحاد الأوروبي',
  'African Union': 'الاتحاد الأفريقي',
  'Arab League': 'جامعة الدول العربية',
  'ASEAN': 'رابطة دول جنوب شرق آسيا',
};

export function getCommitteeDisplayName(name: string, language: string): string {
  if (language === 'ar') return PRESET_NAME_AR[name] ?? name;
  if (language === 'fr') return PRESET_NAME_FR[name] ?? name;
  if (language === 'es') return PRESET_NAME_ES[name] ?? name;
  return name;
}
