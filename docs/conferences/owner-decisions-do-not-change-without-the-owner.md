<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## Owner Decisions: Do Not Change Without the Owner

These were decided by the owner (Christian) on purpose. If a request would change, remove, merge or redesign any of them, stop and tell the person you are working with that it needs the owner's sign-off, and do not do it in this run. Always git pull before starting work.

- The profile menu: Needs your attention, My profile, Manage account with credits and "+", Pricing with the Free / Unlimited badge and the up-arrow, Your conferences, About Gavelling, Sign out.
- /about and /contact are two separate pages; /about carries the ambassador world map; no footer on /contact.
- /account/manage is three pages: Credits, Subscription, Promo code. Credits and Unlimited stay apart.
- No site footer on /account.
- Delegation leaders import from the "Import delegates" button on the delegation card (two-tab pop-up) and, since 11 Oct 2026 (Peter, co-owner), share the delegation's invite link from a "Copy invite link" button on the same card (`participant/DelegationInviteLink.tsx`: `create_delegation_invite`, landing `/invites/delegation/[token]`, which applies with the delegation filled in or adds an existing application to it). There is still no /delegation portal. Leaders (faculty advisor or head delegate) can make a delegate a head delegate and back (delegation_set_head); delegate and faculty advisor never swap.
- My conferences opens each conference's role dashboard.
- Explore: the title left, the search pill on the left with "Organise your conference" on the same line, the place pills under Where (max 5), no place rail, filters with sort and view on one line, grid first in the toggle, at most 4 columns, spotlights are the first grid cards (no "In the Spotlight" row), the list view is plain date order with spotlights tagged in place, Near you is the IP country. Spotlights obey every filter; a filtered-out spotlight is not shown.
- Free (house) spotlights exist only for flagship pairs listed in the database table spotlight_flagships (today only WorldMUN on the homepage); the database refuses any other. Never add free spotlights as test data.
- Organizer imports are free until the owner switches them on (IMPORTS_PAID_LAUNCH and store_flags.organizer_import_charged).
- Leader imports are free until the owner switches them on (LEADER_IMPORTS_PAID_LAUNCH and store_flags.leader_import_charged); while free, each delegate's own credit is taken at claim.
- Payment never locks the role page. 'Hide dashboard until payment' was removed from Settings on 12 Oct 2026 (Peter, co-owner) and `application_role_configs.hide_dashboard_until_paid` was set false everywhere; the dashboard always shows (ROP, preferences, the application to amend). Turned-down applicants can always edit and resubmit until they have been turned down 3 times (migration `resubmission_always_on_three_rejections`: `applications.rejection_count`, server-owned, +1 on each change to rejected; `resubmit_application` refuses at 3; `allow_resubmission` is true for every role and no longer shown in Settings). payment_timing only decides when people can pay ('anytime' or 'after_acceptance'); 'after_application' was merged into 'anytime' on 29 Sep. Role settings with two choices are toggles, all off by default; settings that do not apply (payment settings on a free role) are hidden.
- Country and Region Spotlights: 2 a day each, same price (1 credit a day, 7 a week). Each gets an Explore pop-up with an optional pitch and up to 3 highlights (set_spotlight_popup).
- Buttons are sentence case, titles are Title Case, no em dashes anywhere users can see.
- Every database object is changed only through the chat's Supabase work, never from a Claude Code run.

---
