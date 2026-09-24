'use client';

// CONTRACT between the Faculty Advisor board (/advisor, src/lib/advisorBoard/*)
// and the conference side (P1b). A signed-in faculty advisor or head delegate
// of an accepted / assigned / checked-in application gets their delegation's
// seats here, so the board fills itself with no code typed. Observers get the
// conference's rooms with no students (`seats` empty).
//
// The board treats these exactly like rooms added by code, except:
//   • names come from the applications (never typed, never stored locally),
//   • `verified` is true. (There is no single-room view any more: /advisor/CODE
//     redirects to the board since 24 Sep 2026, so nothing links out of the board.)
//
// Source: the SECURITY DEFINER RPC my_advisor_delegation() (authenticated only,
// caller's own society only; never an email, a student's user id or anything from
// committees.settings). One read per account per page load, shared by every
// component that calls the hook; `reload()` reads again.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

export interface AdvisorDelegationSeat {
  /** The live session this seat sits in (committees.code). Null when the
   *  committee has no session yet: the board shows it as "not open yet". */
  sessionCode: string | null;
  committeeName: string;
  committeeAbbreviation: string | null;
  countryName: string;
  countryCode: string | null;
  /** 1, or 2 for the second seat of a double delegation. */
  seat: number;
  /** The student's display name (profiles.display_name, else invited_name). */
  studentName: string | null;
  /** 'delegate' | 'head-delegate' | ...: the student's own application role. */
  role: string | null;
}

export interface AdvisorDelegationRoom {
  sessionCode: string;
  committeeName: string;
  committeeAbbreviation: string | null;
}

export interface AdvisorConference {
  conferenceId: string;
  conferenceName: string;
  conferenceAcronym: string | null;
  conferenceLogoUrl: string | null;
  /** 'faculty-advisor' | 'head-delegate' | 'observer' */
  myRole: string;
  /** Public page slug (`/conferences/<slug>`). */
  conferenceSlug: string | null;
  /** ISO dates (YYYY-MM-DD); endDate falls back to startDate. */
  startDate: string | null;
  endDate: string | null;
  societyName: string | null;
  seats: AdvisorDelegationSeat[];
  /** Every live-able room of the conference (observers follow these). */
  rooms: AdvisorDelegationRoom[];
  verified: true;
}

export interface AdvisorDelegationState {
  status: 'signed-out' | 'loading' | 'ready' | 'error';
  conferences: AdvisorConference[];
  reload: () => void;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === 'object') : []);

function seatFrom(r: Row): AdvisorDelegationSeat | null {
  const committeeName = str(r.committeeName);
  const countryName = str(r.countryName);
  if (!committeeName || !countryName) return null;
  const code = str(r.sessionCode);
  return {
    sessionCode: code ? code.toUpperCase() : null,
    committeeName,
    committeeAbbreviation: str(r.committeeAbbreviation),
    countryName,
    countryCode: str(r.countryCode),
    seat: typeof r.seat === 'number' && r.seat > 0 ? r.seat : 1,
    studentName: str(r.studentName),
    role: str(r.role),
  };
}

function roomFrom(r: Row): AdvisorDelegationRoom | null {
  const code = str(r.sessionCode);
  const committeeName = str(r.committeeName);
  if (!code || !committeeName) return null;
  return { sessionCode: code.toUpperCase(), committeeName, committeeAbbreviation: str(r.committeeAbbreviation) };
}

function conferenceFrom(r: Row): AdvisorConference | null {
  const conferenceId = str(r.conferenceId);
  const myRole = str(r.myRole);
  if (!conferenceId || !myRole) return null;
  return {
    conferenceId,
    conferenceName: str(r.conferenceName) ?? '',
    conferenceAcronym: str(r.conferenceAcronym),
    conferenceLogoUrl: str(r.conferenceLogoUrl),
    conferenceSlug: str(r.conferenceSlug),
    startDate: str(r.startDate),
    endDate: str(r.endDate),
    myRole,
    societyName: str(r.societyName),
    seats: rows(r.seats).map(seatFrom).filter((s): s is AdvisorDelegationSeat => !!s),
    rooms: rows(r.rooms).map(roomFrom).filter((x): x is AdvisorDelegationRoom => !!x),
    verified: true,
  };
}

/** One read of `my_advisor_delegation()`. Null when it could not be answered. */
export async function fetchMyAdvisorDelegation(accessToken: string): Promise<AdvisorConference[] | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('my_advisor_delegation');
    if (error || !Array.isArray(data)) return null;
    return rows(data).map(conferenceFrom).filter((c): c is AdvisorConference => !!c);
  } catch {
    return null;
  }
}

// ── Shared cache (per account, for this page load) ───────────────────────────

interface CacheState { uid: string; status: 'loading' | 'ready' | 'error'; conferences: AdvisorConference[] }
let cache: CacheState | null = null;
let inflight: { uid: string; p: Promise<void> } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => cache;
const getServerSnapshot = () => null;

function load(uid: string, token: string): Promise<void> {
  if (inflight && inflight.uid === uid) return inflight.p;
  const prev = cache && cache.uid === uid ? cache.conferences : [];
  cache = { uid, status: 'loading', conferences: prev };
  emit();
  const p = fetchMyAdvisorDelegation(token).then((conferences) => {
    // A newer account took over while this was in flight: drop the answer.
    if (!cache || cache.uid !== uid) return;
    cache = conferences
      ? { uid, status: 'ready', conferences }
      : { uid, status: 'error', conferences: prev };
    emit();
  }).finally(() => { if (inflight?.p === p) inflight = null; });
  inflight = { uid, p };
  return p;
}

const EMPTY: AdvisorConference[] = [];

/**
 * The signed-in user's delegations (faculty advisor / head delegate) and observed
 * conferences. Keyed on the USER ID, never the access token (AGENTS.md, ACCESS
 * GUARD): the token is read through a ref at fetch time, so the hourly refresh
 * never re-reads or flashes a loader. One read per account per page load.
 */
export function useMyAdvisorDelegation(): AdvisorDelegationState {
  const { user, session, loading } = useAuth();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tokenRef = useRef<string | null>(session?.access_token ?? null);
  useEffect(() => { tokenRef.current = session?.access_token ?? null; }, [session?.access_token]);
  const userId = loading ? null : user?.id ?? null;
  const hasToken = !!session?.access_token;

  useEffect(() => {
    const token = tokenRef.current;
    if (!userId || !token) return;
    if (cache && cache.uid === userId) return;
    void load(userId, token);
  }, [userId, hasToken]);

  const reload = useCallback(() => {
    const token = tokenRef.current;
    if (!userId || !token) return;
    void load(userId, token);
  }, [userId]);

  if (loading) return { status: 'loading', conferences: EMPTY, reload };
  if (!user) return { status: 'signed-out', conferences: EMPTY, reload };
  if (!snap || snap.uid !== user.id) return { status: 'loading', conferences: EMPTY, reload };
  return { status: snap.status, conferences: snap.conferences, reload };
}
