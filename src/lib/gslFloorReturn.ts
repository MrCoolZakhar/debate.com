/**
 * An interrupted GSL speaker keeps their place on the GSL (owner, 18 Oct 2026: "The GSL
 * should stay absolutely the same, even if they have time remaining").
 *
 * A delegation is POPPED from `speakers_list` the moment it is seated (Next, or Start on a
 * delegation on deck: `nextSpeaker` deletes its GSL row) and lives on the `current_speaker`
 * row from then on (RULE 2). When a caucus is accepted, or Suspend passes (motion or an
 * organiser pause), the floor speech is logged and the floor is cleared (G-1). Nothing put
 * the speaker back, so a delegation that had pressed Start, or was merely seated, was simply
 * missing from the GSL when debate returned to it.
 *
 * Now, when the floor holder is a GSL speaker (the room is on the GSL, no caucus) with time
 * still on their clock, they go back to the FRONT of the GSL: optimistic first, then ONE
 * idempotent `speakers_list_add` at 'start' (the database assigns the position; never a
 * client-computed one), on the GSL list chain through runWrite (retried, parkable). When the
 * room returns to the GSL they are on deck again, drawn at the speaker time limit.
 *
 * Honest trade-off: the interrupted part is still logged as its own speech (one speech
 * logger, turnKey per seating), and their next turn is a new seating with the full slot, not
 * the seconds they had left. Keeping the remainder would need a persisted per-delegation
 * clock outside `current_speaker`, which a moderated caucus uses for its own speakers.
 * A speaker whose clock had already reached zero had finished and is not put back; neither
 * is an absent delegation (an absent delegation is never added to a list).
 *
 * The caller still logs the speech and clears the floor exactly as before; this only adds
 * the GSL place. It never touches `current_speaker`, the caucus queue or any clock.
 */
import type { Committee, SpeakerEntry } from '@/lib/types';
import { addToSpeakersList, speakerRemainingNow } from '@/lib/committeeService';
import type { FloorClock } from '@/lib/floorSpeech';

/** The GSL speaker holding the floor with time still on their clock, or null. Read BEFORE
 *  the caller clears the floor (it reads `committee.currentSpeaker`). */
export function interruptedGslSpeaker(committee: Committee, clock?: FloorClock | null): SpeakerEntry | null {
  const floor = committee.currentSpeaker;
  if (!floor) return null;
  // Only a GSL floor: in a caucus the current_speaker row is the CAUCUS speaker (RULE 1).
  if (committee.phase !== 'speakers-list' || committee.caucus) return null;
  if (committee.delegates.find((d) => d.id === floor.delegateId)?.status === 'absent') return null;
  const live = clock
    ? speakerRemainingNow(clock.base, clock.startedAt)
    : speakerRemainingNow(committee.speakerTimeRemaining, committee.speakerStartedAt);
  return live > 0 ? floor : null;
}

/** Put the interrupted speaker back at the front of the GSL: `update` is the caller's
 *  optimistic structural updater (updateLocal), then one idempotent add at 'start'. */
export function returnSpeakerToGslFront(
  committee: Committee,
  speaker: SpeakerEntry,
  update: (updater: (c: Committee) => Committee) => void,
): void {
  update((c) => ({
    ...c,
    speakersList: [speaker, ...c.speakersList.filter((s) => s.delegateId !== speaker.delegateId)],
  }));
  void addToSpeakersList(committee.id, speaker.delegateId, speaker.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'start');
}
