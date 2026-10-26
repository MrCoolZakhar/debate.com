// Gavelling Crisis: row types (mirror docs/crisis/sql/*.sql) and settings with their defaults.

export type CrisisRole = 'director' | 'assistant_director' | 'backroomer' | 'chair' | 'press' | 'delegate' | 'organiser';

export const STAFF_ROLES: CrisisRole[] = ['director', 'assistant_director', 'organiser', 'backroomer'];
export const DIRECTOR_ROLES: CrisisRole[] = ['director', 'assistant_director', 'organiser'];
export const isStaff = (r: CrisisRole | null | undefined) => !!r && STAFF_ROLES.includes(r);
export const isDirector = (r: CrisisRole | null | undefined) => !!r && DIRECTOR_ROLES.includes(r);

export const ROLE_LABEL: Record<CrisisRole, string> = {
  director: 'Crisis Director',
  assistant_director: 'Assistant Crisis Director',
  backroomer: 'Backroomer',
  chair: 'Chair',
  press: 'Press',
  delegate: 'Delegate',
  organiser: 'Organiser',
};

export interface CrisisSettings {
  cooldownSeconds: number;          // between two directives from one delegate; 0 = off
  wordLimit: number;                // 0 = no limit
  messages: 'free' | 'approval' | 'off';
  otherCabinets: 'hidden' | 'names' | 'profiles';  // what delegates see of the other cabinets' characters
  backroomPowers: { map: boolean; resources: boolean; fog: boolean; units: boolean; seeAll: boolean; news: boolean; characters: boolean };
  points?: Partial<import('./points').PointsConfig>;
  newsNeedsApproval: boolean;
  meetingsNeedApproval: boolean;
  chairReadsPersonal: boolean;
  /** A cabinet directive waits for its cabinet's chair before the backroom sees it (docs/crisis/sql/017). */
  chairApprovesCabinetDirectives: boolean;
  queueOrder: 'fair' | 'oldest' | 'newest';
}

export const DEFAULT_SETTINGS: CrisisSettings = {
  cooldownSeconds: 180,
  wordLimit: 300,
  messages: 'free',
  otherCabinets: 'hidden',
  backroomPowers: { map: true, resources: true, fog: true, units: true, seeAll: true, news: false, characters: false },
  newsNeedsApproval: true,
  meetingsNeedApproval: true,
  chairReadsPersonal: false,
  chairApprovesCabinetDirectives: true,
  queueOrder: 'fair',
};

export function readSettings(raw: unknown): CrisisSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<CrisisSettings>;
  const other = (s as { otherCabinets?: string }).otherCabinets;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    otherCabinets: other === 'names' ? 'names' : other === 'profiles' || other === 'full' ? 'profiles' : 'hidden',
    backroomPowers: { ...DEFAULT_SETTINGS.backroomPowers, ...(s.backroomPowers ?? {}) },
  };
}

export interface Crisis {
  id: string;
  conference_id: string;
  slug: string;
  name: string;
  kind: 'single' | 'joint';
  package: 'basic' | 'full';
  features: Record<string, unknown>;
  settings: Record<string, unknown>;
  scenario_at: string | null;        // in-world date/time, ISO without zone, static until the CD changes it
  directives_open: boolean;
  directives_paused_note: string | null;
  next_directive_no: number;
  created_at: string;
  updated_at: string;
}

export interface Cabinet {
  id: string;
  crisis_id: string;
  conference_committee_id: string | null;
  name: string;
  short_name: string | null;
  color: string;
  sort: number;
  logo_url: string | null;      // the cabinet's logo or seal (docs/crisis/sql/010)
}

export interface Member {
  id: string;
  crisis_id: string;
  user_id: string | null;
  role: Exclude<CrisisRole, 'organiser'>;
  cabinet_id: string | null;
  character_id: string | null;
  display_name: string;
  email: string | null;
  access_code: string | null;
  last_seen_at: string | null;
  created_at: string;
  picture_url: string | null;   // staff picture (delegates show their character's)
}
/** Columns a client may select from crisis_members (the hashes are not granted). */
export const MEMBER_COLUMNS = 'id, crisis_id, user_id, role, cabinet_id, character_id, display_name, email, access_code, last_seen_at, created_at, picture_url';

export type CharacterStatus = 'active' | 'spare' | 'dead' | 'arrested' | 'missing';
export interface Character {
  id: string;
  crisis_id: string;
  cabinet_id: string | null;
  name: string;
  title: string | null;
  bio: string | null;
  picture_url: string | null;
  powers: string | null;
  location: string | null;
  status: CharacterStatus;
  status_note: string | null;
  owner_member_id: string | null;   // responsible backroomer
  slot_id: string | null;
  sort: number;
  guide_url: string | null;    // the character guide the CD attaches (docs/crisis/sql/008)
  guide_name: string | null;
  location_lng?: number | null;   // where the character stands on the map (docs/crisis/sql/017); staff see it
  location_lat?: number | null;
}

export interface CharacterSecret {
  character_id: string;
  crisis_id: string;
  goals: string | null;
  staff_notes: string | null;
}

export type DirectiveKind = 'personal' | 'joint' | 'committee' | 'press_release' | 'communique';
export type DirectiveStatus = 'awaiting_chair' | 'queued' | 'claimed' | 'clarify' | 'answered' | 'withdrawn';
export type DirectiveOutcome = 'approved' | 'partial' | 'denied' | 'clarify' | 'later';

export const KIND_LABEL: Record<DirectiveKind, string> = {
  personal: 'Personal directive',
  joint: 'Joint directive',
  committee: 'Cabinet directive',
  press_release: 'Press release',
  communique: 'Communiqué',
};
export const OUTCOME_LABEL: Record<DirectiveOutcome, string> = {
  approved: 'Approved',
  partial: 'Partly works',
  denied: 'Denied',
  clarify: 'More detail needed',
  later: 'Answer coming later',
};
export const THEMES = ['Military', 'Intelligence', 'Diplomatic', 'Economic', 'Press', 'Personal', 'Political', 'Covert'] as const;

export interface Directive {
  id: string;
  crisis_id: string;
  no: number;                  // crisis-wide sequence (internal)
  cabinet_no: number | null;   // the number people see: per cabinet (docs/crisis/sql/012)
  kind: DirectiveKind;
  cabinet_id: string | null;
  author_member_id: string | null;
  author_character_id: string | null;
  title: string;
  receiver: string | null;
  themes: string[];
  body: string;
  resources_used: string | null;
  goal: string | null;
  affects: string | null;
  covert: boolean;
  status: DirectiveStatus;
  outcome: DirectiveOutcome | null;
  reply: string | null;
  assigned_member_id: string | null;
  claimed_at: string | null;
  answered_at: string | null;
  answered_by: string | null;
  waiting_since: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface DirectiveNote {
  id: string;
  directive_id: string;
  crisis_id: string;
  member_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
}

export interface News {
  id: string;
  crisis_id: string;
  title: string;
  body: string;
  source_label: string | null;
  image_url: string | null;
  audience_cabinet_id: string | null;  // null = every room
  status: 'draft' | 'published';
  author_member_id: string | null;
  published_by: string | null;
  published_at: string | null;
  directive_id: string | null;
  numbers: Record<string, number>;  // news number per cabinet id (an all-rooms story is numbered in every cabinet)
  banner_url: string | null;        // a wide image above the story (and the live-room pop-up image)
  attachment_url: string | null;    // one file to download
  attachment_name: string | null;
  created_at: string;
}

/** Chat between characters (docs/crisis/sql/006). Staff read everything; approval is a setting. */
export interface CrisisMessage {
  id: string;
  crisis_id: string;
  from_member_id: string | null;
  from_character_id: string | null;
  to_character_id: string;
  body: string;
  status: 'sent' | 'pending' | 'rejected';
  decided_by: string | null;
  created_at: string;
}

export interface ResourceType {
  id: string;
  crisis_id: string;
  name: string;
  unit: string | null;
  scope: 'character' | 'cabinet';
  sort: number;
}

export interface Resource {
  id: string;
  crisis_id: string;
  type_id: string;
  character_id: string | null;
  cabinet_id: string | null;
  amount: number;
  updated_at: string;
}

export interface MapRegion {
  crisis_id: string;
  region_key: string;              // ISO 3166 numeric id from world-atlas for countries
  owner_cabinet_id: string | null;
  /** An edited outline for this country in this crisis (docs/crisis/sql/017); null = the world map's own. */
  geometry?: RegionGeometry | null;
  updated_at?: string;
}

/** A country or area outline: GeoJSON Polygon or MultiPolygon (an empty MultiPolygon = all its land was taken). */
export interface RegionGeometry { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }

export type UnitKind = 'army' | 'navy' | 'air' | 'missile' | 'base' | 'spy' | 'sub' | 'custom';
export interface MapUnit {
  id: string;
  crisis_id: string;
  owner_cabinet_id: string | null;
  kind: UnitKind;
  name: string;
  strength: number;
  lng: number;
  lat: number;
  note: string | null;
  revealed_to: string[];
  suspected_by: string[];
}

export interface MapShape {
  id: string;
  crisis_id: string;
  kind: 'line' | 'area';
  owner_cabinet_id: string | null;
  label: string | null;
  color: string | null;
  geometry: { type: 'LineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  public: boolean;
  revealed_to: string[];
}

/** What crisis_resolve answers for /crisis/<conference>/<crisis>. */
export interface ResolvedCrisis {
  found: boolean;
  allowed?: boolean;
  crisis_id?: string;
  role?: CrisisRole;
  member_id?: string | null;
  cabinet_id?: string | null;
  character_id?: string | null;
  display_name?: string | null;
  conference?: { id: string; slug: string; name: string; acronym: string; logo_url: string | null };
}

/** A meeting between characters (docs/crisis/sql/010). Happens in person; the app holds the request. */
export type MeetingStatus = 'pending' | 'approved' | 'declined' | 'held' | 'cancelled';
export interface Meeting {
  id: string;
  crisis_id: string;
  requested_by_member: string | null;
  requested_by_character: string | null;
  character_ids: string[];
  intention: string;
  duration_minutes: number;
  wanted_time: string | null;
  status: MeetingStatus;
  decided_by: string | null;
  decided_at: string | null;
  staff_note: string | null;
  outcome_note: string | null;
  started_at: string | null;   // the meeting clock (docs/crisis/sql/014): set by Start, cleared by Reset
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}
export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  pending: 'Waiting for approval', approved: 'Approved', declined: 'Declined', held: 'Held', cancelled: 'Cancelled',
};

/** A bell notification for one member, written by database triggers (docs/crisis/sql/011). */
export type NotificationKind = 'directive_answer' | 'directive_new' | 'directive_note' | 'news' | 'unit' | 'reveal' | 'territory' | 'meeting' | 'status';
export interface CrisisNotification {
  id: string;
  crisis_id: string;
  member_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;   // path inside the crisis: '' (home), 'map', 'news', 'meetings', 'directives?d=<id>', '?d=<id>'
  ref_id: string | null;   // 'unit' and 'reveal': the unit id; a directive: its id
  ref_key: string | null;  // 'territory' about a country: its region key (ISO numeric)
  read_at: string | null;
  created_at: string;
}
