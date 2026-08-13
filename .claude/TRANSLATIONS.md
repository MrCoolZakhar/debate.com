# GAVELLING — TRANSLATIONS AGENT BRIEFING
## Up-to-date guide for adding a new language to Gavelling

**Last updated after:** redesigned delegate view — 2026-08-13 (EN/ES/FR/AR; ar = RTL; **870 keys per locale**, verified identical key sets, 0 missing / 0 extra). Added 17 `delegate_*` keys for the rebuilt delegate Session view: queue-position header, speakers-ahead / ETA lines, the 3-tile stat strip, the YOU / SPEAKING chips, and the two bottom-sheet titles. See "Recent changes" at the bottom.  
**Previously:** delegate score-gap tips — 2026-08-07 (853 keys). The 44-key `delegate_tip_*` corpus was rebuilt around the committee's real scoring sources: 13 keys deleted, 17 rewritten to interpolate chair-renameable document/motion names, 2 added, and **all 33 survivors are now reachable** — no orphans left.  
**Previously:** resume-failure copy — 2026-08-07 (864 keys). Added 5 `session_resume_*` keys for the resume-deadlock failure paths plus `session_suspended_banner`.  
**Previously:** GavelChip i18n — 2026-08-06 (858 keys). Added 12 `gavel_*`, 5 `join_chair_role_*` and 3 `settings_view_only_*` keys, translating `GavelChip.tsx` end-to-end, the join-page chair role picker (whose co-chair copy was factually stale) and the SettingsPanel view-only notice.  
**Previously:** i18n loose-ends close-out — 2026-08-06 (838 keys). Wired the `{wp}` / `{dr}` call sites in `calcPoints`, added `settings_head_chair_label` / `settings_head_chair_note`, and fixed a duplicate-`{s}` render bug in ES/FR `delegate_status_changes_left`.  
**Previously:** i18n debt sweep — 2026-08-06 (836 keys). Added 45 `voting_rules_*` keys for `VotingRulesPanel`, rewrote `settings_allow_abstentions_note` (it asserted behaviour that `abstentionsInDenominator` now makes configurable), deleted 14 dead `wp`/`dr` document keys, and gave `delegate_tip_no_docs` / `delegate_tip_have_wp` `{wp}` / `{dr}` placeholders.  
**Previously:** conferences-auth merge — 2026-07-09 (794 keys). Merged in 7 conferences-branch settings keys (`settings_code_hint`, `settings_custom_id_label`, `settings_custom_id_note`, `settings_separate_chair_code_label`, `settings_separate_chair_code_note`, `settings_multi_chairs_label`, `settings_multi_chairs_note`) with new FR/AR values, and filled a pre-existing AR gap for the 4 `settings_veto_custom_*` keys.  
**Reference implementation:** Spanish (ES) first, French (FR) second, Arabic (AR, RTL) third — use as guides.  
**Keep this file current:** whenever strings, locales, or the workflow change, update this doc in the same change. This is the single source of truth — do not maintain a parallel agent file for it.

---

## INFRASTRUCTURE

- **Supabase project:** `luruhkwrgisytejswlas` (us-west-2)
- **Repo:** `github.com/MrCoolZakhar/debate.com`
- **Deploy branch:** `claude/muncommand-recreation-9yjin` → auto-deploys to gavelling.com via Vercel
- **UI/feature branch:** `ui/forest-ivory-redesign` → Vercel preview URL
- **Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Supabase

**Workflow:** Always work on `ui/forest-ivory-redesign`. Run `npm run build` before every commit. Commit and push after each step.

---

## LANGUAGE SYSTEM ARCHITECTURE

| File | Purpose |
|------|---------|
| `src/lib/translations.ts` | Full EN/ES/FR/AR dictionary (870 keys per locale). New language block goes here. `Language` type is also here. |
| `src/lib/delegateTips.ts` | `selectDelegateTips()` — picks which `delegate_tip_*` keys a delegate sees, and fills their `{wp}` / `{dr}` / `{mod}` / `{unmod}` / `{tour}` / `{end}` / `{source}` vars. The ONLY consumer of that corpus. |
| `src/contexts/LanguageContext.tsx` | `LanguageProvider`, `useLanguage()`, `useT()` hooks, localStorage persistence. |
| `src/app/layout.tsx` | Wrapped in `LanguageProvider`. |
| `src/lib/countries.ts` | `COUNTRY_NAMES_ES`, `COUNTRY_NAMES_FR`, `getCountryDisplayName()`, `matchesCountryQuery()`, `startsWithCountryQuery()`. |
| `src/lib/presetNames.ts` | `PRESET_NAME_ES`, `PRESET_NAME_FR`, `getCommitteeDisplayName()` for preset committee names. |
| `src/lib/docNames.ts` | `docName()` — the single resolver for the chair-renameable Working Paper / Draft Resolution labels (see rule 5b). |
| `src/app/create/page.tsx` | `PRESET_ACRONYM_ES`, `PRESET_ACRONYM_FR`, `getPresetAcronym()` for committee acronyms in search dropdown. |
| `src/components/SiteNav.tsx` | `NAV_LINKS_CONFIG` — needs a language key per entry. Globe dropdown language toggle. |

**Translation hook usage:**
```tsx
import { useT, useLanguage } from '@/contexts/LanguageContext';
const t = useT();
const { language, setLanguage } = useLanguage();
t('key_name')
t('key_with_var', { n: count })
```

**Interpolation convention.** Placeholders are `{name}` and are substituted by `t(key, vars)` in `LanguageContext`. Notes that bind every locale:

- Substitution is `String.replace` per variable, so **each placeholder is replaced once only**. A key that needs the same value twice must take two differently-named vars.
- Every placeholder present in the `en` value must be present in `es` / `fr` / `ar` too. The audit script in section A checks this.
- **Word order is the translator's, not English's.** Put the placeholder where the target language wants it — especially in `ar`, where `{present} حاضرون من {total}` reads right-to-left as one unit. Never append an English-shaped fragment (` — {n} required`) onto a translated stem; write the whole sentence as one key instead. That is why the quorum line is three complete keys (`voting_rules_quorum_line_none` / `_required` / `_not_met`) rather than a stem plus suffixes.
- Standard names in use: `{n}` (count), `{doc}` / `{wp}` / `{dr}` (document type names — see rule 5b), `{present}` / `{total}` / `{needed}` / `{cast}` / `{eligible}` (voting maths), `{current}` (index), `{code}`.
- There is **no plural engine**. English pluralisation is done with two separate keys (`voting_rules_abstentions_kept_one` / `_other`) chosen by a `=== 1` check at the call site. Do not smuggle an `{s}` suffix placeholder into new keys — three legacy keys (`delegate_status_changes_left`, `delegate_after_speakers`, `session_hours_until_delete`) still carry one in `en`, and the other locales drop it or absorb it into a natural plural, which is why the audit reports a benign placeholder mismatch on exactly those three.
- **Single-replace is a real hazard, not a theoretical one.** ES/FR `delegate_status_changes_left` used to carry `{s}` **twice** (`{n} cambio{s} de estado restante{s}`); the call site (`delegate/[code]/page.tsx:1498`) does one `.replace('{s}', …)`, so ES and FR rendered a literal `{s}` on screen. Fixed 2026-08-06 by rewriting both to number-invariant phrasing (`Cambios de estado restantes: {n}` / `Changements de statut restants : {n}`). The audit script now flags any string carrying the same placeholder twice — keep that check.

---

## CRITICAL RULES — NEVER VIOLATE

### 1. DB always stores English
The DB always stores EN strings. Translations happen at render/display time only. Never save a translated string to Supabase.

### 2. Country name translation architecture
- `getCountryDisplayName(enName, language)` — always pass the EN name from DB.
- `matchesCountryQuery(enName, query, language)` — use for ALL country search filters.
- `startsWithCountryQuery(enName, query, language)` — use for prioritised sort in dropdowns.
- These functions must be updated to handle the new language code.

### 3. Committee name translation architecture
- `getCommitteeDisplayName(name, language)` from `src/lib/presetNames.ts`.
- Apply everywhere `committee.name` is rendered.

### 4. `CommitteeNameInput` — display vs commit
In `src/app/create/page.tsx`, when a preset is selected, the stored `committeeName` is the **English name** (for DB). The input displays `getPresetDisplayName(value, language)` — a translated version. The `onChange` handler detects when the user types a translated preset name and converts it back to English before storing. **Never commit a translated name to state or DB.**

### 5b. Document names are chair-renameable — never hardcode "Working Paper" / "Draft Resolution"
Chairs can rename both document types per committee (Settings → Motions → Documents), singular **and** plural. The names live in `CommitteeSettings.documentNames` and are mirrored into the `committees.settings` JSONB.

- **Always** render them through `docName(committee, type, 'singular' | 'plural', fallback)` from `src/lib/docNames.ts`.
- The `fallback` argument is the **translated** built-in default (e.g. `t('documents_working_papers_tab')`), so the locale still wins when there is no rename.
- Strings that embed the name use a `{doc}` placeholder key — `documents_submit_doc_heading`, `documents_submit_new_doc`, `documents_empty_doc`, `documents_doc_flow_auto`, `documents_doc_flow_vote`, `documents_qa_optional_doc`, `delegate_no_docs_submitted`, `delegate_no_docs_floor`, `voting_select_doc`, `voting_next_doc`, `voting_back_docs`, `voting_no_introduced_docs` — filled via `t(key, { doc })`. When adding a locale, keep `{doc}` in the translated sentence.
- A string that names **both** types in one sentence uses `{wp}` and `{dr}` instead: `delegate_tip_have_wp`, `delegate_tip_coordinate_bloc`. Fill them with `t(key, { wp: docName(committee,'working-paper','singular',…), dr: docName(committee,'draft-resolution','singular',…) })`.
- The whole `delegate_tip_*` corpus follows this rule, in both forms: `{wp}` / `{dr}` (singular) and `{wps}` / `{drs}` (plural, used where English would otherwise need an article). All of them are filled in one place — `selectDelegateTips` in `src/lib/delegateTips.ts`. The same rule extends to **motion** names there via `{mod}` / `{unmod}` / `{tour}` / `{end}`, resolved with `motionNames(committee, language)`.
- **Write the translated sentence so it survives a rename.** The substituted name can be any word in any gender, so avoid articles and agreement that depend on it: ES/FR/AR translations of these keys deliberately drop `la`/`un`/`ها` rather than guess. English may keep "a {wp}" because the built-in defaults take it.
- The older fixed keys (`documents_submit_wp_heading`, `documents_empty_wp`, `delegate_no_wps`, `voting_select_dr`, …) were **deleted on 2026-08-06** — see "Recent changes". Do not reintroduce a hardcoded-type-name key.
- **Never** read these names via `getSettings(code)` on the delegate or advisor pages — those pages do not hydrate the settings store from the DB. `docName` reads `committee.dbSettings`, which works on every device.
- This applies to **hardcoded JSX too**, not just `t()` keys. `TutorialOverlay` resolves the four labels once in the component and threads them into `getSteps(language, docs)` — see rule 8.

### 5. Motion names localisation
Motion type names are localised via objects inside each component, NOT via `translations.ts`. These exist in:
- `src/components/MotionsModal.tsx` — `DEFAULT_MOTION_NAMES_LOCALIZED`
- `src/app/delegate/[code]/page.tsx` — `mn` inside `phaseDisplay`
- `src/app/advisor/[code]/page.tsx` — `mn` (delegate card) + `advisorMotionNames` (main page)

Add a `language === 'xx'` branch alongside the existing `language === 'es'` and `language === 'fr'` branches in each.

`src/lib/committeeFlags.ts` also carries `MOTION_NAMES_LOCALIZED` — the DB-backed resolver `motionNames(committee, language)` used by any surface that does not hydrate the settings store. Add an `xx:` block there too, or every motion name silently falls back to English on the delegate/advisor pages **and inside the delegate tips**, which interpolate `{mod}` / `{unmod}` / `{tour}` / `{end}` from it.

### 6. Preset acronyms
`getPresetAcronym(name, lang)` in `src/app/create/page.tsx` uses `PRESET_ACRONYM_ES` and `PRESET_ACRONYM_FR`. Add `PRESET_ACRONYM_XX` for the new language. The ternary that calls it must include `language === 'xx'`.

### 7. Inline ternaries — these files use `language === 'es'` directly
Add `language === 'xx' ? '...' :` branches alongside existing ES branches in:
- `src/app/create/page.tsx`
- `src/app/chair/[code]/page.tsx`
- `src/components/MotionsModal.tsx`
- `src/app/HomeClient.tsx` (uses `const es = language === 'es'` pattern — add `const xx = language === 'xx'` on the next line in every card component)

### 8. TutorialOverlay uses hardcoded JSX strings
`src/components/TutorialOverlay.tsx` has all tutorial step `bubbleText` as inline JSX, selected by the `pick(language, { en, es, fr, ar })` helper. Add a key for the new language to **every** `pick` call. Changes to `translations.ts` alone do NOT affect the tutorial.

Exception: the chair-renameable document names. `getSteps(language, docs)` takes a `DocLabels` object (`wpPlural` / `drPlural` / `wpSingular` / `drSingular`) resolved in the component via `docName(committee, …)` with a `t()` fallback, and the `tab-documents` step interpolates `{docs.*}` in all four locales. **Never** type "Working Papers" / "Draft Resolutions" back into a tutorial bubble.

### 9. NUDGE_MESSAGES in advisor page
Already converted to translation keys — just add the new language keys to `translations.ts`.

### 10. SiteNav NAV_LINKS_CONFIG
`src/components/SiteNav.tsx` has a `NAV_LINKS_CONFIG` array where each entry has `en`, `es`, `fr` keys. Add the new language key to every entry or TypeScript will error (`Language` type used to index it).

### 11. Language type and localStorage
- `src/lib/translations.ts` line 1: expand `Language` type to include the new code.
- `src/contexts/LanguageContext.tsx`: update the localStorage validation `if (saved === 'en' || saved === 'es' || saved === 'fr')` to include the new code.
- `src/contexts/LanguageContext.tsx`: the `t()` function uses `(translations as Record<string, Record<string, string>>)[language]` — this cast is required to handle languages not yet in the `translations` object (before the new block is added in Step 6).

---

## THE COMPLETE ADDITION PROCESS — DO IN THIS ORDER

### Step 1 — Language type + country names + preset names
Files: `src/lib/translations.ts`, `src/contexts/LanguageContext.tsx`, `src/lib/countries.ts`, `src/lib/presetNames.ts`, `src/components/SiteNav.tsx`

- Expand `Language` type.
- Update localStorage validation.
- Add `COUNTRY_NAMES_XX` record (all UN member states in the new language).
- Update `getCountryDisplayName()` with a new `language === 'xx'` branch (curated dict + `Intl.DisplayNames` fallback).
- `matchesCountryQuery` and `startsWithCountryQuery` call `getCountryDisplayName` internally — no changes needed.
- Add `PRESET_NAME_XX` record + update `getCommitteeDisplayName()`.
- Add new language key to every entry in `NAV_LINKS_CONFIG`.

### Step 2 — Inline ternaries (4 files)
Files: `src/app/create/page.tsx`, `src/app/chair/[code]/page.tsx`, `src/components/MotionsModal.tsx`, `src/app/HomeClient.tsx`

For every `language === 'es' ? 'Spanish' : 'English'` ternary that produces visible UI text, add a `language === 'xx' ? 'NewLang' :` branch before the ES branch.

In `HomeClient.tsx`, add `const xx = language === 'xx';` directly after every `const es = language === 'es';` line (6 card components). Use `replace_all: true` to catch all 6 at once.

Also add `PRESET_ACRONYM_XX` and update `getPresetAcronym()` in `create/page.tsx`.

Also update the `CommitteeNameInput` component so the search filter uses `localName`/`localAcronym` variables (not `esName`/`esAcronym`).

### Step 3 — Motion names + TutorialOverlay
Files: `src/components/MotionsModal.tsx`, `src/app/delegate/[code]/page.tsx`, `src/app/advisor/[code]/page.tsx`, `src/app/chair/[code]/page.tsx` (if it has motion names), `src/components/TutorialOverlay.tsx`

Add `language === 'xx'` branch to all motion name objects and all 15 tutorial `bubbleText` ternaries.

### Step 4 — Full `translations.ts` language block
File: `src/lib/translations.ts`

Add a complete `xx: { ... }` block before the `} as const;` closing line. The block must have **exactly the same keys** as the `en` block. Also add `settings_xx: 'LanguageName'` to the `en`, `es`, and `fr` blocks.

Use the ES and FR blocks as structural references — same keys, new values.

### Step 5 — Language toggle UI
Files: `src/components/SiteNav.tsx`, `src/components/SettingsPanel.tsx`, `src/app/create/page.tsx`

All three use the **globe dropdown pattern** (see below). Add the new language option to each dropdown by extending the options array — the dropdowns use a mapped array so adding one entry is sufficient.

---

## LANGUAGE TOGGLE — GLOBE DROPDOWN PATTERN

All language toggles across the app use the same globe dropdown. **Do not use pill sliders or EN/ES/FR inline buttons.** The pattern is:

```tsx
// Trigger button (on light background — SiteNav / create page)
<button onClick={() => setShowLangMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl focus:outline-none" style={{ color: '#1B3828' }}>
  <Globe size={14} strokeWidth={2} />
  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
</button>

// Trigger button (on dark #1B3828 background — SettingsPanel)
<button onClick={() => setShowLangMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl focus:outline-none" style={{ color: '#EED98A' }}>
  <Globe size={14} strokeWidth={2} />
  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
</button>

// Dropdown (same in all locations)
{showLangMenu && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
    <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl"
         style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
      {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['xx', t('settings_xx')]] as [string, string][]).map(([code, label], i) => (
        <div key={code}>
          {i > 0 && <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />}
          <button
            onClick={() => { setLanguage(code as Language); setShowLangMenu(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors focus:outline-none"
            style={{ color: language === code ? '#1B3828' : '#6A5A4A', fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : 'transparent' }}
            onMouseEnter={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>{code.toUpperCase()}</span>
            <span>{label}</span>
            {language === code && <span className="ml-auto" style={{ color: '#B6871F' }}>✓</span>}
          </button>
        </div>
      ))}
    </div>
  </>
)}
```

Each location needs `const [showLangMenu, setShowLangMenu] = useState(false)` added to the component. `Globe` is imported from `lucide-react`.

---

## HERO HEADING — LANDING PAGE FONT SIZES

The hero `<h1>` in `src/app/HomeClient.tsx` uses different `clamp()` font sizes per language because each phrase has a different character count. The h1 is wrapped in a **fixed-height container** on md+ so buttons never shift when language is changed:

```tsx
<div className="w-full mb-5 flex items-end justify-center md:h-[195px]">
  <h1 className="font-black tracking-tight text-white leading-[1.05] text-center md:whitespace-nowrap"
      style={{ fontSize: language === 'fr' ? 'clamp(36px, 8.8vw, 126px)'
                       : language === 'es' ? 'clamp(44px, 11.5vw, 145px)'
                       :                     'clamp(48px, 13.5vw, 165px)' }}>
```

**Rule:** `md:whitespace-nowrap` allows text to overflow the `max-w-2xl` container horizontally (intentional — the heading bleeds edge-to-edge). `md:h-[195px]` = EN single line (165px × 1.05) + buffer. **Never remove this wrapper.** When adding a new language, derive the font size from:

```
font_size_max = EN_max × (EN_char_count / new_char_count)
vw = font_size_at_1440px / 14.4
```

Verify one-line fit at 1024px before committing.

---

## LESSONS LEARNED FROM BUILDING ES AND FR

1. **`git archive` stale ref bug.** Always run `git branch -f ui/forest-ivory-redesign origin/ui/forest-ivory-redesign` before archiving. Without the sync, every zip contains old code.

2. **`ProposerInput` (MotionsModal) — search must use display names.** The `ProposerInput` receives English DB names as candidates. Search must be done against `getCountryDisplayName(c, language)`, not the raw English name. The dropdown must use `top-full mt-1` (opens downward) with `z-50`.

3. **`DocumentsModal SponsorSelect`** — needs both helpers. Sort `startsWith` matches first, then `includes` matches. Use both `startsWithCountryQuery` and `matchesCountryQuery`.

4. **`RollCallPanel AddCountryInput`** — display vs commit. The dropdown shows `getCountryDisplayName(c.name, language)` but `commit(c.name)` saves the English name. Never translate the committed value.

5. **TutorialOverlay strings are hardcoded JSX, not t() keys.** Changes to `translations.ts` alone will not fix the tutorial. The motions tab and documents tab descriptions are inline JSX ternaries.

6. **`CaucusPanel` needs language support.** It is imported and used — it needs `useLanguage` + `getCountryDisplayName`. `SpeakersListPanel` is a dead component, never imported — ignore it.

7. **`DelegateDocCard` and similar sub-components** may not have `useT()`. Any function component that renders status labels, badges, or text strings needs to explicitly call `useT()`. Check sub-components that don't have hooks at the top level.

8. **Hardcoded strings bypass t() entirely.** After adding translations, search for hardcoded English text in JSX that doesn't go through `t()`:
   - Session-ended screens, error states, and loading messages are common offenders.
   - `grep -rn ">[A-Z]" src/app/` to find obvious hardcoded strings.

9. **`NAV_LINKS_CONFIG` must be updated.** Adding a new `Language` type value will cause a TypeScript error on `NAV_LINKS_CONFIG` because it's indexed by `Language`. Always add the new key to every entry.

10. **`LanguageContext` cast is required.** The `t()` function uses a permissive cast so it can fall back to `en` before the new language block is added in Step 4. The cast `(translations as Record<string, Record<string, string>>)[language]` allows this safely.

11. **Hero heading font sizes must be derived, not guessed.** Longer phrases need smaller `vw` values. Use the formula above and always verify at 1024px before calling it done. The fixed-height wrapper (`md:h-[195px]`) ensures buttons don't shift.

12. **Preset acronyms need a separate dict.** `PRESET_ACRONYM_XX` in `create/page.tsx` maps English preset names to their localised acronyms (e.g. NATO → OTAN in FR/ES). The ternary in the dropdown must include `language === 'xx'` to use it.

13. **`CommitteeNameInput` displayValue pattern.** When a preset is selected, `committeeName` stores the English name but the input displays `getPresetDisplayName(value, language)`. The `onChange` must map typed translated names back to their English equivalents before storing. This is critical for search to work across languages.

---

## TERMINOLOGY PROCESS

Before writing any translated strings, confirm MUN-specific terminology with Peter. Terms vary significantly by region and conference tradition.

**Reference: locked terminology for ES and FR**

| English | Español | Français |
|---------|---------|---------|
| Chair / Chairs | Director / Directores | Président / Présidents |
| Head chair | Director principal | Président principal |
| Co-chair | Codirector | Coprésident |
| Gavel | Mazo | Maillet |
| View only | Solo lectura | Lecture seule |
| Faculty Advisor | Faculty Advisor | Superviseur |
| General Speakers List (GSL) | Lista General de Oradores | Liste générale des orateurs |
| Moderated Caucus | Cáucus Moderado | Caucus modéré |
| Unmoderated Caucus | Cáucus No Moderado | Caucus non modéré |
| Committee of the Whole | Consulta de Gabinete (CG) | Consultation de l'assemblée (CA) |
| Tour de Table | Round Robin | Tour de table |
| Working Paper | Hoja de Trabajo | Document de travail |
| Draft Resolution | Proyecto de Resolución | Projet de résolution |
| Right of Reply | Derecho a Réplica | Droit de réponse |
| Point of Order | Punto de Orden | Point d'ordre |
| Speaker | Orador | Orateur |
| Raise a Motion | Proponer una Moción | Proposer une motion |
| Suspend Debate | Suspender Debate | Suspension du débat |
| Adjourn Debate | Cerrar Debate | Clôture du débat |
| 2/3 Supermajority | Mayoría Calificada (2/3) | Majorité des deux tiers (2/3) |
| Speakers Queue | Fila (de oradores) | Liste des orateurs |
| Roll Call | Lista de Asistencia | Appel nominal |
| Present | Presente | Présent |
| Present and Voting | Presente y Votante | Présent et votant |
| Abstention | Abstención | Abstention |
| Amendment | Enmienda | Amendement |
| Sponsor | Patrocinador | Parrain |

---

## DESIGN SYSTEM (for any UI additions like language toggle)

| Token | Value | Usage |
|-------|-------|-------|
| Ivory | `#EDE7D8` | Main background |
| Cream | `#FAF8F3` | Cards, modals, dropdowns |
| Parchment | `#DDD4C0` | Borders, dividers |
| Forest | `#1B3828` | Primary brand, buttons, dark headers |
| Forest Mid | `#2A5A3C` | Hover states |
| Gold (on dark) | `#EED98A` | Text on forest backgrounds |
| Ink | `#1C1410` | Primary text |
| Muted | `#9A8A78` | Secondary text, language code in dropdown |
| Amber | `#B6871F` | Checkmark in dropdown, active state accent |

Typography: `Outfit` for all UI (UPPERCASE for buttons). `DM Mono` for codes/badges/language codes.

---

## ARCHITECTURAL RULES — NEVER VIOLATE

- DB always stores EN — translate at render time only.
- Never use circular flags — always rectangular.
- Never omit `focus:outline-none` on interactive buttons.
- Never place a `useEffect` after an early return.
- Never await DB writes for UI updates — optimistic updates only.
- Never call any hook inside a `.map()` loop.
- Never use the old EN/ES pill slider for language toggle — always use the globe dropdown.
- Never remove `md:h-[195px]` from the hero heading wrapper without re-testing all 4 languages (EN/ES/FR/AR).

---

## MAINTENANCE & AUDIT (run before declaring a locale "done")

### A. Key completeness — `translations.ts`
`en` is canonical (`TranslationKey = keyof typeof translations.en`). Every key must exist in every locale block, same order. Audit script:
```js
// node this against repo root
const fs=require('fs');let s=fs.readFileSync('src/lib/translations.ts','utf8');
s=s.replace(/export type Language[^\n]*\n/,'').replace(/export const translations =/,'module.exports =').replace(/\} as const;/,'};').replace(/export type TranslationKey[^\n]*\n?/,'');
fs.writeFileSync('/tmp/_t.js',s);const T=require('/tmp/_t.js');const en=Object.keys(T.en);
for(const L of ['es','fr','ar']){const k=new Set(Object.keys(T[L]));
  const missing=en.filter(x=>!k.has(x)), extra=[...k].filter(x=>!en.includes(x)), same=en.filter(x=>k.has(x)&&T[L][x]===T.en[x]);
  console.log(`\n${L}: present ${k.size} | MISSING ${missing.length} | EXTRA ${extra.length} | identical-to-EN ${same.length}`);
  if(missing.length)console.log('  MISSING:',missing.join(', '));
  if(extra.length)console.log('  EXTRA:',extra.join(', '));
  same.forEach(x=>console.log('  ~',x,'=',JSON.stringify(T.en[x])));}
// Single-replace hazard: the same placeholder twice in one string renders the second literally.
for(const L of ['en','es','fr','ar'])for(const [k,v] of Object.entries(T[L])){
  const m=String(v).match(/\{[a-zA-Z0-9_]+\}/g)||[]; const dup=[...new Set(m.filter((x,i)=>m.indexOf(x)!==i))];
  if(dup.length)console.log(`  DUPLICATE PLACEHOLDER ${L}.${k}: ${dup.join(',')}`);}
```
- **MISSING** keys are always defects (they render English).
- **identical-to-EN** is only a *candidate* — leave it alone when the value is a genuine cognate (FR/ES: Session, Position, Documents, Motions, Quorum, Abstentions, Consensus, Participant, Absent, Total, Type, Vote, Pause, Tour de Table, Caucus), a symbol/arrow (`A → Z`), an abbreviation (`pts`, `min`, `P+V`), a proper noun / brand (`MUN`, `GAVELLING UNLIMITED`, `— Daniele Vare`), or a language-picker **endonym** (`settings_english='English'`, `settings_spanish='Español'`, `settings_french='Français'` are identical across blocks **on purpose**).

### B. Hardcoded English (bypasses `t()` — the bigger gap)
These never translate in any locale. Scan and key them:
```bash
for f in "src/app/chair/[code]/page.tsx" "src/app/delegate/[code]/page.tsx" \
  "src/app/voting/[code]/page.tsx" "src/app/advisor/[code]/page.tsx" src/components/*.tsx; do
  echo "== $f =="; grep -noE '(placeholder|title|aria-label)="[A-Z][a-z][^"]*"|>[A-Z][a-z]+( [A-Za-z,&—-]+){1,}[<.]' "$f" \
    | grep -vE '\{t\(|\$\{|className|viewBox|GavellingLogo'; done
```

### MUN glossary (translate the concept, not literally)
| EN | ES | FR |
|----|----|----|
| Moderated Caucus | Cáucus Moderado | Caucus modéré |
| Unmoderated Caucus | Cáucus No Moderado | Caucus non modéré |
| Consultation of the Whole | Consulta de Gabinete | Consultation de l'assemblée |
| Tour de Table | Round Robin | Tour de table |
| Right of Reply | Derecho de Réplica | Droit de réponse |
| Faculty Advisor | Asesor de Facultad | Conseiller pédagogique |

### Open backlog (re-run A/B before acting)
- **es:** `join_role_advisor = "FACULTY ADVISOR"` still English → "ASESOR DE FACULTAD".
- ~~**chair `View only`**~~ — CLEARED 2026-08-06. The chair page's crimson "View only · X is chairing" pill was replaced by `GavelChip` (fully keyed); the SettingsPanel notice and its footer now use `settings_view_only` / `settings_view_only_chairing` / `settings_view_only_note`. `grep -rn "View only" src/` returns only a code comment in `GavelChip.tsx`.
- **Hardcoded (no `t()`):** voting `Committee not found`; RollCall `Add custom`, `No speakers queued`; Documents `Proceed with Session`, `Motion to Suspend Debate`, `Proposed by`, `No document content saved.`, `Session is now suspended.`; Settings `Sponsors label`, `Score sources`, `Quality factors`, `Rating scale max`, `Ranking blend` (+ many `title=` tooltips, lower priority).
- **Dead keys** to delete from all 4 blocks: `settings_procedural_threshold`, `settings_amendment_threshold`, `settings_majority_absolute`.
- ~~**Dead `delegate_tip_*` corpus**~~ — CLEARED 2026-08-07. All 33 surviving tip keys are reachable from `src/lib/delegateTips.ts`; the 13 that had no home were deleted. See "Recent changes". **Do not add a `delegate_tip_*` key without a firing rule in `selectDelegateTips`** — that is how the 39-key orphan pile happened.
- **`P5`** is still a bare literal in `VotingRulesPanel` (the veto segment button). It is an accepted cross-locale abbreviation and its `title` tooltip goes through `settings_veto_p5_label`; leave it unless Peter asks otherwise.

---

## RECENT CHANGES

### 2026-08-13 — redesigned delegate view (`feature/conferences-auth`) — 853 → 870 keys

**Added, 17 keys × 4 locales**, inserted in the delegate cluster directly after `delegate_no_speakers` in every block: `delegate_queue_position_label`, `delegate_speakers_ahead`, `delegate_speaker_ahead_one`, `delegate_eta_about`, `delegate_stat_spoken`, `delegate_stat_speeches`, `delegate_stat_messages`, `delegate_you_chip`, `delegate_speaking_chip`, `delegate_place_saved`, `delegate_not_in_queue`, `delegate_on_deck`, `delegate_full_stats`, `delegate_view_all_queue`, `delegate_floor_now`, `delegate_queue_sheet_title`, `delegate_docs_sheet_title`.

- **No `{s}` suffix.** The speakers-ahead line ships as two keys (`delegate_speakers_ahead` / `delegate_speaker_ahead_one`) chosen by a `=== 1` check at the call site, per the no-plural-engine rule. It does not join the three legacy `{s}` audit exceptions.
- **Each placeholder appears once per string** — `{n}` in the speakers-ahead pair, `{t}` in `delegate_eta_about`. Nothing is reused within a string.
- **`delegate_eta_about` keeps its hedge in every locale** (EN *About …*, ES *Unos …*, FR *Environ …*, AR *نحو …*). `{t}` arrives pre-formatted ("35 min", "1 hr 10 min"), so the sentence is worded to read naturally around an already-built duration. Do not remove the hedge — an unhedged estimate that slips reads as a broken promise.
- **The 3-tile stat strip must not wrap** (~105px per tile on a small phone), so each label is ONE short word in every locale. Two deliberate compromises: ES `delegate_stat_spoken` is **TIEMPO** (time) rather than a literal "hablado", and FR is **PAROLE** (from *temps de parole*) rather than "temps parlé" — both name the duration the tile shows and stay to a single short word. AR uses **الوقت** for the same reason.
- `delegate_stat_speeches` reuses the existing per-locale term for speeches (ES *DISCURSOS*, FR *DISCOURS*, AR *الخطابات*, matching `delegate_speeches_label`).
- `delegate_floor_now` is a small-caps duplicate of the existing `delegate_you_have_floor` copy and carries the same translations in all four locales — the redesign needed a separate key for a differently styled surface.
- **Em dash follows each language's convention** in `delegate_place_saved`: EN keeps the em dash, FR keeps it with spaces, ES uses a colon, AR uses a comma plus *ف*.
- Uppercase held in the Latin-script locales for the small-caps labels (`IN THE SPEAKERS LIST`, `SPOKEN`/`SPEECHES`/`MESSAGES`, `YOU`, `SPEAKING`, `YOU HAVE THE FLOOR`); AR has no case distinction and uses the normal form.
- Terminology held: speakers list = ES *lista de oradores* / FR *liste des orateurs* / AR *قائمة المتحدثين*.

**Verified:** 870 keys in all four locales, 0 missing / 0 extra, 0 duplicates within a block; `npx tsc --noEmit` exit 0.

### 2026-08-07 — delegate score-gap tips (`feature/conferences-auth`) — 864 → 853 keys

**What the tips now mean.** A delegate's Stats tab used to render 5 hardcoded conditionals; it now renders up to **3** tips chosen by `selectDelegateTips()` (`src/lib/delegateTips.ts`) from the delegation's own per-source ledger. Every tip answers "which scoring category are you short on **in this committee**".

- Numbers come from `computeSourceTotals` → `computeLedger` → `getScoringConfig` (`src/lib/scoring.ts`) — pure functions of the committee row, so AGENTS.md rule 14 still holds and the delegate page has **zero** `useSettingsStore` dependency. No scoring maths was reimplemented.
- The selector iterates `cfg.sources.filter(s => s.enabled)`, so a **disabled source can never produce a tip**. It also phase-gates every source, so nothing suggests an action the floor does not currently allow.
- Cold start: below a room-activity floor the selector returns the **onboarding** set (`_mark_present`, `_address`, `_gsl_request`, `_opening`, `_listen`, `_bloc`) instead of gap tips.
- `hideScoresFromDelegates` does **not** suppress tips — they carry no number and no rank, so guidance survives a chair hiding scores. The single exception is `delegate_tip_custom_source`, which names a scoring category the delegate cannot otherwise see; the selector drops it when scores are hidden.

**Deleted, 13 keys × 4 locales.** No score source and no feature to hang them on: `delegate_tip_yield`, `_yield_questions` (Gavelling has no yield step), `_point_of_order`, `_point_of_info` (no such motion), `_friendly_amendment`, `_unfriendly_amendment` (no amendment flow), `_impact`, `_close_to_distinguished`, `_distinguished_driver`, `_highest_tier` (copy from the removed tier system), `_help_newer`, `_mentor` (nothing scoreable), `_escalate_dr` (a duplicate of `_have_wp`, which already had the `{wp}` / `{dr}` placeholders).

**Added, 2 keys.** `delegate_tip_custom_source` (`{source}` — a chair-added score source this delegation has none of) and `delegate_tip_all_round` (contributing everywhere; no weakness to name).

**Rewritten, 17 keys — chair-renameable names now interpolate.** Rule 5b applies to tips too, and it applies to **motion** names as well as document names. `{wp}` / `{wps}` / `{dr}` / `{drs}` are filled via `docName()`, and `{mod}` / `{unmod}` / `{tour}` / `{end}` via `motionNames(committee, language)`:
`_no_caucus`, `_caucus_sub`, `_propose_caucus`, `_raise_motion`, `_tdt`, `_closure`, `_coordinate_bloc`, `_unmod_wp`, `_wp_cosponsors`, `_consolidate`, `_lead_dr`, `_passed_dr`, `_legacy`, `_operative_clauses`, `_synthesise`, `_gsl_strategic`, `_have_wp`.

- **Articles are the trap.** A renamed type can be any word in any gender, so "a {wp}" breaks the moment a chair renames Working Paper to "Communiqué" or Unmoderated Caucus to "Breakout". EN keeps a determiner only where "the" works for anything (`the {wp} you sponsor`, `the {drs} on the floor`) or uses the **plural** name to sidestep the article entirely (`co-sponsoring {wps}`). ES/FR/AR drop the article outright, as they already did for `_no_docs` / `_have_wp`.
- `delegate_tip_unmod_wp` takes `{wps}` (plural), not `{wp}` — that was the only way to write the English without an article.
- FR/ES/AR also avoid **adjective agreement** on the substituted noun: `_consolidate` says "qui se font concurrence" / "que compiten entre sí" / "في نص واحد" rather than "concurrents" / "competidoras" / "المتنافسة".
- `_no_caucus` and `_caucus_sub` are filled with whichever caucus motion the chair actually left **enabled** — if Moderated Caucus is switched off they name the Tour de Table instead. Never hardcode `mn.moderated` in a caucus tip.

**Terminology held:** chair = ES *director* / FR *président* / AR *الرئيس*; delegations = *delegaciones* / *délégations* / *الوفود*; GSL = *Lista General de Oradores* / *liste générale* / *القائمة العامة*.

**Verified:** 853 keys in all four locales, 0 missing / 0 extra, **0 duplicate placeholders**; a 60 000-committee randomised sweep renders every one of the 33 surviving keys at least once with **no unfilled `{placeholder}`** in any locale; `npx tsc --noEmit` exit 0; `npm run build` exit 0 (73/73 pages). The only placeholder mismatches remain the three documented legacy `{s}` keys.

### 2026-08-07 — resume-failure copy (`feature/conferences-auth`) — 858 → 864 keys
- The resume-deadlock fix landed five hardcoded English strings on the chair page; all are now keyed and swapped: `session_resume_failed` + `session_resume_failed_locked` (`chair/[code]/page.tsx:2455-2457`), `session_resume_retry` (`:2480`, `:2491`), `session_resume_takeover` (`:2868`) and `session_resume_lost` (`:2516`).
- **`session_resume_takeover` is an all-caps button label in EN/ES/FR only.** AR has no case distinction, so it is written as an ordinary noun phrase (`تولّي الاستئناف`) — never fake emphasis with capitals in Arabic. Same convention as `session_resume_btn`.
- Both failure strings name the Resume button by its own localised label, so ES says "vuelve a pulsar Reanudar", FR "appuyez de nouveau sur Reprendre" and AR "اضغط استئناف الجلسة مجدداً" — matching `session_resume_btn` in each locale rather than transliterating the English word.
- Also keyed **one pre-existing** literal found in the same suspend UI while sweeping: the "Session is suspended, delegates cannot see this view" banner (`chair/[code]/page.tsx:2767`) → `session_suspended_banner`. It predates the resume fix (last touched in `f0d077f`), but it sits in the same overlay and was the only English left there.
- Terminology held: chair = ES *director* / FR *président* / AR *رئيس*; delegates = *delegados* / *délégués* / *المندوبون*.
- Verified: 864 keys in all four locales, 0 missing / 0 extra, 0 duplicate placeholders, `npx tsc --noEmit` exit 0, `npm run build` exit 0 (73/73 pages). The only placeholder mismatches remain the three documented legacy `{s}` keys.


### 2026-08-06 — GavelChip i18n (`feature/conferences-auth`) — 838 → 858 keys
- **`src/components/GavelChip.tsx` was 100% hardcoded English** and is now fully keyed (12 new `gavel_*` keys). The component had no `useT()` at all; it now imports `useT` from `@/contexts/LanguageContext`. Keys: `gavel_you_have_it`, `gavel_chair_offline`, `gavel_take_over`, `gavel_chairing_label`, `gavel_popover_title`, `gavel_explainer_aria`, `gavel_explainer`, `gavel_you`, `gavel_chairing_badge`, `gavel_take_the_gavel`, `gavel_hand_over`, `gavel_footnote`.
  - The offline chip is **two** keys (`gavel_chair_offline` + `gavel_take_over`) because only the second half is bold. Same for `gavel_chairing_label` + the raw `{headChairName}` — a label:value pair, so word order survives every locale including AR.
  - `gavel_you` is stored **without** a leading space (`'(you)'`); the call site renders `` `${' '}${t('gavel_you')}` ``. Do not bake whitespace into the value.
  - The `i` badge glyph itself (`GavelChip.tsx:294`) is left as the literal character — it is a universal info affordance, and its meaning is carried by `aria-label={t('gavel_explainer_aria')}`.
- **`src/app/join/page.tsx` chair role picker keyed** (5 new `join_chair_role_*` keys). `join_chair_role_co_note` also **fixes factually stale copy**: it used to read "you can take the gavel later from Settings", but the Take-the-gavel button was removed from Settings and replaced by a read-only row pointing at the chip. All four locales now name the chip and its position.
- **`src/components/SettingsPanel.tsx` view-only notice keyed** (`settings_view_only`, `settings_view_only_chairing`, `settings_view_only_note`). `settings_view_only_chairing` takes `{name}`; the AR value is `'الجلسة برئاسة {name}'` and the ES value `'Preside {name}'` — the placeholder is positioned by the target language, **not** appended English-style after a translated stem. The ` &middot; ` separator stays as JSX punctuation outside the key.
- **AR position wording stays `أعلى يمين` (top-right)** in both `join_chair_role_co_note` and `settings_head_chair_note`. `GavelChip.tsx:214` anchors the chip with a **physical** `right: '0.85rem'` under `position: fixed`, which `dir="rtl"` does not mirror, so the chip really is on the right in Arabic. If it is ever switched to `insetInlineEnd` (which would also require revisiting the right-aligned `place()` maths at `GavelChip.tsx:114-136`), both strings must flip to `أعلى يسار`.
- Terminology held: ES *director* / *mazo*, FR *président* / *maillet*, AR *الرئيس* / *المطرقة*, consistent with `settings_head_chair_label` / `settings_head_chair_note`. AR reuses the existing dictionary words for caucus (`الحوارات`), motions (`الاقتراحات`) and documents (`المستندات`) inside `gavel_explainer`.
- Verified: 858 keys in all four locales, 0 missing / 0 extra, **0 duplicate placeholders** anywhere in the file, `npx tsc --noEmit` exit 0, `npm run build` exit 0 (73/73 pages).

### 2026-08-06 — i18n loose-ends close-out (`feature/conferences-auth`)
- **`{wp}` / `{dr}` call sites are now wired.** The debt sweep below gave `delegate_tip_no_docs` / `delegate_tip_have_wp` placeholders but could not update the call sites, so delegates were seeing a literal `{wp}` / `{dr}` in the Stats tab. `calcPoints` (`delegate/[code]/page.tsx:157`) now fills them via `docName(committee, …)` with the translated built-in as fallback. Its `t` parameter was widened from `(key: TranslationKey) => string` to the real context signature `(key: TranslationKey, vars?: Record<string, string | number>) => string` — the key-only type could not accept a vars object. Both callers (`:449` and `:482` in `StatisticsTab`) pass the `useT()` value, so they were already compatible. **This was the last outstanding item in the backlog; nothing is left unwired.**
- **Added `settings_head_chair_label` / `settings_head_chair_note`** in all four locales and wired the head-chair row in `SettingsPanel.tsx` (Access tab), which was hardcoded English. The row deliberately stays **outside** the `ReadOnlyRegion on={isViewOnly}` wrapper so a view-only co-chair can still read who is chairing — verified.
- **Arabic direction wording, verified against the DOM, not assumed.** `GavelChip` is anchored `position: fixed` with a **physical** `right: 0.85rem` (`GavelChip.tsx:214`), not a logical inline-end property, so the chip stays on the **right** edge under `dir="rtl"`. The AR note therefore says `أعلى يمين` (top-right), not `أعلى يسار`. If the chip is ever switched to `insetInlineEnd`, this string must flip with it.
- **Fixed a duplicate-`{s}` render bug** in ES/FR `delegate_status_changes_left` — see the interpolation notes at the top. The section A audit script now includes a duplicate-placeholder check.
- Terminology held to the existing per-locale vocabulary: ES *director*, FR *président*, AR *الرئيس* (matching `settings_chair_code_label` / `settings_chair_approval_*`). Gavel is *mazo* / *maillet* / *المطرقة* — first use of the word in the dictionary.

### 2026-08-06 — i18n debt sweep (`feature/conferences-auth`)
- **Added 45 `voting_rules_*` keys** in all four locales, wiring every remaining hardcoded string in `src/components/VotingRulesPanel.tsx` (title, verdict chips, CAST/COUNTED/TO PASS stats, the live sentence, the abstentions line, the three blocked notes, all four section headings, every hover-explainer title+body, the segment labels, the veto note and the three quorum lines). The panel's pre-existing `settings_*` `t()` calls were left untouched.
- **Rewrote `settings_allow_abstentions_note`** in all four locales. The old copy asserted "abstentions are excluded from the denominator", which stopped being true once `abstentionsInDenominator` shipped (`settingsStore.ts:62`, default `false`; enforced at `VotingRulesPanel.tsx:79` as `allowAbstentions === true && abstentionsInDenominator === true`). The note now describes the toggle and names the default instead of asserting fixed behaviour.
- **Deleted 14 dead keys** from all four locales (56 lines), all superseded by `{doc}` variants: `documents_submit_new_wp`, `documents_submit_new_dr`, `documents_empty_wp`, `documents_empty_dr`, `documents_submit_wp_heading`, `documents_submit_dr_heading`, `documents_working_paper_flow`, `documents_dr_flow`, `documents_qa_optional`, `delegate_no_wps`, `delegate_no_drs`, `voting_select_dr`, `voting_next_dr`, `voting_back_drs`.
- **`delegate_tip_no_docs` / `delegate_tip_have_wp`** now take `{wp}` / `{dr}`.
- **`TutorialOverlay`** no longer hardcodes the document names in any locale — `getSteps` takes a resolved `DocLabels`.
