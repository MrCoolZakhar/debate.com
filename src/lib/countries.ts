export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2
}

export function getFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

// Twemoji CDN — renders identically on Windows, Mac, Linux, Android.
// Input: ISO 3166-1 alpha-2 country code e.g. 'GB', 'US', 'DE'
// Output: URL to a 72×72 PNG on jsDelivr's Twemoji mirror.
export function getFlagUrl(code: string): string {
  const points = code
    .toUpperCase()
    .split('')
    .map((c) => (c.codePointAt(0)! + 0x1F1A5).toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${points}.svg`;
}

// Twemoji URL for arbitrary non-flag emojis by their Unicode codepoint hex string.
// e.g. getTwemojiUrl('1f3a4') for 🎙, getTwemojiUrl('1f3c1') for 🏁
export function getTwemojiUrl(codepoint: string): string {
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`;
}

export const UN_COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF' },
  { name: 'Albania', code: 'AL' },
  { name: 'Algeria', code: 'DZ' },
  { name: 'Andorra', code: 'AD' },
  { name: 'Angola', code: 'AO' },
  { name: 'Antigua and Barbuda', code: 'AG' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Armenia', code: 'AM' },
  { name: 'Australia', code: 'AU' },
  { name: 'Austria', code: 'AT' },
  { name: 'Azerbaijan', code: 'AZ' },
  { name: 'Bahamas', code: 'BS' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Bangladesh', code: 'BD' },
  { name: 'Barbados', code: 'BB' },
  { name: 'Belarus', code: 'BY' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Belize', code: 'BZ' },
  { name: 'Benin', code: 'BJ' },
  { name: 'Bhutan', code: 'BT' },
  { name: 'Bolivia', code: 'BO' },
  { name: 'Bosnia and Herzegovina', code: 'BA' },
  { name: 'Botswana', code: 'BW' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Brunei', code: 'BN' },
  { name: 'Bulgaria', code: 'BG' },
  { name: 'Burkina Faso', code: 'BF' },
  { name: 'Burundi', code: 'BI' },
  { name: 'Cabo Verde', code: 'CV' },
  { name: 'Cambodia', code: 'KH' },
  { name: 'Cameroon', code: 'CM' },
  { name: 'Canada', code: 'CA' },
  { name: 'Central African Republic', code: 'CF' },
  { name: 'Chad', code: 'TD' },
  { name: 'Chile', code: 'CL' },
  { name: 'China', code: 'CN' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Comoros', code: 'KM' },
  { name: 'Congo', code: 'CG' },
  { name: 'Cook Islands', code: 'CK' },
  { name: 'Costa Rica', code: 'CR' },
  { name: "Côte d'Ivoire", code: 'CI' },
  { name: 'Croatia', code: 'HR' },
  { name: 'Cuba', code: 'CU' },
  { name: 'Cyprus', code: 'CY' },
  { name: 'Czech Republic', code: 'CZ' },
  { name: 'DR Congo', code: 'CD' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Djibouti', code: 'DJ' },
  { name: 'Dominica', code: 'DM' },
  { name: 'Dominican Republic', code: 'DO' },
  { name: 'Ecuador', code: 'EC' },
  { name: 'Egypt', code: 'EG' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'Equatorial Guinea', code: 'GQ' },
  { name: 'Eritrea', code: 'ER' },
  { name: 'Estonia', code: 'EE' },
  { name: 'Eswatini', code: 'SZ' },
  { name: 'Ethiopia', code: 'ET' },
  { name: 'Fiji', code: 'FJ' },
  { name: 'Finland', code: 'FI' },
  { name: 'France', code: 'FR' },
  { name: 'Gabon', code: 'GA' },
  { name: 'Gambia', code: 'GM' },
  { name: 'Georgia', code: 'GE' },
  { name: 'Germany', code: 'DE' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Greece', code: 'GR' },
  { name: 'Grenada', code: 'GD' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'Guinea', code: 'GN' },
  { name: 'Guinea-Bissau', code: 'GW' },
  { name: 'Guyana', code: 'GY' },
  { name: 'Haiti', code: 'HT' },
  { name: 'Holy See', code: 'VA' },
  { name: 'Honduras', code: 'HN' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Iceland', code: 'IS' },
  { name: 'India', code: 'IN' },
  { name: 'Indonesia', code: 'ID' },
  { name: 'Iran', code: 'IR' },
  { name: 'Iraq', code: 'IQ' },
  { name: 'Ireland', code: 'IE' },
  { name: 'Israel', code: 'IL' },
  { name: 'Italy', code: 'IT' },
  { name: 'Jamaica', code: 'JM' },
  { name: 'Japan', code: 'JP' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kazakhstan', code: 'KZ' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Kiribati', code: 'KI' },
  { name: 'Kosovo', code: 'XK' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Kyrgyzstan', code: 'KG' },
  { name: 'Laos', code: 'LA' },
  { name: 'Latvia', code: 'LV' },
  { name: 'Lebanon', code: 'LB' },
  { name: 'Lesotho', code: 'LS' },
  { name: 'Liberia', code: 'LR' },
  { name: 'Libya', code: 'LY' },
  { name: 'Liechtenstein', code: 'LI' },
  { name: 'Lithuania', code: 'LT' },
  { name: 'Luxembourg', code: 'LU' },
  { name: 'Madagascar', code: 'MG' },
  { name: 'Malawi', code: 'MW' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Maldives', code: 'MV' },
  { name: 'Mali', code: 'ML' },
  { name: 'Malta', code: 'MT' },
  { name: 'Marshall Islands', code: 'MH' },
  { name: 'Mauritania', code: 'MR' },
  { name: 'Mauritius', code: 'MU' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Micronesia', code: 'FM' },
  { name: 'Moldova', code: 'MD' },
  { name: 'Monaco', code: 'MC' },
  { name: 'Mongolia', code: 'MN' },
  { name: 'Montenegro', code: 'ME' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Mozambique', code: 'MZ' },
  { name: 'Myanmar', code: 'MM' },
  { name: 'Namibia', code: 'NA' },
  { name: 'Nauru', code: 'NR' },
  { name: 'Nepal', code: 'NP' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'Nicaragua', code: 'NI' },
  { name: 'Niger', code: 'NE' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Niue', code: 'NU' },
  { name: 'North Korea', code: 'KP' },
  { name: 'North Macedonia', code: 'MK' },
  { name: 'Norway', code: 'NO' },
  { name: 'Oman', code: 'OM' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Palau', code: 'PW' },
  { name: 'Palestine', code: 'PS' },
  { name: 'Panama', code: 'PA' },
  { name: 'Papua New Guinea', code: 'PG' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Peru', code: 'PE' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Poland', code: 'PL' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Romania', code: 'RO' },
  { name: 'Russia', code: 'RU' },
  { name: 'Rwanda', code: 'RW' },
  { name: 'Saint Kitts and Nevis', code: 'KN' },
  { name: 'Saint Lucia', code: 'LC' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC' },
  { name: 'Samoa', code: 'WS' },
  { name: 'San Marino', code: 'SM' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Senegal', code: 'SN' },
  { name: 'Serbia', code: 'RS' },
  { name: 'Seychelles', code: 'SC' },
  { name: 'Sierra Leone', code: 'SL' },
  { name: 'Singapore', code: 'SG' },
  { name: 'Slovakia', code: 'SK' },
  { name: 'Slovenia', code: 'SI' },
  { name: 'Solomon Islands', code: 'SB' },
  { name: 'Somalia', code: 'SO' },
  { name: 'South Africa', code: 'ZA' },
  { name: 'South Korea', code: 'KR' },
  { name: 'South Sudan', code: 'SS' },
  { name: 'Spain', code: 'ES' },
  { name: 'Sri Lanka', code: 'LK' },
  { name: 'Sudan', code: 'SD' },
  { name: 'Suriname', code: 'SR' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Syria', code: 'SY' },
  { name: 'São Tomé and Príncipe', code: 'ST' },
  { name: 'Taiwan', code: 'TW' },
  { name: 'Tajikistan', code: 'TJ' },
  { name: 'Tanzania', code: 'TZ' },
  { name: 'Thailand', code: 'TH' },
  { name: 'Timor-Leste', code: 'TL' },
  { name: 'Togo', code: 'TG' },
  { name: 'Tonga', code: 'TO' },
  { name: 'Trinidad and Tobago', code: 'TT' },
  { name: 'Tunisia', code: 'TN' },
  { name: 'Turkey', code: 'TR' },
  { name: 'Turkmenistan', code: 'TM' },
  { name: 'Tuvalu', code: 'TV' },
  { name: 'Uganda', code: 'UG' },
  { name: 'Ukraine', code: 'UA' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' },
  { name: 'Uruguay', code: 'UY' },
  { name: 'Uzbekistan', code: 'UZ' },
  { name: 'Vanuatu', code: 'VU' },
  { name: 'Venezuela', code: 'VE' },
  { name: 'Vietnam', code: 'VN' },
  { name: 'Yemen', code: 'YE' },
  { name: 'Zambia', code: 'ZM' },
  { name: 'Zimbabwe', code: 'ZW' },
  { name: 'European Union', code: 'EU' },
];

export function getCountryByName(name: string): Country | undefined {
  return UN_COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export const COUNTRY_NAMES_ES: Record<string, string> = {
  AF: 'Afganistán', AL: 'Albania', DZ: 'Argelia', AD: 'Andorra', AO: 'Angola',
  AG: 'Antigua y Barbuda', AR: 'Argentina', AM: 'Armenia', AU: 'Australia',
  AT: 'Austria', AZ: 'Azerbaiyán', BS: 'Bahamas', BH: 'Baréin', BD: 'Bangladesh',
  BB: 'Barbados', BY: 'Bielorrusia', BE: 'Bélgica', BZ: 'Belice', BJ: 'Benín',
  BT: 'Bután', BO: 'Bolivia', BA: 'Bosnia y Herzegovina', BW: 'Botsuana',
  BR: 'Brasil', BN: 'Brunéi', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cabo Verde', KH: 'Camboya', CM: 'Camerún', CA: 'Canadá', CF: 'República Centroafricana',
  TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoras',
  CG: 'Congo', CD: 'República Democrática del Congo', CR: 'Costa Rica',
  CI: 'Costa de Marfil', HR: 'Croacia', CU: 'Cuba', CY: 'Chipre',
  CZ: 'República Checa', DK: 'Dinamarca', DJ: 'Yibuti', DM: 'Dominica',
  DO: 'República Dominicana', EC: 'Ecuador', EG: 'Egipto', SV: 'El Salvador',
  GQ: 'Guinea Ecuatorial', ER: 'Eritrea', EE: 'Estonia', SZ: 'Suazilandia',
  ET: 'Etiopía', FJ: 'Fiyi', FI: 'Finlandia', FR: 'Francia', GA: 'Gabón',
  GM: 'Gambia', GE: 'Georgia', DE: 'Alemania', GH: 'Ghana', GR: 'Grecia',
  GD: 'Granada', GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bisáu',
  GY: 'Guyana', HT: 'Haití', HN: 'Honduras', HU: 'Hungría', IS: 'Islandia',
  IN: 'India', ID: 'Indonesia', IR: 'Irán', IQ: 'Irak', IE: 'Irlanda',
  IL: 'Israel', IT: 'Italia', JM: 'Jamaica', JP: 'Japón', JO: 'Jordania',
  KZ: 'Kazajistán', KE: 'Kenia', KI: 'Kiribati', KP: 'Corea del Norte',
  KR: 'Corea del Sur', KW: 'Kuwait', KG: 'Kirguistán', LA: 'Laos', LV: 'Letonia',
  LB: 'Líbano', LS: 'Lesoto', LR: 'Liberia', LY: 'Libia', LI: 'Liechtenstein',
  LT: 'Lituania', LU: 'Luxemburgo', MG: 'Madagascar', MW: 'Malaui',
  MY: 'Malasia', MV: 'Maldivas', ML: 'Malí', MT: 'Malta', MH: 'Islas Marshall',
  MR: 'Mauritania', MU: 'Mauricio', MX: 'México', FM: 'Micronesia',
  MD: 'Moldavia', MC: 'Mónaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Marruecos',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal',
  NL: 'Países Bajos', NZ: 'Nueva Zelanda', NI: 'Nicaragua', NE: 'Níger',
  NG: 'Nigeria', NO: 'Noruega', OM: 'Omán', PK: 'Pakistán', PW: 'Palaos',
  PA: 'Panamá', PG: 'Papúa Nueva Guinea', PY: 'Paraguay', PE: 'Perú',
  PH: 'Filipinas', PL: 'Polonia', PT: 'Portugal', QA: 'Catar', RO: 'Rumanía',
  RU: 'Rusia', RW: 'Ruanda', KN: 'San Cristóbal y Nieves', LC: 'Santa Lucía',
  VC: 'San Vicente y las Granadinas', WS: 'Samoa', SM: 'San Marino',
  ST: 'Santo Tomé y Príncipe', SA: 'Arabia Saudita', SN: 'Senegal', RS: 'Serbia',
  SC: 'Seychelles', SL: 'Sierra Leona', SG: 'Singapur', SK: 'Eslovaquia',
  SI: 'Eslovenia', SB: 'Islas Salomón', SO: 'Somalia', ZA: 'Sudáfrica',
  SS: 'Sudán del Sur', ES: 'España', LK: 'Sri Lanka', SD: 'Sudán',
  SR: 'Surinam', SE: 'Suecia', CH: 'Suiza', SY: 'Siria', TW: 'Taiwán',
  TJ: 'Tayikistán', TZ: 'Tanzania', TH: 'Tailandia', TL: 'Timor Oriental',
  TG: 'Togo', TO: 'Tonga', TT: 'Trinidad y Tobago', TN: 'Túnez', TR: 'Turquía',
  TM: 'Turkmenistán', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ucrania',
  AE: 'Emiratos Árabes Unidos', GB: 'Reino Unido', US: 'Estados Unidos',
  UY: 'Uruguay', UZ: 'Uzbekistán', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam',
  YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabue', EU: 'Unión Europea',
  // Non-UN-member / observer states
  PS: 'Palestina', VA: 'Santa Sede', XK: 'Kosovo', CK: 'Islas Cook', NU: 'Niue',
};

export const COUNTRY_NAMES_FR: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albanie', DZ: 'Algérie', AD: 'Andorre', AO: 'Angola',
  AG: 'Antigua-et-Barbuda', AR: 'Argentine', AM: 'Arménie', AU: 'Australie',
  AT: 'Autriche', AZ: 'Azerbaïdjan', BS: 'Bahamas', BH: 'Bahreïn', BD: 'Bangladesh',
  BB: 'Barbade', BY: 'Biélorussie', BE: 'Belgique', BZ: 'Belize', BJ: 'Bénin',
  BT: 'Bhoutan', BO: 'Bolivie', BA: 'Bosnie-Herzégovine', BW: 'Botswana',
  BR: 'Brésil', BN: 'Brunéi', BG: 'Bulgarie', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cap-Vert', KH: 'Cambodge', CM: 'Cameroun', CA: 'Canada', CF: 'République centrafricaine',
  TD: 'Tchad', CL: 'Chili', CN: 'Chine', CO: 'Colombie', KM: 'Comores',
  CG: 'Congo', CD: 'République démocratique du Congo', CR: 'Costa Rica',
  CI: "Côte d'Ivoire", HR: 'Croatie', CU: 'Cuba', CY: 'Chypre',
  CZ: 'République tchèque', DK: 'Danemark', DJ: 'Djibouti', DM: 'Dominique',
  DO: 'République dominicaine', EC: 'Équateur', EG: 'Égypte', SV: 'El Salvador',
  GQ: 'Guinée équatoriale', ER: 'Érythrée', EE: 'Estonie', SZ: 'Eswatini',
  ET: 'Éthiopie', FJ: 'Fidji', FI: 'Finlande', FR: 'France', GA: 'Gabon',
  GM: 'Gambie', GE: 'Géorgie', DE: 'Allemagne', GH: 'Ghana', GR: 'Grèce',
  GD: 'Grenade', GT: 'Guatemala', GN: 'Guinée', GW: 'Guinée-Bissau',
  GY: 'Guyana', HT: 'Haïti', HN: 'Honduras', HU: 'Hongrie', IS: 'Islande',
  IN: 'Inde', ID: 'Indonésie', IR: 'Iran', IQ: 'Irak', IE: 'Irlande',
  IL: 'Israël', IT: 'Italie', JM: 'Jamaïque', JP: 'Japon', JO: 'Jordanie',
  KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KP: 'Corée du Nord',
  KR: 'Corée du Sud', KW: 'Koweït', KG: 'Kirghizistan', LA: 'Laos', LV: 'Lettonie',
  LB: 'Liban', LS: 'Lesotho', LR: 'Libéria', LY: 'Libye', LI: 'Liechtenstein',
  LT: 'Lituanie', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaisie', MV: 'Maldives', ML: 'Mali', MT: 'Malte', MH: 'Îles Marshall',
  MR: 'Mauritanie', MU: 'Maurice', MX: 'Mexique', FM: 'Micronésie',
  MD: 'Moldavie', MC: 'Monaco', MN: 'Mongolie', ME: 'Monténégro', MA: 'Maroc',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibie', NR: 'Nauru', NP: 'Népal',
  NL: 'Pays-Bas', NZ: 'Nouvelle-Zélande', NI: 'Nicaragua', NE: 'Niger',
  NG: 'Nigéria', NO: 'Norvège', OM: 'Oman', PK: 'Pakistan', PW: 'Palaos',
  PA: 'Panama', PG: 'Papouasie-Nouvelle-Guinée', PY: 'Paraguay', PE: 'Pérou',
  PH: 'Philippines', PL: 'Pologne', PT: 'Portugal', QA: 'Qatar', RO: 'Roumanie',
  RU: 'Russie', RW: 'Rwanda', KN: 'Saint-Kitts-et-Nevis', LC: 'Sainte-Lucie',
  VC: 'Saint-Vincent-et-les-Grenadines', WS: 'Samoa', SM: 'Saint-Marin',
  ST: 'Sao Tomé-et-Principe', SA: 'Arabie saoudite', SN: 'Sénégal', RS: 'Serbie',
  SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapour', SK: 'Slovaquie',
  SI: 'Slovénie', SB: 'Îles Salomon', SO: 'Somalie', ZA: 'Afrique du Sud',
  SS: 'Soudan du Sud', ES: 'Espagne', LK: 'Sri Lanka', SD: 'Soudan',
  SR: 'Suriname', SE: 'Suède', CH: 'Suisse', SY: 'Syrie', TW: 'Taïwan',
  TJ: 'Tadjikistan', TZ: 'Tanzanie', TH: 'Thaïlande', TL: 'Timor oriental',
  TG: 'Togo', TO: 'Tonga', TT: 'Trinité-et-Tobago', TN: 'Tunisie', TR: 'Turquie',
  TM: 'Turkménistan', TV: 'Tuvalu', UG: 'Ouganda', UA: 'Ukraine',
  AE: 'Émirats arabes unis', GB: 'Royaume-Uni', US: 'États-Unis',
  UY: 'Uruguay', UZ: 'Ouzbékistan', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Viêt Nam',
  YE: 'Yémen', ZM: 'Zambie', ZW: 'Zimbabwe', EU: 'Union européenne',
  PS: 'Palestine', VA: 'Saint-Siège', XK: 'Kosovo', CK: 'Îles Cook', NU: 'Niue',
};

export const COUNTRY_NAMES_AR: Record<string, string> = {
  AF: 'أفغانستان', AL: 'ألبانيا', DZ: 'الجزائر', AD: 'أندورا', AO: 'أنغولا',
  AG: 'أنتيغوا وبربودا', AR: 'الأرجنتين', AM: 'أرمينيا', AU: 'أستراليا',
  AT: 'النمسا', AZ: 'أذربيجان', BS: 'الباهاما', BH: 'البحرين', BD: 'بنغلاديش',
  BB: 'بربادوس', BY: 'بيلاروسيا', BE: 'بلجيكا', BZ: 'بليز', BJ: 'بنين',
  BT: 'بوتان', BO: 'بوليفيا', BA: 'البوسنة والهرسك', BW: 'بوتسوانا',
  BR: 'البرازيل', BN: 'بروناي', BG: 'بلغاريا', BF: 'بوركينا فاسو', BI: 'بوروندي',
  CV: 'الرأس الأخضر', KH: 'كمبوديا', CM: 'الكاميرون', CA: 'كندا', CF: 'جمهورية أفريقيا الوسطى',
  TD: 'تشاد', CL: 'تشيلي', CN: 'الصين', CO: 'كولومبيا', KM: 'جزر القمر',
  CG: 'الكونغو', CD: 'جمهورية الكونغو الديمقراطية', CR: 'كوستاريكا',
  CI: 'ساحل العاج', HR: 'كرواتيا', CU: 'كوبا', CY: 'قبرص',
  CZ: 'جمهورية التشيك', DK: 'الدنمارك', DJ: 'جيبوتي', DM: 'دومينيكا',
  DO: 'جمهورية الدومينيكان', EC: 'الإكوادور', EG: 'مصر', SV: 'السلفادور',
  GQ: 'غينيا الاستوائية', ER: 'إريتريا', EE: 'إستونيا', SZ: 'إسواتيني',
  ET: 'إثيوبيا', FJ: 'فيجي', FI: 'فنلندا', FR: 'فرنسا', GA: 'الغابون',
  GM: 'غامبيا', GE: 'جورجيا', DE: 'ألمانيا', GH: 'غانا', GR: 'اليونان',
  GD: 'غرينادا', GT: 'غواتيمالا', GN: 'غينيا', GW: 'غينيا بيساو',
  GY: 'غيانا', HT: 'هايتي', HN: 'هندوراس', HU: 'المجر', IS: 'آيسلندا',
  IN: 'الهند', ID: 'إندونيسيا', IR: 'إيران', IQ: 'العراق', IE: 'أيرلندا',
  IL: 'إسرائيل', IT: 'إيطاليا', JM: 'جامايكا', JP: 'اليابان', JO: 'الأردن',
  KZ: 'كازاخستان', KE: 'كينيا', KI: 'كيريباتي', KP: 'كوريا الشمالية',
  KR: 'كوريا الجنوبية', KW: 'الكويت', KG: 'قيرغيزستان', LA: 'لاوس', LV: 'لاتفيا',
  LB: 'لبنان', LS: 'ليسوتو', LR: 'ليبيريا', LY: 'ليبيا', LI: 'ليختنشتاين',
  LT: 'ليتوانيا', LU: 'لوكسمبورغ', MG: 'مدغشقر', MW: 'مالاوي',
  MY: 'ماليزيا', MV: 'المالديف', ML: 'مالي', MT: 'مالطا', MH: 'جزر مارشال',
  MR: 'موريتانيا', MU: 'موريشيوس', MX: 'المكسيك', FM: 'ميكرونيزيا',
  MD: 'مولدوفا', MC: 'موناكو', MN: 'منغوليا', ME: 'الجبل الأسود', MA: 'المغرب',
  MZ: 'موزمبيق', MM: 'ميانمار', NA: 'ناميبيا', NR: 'ناورو', NP: 'نيبال',
  NL: 'هولندا', NZ: 'نيوزيلندا', NI: 'نيكاراغوا', NE: 'النيجر',
  NG: 'نيجيريا', NO: 'النرويج', OM: 'عُمان', PK: 'باكستان', PW: 'بالاو',
  PA: 'بنما', PG: 'بابوا غينيا الجديدة', PY: 'باراغواي', PE: 'بيرو',
  PH: 'الفلبين', PL: 'بولندا', PT: 'البرتغال', QA: 'قطر', RO: 'رومانيا',
  RU: 'روسيا', RW: 'رواندا', KN: 'سانت كيتس ونيفيس', LC: 'سانت لوسيا',
  VC: 'سانت فنسنت والغرينادين', WS: 'ساموا', SM: 'سان مارينو',
  ST: 'ساو تومي وبرينسيبي', SA: 'المملكة العربية السعودية', SN: 'السنغال', RS: 'صربيا',
  SC: 'سيشل', SL: 'سيراليون', SG: 'سنغافورة', SK: 'سلوفاكيا',
  SI: 'سلوفينيا', SB: 'جزر سليمان', SO: 'الصومال', ZA: 'جنوب أفريقيا',
  SS: 'جنوب السودان', ES: 'إسبانيا', LK: 'سريلانكا', SD: 'السودان',
  SR: 'سورينام', SE: 'السويد', CH: 'سويسرا', SY: 'سوريا', TW: 'تايوان',
  TJ: 'طاجيكستان', TZ: 'تنزانيا', TH: 'تايلاند', TL: 'تيمور الشرقية',
  TG: 'توغو', TO: 'تونغا', TT: 'ترينيداد وتوباغو', TN: 'تونس', TR: 'تركيا',
  TM: 'تركمانستان', TV: 'توفالو', UG: 'أوغندا', UA: 'أوكرانيا',
  AE: 'الإمارات العربية المتحدة', GB: 'المملكة المتحدة', US: 'الولايات المتحدة',
  UY: 'أوروغواي', UZ: 'أوزبكستان', VU: 'فانواتو', VE: 'فنزويلا', VN: 'فيتنام',
  YE: 'اليمن', ZM: 'زامبيا', ZW: 'زيمبابوي', EU: 'الاتحاد الأوروبي',
  // Non-UN-member / observer states
  PS: 'فلسطين', VA: 'الكرسي الرسولي', XK: 'كوسوفو', CK: 'جزر كوك', NU: 'نيوي',
};

export function getCountryDisplayName(name: string, language: string): string {
  if (language !== 'es' && language !== 'fr' && language !== 'ar') return name;
  if (language === 'ar') {
    if (name === 'African Union') return 'الاتحاد الأفريقي';
    const country = getCountryByName(name);
    if (!country) return name;
    const fromDict = COUNTRY_NAMES_AR[country.code];
    if (fromDict) return fromDict;
    try {
      const dn = new Intl.DisplayNames(['ar'], { type: 'region' });
      return dn.of(country.code) ?? name;
    } catch {
      return name;
    }
  }
  if (language === 'fr') {
    if (name === 'African Union') return 'Union africaine';
    const country = getCountryByName(name);
    if (!country) return name;
    const fromDict = COUNTRY_NAMES_FR[country.code];
    if (fromDict) return fromDict;
    try {
      const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
      return dn.of(country.code) ?? name;
    } catch {
      return name;
    }
  }
  if (name === 'African Union') return 'Unión Africana';
  const country = getCountryByName(name);
  if (!country) return name;
  const fromDict = COUNTRY_NAMES_ES[country.code];
  if (fromDict) return fromDict;
  try {
    const dn = new Intl.DisplayNames(['es'], { type: 'region' });
    return dn.of(country.code) ?? name;
  } catch {
    return name;
  }
}

// Accent/diacritic-insensitive, language-aware comparator on DISPLAY names
export function compareCountryNames(a: string, b: string, language: string): number {
  return getCountryDisplayName(a, language).localeCompare(
    getCountryDisplayName(b, language), language, { sensitivity: 'base' });
}

// Fold accents + lowercase for matching
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Match a free-text token to a country across EN + ES + FR names, accent-insensitive
export function findCountryFlexible(input: string): string | null {
  const n = fold(input);
  if (!n) return null;
  // exact across EN names
  let hit = UN_COUNTRIES.find((c) => fold(c.name) === n);
  if (hit) return hit.name;
  // exact across ES/FR dictionaries (value match → map code back to EN canonical name)
  for (const dict of [COUNTRY_NAMES_ES, COUNTRY_NAMES_FR]) {
    const codeEntry = Object.entries(dict).find(([, v]) => fold(v) === n);
    if (codeEntry) { const c = UN_COUNTRIES.find((u) => u.code === codeEntry[0]); if (c) return c.name; }
  }
  // startsWith / includes fallback on EN names
  hit = UN_COUNTRIES.find((c) => fold(c.name).startsWith(n)) ?? UN_COUNTRIES.find((c) => fold(c.name).includes(n) || n.includes(fold(c.name)));
  return hit ? hit.name : null;
}

export function matchesSearch(c: Country, search: string, language: string): boolean {
  const s = search.toLowerCase();
  if (c.name.toLowerCase().includes(s)) return true;
  if (language !== 'en') {
    const localName = getCountryDisplayName(c.name, language).toLowerCase();
    if (localName.includes(s)) return true;
  }
  return false;
}

export function matchesCountryQuery(enName: string, query: string, language: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (enName.trim().toLowerCase().includes(q)) return true;
  const displayName = getCountryDisplayName(enName, language).toLowerCase();
  if (displayName.includes(q)) return true;
  return false;
}

export function startsWithCountryQuery(enName: string, query: string, language: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (enName.trim().toLowerCase().startsWith(q)) return true;
  const displayName = getCountryDisplayName(enName, language).toLowerCase();
  if (displayName.startsWith(q)) return true;
  return false;
}

// ── Continents ───────────────────────────────────────────────────────────────
// Follows the UN M49 geoscheme for the handful of transcontinental cases
// (Russia → Europe, Turkey/Georgia/Armenia/Azerbaijan/Cyprus → Asia).

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';

export const COUNTRY_CONTINENTS: Record<string, Continent> = {
  // Africa
  DZ: 'Africa', AO: 'Africa', BJ: 'Africa', BW: 'Africa', BF: 'Africa', BI: 'Africa',
  CV: 'Africa', CM: 'Africa', CF: 'Africa', TD: 'Africa', KM: 'Africa', CG: 'Africa',
  CD: 'Africa', CI: 'Africa', DJ: 'Africa', EG: 'Africa', GQ: 'Africa', ER: 'Africa',
  SZ: 'Africa', ET: 'Africa', GA: 'Africa', GM: 'Africa', GH: 'Africa', GN: 'Africa',
  GW: 'Africa', KE: 'Africa', LS: 'Africa', LR: 'Africa', LY: 'Africa', MG: 'Africa',
  MW: 'Africa', ML: 'Africa', MR: 'Africa', MU: 'Africa', MA: 'Africa', MZ: 'Africa',
  NA: 'Africa', NE: 'Africa', NG: 'Africa', RW: 'Africa', ST: 'Africa', SN: 'Africa',
  SC: 'Africa', SL: 'Africa', SO: 'Africa', ZA: 'Africa', SS: 'Africa', SD: 'Africa',
  TZ: 'Africa', TG: 'Africa', TN: 'Africa', UG: 'Africa', ZM: 'Africa', ZW: 'Africa',

  // Asia
  AF: 'Asia', AM: 'Asia', AZ: 'Asia', BH: 'Asia', BD: 'Asia', BT: 'Asia', BN: 'Asia',
  KH: 'Asia', CN: 'Asia', CY: 'Asia', GE: 'Asia', IN: 'Asia', ID: 'Asia', IR: 'Asia',
  IQ: 'Asia', IL: 'Asia', JP: 'Asia', JO: 'Asia', KZ: 'Asia', KW: 'Asia', KG: 'Asia',
  LA: 'Asia', LB: 'Asia', MY: 'Asia', MV: 'Asia', MN: 'Asia', MM: 'Asia', NP: 'Asia',
  KP: 'Asia', OM: 'Asia', PK: 'Asia', PS: 'Asia', PH: 'Asia', QA: 'Asia', SA: 'Asia',
  SG: 'Asia', KR: 'Asia', LK: 'Asia', SY: 'Asia', TW: 'Asia', TJ: 'Asia', TH: 'Asia',
  TL: 'Asia', TR: 'Asia', TM: 'Asia', AE: 'Asia', UZ: 'Asia', VN: 'Asia', YE: 'Asia',

  // Europe
  AL: 'Europe', AD: 'Europe', AT: 'Europe', BY: 'Europe', BE: 'Europe', BA: 'Europe',
  BG: 'Europe', HR: 'Europe', CZ: 'Europe', DK: 'Europe', EE: 'Europe', FI: 'Europe',
  FR: 'Europe', DE: 'Europe', GR: 'Europe', VA: 'Europe', HU: 'Europe', IS: 'Europe',
  IE: 'Europe', IT: 'Europe', XK: 'Europe', LV: 'Europe', LI: 'Europe', LT: 'Europe',
  LU: 'Europe', MT: 'Europe', MD: 'Europe', MC: 'Europe', ME: 'Europe', NL: 'Europe',
  MK: 'Europe', NO: 'Europe', PL: 'Europe', PT: 'Europe', RO: 'Europe', RU: 'Europe',
  SM: 'Europe', RS: 'Europe', SK: 'Europe', SI: 'Europe', ES: 'Europe', SE: 'Europe',
  CH: 'Europe', UA: 'Europe', GB: 'Europe', EU: 'Europe',

  // North America (incl. Central America + Caribbean)
  AG: 'North America', BS: 'North America', BB: 'North America', BZ: 'North America',
  CA: 'North America', CR: 'North America', CU: 'North America', DM: 'North America',
  DO: 'North America', SV: 'North America', GD: 'North America', GT: 'North America',
  HT: 'North America', HN: 'North America', JM: 'North America', MX: 'North America',
  NI: 'North America', PA: 'North America', KN: 'North America', LC: 'North America',
  VC: 'North America', TT: 'North America', US: 'North America',

  // South America
  AR: 'South America', BO: 'South America', BR: 'South America', CL: 'South America',
  CO: 'South America', EC: 'South America', GY: 'South America', PY: 'South America',
  PE: 'South America', SR: 'South America', UY: 'South America', VE: 'South America',

  // Oceania
  AU: 'Oceania', CK: 'Oceania', FJ: 'Oceania', KI: 'Oceania', MH: 'Oceania',
  FM: 'Oceania', NR: 'Oceania', NZ: 'Oceania', NU: 'Oceania', PW: 'Oceania',
  PG: 'Oceania', WS: 'Oceania', SB: 'Oceania', TO: 'Oceania', TV: 'Oceania', VU: 'Oceania',
};

export function countryToContinent(name: string): Continent | null {
  const country = getCountryByName(name);
  if (!country) return null;
  return COUNTRY_CONTINENTS[country.code] ?? null;
}
