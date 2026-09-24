'use client';

// One student on the advisor board, as a row of a speakers list (24 Sep 2026: the board
// is a list, "Up next" or "By committee", never cards). The only per-second work on the
// whole board is the small clock inside a row that has one (useClockSeconds): a local 1 s
// interval, no shared state.

import { memo, useEffect, useState } from 'react';
import { Mic, UserX, Armchair, Moon } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { committeeDisplayName, deriveCommitteeAcronym, getCommitteeDisplayName } from '@/lib/presetNames';
import { serverNow } from '@/lib/serverClock';
import { clockSeconds, placeOf, type ClockSpec, type RoomMode, type SeatState } from '@/lib/advisorBoard/derive';
import type { FollowedSeat, RoomDelegate } from '@/lib/advisorBoard/types';
import type { TranslationKey } from '@/lib/translations';
import { C, FONT, clock } from './tokens';

export function useClockSeconds(spec: ClockSpec | null): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!spec) return;
    // Read the clock at once (next task): `now` may be minutes old if this card had no clock before.
    const first = window.setTimeout(() => setNow(serverNow()), 0);
    const iv = window.setInterval(() => setNow(serverNow()), 1000);
    return () => { window.clearTimeout(first); window.clearInterval(iv); };
  }, [spec]);
  return clockSeconds(spec, now);
}

/** "under a minute" / "about N min" for a wait. */
export function waitText(t: ReturnType<typeof useT>, seconds: number): string {
  if (seconds < 60) return t('adv_wait_under_minute');
  return t('adv_wait_minutes', { n: Math.round(seconds / 60) });
}

export const MODE_KEY: Record<RoomMode, TranslationKey> = {
  gsl: 'adv_mode_gsl',
  moderated: 'adv_mode_moderated',
  tour: 'adv_mode_tour',
  unmoderated: 'adv_mode_unmoderated',
  consultation: 'adv_mode_consultation',
  'not-started': 'adv_mode_not_started',
  'roll-call': 'adv_mode_roll_call',
  voting: 'adv_mode_voting',
  break: 'adv_mode_break',
  ended: 'adv_mode_ended',
  missing: 'adv_mode_missing',
  'not-open': 'adv_mode_not_open',
  loading: 'adv_loading',
};

/** The one line that says where the student is. Ticks locally when it has a clock. */
export function StateLine({ state, big = false }: { state: SeatState; big?: boolean }) {
  const t = useT();
  const secs = useClockSeconds(state.clock);
  let text: string;
  switch (state.kind) {
    case 'speaking':
      text = state.clock ? t('adv_state_speaking_left', { time: clock(secs) }) : t('adv_state_speaking');
      break;
    case 'next':
      text = state.ahead === 0 ? t('adv_state_on_deck') : t('adv_state_next', { wait: waitText(t, secs) });
      break;
    case 'ahead':
      text = t('adv_state_ahead', { n: state.ahead, wait: waitText(t, secs) });
      break;
    case 'in-room':
      text = state.clock && state.mode === 'unmoderated'
        ? t('adv_state_in_room_unmod', { time: clock(secs) })
        : state.clock && state.mode === 'consultation'
          ? t('adv_state_in_room_consult', { time: clock(secs) })
          : t('adv_state_in_room');
      break;
    case 'absent':
      text = state.notOnRoster ? t('adv_state_not_on_roster') : t('adv_state_absent');
      break;
    default:
      text = t(MODE_KEY[state.mode]);
  }
  const color = state.kind === 'speaking' ? C.forest : state.kind === 'absent' ? C.danger : state.kind === 'not-in-session' ? C.inkSoft : C.ink;
  return (
    <span style={{ fontSize: big ? 17 : 14.5, fontWeight: state.kind === 'speaking' || state.kind === 'next' ? 800 : 600, color, fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}

export function seatTitle(seat: FollowedSeat, language: string): string {
  return seat.name?.trim() || getCountryDisplayName(seat.country, language);
}

export function seatSubtitle(seat: FollowedSeat, committeeName: string, language: string): string {
  const committee = committeeDisplayName(getCommitteeDisplayName(committeeName, language), seat.committeeAbbreviation);
  const parts = [seat.name?.trim() ? getCountryDisplayName(seat.country, language) : null, committee || null, seat.conferenceLabel];
  return parts.filter(Boolean).join(' · ');
}

/** The committee as the board names it: the acronym (or the name when it is short), and
 *  the full localised name for the line beneath or the tooltip. */
export function committeeLabels(name: string, abbreviation: string | null, language: string): { short: string; full: string } {
  const full = getCommitteeDisplayName(name, language);
  const short = committeeDisplayName(full, deriveCommitteeAcronym(name, abbreviation)) || full;
  return { short, full };
}

/** What the room is doing, in as few words as the row allows. */
const BUILTIN_MOTION_LABEL = /^(moderated caucus|unmoderated caucus|consultation of the whole|tour de table)$/i;

export function modeLabel(t: ReturnType<typeof useT>, state: Pick<SeatState, 'mode' | 'caucusLabel'>): string {
  // A stored motion label that is still the built-in English name reads in the viewer's
  // language; a chair's own name for the motion is shown as typed.
  if (state.caucusLabel && !BUILTIN_MOTION_LABEL.test(state.caucusLabel.trim())) return state.caucusLabel;
  if (state.mode === 'gsl') return t('adv_mode_gsl_short');
  return t(MODE_KEY[state.mode]);
}

/** WHEN, in plain words: the main line, and a quieter second one (a clock or a wait). */
function useWhen(state: SeatState): { main: string; sub: string | null; tone: 'floor' | 'soon' | 'room' | 'look' | 'out' } {
  const t = useT();
  const secs = useClockSeconds(state.clock);
  switch (state.kind) {
    case 'speaking':
      return { main: t('adv_state_speaking'), sub: state.clock ? t('adv_when_left', { time: clock(secs) }) : null, tone: 'floor' };
    case 'next':
      return state.ahead === 0
        ? { main: t('adv_when_ready'), sub: null, tone: 'soon' }
        : { main: t('adv_when_next'), sub: waitText(t, secs), tone: 'soon' };
    case 'ahead':
      return { main: t('adv_when_ahead', { n: state.ahead }), sub: waitText(t, secs), tone: 'soon' };
    case 'in-room':
      return { main: t('adv_state_in_room'), sub: state.clock ? t('adv_when_left', { time: clock(secs) }) : null, tone: 'room' };
    case 'absent':
      return { main: state.notOnRoster ? t('adv_state_not_on_roster') : t('adv_state_absent'), sub: null, tone: 'look' };
    default:
      return { main: t(MODE_KEY[state.mode]), sub: null, tone: 'out' };
  }
}

/** The start column: the place in the room's list (#1 speaking, as the chair's sidebar
 *  numbers it), or an icon when the student is not on a list. */
function PlaceMarker({ state }: { state: SeatState }) {
  const t = useT();
  const place = placeOf(state);
  if (state.kind === 'speaking') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: C.forest, color: C.gold }} title={t('adv_state_speaking')}>
        <Mic size={16} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (place !== null) {
    return (
      <span aria-hidden title={t('adv_place_title', { n: place })} style={{ fontSize: place < 10 ? 22 : 18, fontWeight: 800, color: state.kind === 'next' ? C.forest : C.forestSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {place}
      </span>
    );
  }
  const p = { size: 18, strokeWidth: 2.1, 'aria-hidden': true } as const;
  const color = state.kind === 'absent' ? C.danger : 'rgba(74,66,56,0.7)';
  return (
    <span style={{ color }}>
      {state.kind === 'absent' ? <UserX {...p} /> : state.kind === 'in-room' ? <Armchair {...p} /> : <Moon {...p} />}
    </span>
  );
}

const TONE: Record<'floor' | 'soon' | 'room' | 'look' | 'out', string> = {
  floor: C.forest,
  soon: C.ink,
  room: C.inkSoft,
  look: C.danger,
  out: C.inkSoft,
};

function SeatRowInner({
  seat,
  state,
  committeeName,
  delegate,
  onOpen,
  highlight,
  showWhere,
}: {
  seat: FollowedSeat;
  state: SeatState;
  committeeName: string;
  delegate: RoomDelegate | null;
  onOpen: (key: string) => void;
  highlight: boolean;
  /** "Up next" names the committee and what it is doing; "By committee" has a header for that. */
  showWhere: boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  const when = useWhen(state);
  const speaking = state.kind === 'speaking';
  const title = seatTitle(seat, language);
  const country = seat.name?.trim() ? getCountryDisplayName(seat.country, language) : null;
  const committee = committeeName ? committeeLabels(committeeName, seat.committeeAbbreviation, language) : null;
  const inSessionRow = state.kind !== 'not-in-session' && state.kind !== 'absent';
  const mode = showWhere && inSessionRow ? modeLabel(t, state) : null;
  const whereTitle = [committee?.full, seat.conferenceLabel].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onOpen(seat.key)}
      data-seat-key={seat.key}
      aria-label={[title, country, showWhere ? committee?.full : null, when.main, when.sub].filter(Boolean).join(', ')}
      className="adv-focus adv-row flex w-full items-center gap-3 px-3 py-2.5 text-start"
      style={{
        fontFamily: FONT,
        minHeight: 60,
        backgroundColor: speaking ? '#FFF7DC' : 'transparent',
        boxShadow: highlight ? `inset 0 0 0 2px ${C.gold}` : undefined,
      }}
    >
      <span className="flex w-8 shrink-0 items-center justify-center" aria-hidden>
        <PlaceMarker state={state} />
      </span>
      <span className="shrink-0" style={{ opacity: state.kind === 'not-in-session' ? 0.75 : 1 }}>
        <CircleFlag country={seat.country} code={seat.countryCode} logoUrl={delegate?.logoUrl ?? null} size={38} decorative />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 15.5, fontWeight: 800, color: C.ink, letterSpacing: '-0.005em', lineHeight: 1.25 }}>
          {title}
          {country && <span style={{ fontWeight: 500, color: C.inkSoft }}>{' '}{country}</span>}
        </span>
        {showWhere && (committee || mode) && (
          <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 500, color: C.inkSoft, lineHeight: 1.3 }} title={whereTitle || undefined}>
            {committee && <span style={{ fontWeight: 800, color: C.forestSoft, letterSpacing: '0.02em' }}>{committee.short}</span>}
            {committee && mode && ' · '}
            {mode}
          </span>
        )}
      </span>
      <span className="flex min-w-0 max-w-[44%] shrink-0 flex-col items-end text-end">
        <span className="line-clamp-2" style={{ fontSize: 14, fontWeight: speaking || state.kind === 'next' ? 800 : 700, color: TONE[when.tone], lineHeight: 1.2 }}>
          {when.main}
        </span>
        {when.sub && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: speaking ? C.forest : C.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
            {when.sub}
          </span>
        )}
      </span>
    </button>
  );
}

export const SeatRow = memo(SeatRowInner);
