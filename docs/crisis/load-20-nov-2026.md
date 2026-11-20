# Crisis Database Load, 20 Nov 2026

## What Happened

On 20 Nov 2026 the site went down while a 40-person crisis was running. The Supabase logs showed about 40 screens making about 1,000 database reads a minute: `crisis_directives` alone 9,454 reads in 30 minutes, `crisis_directive_coauthors` 3,529, `crisis_notifications` 3,149, `crisis_world` 2,908. Supabase Realtime was logging "Too many database timeouts" before the crash.

Two multipliers caused it:

1. Every component kept its own reload. On a delegate's page ONE `crisis_directives` ping made DelegateHome (`listDirectives`, 2 queries), CoauthorInvitePrompt (`listDirectives` + `listCoauthors`, 3) and DelegateReplyPrompt (`listCoauthors` + `listDirectives`, 3) each read again: 8 queries per delegate per ping, for the same rows.
2. When the live channel was not connected, every `useCrisisLive` hook polled on its own every 20 s and reloaded everything, so a page with 8 to 10 hooks re-read its whole world 3 times a minute per screen, and the busier the database got, the more screens fell back to polling.

## What Changed (hotfix/crisis-load)

- `src/lib/crisis/live.ts`: ONE safety poll per crisis per tab, owned by the shared channel entry, not one per hook. It fires every listener's full re-read at the same moment (so the shared reads collapse them), every 60 s while the channel is down (was 20 s) and every 180 s while it is up (was 90 s), each wait jittered by 0.8 to 1.2 so screens never poll in step. A re-subscribe re-read runs at most once every 30 s per crisis per tab. Pings still re-read about 250 ms after the first one; tab-visible still re-reads.
- `src/lib/crisis/api.ts`: `sharedRead(key, refId, run)` runs a read once: a caller with the same key gets the read in flight, or its result if it finished under 1.5 s ago; a failed read is never kept. The key is the function name, the crisis id, the conference and crisis slugs and the client used (an account user and a personal-code user never share a result). `listDirectives`, `listCoauthors` (delegateData.ts) and `listNotifications` go through it. `forgetSharedReads(refId)` is called before and after every write to directives, co-authors, notes or notifications.
- `PressReleasesCard` polls every 60 s (was 20 s); `useMeetingResponses`' fast re-read runs every 15 s (was 8 s).

## The Rule for New Crisis Code

- A component never starts its own interval that reads the database. It listens through `useCrisisLive` and reads through the shared helpers in `src/lib/crisis/api.ts`.
- Any list read used by more than one component goes through `sharedRead`, and every write that changes what it reads calls `forgetSharedReads(ref.id)` before and after the write.
