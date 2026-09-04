// ─────────────────────────────────────────────────────────────────────────────
// MOVED — the palette now lives at `@/components/scoreboardTokens`.
//
// It was born here as a local fix for the live-status surface, but the chair's
// session scoreboard renders the same shared `ScoreboardTable` and needs the
// same readable tokens, and `src/components/` cannot import out of an app route
// group without tying a shared component to one page's folder.
//
// This module stays as a pure re-export so every existing `./tokens` import on
// the conferences side (CommitteeCard, PhaseVariants, cardModel, LiveModals,
// DelegateCardModal, page, CommitteeScoreboardModal, the email components and
// the standalone scoreboard route) keeps resolving to the identical values.
// Nothing here is a second copy — new code should import from
// `@/components/scoreboardTokens` directly.
// ─────────────────────────────────────────────────────────────────────────────

export {
  SOFT,
  AMBER_INK,
  GREEN_INK,
  RED,
  HAIRLINE,
  CARD_BORDER_COLOR,
  CARD_BORDER,
  CARD_SHADOW,
  CARD_SHADOW_HOVER,
} from '@/components/scoreboardTokens';
