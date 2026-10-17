<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## FEATURE: ROLL CALL

### Initial Roll Call (phase='pre-session')
- RollCallPanel with isRollCallPhase=true
- Shows: Clear All, All Present, All P+V buttons (ONLY during pre-session)
- These buttons update localStatuses immediately (optimistic) AND call the parent's `onBulkStatusChange` once → `handleBulkStatusChange` → `setDelegateStatusesBulk` → RPC `set_delegate_statuses(p_committee, p_status, p_ids)` (migration `session_bulk_delegate_status`): ONE UPDATE, SECURITY INVOKER so the delegates RLS applies, additionally requires `is_session_chair`, skips rows already at the status (no event for them). The panel passes the explicit row ids. With a chair suffix and `OFFLINE_RESILIENCE` on (Oct 2026) the bulk is parked like a single tap and recorded in `pendingRollCall.ts` (see Offline resilience); the per-row fallback runs only on `PGRST202` (RULE 5) and each fallback row is parkable too. Without `onBulkStatusChange` the panel still calls `onStatusChange` per delegate.
- Absent during roll call does NOT remove from GSL (isRollCallPhase guard)
- **Adding a seat: the inline type box beside the quorum tabs** (16 Sep 2026, owner: "instead of the + button, just a small type box next to the quorum indicators"). The "+ Add a seat" button and its `AddSeatPicker` dialog are GONE, and `RollCallPanel` no longer takes `onDelegateAdd` (its footer holds only Begin Session). `src/components/SeatAddField.tsx` is mounted by the chair page through `CommitteeIdentityBadge seatField` → `QuorumRings trailing`, on the SAME row as the tabs, so it costs the list no height: 28px tall in the sidebar, 38px (max 300px wide, `large`) on the pre-session card. Not rendered for a Commenter or an ended session. Placeholder `rollcall_add_seat`, accessible name `rollcall_add_seat_field`, tooltip `rollcall_add_seat_hint`. Nothing is suggested on focus or while the field is empty (17 Sep 2026, owner: "should not automatically suggest countries"): the combobox list opens only once at least one non-space character is typed, through `Portal` at fixed coordinates (`anchorBox` / `place` from `voting/anchorPosition.ts`, so it is converted into #fit-root's scaled space, flipped above near the bottom, never clipped): not-yet-added `UN_COUNTRIES` (prefix matches first, any locale's name) with 26px round `SeatCircleFlag`s, then the typed name as a custom seat (`rollcall_add_seat_custom`, `UnknownSeatIcon`). Enter adds the highlighted row (the top match, or the custom name when nothing matches); with nothing typed Enter and the arrow keys do nothing. Arrow keys move, Escape clears then closes. **Observer**: Shift+Enter, or the megaphone on a row (`rollcall_add_seat_observer`). Each addition clears the field, keeps focus and is announced (`rollcall_add_seat_added` / `rollcall_add_seat_added_observer`, aria-live). The write is unchanged: the chair page's `handleDelegateAdd` creates the seat PRESENT with the observer flag in the same INSERT.
- **An added seat is PRESENT at once, in roll call and mid-session.** `onDelegateAdd(country, { observer })` → the chair page's `handleDelegateAdd` → `addDelegate(committeeId, country, code, suffix, 'present', observer)` (status and `is_observer` in the ONE insert; the defaults stay `'absent'` / `false` for other callers), then `updateLocal` appends `{ status: 'present', isObserver }`. Not optimistic before the insert, because the row id is needed (the same exception as before). Verified against the DB: Italy, European Union (observer), a custom seat and Chile (mid-session) all landed `present`.
- Begin Session → phase='speakers-list' → absent delegates removed from GSL at that moment
- **"Will delegates join on their phones?" (23 Sep 2026, `src/components/RollCallJoinPanel.tsx`).** The pre-session roll call is wrapped in `RollCallWithJoin`: with at least 1288px of layout width (measured on its own box by a ResizeObserver, state only when the answer flips) a 260px panel sits on the LEFT of the card and an equal empty column on the right keeps the 672px card centred and unsqueezed; below that a compact strip sits above the card. Yes / No (`rc_phones_*`), remembered per room on this device (`localStorage gavelling-phones-join:<CODE>`). Yes shows the SESSION code big, gavelling.com/join and a locally drawn QR (`encodeQr`) for `https://gavelling.com/join?code=CODE`, plus "Present on screen" (opens `SessionCodePresenter` from the button) and Change; No folds to one line. It only renders in pre-session, so Begin Session removes it. Writes nothing.

### Resume Roll Call (after suspend)
- Same as initial roll call — phase='pre-session'
- GSL preserved exactly
- Absent during resume roll call does NOT remove from GSL
- Begin Session again → absent delegates removed from GSL

### Status slider
- 3-state: absent → present → present-voting → absent
- localStatuses state in RollCallPanel for instant optimistic updates
- localStatuses resets when committee.id changes

### Queue view in side panel
- currentSpeaker always shown at TOP with 🎙 badge (position 1 in queuePositionMap)
- speakersList delegates shown as positions 2, 3, etc.
- queuePositionMap built: currentSpeaker → position 1, speakersList[0] → position 2, etc.

---
