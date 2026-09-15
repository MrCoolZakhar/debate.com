// Settings → People: who is connected to a live session, and the chair-side removals.
//
// Contract (migration `session_participants_and_chair_kick`, 15 Sep 2026):
//   • `session_participants(p_code)` SECURITY DEFINER, gated on is_session_chair (the
//     x-chair-suffix header sent by sessionClient). Returns chair names, the gavel holder,
//     live delegate seat claims (country, account or guest device, last seen, active),
//     signed-in chair devices and, for a conference session, the assigned conference
//     chairs by display name. Never an email, a user id, a holder key or a device hash:
//     `key` is the first 16 hex chars of sha256(user id), opaque and only good for
//     release_chair_device_claim.
//   • `kick_delegate_seat(p_code, p_country)` deletes every claim on the seat and writes a
//     tombstone (`delegate_seat_kicks`, RLS on, no policies). For 10 minutes
//     claim_delegate_seat answers `kicked` to those holders (and their devices) for that
//     seat; anyone else may take it.
//   • `remove_session_chair(p_code, p_name)` removes a Commenter's name from chair_names.
//     Never the gavel holder (`moderator`).
//   • `release_chair_device_claim(p_code, p_key)` forgets a signed-in chair account's
//     device claim.
//
// Not a security boundary (AGENTS.md rule 15): the chair suffix is anon-readable and is
// the only credential these check, and the Moderator-only gate is in the UI. A removed
// delegate can take ANOTHER open seat, and a removed chair can rejoin with the chair code.
import { sessionClient } from '@/lib/sessionClient';
import { supabase } from '@/lib/supabase';

export interface ParticipantSeat {
  country: string;
  kind: 'account' | 'device';
  claimedAt: string;
  lastSeenAt: string;
  active: boolean;
}
export interface ParticipantChairDevice {
  key: string;
  name: string | null;
  conferenceChair: boolean;
  lastSeenAt: string;
  active: boolean;
}
export interface ConferenceChair {
  key: string;
  name: string | null;
  joined: boolean;
}
export interface SessionParticipants {
  isConference: boolean;
  chairNames: string[];
  headChair: string | null;
  seats: ParticipantSeat[];
  chairDevices: ParticipantChairDevice[];
  conferenceChairs: ConferenceChair[];
  recentKicks: { country: string; kickedAt: string }[];
  /** Database clock at read time, so "3 min ago" is not skewed by this device's clock. */
  serverNow: string;
}

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** null = could not read (network, or this device does not hold the chair code). */
export async function getSessionParticipants(code: string, chairSuffix?: string | null): Promise<SessionParticipants | null> {
  if (!chairSuffix) return null;
  try {
    const { data, error } = await sessionClient(code.toUpperCase(), chairSuffix).rpc('session_participants', { p_code: code.toUpperCase() });
    if (error || !data || (data as Raw).ok !== true) return null;
    const d = data as Raw;
    return {
      isConference: d.is_conference === true,
      chairNames: Array.isArray(d.chair_names) ? (d.chair_names as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      headChair: typeof d.head_chair === 'string' ? d.head_chair : null,
      seats: arr(d.seats).map((s) => ({
        country: str(s.country),
        kind: s.kind === 'account' ? 'account' : 'device',
        claimedAt: str(s.claimed_at),
        lastSeenAt: str(s.last_seen_at),
        active: s.active === true,
      })),
      chairDevices: arr(d.chair_devices).map((c) => ({
        key: str(c.key),
        name: typeof c.name === 'string' ? c.name : null,
        conferenceChair: c.conference_chair === true,
        lastSeenAt: str(c.last_seen_at),
        active: c.active === true,
      })),
      conferenceChairs: arr(d.conference_chairs).map((c) => ({
        key: str(c.key),
        name: typeof c.name === 'string' ? c.name : null,
        joined: c.joined === true,
      })),
      recentKicks: arr(d.recent_kicks).map((k) => ({ country: str(k.country), kickedAt: str(k.kicked_at) })),
      serverNow: str(d.server_now) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function rpcOk(code: string, suffix: string | null | undefined, fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; reason?: string }> {
  if (!suffix) return { ok: false, reason: 'denied' };
  try {
    const { data, error } = await sessionClient(code.toUpperCase(), suffix).rpc(fn, args);
    if (error || !data) return { ok: false, reason: 'error' };
    const d = data as Raw;
    return { ok: d.ok === true, reason: typeof d.reason === 'string' ? d.reason : undefined };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Realtime topic the delegate page listens on for an instant re-verify after a kick. */
export function seatKickTopic(committeeId: string): string {
  return `seat-kick-${committeeId}`;
}

/**
 * Remove whoever holds a seat. On success, also nudges the removed phone over Realtime so
 * it re-verifies at once instead of within 30 s. The phone never trusts the broadcast: it
 * asks claim_delegate_seat, which answers `kicked` only when the tombstone names it.
 */
export async function kickDelegateSeat(code: string, suffix: string | null | undefined, committeeId: string, country: string): Promise<boolean> {
  const res = await rpcOk(code, suffix, 'kick_delegate_seat', { p_code: code.toUpperCase(), p_country: country });
  if (res.ok) void nudgeSeat(committeeId, country);
  return res.ok;
}

async function nudgeSeat(committeeId: string, country: string): Promise<void> {
  try {
    const channel = supabase.channel(seatKickTopic(committeeId));
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 4000);
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void channel.send({ type: 'broadcast', event: 'kicked', payload: { c: country.trim().toLowerCase() } })
          .finally(() => { clearTimeout(timer); resolve(); });
      });
    });
    setTimeout(() => { void supabase.removeChannel(channel); }, 500);
  } catch { /* best effort: the 30 s re-verify still catches it */ }
}

/** 'moderator' when the name holds the gavel (refused by the server too). */
export async function removeSessionChair(code: string, suffix: string | null | undefined, name: string): Promise<{ ok: boolean; reason?: string }> {
  return rpcOk(code, suffix, 'remove_session_chair', { p_code: code.toUpperCase(), p_name: name });
}

export async function releaseChairDeviceClaim(code: string, suffix: string | null | undefined, key: string): Promise<boolean> {
  return (await rpcOk(code, suffix, 'release_chair_device_claim', { p_code: code.toUpperCase(), p_key: key })).ok;
}
