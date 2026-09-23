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
//               assigned faculty-advisor application
//
// Shared by the prompt (`LiveRoomsGate`, root layout) and the profile menu's
// "Live now" section: one read per page load per account, re-read by the menu
// when the cached answer is more than a minute old.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getAuthedClient } from '@/lib/supabase-auth';

export type LiveRole = 'organiser' | 'chair' | 'delegate' | 'advisor';

export interface LiveRoomInfo {
  conferenceCommitteeId: string;
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

export type LiveEntry =
  | { role: 'organiser'; key: string; conference: LiveConferenceInfo }
  | { role: 'chair'; key: string; room: LiveRoomInfo }
  | { role: 'delegate'; key: string; room: LiveRoomInfo; countryName: string; countryCode: string | null; seat: number | null }
  | { role: 'advisor'; key: string; room: LiveRoomInfo };

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
    sessionCode: code.toUpperCase(),
    topic: str(r.topic),
    phase: String(r.phase ?? ''),
    suspended: r.suspended === true,
    started: r.started === true,
  };
}

function entryFrom(r: Row): LiveEntry | null {
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
  if (role === 'advisor') return { role, key: `a:${room.sessionCode}`, room };
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
      return `/advisor/${e.room.sessionCode}`;
  }
}

export async function fetchMyLiveRooms(accessToken: string): Promise<LiveEntry[] | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('my_live_rooms');
    if (error || !Array.isArray(data)) return null;
    return (data as Row[]).map(entryFrom).filter((e): e is LiveEntry => !!e);
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
