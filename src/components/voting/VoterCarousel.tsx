'use client';

/**
 * VoterCarousel: the roll-call line on the ballot screen, as round flags.
 *
 * The delegation voting now sits in the centre, large. Delegations that have voted recede
 * to the inline-start side, delegations still to vote wait on the inline-end side (so the
 * line reads in the direction of the language and mirrors in RTL), each step further away
 * smaller and fainter. Four are visible on each side; a fifth on each side is mounted at
 * zero opacity so a seat entering or leaving the window fades rather than pops.
 *
 * Every seat is keyed by id and positioned with one transform, so when the pointer moves
 * (a vote, a Pass, Back) each flag glides to its new place: transform and opacity only,
 * interruptible CSS transitions, off under prefers-reduced-motion.
 *
 * Past voters wear a small badge with what they did. A recorded choice is the tally, so
 * with the tally hidden no choice badge is drawn; a Pass is not a vote and stays visible,
 * because the chair needs to see who comes back at the end of the line.
 *
 * The line is the ballot order followed by every delegation that passed, asked once more
 * (17 Sep 2026: no separate pass round). A delegation that passed therefore appears twice,
 * so each seat carries its own `key` and marks are asked by line position.
 */

import { Check, Minus, SkipForward, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import type { SessionSeat } from '@/lib/sessionFlags';
import type { VoteChoice } from '@/lib/voteState';

const D = 200;                                        // the centre flag's diameter, px
const SCALE = [1, 0.5, 0.38, 0.3, 0.24, 0.2];
const OPACITY = [1, 0.95, 0.7, 0.45, 0.24, 0];
const GAP = [40, 24, 18, 14, 10];                     // gap after step d (0 = after the centre)
const VISIBLE = 5;                                    // steps mounted on each side (the 5th is invisible)

/** Distance from the centre to the centre of the seat `d` steps away, in px. */
const OFFSETS: number[] = (() => {
  const out = [0];
  for (let d = 1; d <= VISIBLE; d++) {
    out[d] = out[d - 1] + (D * SCALE[d - 1]) / 2 + GAP[d - 1] + (D * SCALE[d]) / 2;
  }
  return out;
})();

export type SeatMark = VoteChoice | 'pass' | null;

export interface CarouselSeat extends SessionSeat { id: string; country: string; /** Unique in the line (a delegation that passed appears twice). */ key?: string }

function ChoiceBadge({ mark }: { mark: Exclude<SeatMark, null> }) {
  const rights = mark === 'for-rights' || mark === 'against-rights';
  const palette = mark === 'for' || mark === 'for-rights'
    ? { bg: '#2F6B45', fg: '#FFFFFF' }
    : mark === 'against' || mark === 'against-rights'
    ? { bg: '#8B2020', fg: '#FFFFFF' }
    : mark === 'abstain'
    ? { bg: '#8A7C6A', fg: '#FFFFFF' }
    : { bg: '#EDE7D8', fg: '#4A3F33' };
  const Icon = mark === 'for' || mark === 'for-rights' ? Check : mark === 'abstain' ? Minus : mark === 'pass' ? SkipForward : X;
  return (
    <span
      className="absolute bottom-[4%] end-[4%] w-[62px] h-[62px] rounded-full flex items-center justify-center"
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        boxShadow: `0 0 0 6px #F6F1E9${rights ? ', 0 0 0 11px #D9B44A' : ''}, 0 6px 14px rgba(27,56,40,0.25)`,
      }}
      aria-hidden
    >
      <Icon size={34} strokeWidth={3.25} />
    </span>
  );
}

export function VoterCarousel({ seats, current, markOf, hideTally }: {
  /** The voting line: the ballot order, then the delegations that passed. */
  seats: CarouselSeat[];
  /** Index of the delegation voting now. */
  current: number;
  /** What the seat at line position `index` did. */
  markOf: (id: string, index: number) => SeatMark;
  hideTally: boolean;
}) {
  const { language } = useLanguage();
  const dir = language === 'ar' ? -1 : 1;
  const from = Math.max(0, current - VISIBLE);
  const to = Math.min(seats.length - 1, current + VISIBLE);
  const windowed = seats.slice(from, to + 1).map((seat, k) => ({ seat, i: from + k, d: from + k - current }));

  return (
    <div className="gv-carousel relative w-full shrink-0" style={{ height: D + 52 }} aria-hidden>
      <style>{`
        .gv-carousel .gv-seat, .gv-carousel .gv-seat-label {
          transition: transform 560ms cubic-bezier(0.2,0,0,1), opacity 460ms cubic-bezier(0.2,0,0,1);
        }
        .gv-carousel .gv-seat-ring { transition: box-shadow 400ms cubic-bezier(0.2,0,0,1) }
        @media (prefers-reduced-motion: reduce) {
          .gv-carousel .gv-seat, .gv-carousel .gv-seat-label, .gv-carousel .gv-seat-ring { transition: none }
        }
      `}</style>
      {windowed.map(({ seat, i, d }) => {
        const step = Math.min(Math.abs(d), VISIBLE);
        const x = Math.sign(d) * OFFSETS[step] * dir;
        const mark = d < 0 ? markOf(seat.id, i) : null;
        const showMark = mark !== null && (mark === 'pass' || !hideTally);
        const centre = d === 0;
        return (
          <div key={seat.key ?? seat.id}>
            <div
              className="gv-seat absolute top-0 left-1/2"
              style={{
                width: D,
                height: D,
                marginLeft: -D / 2,
                transform: `translateX(${x}px) scale(${SCALE[step]})`,
                transformOrigin: '50% 50%',
                opacity: OPACITY[step],
                zIndex: 20 - step,
              }}
            >
              <span
                className="gv-seat-ring absolute inset-0 rounded-full"
                style={{
                  boxShadow: centre
                    ? '0 0 0 7px #F6F1E9, 0 0 0 12px #D9B44A, 0 18px 40px rgba(27,56,40,0.28)'
                    : '0 0 0 8px #F6F1E9, 0 10px 26px rgba(27,56,40,0.20)',
                }}
              />
              {/* Eager, not lazy: at most 11 tiny same-origin SVGs, and a seat enters the window
                  at opacity 0 far off centre and then moves in by TRANSFORM only. Lazy loading is
                  judged on layout position, which a transform never changes, so a flag could stay
                  unpainted (US and UK, last in A-Z, were the ones reported blank). The persistent
                  will-change was dropped for the same report: an SVG <img> in a permanently
                  promoted, rescaled layer can be left un-rastered; the transition still
                  composites while it runs. */}
              <SeatCircleFlag seat={seat} size={D} decorative loading="eager" className="relative" />
              {showMark && <ChoiceBadge mark={mark} />}
            </div>
            {step >= 1 && step <= 2 && (
              <span
                className="gv-seat-label absolute left-1/2 text-center font-medium truncate pointer-events-none"
                style={{
                  top: D / 2 + (D * SCALE[step]) / 2 + 10,
                  width: 120,
                  marginLeft: -60,
                  fontSize: step === 1 ? 13 : 11.5,
                  color: '#6A5A4A',
                  transform: `translateX(${x}px)`,
                  opacity: step === 1 ? 0.95 : 0.6,
                }}
              >
                {getCountryDisplayName(seat.country, language)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
