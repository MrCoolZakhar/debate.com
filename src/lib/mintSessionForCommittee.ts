// ── Creating a live room is ALWAYS a deliberate press (owner, 7 Oct 2026) ────
//
// Owner's instruction: "committees should only be started when chairs want it
// to." Until today the organiser committees page minted a room for every
// codeless committee the moment the page loaded, in a loop. One conference
// produced thirteen rooms in a minute, and 735 rooms across production were
// created that way and never used by anyone.
//
// So this helper has exactly one job: seat and mint a room for ONE committee,
// from a press. It is the ORGANISER's route — the "Create session code" buttons
// on /manage/[slug]/committees — and it runs as four client writes because an
// organiser's token can make all four.
//
// A CHAIR cannot: `conference_committees`'s only non-SELECT policy is
// is_conference_organizer, so the link write would silently match zero rows and
// leave an orphan room. The chair's "Start your committee room" button therefore
// calls the RPC `start_my_chair_session(p_committee)` (applied 7 Oct 2026), which
// does the same four writes in one server-side transaction. The two must stay in
// step: if you change the shape of a minted room here, change that function too
// (its comment says the same).
//
// NOTHING IN HERE MAY BE CALLED FROM AN EFFECT. If you find yourself wiring it
// to a mount, a load, a publish or a cron, that is the bug this file removed.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { mintConferenceSession } from '@/components/CommitteeEditorModal';

/** The little a mint needs to know about the conference committee it is for. */
export interface MintCommittee {
  id: string;
  name: string;
  topics: string[] | null;
}

export interface MintSessionResult {
  /** The new 6-char session code, or null when the room could not be created. */
  code: string | null;
  /**
   * Parts of the room that were not furnished (speaker slot, seats, or — worst
   * — the `conference_committees.session_id` link). A code with problems is
   * still returned, because the row exists; the CALLER MUST say so.
   */
  problems: string[];
  /** The only thing a caller should branch on for "did this work". */
  ok: boolean;
}

/**
 * Seats the new room from the committee's own country slots, the way the
 * committee editor does on create, so a chair never gavels into an empty
 * committee. The slots are read here (not passed in) because both call sites
 * would otherwise have to carry a roster they do not already hold.
 */
export async function mintSessionForCommittee(
  supabase: ReturnType<typeof getAuthedClient>,
  c: MintCommittee,
): Promise<MintSessionResult> {
  const { data: slotRows } = await supabase
    .from('committee_country_slots')
    .select('country_name, logo_url, is_observer')
    .eq('conference_committee_id', c.id)
    .order('country_name', { ascending: true });
  const slots = (slotRows ?? []) as { country_name: string; logo_url: string | null; is_observer: boolean | null }[];
  // A session that mints but does not link is worse than no session: the code
  // would be handed out and joined, while the live wall, the scoreboard and
  // awards would never find the room. Report it instead of swallowing it.
  const problems: string[] = [];
  const code = await mintConferenceSession(
    supabase, c.id, c.name, (c.topics ?? [])[0] ?? '',
    slots.map(s => ({ name: s.country_name, logoUrl: s.logo_url })),
    slots.filter(s => s.is_observer).map(s => s.country_name),
    (msg) => { problems.push(msg); },
  );
  return { code, problems, ok: !!code && problems.length === 0 };
}
