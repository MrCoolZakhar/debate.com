'use client';

// One student on the advisor board. The only per-second work on the whole board is the
// small clock inside a card that has one (useClockSeconds): a local 1 s interval, no shared state.

import { memo, useEffect, useState } from 'react';
import { ChevronRight, Mic, Hourglass, UserX, Armchair, Moon } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { committeeDisplayName, getCommitteeDisplayName } from '@/lib/presetNames';
import { serverNow } from '@/lib/serverClock';
import { clockSeconds, type ClockSpec, type RoomMode, type SeatState } from '@/lib/advisorBoard/derive';
import type { FollowedSeat, RoomDelegate } from '@/lib/advisorBoard/types';
import type { TranslationKey } from '@/lib/translations';
import { C, FONT, SHADOW, clock } from './tokens';

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

function KindIcon({ state }: { state: SeatState }) {
  const p = { size: 15, strokeWidth: 2.2, 'aria-hidden': true } as const;
  if (state.kind === 'speaking') return <Mic {...p} />;
  if (state.kind === 'next' || state.kind === 'ahead') return <Hourglass {...p} />;
  if (state.kind === 'absent') return <UserX {...p} />;
  if (state.kind === 'in-room') return <Armchair {...p} />;
  return <Moon {...p} />;
}

export function seatTitle(seat: FollowedSeat, language: string): string {
  return seat.name?.trim() || getCountryDisplayName(seat.country, language);
}

export function seatSubtitle(seat: FollowedSeat, committeeName: string, language: string): string {
  const committee = committeeDisplayName(getCommitteeDisplayName(committeeName, language), seat.committeeAbbreviation);
  const parts = [seat.name?.trim() ? getCountryDisplayName(seat.country, language) : null, committee || null, seat.conferenceLabel];
  return parts.filter(Boolean).join(' · ');
}

function SeatCardInner({
  seat,
  state,
  committeeName,
  delegate,
  onOpen,
  highlight,
}: {
  seat: FollowedSeat;
  state: SeatState;
  committeeName: string;
  delegate: RoomDelegate | null;
  onOpen: (key: string) => void;
  highlight: boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  const speaking = state.kind === 'speaking';
  const modeLine = state.kind !== 'not-in-session' && state.kind !== 'absent'
    ? (state.caucusLabel || t(MODE_KEY[state.mode]))
    : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(seat.key)}
      data-seat-key={seat.key}
      className="adv-focus adv-card group flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-start transition-transform duration-150 active:scale-[0.99]"
      style={{
        fontFamily: FONT,
        backgroundColor: speaking ? '#FFFBEA' : C.cream,
        boxShadow: speaking
          ? `inset 0 0 0 2px ${C.deepGold}, ${SHADOW.card}`
          : highlight ? `inset 0 0 0 2px ${C.gold}, ${SHADOW.card}` : SHADOW.card,
        opacity: state.kind === 'not-in-session' ? 0.86 : 1,
      }}
    >
      <span className="relative shrink-0">
        <CircleFlag country={seat.country} code={seat.countryCode} logoUrl={delegate?.logoUrl ?? null} size={44} decorative />
        {speaking && (
          <span aria-hidden className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: C.forest, color: C.gold, boxShadow: `0 0 0 2px ${C.cream}` }}>
            <Mic size={11} strokeWidth={2.6} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 16.5, fontWeight: 800, color: C.ink, letterSpacing: '-0.005em' }}>
          {seatTitle(seat, language)}
        </span>
        <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: C.inkSoft }}>
          {seatSubtitle(seat, committeeName, language)}
        </span>
        <span className="mt-1 flex items-center gap-1.5" style={{ color: speaking ? C.forest : state.kind === 'absent' ? C.danger : C.inkSoft }}>
          <KindIcon state={state} />
          <StateLine state={state} />
        </span>
        {modeLine && (
          <span className="mt-0.5 block truncate" style={{ fontSize: 12, fontWeight: 500, color: C.inkSoft }}>{modeLine}</span>
        )}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 rtl:rotate-180" style={{ color: 'rgba(27,56,40,0.4)' }} />
    </button>
  );
}

export const SeatCard = memo(SeatCardInner);
