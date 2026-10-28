// ── Removing seats from a committee whose live room is running ──────────────
//
// Owner, 23 Oct 2026: "no ghost speaker". When an organiser removes a seat in Manage →
// Committees (CommitteeEditorModal), the seat's `delegates` row is deleted. Its
// `speakers_list` rows go with it (ON DELETE CASCADE), but `current_speaker.delegate_id` is
// ON DELETE SET NULL, so the floor kept the country with no delegation behind it, and the
// Moderator's laptop (which never reads current_speaker events, AGENTS.md RULE 6) kept
// timing a speaker who no longer existed. An open ballot kept the seat in its frozen line.
//
// So the editor first ASKS, in place, when a removed seat is in use in the room
// (`readLiveSeatUse`), and when the organiser goes ahead it clears the floor of those seats
// BEFORE the delete (`clearFloorOfSeats`, the same shape as the chair page's conditional
// clear: delegate_id and country together, conditional on who is seated). The chair page's
// own guard (`floorGoneKey`) then logs the speech and resets its clock on the Moderator's
// device. The live tables are anon-readable (`sess_select true`); only the clear needs the
// session-header client.

import { supabase as anonSupabase } from '@/lib/supabase';
import type { sessionClient } from '@/lib/sessionClient';
import { parseVoteState, isVoteOpen } from '@/lib/voteState';

export interface LiveSeatUse {
  /** Removed seats holding the floor (GSL or moderated caucus). */
  speaking: string[];
  /** Removed seats on the speakers list or the caucus queue. */
  listed: string[];
  /** Removed seats in a ballot that is still open. */
  voting: string[];
  /** `delegates.id` of every removed seat, for the floor clear. */
  delegateIds: Record<string, string>;
}

const lower = (s: string) => s.trim().toLowerCase();

/** Which of `names` the live room `sessionId` is using right now. null = the room could not be read. */
export async function readLiveSeatUse(sessionId: string, names: string[]): Promise<LiveSeatUse | null> {
  if (names.length === 0) return { speaking: [], listed: [], voting: [], delegateIds: {} };
  const wanted = new Map(names.map((n) => [lower(n), n]));
  try {
    const [dRes, csRes, slRes, cmRes, docRes] = await Promise.all([
      anonSupabase.from('delegates').select('id, country').eq('committee_id', sessionId),
      anonSupabase.from('current_speaker').select('delegate_id, country').eq('committee_id', sessionId).maybeSingle(),
      anonSupabase.from('speakers_list').select('delegate_id').eq('committee_id', sessionId),
      anonSupabase.from('committees').select('phase, caucus').eq('id', sessionId).maybeSingle(),
      anonSupabase.from('documents').select('vote_state').eq('committee_id', sessionId).not('vote_state', 'is', null),
    ]);
    if (dRes.error || csRes.error || slRes.error || cmRes.error || docRes.error) return null;
    const delegateIds: Record<string, string> = {};
    const nameById = new Map<string, string>();
    for (const d of (dRes.data ?? []) as { id: string; country: string }[]) {
      const name = wanted.get(lower(d.country));
      if (!name) continue;
      delegateIds[name] = d.id;
      nameById.set(d.id, name);
    }
    const speaking = new Set<string>();
    const cs = csRes.data as { delegate_id: string | null; country: string | null } | null;
    if (cs?.country) {
      const byId = cs.delegate_id ? nameById.get(cs.delegate_id) : undefined;
      const byName = wanted.get(lower(cs.country));
      if (byId || byName) speaking.add((byId || byName)!);
    }
    const cm = cmRes.data as { phase: string | null; caucus: { currentSpeaker?: unknown } | null } | null;
    const caucusFloor = cm?.phase === 'moderated-caucus' && typeof cm.caucus?.currentSpeaker === 'string'
      ? wanted.get(lower(cm.caucus.currentSpeaker)) : undefined;
    if (caucusFloor) speaking.add(caucusFloor);
    const listed = new Set<string>();
    for (const r of (slRes.data ?? []) as { delegate_id: string | null }[]) {
      const name = r.delegate_id ? nameById.get(r.delegate_id) : undefined;
      if (name && !speaking.has(name)) listed.add(name);
    }
    const voting = new Set<string>();
    for (const row of (docRes.data ?? []) as { vote_state: unknown }[]) {
      const vs = parseVoteState(row.vote_state);
      if (!isVoteOpen(vs)) continue;
      for (const seat of [...vs!.order, ...vs!.votable]) {
        const name = nameById.get(seat.id) ?? wanted.get(lower(seat.country));
        if (name) voting.add(name);
      }
    }
    return { speaking: [...speaking], listed: [...listed], voting: [...voting], delegateIds };
  } catch {
    return null;
  }
}

/** One plain sentence per kind of use, for the in-place confirm. Empty = nothing in use. */
export function liveSeatUseLines(use: LiveSeatUse): string[] {
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const lines: string[] = [];
  if (use.speaking.length > 0) lines.push(`${list(use.speaking)} ${use.speaking.length === 1 ? 'is' : 'are'} speaking in the live room right now. Removing ${use.speaking.length === 1 ? 'it' : 'them'} ends that speech.`);
  if (use.listed.length > 0) lines.push(`${list(use.listed)} ${use.listed.length === 1 ? 'is' : 'are'} waiting to speak and will leave the speakers list.`);
  if (use.voting.length > 0) lines.push(`${list(use.voting)} ${use.voting.length === 1 ? 'is' : 'are'} in a vote that is still open.`);
  return lines;
}

/**
 * Take the removed seats off the floor before their rows are deleted: delegate_id and
 * country cleared together, the clock stopped, conditional on each seat still being the
 * one seated (another seat called meanwhile is left alone). Returns false when a clear
 * could not be written; the delete still goes ahead and the chair page's guard clears the
 * floor on the Moderator's device.
 */
export async function clearFloorOfSeats(
  client: ReturnType<typeof sessionClient>,
  sessionId: string,
  seats: { name: string; delegateId: string | null }[],
): Promise<boolean> {
  let ok = true;
  for (const seat of seats) {
    let q = client.from('current_speaker')
      .update({ delegate_id: null, country: null, time_remaining: 0, started_at: null, seated_at: null })
      .eq('committee_id', sessionId);
    q = seat.delegateId ? q.eq('delegate_id', seat.delegateId) : q.eq('country', seat.name);
    const { error } = await q.select('committee_id');
    if (error) ok = false;
  }
  return ok;
}
