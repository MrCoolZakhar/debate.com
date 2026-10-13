'use client';

/**
 * Press committees, the Press Desk and press releases (owner's first draft, 12 Oct 2026).
 *
 * A conference committee may be `committee_type = 'press'` (International Press Corps):
 * its seats are outlets or journalists. Its seat holders and chairs, and the conference's
 * accepted observers, get the Press Desk, a read-only live view of every committee room
 * (`press_desk`). Press seat holders and press chairs (never observers) can send a short
 * press release (`send_press_release`, 3 in any 24 hours), which lands in every open room's
 * Everyone chat as "Press · <outlet>" (session_broadcasts rows with source = 'press', drawn by
 * src/lib/broadcastMessages.ts + SecretariatMessage). There is no chat with delegates.
 *
 * The SQL lives in scratch-press.sql and is NOT applied yet. Until it is, every read here
 * answers `missing`: the You tab draws nothing, the Press type card is not offered in the
 * committee editor, and /conferences/[slug]/press says it is not available.
 *
 * Every client is fetched fresh at call time (getFreshAuthedClient), never a token captured in
 * React state.
 */

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from './supabase-auth';
import { friendlyError } from './friendlyError';

// ── Types ───────────────────────────────────────────────────────────────────

export type PressRole = 'press_seat' | 'press_chair' | 'observer';

export interface PressAccess {
  eligible: boolean;
  role: PressRole | null;
  /** Press seats and press chairs; never observers. */
  canRelease: boolean;
  /** What a release is signed with: the outlet / seat name, or the press committee's acronym. */
  label: string | null;
  releasesLeft: number;
  nextReleaseAt: string | null;
}

export interface PressSeat { country: string; logoUrl: string | null }

export interface PressMotion {
  id: string;
  type: string;
  proposedBy: string;
  topic: string | null;
  totalTime: number | null;
  speakingTime: number | null;
  tourOrder: string | null;
}

export interface PressDocument {
  id: string;
  docCode: string | null;
  title: string;
  type: string;
  status: 'introduced' | 'passed' | 'failed' | string;
  sponsors: string[];
  fileUrl: string | null;
  fileName: string | null;
  content: string | null;
  votingNow: boolean;
}

export interface PressRoomSession {
  phase: string;
  suspended: boolean;
  ended: boolean;
  topic: string | null;
  caucus: { type: string | null; purpose: string | null; motionLabel: string | null; isConsultation: boolean } | null;
  speaker: PressSeat | null;
  next: PressSeat[];
  motions: PressMotion[];
  documents: PressDocument[];
}

export interface PressRoom {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  committeeType: string;
  session: PressRoomSession | null;
}

export interface PressDesk extends PressAccess { rooms: PressRoom[] }

export type PressResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'missing' }
  | { kind: 'denied'; message: string }
  | { kind: 'error' };

// ── Helpers ─────────────────────────────────────────────────────────────────

function isMissingFunction(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? '');
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseAccess(o: Record<string, unknown>): PressAccess {
  const role = o.role === 'press_seat' || o.role === 'press_chair' || o.role === 'observer' ? o.role : null;
  const eligible = o.eligible === true && !!role;
  const canRelease = eligible && o.can_release === true && role !== 'observer';
  return {
    eligible,
    role,
    canRelease,
    label: str(o.label),
    releasesLeft: canRelease ? Math.max(0, num(o.releases_left) ?? 0) : 0,
    nextReleaseAt: str(o.next_release_at),
  };
}

function parseSeat(v: unknown): PressSeat | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const country = str(o.country);
  return country ? { country, logoUrl: str(o.logo_url) } : null;
}

function parseRoom(v: unknown): PressRoom | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;
  let session: PressRoomSession | null = null;
  if (o.session && typeof o.session === 'object') {
    const s = o.session as Record<string, unknown>;
    const c = s.caucus && typeof s.caucus === 'object' ? (s.caucus as Record<string, unknown>) : null;
    session = {
      phase: str(s.phase) ?? 'pre-session',
      suspended: s.suspended === true,
      ended: s.ended === true,
      topic: str(s.topic),
      caucus: c ? { type: str(c.type), purpose: str(c.purpose), motionLabel: str(c.motion_label), isConsultation: c.is_consultation === true } : null,
      speaker: parseSeat(s.speaker),
      next: Array.isArray(s.next) ? s.next.map(parseSeat).filter((x): x is PressSeat => !!x).slice(0, 3) : [],
      motions: Array.isArray(s.motions) ? s.motions.flatMap((m): PressMotion[] => {
        if (!m || typeof m !== 'object') return [];
        const r = m as Record<string, unknown>;
        const mid = str(r.id); const type = str(r.type);
        if (!mid || !type) return [];
        return [{ id: mid, type, proposedBy: str(r.proposed_by) ?? '', topic: str(r.topic), totalTime: num(r.total_time), speakingTime: num(r.speaking_time), tourOrder: str(r.tour_order) }];
      }) : [],
      documents: Array.isArray(s.documents) ? s.documents.flatMap((d): PressDocument[] => {
        if (!d || typeof d !== 'object') return [];
        const r = d as Record<string, unknown>;
        const did = str(r.id);
        const status = str(r.status);
        // The server sends only introduced, passed and failed papers; re-checked here.
        if (!did || !status || !['introduced', 'passed', 'failed'].includes(status)) return [];
        return [{
          id: did, docCode: str(r.doc_code), title: str(r.title) ?? '', type: str(r.type) ?? 'working-paper', status,
          sponsors: Array.isArray(r.sponsors) ? r.sponsors.filter((x): x is string => typeof x === 'string') : [],
          fileUrl: str(r.file_url), fileName: str(r.file_name), content: str(r.content), votingNow: r.voting_now === true,
        }];
      }) : [],
    };
  }
  return {
    id, name: str(o.name) ?? '', abbreviation: str(o.abbreviation), logoUrl: str(o.logo_url),
    committeeType: str(o.committee_type) ?? 'general-assembly', session,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Who the caller is at this conference's press desk. */
export async function fetchMyPressAccess(conferenceId: string): Promise<PressResult<PressAccess>> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { kind: 'error' };
  const { data, error } = await supabase.rpc('my_press_access', { p_conference: conferenceId });
  if (error) return isMissingFunction(error) ? { kind: 'missing' } : { kind: 'error' };
  const o = (data ?? {}) as Record<string, unknown>;
  return { kind: 'ok', value: parseAccess(o) };
}

/** Every committee room, read only. */
export async function fetchPressDesk(conferenceId: string): Promise<PressResult<PressDesk>> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { kind: 'error' };
  const { data, error } = await supabase.rpc('press_desk', { p_conference: conferenceId });
  if (error) return isMissingFunction(error) ? { kind: 'missing' } : { kind: 'error' };
  const o = (data ?? {}) as Record<string, unknown>;
  if (o.ok !== true) {
    return { kind: 'denied', message: str(o.message) ?? 'The Press Desk is for the press and observers of this conference.' };
  }
  const access = parseAccess({ ...o, eligible: true });
  const rooms = Array.isArray(o.rooms) ? o.rooms.map(parseRoom).filter((r): r is PressRoom => !!r) : [];
  return { kind: 'ok', value: { ...access, rooms } };
}

/** Whether press committees are switched on (the SQL is applied). One probe per page load,
 *  shared: `my_press_access` with no conference answers instantly and writes nothing. */
let availability: Promise<boolean> | null = null;
export function pressCommitteesAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const supabase = await getFreshAuthedClient();
        if (!supabase) return false;
        const { error } = await supabase.rpc('my_press_access', { p_conference: null });
        return !error || !isMissingFunction(error);
      } catch { return false; }
    })();
    // A failed probe (signed out, offline) may be asked again later.
    void availability.then((ok) => { if (!ok) availability = null; });
  }
  return availability;
}

export function usePressCommitteesAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    void pressCommitteesAvailable().then((v) => { if (alive) setOk(v); });
    return () => { alive = false; };
  }, []);
  return ok;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export const PRESS_RELEASE_MAX = 600;
export const PRESS_RELEASES_PER_DAY = 3;

export type SendReleaseResult =
  | { ok: true; sentTo: number; releasesLeft: number; nextReleaseAt: string | null }
  | { ok: false; message: string; releasesLeft?: number; nextReleaseAt?: string | null };

export async function sendPressRelease(conferenceId: string, message: string, imageUrl: string | null): Promise<SendReleaseResult> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { ok: false, message: 'Your session has expired. Sign in again, then send it.' };
  const { data, error } = await supabase.rpc('send_press_release', {
    p_conference: conferenceId, p_message: message, p_image_url: imageUrl,
  });
  if (error) {
    return { ok: false, message: isMissingFunction(error) ? 'Press releases are not switched on yet.' : friendlyError(error, "Couldn't send the press release. Try again.") };
  }
  const o = (data ?? {}) as Record<string, unknown>;
  if (o.ok !== true) {
    return {
      ok: false,
      message: str(o.message) ?? "Couldn't send the press release. Try again.",
      releasesLeft: num(o.releases_left) ?? undefined,
      nextReleaseAt: str(o.next_release_at),
    };
  }
  return { ok: true, sentTo: num(o.sent_to) ?? 0, releasesLeft: num(o.releases_left) ?? 0, nextReleaseAt: str(o.next_release_at) };
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** The press release's photo: the SAME bucket and path as an organiser broadcast
 *  (`conference-assets/broadcasts/<conference uuid>-<epoch ms>.<ext>`), the one shape
 *  trustedBroadcastImageUrl draws and send_press_release accepts. */
export async function uploadPressImage(conferenceId: string, file: File): Promise<{ url?: string; error?: string }> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: 'Attach a JPEG, PNG, WebP or GIF.' };
  if (file.size > 5 * 1024 * 1024) return { error: 'Image must be under 5MB.' };
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { error: 'Your session has expired. Sign in again, then attach it.' };
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png';
  const path = `broadcasts/${conferenceId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: friendlyError(error, "Couldn't upload the image. Try a different one.") };
  const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
  return { url: data.publicUrl };
}
