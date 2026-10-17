<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 9. Commands, checks and environment

```bash
npm run dev          # localhost:3000
npm run build        # runs `prebuild` first: scripts/check-brand-marks.mjs fails the build on brand-mark violations
npm run lint
npm run check:og     # validates pageMetadata / OG rules against a running production server
npm run check:indexability   # sitemap, canonicals, noindex, robots, crawl links (default https://gavelling.com; -- --base=http://localhost:3000)
npm run check:text-overlaps  # text clipped / truncated / overlapping because of the brand font (default http://localhost:3000)
```

No unit or end-to-end test suite and no CI. The build, the brand-mark gate, `check:og` and `check:indexability` are the quality gates; verify behaviour in the browser.

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Payments, email and account deletion run in Supabase edge functions with their own secrets; nothing in this repo deploys them.

Largest files (Oct 2026; all conferences-side except the chair page and translations): `translations.ts` 6.7k, `settings/page.tsx` 6.7k, `ConferenceApplyClient.tsx` 6.2k, `chair/[code]/page.tsx` 6.1k, `manage/[slug]/applications/page.tsx` 5.8k, `communications/page.tsx` 5.5k, `assignment/page.tsx` 5.4k. New translation keys go in a module of their own (`src/lib/translations<Area>.ts`, spread into each locale; see `.claude/TRANSLATIONS.md`). Keep diffs in these small and self-contained; put new features in new files and mount them.

---
