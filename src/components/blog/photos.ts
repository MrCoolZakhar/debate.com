/**
 * The photographs on /blog: one table, every file, every licence.
 *
 * WHY THESE AND NO OTHERS. Every photo here is free to use commercially, and
 * that was checked on the file's own Wikimedia Commons page (the licence
 * template and, for Flickr imports, Commons' licence review), never guessed:
 *
 *   CC BY / CC BY-SA   credit the author and link the licence, next to the photo
 *   CC0 / public domain  no credit required; we credit anyway, it costs nothing
 *                        (US federal works: the State Department, US Missions)
 *
 * Nothing from UN Photo's own library, stock agencies, or any Model UN
 * platform, and nothing associated with MyMUN. Conference photos are ones the
 * photographer or the conference itself released under an open licence.
 *
 * CC BY-SA: the files in public/blog/photos are resized, cropped WebP copies
 * (1200 x 750), i.e. adaptations. They stay under the same licence as the
 * original, which the credit line says; that obligation covers the image file,
 * not the page it sits on.
 *
 * TO REMOVE A PHOTO: delete its entry here and its file. Posts that pointed at
 * it fall back to the drawn cover (`photoFor` returns undefined), so nothing
 * breaks. TO ADD ONE: put a 1200 x 750 WebP in public/blog/photos and an entry
 * here with its source page and licence, then name it in a post's `photo`.
 */

export type PhotoId =
  | 'un-general-assembly'
  | 'un-general-assembly-floor'
  | 'un-security-council'
  | 'un-security-council-before-debate'
  | 'un-security-council-nameplates'
  | 'un-security-council-huddle'
  | 'un-security-council-high-level'
  | 'un-ecosoc-chamber'
  | 'un-trusteeship-chamber'
  | 'un-hrc-panels'
  | 'un-hrc-session'
  | 'un-geneva-assembly-hall'
  | 'un-geneva-press-conference'
  | 'mun-vienna-committee'
  | 'mun-vienna-dais'
  | 'mun-bratislava-vote'
  | 'mun-scimun-placards'
  | 'mun-taipei-placards'
  | 'mun-model-security-council'
  | 'mun-delegate-notes'
  | 'mun-thessaloniki-council'
  | 'mun-beijing-disec'
  | 'mun-general-assembly-hemicycle'
  | 'mun-unmoderated-caucus'
  | 'mun-jakarta-council'
  | 'mun-chairs-dais'
  | 'mun-best-delegation-award'
  | 'mun-award-plaques'
  | 'mun-keynote-podium'
  | 'mun-geneva-students'
  | 'mun-athens-delegation'
  | 'mun-research-workshop'
  | 'youth-parliament-speaker'
  | 'youth-parliament-chamber'
  | 'venue-banquet-hall'
  | 'hybrid-meeting';

export interface BlogPhoto {
  /** Site-relative path to the self-hosted WebP. */
  src: string;
  /** What is actually in the picture. */
  alt: string;
  /** Photographer or rights holder, as the source names them. */
  author: string;
  /** Licence short name, as on the source page. */
  license: string;
  licenseUrl: string;
  /** False only for public domain / CC0. We show a credit either way. */
  attributionRequired: boolean;
  /** The file's page on Wikimedia Commons (licence and original). */
  source: string;
}

/** Every file is cropped to the cover ratio, 1200 x 750 (16:10). */
export const PHOTO_WIDTH = 1200;
export const PHOTO_HEIGHT = 750;

export const PHOTOS: Record<PhotoId, BlogPhoto> = {
  'un-general-assembly': {
    src: '/blog/photos/un-general-assembly.webp',
    alt: 'The United Nations General Assembly Hall in New York, seen from the back of the hall, with rows of delegation desks facing the podium and the UN emblem',
    author: 'Spiff',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Panorama_of_the_United_Nations_General_Assembly,_Oct_2012.jpg',
  },
  'un-general-assembly-floor': {
    src: '/blog/photos/un-general-assembly-floor.webp',
    alt: 'Rows of empty delegation desks on the floor of the UN General Assembly Hall, facing the gold wall and UN emblem behind the podium',
    author: 'Rob Young',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:The_General_Assembly,_United_Nations_(926057573).jpg',
  },
  'un-security-council': {
    src: '/blog/photos/un-security-council.webp',
    alt: 'A meeting of the UN Security Council in New York: ambassadors seated around the horseshoe table with advisers behind them',
    author: 'Astrid Riecken for CTBTO',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:23_September_2016_Security_Council_Meeting_at_United_Nations_(29312905594).jpg',
  },
  'un-security-council-before-debate': {
    src: '/blog/photos/un-security-council-before-debate.webp',
    alt: 'Diplomats standing and talking in the UN Security Council chamber before a meeting begins',
    author: 'Astrid Riecken for CTBTO',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:23_September_2016_Security_Council_Meeting_at_United_Nations_(29825904712).jpg',
  },
  'un-security-council-nameplates': {
    src: '/blog/photos/un-security-council-nameplates.webp',
    alt: 'Nameplates for Turkey and the Russian Federation on the curved table of the UN Security Council chamber',
    author: 'Matthew from London',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Inside_the_UN_Security_Council_(5881618621).jpg',
  },
  'un-security-council-huddle': {
    src: '/blog/photos/un-security-council-huddle.webp',
    alt: 'The British and United States ambassadors confer with their teams at their seats in the UN Security Council after a vote',
    author: 'UKinUSA (UK Mission to the UN)',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Nikki_Haley_%26_Karen_Pierce_at_the_UN_Security_Council_(52137111850).jpg',
  },
  'un-security-council-high-level': {
    src: '/blog/photos/un-security-council-high-level.webp',
    alt: 'A high-level meeting of the UN Security Council, seen from the gallery, with the chamber mural behind the horseshoe table',
    author: 'Chuck Kennedy, U.S. Department of State',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Template:PD-USGov',
    attributionRequired: false,
    source: 'https://commons.wikimedia.org/wiki/File:Secretary_Blinken_Chairs_a_UN_Security_Council_High-Level_Meeting_-_53093470971.jpg',
  },
  'un-ecosoc-chamber': {
    src: '/blog/photos/un-ecosoc-chamber.webp',
    alt: 'The UN Economic and Social Council chamber in New York, with tiered delegation seating around a central table',
    author: 'Patrick Gruban',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:UN_Economic_and_Social_Council.jpg',
  },
  'un-trusteeship-chamber': {
    src: '/blog/photos/un-trusteeship-chamber.webp',
    alt: 'The UN Trusteeship Council chamber in New York: a horseshoe table in the middle of curved rows of seats, with a wooden statue at the end of the room',
    author: 'MusikAnimal',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:United_Nations_Trusteeship_Council_chamber_in_New_York_City.JPG',
  },
  'un-hrc-panels': {
    src: '/blog/photos/un-hrc-panels.webp',
    alt: 'Delegates at the UN Human Rights Council in Geneva holding up their country name panels to ask for the floor',
    author: 'Eric Bridiers, U.S. Mission Geneva',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:HRC_Delegations_Raise_Panels_to_Request_the_Floor_at_Interactive_Dialogue_with_High_Commissioner_Pillay_(2).jpg',
  },
  'un-hrc-session': {
    src: '/blog/photos/un-hrc-session.webp',
    alt: 'A full session of the UN Human Rights Council in Geneva, delegations seated in curved rows of desks',
    author: 'U.S. Mission Geneva',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:HRC_Special_Session_on_Syria_-_August_22._2011.jpg',
  },
  'un-geneva-assembly-hall': {
    src: '/blog/photos/un-geneva-assembly-hall.webp',
    alt: 'The Assembly Hall of the Palais des Nations in Geneva, seen from a delegate\'s desk, with long rows of desks facing the stage',
    author: 'Nick-D',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Assembly_Hall_at_the_Palais_des_Nations_in_June_2016.jpg',
  },
  'un-geneva-press-conference': {
    src: '/blog/photos/un-geneva-press-conference.webp',
    alt: 'Journalists seated at a press conference in a meeting room at the United Nations in Geneva, with a speaker at a table at the front',
    author: 'U.S. Department of State',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Template:PD-USGov',
    attributionRequired: false,
    source: 'https://commons.wikimedia.org/wiki/File:Secretary_Kerry_Holds_News_Conference_Following_Address_to_UN_Human_Rights_Council_in_Switzerland_(16506620090).jpg',
  },
  'mun-vienna-committee': {
    src: '/blog/photos/mun-vienna-committee.webp',
    alt: 'University students debating at the Vienna International Model United Nations, seated behind microphones and country placards',
    author: 'Dean Calma, IAEA',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:0131o3_(4862868780).jpg',
  },
  'mun-vienna-dais': {
    src: '/blog/photos/mun-vienna-dais.webp',
    alt: 'The dais of a committee at the Vienna International Model United Nations: three men in suits seated behind a long table with microphones',
    author: 'Dean Calma, IAEA',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:0131o4_(4862252009).jpg',
  },
  'mun-bratislava-vote': {
    src: '/blog/photos/mun-bratislava-vote.webp',
    alt: 'Delegates at Bratislava Model United Nations raising their country placards during a committee vote',
    author: 'Tahamct',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Bratmun_Committee_sessions_3.png',
  },
  'mun-scimun-placards': {
    src: '/blog/photos/mun-scimun-placards.webp',
    alt: 'Delegates raising white country placards to vote in the Disarmament Committee of the Southern China International Model United Nations',
    author: 'Scimun',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:DC-SCIMUN.jpg',
  },
  'mun-taipei-placards': {
    src: '/blog/photos/mun-taipei-placards.webp',
    alt: 'Students at a Model United Nations conference at National Chengchi University in Taipei holding up large country placards',
    author: 'Office of the President, Taiwan',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Taipei_Model_United_Nations_in_NCCU_02.jpg',
  },
  'mun-model-security-council': {
    src: '/blog/photos/mun-model-security-council.webp',
    alt: 'A model Security Council in session, delegates seated around a large table behind small flags and nameplates',
    author: 'Gejdiv',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Model_OSN.jpg',
  },
  'mun-delegate-notes': {
    src: '/blog/photos/mun-delegate-notes.webp',
    alt: 'A delegate in a suit reading his papers at a Model United Nations committee table, with small flags and a United States placard in front of him',
    author: 'PSS 2011',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:OSN_2011.jpg',
  },
  'mun-thessaloniki-council': {
    src: '/blog/photos/mun-thessaloniki-council.webp',
    alt: 'Students at Thessaloniki Model United Nations working at their laptops around a council table with small national flags',
    author: 'HMUNO Secretariat',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Thessaloniki_model_united_nations_2009.jpg',
  },
  'mun-beijing-disec': {
    src: '/blog/photos/mun-beijing-disec.webp',
    alt: 'A large committee room at Beijing Model United Nations, with delegates seated in rows of desks under a line of national flags',
    author: '外院模联 (CFAU Model UN)',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Beijing_Model_United_Nations_2015_GA-DISEC.jpg',
  },
  'mun-general-assembly-hemicycle': {
    src: '/blog/photos/mun-general-assembly-hemicycle.webp',
    alt: 'The General Assembly of International North Model United Nations meeting in a curved conference hall',
    author: 'Artbox33',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:International_North_Model_United_Nations_-_General_Assembly.jpg',
  },
  'mun-unmoderated-caucus': {
    src: '/blog/photos/mun-unmoderated-caucus.webp',
    alt: 'A delegate standing and speaking with his hands raised to a group of seated delegates during an unmoderated caucus',
    author: 'Morgan Owuor Odhiambo',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Magnito.jpg',
  },
  'mun-jakarta-council': {
    src: '/blog/photos/mun-jakarta-council.webp',
    alt: 'Two delegates in the Security Council at Jakarta Model United Nations, seated at a table with a laptop and a Philippines placard',
    author: 'MUNorg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:JMUN_UNSC.jpg',
  },
  'mun-chairs-dais': {
    src: '/blog/photos/mun-chairs-dais.webp',
    alt: 'Two student chairs presiding over a Security Council committee at a Model United Nations conference, seated behind a laptop and microphone',
    author: 'Andrea2016228',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:CISSMUN_Conference.jpg',
  },
  'mun-best-delegation-award': {
    src: '/blog/photos/mun-best-delegation-award.webp',
    alt: 'A student delegation celebrating as it accepts the Best Delegation award in the General Assembly Hall at UN Headquarters in New York',
    author: 'Wikiedior129293',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Beacon_Model_UN_Accepts_Best_Delegation_Award.jpg',
  },
  'mun-award-plaques': {
    src: '/blog/photos/mun-award-plaques.webp',
    alt: 'Four students in suits holding the award certificates and gavel plaque they won at a Model United Nations conference',
    author: 'Forest Hills Eastern High School',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:FHEmModelUnitedNations.jpg',
  },
  'mun-keynote-podium': {
    src: '/blog/photos/mun-keynote-podium.webp',
    alt: 'A speaker in a dark suit addressing a Model United Nations conference from a podium, with delegates and flags behind him',
    author: 'KSbangera',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:B22A9048.jpg',
  },
  'mun-geneva-students': {
    src: '/blog/photos/mun-geneva-students.webp',
    alt: 'Students and the Director-General of the UN Office at Geneva seated together at a Model UN conference held at the International Telecommunication Union',
    author: 'ITU Pictures',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:FerMUN-_Model_UN_conference_-_8364036717.jpg',
  },
  'mun-athens-delegation': {
    src: '/blog/photos/mun-athens-delegation.webp',
    alt: 'A large group of student delegates in formal clothes posing together at Athens Model United Nations',
    author: 'HMUNO Secretariat',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Athens_MUN_2010.jpg',
  },
  'mun-research-workshop': {
    src: '/blog/photos/mun-research-workshop.webp',
    alt: 'Students with laptops and tablets at a workshop on researching Model UN position papers, a presenter beside a projected slide',
    author: 'Akbarali',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:Digital_Literacy_Workshop_for_MUN_Position_Papers_(1).jpg',
  },
  'youth-parliament-speaker': {
    src: '/blog/photos/youth-parliament-speaker.webp',
    alt: 'A young delegate stands to speak from his seat in the chamber of Leinster House during European Youth Parliament Ireland',
    author: 'Houses of the Oireachtas',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:European_Youth_Parliament_-_%C3%89ire_Ireland_-_7th_%26_8th_April_2024_(53637596150).jpg',
  },
  'youth-parliament-chamber': {
    src: '/blog/photos/youth-parliament-chamber.webp',
    alt: 'Student delegates seated along the benches of a debating chamber in Leinster House during European Youth Parliament Ireland',
    author: 'Houses of the Oireachtas',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:European_Youth_Parliament_-_%C3%89ire_Ireland_-_7th_%26_8th_April_2024_(53637655181).jpg',
  },
  'venue-banquet-hall': {
    src: '/blog/photos/venue-banquet-hall.webp',
    alt: 'A large hotel conference hall set up with rows of white-covered chairs facing a stage',
    author: 'PattayaPatrol',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:DZ6_0468_Spacious_elegantly_lit_banquet_hall_set_up_with_rows_of_white-covered_chairs_facing_a_stage_ready_for_a_large_conference_or_formal_event.jpg',
  },
  'hybrid-meeting': {
    src: '/blog/photos/hybrid-meeting.webp',
    alt: 'A hybrid meeting in a library room: people at tables with laptops while remote participants appear on a projected video call',
    author: 'wil540',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    source: 'https://commons.wikimedia.org/wiki/File:02162023_WikiWednesday_February_2023_BPL_Hybrid.jpg',
  },
};

export function photoFor(id: PhotoId | undefined): BlogPhoto | undefined {
  return id ? PHOTOS[id] : undefined;
}
