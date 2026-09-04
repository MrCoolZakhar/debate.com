// ─────────────────────────────────────────────────────────────────────────────
// The readable palette shared by the live-status surface, the organiser
// scoreboard and the chair's session scoreboard.
//
// Everything here exists because a token in `neu.tsx` does not pass a contrast
// check on these surfaces, and `neu.tsx` is a SHARED surface another workstream
// is actively editing — so it is fixed here rather than globally.
//
// It started life at `app/manage/[slug]/live/tokens.ts`; that module is now a
// pure re-export of this one, so every existing conferences-side import still
// resolves to these exact values. The values themselves are unchanged.
//
// Measured against the card surface #F0EBDD (script in the session scratchpad,
// WCAG 2.1 relative-luminance formula):
//
//   NEU.muted    #9A8A78 ........ 2.81:1   ← was the colour of every eyebrow,
//                                            "Queue empty", "No speaker on the
//                                            floor" and "Paused" on this page
//   NEU.amber    #B8844A ........ 2.74:1
//   NEU.green    #3D7A52 ........ 4.30:1   ← FAILS as text. Fine as a 4px rail,
//                                            a dot or a progress fill (3:1), and
//                                            fine at 30px/900 (large text), but
//                                            it was also carrying the 11px word
//                                            "LIVE" and the "N passed" chip
//   NEU.deepGold #B6871F ........ 2.72:1
//   NEU.gold     #EED98A ........ 1.20:1   ← never text on ivory; it is the
//                                            text colour of forest buttons
//   SOFT         #6A5A4A ........ 5.55:1   ← replaces NEU.muted for anything a
//                                            person must read
//   AMBER_INK    #7E5128 ........ 5.70:1   ← the amber that can carry text
//   GREEN_INK    #2F6644 ........ 5.68:1   ← the green that can carry text
//   RED          #8B2020 ........ 7.58:1
//   NEU.forest   #1B3828 ....... 10.73:1
//   NEU.ink      #1C1410 ....... 15.24:1
// ─────────────────────────────────────────────────────────────────────────────

/** Readable secondary text. Replaces `NEU.muted` everywhere on this page that a
 *  person actually has to read something. `NEU.muted` survives only on purely
 *  decorative rules. */
export const SOFT = '#6A5A4A';

/** The amber that can carry text. `NEU.amber` stays rail-and-dot only.
 *
 *  #7E5128, not the #8A5A2E this file first carried. #8A5A2E is 4.92:1 on the
 *  bare card, but the warning pill it is actually printed inside is tinted
 *  `rgba(184,132,74,0.15)` — i.e. #E8DCC7 — and on THAT it measures 4.32:1 and
 *  fails. A token has to pass on the surface it is really used on, not on the
 *  one it was sampled against: #7E5128 is 5.70:1 on the card and 5.01:1 inside
 *  the pill. It is `NEU_GRADIENTS.amber[1]` nudged two steps darker, so it is
 *  still recognisably the same amber. */
export const AMBER_INK = '#7E5128';

/** The green that can carry text. `NEU.green` (#3D7A52) is 4.30:1 and stays
 *  rail-, dot- and fill-only.
 *
 *  #2F6644 is not a new colour: it is `NEU_GRADIENTS.green[0]`, already in the
 *  palette. 5.68:1 on the card, 5.48:1 on the page, and 5.10:1 inside the
 *  `rgba(61,122,82,0.09)` tint the adopted-resolution banner uses — which is
 *  where the old value fell to 3.86:1. */
export const GREEN_INK = '#2F6644';

/** The app's suspend red — already the chair console's and the staff board's
 *  (`admin/LiveCommitteesTab.tsx:46`). */
export const RED = '#8B2020';

/** The hairline a never-opened room gets instead of a status colour. */
export const HAIRLINE = 'rgba(27,56,40,0.18)';

// ── Card surface ─────────────────────────────────────────────────────────────
//
// THE CONTRAST FIX, MEASURED.
//
//   card #F0EBDD on page #EDE7D8 ................ 1.04:1, with NO border at all
//
// A 1.04:1 step separated by nothing but a diffuse 16%-alpha shadow is exactly
// why the owner says the cards are the same colour as the page. Two changes:
//
//   • a real edge. Alpha sweep of rgba(27,56,40,α) composited on the card and
//     measured against the page:
//         0.08 → 1.11:1   0.10 → 1.15:1   0.12 → 1.19:1
//         0.14 → 1.24:1   0.16 → 1.29:1   0.18 → 1.33:1   0.20 → 1.39:1
//     0.14 is the choice: a visible boundary that still reads as a hairline in
//     a neumorphic system rather than turning the page into a bordered one.
//   • the outer shadow's dark stop lifted 0.16 → 0.22 so the card sits ON the
//     page instead of dissolving into it.
//
// `NeuInset` keeps `NEU.base` as its background ON PURPOSE — neumorphism wants
// the pressed-in region to be the same material as the card. Once the card has
// an edge, an inset reads as a dent in a card rather than a hole in the page,
// which is the actual fix. Nothing here touches `neu.tsx`.
export const CARD_BORDER_COLOR = 'rgba(27,56,40,0.14)';
export const CARD_BORDER = `1px solid ${CARD_BORDER_COLOR}`;
export const CARD_SHADOW =
  '-6px -6px 14px rgba(255,255,255,0.85), 8px 8px 20px rgba(27,56,40,0.22)';
export const CARD_SHADOW_HOVER =
  '-8px -8px 18px rgba(255,255,255,0.92), 10px 10px 26px rgba(27,56,40,0.27)';
