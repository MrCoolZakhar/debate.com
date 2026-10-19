# Claimable Conference Listings: Plan

Status: APPROVED with changes (Peter, 19 Oct 2026); being built. Draft SQL: `scratch-claimable-listings.sql`.

## Owner decisions (19 Oct 2026), these override anything below

- **Claims are purely manual:** "Claim it free" asks the organiser to email us (wearegavelling@gmail.com, subject prefilled with the conference). Peter reviews several times a day and approves in /admin. No automatic domain-email or website-code methods.
- **Listings are added automatically by Claude** (a daily job), not by a person. Each listing still goes live only if it passes the quality bar; otherwise it stays a draft for Peter to see in /admin.
- **Explore shows listings,** marked "Not on Gavelling yet".
- **Logos are shown.** The banner is the conference's own banner when one can be found on its site; otherwise a free-to-use photo of its city (public domain, CC0 or a licence that allows reuse, credited where required).
- **Past listings are kept** (as past conferences), not removed.
- **Committees and topics are taken** wherever the conference publishes them: website, Linktree, linked study guides, Google results. Instagram only where the post is public without logging in, kept minimal (automated collection from Instagram is against Meta's terms).

## The idea in one paragraph

List real upcoming Model UN conferences that are not on Gavelling yet, as short factual pages built from each conference's own public website, each ending in "Is this your conference? Claim it free". A claim turns the listing into a normal organiser-owned conference at the same URL. Every listing is a page Google can rank for the conference's name (the searches we already get and lose, like "gamun", "bcimun", "csmun 2026"), and every claim is a new organiser account.

## Ground rules (agreed 19 Oct 2026)

- Facts only: name, acronym, dates, city and country or online, level, committees and topics if the conference publishes them, its website. Never copy the organiser's description text; we write a short factual summary in our own words.
- Every listing says where it came from: "Listed from the conference's public website, checked 12 Oct 2026", with the link.
- No Apply button and no fees until it is claimed. The main button is "Visit their website".
- Removal on request, no questions asked.
- No personal data: no secretariat names, no emails, no photos of people.
- No organiser is emailed or contacted by us. They find the listing (Google, their own delegates) and claim it themselves.
- Discovery does NOT scrape mymun's directory (EU database right; mymun is German). The list of which conferences exist comes from open sources; mymun is only a manual cross-check by a person. Details always come from the conference's own website, respecting its robots.txt.
- A listing below the quality bar is noindex and stays out of the sitemap.

## 1. Data model

Listings get their **own table**, `conference_listings`, not rows in `conferences`:

- `conferences.organizer_id` is NOT NULL. A listing row there would need a fake "Gavelling" organiser, who would then receive every organiser email, reminder, checklist nudge and admin count. Every query that means "real conferences" would need an extra filter forever.
- A separate table means nothing shows a listing unless it is asked to. Money, applications, the checkmark, spotlights, awards and email never see listings.

`conference_listings`:

| Column | Notes |
|---|---|
| `id`, `slug` | `slug` shares the conference slug namespace (see section 4) |
| `full_name`, `acronym` | Required: `full_name` |
| `start_date`, `end_date`, `dates_tbd` | |
| `format` | `in_person` / `online` / `hybrid` |
| `city`, `country` | Country as our country name (for hubs and flags) |
| `student_level` | `high_school` / `university` / `both` / null |
| `committees` | jsonb list of `{ name, abbreviation, topics[] }`, only what the site publishes |
| `summary` | Our own words, 40 to 120 words, written or approved by a person |
| `website_url` | Required. The conference's own site |
| `instagram_url` | Optional, public profile only |
| `sources` | jsonb list of `{ url, checked_at }` we read the facts from |
| `checked_at` | Last time a person checked the facts |
| `discovery` | How we found it: `search`, `instagram`, `calendar`, `society_page`, `submission`, `mymun_crosscheck` |
| `status` | `draft` → `live` → `claimed`, or `removed` |
| `claimed_conference_id`, `claimed_at` | Set on claim |
| `created_by`, timestamps | |

Quality bar (`listing_is_indexable(id)`, one SQL function, used by the page, the sitemap and the hubs, like `allHubs`):
- status `live`, website reachable at the last check, `checked_at` within the last 90 days;
- end date today or later (past listings are noindex, then removed after 60 days unless claimed);
- real dates (not to be decided) and a place (city and country, or online);
- either 2 or more committees, or a summary of at least 60 words.

Two small tables, both written only through RPCs:
- `conference_listing_claims`: who asked to claim which listing, the method, a code, the status (`pending` / `approved` / `rejected`), who decided it and when.
- `conference_listing_removals`: a removal request (optional name and contact to reply to, reason), handled by staff. A request hides the listing at once (status `removed`); staff can restore it if the request was not genuine.

RLS: anyone can read `live` and `claimed` listings. Only `is_platform_admin()` inserts or updates them. Claims and removals go through SECURITY DEFINER RPCs with rate limits.

## 2. The listing page

Same address as a conference: `/conferences/<slug>`. The route looks up a public conference first; if there is none, it looks for a `live` or `claimed` listing. One page component, `ListingView`, reusing the conference page's hero and section styles:

- Hero: name, acronym and year, dates, place (the place links to its hub), level. A plain mark beside the title: "Not on Gavelling yet".
- "About": our summary, then the committees and topics.
- Buttons: "Visit their website" (main), "Is this your conference? Claim it free" (secondary).
- Footer line: "Listed from the conference's public website, checked 12 Oct 2026", with the source link. "Not right? Request a correction or removal."
- No Apply, no fees, no reviews, no team, no spotlight, no share card beyond a plain one.
- JSON-LD: `Event` with name, dates, location, `eventAttendanceMode`, `url` = our page, `organizer.url` = their website, no `offers`. Plus breadcrumbs. Only when indexable.
- After a claim, until the organiser publishes, the same listing shows "Claimed by the organisers, coming to Gavelling soon". Once the conference is public, the conference page takes over the URL with no redirect needed.

## 3. Claiming

A signed-in user presses "Claim it free" and picks how to prove they run it (they need an account anyway to manage it):

1. **Email on the conference's own domain** (automatic). If the website is `example-mun.org`, they enter any address `@example-mun.org`, we send a 6-digit code, they enter it, the claim is approved at once. Uses `email_outbox` like every email.
2. **A code on their website or Instagram bio** (automatic for websites, staff-checked for Instagram). We show `gavelling-claim-7K2P`. They put it anywhere on their website (we fetch the page and look for it) or in their Instagram bio for a day (staff check by hand).
3. **Manual review** (fallback). They message @wearegavelling from the conference's official Instagram, or explain who they are; staff approve or reject in /admin.

Many MUN conferences only use a Gmail address, so method 2 or 3 will be common.

On approval (`approve_listing_claim`, one transaction):
- creates a `conferences` row owned by the claimer, `is_public = false`, copying every fact (name, acronym, dates, place, format, level, website, Instagram) and the committees into `conference_committees` (names, abbreviations, topics, no seats);
- gives that conference the listing's slug, so the URL that Google already ranks stays the same;
- marks the listing `claimed` with `claimed_conference_id`;
- sends one email to the claimer: "You now manage {name} on Gavelling. Finish setting it up", linking to `/manage/<slug>`;
- alerts the team inbox.

The organiser then sets roles, fees and payments as usual and publishes; publishing makes the conference page take over the URL. Our summary is NOT copied into their description; they write their own (the About fallback fills the page meanwhile).

Abuse limits: 3 open claims per account, one pending claim per listing per account, and staff can reverse an approval within 14 days (the conference goes back to a listing).

## 4. Slugs, hubs, sitemap, Explore

- **Slugs:** a listing takes its slug from the same ladder as conferences (`conferenceSlugLadder` and the database twin, which must change together), and the ladder must treat listing slugs as taken. On claim the conference inherits the slug. If a conference is created normally (not by claim) with the same name, the ladder gives it a different slug, and staff are alerted to merge (the listing then becomes `removed` with a 308 to the conference through `conference_slug_aliases`).
- **Hubs** (`src/lib/countryHubs.ts`): listings count toward a hub and appear in its list, marked "Not on Gavelling yet", after the real conferences. A hub is never indexable on listings alone (at least one real conference, or 3 or more indexable listings).
- **Sitemap:** indexable listings only, `lastmod` = `checked_at`.
- **`/conferences/all`:** listed, marked, linked (crawl path).
- **Explore:** a decision for Peter (see the end). My recommendation: not in the grid at first, only on hubs, `/conferences/all` and Google. Explore is the owner-designed shopfront and full of apply buttons.
- **Never:** spotlights, the homepage rail, the checkmark, awards, Store, email audiences, admin conference counts (these keep reading `conferences`).

## 5. Discovery and the admin tool

A new **Listings** tab in `/admin` (`is_platform_admin()` only):

1. **Queue:** staff paste a conference website (or add one by name). Sources to work through, all by hand or with tools that allow it:
   - Google searches like "Model UN 2026 <country>", "MUN conference <city> 2027" (by a person; automated Google scraping breaks their terms);
   - Instagram MUN accounts and hashtags (by a person; Meta forbids scraping);
   - public calendars that allow linking (Best Delegate's conference lists, university MUN society pages, national MUN associations);
   - a public "Suggest a conference" form on the hubs and `/conferences/all`;
   - mymun as a manual cross-check only: a person may notice a conference there and then go to its own website. No script reads mymun.
2. **Fetch:** the server fetches the conference's website (respecting robots.txt, user agent `GavellingBot/1.0 (+https://gavelling.com/bot)`, one page or a few), and pre-fills a form with what it can find: title, dates, city, committee names and topics. Optional: the Claude API turns the page text into the structured fields (cheap per page; a person still checks every field).
3. **Review:** the person checks each fact against the site, writes or edits the 40 to 120 word summary, and presses "Publish listing". Duplicate check against existing conferences and listings (name, acronym, year, dates).
4. **Recheck:** a weekly list of listings whose `checked_at` is older than 60 days or whose dates are close. One click re-fetches and shows what changed.

Pace: realistically 15 to 30 good listings a week by one person. That is the point: hand-checked pages, not a dump.

## 6. SEO effects and risks

- **Upside:** each listing can rank for the conference's name and year, searches we see in Search Console and currently lose. Hubs get fuller. Nobody else covers many of these conferences well.
- **Risk: Google's scaled content abuse policy** penalises many low-value pages made at scale. Guarded by: a person checks every listing, the summaries are written per conference, the quality bar keeps thin ones noindex, and the rollout is slow.
- **Risk: duplicates** of what the conference's own site says. We add value it doesn't have on its own: our summary, committees and topics together, links to similar conferences and hubs, and the claim path. Pages that end up adding nothing are noindex.
- **Watch:** Search Console impressions and clicks on listing URLs, the "Crawled, currently not indexed" count, and whether the site's overall clicks dip in the 4 weeks after each batch.

## 7. Legal notes (not legal advice)

- Facts (names, dates, places, committee names) are not protected by copyright. We write our own summaries, so no one's text is copied.
- We avoid extracting any directory's database (mymun or others). Each fact comes from the conference's own public website.
- Names of conferences are used only to identify them (nominative use). No logos in phase 1; the page shows a monogram. Logos only after a claim, uploaded by the organiser.
- No personal data, so GDPR exposure is minimal. Removal on request.
- A short public page `/listings` explains how listings work, how we source them, and how to claim, correct or remove one.

## 8. Metrics

- Listings live, indexable, and their Google impressions and clicks.
- "Visit their website" clicks and "Claim" clicks per listing (anonymous counter, as for banners).
- Claims started, approved, rejected; time from listing to claim.
- Claimed conferences that publish, open applications and take a first application.
- Removal requests (a high rate means our sourcing or summaries need work).

## 9. Rollout

- **Phase 0, build (about a week of work):** the tables and RPCs, the listing page, the claim flow with the three methods, the admin Listings tab with fetch and review, the removal form, the `/listings` explainer, hubs and sitemap wiring. Behind a switch `store_flags.listings_live` (off): while off, nothing public shows listings.
- **Phase 1, 20 listings:** hand-checked, in countries where we already have hubs (India, Pakistan, Egypt, UAE) plus a few big international ones. Switch on. Watch Search Console for 3 weeks.
- **Phase 2, about 100:** if listings get indexed and clicked and there are no removal complaints, widen to more countries, and add the "Suggest a conference" form.
- **Phase 3:** decide on Explore, and on a gentle in-product nudge for claimed-but-unpublished conferences.

## Decisions for Peter

1. **Explore:** keep listings out of Explore at first (hubs, `/conferences/all` and Google only), or show them in Explore marked "Not on Gavelling yet"?
2. **Claim proof:** are the three methods right (own-domain email automatic, website code automatic, Instagram or manual reviewed by staff)? Who reviews manual claims: you, Christian, or both?
3. **Who builds the listings:** you, Christian, or a helper or ambassador with a limited staff role? (The admin tab could allow an "editor" role that can only manage listings.)
4. **AI help for extraction:** use the Claude API to pre-fill fields from a conference's website (a person still checks), or keep it fully manual?
5. **Logos:** none until claimed (my recommendation), or allow the conference's logo with removal on request?
6. **Past listings:** remove 60 days after the conference ends (recommended), or keep as "past conferences" pages for next year's search?
