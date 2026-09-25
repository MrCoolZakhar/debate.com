'use client';

// ── ONE gold button (owner, 25 Sep 2026) ────────────────────────────────────
// The site had several gold gradients (the neu icon-disc gradient, a pale flat
// gold on the credits pop-up's PAY button, a pill on PersonalConferenceCard).
// This is the one: the neu gold (pale gold to deep gold, the richest of them)
// as a diagonal gradient with a bright top edge and a warm glow, ink type,
// UPPERCASE. Every gold call to action uses these values, whether through the
// component or through the constants inside a CSS string.

export const GOLD_CTA_BG = 'linear-gradient(135deg, #F4E4A6 0%, #EED98A 38%, #D6B24C 100%)';
export const GOLD_CTA_BG_HOVER = 'linear-gradient(135deg, #F8EBB8 0%, #F1DE97 38%, #DDB955 100%)';
export const GOLD_CTA_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(120,86,14,0.25), 0 8px 20px -6px rgba(182,135,31,0.55)';
export const GOLD_CTA_SHADOW_HOVER = 'inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 3px rgba(120,86,14,0.25), 0 12px 26px -6px rgba(182,135,31,0.65)';
export const GOLD_CTA_INK = '#1C1410';

/** The CSS for a `.gv-gold-cta` class, for kits that keep their styles in a string. */
export const GOLD_CTA_CSS = `
.gv-gold-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 22px;border:none;border-radius:12px;cursor:pointer;color:${GOLD_CTA_INK};font-family:var(--font-brand),sans-serif;font-size:15px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-variant-numeric:tabular-nums;text-decoration:none;background:${GOLD_CTA_BG};box-shadow:${GOLD_CTA_SHADOW};transition:transform 120ms ease,box-shadow 160ms ease,background 160ms ease,opacity 160ms ease}
.gv-gold-cta:hover{background:${GOLD_CTA_BG_HOVER};box-shadow:${GOLD_CTA_SHADOW_HOVER};transform:translateY(-1px)}
.gv-gold-cta:active{transform:translateY(0) scale(0.985)}
.gv-gold-cta:disabled{cursor:default;opacity:0.55;transform:none}
.gv-gold-cta:focus{outline:none}
.gv-gold-cta:focus-visible{outline:2px solid #EED98A;outline-offset:3px}
.gv-gold-cta-block{width:100%}
`;

export function GoldButton({
  children, onClick, href, busy, busyText, disabled, block = false, type = 'button', className = '', style, ariaLabel, testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** Render as a link instead of a button. */
  href?: string;
  busy?: boolean;
  busyText?: string;
  disabled?: boolean;
  block?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  testId?: string;
}) {
  const cls = `gv-gold-cta${block ? ' gv-gold-cta-block' : ''} ${className}`.trim();
  const inner = busy ? (busyText ?? 'ONE MOMENT…') : children;
  if (href) {
    return (
      <a href={href} className={cls} style={style} aria-label={ariaLabel} data-testid={testId} aria-disabled={disabled || undefined}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={busy || disabled} aria-busy={busy || undefined} className={cls} style={style} aria-label={ariaLabel} data-testid={testId}>
      {inner}
    </button>
  );
}

/** Mount once near a GoldButton when the page has no global stylesheet for it. */
export function GoldButtonStyles() {
  return <style>{GOLD_CTA_CSS}</style>;
}

export default GoldButton;
