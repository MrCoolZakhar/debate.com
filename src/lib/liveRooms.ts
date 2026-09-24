'use client';

// ── The signed-in user's live conference rooms, role-tagged ──────────────────
//
// One RPC, `my_live_rooms()` (SECURITY DEFINER, authenticated only), answering
// for the CALLER only. A room is live when its conference is in progress today
// (conference timezone when valid, else UTC) and its linked session exists and
// has not ended. It never reads `committees.settings`, so the chair suffix
// cannot leak. Rows, already in priority order:
//
//   organiser : per conference the caller organises (conference_organizers,
//               platform admins deliberately excluded), with live / in-session counts
//   chair     : per room whose chair_user_ids holds the caller
//   delegate  : per room with a conference_allocations row for the caller
//               (lowest seat of a double delegation), with the allocated country
//   advisor   : per live room of a conference where the caller has an accepted /
//               assigned / checked-in faculty-advisor application, with
//               `students_in_room` (seats of the caller's society in that room).
//               GROUPED HERE into ONE entry per conference ("Follow your
//               delegation" -> /advisor, the Faculty Advisor board), 24 Sep 2026.
//
// Shared by the prompt (`LiveRoomsGate`, root layout) and the profile menu's
// "Live now" section: one read per page load per account, re-read by the menu
// when the cached answer is more than a minute old.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getGavelDeviceId } from '@/lib/gavelDevice';

export type LiveRole = 'organiser' | 'chair' | 'delegate' | 'advisor';

export interface LiveRoomInfo {
  conferenceCommitteeId: string;
  /** `committees.id` of the live session: the anon chair-presence channel's topic. */
  sessionId: string;
  committeeName: string;
  committeeAbbreviation: string | null;
  committeeLogoUrl: string | null;
  conferenceName: string;
  conferenceAcronym: string | null;
  conferenceLogoUrl: string | null;
  /** A country NAME ("India"), as organisers type it. */
  conferenceCountry: string | null;
  conferenceSlug: string | null;
  sessionCode: string;
  topic: string | null;
  phase: string;
  suspended: boolean;
  started: boolean;
  /** Everyone who has ever joined this dais (`committees.chair_names`; names only). */
  chairNames: string[];
  chairCount: number;
  /** The gavel holder's NAME (`settings.headChair`), never the chair suffix. */
  headChair: string | null;
  delegateCount: number;
  presentCount: number;
  /** Up to ten present delegations, for their round flags. */
  presentCountries: string[];
}

export interface LiveConferenceInfo {
  conferenceId: string;
  conferenceName: string;
  conferenceAcronym: string | null;
  conferenceLogoUrl: string | null;
  conferenceCountry: string | null;
  conferenceSlug: string;
  liveCount: number;
  inSessionCount: number;
}

/** A faculty advisor's conference with at least one live room: one entry, not one per room. */
export interface LiveAdvisorInfo {
  conferenceId: string;
  conferenceName: string;
  conferenceAcronym: string | null;
  conferenceLogoUrl: string | null;
  conferenceCountry: string | null;
  conferenceSlug: string | null;
  /** Live rooms of the conference. */
  liveCount: number;
  /** Seats of the advisor's own delegation (with a student) that sit in those live rooms. */
  studentsLive: number;
  /** The live rooms' session codes, so the standalone rejoin is not offered twice. */
  sessionCodes: string[];
}

export type LiveEntry =
  | { role: 'organiser'; key: string; conference: LiveConferenceInfo }
  | { role: 'chair'; key: string; room: LiveRoomInfo }
  | { role: 'delegate'; key: string; room: LiveRoomInfo; countryName: string; countryCode: string | null; seat: number | null }
  | { role: 'advisor'; key: string; conference: LiveAdvisorInfo };

/** The session codes an entry stands for (none for an organiser). */
export function entrySessionCodes(e: LiveEntry): string[] {
  if (e.role === 'organiser') return [];
  if (e.role === 'advisor') return e.conference.sessionCodes;
  return [e.room.sessionCode];
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

function roomFrom(r: Row): LiveRoomInfo | null {
  const code = str(r.session_code);
  const name = str(r.committee_name);
  if (!code || !name) return null;
  return {
    conferenceCommitteeId: String(r.conference_committee_id ?? ''),
    committeeName: name,
    committeeAbbreviation: str(r.committee_abbreviation),
    committeeLogoUrl: str(r.committee_logo_url),
    conferenceName: str(r.conference_name) ?? '',
    conferenceAcronym: str(r.conference_acronym),
    conferenceLogoUrl: str(r.conference_logo_url),
    conferenceCountry: str(r.conference_country),
    conferenceSlug: str(r.conference_slug),
    sessionId: String(r.session_id ?? ''),
    sessionCode: code.toUpperCase(),
    topic: str(r.topic),
    phase: String(r.phase ?? ''),
    suspended: r.suspended === true,
    started: r.started === true,
    chairNames: Array.isArray(r.chair_names) ? (r.chair_names as unknown[]).filter((n): n is string => typeof n === 'string' && !!n.trim()) : [],
    chairCount: num(r.chair_count),
    headChair: str(r.head_chair),
    delegateCount: num(r.delegate_count),
    presentCount: num(r.present_count),
    presentCountries: Array.isArray(r.present_countries) ? (r.present_countries as unknown[]).filter((c): c is string => typeof c === 'string' && !!c.trim()) : [],
  };
}

type ParsedRow = LiveEntry | { role: 'advisor-room'; room: LiveRoomInfo; conferenceId: string; students: number };

function entryFrom(r: Row): ParsedRow | null {
  const role = r.role;
  if (role === 'organiser') {
    const slug = str(r.conference_slug);
    if (!slug) return null;
    return {
      role,
      key: `o:${String(r.conference_id ?? slug)}`,
      conference: {
        conferenceId: String(r.conference_id ?? ''),
        conferenceName: str(r.conference_name) ?? slug,
        conferenceAcronym: str(r.conference_acronym),
        conferenceLogoUrl: str(r.conference_logo_url),
        conferenceCountry: str(r.conference_country),
        conferenceSlug: slug,
        liveCount: num(r.live_count),
        inSessionCount: num(r.in_session_count),
      },
    };
  }
  const room = roomFrom(r);
  if (!room) return null;
  if (role === 'chair') return { role, key: `c:${room.sessionCode}`, room };
  if (role === 'advisor') {
    // Grouped into one entry per conference by `groupAdvisorRows`. A row from
    // before `conference_id` existed groups by the conference's slug / name.
    const conferenceId = str(r.conference_id) ?? room.conferenceSlug ?? room.conferenceName;
    return { role: 'advisor-room', room, conferenceId, students: num(r.students_in_room) };
  }
  if (role === 'delegate') {
    const countryName = str(r.country_name);
    if (!countryName) return null;
    return {
      role, key: `d:${room.sessionCode}`, room, countryName,
      countryCode: str(r.country_code),
      seat: r.seat == null ? null : num(r.seat),
    };
  }
  return null;
}

/**
 * The advisor rows come one per live room; the prompt and the menu show ONE entry
 * per conference, in the place of its first room, linking to the advisor board.
 */
function groupAdvisorRows(parsed: ParsedRow[]): LiveEntry[] {
  const out: LiveEntry[] = [];
  const byConf = new Map<string, Extract<LiveEntry, { role: 'advisor' }>>();
  for (const p of parsed) {
    if (p.role !== 'advisor-room') { out.push(p); continue; }
    const existing = byConf.get(p.conferenceId);
    if (existing) {
      existing.conference.liveCount += 1;
      existing.conference.studentsLive += p.students;
      existing.conference.sessionCodes.push(p.room.sessionCode);
      continue;
    }
    const entry: Extract<LiveEntry, { role: 'advisor' }> = {
      role: 'advisor',
      key: `a:${p.conferenceId}`,
      conference: {
        conferenceId: p.conferenceId,
        conferenceName: p.room.conferenceName,
        conferenceAcronym: p.room.conferenceAcronym,
        conferenceLogoUrl: p.room.conferenceLogoUrl,
        conferenceCountry: p.room.conferenceCountry,
        conferenceSlug: p.room.conferenceSlug,
        liveCount: 1,
        studentsLive: p.students,
        sessionCodes: [p.room.sessionCode],
      },
    };
    byConf.set(p.conferenceId, entry);
    out.push(entry);
  }
  return out;
}

/** Where each entry goes: exactly the path the join page takes after verification. */
export function liveEntryHref(e: LiveEntry): string {
  switch (e.role) {
    case 'organiser':
      return `/manage/${encodeURIComponent(e.conference.conferenceSlug)}/live`;
    case 'chair':
      // The join page's verified conference-chair path (chair_user_ids): no chair code,
      // and it records the chair name and the Moderator / Commenter choice.
      return `/join?code=${encodeURIComponent(e.room.sessionCode)}&mode=chair`;
    case 'delegate':
      // What /join routes a verified allocated delegate to (join/page.tsx handleJoin):
      // the allocation's country NAME, locked.
      return `/delegate/${e.room.sessionCode}?country=${encodeURIComponent(e.countryName)}&locked=1`;
    case 'advisor':
      // The Faculty Advisor board: the whole delegation, every room, no code typed.
      return '/advisor';
  }
}

// ── Walking into a chair's room without the chair code ────────────────────────

export interface ChairEntry {
  ok: boolean;
  /** True when THIS press opened the dais: nobody held the gavel until now. */
  started: boolean;
  moderator: boolean;
  chairCount: number;
  presentCount: number;
}

/**
 * `enter_live_chair_room(code, name, device)`: the server checks the caller is an
 * assigned chair of that room (`conference_committees.chair_user_ids`, a stronger
 * check than the anon-readable chair suffix), puts their name on `chair_names`
 * and claims the gavel ONLY when nobody holds it, under the committee's row lock.
 * So the "Start the session" / "Join as co-chair" outcome is decided at PRESS
 * TIME by the database: two chairs pressing together produce one Moderator and
 * one Commenter, never two. It writes no phase, caucus or clock.
 */
export async function enterLiveChairRoom(
  accessToken: string,
  code: string,
  chairName: string,
): Promise<ChairEntry | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('enter_live_chair_room', {
      p_code: code,
      p_name: chairName,
      p_device: getGavelDeviceId(code) || null,
    });
    const r = (data ?? null) as Row | null;
    if (error || !r || r.ok !== true) return null;
    return {
      ok: true,
      started: r.started === true,
      moderator: r.moderator === true,
      chairCount: num(r.chair_count),
      presentCount: num(r.present_count),
    };
  } catch {
    return null;
  }
}

/**
 * Where a press takes this person. For a chair it first walks them in (above) and
 * lands on the chair page with their profile name as the chair identity, so no
 * chair code is typed and no chair-code screen appears; if that call cannot be
 * answered it falls back to the join page's verified chair path, which asks for
 * nothing either. Every other role is a plain href.
 */
/** The chair's identity in a session is a NAME (AGENTS.md, CHAIR ROLES): their
 *  profile name, as the join page uses, so nothing has to be typed. */
export function chairIdentity(displayName: string | null | undefined, email: string | null | undefined): string {
  return (displayName ?? '').trim() || (email ?? '').trim().split('@')[0] || 'Chair';
}

export async function resolveEntryHref(
  e: LiveEntry,
  ctx: { accessToken: string | null; chairName: string },
): Promise<string> {
  if (e.role !== 'chair') return liveEntryHref(e);
  const name = ctx.chairName.trim();
  if (!ctx.accessToken || !name) return liveEntryHref(e);
  const res = await enterLiveChairRoom(ctx.accessToken, e.room.sessionCode, name);
  if (!res) return liveEntryHref(e);
  return `/chair/${e.room.sessionCode}?chairName=${encodeURIComponent(name)}`;
}

/**
 * The chairs whose chair page is open right now, from the same anon presence
 * channel the join page reads (`chair-presence-<committee id>`, presence key =
 * the chair's name). Read only: it never tracks, so the prompt never appears to
 * be a chair in the room. `[]` until the channel has synced.
 */
export function useChairPresence(sessionId: string | null): string[] {
  const [state, setState] = useState<{ id: string; names: string[] }>({ id: '', names: [] });
  useEffect(() => {
    if (!sessionId) return;
    const setNames = (names: string[]) => setState({ id: sessionId, names });
    const channel = supabase.channel(`chair-presence-${sessionId}`);
    const sync = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setNames(Object.keys(state).filter((n) => !!n.trim()));
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);
  // A room this hook has not synced yet reads as empty rather than as the previous room's dais.
  return sessionId && state.id === sessionId ? state.names : EMPTY_NAMES;
}

const EMPTY_NAMES: string[] = [];

export async function fetchMyLiveRooms(accessToken: string): Promise<LiveEntry[] | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('my_live_rooms');
    if (error || !Array.isArray(data)) return null;
    return groupAdvisorRows((data as Row[]).map(entryFrom).filter((e): e is ParsedRow => !!e));
  } catch {
    return null;
  }
}

// ── Shared cache ──────────────────────────────────────────────────────────────

interface CacheState { uid: string; at: number; entries: LiveEntry[] | null }
let cache: CacheState | null = null;
let inflight: { uid: string; p: Promise<void> } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(uid: string, token: string): Promise<void> {
  if (inflight && inflight.uid === uid) return inflight.p;
  const p = fetchMyLiveRooms(token).then((entries) => {
    // A failed read keeps the previous answer for this account rather than
    // flashing the section away.
    const prev = cache && cache.uid === uid ? cache.entries : null;
    cache = { uid, at: Date.now(), entries: entries ?? prev ?? [] };
    emit();
  }).finally(() => { if (inflight?.p === p) inflight = null; });
  inflight = { uid, p };
  return p;
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const getSnapshot = () => cache;
const getServerSnapshot = () => null;

/**
 * The caller's live rooms. `entries` is null until this account's first answer.
 * `maxAgeMs`: re-read when the cached answer is older (the menu passes 60 s when
 * it opens; the prompt reads once per page load).
 */
export function useLiveRooms(
  userId: string | null,
  accessToken: string | null,
  opts: { enabled?: boolean; maxAgeMs?: number } = {},
): { entries: LiveEntry[] | null } {
  const { enabled = true, maxAgeMs = Infinity } = opts;
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The token is read at fetch time only, so an hourly refresh never re-reads.
  const tokenRef = useRef<string | null>(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const hasToken = !!accessToken;
  useEffect(() => {
    const token = tokenRef.current;
    if (!enabled || !userId || !token) return;
    const fresh = cache && cache.uid === userId && Date.now() - cache.at < maxAgeMs;
    if (!fresh) void load(userId, token);
  }, [enabled, userId, maxAgeMs, hasToken]);
  if (!userId || !snap || snap.uid !== userId) return { entries: null };
  return { entries: snap.entries };
}
