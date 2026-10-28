# Faculty advisor alerts on a phone (web push)

Owner approval: Peter, 23 Oct 2026. Status: client shipped behind an env var (hidden), server side drafted and NOT applied or deployed.

## What it does

The advisor board's reminders ("Maya speaks next", "Maya is speaking now") used to need the board on screen. With alerts on, the same moments reach the phone as a normal notification, with the screen off and the browser closed.

- On `/advisor` a card says "Get alerts on this phone". Only a tap on it asks the browser for notification permission. The board then registers `public/sw-advisor.js` (scope `/advisor`; push and notificationclick only; no fetch handler, so no caching and no offline behaviour), subscribes with the VAPID public key and saves the subscription through `save_advisor_push_subscription`. A first notification is shown at once by the phone itself, to prove it works. "Turn off" unsubscribes and deletes the row.
- The board's own Alerts on / off toggle is respected: off pauses pushes to that phone (`enabled = false`).
- When: exactly the board's rule (`src/lib/advisorBoard/reminders.ts`, `derive.ts`): once per queue row when the student is at most 2 speakers away, and once per turn when they hold the floor (GSL, moderated caucus including Room Order tours, Consultation). Only while the room is debating, never suspended, ended, in roll call or voting, and for a conference room only on the conference's days in its time zone. A speech that started over 5 minutes ago is not pushed.
- Who: a signed-in faculty advisor's or head delegate's conference seats (read through `my_advisor_delegation()`, rebuilt every 5 minutes so moved students arrive), plus rooms added by code on that phone, sent as (code, country) pairs only.
- The notification names the student: for conference seats from the allocations at push time (inside the encrypted payload, wiped from the outbox once sent); for rooms added by code from the first names typed on that phone, which the board writes to the phone's own IndexedDB and the worker reads there. Typed names never leave the phone. The wording is the board's own banner copy in the board's language.
- Tapping the notification focuses an open board or opens `/advisor`. If the board is on screen the notification is silent (the board already chimes).

## Privacy (CLAUDE.md §3)

Standard Web Push only: the Push API, VAPID, and the browser vendor's own push service (Google FCM for Chrome / Edge / Samsung / Opera, Apple for Safari, Mozilla for Firefox, Microsoft WNS). No third-party SDK or service. The payload is end-to-end encrypted (RFC 8291), so the push service sees only the endpoint and the timing. Stored: the endpoint, its two keys, the advisor's user id, the follows (committee + country), and the sent turn keys for 12 hours. No tracking, no analytics, nothing about who opened what. The database only accepts endpoints on those vendors' hosts, so the edge function never posts anywhere else.

## Files

| File | What |
|---|---|
| `src/app/advisor/board/PushAlerts.tsx` | The card (off / on / paused / blocked / iPhone Home Screen step) |
| `src/lib/advisorBoard/push.ts` | Support detection, permission, subscribe, save, re-save, turn off, IndexedDB wording and names |
| `public/sw-advisor.js` | The service worker |
| `public/advisor.webmanifest` + `src/app/advisor/page.tsx` | The board's own manifest (start_url `/advisor`), so an iPhone Home Screen icon opens the board |
| `scratch-advisor-push.sql` | Tables, RLS, the RPCs, the 10-second tick, the test helpers, commented schedules |
| `supabase-functions/advisor-push/index.ts` | The edge function (draft folder, not deployed by anything) |

## Why a 10-second tick and no triggers

Triggers on `current_speaker` / `speakers_list` would give the lowest latency but put new code on the hottest session tables (AGENTS.md forbids session schema changes without instruction, and a slow trigger slows a chair's press). Realtime needs a long-running server. A plain cron poll of the edge function would invoke it all conference day. So: pg_cron runs `advisor_push_tick()` every 10 seconds inside Postgres. It returns at once when nobody has alerts on; otherwise it reads only the followed rooms that are debating today, queues new turns in `advisor_push_outbox` (unique per phone and turn, which is the dedupe) and calls the edge function through pg_net only when something waits. Latency is at most about 10 s plus the push service (usually 1 to 2 s); "speaks next" comes one whole speech ahead. Cost: 8,640 tiny ticks a day and edge function calls only for real pushes. The full reasoning is in the SQL header.

## Secrets and settings

| Where | Name | Value |
|---|---|---|
| Edge function secret | `VAPID_PUBLIC_KEY` | base64url raw P-256 public key (65 bytes) |
| Edge function secret | `VAPID_PRIVATE_KEY` | base64url raw private key (32 bytes) |
| Edge function secret | `VAPID_SUBJECT` | `mailto:wearegavelling@gmail.com` (the default if unset) |
| Vercel env | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the same public key; inlined at build, so a redeploy is needed |
| Database | `internal_secrets.cron_edge_secret` | already exists; the tick sends it as `x-cron-secret` |

Generate the key pair once, with no package (Node 18 or later):

```bash
node -e "(async()=>{const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);console.log('VAPID_PUBLIC_KEY='+Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey)).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+(await crypto.subtle.exportKey('jwk',k.privateKey)).d)})()"
```

Keep the private key only in the edge function secrets. Rotating the keys later makes every phone re-subscribe on its next tap (the board detects the changed key).

## Steps for the chat (in this order)

1. Apply `scratch-advisor-push.sql` as one migration (for example `advisor_push`). It works with or without `scratch-advisor-board.sql`. Dry check first if wanted: `begin; <file>; select public.advisor_push_tick(p_dry_run := true); rollback;`
2. Set the three edge function secrets above.
3. Deploy `supabase-functions/advisor-push/index.ts` as the edge function `advisor-push` with `verify_jwt = false` (like `event-emails`: it fails closed with 403 without the DB-held `x-cron-secret`).
4. Do NOT schedule the cron yet.

## Testing with one advisor, nobody else notified

The client control stays hidden everywhere until `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set, so before go-live no one else can create a subscription.

1. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on Vercel for the **Preview** environment only and let the `feature/conferences-auth` preview rebuild. Production stays without it.
2. On the test phone (Android Chrome, or an iPhone on iOS 16.4+ after Add to Home Screen from the preview's `/advisor`), sign in as the test advisor and tap "Get alerts on this phone". The phone shows "Alerts are on for this phone" by itself.
3. Confirm only that account is saved: `select user_id, endpoint, enabled, created_at from public.advisor_push_subscriptions;`
4. A server push to that one user only: `select public.advisor_push_test('<test advisor user id>'); select public.advisor_push_kick();` The phone shows the same notification, this time from the server. `select id, turn_key, sent_at, last_status from public.advisor_push_outbox order by id desc limit 5;` shows 201 (Chrome, Firefox) or 201 / 200 (Apple).
5. A real turn: in a test conference room (dates covering today) or a standalone room the test advisor added by code, put the followed delegation 2 speakers away, then seat it. `select public.advisor_push_tick(p_dry_run := true);` lists what would be queued without writing anything. To send those, call `select public.advisor_push_tick();` by hand (it only ever reaches existing subscriptions, which at this point are the test account's).
6. When happy, schedule the tick and the trim (the commented statements at the end of the SQL), then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on Production and redeploy when Peter says "push to production".

Stop everything at any time: `select cron.unschedule('advisor-push');` (and `update public.advisor_push_subscriptions set enabled = false;` to silence every phone).

## Known limits

- Signed-in advisors only (the subscription belongs to an account). A signed-out advisor's tap opens sign-in.
- One browser, two accounts: the first account's alerts keep coming until the second taps "Get alerts on this phone" (the endpoint moves to them and the old follows are dropped) or "Turn off".
- A browser that silently rotates its subscription (`pushsubscriptionchange`) is not followed up by the worker: the old one answers 410 and is deleted, and the board then shows the card as off until the next tap.
- A GSL row from before `seated_at` existed has no stable turn nonce and is never pushed as "speaking".
- The board on screen and the push both fire on that phone; the push is silent while the board is visible.
- iPhone and iPad need the board added to the Home Screen (iOS 16.4 or later); the card says how. Older iOS gets no card.
