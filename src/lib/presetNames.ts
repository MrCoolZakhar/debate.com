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

export function getCommitteeDisplayName(name: string, language: string): string {
  if (language !== 'es') return name;
  return PRESET_NAME_ES[name] ?? name;
}
