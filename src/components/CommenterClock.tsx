'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CommenterClock: the speaker's remaining time on a Commenter's floor (Oct 2026, owner: "very
// important when chairs are banging the gavel to signal the 10 seconds remaining").
//
// It never COUNTS. A local countdown started when an event arrives lags by the event's travel
// time and drifts. Instead it re-derives, on every repaint, from the persisted anchor the
// Moderator wrote (current_speaker.time_remaining + started_at, RULE 6b) against the database
// clock (`serverNow()`), exactly like every other surface (delegate board, advisor board). The
// Commenter receives current_speaker events (RULE 6), so the anchor is always the stored one,
// and after a catch-up it is re-seated from the row.
//
// A pure reader: its own 250 ms interval refreshes a local `now` only while the clock runs.
// No setCommittee, no updateLocal, no localUpdateTime, nothing written (RULES 3 to 5). No
// audio: the knock is the Moderator's device only.
//
// THE GAVEL MARK: at or below `gavelAt` seconds (the committee's `gavelSoundAtSeconds`, read
// from the row) the digits turn red and pulse gently; red and still at 0. Under
// prefers-reduced-motion there is no pulse, only the red.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { serverNow } from '@/lib/serverClock';

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function CommenterClock({
  base,
  startedAt,
  gavelAt,
  showPaused = true,
  fontSize = '3.4rem',
  onPress,
  pressTitle,
}: {
  /** The value at the anchor: current_speaker.time_remaining, or the on-deck slot. */
  base: number;
  /** current_speaker.started_at; null = paused (or nobody seated): `base` is the truth. */
  startedAt: string | null;
  /** Show "Paused" under a stopped clock (off on deck: nobody is seated yet). */
  showPaused?: boolean;
  /** The gavel mark in seconds. */
  gavelAt: number;
  fontSize?: string;
  /** A press on the clock (a Moderator control): the "only the Moderator" notice. */
  onPress?: () => void;
  pressTitle?: string;
}) {
  const t = useT();
  const [now, setNow] = useState(() => serverNow());
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const running = Number.isFinite(startedMs);

  useEffect(() => {
    // Re-read at once when the anchor changes, then repaint while it runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the anchor just changed (a press on the Moderator's device, via realtime); the digits must re-derive from it now, not on the first tick.
    setNow(serverNow());
    if (!running) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [running, startedAt, base]);

  const safeBase = Number.isFinite(base) ? Math.max(0, base) : 0;
  const remaining = running
    ? Math.max(0, safeBase - Math.max(0, Math.round((now - startedMs) / 1000)))
    : Math.max(0, Math.round(safeBase));
  const ticking = running && remaining > 0;
  const atMark = remaining <= gavelAt;
  const color = remaining === 0 ? '#8B2020' : atMark ? '#B3261E' : running ? '#1C1410' : '#6A5A4A';

  const style: CSSProperties = { fontSize, lineHeight: 1.05, color };
  return (
    <div
      className={`cc-clock inline-flex flex-col items-center ${onPress ? 'cursor-not-allowed' : ''}`}
      onClick={onPress}
      title={onPress ? pressTitle : undefined}
    >
      <style>{`
        @keyframes cc-gavel-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.62; transform: scale(1.04); } }
        .cc-pulse { animation: cc-gavel-pulse 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cc-pulse { animation: none; } }
      `}</style>
      <span
        role="timer"
        aria-live="off"
        aria-label={t('commenter_clock_label').replace('{time}', fmt(remaining))}
        className={`font-black font-mono tabular-nums ${ticking && atMark ? 'cc-pulse' : ''}`}
        style={style}
      >
        {fmt(remaining)}
      </span>
      {showPaused && !running && remaining > 0 && (
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#9A8A78' }}>{t('commenter_clock_paused')}</span>
      )}
    </div>
  );
}
