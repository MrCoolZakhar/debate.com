// The seat writes behind the People table's drag and its seat cell buttons.
//
// switchSeats is the one swap path (the People table's Swap allocations, a
// drag, "Switch with" in the row menu): perform_delegation_swap when the
// conference lets leaders reshuffle (allocation_swap_mode = 'self_serve'), with
// no swap_notice row any more (owner, 21 Oct 2026); else a swap_request row on
// conference_requests for the organising team with its message row and the
// gv-requests-changed event. Both send the delegation_swap email through the
// participant-events route.
//
// moveSeat (DELEGATIONS_V2_DB only): a seated member's seat goes to a member with
// no seat. delegation_place_member refuses a seat someone sits in, so it is two
// writes: delegation_unplace_member (the seat becomes an open block seat and its
// allocation id comes back), then delegation_place_member for the new person. If
// the second write is refused the first person is put back in the same seat.

import { getFreshAuthedClient, supabaseAuthClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { queueParticipantEventEmail } from '@/lib/emailEvents';
import { placeMember, type Result } from '../v2';

const SIGNED_OUT = 'Your session has expired. Refresh the page and sign in again.';

export type SwapMode = 'self_serve' | 'request' | 'off';

export interface SeatSide {
  applicationId: string;
  name: string;
  /** "UNHRC: Germany", the label the swap request and notice carry. */
  label: string;
}

export async function switchSeats(args: {
  conferenceId: string;
  societyId: string;
  societyName: string | null;
  mode: 'self_serve' | 'request';
  a: SeatSide;
  b: SeatSide;
}): Promise<Result> {
  const { a, b, mode, conferenceId, societyId } = args;
  const fallback = mode === 'self_serve' ? 'The allocations could not be switched. Try again.' : 'The switch could not be requested. Try again.';
  try {
    const { data: { session } } = await supabaseAuthClient.auth.getSession();
    const c = await getFreshAuthedClient();
    if (!c || !session) return { ok: false, error: SIGNED_OUT };
    const userId = session.user.id;
    const subject = `Allocation swap in ${args.societyName ?? 'this delegation'}`;
    const metadata = {
      society_id: societyId,
      app_a: a.applicationId, app_b: b.applicationId,
      member_a: a.name, member_b: b.name,
      before: { a: a.label, b: b.label },
      after: { a: b.label, b: a.label },
    };

    if (mode === 'self_serve') {
      const { data, error } = await c.rpc('perform_delegation_swap', { p_app_a: a.applicationId, p_app_b: b.applicationId });
      if (error) return { ok: false, error: friendlyError(error, fallback) };
      const r = (data ?? {}) as { ok?: boolean; error?: string };
      if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error, fallback) };
      // No swap_notice row any more (owner, 21 Oct 2026): organisers do not
      // need a message for every self-serve swap. The two delegates still get
      // the delegation_swap email below.
    } else {
      const { data: reqRow, error } = await c.from('conference_requests').insert({
        conference_id: conferenceId, user_id: userId, kind: 'swap_request', subject, metadata,
      }).select('id').single();
      if (error || !reqRow) return { ok: false, error: friendlyError(error, fallback) };
      await c.from('conference_request_messages').insert({
        request_id: (reqRow as { id: string }).id, sender_user_id: userId, is_organizer: false,
        body: `Requesting to swap allocations: ${a.name} (${a.label}) and ${b.name} (${b.label}).`,
      });
    }
    await queueParticipantEventEmail(session.access_token, conferenceId, 'delegation_swap', [a.applicationId, b.applicationId]);
    // Only a request opens a thread the Requests panel lists.
    if (mode === 'request') window.dispatchEvent(new CustomEvent('gv-requests-changed'));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** Takes a member out of their seat and answers the seat's allocation id. */
async function unplaceForMove(applicationId: string): Promise<{ ok: true; allocationId: string } | { ok: false; error: string }> {
  const fallback = 'The allocation could not be moved. Try again.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('delegation_unplace_member', { p_application: applicationId });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; error?: string; allocation_id?: string | null };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error, fallback) };
    if (!r.allocation_id) return { ok: false, error: fallback };
    return { ok: true, allocationId: r.allocation_id };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** DELEGATIONS_V2_DB only: from's seat goes to `to`, who has none. */
export async function moveSeat(fromApplicationId: string, toApplicationId: string): Promise<Result> {
  const out = await unplaceForMove(fromApplicationId);
  if (!out.ok) return out;
  const placed = await placeMember(toApplicationId, out.allocationId);
  if (placed.ok) return placed;
  // Put the first person back where they were; the refusal is what is shown.
  await placeMember(fromApplicationId, out.allocationId);
  return placed;
}
