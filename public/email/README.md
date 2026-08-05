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
