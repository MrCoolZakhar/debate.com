'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CommenterFloor: what a Commenter sees of the floor (17 Sep 2026, owner: "the Commenter
// should have the current speaker on the left side big, and then the upcoming speakers next
// to it on the right").
//
// The Moderator's floor is a column — a strip of flags across the top, then the speaker
// centred under it with the clock and the controls. A Commenter has no clock and no controls,
// and the bottom half of their screen is the comment dock, so that column wasted the width and
// squeezed the part they actually work in. Here the floor is one ROW instead: the delegation
// holding the floor big on the inline-start side, the queue beside it on the inline-end side,
// in speaking order. Same information, half the height, and the reading order matches the
// dock underneath.
//
// Read-only by construction. No reorder, no removal, no clock, no writes — every prop is a
// value the chair page already has, and nothing here calls setCommittee, updateLocal or the
// database (RULES 3 to 5). A Commenter who presses something gets the ordinary
// "Moderator only" notice through `onLockedAttempt`, exactly as on the strip.
//
// `floor-emblem-anchor` rides on the big flag, so FloorEmblemBackdrop centres the mark on the
// speaker here too (COMPONENT: Floor emblem).
// ─────────────────────────────────────────────────────────────────────────────

import { type ReactNode } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import type { StripHeader } from '@/components/SpeakerStrip';

export type CommenterFloorEntry = { delegateId: string; country: string };

/** The big flag. Smaller than the Moderator's 197px: this floor shares the screen with the
 *  comment dock, and the owner asked for the dock to be the working surface. */
const FLOOR_PX = 168;
const QUEUE_FLAG_PX = 40;

export default function CommenterFloor({
  header,
  floorCountry,
  floorLabel,
  floorNumber,
  upcoming,
  formatName,
  onLockedAttempt,
  emptyHint,
}: {
  header?: StripHeader | null;
  /** The delegation on the floor: seated, or on deck. Null = nobody, and nobody queued. */
  floorCountry: string | null;
  /** "is speaking" / "Ready to speak". */
  floorLabel?: string | null;
  /** A Room Order Tour de Table turn draws its number instead of a flag. */
  floorNumber?: string | null;
  upcoming: CommenterFloorEntry[];
  formatName: (country: string) => string;
  onLockedAttempt?: () => void;
  /** Shown in place of the whole row when there is nobody on the floor and nobody queued. */
  emptyHint?: ReactNode;
}) {
  const t = useT();

  const marker = header ? (
    <div className="flex items-center justify-center gap-2 mb-3 px-4 max-w-full shrink-0" style={{ color: '#1B3828' }}>
      {header.icon && <span aria-hidden className="shrink-0 inline-flex">{header.icon}</span>}
      <span
        className="min-w-0 truncate text-[15px] tracking-tight"
        title={header.detail ? `${header.label} - ${header.detail}` : undefined}
      >
        <span className="font-black">{header.label}</span>
        {header.detail && <span className="font-normal">{' - '}{header.detail}</span>}
      </span>
    </div>
  ) : null;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden pt-4">
      {marker}
      {floorCountry ? (
        <div
          className="flex-1 min-h-0 flex items-center gap-6 px-6 pb-3"
          onClick={onLockedAttempt}
          title={onLockedAttempt ? t('commenter_only_hint') : undefined}
        >
          {/* ── The floor, inline-start ── */}
          <div className="shrink-0 flex flex-col items-center" style={{ maxWidth: FLOOR_PX + 48 }}>
            {floorNumber ? (
              <div
                className="floor-emblem-anchor rounded-full bg-[#DDD4C0] shrink-0 flex items-center justify-center"
                style={{ width: FLOOR_PX, height: FLOOR_PX }}
              >
                <span className="font-black" style={{ color: '#1B3828', fontSize: '4rem' }}>{floorNumber}</span>
              </div>
            ) : (
              <SeatCircleFlag
                country={floorCountry}
                size={FLOOR_PX}
                decorative
                loading="eager"
                className="floor-emblem-anchor"
                style={{ boxShadow: '0 0 0 4px #F0EBDD, 0 2px 6px rgba(27,56,40,0.12), 0 12px 28px rgba(27,56,40,0.20)' }}
              />
            )}
            <h1 className="font-black text-[#1C1410] text-center leading-tight" style={{ fontSize: '1.6rem', margin: '10px 0 2px' }}>
              {formatName(floorCountry)}
            </h1>
            {floorLabel && (
              <p className="text-center font-bold" style={{ color: '#8B5A20', fontSize: '0.95rem' }}>{floorLabel}</p>
            )}
          </div>

          {/* ── The queue, inline-end. Scrolls on its own; the scrollbar is hidden like the
                 sidebar list, and the column never pushes the floor off screen. ── */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
            <p className="shrink-0 text-[10px] font-black uppercase tracking-widest pb-1.5" style={{ color: '#9A8A78' }}>
              {t('gsl_up_next')}
            </p>
            {upcoming.length === 0 ? (
              <p className="text-sm font-semibold" style={{ color: '#9A8A78' }}>{t('gsl_no_speakers_queued')}</p>
            ) : (
              <ul className="cf-queue flex-1 min-h-0 overflow-y-auto pe-1 m-0 p-0 list-none" style={{ scrollbarWidth: 'none' }}>
                <style>{`.cf-queue::-webkit-scrollbar{display:none}`}</style>
                {upcoming.map((s, i) => (
                  <li key={s.delegateId} className="flex items-center gap-3 py-1.5">
                    <span
                      aria-hidden
                      className="shrink-0 inline-flex items-center justify-center rounded-full text-xs font-black tabular-nums"
                      style={{ width: 22, height: 22, backgroundColor: '#E4DCC8', color: '#5A4E3E' }}
                    >
                      {i + 1}
                    </span>
                    <SeatCircleFlag country={s.country} size={QUEUE_FLAG_PX} decorative />
                    <span className="min-w-0 truncate font-semibold" style={{ color: '#1C1410', fontSize: '1rem' }}>
                      {formatName(s.country)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center px-4">
          {emptyHint}
        </div>
      )}
    </div>
  );
}
