'use client';

// The checkmark. One shape everywhere, the same seal social media uses: a
// scalloped disc with a white tick. Two meanings, told apart by colour:
//
//   blue  = verified. A conference whose set-up is complete
//           (conferences.is_verified, computed by refresh_conference_verification),
//           or an MUN CV entry written by Gavelling itself (source = 'gavelling_verified').
//   grey  = not yet. On public surfaces a conference without the mark shows
//           NOTHING; grey is for the owner's own screens (the manage rail,
//           the dashboard, the CV timeline's self-reported entries) where the
//           absence is the reminder.
//
// Never draw the seal in any other colour, and never reuse it for
// "assigned", "paid" or any other status: the tick means verified.

import { useId } from 'react';

export const VERIFIED_BLUE = '#1D9BF0';
export const VERIFIED_GREY = '#B4AC9F';

/** Sixteen-point rosette path on a 24x24 box, drawn once per size via viewBox. */
function sealPath(): string {
  const cx = 12, cy = 12, outer = 11, inner = 9.6, points = 16;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
}
const SEAL = sealPath();

export interface VerifiedCheckProps {
  verified: boolean;
  /** Pixel size of the seal. 14 beside body text, 18 beside a heading, 22 in a hero. */
  size?: number;
  /** Render the grey seal when not verified. Default false: nothing renders. */
  showUnverified?: boolean;
  /** Tooltip. Defaults explain the state; pass your own to add the minutes-left hint. */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function VerifiedCheck({
  verified, size = 16, showUnverified = false, title, className = '', style,
}: VerifiedCheckProps) {
  const id = useId();
  if (!verified && !showUnverified) return null;
  const fill = verified ? VERIFIED_BLUE : VERIFIED_GREY;
  const label = title ?? (verified ? 'Verified' : 'Not verified yet');
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex items-center flex-shrink-0 align-middle ${className}`}
      style={{ width: size, height: size, lineHeight: 0, ...style }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        <path id={`${id}-seal`} d={SEAL} fill={fill} stroke={fill} strokeWidth={1.2} strokeLinejoin="round" />
        <path
          d="M7.4 12.4 L10.4 15.3 L16.8 8.9"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** "About 12 minutes to your checkmark", for tooltips and reminder lines. */
export function minutesToCheckmarkLabel(minutes: number): string {
  if (minutes <= 0) return 'Your checkmark is one refresh away';
  if (minutes === 1) return 'About a minute to your checkmark';
  return `About ${minutes} minutes to your checkmark`;
}
