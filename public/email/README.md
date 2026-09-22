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
    banners-full/preset-N.jpg the preset banners, whole, 1056px wide, for the email header
    awards/<kind>.png   the award medallions the website draws (AwardArtwork), 192px
    shots/live-wall.jpg  the organiser live wall, LIMUN demo data (fictional)
    disc-white.png      the white circle drawn behind uploaded logos (dark-mode safe)
    shots/check-in.jpg   PLACEHOLDER, not captured yet: applications page with check-in buttons
