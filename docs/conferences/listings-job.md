# The Daily Listings Job

How Claude adds Gavelling listings (owner, 19 Oct 2026: "adding listings should be automatic, done by Claude"). The plan and its owner decisions: `docs/conferences/claimable-listings.md`. The database side is applied (migration `gavelling_listings`, 19 Oct 2026); the only write is `public.upsert_gavelling_listing(p jsonb)` through the Supabase MCP (`execute_sql`, project `luruhkwrgisytejswlas`), which runs as `postgres` and is allowed.

## Each run

1. **How many:** **10 to 20 new listings** per run (owner, 19 Oct 2026): the day's 10 planned candidates first, then up to 10 more from the reserve list, in order. **Never re-check or update a listing that already exists** (owner, 19 Oct 2026: "no need to re check the already uploaded conferences every day"). A candidate already on Gavelling, as a listing or an organiser's conference, is skipped. Take the run's candidates from **This week's plan** below, in order; when a day's candidate fails (no website of its own, no dates, past, already on Gavelling, a mymun event), take the next unused one from the reserve list.
2. **Where (owner, 19 Oct 2026: a heavy focus on Europe, as proof of quality):** about **7 of every 10** new listings are European conferences: well-run university and school conferences across the UK, the Netherlands, Germany, France, Spain, Italy, Belgium, Switzerland, Austria, Ireland, the Nordics, Poland, the Czech Republic, Portugal, Greece, the Baltics and so on (well-known ones first: e.g. LSE, Oxford, Cambridge, Edinburgh, King's, UCL, Leiden, Maastricht, Groningen, Rotterdam, Berlin, Munich, Heidelberg, Sciences Po, Madrid, Barcelona, Rome, Bologna, Geneva, Vienna, Prague, Warsaw, Riga, Tallinn, Helsinki, Stockholm, Copenhagen). The other 3: India, Pakistan, Egypt, the United Arab Emirates and big international conferences elsewhere (e.g. the US university circuit). Rotate cities and countries across runs so no single country floods the list.
3. **Only upcoming:** start date today or later, preferably within the next 12 months.

## Finding candidates

- Use web search (Claude's search tool) for things like "Model United Nations 2026 Lahore", "MUN conference Mumbai January 2027", "MUN Cairo 2027", "university Model UN conference 2027".
- **mymun pages may appear in results. Use them only to learn that a conference exists**, with one exception: the expected delegate number when the conference's own site gives none (see `expected_delegates`). Never copy anything else from mymun (their text, images, fees, dates). Go to the conference's OWN website (or its own Linktree / public page) and take every fact from there. If a conference has no website or public page of its own, skip it.
- **Never list IEUMUN** (IE University, Madrid; owner, 20 Oct 2026), in any edition. It is hidden and the job must not add it again.
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
- `expected_delegates`: always send one (owner, 19 Oct 2026). In order: the number the conference's own site or Instagram states; else the number on its MyMUN page (mymun.com) or another public listing; else an estimate, about 25 delegates per committee you found (a conference with no committee list: 150), rounded to the nearest 50. Add the page the number came from to `sources`. When re-checking a listing that has no delegates number yet, send one too.
- `summary` (up to 4000 characters, owner, 19 Oct 2026): **our own words**, never copied from their site, factual, no hype, no em or en dashes. Three short paragraphs separated by a blank line: (1) what it is and who runs it (the school or university), (2) where, when, the edition and the size, (3) who it is for and what is notable. Then, when committees are known, a blank line, the line `Committees`, and one line per committee: an emoji for its kind (🚨 crisis, 🏛️ historical, ⚖️ court, 🛡️ security or disarmament, 🩺 health, 🌍 environment, 📚 education and culture, 🕊️ human rights and refugees, 💼 economic and trade, 💊 drugs, 🚀 space, 🌾 food, 💻 cyber and AI, 📰 press, ⚛️ atomic energy, ⚓ maritime, 🌱 youth or middle school, 🤝 anything else), the committee's full name and its topics in brackets separated by semicolons, e.g. `🛡️ United Nations Security Council (The India-Pakistan Escalation)`. No list markers, no Markdown. Mentioning that it is listed from the conference's website and can be claimed is NOT needed; the page says that.
- `website_url` (https) and/or `instagram_url` (https://instagram.com/<profile>)
- `logo_url`: the conference's own logo image URL from its site (https), if clearly theirs
- `banner_url`: the conference's own banner/hero image from its site if there is one; otherwise a free-to-use photo of the city from Wikimedia Commons (public domain, CC0, CC BY or CC BY-SA only; use the direct upload.wikimedia.org file URL) with `banner_credit`: `{ "author": "...", "source_url": "<the Commons file page>", "license": "CC BY-SA 4.0", "license_url": "https://creativecommons.org/licenses/by-sa/4.0/" }`. Never use a photo of people.
- Image rules (21 Oct 2026, after 35 banners and 3 logos failed to load on the live site): `/api/listing-image` refuses SVG and anything over 5 MB. A Wikimedia banner is ALWAYS its thumbnail URL, `https://upload.wikimedia.org/wikipedia/commons/thumb/<a>/<ab>/<File>/1920px-<File>` (never the original file, which is usually far over 5 MB); never an SVG logo (use a PNG, JPG or WebP from the site, or leave `logo_url` null); and open every image URL once before sending it: it must answer 200 with an image type.
- `committees`: `[{ "name": "...", "abbreviation": "...", "type": "general-assembly|specialised|crisis|press", "difficulty": "beginner|intermediate|advanced|expert", "topics": ["..."] }]` from their site, study guides or public pages. Up to 3 topics each. `difficulty` is the conference's own label when it gives one; otherwise the usual level: expert for crisis, historical committees and courts (ICJ, ICC); advanced for the Security Council, NATO, the G20, the African Union and other small specialised councils; intermediate for General Assembly main committees (DISEC, SPECPOL, ECOSOC, SOCHUM, Legal), UNODC, trade, development and press; beginner for UNESCO, UNEP, WHO, the Human Rights Council, UN Women, youth and middle school committees.
- `contact_email` (owner, 22 Oct 2026): the conference's own general address, for one outreach email offering them the listing. Look on its website (Contact, About, Imprint or Impressum, the footer, the FAQ), then its mymun.com page. Prefer a general or role address on the conference's own domain (info@, contact@, secretariat@, sg@, mun@). Never a named private person's address (a personal gmail of the Secretary-General, a teacher's name), never a guessed or constructed one: it must appear verbatim on a page you opened, and that page goes in `sources`. None found: leave it out (the listing keeps our inbox). It is never shown on the page; a later re-check without it keeps the stored one.
- `sources`: every page you used, as `[{ "url": "..." }]`
- `checked_at`: now

A listing goes live only when it passes the quality bar (real dates, a place, a website or Instagram, and 2 or more committees or a summary of 60+ words) AND the `listings_live` switch is on. Otherwise it stays private for Peter to see in /admin.

## Rules

- No personal data: no names of secretariat members, no personal emails, no phone numbers, no photos of people. The one email collected is the conference's own general address (`contact_email` above).
- Facts only; if unsure about a fact, leave it out.
- Never touch a conference whose `listed_by` is `organiser`. The upsert refuses anyway.
- Never call any function that sends email. The upsert sends none.

## This week's plan (27 October to 2 November 2026)

Written 26 Oct 2026. Names are candidates, not facts: every date and detail still comes from the conference's own site, and a candidate that fails a check is skipped for the next one in the reserve. About 7 of every 10 are European. Many names on the first week's list were guesses that turned out not to exist, so this list leans on conferences a run has already confirmed are real (several were skipped only because their own site had no 2027 dates yet; check those again). When a day's names run dry, search by city and month ("Model United Nations February 2027 <city>") and check the result against the database. Already on Gavelling and never added again: BERMUN, BIMUN ESADE, BIMUN/SINUB, CBSMUN, HMUN Dubai, HNMUN, ILMUNC India, MUNoV, OxIMUN, PRAMUN, LIMUN, TIMUN (Tilburg), KULMUN (Leuven), NORMUN (Oslo). Hidden on purpose, never added: IEUMUN and every Change the World MUN (CWMUN) edition. "QMUN" is also an Indian organiser conference: Queen Mary's is listed as "QMUN London".

| Day | Europe (7) | Elsewhere (3) |
|---|---|---|
| Tue 27 Oct | LSEMUN (London), BrisMUN (Bristol), SOTONMUN (Southampton), DurMUN (Durham), KCLMUN (London), WarwickMUN, FWWMUN London | HMUN (Harvard, Boston, high school), CIMUN (Chicago), Hofstra MUN (New York) |
| Wed 28 Oct | ZuMUN (Zurich), GIMUN (Geneva), BaMUN (Basel), LUXMUN (Luxembourg), StrasMUN (Strasbourg), PIMUN (Paris), MUN'ICP (Reims) | NHSMUN (New York), CMUNC (Cornell), DUMUNC (Duke) |
| Thu 29 Oct | POITIERSMUN (Poitiers), MUNLM (Le Mans), HeiMUN (Heidelberg), MAMUN (Mannheim), FREIMUN (Freiburg), RiMUN (Nijmegen), GeMUN (Germany) | JHUMUNC (Baltimore), UFMUN (Gainesville), THIMUN Qatar (Doha) |
| Fri 30 Oct | HELIMUN (Helsinki), Mothenburg MUN (Gothenburg), SCANDMUN, SISMUN Scandinavia, KattaMUN, MUNOM (Malmö, next edition), VIMUN (Vienna) | CIMUN AUC (Cairo), AitchMUN (Lahore), HMUN India |
| Sat 31 Oct | SPLIMUN (Split), MEDMUN, HDMUN, URJCmun (Madrid), SeviMUN (Seville), ROMUN (Rome), MUIMUN | GIKMUN (Topi), Delhi MUN, IMUN India |
| Sun 1 Nov | Davis College MUN (Cork), UCDMUN (Dublin), TCD MUN (Dublin), YorkMUN (York), LeedsMUN, NottsMUN (Nottingham), ExMUN (Exeter) | Kuwait MUN, Bahrain MUN, Muscat MUN |
| Mon 2 Nov | ViMUN (Vilnius), RIGAMUN (Riga), KrakMUN (Krakow), ZagrebMUN, SofiaMUN, BelgradeMUN, CoimbraMUN | Kolkata MUN, Pune MUN, Peshawar MUN |

**Reserve** (in order): GrazMUN, InnsbruckMUN, LausanneMUN, BernMUN, GöttingenMUN, MünsterMUN, GalwayMUN, SheffMUN (Sheffield), GlasMUN (Glasgow), St Andrews MUN, Ghent MUN, Eindhoven MUN, TübingenMUN, LjubljanaMUN, MaltaMUN, PaduaMUN, GranadaMUN, ValMUN (Valencia), ReykjavikMUN, OsloMUN; elsewhere: Lahore Grammar MUN, Riyadh MUN, Hyderabad MUN, a UAE university conference (AUD, AUS), a Pakistani university conference (NUST, IBA).

At the end of the week, write next week's plan here the same way, dropping everything that was added or skipped.

## Report

End each run with a short report: each listing added or updated (name, city, dates, slug, live or private, why private if so), candidates skipped and why (already on Gavelling, no own website, past, mymun's own event), and anything that needs Peter.
