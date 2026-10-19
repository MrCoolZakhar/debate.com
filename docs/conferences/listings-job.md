# The Daily Listings Job

How Claude adds Gavelling listings (owner, 19 Oct 2026: "adding listings should be automatic, done by Claude"). The plan and its owner decisions: `docs/conferences/claimable-listings.md`. The database side is applied (migration `gavelling_listings`, 19 Oct 2026); the only write is `public.upsert_gavelling_listing(p jsonb)` through the Supabase MCP (`execute_sql`, project `luruhkwrgisytejswlas`), which runs as `postgres` and is allowed.

## Each run

1. **How many:** up to **10 new listings** per run. Updating an existing listing (new dates, committees found) does not count toward the 10.
2. **Where (owner, 19 Oct 2026: a heavy focus on Europe, as proof of quality):** about **7 of every 10** new listings are European conferences: well-run university and school conferences across the UK, the Netherlands, Germany, France, Spain, Italy, Belgium, Switzerland, Austria, Ireland, the Nordics, Poland, the Czech Republic, Portugal, Greece, the Baltics and so on (well-known ones first: e.g. LSE, Oxford, Cambridge, Edinburgh, King's, UCL, Leiden, Maastricht, Groningen, Rotterdam, Berlin, Munich, Heidelberg, Sciences Po, Madrid, Barcelona, Rome, Bologna, Geneva, Vienna, Prague, Warsaw, Riga, Tallinn, Helsinki, Stockholm, Copenhagen). The other 3: India, Pakistan, Egypt, the United Arab Emirates and big international conferences elsewhere (e.g. the US university circuit). Rotate cities and countries across runs so no single country floods the list.
3. **Only upcoming:** start date today or later, preferably within the next 12 months.

## Finding candidates

- Use web search (Claude's search tool) for things like "Model United Nations 2026 Lahore", "MUN conference Mumbai January 2027", "MUN Cairo 2027", "university Model UN conference 2027".
- **mymun pages may appear in results. Use them only to learn that a conference exists.** Never copy anything from mymun (their text, images, fees, dates). Go to the conference's OWN website (or its own Linktree / public page) and take every fact from there. If a conference has no website or public page of its own, skip it.
- Never list a conference run by mymun itself (MUN London, MUN Paris, MUN Bruxelles, MUN Rome, and any "mymun" branded event).
- Check robots.txt of the conference's site before fetching pages; respect it.
- **Instagram:** only use what is visible without logging in; do not log in, do not scrape feeds. If committees and topics are only on Instagram behind a login, leave them out.

## Before adding one

Run, and skip the candidate if it matches (a private conference counts too):

```sql
select slug, full_name, acronym, start_date, listed_by, is_public
  from conferences
 where full_name ilike '%<name words>%' or acronym ilike '<ACRONYM>%';
```

The upsert also refuses a duplicate of an organiser's conference (`reason: on_gavelling`) and updates an existing listing instead of making a second one (dedupe on acronym + year).

## What to send

```sql
select public.upsert_gavelling_listing('{ ... }'::jsonb);
```

- `full_name` (official name), `acronym` (as the conference writes it, with no year if possible)
- `start_date`, `end_date` (YYYY-MM-DD); if the site gives no dates, skip the conference
- `format`: `in-person`, `online` or `hybrid`
- `city`, `country` (country in plain English, e.g. "Pakistan", "United Arab Emirates", "Egypt", "India")
- `student_level`: `school`, `university` or `both` (from the site; `both` if unclear)
- `expected_delegates` only when the site states a number
- `summary`: **our own words**, 50 to 110 words, factual, no hype, no em or en dashes, never copied from their site. What it is, who runs it (the school or university), where and when, who it is for, what is notable (committees, size, edition number). Mention that it is listed from the conference's website and can be claimed is NOT needed; the page says that.
- `website_url` (https) and/or `instagram_url` (https://instagram.com/<profile>)
- `logo_url`: the conference's own logo image URL from its site (https), if clearly theirs
- `banner_url`: the conference's own banner/hero image from its site if there is one; otherwise a free-to-use photo of the city from Wikimedia Commons (public domain, CC0, CC BY or CC BY-SA only; use the direct upload.wikimedia.org file URL) with `banner_credit`: `{ "author": "...", "source_url": "<the Commons file page>", "license": "CC BY-SA 4.0", "license_url": "https://creativecommons.org/licenses/by-sa/4.0/" }`. Never use a photo of people.
- `committees`: `[{ "name": "...", "abbreviation": "...", "type": "general-assembly|specialised|crisis|press", "topics": ["..."] }]` from their site, study guides or public pages. Up to 3 topics each.
- `sources`: every page you used, as `[{ "url": "..." }]`
- `checked_at`: now

A listing goes live only when it passes the quality bar (real dates, a place, a website or Instagram, and 2 or more committees or a summary of 60+ words) AND the `listings_live` switch is on. Otherwise it stays private for Peter to see in /admin.

## Rules

- No personal data: no names of secretariat members, no emails, no phone numbers, no photos of people.
- Facts only; if unsure about a fact, leave it out.
- Never touch a conference whose `listed_by` is `organiser`. The upsert refuses anyway.
- Never call any function that sends email. The upsert sends none.

## Report

End each run with a short report: each listing added or updated (name, city, dates, slug, live or private, why private if so), candidates skipped and why (already on Gavelling, no own website, past, mymun's own event), and anything that needs Peter.
