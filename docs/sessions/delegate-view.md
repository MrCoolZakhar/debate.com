<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## FEATURE: DELEGATE VIEW

### Tabs
1. **Session** — floor card, session status, speakers list, delegation status
2. **Motions** — "Coming Soon" placeholder (not built yet)
3. **View Documents** — all WPs and DRs with status badges
4. **Submit Documents** — submit form only (no doc list)
5. **Stats** — speaking history, score, leaderboard

### Floor card (always visible in Session tab)
- Grey: "Not on any speaker list"
- Amber: "You have the floor!" (isCurrentSpeaker) OR "You're up next!" (myQueueIndex === 0)
- Yellow: "[N] speaker(s) until your speech" (myQueueIndex 1-5)
- Green: "[N] speakers until your speech" (myQueueIndex 6+)
- This card is PERMANENT — always shows, always colored based on position

### Timer
- Delegate view does NOT show a countdown timer for the current speaker
- When isCurrentSpeaker: shows "🎙️ You Have the Floor" message only
- No localTime, no timer sync — these were removed

### GSL request flow
- Delegate clicks "Request to Speak" → requestGslSpot → creates gsl-request motion
- Chair approves → delegate added to speakersList
- Chair denies → gslDenied state → shows "Your request was denied" + "Request Again" button
- gslDenied resets when delegate gets on list or becomes current speaker

### Join without approval: Blocked = every join waits (17 Oct 2026, owner: "this should be everytime they try to join")
- With `requireChairApproval` on, EVERY join of a seat from a tab waits in the Waiting Room for the chair, Present or not. It used to gate only an ABSENT delegation, so a phone taking a seat roll call had already marked Present (the usual case after "All present") walked straight in.
- `src/lib/seatAdmission.ts`: the approval for this tab and seat lives in `sessionStorage gavelling-seat-admission:<CODE>:<country>`, kept ONLY across a reload of the delegate page itself (`isReloadOfThisPage`, the navigation entry); a client navigation from /join, a live-room link or a fresh open clears it, so each of those is a new join. Losing the seat (removed, taken, elsewhere) clears it too. With approval off the device in the room is recorded as admitted, so switching approval on later never sends a phone already inside back to the Waiting Room.
- The request is a `join-request` motion inserted with an id the phone chose (`requestSeatAdmission`). The chair's Approve / Deny now set the row's `status` to `approved` / `denied` (`answerJoinRequest`, falling back to the old delete if the update is refused) instead of deleting it; every motion read filters on `pending`, so it leaves every list as before. Roll Call's admit (`resolveJoinRequestsOnAdmit`) marks it `approved` too. The phone follows its own row (`readJoinRequestStatus`, on every motions / roster change and every 5 s while waiting): `approved` lets it in, `denied` shows the denial with Request again, a row that is GONE (an older chair bundle) counts as approved when the delegation is Present.
- A Present delegation sees "Ask to join" (`delegate_admit_*`, `src/lib/translationsSeatAdmission.ts`) and asks with its current status, so Approve changes nothing about attendance; an Absent one keeps the P / PV choice. Answered rows stay in `motions` (status not pending). Not a security boundary: session writes still check only the session code.

### Status changes
- Rate limited: 3 changes per 3 hours (tracked in localStorage)
- Absent delegates must request to join via AbsentBanner (join request → chair approves), or the chair marks them present in Roll Call, which also answers any pending request (see COMPONENT: RollCallPanel; adding an absent delegation to a list is refused since 13 Oct 2026)
- Going absent sends a join-request motion to the chair

---
