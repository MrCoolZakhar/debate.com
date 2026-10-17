<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## FEATURE: UNMODERATED CAUCUS / CONSULTATION / TOUR DE TABLE

### How it works
- Unmoderated/Consultation: simple countdown timer, no speaker queue
- Tour de Table: all present delegates in alphabetical order, each speaks for speakingTime seconds
- Tour uses caucusQueue with all delegates pre-filled in order
- **Room Order Tour de Table** (`tourOrder === 'custom'`, purpose `Tour de Table (Room Order)`) fills the queue with numbered placeholders (`room-order-N`, "Speaker N") that are NOT delegations. Their queue rows and speaker clock still cannot be persisted (`speakers_list.delegate_id` / `current_speaker.delegate_id` are uuid columns, so those writes log a 22P02 and are dropped), and no per-turn speech is logged for them. Instead (15 Sep 2026, owner's decision: "just give everyone one speech"):
  - At accept, MotionsModal snapshots the room into the caucus JSONB: `caucus.roomOrderCountries` (every delegate not absent, the tour's own eligibility rule, observers included) and `caucus.tourStartedAt` (`serverNowIso()`, the tour instance).
  - When the tour ENDS, `creditRoomOrderTour(committee)` (`src/lib/floorSpeech.ts`) writes ONE `speech` event per snapshot country, context `tour-de-table`, `seconds` = the tour's per-speaker time (`caucus.speakingTime`; placeholders cannot be mapped to seats, so no real elapsed time exists), `turnKey` = committee + country + `tour:<epoch ms of tourStartedAt>`, all in one insert.
  - Triggers, Moderator device only: End Caucus and the expiry effect (both via `logFloorSpeechOnCaucusEnd`), Next past the total or past the last placeholder (`handleNextCaucusSpeaker`), another caucus accepted over the tour (MotionsModal `clearFloorForCaucus`), End Debate Yes, and an organiser END broadcast. Suspend / an organiser pause does NOT credit (the tour resumes); ending it later does.
  - Only a tour that ran (someone was called, a speaker was logged in `spokenCountries`, or time came off the total) credits. A tour accepted before the snapshot existed credits nobody.
  - Idempotent exactly by key: this device's claims, the loaded log and `parseLogEvents` all drop a repeated `turnKey`, so a double trigger, a reload, a catch-up or a second device cannot double-credit (verified: re-ending the same tour after a reload wrote nothing).
  - A-Z / Z-A tours are unchanged: real delegations, per-turn `logFloorSpeech` with context `moderated-caucus`, no snapshot fields.
- All three clear caucusQueue when starting, preserve speakersList
- **Consultation of the Whole credit (Oct 2026, item 11).** A plain unmoderated caucus has NO floor and logs no speech at all; a `speech` with context `unmoderated-caucus` comes only from a Consultation floor holder, so History, the delegate profile, the dock tag and the record export label it with the committee's consultation name (`motionNames(...).consultation`; History segment kind `consultation`). Only the Moderator sets the floor holder (`cowCanTap` = `caucus.isConsultation && !isViewOnly`): every chair device used to be able to tap, and each tap wrote the whole caucus object from that device's copy (a Commenter's could rewind the clock anchor). A tap stamps `caucus.floorSince` AND `caucus.floorRemaining` (the live caucus total at the tap, `CaucusState`). The holder is credited with `cowHolderSeconds`: the CAUCUS CLOCK time that ran since the tap (`floorRemaining` minus the live total), never more than the wall time, so a holder left selected while the clock was paused or after the room moved on is no longer credited with minutes nobody spoke; a tap from a bundle without the stamp falls back to the caucus time elapsed overall. Extending the caucus moves `floorRemaining` by the same seconds. The fallback start (`cowFloorStart`, used only when `floorSince` is missing) searches only speeches of THIS consultation, bounded below by the newest `motion-passed` of type `consultation`. Rows logged before this were not filtered (they cannot be told apart).
- **Who raised it (Oct 2026).** `CaucusProposer` (round flag + name, see FEATURE: GSL → Strip header) is drawn in the unmoderated / Consultation view under its title, on all three caucus loading screens, and on the delegate phone's caucus band (under the purpose, which carries its full text as a title). Presentation only.
- **Auto start in a caucus (Oct 2026).** With `autoStartSpeakerTimer` on, caucus Next and a Tour de Table advance seat the next speaker with both clocks running from one stamp (see FEATURE: GSL → Auto start).

### Rules
- Same GSL preservation rule as moderated caucus
- currentSpeaker: null set when accepting any of these motions
- When caucus ends, same cleanup as moderated caucus

---
