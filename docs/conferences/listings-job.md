# The Daily Listings Job

How Claude adds Gavelling listings (owner, 19 Oct 2026: "adding listings should be automatic, done by Claude"). The plan and its owner decisions: `docs/conferences/claimable-listings.md`. The database side is applied (migration `gavelling_listings`, 19 Oct 2026); the only write is `public.upsert_gavelling_listing(p jsonb)` through the Supabase MCP (`execute_sql`, project `luruhkwrgisytejswlas`), which runs as `postgres` and is allowed.

## Each run

1. **How many:** **30 new listings every run** (owner, 16 Nov 2026: "bump up dated conferences to 30 a day and just let me know when we run out"; was 10 since 29 Oct). Only a conference whose coming edition has real dates is listed; nothing undated is added to make up the number. Keep going until 30 are added: the day's planned candidates first, then `listings-pipeline-regions.md`, then the reserve list in order, then a city-and-month search. Stop at 30. **When the run cannot reach 30** because every candidate left is undated, past, already on Gavelling or otherwise fails, that is "running out": stop searching, and make the FIRST line of the report `Ran out of dated candidates: added N of 30`, with one line on what is left (how many candidates are waiting for dates, and where more could come from). If a push notification tool is available, send Peter that same line too. **Never re-check or update a listing that already exists** (owner, 19 Oct 2026: "no need to re check the already uploaded conferences every day"). A candidate already on Gavelling, as a listing or an organiser's conference, is skipped. Take the run's candidates from **This week's plan** below, in order; when a day's candidate fails (no website or Instagram of its own, no dates, past, already on Gavelling, a mymun event), take the next unused one. A conference with no website but its own public Instagram is NOT a failure: list it from its Instagram.
2. **Where (owner, 19 Oct 2026: a heavy focus on Europe, as proof of quality):** about **7 of every 10** new listings (21 of the 30) are European conferences: well-run university and school conferences across the UK, the Netherlands, Germany, France, Spain, Italy, Belgium, Switzerland, Austria, Ireland, the Nordics, Poland, the Czech Republic, Portugal, Greece, the Baltics and so on (well-known ones first: e.g. LSE, Oxford, Cambridge, Edinburgh, King's, UCL, Leiden, Maastricht, Groningen, Rotterdam, Berlin, Munich, Heidelberg, Sciences Po, Madrid, Barcelona, Rome, Bologna, Geneva, Vienna, Prague, Warsaw, Riga, Tallinn, Helsinki, Stockholm, Copenhagen). The other 3 of every 10 (9 of the 30): India, Pakistan, Egypt, the United Arab Emirates and big international conferences elsewhere (e.g. the US university circuit). Rotate cities and countries across runs so no single country floods the list.
2b. **Regional focus (owner, 15 Nov 2026):** the European picks now come FIRST from `docs/conferences/listings-pipeline-regions.md` (170 researched candidates in Poland, the Nordics and Baltics, the Balkans, Romania, Hungary, Slovakia, Türkiye, Greece and Cyprus), following that file's order and rules, before this week's plan and the reserve. Türkiye and Cyprus count as European. Still rotate countries within a run. A candidate whose coming edition has no dates yet stays in the file for a later run; skip it in the report as "no dates yet". The non-European picks come FIRST from Part 2 of the same file (345 candidates in Asia-Pacific, Latin America, Africa, the Middle East and the Caucasus, owner 15 Nov 2026), rotating between those three groups. In both parts, a row marked *(add city)* is sent with the city in its acronym.
3. **Only upcoming:** start date today or later, preferably within the next 12 months.

## Finding candidates

- Use web search (Claude's search tool) for things like "Model United Nations 2026 Lahore", "MUN conference Mumbai January 2027", "MUN Cairo 2027", "university Model UN conference 2027".
- **mymun pages may appear in results. Use them only to learn that a conference exists**, with one exception: the expected delegate number when the conference's own site gives none (see `expected_delegates`). Never copy anything else from mymun (their text, images, fees, dates). Go to the conference's OWN website, Linktree, public page or Instagram and take every fact from there. Skip it only when it has none of these.
- **Never list IEUMUN** (IE University, Madrid; owner, 20 Oct 2026), in any edition. It is hidden and the job must not add it again.
- Never list a conference run by mymun itself (MUN London, MUN Paris, MUN Bruxelles, MUN Rome, and any "mymun" branded event).
- Check robots.txt of the conference's site before fetching pages; respect it.
- **Instagram, read through Google only** (owner, 15 Nov 2026; many conferences post their dates, committees and topics only on Instagram). instagram.com's robots.txt disallows ClaudeBot (found 9 Nov), so never open instagram.com, never use an Instagram API, and never use Claude in Chrome for it. Read what Google's search results show instead: search `site:instagram.com "<name>"`, `"<handle>" instagram 2027` and `"<name>" 2027 instagram`, and take facts from the result titles and snippets (the bio and post captions). Also open any page the bio points to that is not Instagram (a Linktree, a Google Form, a Canva or Google site), respecting its robots.txt. A conference with only an Instagram is listed when the results state, for that account: the dates WITH the year of the coming edition (no year, or a date that could be last year's, does not count), the city, and either 2 or more committees or enough for a 60-word summary. A fact counts only when the search results tie it to that conference's own Instagram (its profile or a post URL in the results); never fill a gap from memory, and when a search answer is vague about where a date came from, search again more narrowly or skip. Put each Instagram URL the facts came from in `sources` and send `instagram_url`. Logo: leave `logo_url` out (Peter adds Instagram logos by hand); banner: a Wikimedia city photo as usual. `contact_email` only when an address appears word for word in a result or on a page you opened. In the report, list these as "from Google's Instagram results" so Peter can spot-check them.

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
- `city`, `country` (country in plain English, e.g. "Pakistan", "United Arab Emirates", "Egypt", "India"; always "Türkiye", never "Turkey" (owner, 15 Nov 2026), and the same spelling as the site's country list for any other country)
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

## This week's plan (17 to 23 November 2026)

Written 16 Nov 2026. Names are candidates, not facts: every date and detail still comes from the conference's own site, a page its bio links to, or Google's results for its own Instagram. Last week's lesson: most candidates in `listings-pipeline-regions.md` have their 2026-27 dates only on mymun, which never counts, and city-and-month searches in Western and Central Europe now mostly find conferences already on Gavelling. So each European candidate is tried through its own site first and then through Google's results for its Instagram (see Finding candidates) before it is skipped; and when Europe cannot fill its 7, the run fills the gap from elsewhere so it still reaches its number (16 Nov added only 6 of 10, none European). Watch out: on 16 Nov the search tool showed only Instagram profile titles, not bios or captions, so the Instagram route gave nothing; GDNMUN (Linktree dates, no committees) and BCMUN (own site lists six committees, no dates) were the nearest misses.

Already on Gavelling since the last plan (never added again): UDGA 2027 (Bangkok, added by hand 16 Nov), SCIMUN (Shenzhen), NGMUN (Dedham), McKendree MUN (Lebanon, Illinois), YMCA MUN (Minneapolis), HAMUN (Houston), MUNSA (San Antonio), and on 13 to 15 Nov UCLMUN, StarMUN, OLMUN, MUNUSAL, IMS Roma, Napoli, Bari, Padova and Torino, CANMUN, HSCMUN, King'sMUN, YUNMUN, FCMUN, WAMUN (Wichita), MSMUN, WMUN (Worcester), Rising Leaders MUN, UNAGB Arctic MUN, APG MUN (Manama), Summit MUN (Kuala Lumpur), IIST MUN and FWWMUN Bangkok. Found already on Gavelling by the 16 Nov searches: MUNoV, OPOMUN, DUMUN, NOVOMUN, IESMUN, AKAMUN, MUN Bilbao, MUNOT, AntwerpMUN, KULMUN, PLISMUN, IPMUN, StolaMUN, ILYMUN, YMUNE, WCDMUN, ALMUN, CBSMUN, THIMUN, AmsterMUN, MUNLawS, SGMUN, PyleaMUN, DSTMUN, ThessISMUN, PS-MUN, ISUMUN, COMUN, MANMUN, ScotMUN, LIMUN, Leirion MUN, LUMUN, IIMUN, MUNIK, HMUN Dubai, SHPGMUN, SEAMUN, KSU HSMUN, ODUMUNC, UMLMUN, FrankMUN, HUMUNC, ILMUNC, MMUN NYC, CAHSMUN, SAIMUN, CAAMUN (Cali) and AUBMUN (Beirut). Never used because robots.txt names ClaudeBot (besides the earlier list): KCSMUN (kcsmun.com), UNA Boulder IMUN3, UTMUN (also already listed). Dated only for past or TBD editions on 16 Nov: Rice MUN, Heartland MUN, Utah State, Iowa HSMUN, ADUMUN, CIMUN AUC, THIMUN Qatar, AUSMUN. CSIAMUN's site serves crawlers a challenge page.

Each day below names its first candidates only; with 30 a run, fill the rest from `listings-pipeline-regions.md` and the reserve.

| Day | Europe (7) | Elsewhere (3) |
|---|---|---|
| Tue 17 Nov | Instagram through Google: GDNMUN (Gdańsk), Thracing On MIC (Komotini), KronMUN (Brasov), TBSMUN (Warsaw), PozMUN (Poznań), BCMUN (Belek, own Wix site has committees, look for dates), TCMUN (Cluj) | NPSiMUN (Singapore), HKBUMUN (Hong Kong), KGV MUN (Hong Kong) |
| Wed 18 Nov | pipeline rows not yet tried: UNIMUN and EKOMUN (Wrocław), DEMUN (Gliwice), BiaMUN, KoszMUN, POMUN (Szczecin), BielMUN (Warsaw) | CIS MUN (Singapore), RongMUN (Wellington), Economix MUN (Jakarta) |
| Thu 19 Nov | VERAMUN and METAMUN (Mersin), ENKAMUN (Sakarya), HCSMUN (Ankara), BISMUN (Istanbul), SucMUN (Sucany), KOMUN (Kosice) | El Oro MUN (Machala), CPMUN (Rio de Janeiro), Ubuntu MUN (Nairobi) |
| Fri 20 Nov | EPMUN Nicosia (send with the city: EPMUN is taken), NAMUN (Prishtina), HTFMUN and TISMUN Tirana (send with the city), UNYA Aalborg MUN, NordMUN (Ystad), Corinthian (Corinth) | Crisis Room (Damour), Carmel MUN (Lagos), PEBMUN (Tashkent) |
| Sat 21 Nov | ISMUN (Trnava), MGES and Model Olympics (Bratislava), MODMUN (Ankara), IMPERIA (Mersin), FUTUREMUN (Kayseri), ATUMUN (Erzurum) | Justitia MUN (Ulaanbaatar), SBMUN (Phnom Penh), SMMUN (Lima) |
| Sun 22 Nov | GeMUN (Genoa, usually late Feb), MISMUN (Marrakech, if its own page appears), Leipzig International School MUN, Lyon, Cologne and Leipzig 2027 editions if dated | US independent and university-hosted school conferences with own sites (Texas, Florida, Georgia, Ohio, Michigan, Colorado) |
| Mon 23 Nov | city-and-month searches in Scandinavia and Ireland for spring 2027 | OSUMUN (Columbus, own site), GTMUN (Atlanta), BSBMUN (Brasília, needs the year on its site) |

**Reserve** (in order): any of the above that a later day finds dated; the rest of `listings-pipeline-regions.md` country by country; elsewhere: US independent schools and state universities with their own conference sites (the vein that filled 16 Nov), Canada (Ontario, British Columbia), Australia and Japan school conferences.

At the end of the week, write next week's plan here the same way, dropping everything that was added or skipped.

## Report

End each run with a short report: each listing added or updated (name, city, dates, slug, live or private, why private if so), candidates skipped and why (already on Gavelling, no own website, past, mymun's own event), and anything that needs Peter.

## Blocklist (29 Oct 2026, owner)

Peter asked for the three hidden listings (CWMUN Paris, CWMUN Rome, IEUMUN) to be deleted completely and never added again. Deleting the row would have dropped the "archived" guard, so `gavelling_listing_blocklist` (RLS on, no policies) now holds each one's listing key without the year (`cwmunparis`, `cwmunrome`, `ieumun`), and `upsert_gavelling_listing` returns `{ok:false, reason:'blocked'}` for any edition of them. The job skips a `blocked` answer like `removed` and never tries to get round it under another name or acronym. To delete another listing for good: add its row to the blocklist first, then delete the conference.
