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
  // New shared presets (see src/lib/presets.ts). European Parliament reuses the
  // EU circle-of-stars emblem; the rest are house-style forest/gold monograms.
  'International Criminal Court': '/logos/icc.svg',
  'International Court of Justice': '/logos/icj.svg',
  'Crisis Committee': '/committee-emblems/crisis.svg',
  'FIFA Congress': '/logos/fifa.svg',
  'House of Commons': '/logos/commons.svg',
  'United States Senate': '/logos/senate.svg',
  'International Press Corps': '/logos/press.svg',
  'European Parliament': '/logos/eu.png',
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

// ── Committee emblem presets ──────────────────────────────────────────────────
// A curated set of committee emblems the organiser can one-click apply in the
// editor, plus the aliases used to AUTO-ASSIGN a default emblem when a committee's
// name/abbreviation matches a known body. Logos reuse the existing /logos assets
// (real seals) where they exist; the generic CRISIS emblem lives under
// /committee-emblems. DISEC/SPECPOL/LEGAL/ECOSOC are UN main committees and
// correctly wear the UN emblem.
export interface PresetEmblem {
  key: string;
  label: string; // short acronym shown under the picker swatch
  logo: string;
  aliases: string[]; // lowercase tokens matched against name + abbreviation
}

export const PRESET_EMBLEMS: PresetEmblem[] = [
  { key: 'unsc',   label: 'UNSC',   logo: '/logos/un.svg',                    aliases: ['unsc', 'security council', 'un security council'] },
  { key: 'unga',   label: 'GA',     logo: '/logos/un.svg',                    aliases: ['unga', 'ga', 'general assembly', 'un general assembly'] },
  { key: 'disec',  label: 'DISEC',  logo: '/logos/un.svg',                    aliases: ['disec', 'disarmament', 'first committee', 'ga1', 'international security'] },
  { key: 'specpol',label: 'SPECPOL',logo: '/logos/un.svg',                    aliases: ['specpol', 'special political', 'decolonization', 'fourth committee', 'ga4'] },
  { key: 'sochum', label: 'SOCHUM', logo: '/logos/un.svg',                    aliases: ['sochum', 'third committee', 'ga3', 'social humanitarian and cultural', 'social humanitarian'] },
  { key: 'legal',  label: 'LEGAL',  logo: '/logos/un.svg',                    aliases: ['legal', 'sixth committee', 'ga6', 'ilc', 'international law'] },
  { key: 'ecosoc', label: 'ECOSOC', logo: '/logos/un.svg',                    aliases: ['ecosoc', 'economic and social', 'economic and social council'] },
  { key: 'hrc',    label: 'HRC',    logo: '/logos/UNHRC.png',                 aliases: ['hrc', 'unhrc', 'human rights', 'human rights council'] },
  { key: 'who',    label: 'WHO',    logo: '/logos/who.png',                   aliases: ['who', 'world health', 'world health organization', 'world health organisation'] },
  { key: 'unep',   label: 'UNEP',   logo: '/logos/UNEP.png',                  aliases: ['unep', 'environment programme', 'environment program', 'unea'] },
  { key: 'unicef', label: 'UNICEF', logo: '/logos/unicef.png',               aliases: ['unicef', "children's fund", 'childrens fund'] },
  { key: 'imf',    label: 'IMF',    logo: '/logos/IMF.png',                   aliases: ['imf', 'monetary fund', 'international monetary fund'] },
  { key: 'wb',     label: 'WB',     logo: '/logos/worldbank.svg',            aliases: ['wb', 'world bank'] },
  { key: 'iaea',   label: 'IAEA',   logo: '/logos/iaea.png',                  aliases: ['iaea', 'atomic energy'] },
  { key: 'nato',   label: 'NATO',   logo: '/logos/nato.png',                  aliases: ['nato', 'north atlantic'] },
  { key: 'eu',     label: 'EU',     logo: '/logos/eu.png',                    aliases: ['eu', 'european union', 'european council', 'european parliament', 'ep', 'europarl'] },
  { key: 'au',     label: 'AU',     logo: '/logos/au.svg',                    aliases: ['au', 'african union'] },
  { key: 'g20',    label: 'G20',    logo: '/logos/g20.svg',                   aliases: ['g20', 'group of twenty'] },
  { key: 'arab',   label: 'LAS',    logo: '/logos/arab-league.png',          aliases: ['arab league', 'las', 'league of arab states'] },
  { key: 'asean',  label: 'ASEAN',  logo: '/logos/asean.png',                aliases: ['asean', 'southeast asian nations'] },
  // New shared presets. 'european parliament' is folded into the EU emblem above
  // (not its own key) so "European Parliament" resolves to the EU stars, never to
  // the House of Commons — the bare token 'parliament' is deliberately NOT an
  // alias anywhere, to avoid that collision.
  { key: 'icc',    label: 'ICC',    logo: '/logos/icc.svg',                   aliases: ['icc', 'international criminal court', 'criminal court'] },
  { key: 'icj',    label: 'ICJ',    logo: '/logos/icj.svg',                   aliases: ['icj', 'international court of justice', 'world court'] },
  { key: 'fifa',   label: 'FIFA',   logo: '/logos/fifa.svg',                  aliases: ['fifa', 'fifa congress', 'fifa council', 'world cup'] },
  { key: 'commons',label: 'HoC',    logo: '/logos/commons.svg',              aliases: ['house of commons', 'commons', 'hoc', 'westminster', 'uk parliament', 'british parliament'] },
  { key: 'senate', label: 'SENATE', logo: '/logos/senate.svg',              aliases: ['us senate', 'united states senate', 'senate', 'us congress', 'united states congress'] },
  { key: 'press',  label: 'PRESS',  logo: '/logos/press.svg',                aliases: ['press', 'press corps', 'international press', 'international press corps', 'ipc', 'media corps'] },
  { key: 'crisis', label: 'CRISIS', logo: '/committee-emblems/crisis.svg',    aliases: ['crisis', 'crisis committee', 'jcc', 'joint crisis', 'cabinet', 'ad hoc', 'ad-hoc'] },
];

// A short, high-signal subset surfaced as one-click swatches in the editor.
// De-duplicated BY LOGO: unsc/disec/specpol/legal/ecosoc all wear the same UN
// seal, so the raw filter used to render the identical UN emblem five times. We
// keep the first entry per distinct logo (UNSC stands in for the UN family).
export const PRESET_EMBLEM_PICKS: PresetEmblem[] = (() => {
  const wanted = ['unsc', 'disec', 'specpol', 'legal', 'ecosoc', 'hrc', 'who', 'crisis'];
  const seenLogos = new Set<string>();
  const picks: PresetEmblem[] = [];
  for (const key of wanted) {
    const e = PRESET_EMBLEMS.find((x) => x.key === key);
    if (!e || seenLogos.has(e.logo)) continue;
    seenLogos.add(e.logo);
    picks.push(e);
  }
  return picks;
})();

// Match a committee's name + abbreviation to a preset emblem logo, or null.
// Abbreviation is weighted first (exact acronym), then name substring.
export function matchPresetEmblem(name: string | null | undefined, abbreviation?: string | null): string | null {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const abbr = abbreviation ? norm(abbreviation) : '';
  const nm = name ? norm(name) : '';
  if (!abbr && !nm) return null;
  // 1) Exact acronym match on the abbreviation field.
  if (abbr) {
    for (const e of PRESET_EMBLEMS) {
      if (e.aliases.some((a) => a === abbr)) return e.logo;
    }
  }
  // 2) Alias appears in the name (or abbreviation). Multi-word aliases match as a
  // phrase; single short tokens must match on a word boundary so e.g. "eu" does
  // not fire inside "museum".
  const hay = `${nm} ${abbr}`.trim();
  for (const e of PRESET_EMBLEMS) {
    for (const a of e.aliases) {
      if (a.includes(' ')) {
        if (hay.includes(a)) return e.logo;
      } else {
        const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${esc}\\b`).test(hay)) return e.logo;
      }
    }
  }
  return null;
}

// Decide what committee NAME a preset should populate / display. Rule:
//   • more than 4 words in the full name → use the acronym (e.g. "Disarmament
//     and International Security Committee" → "DISEC").
//   • 4 words or fewer → keep the full name (e.g. "United Nations Security
//     Council", "International Monetary Fund", "World Bank" all stay as-is).
// Null/blank-guarded: a missing name falls back to the acronym, a missing
// acronym falls back to the full name.
export function committeeDisplayName(fullName: string | null | undefined, acronym?: string | null): string {
  const name = (fullName ?? '').trim();
  const ac = (acronym ?? '').trim();
  if (!name) return ac;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 4) return ac || name;
  return name;
}

// Append an edition year to a name/acronym label, but ONLY when the label does
// not already contain that exact 4-digit year — so "Hult 2026" + 2026 stays
// "Hult 2026" instead of becoming "Hult 2026 2026". A null/blank year (or a
// blank label) is a no-op.
export function appendEditionYear(label: string, year: string | null | undefined): string {
  const base = (label ?? '').trim();
  const y = (year ?? '').trim();
  if (!y) return base;
  if (base.includes(y)) return base;
  return base ? `${base} ${y}` : y;
}

export function getCommitteeDisplayName(name: string, language: string): string {
  if (language === 'ar') return PRESET_NAME_AR[name] ?? name;
  if (language === 'fr') return PRESET_NAME_FR[name] ?? name;
  if (language === 'es') return PRESET_NAME_ES[name] ?? name;
  return name;
}
