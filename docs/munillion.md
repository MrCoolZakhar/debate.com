# MUNillion (/games)

The daily MUN trivia game (owner, 26 Nov 2026). It's modelled on Krillion's mechanic: 7 prompts a day, 30 seconds each, and rarer correct answers score more. The art, name and look are our own: an ivory pixel hall where a delegate's hand raises a placard showing the score.

## How it works

- **Scores are preset by Gavelling.** They are never computed from what players answer. Peter reviews every list at `/admin/munillion` before a game is published.
  - 100 Gavel: exactly one answer per question, enforced by a unique index.
  - 85 Best Delegate.
  - 60 Outstanding Delegate.
  - 30 Honourable Mention.
  - 10 Participation Certificate.
  - 0 Absent: wrong, passed or out of time.
- **Only the MUN conference question is dynamic.**
  - Every public, non-test conference counts (`is_public`, status `public`, not `conference_is_test`), and so do public Gavelling listings.
  - It scores the question's `default_tier`, or an override row in `munillion_answers` (whose `link_slug` gives the page it links to).
  - Blocked conferences (`gavelling_listing_blocklist`) never count, are never shown and are never reported.
- **Unrecognised answers** are saved in `munillion_misses`, for every question. You can retry while the clock runs, up to 25 tries.
- **New-conference email.** When 3 different players type the same conference that isn't on Gavelling, one email goes to info@gavelling.com (`_munillion_conf_alert`): once per name, at most 10 a day.
- **The clock lives in the database.** `munillion_open` stamps `opened_at`, and an answer more than `seconds + 3` after it is Absent. A reload never resets a question.
- **Players.** A player is `u:<user id>` when signed in, otherwise `d:<sha256 of the browser token>` (`localStorage gavelling-munillion-token`). Signing in moves the browser's plays onto the account (`_munillion_claim`, run inside `munillion_today` and `munillion_history`).
- **Today's game** is the newest published game dated today or earlier, in UTC. The streak is the number of consecutive published games finished, counted back from the newest.
- **The answer key** is only returned by `munillion_reveal` once the player has finished.
- **The preview is open to anyone** (owner, 26 Nov 2026: not behind a staff account). `/games?preview=1` plays the newest game, published or not, signed in or not. `munillion_reset_preview_play` lets anyone clear their own play of an unpublished game to try again (migration `munillion_open_preview`). A preview play counts as that player's real play once the game is published.

## Where things live

- **Database:** `scratch-munillion.sql`, the record of what's applied. Migrations: `munillion_core`, `munillion_seed_game_1` and `munillion_blocklist_names`. They were applied from Claude Code with Peter's one-off approval on 26 Nov 2026.
- **Tables:** `munillion_games`, `_questions`, `_answers`, `_plays`, `_play_answers`, `_misses` and `_miss_alerts`. RLS is on with no policies, so tables are only reached through the functions.
- **Client:**
  - `src/lib/munillion.ts`: calls, tiers and the token.
  - `src/components/munillion/PixelArt.tsx`: tier icons and the desk scene.
  - `src/app/games/*`: the page. It loads the Silkscreen and Pixelify Sans fonts on /games only.
  - `src/app/account/games`: the profile Games tab.
  - `src/app/admin/munillion`: the review page.
- **Answer lists for game 1:** `scripts/munillion/day1/*.json`. The seed is `seed.json`.

## Adding a game

Insert a `munillion_games` row with the next `number` and an unused `game_date`, plus its 7 questions and their answers. Do this through the chat's Supabase work, following the seed pattern in `munillion_seed_game_1`. Then review it in `/admin/munillion`, play it with `/games?preview=1`, and publish.
