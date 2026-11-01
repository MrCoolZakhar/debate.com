'use client';
// Gavelling Crisis: every read and write. Pages call these; nothing else talks to the crisis tables.
// Each function takes the page's { conf, crisis } slugs and reads a fresh client at call time.
// Writes that matter return a value the caller checks; errors become plain sentences via crisisError().

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { serverNowIso } from '@/lib/serverClock';
import { getCrisisClient, saveCrisisToken, anonClient } from './client';
import {
  MEMBER_COLUMNS,
  type Cabinet, type Character, type CharacterSecret, type Crisis, type Directive, type DirectiveNote,
  type MapRegion, type MapShape, type MapUnit, type Member, type News, type Resource, type ResourceType,
  type ResolvedCrisis, type RegionGeometry, type DirectiveOutcome, type DirectiveKind, type DirectiveStatus, type Meeting, type MeetingStatus, type CharacterStatus, type CrisisNotification,
} from './types';

export interface CrisisRef { conf: string; crisis: string; id: string }

const RPC_MESSAGES: Record<string, string> = {
  crisis_forbidden: 'You do not have access to do that in this crisis.',
  crisis_not_found: 'That could not be found. It may have been removed.',
  crisis_bad_outcome: 'Pick an outcome before sending.',
  crisis_reply_required: 'Write a reply before sending.',
  crisis_bad_role: 'Pick a role for this person.',
  crisis_bad_patch: 'That setting could not be saved.',
};

export function crisisError(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  const msg = (error as { message?: string } | null)?.message ?? '';
  for (const key of Object.keys(RPC_MESSAGES)) if (msg.includes(key)) return RPC_MESSAGES[key];
  return friendlyError(error, fallback);
}

async function c(ref: Pick<CrisisRef, 'conf' | 'crisis'>): Promise<SupabaseClient> {
  return getCrisisClient(ref.conf, ref.crisis);
}

function must<T>(res: { data: T | null; error: unknown }, fallback: string): T {
  if (res.error) throw new UserFacingError(crisisError(res.error, fallback));
  if (res.data === null) throw new UserFacingError(fallback);
  return res.data;
}

// ─────────── Entry ───────────

export interface MyCrisis {
  crisis_id: string; crisis_slug: string; crisis_name: string; conference_slug: string; conference_name: string;
  conference_acronym: string; logo_url: string | null; start_date: string | null; role: string;
}

export async function listMyCrises(): Promise<MyCrisis[]> {
  const client = await getCrisisClient('', '');
  const res = await client.rpc('crisis_my_list');
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load your crises.'));
  return (res.data ?? []) as MyCrisis[];
}

export type CodeLoginResult =
  | { ok: true; conference_slug: string; crisis_slug: string; display_name: string; role: string }
  | { ok: false; reason: 'wrong' | 'locked'; wait_seconds?: number };

/** Sign in with a personal code. On success the token is stored for that crisis on this device. */
/** A random id for this browser, so wrong room-code guesses lock only this device (docs/crisis/sql/029). */
function loginDeviceId(): string | null {
  try {
    const k = 'gavelling-crisis-device';
    let v = window.localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); window.localStorage.setItem(k, v); }
    return v;
  } catch { return null; }
}

export async function codeLogin(code: string, password: string): Promise<CodeLoginResult> {
  const res = await anonClient.rpc('crisis_code_login', { p_code: code, p_password: password, p_device: loginDeviceId() });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not sign you in. Try again.'));
  const r = res.data as { ok: boolean; token?: string; conference_slug?: string; crisis_slug?: string; display_name?: string; role?: string; reason?: 'wrong' | 'locked'; wait_seconds?: number };
  if (!r.ok || !r.token || !r.conference_slug || !r.crisis_slug) return { ok: false, reason: r.reason ?? 'wrong', wait_seconds: r.wait_seconds };
  saveCrisisToken(r.conference_slug, r.crisis_slug, r.token);
  return { ok: true, conference_slug: r.conference_slug, crisis_slug: r.crisis_slug, display_name: r.display_name ?? '', role: r.role ?? 'delegate' };
}

export async function codeLogout(ref: CrisisRef): Promise<void> {
  const client = await c(ref);
  await client.rpc('crisis_code_logout', { p_crisis: ref.id });
}

export async function resolveCrisis(conf: string, crisis: string): Promise<ResolvedCrisis> {
  const client = await getCrisisClient(conf, crisis);
  const res = await client.rpc('crisis_resolve', { p_conference_slug: conf, p_crisis_slug: crisis });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not open this crisis.'));
  return res.data as ResolvedCrisis;
}

export async function heartbeat(ref: CrisisRef): Promise<void> {
  const client = await c(ref);
  await client.rpc('crisis_heartbeat', { p_crisis: ref.id });
}

/** Just the presence stamps of everyone in the crisis (the "online" dots refresh from this, not from a full core reload). */
export async function readPresence(ref: CrisisRef): Promise<Array<{ id: string; last_seen_at: string | null }>> {
  const client = await c(ref);
  const res = await client.from('crisis_members').select('id, last_seen_at').eq('crisis_id', ref.id);
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not refresh who is online.'));
  return (res.data ?? []) as Array<{ id: string; last_seen_at: string | null }>;
}

/** Organiser: switch Gavelling Crisis on for a crisis committee. */
export async function enableCrisis(conferenceCommitteeId: string, pkg: 'basic' | 'full', name?: string): Promise<{ crisis_id: string; slug: string; created: boolean }> {
  const client = await getCrisisClient('', '');
  const res = await client.rpc('crisis_enable', { p_conference_committee: conferenceCommitteeId, p_package: pkg, p_name: name ?? null });
  return must(res as { data: { crisis_id: string; slug: string; created: boolean } | null; error: unknown }, 'Could not switch on Gavelling Crisis.');
}

/** Find the crisis already linked to a conference committee (organiser view in Manage). */
export async function crisisForCommittee(conferenceCommitteeId: string): Promise<{ crisis_id: string; slug: string } | null> {
  const client = await getCrisisClient('', '');
  const res = await client.from('crisis_cabinets').select('crisis_id, crises(slug)').eq('conference_committee_id', conferenceCommitteeId).maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data as unknown as { crisis_id: string; crises: { slug: string } | null };
  return row.crises ? { crisis_id: row.crisis_id, slug: row.crises.slug } : null;
}

// ─────────── Core world ───────────

export interface CrisisCore {
  crisis: Crisis;
  cabinets: Cabinet[];
  members: Member[];
  characters: Character[];
}

export async function loadCore(ref: CrisisRef): Promise<CrisisCore> {
  const client = await c(ref);
  const [cr, cabs, mem, chars] = await Promise.all([
    client.from('crises').select('*').eq('id', ref.id).single(),
    client.from('crisis_cabinets').select('*').eq('crisis_id', ref.id).order('sort'),
    client.from('crisis_members').select(MEMBER_COLUMNS).eq('crisis_id', ref.id).order('display_name'),
    client.from('crisis_characters').select('*').eq('crisis_id', ref.id).order('sort').order('name'),
  ]);
  const members = must(mem, 'Could not load the people.') as unknown as Member[];
  const characters = must(chars, 'Could not load the characters.') as Character[];
  // Non-staff read only their own row and their own cabinet's characters (docs/crisis/sql/029a); everyone else comes from
  // crisis_people (names and pictures, never an email or code) and crisis_world (what the crisis lets them see).
  const [people, world] = await Promise.all([
    client.rpc('crisis_people', { p_crisis: ref.id }),
    client.rpc('crisis_world', { p_crisis: ref.id }),
  ]);
  const haveM = new Set(members.map((m) => m.id));
  for (const m of ((people.data ?? []) as Member[])) if (!haveM.has(m.id)) members.push(m);
  const haveC = new Set(characters.map((x) => x.id));
  for (const w of ((world.data ?? []) as Array<Partial<Character> & { id: string }>)) {
    if (haveC.has(w.id)) continue;
    characters.push({
      crisis_id: ref.id, title: null, bio: null, picture_url: null, powers: null, location: null, status: 'active', status_note: null,
      owner_member_id: null, slot_id: null, sort: 0, guide_url: null, guide_name: null, location_lng: null, location_lat: null,
      ...w,
    } as unknown as Character);
  }
  return {
    crisis: must(cr, 'Could not load this crisis.') as Crisis,
    cabinets: must(cabs, 'Could not load the cabinets.') as Cabinet[],
    members,
    characters,
  };
}

/** The delegate's own secret goals (staff notes are never sent to a delegate). */
export async function loadMyGoals(ref: CrisisRef): Promise<string | null> {
  const client = await c(ref);
  const res = await client.rpc('crisis_my_goals', { p_crisis: ref.id });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the goals.'));
  return typeof res.data === 'string' && res.data.trim() ? res.data : null;
}

/** Characters of other cabinets as this viewer may see them (names only or full, per settings). */
export async function loadWorld(ref: CrisisRef): Promise<Array<Pick<Character, 'id' | 'cabinet_id' | 'name' | 'status' | 'title' | 'bio' | 'picture_url'>>> {
  const client = await c(ref);
  const res = await client.rpc('crisis_world', { p_crisis: ref.id });
  return must(res, 'Could not load the characters.') as Array<Pick<Character, 'id' | 'cabinet_id' | 'name' | 'status' | 'title' | 'bio' | 'picture_url'>>;
}

export async function loadSecrets(ref: CrisisRef): Promise<CharacterSecret[]> {
  const client = await c(ref);
  const res = await client.from('crisis_character_secrets').select('*').eq('crisis_id', ref.id);
  return must(res, 'Could not load the goals.') as CharacterSecret[];
}

export async function saveSecret(ref: CrisisRef, characterId: string, patch: Partial<Pick<CharacterSecret, 'goals' | 'staff_notes'>>): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_character_secrets')
    .upsert({ character_id: characterId, crisis_id: ref.id, ...patch, updated_at: serverNowIso() }).select('character_id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the goals.'));
}

export async function patchCrisis(ref: CrisisRef, patch: Partial<Pick<Crisis, 'name' | 'scenario_at' | 'directives_open' | 'directives_paused_note'>>): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crises').update(patch).eq('id', ref.id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save that change.'));
}

export async function patchSettings(ref: CrisisRef, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = await c(ref);
  const res = await client.rpc('crisis_patch_settings', { p_crisis: ref.id, p_patch: patch });
  return must(res, 'Could not save that setting.') as Record<string, unknown>;
}

export async function saveCharacter(ref: CrisisRef, row: Partial<Character> & { id?: string }): Promise<string> {
  const client = await c(ref);
  const { id, ...rest } = row;
  const res = id
    ? await client.from('crisis_characters').update(rest).eq('id', id).select('id')
    : await client.from('crisis_characters').insert({ ...rest, crisis_id: ref.id }).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the character.'));
  return (res.data[0] as { id: string }).id;
}

export async function deleteCharacter(ref: CrisisRef, id: string): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_characters').delete().eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not remove the character.'));
}

export async function syncRoster(ref: CrisisRef): Promise<{ characters_added: number; members_added: number }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_sync_roster', { p_crisis: ref.id });
  return must(res, 'Could not bring in the seats and delegates.') as { characters_added: number; members_added: number };
}

export async function saveCabinet(ref: CrisisRef, id: string, patch: Partial<Pick<Cabinet, 'name' | 'short_name' | 'color' | 'sort'>>): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_cabinets').update(patch).eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the cabinet.'));
}

// ─────────── People ───────────

export async function addMember(ref: CrisisRef, m: { role: Member['role']; name: string; email?: string | null; cabinetId?: string | null; characterId?: string | null }): Promise<string> {
  const client = await c(ref);
  const res = await client.rpc('crisis_add_member', {
    p_crisis: ref.id, p_role: m.role, p_name: m.name, p_email: m.email ?? null, p_cabinet: m.cabinetId ?? null, p_character: m.characterId ?? null,
  });
  return must(res, 'Could not add this person.') as string;
}

export async function saveMember(ref: CrisisRef, id: string, patch: Partial<Pick<Member, 'role' | 'cabinet_id' | 'character_id' | 'display_name'>>): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_members').update(patch).eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save this person.'));
}

export async function removeMember(ref: CrisisRef, id: string): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_members').delete().eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not remove this person.'));
}

/** Issue a personal code and password. The password is shown once and never stored in plain text. */
export async function issueCode(ref: CrisisRef, memberId: string): Promise<{ code: string; password: string }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_issue_code', { p_member: memberId });
  return must(res, 'Could not make a code for this person.') as { code: string; password: string };
}

// ─────────── Directives ───────────

/** Directives still being worked on (everyone waits on someone): always loaded in full. */
export const OPEN_DIRECTIVE_STATUSES: DirectiveStatus[] = ['awaiting_chair', 'changes_requested', 'queued', 'claimed', 'clarify'];
/** Finished ones: loaded newest first, in pages. */
export const CLOSED_DIRECTIVE_STATUSES: DirectiveStatus[] = ['answered', 'rejected', 'withdrawn'];
export const DIRECTIVE_PAGE = 200;

/** Reads every row of a query that may hold more than the server's 1,000-row answer, in order, 1,000 at a time. */
async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>, fallback: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await page(from, from + 999);
    if (res.error) throw new UserFacingError(crisisError(res.error, fallback));
    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Every open directive plus the newest page of finished ones, newest first. For older finished ones use listClosedDirectivesPage. */
export async function listDirectives(ref: CrisisRef): Promise<Directive[]> {
  const client = await c(ref);
  const [open, closed] = await Promise.all([
    readAllRows<Directive>((from, to) => client.from('crisis_directives').select('*').eq('crisis_id', ref.id)
      .in('status', OPEN_DIRECTIVE_STATUSES).order('no', { ascending: false }).range(from, to), 'Could not load the directives.'),
    client.from('crisis_directives').select('*').eq('crisis_id', ref.id)
      .in('status', CLOSED_DIRECTIVE_STATUSES).order('no', { ascending: false }).limit(DIRECTIVE_PAGE),
  ]);
  const rows = [...open, ...(must(closed, 'Could not load the directives.') as Directive[])];
  return rows.sort((a, b) => b.no - a.no);
}

/** The next page of finished directives (answered, rejected, withdrawn) older than number `beforeNo`, newest first. */
export async function listClosedDirectivesPage(ref: CrisisRef, beforeNo: number): Promise<Directive[]> {
  const client = await c(ref);
  const res = await client.from('crisis_directives').select('*').eq('crisis_id', ref.id)
    .in('status', CLOSED_DIRECTIVE_STATUSES).lt('no', beforeNo).order('no', { ascending: false }).limit(DIRECTIVE_PAGE);
  return must(res, 'Could not load older directives.') as Directive[];
}

/** How many directives there are in these statuses, counted in the database (what the lists show beside "Show older"). */
export async function countDirectives(ref: CrisisRef, statuses: DirectiveStatus[]): Promise<number> {
  const client = await c(ref);
  const res = await client.from('crisis_directives').select('id', { count: 'exact', head: true }).eq('crisis_id', ref.id).in('status', statuses);
  if (res.error || res.count === null) throw new UserFacingError(crisisError(res.error, 'Could not count the directives.'));
  return res.count;
}

/** The few columns Statistics and the points need, for EVERY directive of the crisis (no cap, nothing long). */
export type DirectiveStatRow = Pick<Directive, 'id' | 'kind' | 'status' | 'outcome' | 'author_character_id' | 'answered_by' | 'answered_at' | 'created_at'>;
export async function loadDirectiveStatRows(ref: CrisisRef): Promise<DirectiveStatRow[]> {
  const client = await c(ref);
  return readAllRows<DirectiveStatRow>((from, to) => client.from('crisis_directives')
    .select('id, kind, status, outcome, author_character_id, answered_by, answered_at, created_at')
    .eq('crisis_id', ref.id).order('no', { ascending: false }).range(from, to), 'Could not load the statistics.');
}

/** The cabinet directives waiting in the backroom that are assigned to this member (the Crisis Director's prompt reads these). */
export async function listQueuedCabinetDirectivesFor(ref: CrisisRef, memberId: string): Promise<Directive[]> {
  const client = await c(ref);
  const res = await client.from('crisis_directives').select('*')
    .eq('crisis_id', ref.id).eq('kind', 'committee').eq('status', 'queued').eq('assigned_member_id', memberId)
    .order('updated_at', { ascending: true }).limit(100);
  return must(res, 'Could not load the directives.') as Directive[];
}

export async function listNotes(ref: CrisisRef, directiveId: string): Promise<DirectiveNote[]> {
  const client = await c(ref);
  const res = await client.from('crisis_directive_notes').select('*').eq('directive_id', directiveId).order('created_at');
  return must(res, 'Could not load the notes.') as DirectiveNote[];
}

export interface DirectiveDraft {
  kind: DirectiveKind; title: string; receiver?: string | null; body: string; themes: string[];
  resources_used?: string; goal?: string; affects?: string; covert?: boolean; coauthors?: string[];
  /** The same id on a retry returns the directive already sent instead of a second one (docs/crisis/sql/029b). */
  request_id?: string;
}
export type SubmitResult =
  | { ok: true; id: string; no: number; cabinet_no?: number | null; awaiting_chair?: boolean }
  | { ok: false; reason: 'paused'; note?: string | null }
  | { ok: false; reason: 'cooldown'; wait_seconds: number }
  | { ok: false; reason: 'too_long'; limit: number }
  | { ok: false; reason: 'inactive'; status: 'dead' | 'arrested' | 'missing' };

export async function submitDirective(ref: CrisisRef, d: DirectiveDraft): Promise<SubmitResult> {
  const client = await c(ref);
  const res = await client.rpc('crisis_submit_directive', { p_crisis: ref.id, p: d });
  return must(res, 'Could not send the directive. Your text is kept, try again.') as SubmitResult;
}

/** The chair of a cabinet sends a waiting cabinet directive on to the backroom (approve) or turns it back with an optional note.
 *  False means it was no longer waiting. */
export async function reviewDirectiveAsChair(ref: CrisisRef, directiveId: string, approve: boolean, note?: string | null): Promise<boolean> {
  const client = await c(ref);
  const res = await client.rpc('crisis_chair_review_directive', { p_directive: directiveId, p_approve: approve, p_note: note?.trim() ? note.trim() : null });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not save that decision. Try again.'));
  return res.data === true;
}

/** The chair asks for changes on a waiting cabinet directive (docs/crisis/sql/028): it goes back to its author as a draft,
 *  with the note. False means it was no longer waiting. Reject is reviewDirectiveAsChair(..., false). */
export async function requestDirectiveChanges(ref: CrisisRef, directiveId: string, note?: string | null): Promise<boolean> {
  const client = await c(ref);
  const res = await client.rpc('crisis_chair_request_changes', { p_directive: directiveId, p_note: note?.trim() ? note.trim() : null });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not send it back. Try again.'));
  return res.data === true;
}

export type ResendResult =
  | { ok: true; id: string; awaiting_chair: boolean }
  | { ok: false; reason: 'not_returned' }
  | { ok: false; reason: 'paused'; note?: string | null }
  | { ok: false; reason: 'too_long'; limit: number };

/** The author sends a directive the chair returned (status changes_requested) again, edited. It keeps its number. */
export async function resendDirective(ref: CrisisRef, directiveId: string, d: Pick<DirectiveDraft, 'title' | 'body' | 'themes' | 'receiver' | 'covert'>): Promise<ResendResult> {
  const client = await c(ref);
  const res = await client.rpc('crisis_resend_directive', { p_directive: directiveId, p: d });
  return must(res, 'Could not send the directive. Your text is kept, try again.') as ResendResult;
}

/** Claim for yourself (memberId omitted) or hand to another staff member. */
export async function assignDirective(ref: CrisisRef, directiveId: string, memberId?: string | null): Promise<void> {
  const client = await c(ref);
  const res = await client.rpc('crisis_assign_directive', { p_directive: directiveId, p_member: memberId ?? null });
  must(res, 'Could not move this directive.');
}

/** Everything a reply can also do in the same press (docs/crisis/sql/010). */
export interface AnswerEffects {
  resources?: Array<{ id: string; delta: number }>;
  news?: { title: string; body?: string; source_label?: string; audience_cabinet_id?: string | null; banner_url?: string | null; attachment_url?: string | null; attachment_name?: string | null };
  /** Change any character's status (kill, arrest, missing, back to active). Any staff. */
  characters?: Array<{ id: string; status: CharacterStatus; status_note?: string | null }>;
  /** Move a unit or change its amount (units power). */
  units?: Array<{ id: string; lng?: number; lat?: number; strength?: number }>;
  /** Hand a country to a cabinet or to nobody (map power). */
  regions?: Array<{ key: string; owner_cabinet_id: string | null }>;
  /** A whole map edit set (the map editor's EditSet), applied in the same transaction (map power). */
  map?: object;
}

export type AnswerResult =
  | { ok: true; news_id: string | null; news_published?: boolean; repeat?: boolean; edited?: boolean }
  | { ok: false; reason: 'already_answered' | 'not_open' };

/** Sends a reply. Put a `request_id` in effects that stays the same across retries of the same reply (a repeat is a
 *  no-op), and `edit: true` to change an answered directive's words and outcome (its effects never run again). */
export async function answerDirective(ref: CrisisRef, directiveId: string, outcome: DirectiveOutcome, reply: string, effects: AnswerEffects & { request_id?: string; edit?: boolean } = {}): Promise<AnswerResult> {
  const client = await c(ref);
  const res = await client.rpc('crisis_answer_directive', { p_directive: directiveId, p_outcome: outcome, p_reply: reply, p_effects: effects });
  return must(res, 'Could not send the reply. It is kept, try again.') as AnswerResult;
}

export type EditDirectiveResult = { ok: true } | { ok: false; reason: 'answered' | 'being_answered' } | { ok: false; reason: 'too_long'; limit: number };

/** The author edits their directive until staff answer it (docs/crisis/sql/030). */
export async function editDirective(ref: CrisisRef, directiveId: string, d: Partial<Pick<DirectiveDraft, 'title' | 'body' | 'themes' | 'receiver' | 'covert'>>): Promise<EditDirectiveResult> {
  const client = await c(ref);
  const res = await client.rpc('crisis_edit_directive', { p_directive: directiveId, p: d });
  return must(res, 'Could not save your changes. Your text is kept, try again.') as EditDirectiveResult;
}

/** The author withdraws their directive until staff answer it. */
export async function withdrawDirective(ref: CrisisRef, directiveId: string): Promise<{ ok: boolean; reason?: 'answered' }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_withdraw_directive', { p_directive: directiveId });
  return must(res, 'Could not withdraw the directive. Try again.') as { ok: boolean; reason?: 'answered' };
}

/** The committee room(s) a crisis chair opens as chair: their own cabinet's for a chair, every cabinet's for staff
 *  (docs/crisis/sql/029, part 33). The password lets the join link fill it in. */
export async function loadChairRooms(ref: CrisisRef): Promise<Array<{ cabinet_id: string; cabinet_name: string; code: string | null; chair_password: string | null }>> {
  const client = await c(ref);
  const res = await client.rpc('crisis_chair_rooms', { p_crisis: ref.id });
  return must(res, 'Could not load the committee room.') as Array<{ cabinet_id: string; cabinet_name: string; code: string | null; chair_password: string | null }>;
}

/** Gives a delegate whose character died or was arrested a spare character (docs/crisis/sql/029g). */
export async function giveSpare(ref: CrisisRef, memberId: string, spareId: string): Promise<{ ok: boolean; reason?: 'taken'; seat_moved?: boolean }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_give_spare', { p_member: memberId, p_spare: spareId });
  return must(res, 'Could not give the spare character.') as { ok: boolean; reason?: 'taken'; seat_moved?: boolean };
}

/** Tells the crisis team a reply to this directive is being typed (on) or no longer is (off). Presence only, never an error to the person. */
export async function markDrafting(ref: CrisisRef, directiveId: string, on = true): Promise<void> {
  const client = await c(ref);
  await client.rpc('crisis_mark_drafting', { p_directive: directiveId, p_on: on });
}

export async function addNote(ref: CrisisRef, directiveId: string, body: string, internal = false): Promise<void> {
  const client = await c(ref);
  const res = await client.rpc('crisis_add_directive_note', { p_directive: directiveId, p_body: body, p_internal: internal });
  must(res, 'Could not send the note.');
}

// ─────────── News ───────────

export async function listNews(ref: CrisisRef): Promise<News[]> {
  const client = await c(ref);
  const res = await client.from('crisis_news').select('*').eq('crisis_id', ref.id).order('created_at', { ascending: false }).limit(500);
  return must(res, 'Could not load the news.') as News[];
}

export async function saveNews(ref: CrisisRef, id: string | null, n: { title: string; body: string; source_label?: string | null; image_url?: string | null; banner_url?: string | null; attachment_url?: string | null; attachment_name?: string | null; audience_cabinet_id?: string | null }): Promise<string> {
  const client = await c(ref);
  const res = await client.rpc('crisis_save_news', { p_crisis: ref.id, p_id: id, p: n });
  return must(res, 'Could not save the news.') as string;
}

export async function publishNews(ref: CrisisRef, newsId: string): Promise<{ rooms: number }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_publish_news', { p_news: newsId });
  return must(res, 'Could not publish the news.') as { rooms: number };
}

// ─────────── Resources ───────────

export async function loadResources(ref: CrisisRef): Promise<{ types: ResourceType[]; resources: Resource[] }> {
  const client = await c(ref);
  const [t, r] = await Promise.all([
    client.from('crisis_resource_types').select('*').eq('crisis_id', ref.id).order('sort'),
    client.from('crisis_resources').select('*').eq('crisis_id', ref.id),
  ]);
  return { types: must(t, 'Could not load the resources.') as ResourceType[], resources: must(r, 'Could not load the resources.') as Resource[] };
}

export async function addResourceType(ref: CrisisRef, t: { name: string; unit?: string | null; scope: 'character' | 'cabinet' }): Promise<string> {
  const client = await c(ref);
  const res = await client.from('crisis_resource_types').insert({ ...t, crisis_id: ref.id }).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not add the resource.'));
  return (res.data[0] as { id: string }).id;
}

/** Rename a resource type or change its measure (unit); the new unit shows on every tile of that type. */
export async function saveResourceType(ref: CrisisRef, id: string, patch: { name?: string; unit?: string | null }): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_resource_types').update(patch).eq('id', id).eq('crisis_id', ref.id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the resource.'));
}

export async function createResource(ref: CrisisRef, r: { type_id: string; character_id?: string | null; cabinet_id?: string | null; amount: number }): Promise<string> {
  const client = await c(ref);
  const res = await client.from('crisis_resources').insert({ ...r, crisis_id: ref.id }).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not add the resource.'));
  return (res.data[0] as { id: string }).id;
}

export async function adjustResource(ref: CrisisRef, resourceId: string, delta: number, reason?: string): Promise<number> {
  const client = await c(ref);
  const res = await client.rpc('crisis_adjust_resource', { p_resource: resourceId, p_delta: delta, p_reason: reason ?? null });
  return must(res, 'Could not change the resource.') as number;
}

// ─────────── Map ───────────

export async function loadMap(ref: CrisisRef): Promise<{ regions: MapRegion[]; units: MapUnit[]; shapes: MapShape[] }> {
  const client = await c(ref);
  const [rg, un, sh] = await Promise.all([
    client.from('crisis_map_regions').select('*').eq('crisis_id', ref.id),
    client.from('crisis_units').select('*').eq('crisis_id', ref.id),
    client.from('crisis_shapes').select('*').eq('crisis_id', ref.id),
  ]);
  return {
    regions: must(rg, 'Could not load the map.') as MapRegion[],
    units: must(un, 'Could not load the map.') as MapUnit[],
    shapes: must(sh, 'Could not load the map.') as MapShape[],
  };
}

export async function setRegionOwner(ref: CrisisRef, regionKey: string, ownerCabinetId: string | null): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_map_regions')
    .upsert({ crisis_id: ref.id, region_key: regionKey, owner_cabinet_id: ownerCabinetId, updated_at: serverNowIso() })
    .select('region_key');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not change the border.'));
}

/** Saves edited country outlines in one write (map power), keeping each row's owner. null geometry = the world map's own. */
export async function saveRegionGeometries(
  ref: CrisisRef, rows: Array<{ key: string; owner_cabinet_id: string | null; geometry: RegionGeometry | null }>,
): Promise<void> {
  if (!rows.length) return;
  const client = await c(ref);
  const at = serverNowIso();
  const res = await client.from('crisis_map_regions')
    .upsert(rows.map((r) => ({ crisis_id: ref.id, region_key: r.key, owner_cabinet_id: r.owner_cabinet_id, geometry: r.geometry, updated_at: at })))
    .select('region_key');
  if (res.error || (res.data?.length ?? 0) < rows.length) throw new UserFacingError(crisisError(res.error, 'Could not change the border.'));
}

export async function saveUnit(ref: CrisisRef, u: Partial<MapUnit> & { id?: string }): Promise<string> {
  const client = await c(ref);
  const { id, ...rest } = u;
  const res = id
    ? await client.from('crisis_units').update(rest).eq('id', id).select('id')
    : await client.from('crisis_units').insert({ ...rest, crisis_id: ref.id }).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the unit.'));
  return (res.data[0] as { id: string }).id;
}

export async function deleteUnit(ref: CrisisRef, id: string): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_units').delete().eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not remove the unit.'));
}

export async function saveShape(ref: CrisisRef, s: Partial<MapShape> & { id?: string }): Promise<string> {
  const client = await c(ref);
  const { id, ...rest } = s;
  const res = id
    ? await client.from('crisis_shapes').update(rest).eq('id', id).select('id')
    : await client.from('crisis_shapes').insert({ ...rest, crisis_id: ref.id }).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the shape.'));
  return (res.data[0] as { id: string }).id;
}

export async function deleteShape(ref: CrisisRef, id: string): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_shapes').delete().eq('id', id).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not remove the shape.'));
}

/** Applies a whole map edit set in one transaction (docs/crisis/sql/020); answers the ids of the added shapes, in order. */
export async function applyMapSet(ref: CrisisRef, set: Record<string, unknown>): Promise<string[]> {
  const client = await c(ref);
  const res = await client.rpc('crisis_apply_map_set', { p_crisis: ref.id, p_set: set });
  const out = must(res, 'Could not save the map changes.') as { ok?: boolean; added?: string[] };
  if (!out.ok) throw new UserFacingError('Could not save the map changes.');
  return Array.isArray(out.added) ? out.added : [];
}

/** The crisis team's shared unsent map draft (staff only); null when there is none. */
export async function loadMapDraft(ref: CrisisRef): Promise<unknown | null> {
  return (await loadMapDraftVersioned(ref)).payload;
}

/** The shared draft with its version (0 when there is none), for saveMapDraftVersioned. */
export async function loadMapDraftVersioned(ref: CrisisRef): Promise<{ payload: unknown | null; version: number; updated_by: string | null }> {
  const client = await c(ref);
  const res = await client.from('crisis_map_drafts').select('payload, version, updated_by').eq('crisis_id', ref.id).maybeSingle();
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not load the unsent map changes.'));
  const row = res.data as { payload?: unknown; version?: number; updated_by?: string | null } | null;
  return { payload: row?.payload ?? null, version: row?.version ?? 0, updated_by: row?.updated_by ?? null };
}

export type MapDraftSave =
  | { ok: true; version: number }
  | { ok: false; reason: 'newer'; version: number; payload: unknown; updated_by: string | null };

/** Saves the shared draft only if nobody saved since `base` (docs/crisis/sql/029c). On 'newer' merge the returned
 *  payload with yours and save again on its version. */
export async function saveMapDraftVersioned(ref: CrisisRef, payload: Record<string, unknown>, base: number): Promise<MapDraftSave> {
  const client = await c(ref);
  const res = await client.rpc('crisis_save_map_draft', { p_crisis: ref.id, p_payload: payload, p_base: base });
  return must(res, 'Could not save the unsent map changes.') as MapDraftSave;
}

/** After a send: clears the draft only if it is still the version that was sent; a newer one is kept. */
export async function clearMapDraftVersioned(ref: CrisisRef, base: number): Promise<{ ok: boolean; kept?: boolean; version?: number }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_clear_map_draft', { p_crisis: ref.id, p_base: base });
  return must(res, 'Could not clear the unsent map changes.') as { ok: boolean; kept?: boolean; version?: number };
}

/** Writes the shared draft; a null payload throws it away. */
export async function saveMapDraft(ref: CrisisRef, payload: Record<string, unknown> | null): Promise<void> {
  const client = await c(ref);
  if (payload === null) {
    const del = await client.from('crisis_map_drafts').delete().eq('crisis_id', ref.id);
    if (del.error) throw new UserFacingError(crisisError(del.error, 'Could not clear the unsent map changes.'));
    return;
  }
  const res = await client.from('crisis_map_drafts')
    .upsert({ crisis_id: ref.id, payload, updated_at: serverNowIso() })
    .select('crisis_id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not save the unsent map changes.'));
}

// ─────────── Media (bucket crisis-media, public; see docs/crisis/sql/006) ───────────

const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const FILE_TYPES = [...BANNER_TYPES, 'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

async function upload(ref: CrisisRef, path: string, file: File): Promise<string> {
  const client = await c(ref);
  const res = await client.storage.from('crisis-media').upload(path, file, { contentType: file.type, upsert: false });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not upload the file. Try again.'));
  return client.storage.from('crisis-media').getPublicUrl(path).data.publicUrl;
}

/** A news banner: JPG, PNG, WebP or GIF up to 20 MB. The path shape is trusted by the live room
 *  (CRISIS_BANNER_PATH in src/lib/chatAttachments.ts): change both together. */
export async function uploadCrisisBanner(ref: CrisisRef, file: File): Promise<string> {
  if (!BANNER_TYPES.includes(file.type)) throw new UserFacingError('Use a JPG, PNG, WebP or GIF image.');
  if (file.size > MAX_MEDIA_BYTES) throw new UserFacingError('The image is over 20 MB.');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  return upload(ref, `${ref.id}/news/${Date.now()}-banner.${ext}`, file);
}

/** A picture attached to a directive or a clarification: JPG, PNG, WebP or GIF up to 20 MB. Returns the public address. */
export async function uploadCrisisImage(ref: CrisisRef, file: File): Promise<string> {
  if (!BANNER_TYPES.includes(file.type)) throw new UserFacingError('Use a JPG, PNG, WebP or GIF image.');
  if (file.size > MAX_MEDIA_BYTES) throw new UserFacingError('The image is over 20 MB.');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  return upload(ref, `${ref.id}/directives/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, file);
}

/** Any attached file: PDF, Word, PowerPoint, Excel, text or an image, up to 20 MB. */
export async function uploadCrisisFile(ref: CrisisRef, file: File): Promise<{ url: string; name: string }> {
  if (!FILE_TYPES.includes(file.type)) throw new UserFacingError('Use a PDF, Word, PowerPoint, Excel, text or image file.');
  if (file.size > MAX_MEDIA_BYTES) throw new UserFacingError('The file is over 20 MB.');
  const safe = file.name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file';
  const url = await upload(ref, `${ref.id}/files/${Date.now()}-${safe}`, file);
  return { url, name: file.name };
}

// ─────────── View as, room codes ───────────

/** Directors (through their own account) open the crisis as another person on this device. */
export async function viewAs(ref: CrisisRef, memberId: string): Promise<void> {
  const client = await getCrisisClient('', ''); // the account, never a stored token
  const res = await client.rpc('crisis_view_as', { p_member: memberId });
  const r = must(res, 'Could not open the crisis as this person.') as { token: string; conference_slug: string; crisis_slug: string };
  saveCrisisToken(r.conference_slug, r.crisis_slug, r.token);
}

/** Public: the crisis behind a live room code, or null. */
export async function crisisForRoom(code: string): Promise<{ conference_slug: string; crisis_slug: string; name: string } | null> {
  const res = await anonClient.rpc('crisis_for_room', { p_code: code });
  if (res.error) return null;
  return (res.data as { conference_slug: string; crisis_slug: string; name: string } | null) ?? null;
}

// ─────────── Meetings ───────────

export async function listMeetings(ref: CrisisRef): Promise<Meeting[]> {
  const client = await c(ref);
  const res = await client.from('crisis_meetings').select('*').eq('crisis_id', ref.id).order('created_at', { ascending: false }).limit(1000);
  return must(res, 'Could not load the meetings.') as Meeting[];
}

/** An invited delegate accepts or declines a meeting request (docs/crisis/sql/029e). */
export async function respondMeeting(ref: CrisisRef, meetingId: string, accept: boolean): Promise<{ ok: boolean; status?: MeetingStatus; reason?: 'decided' }> {
  const client = await c(ref);
  const res = await client.rpc('crisis_respond_meeting', { p_meeting: meetingId, p_accept: accept });
  return must(res, 'Could not save your answer. Try again.') as { ok: boolean; status?: MeetingStatus; reason?: 'decided' };
}

/** Who answered an invitation so far. */
export async function listMeetingResponses(ref: CrisisRef): Promise<Array<{ meeting_id: string; character_id: string; response: 'accepted' | 'declined'; responded_at: string }>> {
  const client = await c(ref);
  const res = await client.from('crisis_meeting_responses').select('meeting_id, character_id, response, responded_at').eq('crisis_id', ref.id);
  return must(res, 'Could not load the answers.') as Array<{ meeting_id: string; character_id: string; response: 'accepted' | 'declined'; responded_at: string }>;
}

/** Pause or reopen directives for one cabinet (the crisis-wide switch still pauses every cabinet). */
export async function setCabinetDirectivesOpen(ref: CrisisRef, cabinetId: string, open: boolean, note?: string | null): Promise<void> {
  const client = await c(ref);
  const res = await client.from('crisis_cabinets').update({ directives_open: open, directives_paused_note: open ? null : (note?.trim() || null) })
    .eq('id', cabinetId).select('id');
  if (res.error || !res.data?.length) throw new UserFacingError(crisisError(res.error, 'Could not change the pause.'));
}

/** The last change of each resource, read directly in the database (staff). */
export async function loadResourceLastChanges(ref: CrisisRef): Promise<Array<{ resource_id: string; delta: number; amount_after: number; reason: string | null; created_at: string }>> {
  const client = await c(ref);
  const res = await client.rpc('crisis_resource_last_changes', { p_crisis: ref.id });
  return must(res, 'Could not load the resources.') as Array<{ resource_id: string; delta: number; amount_after: number; reason: string | null; created_at: string }>;
}

export type RequestMeetingResult = { ok: true; id: string; status: MeetingStatus } | { ok: false; reason: 'nobody' };
export async function requestMeeting(ref: CrisisRef, m: { character_ids: string[]; intention: string; duration_minutes: number; wanted_time?: string | null }): Promise<RequestMeetingResult> {
  const client = await c(ref);
  const res = await client.rpc('crisis_request_meeting', { p_crisis: ref.id, p: m });
  return must(res, 'Could not ask for the meeting. Try again.') as RequestMeetingResult;
}

export async function decideMeeting(ref: CrisisRef, meetingId: string, status: MeetingStatus, staffNote?: string | null, outcomeNote?: string | null): Promise<void> {
  const client = await c(ref);
  const res = await client.rpc('crisis_decide_meeting', { p_meeting: meetingId, p_status: status, p_staff_note: staffNote ?? null, p_outcome_note: outcomeNote ?? null });
  must(res, 'Could not save that meeting decision.');
}

export async function cancelMeeting(ref: CrisisRef, meetingId: string): Promise<void> {
  const client = await c(ref);
  const res = await client.rpc('crisis_cancel_meeting', { p_meeting: meetingId });
  must(res, 'Could not cancel the meeting.');
}

// ─────────── Notifications (the bell) ───────────

export async function listNotifications(ref: CrisisRef): Promise<CrisisNotification[]> {
  const client = await c(ref);
  const res = await client.from('crisis_notifications').select('*').eq('crisis_id', ref.id).order('created_at', { ascending: false }).limit(80);
  return must(res, 'Could not load notifications.') as CrisisNotification[];
}

/** Mark some (or, with no ids, all) of my notifications read. */
export async function markNotificationsRead(ref: CrisisRef, ids?: string[]): Promise<void> {
  const client = await c(ref);
  const res = await client.rpc('crisis_mark_notifications_read', { p_crisis: ref.id, p_ids: ids ?? null });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not mark those as read.'));
}
