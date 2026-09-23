// The organiser dashboard's bento cards (/manage/[slug]) carry a faint forest
// hairline on top of their neumorphic shadow, so each rectangle reads as its
// own tile on the ivory page (owner, 18 Sep 2026). Forest at 10%, so it follows
// the theme variable. One token, used by every card on that page.
export const BENTO_BORDER = '1px solid color-mix(in srgb, var(--gv-main) 10%, transparent)';

// Tinted grounds for the cards that matter most on the dashboard, so emphasis
// comes from colour rather than from a lighter halo around the card (owner,
// 23 Sep 2026: the white shadowy backdrop "looks sloppy"). Both follow the
// theme variables.
/** A 4% forest wash: the set-up priorities (the page's to-do list). The gold
 *  wash the dial card briefly had was removed with the dial's return. */
export const BENTO_WASH_FOREST = 'color-mix(in srgb, var(--gv-main) 4%, var(--gv-surface))';
