/**
 * "Request again" for a request to speak that is already waiting (23 Oct 2026).
 *
 * The sticky GSL request card is the chair's only way to answer a request to speak. Its x
 * closes the card without deciding, and the phone's "Request again" (after the 60 s no-answer
 * window) used to write nothing because a request was already pending, so no event reached
 * the chair and a dismissed card never came back: the delegation was stranded.
 *
 * Now `requestGslSpot` nudges the dais when its request is already pending: it touches the row
 * (a motions UPDATE event, where the policy lets a phone write it) AND sends this Realtime
 * broadcast, which needs no table write at all. The chair page re-raises a DISMISSED card for
 * that request on either signal. Best effort: nothing is decided by it, and a card that is
 * still on screen is left as it is.
 */
import { supabase } from './supabase';

export function gslNudgeTopic(committeeId: string): string {
  return `gsl-nudge-${committeeId}`;
}

export const GSL_NUDGE_EVENT = 'nudge';

export async function sendGslNudge(committeeId: string, motionId: string): Promise<void> {
  try {
    const channel = supabase.channel(gslNudgeTopic(committeeId));
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 4000);
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void channel.send({ type: 'broadcast', event: GSL_NUDGE_EVENT, payload: { id: motionId } })
          .finally(() => { clearTimeout(timer); resolve(); });
      });
    });
    setTimeout(() => { void supabase.removeChannel(channel); }, 500);
  } catch { /* best effort: the row touch, when allowed, still raises a motions event */ }
}
