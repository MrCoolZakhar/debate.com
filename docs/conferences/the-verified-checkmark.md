<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 5b. The verified checkmark

One seal, the one social media uses (`src/components/VerifiedCheck.tsx`). Blue means verified, grey means not yet. Two things carry it:

- **A conference** is verified automatically once every verification stage is done. **Checklist v2 (owner, 12 Oct 2026; applied the same day as migration `organiser_checklist_v2`, from `scratch-checklist-v2.sql`, with its email guards: no catch-up nudges and no checkmark emails were caused by the switch):** the organiser checklist is exactly 7 steps, in this order, with stable keys: `page` (conference page), `committees` (enough seats, so committees appear in applications), `applications` (Launch applications: a role with `application_role_configs.is_enabled` whose window has not closed, a window opening later counts, or the conference already has applicants' own applications so closed windows never take it back), `financials` (`conference_payments_ready()`), `communications` (Go to the Communications page: `conferences.comms_visited_at`, or the older `emails_explored_at`), `chairs` (one chair assigned or invited) and `store` (Visit the Store: `conferences.store_visited_at`). The two visit stamps are written ONLY by `mark_organiser_visit(p_conference, p_page)` ('communications' | 'store', real organisers only, platform admins excluded, once, returns nothing; a guard trigger ignores any direct write), called fire-and-forget once per page load by `useOrganiserVisit` (`src/lib/organiserVisits.ts`) on the two pages, a silent no-op until the SQL exists; localStorage gives the dashboard its instant tick. The blue checkmark is the first six (`v_ver_keys`); `store` is not a criterion and `intentRank` pins it last. `email`, `secretariat` (and with it the "I'm on my own" row; `solo_secretariat_ack_at` stays, unread) and `publish` (Publish lives in the manage header) left the list. Until the SQL is applied the database still answers with the OLD seven (page, committees, chairs, emails explored, secretariat, a payment method, published) for the mark, the nudge emails and /admin, and the dashboard's rows fall back to their client checks. On apply (measured 12 Oct 2026): of 30 verified conferences 1 loses the mark (KMK) and 4 gain it (UGMUN, LSYC, BDMUN, SMITMUN); the file pre-records nudge rows so that neither the 09:00 drip (73 addresses whose complete set-up would turn incomplete because nobody has visited the Store) nor the 10:30 checkmark email fires because of the change. The truth is `conference_setup_status()` in the database (`scratch-setup-status.sql` is an old reference copy), which also reports minutes per stage and `verification_minutes_left`. `refresh_conference_verification()` stores the mark (dashboard calls it; cron sweeps hourly); a guard trigger rejects any direct write to `conferences.is_verified`. Public surfaces show the seal only when verified. The organiser's own screens (manage rail, dashboard) always show it, grey with "About N minutes to your checkmark" until earned.
- **An MUN CV entry** is blue when `source = 'gavelling_verified'` (written by the awards pipeline), grey when self-reported.

Reminders: `queue_checkmark_emails()` (cron 10:30 daily) sends one "N minutes from its checkmark" email per organiser per conference, a follow-up after two weeks, and a congratulations when the mark lands, all through `email_outbox` and paced 48h from the organiser drip. `SetupReminderGate` (root layout) shows the same list once a day when an organiser with an unverified conference enters the site, via `my_incomplete_conferences()`.

**Sign-up asks first (18 Sep 2026).** `/auth/signup` shows nationality and date of birth
ABOVE "Sign up with Google" and refuses both ways of signing up without them (same rules as
onboarding, `validateBasics` in `src/lib/pendingBasics.ts`). For Google the confirmed answers
ride through the round trip in a 30-minute first-party cookie (`gv_pending_basics`, SameSite
Lax); `/auth/callback` writes them into the new profile (only empty columns, only for an
account created after the answers were given) and clears it, and `/auth/onboarding` retries
from it if that write did not land. "Sign in with Google" clears it and still asks nothing
before signing in, so a brand-new account made from the SIGN-IN page still meets the
unskippable basics screen in onboarding and this gate. Invite pages link to one of those two.

`CompleteBasicsGate` (root layout, 11 Sep 2026) is the backstop for accounts with no
nationality or date of birth. Google sign-up creates the account before anything can be
asked, and a user who closes the onboarding tab used to stay blank forever (1,777 of 2,627
profiles had no nationality). On the next visit a signed-in user missing either field gets a
modal that cannot be dismissed (Sign out is the only exit). Nationality is prefilled from
`/api/geo` (Vercel's IP-country header, never a third-party lookup) and shown as a guess the
user confirms with one tap, because location is not nationality. Nothing is ever written
without that tap, and nobody was backfilled. Apply requires nationality and date of birth before submit for accounts missing them: the apply page's own basics wall (`needsBasics` in `ConferenceApplyClient.tsx`, same `validateBasics`, same `/api/geo` guess, a row-counted profiles write) blocks the form, and `guard_application_write()` refuses a self-submitted insert without both (hint `basics_required`, since 23 Sep 2026). It stays off `/auth/*`, legal pages, apply
paths, `/account/profile` and every live-session route (a chair must never get a modal over
a running committee). It publishes its state through `src/lib/basicsGateState.ts` so
`CreditsWelcomeGate` and `SetupReminderGate` never open on top of it.

**A name is a person's name (11 Oct 2026, owner: "users ... put in MUN Society Taiwan, chair ECOSOC ... we need the people's names").** ONE rule, `nameProblem(name)` in `src/lib/personName.ts` (`'org' | 'role' | 'digits' | 'email' | 'too_short' | null`, whole words, case-insensitive): an '@'; fewer than 2 letters; any digit; a role word (chair, secretariat, secretary, president, presidency, admin, official, moderator, delegate, delegation, organiser, staff ...); an organisation word (society, club, association, school, university, college, academy, conference, council, team, committee, institute, foundation, email, the UN bodies ECOSOC, UNSC, DISEC, UNHRC, SOCHUM, UNGA, UNESCO, UNICEF ..., the phrases Model United Nations / United Nations / High School); and MUN matched CASE-SENSITIVELY ("MUN", "LIMUN", "WorldMUN", never "Mun", a Korean family name). One-word names and all-capitals names are NOT refused; all capitals gets a "Use Title Case" offer (`titleCaseSuggestion`). `nameProblemMessage` holds the sentence shown under the field. Enforced in the auth pop-up's Finish signing up (before `signUp`, the field holding the word marked invalid) and on `/account/profile` (only a CHANGED name is refused, so an account still named "GPS MUN" can save its nationality; the stored name's sentence shows under the field). Existing accounts get **"What's Your Name?"** (`src/components/NameGate.tsx`, root layout after CompleteBasicsGate): only when `nameProblem(display_name)` is not null and the profile is not demo, two fields (last name optional), Save = a row-counted update of `display_name` only, "Remind me later" hides it for 7 days (`localStorage gavelling-name-gate-later:<uid>`), Escape for the visit. It waits for the basics gate to say ok and the auth modal to close, publishes its status through `basicsGateState.ts` (`setNameGateStatus`; `useBasicsGateBlocking()` now includes it, so the credits welcome, set-up reminder and "Your room is live" wait), never opens over another modal on screen, and never on /auth, legal, contact, unsubscribe, /api, /r, the session routes (/chair, /delegate, /advisor, /voting, /join, /create/sessions), /account/profile, /invites, /drafts or any apply / pay path. Nothing is written without the person pressing Save; no email. The read-only count on 11 Oct 2026: 178 of 4,812 non-demo profiles (65 digits, 83 organisation, 27 role, 3 too short), from a SELECT that mirrors these lists with `~*` / `\m...\M` word-boundary regexes (and MUN with case-sensitive `~`); a manual read of the 113 organisation, role and too-short names found no plain person's name; a few are a person's name plus a role word ("Aisha Delegate", "Adam Azab head chair, UNSC"), which the gate asks them to tidy too.

**Log in / sign up is a pop-up (18 Sep 2026), Airbnb's exactly, in green.** `src/components/auth/AuthModal.tsx`
(steps), `authModalKit.tsx` (white surfaces, floating-label fields, the green gradient button, KIT_CSS) and
`AuthQuestionnaire.tsx`, mounted once in the root layout, opened by `openAuth({ next?, step?, email?, apply? })`
from `src/lib/authModal.ts` (or `<AuthLink>` for links). First screen: X, gavel mark, "Log in or sign up",
one Email field, Continue, "or", a square Google tile (no Apple). Continue asks the SECURITY DEFINER RPC
`auth_email_status(email)` (`new` | `password` | `google` | `invalid`; it discloses whether an address has an
account, a trade-off the owner approved) and the dialog moves to the password step, a "signs in with Google"
step, or "Finish signing up" (name, date of birth, nationality, password) then the 6-digit code. A new
account (made here, or under a day old with no `education_level`) then gets the /auth/onboarding
questionnaire as four steps in the same pop-up (same writes: `education_level` (`high_school` | `university` | `both`,
plain text, no CHECK), `mun_countries`, `mun_experience_level`, `mun_cv_entries` via CVEntryModal). Since 23 Sep 2026
the first three are REQUIRED (Continue disabled until answered; no X, Escape or backdrop until the MUN CV step, with
Sign out in the header as the only exit) and only the MUN CV step can be skipped; /auth/onboarding follows the same rule. Google and email links return through
`/auth/callback?via=modal` to the page the visitor was on (never `/auth/onboarding`), with `?auth=finish` when
basics are missing or the account is new; the basics step is non-dismissable (Sign out is the only exit).
`/auth/signin`, `/auth/signup` and `/auth/forgot` only redirect to `/?auth=...&next=...`; redirect guards
still go through them. While the modal is open `CompleteBasicsGate` stands down and `useBasicsGateBlocking()`
is true, so no two modals stack.
Since 19 Sep 2026 it is the "Wall" split (owner picked mockup 1): from 860px wide a 400px image panel on
the LEFT on every step and the form on the right (880 x at least 560, radius 24, left-aligned brand and
heading, a one-line intro, a Terms line under the Google tile); below 860px the single 480px column, and
the full-screen sheet on phones. The image is ONE file, `public/auth/side.webp` (`AUTH_SIDE_IMAGE` /
`AUTH_SIDE_ALT` in `authModalKit.tsx`, `object-fit: cover`, top-anchored, supply 800 x 1120 or larger);
today it is a render of the mockup's wall, to be replaced by the owner's artwork.

**On a phone it is a sheet, not a squashed dialog (19 Sep 2026, owner: "the registration / log in
pop-up is not made for phone").** Below 744px the same artwork is a HERO band across the top
(`object-position` crops it to landscape; the picture is still one file) and the white form sheet has a
rounded top edge, a grab handle and overlaps it. The hero is sized so the sheet is about as tall as the
step it holds (30svh on the first screen, 50svh on the short ones, gone on the long ones: Finish signing
up, the basics and the questionnaire, where the form scrolls and the primary button is sticky above the
safe area). Google is a full-width outlined button with its label (`.gv-social-label`, the square tile is
the desktop idiom); fields are 58px and 16px, so iOS never zooms; the X and back are 44px; the first
screen's X is a glass disc on the picture. Real-phone rules: dvh/svh only, `env(safe-area-inset-*)`
padding, and AuthModal publishes the VISUAL viewport as `--gv-vvh` / `--gv-vvt` (rAF-coalesced, cleared
on unmount) which the sheet's height and top read, so the on-screen keyboard cannot cover the focused
field or the action; a `focusin` listener scrolls the tapped field into the middle of the sheet. Under
600px tall (landscape, keyboard up) the hero goes and the sheet is all form; from 744px up NOTHING
changed, and a short window there only loses the dialog's padding (`min-width:744px and
max-height:480px`). The steps are told apart in CSS by `data-step` / `data-hero` / `data-cta` on the
panel.
