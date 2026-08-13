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
//
// This is the ONLY emblem resolver for a standalone session — a session
// `committees` row has no logo column, so a chair who starts "UN Security
// Council" gets the real UN mark purely because this function recognises the
// name they typed. It therefore has to survive what chairs actually type, not
// just the canonical preset strings:
//   • punctuation — "UNSC (Historical)", "Security-Council", "WHO — 1948",
//     "G-20". Every non-alphanumeric run collapses to a single space BEFORE
//     matching, so neither the phrase aliases ("security council") nor the
//     word-boundary acronym aliases are blocked by a dash, colon or bracket.
//   • dotted acronyms — "U.N.S.C." normalises to "u n s c", so runs of
//     CONSECUTIVE single characters are rejoined and matched again as "unsc".
//     Only single-char runs are joined: squashing the whole string would turn
//     "Renato Council" into "renatocouncil" and false-match the 'nato' alias.
//   • accents/casing — normalised away, as before.
//
// Returns the whole PRESET_EMBLEMS entry so callers can also use its real
// acronym (`label`) — see deriveCommitteeAcronym. `matchPresetEmblem` below is
// the unchanged logo-only signature every existing caller uses.
export function matchPresetEmblemEntry(
  name: string | null | undefined,
  abbreviation?: string | null,
): PresetEmblem | null {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // Rejoin runs of CONSECUTIVE single characters ("u n s c" -> "unsc") and a
  // single letter glued to a number ("g 20" -> "g20"). Deliberately narrow:
  // squashing whole strings would turn "Renato Council" into "renatocouncil"
  // and false-match the 'nato' alias.
  const unspace = (s: string) =>
    s
      .replace(/\b[a-z0-9](?:\s+[a-z0-9])+\b/g, (m) => m.replace(/\s+/g, ''))
      .replace(/\b([a-z])\s+(\d+)\b/g, '$1$2');

  const abbr = abbreviation ? unspace(norm(abbreviation)) : '';
  const nm = name ? norm(name) : '';
  if (!abbr && !nm) return null;
  // 1) Exact acronym match on the abbreviation field.
  if (abbr) {
    for (const e of PRESET_EMBLEMS) {
      if (e.aliases.some((a) => a === abbr)) return e;
    }
  }
  // 2) Alias appears in the name (or abbreviation). Multi-word aliases match as a
  // phrase; single short tokens must match on a word boundary so e.g. "eu" does
  // not fire inside "museum".
  const hay = `${nm} ${abbr}`.trim();
  const squashed = unspace(hay);
  const hays = squashed === hay ? [hay] : [hay, squashed];
  for (const e of PRESET_EMBLEMS) {
    for (const a of e.aliases) {
      for (const h of hays) {
        if (a.includes(' ')) {
          if (h.includes(a)) return e;
        } else {
          const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\b${esc}\\b`).test(h)) return e;
        }
      }
    }
  }
  return null;
}

export function matchPresetEmblem(name: string | null | undefined, abbreviation?: string | null): string | null {
  return matchPresetEmblemEntry(name, abbreviation)?.logo ?? null;
}

// The acronym to show for a committee that has NO explicit `abbreviation` - i.e.
// every standalone session, whose `committees` row has only a free-text name.
// `committeeDisplayName` needs an acronym to apply the UI RULE (long name ->
// acronym + full name beneath); without one it silently keeps the long name and
// the rule never fires.
//
// Order:
//   1. the explicit abbreviation, when there is one (conference committees);
//   2. the matched preset's REAL acronym - "Disarmament and International
//      Security Committee" -> DISEC, which a naive initialism could never
//      produce (it would give "DISC");
//   3. initials of the significant words - "United Nations Office on Drugs and
//      Crime" -> UNODC. Stopwords are dropped and the result is capped at 6
//      characters, past which an initialism stops reading as an acronym.
// Returns '' when nothing sensible can be derived, which leaves
// `committeeDisplayName` showing the full name once.
const ACRONYM_STOPWORDS = new Set(['and', 'of', 'the', 'for', 'on', 'in', 'to', 'a', 'an', 'at', 'by']);

export function deriveCommitteeAcronym(
  name: string | null | undefined,
  abbreviation?: string | null,
): string {
  const explicit = (abbreviation ?? '').trim();
  if (explicit) return explicit;
  const preset = matchPresetEmblemEntry(name, null);
  if (preset) return preset.label;
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .filter((w) => !ACRONYM_STOPWORDS.has(w.toLowerCase()));
  if (words.length < 2) return '';
  const initials = words.map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0] ?? '').join('').toUpperCase();
  return initials.length >= 2 && initials.length <= 6 ? initials : '';
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

// ── Security Council detection ────────────────────────────────────────────────
// Used to give a Security Council committee the P5 veto BY DEFAULT. The default is
// applied ONLY where the committee's stored settings carry no `vetoMode` at all —
// see `impliedSettings` in src/lib/settingsStore.ts — so an explicit chair choice,
// including deliberately switching the veto OFF, is never overridden.
//
// MATCHES (case-insensitive, accent-insensitive, punctuation-insensitive):
//   • the phrase "security council" anywhere in the name or abbreviation —
//     "UN Security Council", "United Nations Security Council", "Security Council
//     of the United Nations", "Historical Security Council", "UNSC (Security
//     Council)"
//   • the token "unsc" or "hsc" on a word boundary — "UNSC", "UNSC-A", "HSC 1962"
//   • the localized phrases the PRESET_NAME_* tables above use:
//     "conseil de securite" (fr), "consejo de seguridad" (es), "مجلس الأمن" (ar)
//   • the bare token "sc" ONLY when it is the ENTIRE abbreviation or the ENTIRE
//     name — never as a token inside something longer
//
// DELIBERATELY DOES **NOT** MATCH:
//   • "sc" inside a longer string. Two letters is far too short to be safe: it
//     collides with SOCHUM, ECOSOC, "South Carolina" and the ISO code for
//     Seychelles. Only a field that is exactly "SC" counts.
//   • the bare words "security" or "council" on their own. "security" alone would
//     fire on DISEC ("Disarmament and International Security Committee") and on
//     "International Security"; "council" alone would fire on ECOSOC, the Human
//     Rights Council and the European Council — none of which have a P5.
//   • "national security council" / "nsc" — a crisis cabinet, not the UNSC. It has
//     no permanent members and must never silently gain a veto, so it is an
//     explicit negative guard checked BEFORE the "security council" phrase.
export function isSecurityCouncil(name?: string | null, abbreviation?: string | null): boolean {
  // Strip Latin AND Arabic combining marks so "sécurité" → "securite" and
  // "الأمن" → "الامن". Deliberately not using \p{...} escapes — tsconfig targets
  // ES2017, which predates unicode property escapes.
  const deaccent = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f\u064B-\u0655\u0670]/g, '').toLowerCase();

  const rawName = (name ?? '').trim();
  const rawAbbr = (abbreviation ?? '').trim();
  if (!rawName && !rawAbbr) return false;

  // `raw` keeps non-Latin scripts (for the Arabic phrase); `latin` is the
  // ASCII-token view used for word-boundary matching.
  const raw = deaccent(`${rawName} ${rawAbbr}`);
  const latin = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  const nameOnly = deaccent(rawName).replace(/[^a-z0-9]+/g, ' ').trim();
  const abbrOnly = deaccent(rawAbbr).replace(/[^a-z0-9]+/g, ' ').trim();

  // Negative guard first — a National Security Council is a crisis cabinet.
  if (latin.includes('national security council')) return false;

  if (abbrOnly === 'sc' || nameOnly === 'sc') return true;
  if (/\b(unsc|hsc)\b/.test(latin)) return true;
  if (latin.includes('security council')) return true;
  if (latin.includes('conseil de securite')) return true;
  if (latin.includes('consejo de seguridad')) return true;
  if (raw.includes('مجلس الامن')) return true;
  return false;
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
