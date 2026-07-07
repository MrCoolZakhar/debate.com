# TYPOGRAPHY RULE — kill DM Mono on the conferences side

The owner considers **DM Mono (monospace)** the #1 "AI-made / code-like" tell and wants it GONE everywhere it appears on the conferences side (dates like "19–21 Feb 2027", fee chips like "GBP 70", counts like "800", stat numerals, eyebrows). ~145 usages across ~29 files. Replace them all with **Outfit**, tuned by role so each keeps its visual job without looking like code.

## The single font family
Everything becomes `fontFamily: "'Outfit', sans-serif"`. There is no monospace on the conferences side after this. (The `MONO` constant in `landing-lab/shared.tsx` and `account/accountUi.tsx` may be redefined to Outfit OR its usages replaced — either way, no rendered text stays monospace.)

## Per-role tuning (keep colors/sizes/roles; change family + light weight/spacing only)

| Role | Was (DM Mono) | Becomes (Outfit) |
|---|---|---|
| **Dates** ("19–21 Feb 2027", "Feb 08") | mono, often letterspaced | `fontWeight: 500`, normal case, `letterSpacing: '0.01em'`, `fontVariantNumeric: 'tabular-nums'`. NOT uppercase. |
| **Numeric chips** (fee "GBP 70", "USD 90", counts "800", "2,000") | mono | `fontWeight: 600`, normal case + spacing, `fontVariantNumeric: 'tabular-nums'` |
| **Big stat numerals** (dashboard/medallion numbers) | mono | `fontWeight: 800`, `fontVariantNumeric: 'tabular-nums'` |
| **Eyebrows / kickers** (small UPPERCASE labels: "STUDY GUIDES", "ORGANISED BY", "ACCOUNT", section captions) | mono, uppercase, `letterSpacing: 0.2–0.26em` | Outfit `fontWeight: 700`, keep UPPERCASE, **reduce** `letterSpacing` to `0.12–0.15em`, keep the gold `#B6871F`. Uppercase editorial eyebrows are fine — only the mono font was the problem. |
| **Codes / acronym stamps** (6-char session codes, acronym micro-stamps) | mono | Outfit `fontWeight: 700`, `letterSpacing: '0.06em'`, `fontVariantNumeric: 'tabular-nums'` |

## Notes
- Do NOT change any text content, size (px), color, or layout — only `fontFamily` (+ the small weight/spacing/variant tweaks above so it reads intentionally).
- `tabular-nums` keeps columns of numbers aligned so they still feel precise without a mono face.
- After the change there should be ZERO `'DM Mono'` strings left in the files you own (`grep -c "DM Mono"` == 0).
- Exemplar to match the *feel*: the account `Pill` and `LevelBadge` already use Outfit for everything and look crafted, not code.
