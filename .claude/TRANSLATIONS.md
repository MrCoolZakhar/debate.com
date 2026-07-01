# GAVELLING — TRANSLATIONS AGENT BRIEFING
## Up-to-date guide for adding a new language to Gavelling

**Last updated after:** i18n audit — 2026-06-30 (EN/ES/FR/AR; ar = RTL).  
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
| `src/lib/translations.ts` | Full EN/ES/FR dictionary (450+ keys). New language block goes here. `Language` type is also here. |
| `src/contexts/LanguageContext.tsx` | `LanguageProvider`, `useLanguage()`, `useT()` hooks, localStorage persistence. |
| `src/app/layout.tsx` | Wrapped in `LanguageProvider`. |
| `src/lib/countries.ts` | `COUNTRY_NAMES_ES`, `COUNTRY_NAMES_FR`, `getCountryDisplayName()`, `matchesCountryQuery()`, `startsWithCountryQuery()`. |
| `src/lib/presetNames.ts` | `PRESET_NAME_ES`, `PRESET_NAME_FR`, `getCommitteeDisplayName()` for preset committee names. |
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

### 5. Motion names localisation
Motion type names are localised via objects inside each component, NOT via `translations.ts`. These exist in:
- `src/components/MotionsModal.tsx` — `DEFAULT_MOTION_NAMES_LOCALIZED`
- `src/app/delegate/[code]/page.tsx` — `mn` inside `phaseDisplay`
- `src/app/advisor/[code]/page.tsx` — `mn` (delegate card) + `advisorMotionNames` (main page)

Add a `language === 'xx'` branch alongside the existing `language === 'es'` and `language === 'fr'` branches in each.

### 6. Preset acronyms
`getPresetAcronym(name, lang)` in `src/app/create/page.tsx` uses `PRESET_ACRONYM_ES` and `PRESET_ACRONYM_FR`. Add `PRESET_ACRONYM_XX` for the new language. The ternary that calls it must include `language === 'xx'`.

### 7. Inline ternaries — these files use `language === 'es'` directly
Add `language === 'xx' ? '...' :` branches alongside existing ES branches in:
- `src/app/create/page.tsx`
- `src/app/chair/[code]/page.tsx`
- `src/components/MotionsModal.tsx`
- `src/app/HomeClient.tsx` (uses `const es = language === 'es'` pattern — add `const xx = language === 'xx'` on the next line in every card component)

### 8. TutorialOverlay uses hardcoded JSX strings
`src/components/TutorialOverlay.tsx` has all tutorial step `bubbleText` as inline JSX ternaries. Add new language branches to every step. Changes to `translations.ts` alone do NOT affect the tutorial.

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
  const missing=en.filter(x=>!k.has(x)), same=en.filter(x=>k.has(x)&&T[L][x]===T.en[x]);
  console.log(`\n${L}: present ${k.size} | MISSING ${missing.length} | identical-to-EN ${same.length}`);
  if(missing.length)console.log('  MISSING:',missing.join(', '));
  same.forEach(x=>console.log('  ~',x,'=',JSON.stringify(T.en[x])));}
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

### Open backlog (from the 2026-06-30 audit — re-run A/B before acting)
- **ar:** 4 MISSING → `settings_veto_custom_label`, `settings_veto_custom_desc`, `settings_veto_custom_members`, `settings_veto_custom_note`.
- **es:** `join_role_advisor = "FACULTY ADVISOR"` still English → "ASESOR DE FACULTAD".
- **Hardcoded (no `t()`):** chair `View only`; voting `Committee not found`, `No introduced draft resolutions.`; RollCall `Add custom`, `No speakers queued`; Documents `Proceed with Session`, `Motion to Suspend Debate`, `Proposed by`, `No document content saved.`, `Session is now suspended.`; Settings `Sponsors label`, `Score sources`, `Quality factors`, `Rating scale max`, `Ranking blend` (+ many `title=` tooltips, lower priority).
- **Dead keys** to delete from all 4 blocks: `settings_procedural_threshold`, `settings_amendment_threshold`, `settings_majority_absolute`.
