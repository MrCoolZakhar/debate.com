# Gavelling brand assets — which file to use

Read this before adding, replacing or referencing a logo. The "wrong logo" bug
below has come back repeatedly; the rules here are what stop it.

## The two shapes

There is ONE piece of artwork — a dark wooden gavel crossed over a green olive
wreath — and it ships in two shapes. They are not interchangeable.

### 1. The MARK (square, transparent)

Use wherever the container is **square, round, or cropping**: favicons, app
icons, avatars, discs, chips, structured-data logos, anything `object-cover`.

| File | Size | Notes |
|------|------|-------|
| `src/app/icon.png` | 512x512 | **CANONICAL MASTER.** Next.js file convention -> favicon. |
| `src/app/apple-icon.png` | 512x512 | Byte-identical to the master. Apple touch icon. |
| `gavelling-mark.png` | 512x512 | Byte-identical to the master, at a stable public URL. Used by the `send-setup-nudges` Supabase edge function and by JSON-LD (`src/lib/seo.ts`). **Do not delete — `grep` shows no hits because the consumers are remote.** |
| `gavel-mark.png` / `.webp` | 300x300 | In-app mark (`Brand.tsx`, `SiteNav` credit chip, auth pages). Derived from the master. |

### 2. The LOCKUP (wide, ~4:1)

Mark on the left, then the word "GAVELLING" starting at roughly x=185.

| File | Size | Notes |
|------|------|-------|
| `GavellingLogo.png` / `.webp` | 800x200 | Site + session headers. |
| `GavellingSessionsApp.png` / `.webp` | 800x200 | Sessions nav. |
| `Conferences.png` / `.webp` | 800x200 | Conferences nav. |
| `og-image.png` / `.jpg` | 1200x630 | Share card. Mark only, centred — no wordmark to slice. |

Use a lockup **only** in a genuinely wide container that CONTAINS it:
`object-contain` with `w-auto` or `h-auto`, or a width/height pair in an exact
4:1 ratio.

## The recurring bug: the crescent "C"

If you put a **lockup** in a **square or circular** container, it gets cropped
from the left. You then see the gavel plus the leftmost curve of the capital
**G** of "GAVELLING" — which reads as a crescent, or a "C" bitten out of the
right-hand side of the artwork. That crescent is not a different logo file. It
is the right file in the wrong container.

This has bitten us twice, in two different ways:

1. **At render time** — `Organization.logo` in JSON-LD pointed at the wide
   lockup on ~36 pages. Google renders that as a small square and crops it.
   Fixed by `JSONLD_PUBLISHER` / `JSONLD_LOGO` in `src/lib/seo.ts`; import
   those rather than re-typing the object.
2. **Baked into a file** — `gavel-mark.png` and `gavel-mark.webp` were
   themselves produced by square-cropping a lockup, so the left bowl of the G
   was *inside the PNG*, as opaque white pixels at x 246-300.

### Why nobody caught #2 for so long

The stray G was **opaque white on a transparent background**. On ivory
(`#EDE7D8` / `#FAF8F3`) — which is most of the app — and in Finder, Preview and
GitHub, all of which preview transparency on white, it was **completely
invisible**. It only appeared on the forest-green surfaces (`#1B3828`), which is
exactly where `Brand tone="dark"` and the `SiteNav` credit chip render it.

So every reviewer opened the file, saw a correct-looking mark, and closed it.

**Rule: always check a transparent mark against a DARK background, not white.**

## The guard

```bash
npm run check:brand
```

`scripts/check-brand-marks.mjs` fails if a square mark contains a blob of
opaque near-white pixels away from the centre — the signature of a sliced
wordmark. Run it after touching any file above. Wire it into CI when convenient.
