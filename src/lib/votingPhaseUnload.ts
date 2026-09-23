// ============================================================
// src/lib/votingPhaseUnload.ts
//
// ROOMS STUCK IN `voting` (23 Sep 2026). /voting/[code] puts the room into the voting
// phase when the Moderator opens it, and only "Back to Session" took it out again. A chair
// who closed the tab, lost the laptop lid or navigated away left the room on "Vote in
// progress" for every delegate phone, with no ballot anywhere (NFENSM, SEC404 in
// production). Two releases now exist:
//
//   1. The voting page, on `pagehide`, when this device is the Moderator and NO vote is
//      open, calls `set_committee_voting_phase(false)` with a keepalive fetch
//      (`leaveVotingPhaseKeepalive`): supabase-js does not use keepalive, so a normal RPC
//      would be cancelled with the page.
//   2. The chair page, on load, as the Moderator, when the row says `voting` and no
//      document has an open vote_state, restores the remembered phase itself. It stands
//      down while a voting tab on this device reported itself alive in the last 45 s
//      (`markVotingTabAlive` / `votingTabAliveRecently`), so opening the chair page in a
//      second tab never pulls the room out from under a roll call that is about to start.
//
// Neither touches committee state directly; the phase change arrives through realtime.
// The RPC is a no-op when the room is not voting, and it is gated on the chair suffix
// exactly like every other session write (rule 15: not a permission).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export function leaveVotingPhaseKeepalive(committeeId: string, code: string, chairSuffix?: string): void {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      'x-session-code': code,
    };
    if (chairSuffix) headers['x-chair-suffix'] = chairSuffix;
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/set_committee_voting_phase`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_committee: committeeId, p_enter: false }),
      keepalive: true,
    }).catch(() => { /* best effort: the chair page releases it on its next load */ });
  } catch { /* old browser */ }
}

const aliveKey = (code: string) => `gavelling-voting-tab-alive:${code.toUpperCase()}`;
const ALIVE_MS = 45_000;

/** The voting page stamps this every 20 s while it is open as the Moderator. */
export function markVotingTabAlive(code: string, alive: boolean): void {
  try {
    if (alive) localStorage.setItem(aliveKey(code), String(Date.now()));
    else localStorage.removeItem(aliveKey(code));
  } catch { /* storage unavailable */ }
}

export function votingTabAliveRecently(code: string): boolean {
  try {
    const v = Number(localStorage.getItem(aliveKey(code)) ?? 0);
    return v > 0 && Date.now() - v < ALIVE_MS;
  } catch { return false; }
}
