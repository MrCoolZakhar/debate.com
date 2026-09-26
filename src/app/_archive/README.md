# Archived pages

`_archive` is a private folder: Next.js never routes anything under it. Pages live
here when the owner takes a feature off the site but wants the code kept.

- `conferences-map/`: the conference world map (`/conferences/map`), archived on
  25 Sep 2026 at the owner's request ("put the map in archives completely").
  `/conferences/map` now redirects to `/conferences/explore` (next.config.ts), and
  every link, the sitemap entry and the homepage globe section were removed. To
  bring it back, move the folder to `src/app/conferences/map/`, remove the
  redirect, and add the sitemap entry and links back.
- `session-format-select/`: the "Select your format" screen (Regular Debate, Model United
  Nations, Crisis Committee) that opened `/create/sessions`, archived on 26 Sep 2026 at the
  owner's request. The session creator now opens straight on building the committee, and its
  Back button goes back (or to `/sessions`). The file is `.txt` so it is not compiled; the
  restore steps are at its top. The card videos (`/card_*.mp4`) are still in `public/`.
- `account-your-conferences/`: the role-tab "Your conferences" page (All, Delegate, Chair,
  Advisor, Organizer; upcoming or past; continent) that was `/account/conferences`, archived on
  26 Sep 2026 at the owner's request. The former Conference calendar is now **My conferences** at
  `/account/conferences`, and `/account/calendar` redirects there (next.config.ts). The actions
  only the old page had (chair and organiser invitations, imported invitations, drafts to
  complete, the accepted-invite notice) moved to `src/app/account/conferences/conferenceActions.tsx`
  and sit at the top of My conferences. The file is `.txt`; the restore steps are at its top.
