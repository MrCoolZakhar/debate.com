# Listings outreach email

One email per Gavelling listing that has its own `contact_email` (owner, 22 Oct 2026). Written as a Gmail draft in Peter's connected Gmail (petizakhar@gmail.com, the account the Gmail connector uses); he reviews and sends each one himself, so replies and claims reach him directly. Never sent through Resend or `email_outbox`: Resend's Acceptable Use Policy forbids cold outreach and scraped addresses and can close the account that carries all of Gavelling's mail. One email only, no follow-ups unless they reply. A drafted listing gets `listing_meta.outreach = {"drafted_at": "<timestamp>"}` (kept across the daily job's re-checks).

Fields come from the listing: `{ACRONYM}`, `{YEAR}` (start year), `{Full name}`, `{dates}` (e.g. 12 to 14 March 2027), `{city}`, `{n}` (committee count; drop the clause when 0), `{link}` (https://gavelling.com/conferences/<slug>).

**Subject:** {ACRONYM} {YEAR} is on Gavelling (free to claim)

Hi {ACRONYM} team,

I'm Peter from Gavelling, a platform where Model UN conferences take applications and payments and run their committees. It's free for organisers.

We've made a page for {Full name} using the details on your website: {dates} in {city}, with your {n} committees. You can see it here:
{link}

Right now it's marked "Added by Gavelling" and sends delegates to your own website to apply. If you'd like it, it's yours for free: create an account at gavelling.com, then reply with the email you signed up with and we'll hand the page over to you. You can then change anything on it, and if you want, take applications, payments and allocations on Gavelling, with live sessions for your chairs on the day. Payments go straight to you, with no platform fee.

No pressure at all. If you'd rather keep things as they are, the page will keep pointing to your website. If anything on it is wrong, or you'd prefer we take it down, just reply and we'll fix or remove it the same day.

Best of luck with {ACRONYM} {YEAR}!

Peter
Co-founder, Gavelling
gavelling.com

## When they reply

- **Claim:** find their account (`profiles.email`), then `select transfer_listing_to_organiser('<conference id>', '<user id>')`. It sends them one email and keeps their address as the contact.
- **Fix:** correct the listing through `upsert_gavelling_listing` with the conference's `id`.
- **Take it down:** `select set_gavelling_listing_hidden('<conference id>', true)`; the daily job never brings it back.
