# MUNillion (/games)

The daily MUN trivia game (owner, 26 Nov 2026). It's modelled on Krillion's mechanic: 7 prompts a day, 30 seconds each, and rarer correct answers score more. The art, name and look are our own: an ivory pixel hall where a delegate's hand raises a placard showing the score.

## How it works

- **Scores are preset by Gavelling.** They are never computed from what players answer. Peter reviews every list at `/admin/munillion` before a game is published.
  - 100 The Gavel: exactly one answer per question, enforced by a unique index.
  - 85 Best Delegate.
  - 60 Outstanding Delegate.
  - 30 Honourable Mention.
  - 10 Participation Certificate.
  - 0 Absent: wrong, passed or out of time.
- **Only the MUN conference question is dynamic.**
  - Every public, non-test conference counts (`is_public`, status `public`, not `conference_is_test`), and so do public Gavelling listings.
  - It scores the question's `default_tier`, or an override row in `munillion_answers` (whose `link_slug` gives the page it links to).
  - Blocked conferences (`gavelling_listing_blocklist`) never count, are never shown and are never reported.
- **Autocorrect, like Krillion** (owner, 26 Nov 2026).
  - A near miss is not scored. `munillion_answer` answers `status: 'suggest'` with the answer it thinks you meant, the page fills the box with it ("Vogue magazin" becomes "Vogue"), and submitting again confirms, because that's an exact match.
  - It catches four kinds of near miss: the start of an answer (4 letters or more), an answer followed by extra words, one typo (two for 10 letters or more), and two neighbouring letters swapped. A tie goes to the longer answer (`_munillion_suggest_list`).
  - Conferences are corrected against `munillion_conf_index` (`_munillion_suggest_conf`).
- **Lenient autocorrect** (owner, 26 Nov 2026, migration `munillion_lenient_autocorrect`).
  - Accepted straight away: the same word with another ending ("condemning" counts as Condemns) or with a leading "strongly", "further", "also" and so on (`_munillion_match_lenient`).
  - Offered as a suggestion: anything about 60% similar (`_munillion_sim`: typos, swaps, part of an answer, an answer inside what was typed, initials such as "icj").
  - For conferences, the first word of an acronym ("HMUN") finds the conference.
  - Game 1's operative clause list was expanded to about 200 openers.
- **The look on screen** (same day).
  - One screen on every device (100dvh, less the 62px mobile tab bar), with the top bar floating over the hall.
  - The hand sits behind every panel, dimmed. After each answer it grows with the total (0.85 times at zero up to about 4 times at 700), fast then slowing, swaying side to side. The Gavel spins it.
  - Pixel bursts, a screen shake for 85 and up, and a flash for The Gavel.
  - A compact Today and Scoring panel on the right from 1024px.
  - Chiptune sounds synthesised in the browser (`src/app/games/munillion/sound.ts`, with a mute switch remembered on the device).
- **Conference index.** Conference names are normalised once into `munillion_conf_index`, rebuilt every 10 minutes by cron `munillion-conf-index` (`_munillion_conf_index_refresh`), so a new conference counts within 10 minutes. Matching an answer reads the index: about 12 ms, against 6 s before.
- **The reveal returns every answer.** For the conference question that means every indexed conference, at the default score, each with a link. The page shows one row per round that opens into score filters, a search box and the full list.
- **Unrecognised answers** are saved in `munillion_misses`, for every question. You can retry while the clock runs, up to 25 tries.
- **New-conference email.** When 3 different players type the same conference that isn't on Gavelling, one email goes to info@gavelling.com (`_munillion_conf_alert`): once per name, at most 10 a day.
- **The clock lives in the database.** `munillion_open` stamps `opened_at`, and an answer more than `seconds + 3` after it is Absent. A reload never resets a question.
- **Players.** A player is `u:<user id>` when signed in, otherwise `d:<sha256 of the browser token>` (`localStorage gavelling-munillion-token`). Signing in moves the browser's plays onto the account (`_munillion_claim`, run inside `munillion_today` and `munillion_history`).
- **Today's game** is the newest published game dated today or earlier, in UTC. The streak is the number of consecutive published games finished, counted back from the newest.
- **The answer key** is only returned by `munillion_reveal` once the player has finished.
- **The preview is open to anyone** (owner, 26 Nov 2026: not behind a staff account). `/games?preview=1` plays the newest game, published or not, signed in or not. `munillion_reset_preview_play` lets anyone clear their own play of an unpublished game to try again (migration `munillion_open_preview`). A preview play counts as that player's real play once the game is published.

## Where things live

- **Database:** `scratch-munillion.sql`, the record of what's applied. Migrations: `munillion_core`, `munillion_seed_game_1`, `munillion_blocklist_names`, `munillion_open_preview`, `munillion_autocorrect_and_full_reveal`, `munillion_conf_index`, `munillion_autocorrect_swaps` and `munillion_autocorrect_ties`. They were applied from Claude Code with Peter's one-off approval on 26 Nov 2026.
- **Tables:** `munillion_games`, `_questions`, `_answers`, `_plays`, `_play_answers`, `_misses` and `_miss_alerts`. RLS is on with no policies, so tables are only reached through the functions.
- **Client:**
  - `src/lib/munillion.ts`: calls, tiers and the token.
  - `src/components/munillion/PixelArt.tsx`: tier icons and the desk scene.
  - `src/app/games/*`: the page. It loads the Press Start 2P and VT323 fonts on /games only. The background is `public/games/munillion-hall.jpg`, a pixel-art General Assembly hall generated in Canva on 26 Nov 2026.
  - `src/app/account/games`: the profile Games tab.
  - `src/app/admin/munillion`: the review page.
- **Answer lists for game 1:** `scripts/munillion/day1/*.json`. The seed is `seed.json`.

## Adding a game

Insert a `munillion_games` row with the next `number` and an unused `game_date`, plus its 7 questions and their answers. Do this through the chat's Supabase work, following the seed pattern in `munillion_seed_game_1`. Then review it in `/admin/munillion`, play it with `/games?preview=1`, and publish.
