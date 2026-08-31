export const WHO_MEMBERS: string[] = [];

export const IMF_MEMBERS: string[] = [];

export const WORLD_BANK_MEMBERS: string[] = [];

export const UNEP_MEMBERS: string[] = [];

// ── New shared committee presets ─────────────────────────────────────────────
// Two flavours of roster live here:
//   • COUNTRY-based rosters use real country names that resolve via
//     src/lib/countries.ts (getCountryByName / flags). e.g. FIFA, European
//     Parliament, and the existing UNSC/UNGA lists.
//   • ROLE / CHARACTER-based rosters use free-text slot names (judges, cabinet
//     posts, press outlets). These do NOT resolve to a flag — the editor treats
//     them as named seats. Exported with a *_ROLES suffix to signal that.
// Every entry here is consumed by the two editor UIs (create/page COMMITTEE_PRESETS
// and ConferenceRosterPicker CONFERENCE_COMMITTEE_PRESETS) in the next wave.

// ICC — International Criminal Court. ROLE-based: bench of judges + the
// advocacies (prosecution, defence, victims, amicus, registry). ~14 seats.
export const ICC_ROLES: string[] = [
  'Presiding Judge',
  'Judge (First Vice-President)',
  'Judge (Second Vice-President)',
  'Judge — Pre-Trial Division',
  'Judge — Trial Division',
  'Judge — Appeals Division',
  'Judge — Appeals Division',
  'Judge — Trial Division',
  'Prosecutor (Office of the Prosecutor)',
  'Deputy Prosecutor',
  'Defence Counsel',
  'Legal Representative of Victims',
  'Amicus Curiae',
  'Registrar',
];

// ICJ — International Court of Justice. ROLE-based: the 15 justices of the Court
// (President, Vice-President, 13 members) plus the agents/counsel for the two
// parties and the Registrar. 20 seats.
export const ICJ_ROLES: string[] = [
  'President of the Court',
  'Vice-President of the Court',
  'Judge (I)',
  'Judge (II)',
  'Judge (III)',
  'Judge (IV)',
  'Judge (V)',
  'Judge (VI)',
  'Judge (VII)',
  'Judge (VIII)',
  'Judge (IX)',
  'Judge (X)',
  'Judge (XI)',
  'Judge (XII)',
  'Judge (XIII)',
  'Agent for the Applicant State',
  'Counsel for the Applicant State',
  'Agent for the Respondent State',
  'Counsel for the Respondent State',
  'Registrar',
];

// Crisis — generic crisis committee. No fixed roster: crisis committees are
// populated with free-text characters at setup time. Intentionally empty.
export const CRISIS_MEMBERS: string[] = [];

// FIFA — COUNTRY/association-based. A representative slate of ~48 FIFA member
// associations. All names resolve in src/lib/countries.ts (England/Scotland/
// Wales collapse to United Kingdom, which does resolve).
export const FIFA_MEMBERS: string[] = [
  'Argentina', 'Brazil', 'France', 'Germany', 'Spain', 'Italy', 'United Kingdom',
  'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia', 'Mexico',
  'United States', 'Canada', 'Costa Rica', 'Panama', 'Japan', 'South Korea',
  'Australia', 'Iran', 'Saudi Arabia', 'Qatar', 'Senegal', 'Morocco', 'Nigeria',
  'Ghana', 'Cameroon', 'Egypt', 'Algeria', 'Tunisia', "Côte d'Ivoire",
  'Ecuador', 'Chile', 'Peru', 'Paraguay', 'Denmark', 'Sweden', 'Norway',
  'Switzerland', 'Austria', 'Poland', 'Serbia', 'Ukraine', 'Russia', 'Türkiye', 'Greece',
];

// House of Commons — ROLE/character-based: UK front- and back-bench posts plus
// the leaders of the major parties. ~20 seats.
export const HOUSE_OF_COMMONS_ROLES: string[] = [
  'Prime Minister',
  'Deputy Prime Minister',
  'Chancellor of the Exchequer',
  'Foreign Secretary',
  'Home Secretary',
  'Leader of the House of Commons',
  'Government Chief Whip',
  'Leader of the Opposition',
  'Shadow Chancellor',
  'Shadow Foreign Secretary',
  'Shadow Home Secretary',
  'Opposition Chief Whip',
  'Leader of the Liberal Democrats',
  'Leader of the Scottish National Party',
  'Leader of Reform UK',
  'Leader of the Green Party',
  'Speaker of the House',
  'Father of the House',
  'Government Backbencher',
  'Opposition Backbencher',
];

// US Senate — CHOICE: state seats. We model the chamber as one seat per state
// (50 real US state names as slot names), which reads cleanest for MUN — a full
// map of the chamber without doubling every state. (The alternative, a
// leadership roster of ~10 posts, loses the geographic spread.) These are
// free-text slot names, NOT countries, so they do not resolve to a flag.
export const US_SENATE_MEMBERS: string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// Press — ROLE-based international press corps: wire services, broadcasters and
// papers of record, plus specialist correspondents. ~16 seats.
export const PRESS_ROLES: string[] = [
  'Reuters',
  'Associated Press',
  'Agence France-Presse',
  'BBC News',
  'CNN',
  'Al Jazeera',
  'The New York Times',
  'The Guardian',
  'Le Monde',
  'Der Spiegel',
  'Xinhua News Agency',
  'The Economist',
  'Photojournalist',
  'Editorial Cartoonist',
  'Broadcast Anchor',
  'Press Corps Editor',
];

// European Parliament — COUNTRY-based: the 27 EU member states. All resolve in
// src/lib/countries.ts.
export const EUROPEAN_PARLIAMENT_MEMBERS: string[] = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
  'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta',
  'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden',
];

// Current UNSC members (June 2026) — P5 + 10 elected
export const UNSC_MEMBERS = [
  'United States',
  'United Kingdom',
  'France',
  'China',
  'Russia',
  // Elected 2025–2026
  'Denmark',
  'Greece',
  'Pakistan',
  'Panama',
  'Somalia',
  // Elected 2026–2027
  'Bahrain',
  'Colombia',
  'DR Congo',
  'Latvia',
  'Liberia',
];
