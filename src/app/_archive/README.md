# Archived pages

`_archive` is a private folder: Next.js never routes anything under it. Pages live
here when the owner takes a feature off the site but wants the code kept.

- `conferences-map/`: the conference world map (`/conferences/map`), archived on
  25 Sep 2026 at the owner's request ("put the map in archives completely").
  `/conferences/map` now redirects to `/conferences/explore` (next.config.ts), and
  every link, the sitemap entry and the homepage globe section were removed. To
  bring it back, move the folder to `src/app/conferences/map/`, remove the
  redirect, and add the sitemap entry and links back.
