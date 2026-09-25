// ── The site's title signature ───────────────────────────────────────────────
// A heading is set in the brand face, with its LAST WORD in gold, in the
// italic display face the homepage and the sessions landing already use for
// their accent word ("MUN done *right.*", "Run the *room*"). Playfair Display
// italic is loaded once in the root layout; nothing else may be loaded.
//
//   <h1>Gavelling <GoldWord tone="light">Credits</GoldWord></h1>
//
// `tone` names the ground the word sits on: on cream or white the deep gold
// (4.5:1 on ivory), on forest the pale gold.

export const PLAYFAIR = "'Playfair Display', Georgia, serif";
export const GOLD_ON_LIGHT = '#B6871F';
export const GOLD_ON_DARK = '#EED98A';

export function GoldWord({ children, tone = 'light', style }: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: PLAYFAIR,
        fontStyle: 'italic',
        fontWeight: 400,
        letterSpacing: '-0.01em',
        color: tone === 'dark' ? GOLD_ON_DARK : GOLD_ON_LIGHT,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
