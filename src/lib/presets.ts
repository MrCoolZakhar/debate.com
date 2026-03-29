// Current UNSC members (2026) — P5 + 10 elected
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
  'Japan',
  'Malta',
  'Mozambique',
  'Ecuador',
  'South Africa',
];

// All 193 UN member states
export const GA_MEMBERS = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',"Côte d'Ivoire",
  'Croatia','Cuba','Cyprus','Czech Republic','DR Congo','Denmark','Djibouti',
  'Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea',
  'Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
  'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea',
  'Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand',
  'Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman',
  'Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru',
  'Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa',
  'South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden',
  'Switzerland','Syria','São Tomé and Príncipe','Tajikistan','Tanzania','Thailand',
  'Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey',
  'Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
];

export interface CommitteePreset {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  defaultName: string;
  members: string[] | null; // null = custom
}

export const PRESETS: CommitteePreset[] = [
  {
    id: 'unsc',
    label: 'Security Council',
    subtitle: '15 members · Updated 2026',
    icon: '🛡️',
    defaultName: 'UN Security Council',
    members: UNSC_MEMBERS,
  },
  {
    id: 'ga',
    label: 'General Assembly',
    subtitle: '193 member states',
    icon: '🌍',
    defaultName: 'UN General Assembly',
    members: GA_MEMBERS,
  },
  {
    id: 'custom',
    label: 'Custom Committee',
    subtitle: 'Build your own',
    icon: '✏️',
    defaultName: '',
    members: null,
  },
];
