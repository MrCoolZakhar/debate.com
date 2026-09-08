import { useId } from 'react';

/**
 * CreditCoin — the credit token's face.
 *
 * Drawn rather than shipped as an image on purpose. It renders at 16px in the
 * nav chip and at 40px+ on the credits page, and a raster sized for the larger
 * one is wasted bytes at the smaller while a raster sized for the smaller goes
 * soft when it grows. An inline SVG is a few hundred bytes, stays crisp at
 * every size, needs no network round trip, and cannot 404 the way
 * /gavel-mark.webp could.
 *
 * The colours are the coin's own, not the theme's: this is a depicted object,
 * like a flag, so it holds its gold and green on any background. That is also
 * why it takes no dark-mode variant.
 *
 * `title` makes it a labelled graphic for screen readers; omit it (the default)
 * and it is decorative and hidden, which is right beside a visible number.
 */
export function CreditCoin({
  size = 16,
  title,
  className,
  style,
}: {
  size?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Unique gradient ids per instance. Two coins on one page sharing an id
  // would make the second inherit the first's fills.
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Rim: light from the top-left, so the bevel reads as raised. */}
        <linearGradient id={`${uid}-rim`} x1="18%" y1="4%" x2="82%" y2="96%">
          <stop offset="0%" stopColor="#FFE889" />
          <stop offset="34%" stopColor="#FFD028" />
          <stop offset="62%" stopColor="#F0A80C" />
          <stop offset="100%" stopColor="#C97F05" />
        </linearGradient>
        {/* The struck edge below and left, which is what makes it a coin
            rather than a disc. */}
        <linearGradient id={`${uid}-edge`} x1="10%" y1="20%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#E0A413" />
          <stop offset="55%" stopColor="#B67A05" />
          <stop offset="100%" stopColor="#8A5A02" />
        </linearGradient>
        {/* Enamel centre. Deeper at the bottom-right, where the rim shades it. */}
        <linearGradient id={`${uid}-face`} x1="20%" y1="8%" x2="78%" y2="94%">
          <stop offset="0%" stopColor="#28A05C" />
          <stop offset="46%" stopColor="#127A41" />
          <stop offset="100%" stopColor="#0A4A28" />
        </linearGradient>
        {/* Gloss sweep across the upper-left of the enamel. */}
        <linearGradient id={`${uid}-gloss`} x1="12%" y1="6%" x2="60%" y2="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Struck edge, offset down-left. Drawn first so the face sits on it. */}
      <circle cx="29.5" cy="34.5" r="27.5" fill={`url(#${uid}-edge)`} />
      <circle cx="29.5" cy="34.5" r="27.5" fill="none" stroke="#7A4E02" strokeWidth="1.1" />

      {/* Rim */}
      <circle cx="33" cy="31" r="28" fill={`url(#${uid}-rim)`} />
      <circle cx="33" cy="31" r="28" fill="none" stroke="#A96C03" strokeWidth="1.2" />
      {/* Inner bevel line, the step down from rim to enamel. */}
      <circle cx="33" cy="31" r="21.4" fill="none" stroke="#FFF3B8" strokeWidth="1.1" opacity="0.75" />

      {/* Enamel centre, with the dark seat it sits in. */}
      <circle cx="33" cy="31" r="20.2" fill="#0C3D22" />
      <circle cx="33" cy="31" r="19.2" fill={`url(#${uid}-face)`} />

      {/* Gloss: a lens clipped to the enamel, hugging the top-left edge. */}
      <path
        d="M33 11.8a19.2 19.2 0 0 0-16.6 28.8A25 25 0 0 1 45.6 14.6 19.1 19.1 0 0 0 33 11.8Z"
        fill={`url(#${uid}-gloss)`}
      />
    </svg>
  );
}
