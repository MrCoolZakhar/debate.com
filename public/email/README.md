# Email signature cards

The organiser nudge emails (`send-setup-nudges` edge function) sign off with a
founder's e-signature card. Drop the two PNGs here, exactly these filenames:

    peter-signature.png       -> used on the day 1, 3, 14 and 30 emails
    christian-signature.png   -> used on the day 7 email

They are referenced absolutely as `https://gavelling.com/email/<file>.png`,
because an email client cannot resolve a relative path.

Notes:
  * Rendered at width="330", so ~660px wide keeps it crisp on retina.
  * Keep each under ~100KB. Gmail clips a message over 102KB, and a heavy
    signature on every send is the easiest way to hit that.
  * Until a file exists the block renders as its alt text
    ("<Name>, Founder, Gavelling"), so the email is never broken by a missing
    card, just plainer.

# Card email design (v2) assets

Used by the card email design (`src/lib/emailCard.ts`, `gavelling_email_html_v2`),
which is not switched on yet. Until these files are deployed they are served from
the public storage bucket `email-assets` (same paths); `EMAIL_ASSET_BASE` /
`gavelling_email_asset_base_v2()` say which.

    flags/xx.png        round flags, 240px, rendered from public/flags/1x1 (circle art)
    icons/<name>.png    Lucide glyph, forest on a pale-gold disc, 96px (shown at 16 to 40px)
    emblems/<dir>/x.png PNG renders of the preset SVG emblems in /logos and /committee-emblems
    banners-wide/preset-N.jpg the preset banners as 4:1 strips (1200 x 300, full width kept)
    awards/<kind>.png   the award medallions the website draws (AwardArtwork), 192px
    shots/live-wall.jpg  the organiser live wall, LIMUN demo data (fictional)
    shots/chair-speakers-list.jpg     chair console, GSL running (France speaking, 1:07 left)
    shots/chair-moderated-caucus.jpg  chair console in a moderated caucus (Japan speaking, total 14:41)
    shots/chair-motions.jpg           Vote on Motions dialog, three motions ranked (Tour de Table, unmod, mod)
    shots/chair-voting.jpg            /voting mid-vote on DR 1/1 (Kenya called, tally 4 for 1 against)
    shots/chair-scoreboard.jpg        session scoreboard, Ranking tab
    shots/delegate-phone.jpg          delegate board on a phone (Kenya, 1st in the queue), 600px wide
        The six above: a real standalone session made at /create/sessions on a local
        production build, 23 Oct 2026 ("Security Council", 12 delegations, fictional).
        Used by the chair reminders (scratch-chair-reminder-redesign.sql).
    shots/press-desk-rooms.jpg        two Press Desk room cards (UNSC, DISEC)
    shots/press-release-composer.jpg  Send a Press Release: text, Add a photo, rooms picked, approval
    shots/press-releases-sent.jpg     Your Press Releases: one sent to 3 rooms, with its photo
        The three press shots: the real PressRoomCard / PressReleaseComposer /
        MyReleasesCard components drawn with demo data (fictional, outlet "The Daily
        Gavel") on a temporary local page that was deleted afterwards. Used by the
        press seat email (press_allocation_assigned, src/lib/defaultEmails.ts).
    All JPEG, 1200px wide (the phone 600px), under 90 KB each.
    disc-white.png      the white circle drawn behind uploaded logos (dark-mode safe)
    shots/check-in.jpg   PLACEHOLDER, not captured yet: applications page with check-in buttons
    social/<name>.png   conference social icons, forest glyph on pale gold, 64px (shown at 32)
