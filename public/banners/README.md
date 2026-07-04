# Banner presets

Five license-safe conference-themed photos offered as one-click banner presets
(manage → Settings → Visual, and the creation flow step 2). All sourced from
Unsplash (free to use under the Unsplash License), downloaded via
images.unsplash.com and compressed with `sips` to stay under ~350 KB each.

| File | Subject | Source |
|------|---------|--------|
| `preset-1.jpg` | Grand parliamentary chamber in full session (plenary hall) | https://unsplash.com/photos/1529107386315-e1a2ed48a620 — via https://images.unsplash.com/photo-1529107386315-e1a2ed48a620 |
| `preset-2.jpg` | Conference audience under stage lights | https://unsplash.com/photos/1540575467063-178a50c2df87 — via https://images.unsplash.com/photo-1540575467063-178a50c2df87 |
| `preset-3.jpg` | Keynote stage with a large presentation screen | https://unsplash.com/photos/1505373877841-8d25f7d46678 — via https://images.unsplash.com/photo-1505373877841-8d25f7d46678 |
| `preset-4.jpg` | Delegates working together around a table | https://unsplash.com/photos/1517048676732-d65bc937f952 — via https://images.unsplash.com/photo-1517048676732-d65bc937f952 |
| `preset-5.jpg` | Podium microphone, taking the floor | https://unsplash.com/photos/1475721027785-f74eccf877e2 — via https://images.unsplash.com/photo-1475721027785-f74eccf877e2 |

These paths are referenced as `/banners/preset-N.jpg` in:
- `src/app/manage/[slug]/settings/page.tsx` (Visual tab preset picker)
- `src/app/conferences/new/page.tsx` (step-2 banner preset picker)
- seeded into `conferences.banner_url` for rows that had no banner.
