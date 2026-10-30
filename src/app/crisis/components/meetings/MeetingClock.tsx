'use client';
// Gavelling Crisis: the timer on a meeting itself. Not strict (Peter, 26 Oct 2026): staff and chairs press Start
// and Stop, the clock shows "06:12 of 10:00" against the planned length, turns warm and then red past it and never
// stops by itself. Delegates in the meeting see the same clock read only. The seconds are derived purely from the row
// (started_at, paused_at, paused_seconds, ended_at) and the DATABASE clock, from one shared ticking source
// (src/lib/crisis/meetingClockStore.ts): no local counter, no write per second, and a press keeps its expected clock
// on screen until the re-read agrees, so the clock never snaps back.

import { useState } from 'react';
import { Pause, Play, RotateCcw, Square, Timer } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { serverNow } from '@/lib/serverClock';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { holdClockAction, useMeetingNow } from '@/lib/crisis/meetingClockStore';
import { clockText, meetingClock, meetingInProgress, meetingPaused, meetingRunning, meetingSeconds, type MeetingClockAction } from '@/lib/crisis/meetings';
import type { Cabinet, Meeting } from '@/lib/crisis/types';
import { Btn, CK } from '../../crisisKit';
import { AvatarStack, NameList, type Person } from './meetingKit';

/** The running clock, or how long a finished meeting lasted. Draws nothing for a meeting that never started. */
export function MeetingClockReadout({ m }: { m: Meeting }) {
  const inProgress = meetingInProgress(m);
  const running = meetingRunning(m);
  const paused = inProgress && meetingPaused(m);
  const now = useMeetingNow(running);
  const secs = meetingSeconds(m, now);
  if (secs === null || (!inProgress && !m.ended_at)) return null;
  const planned = m.duration_minutes * 60;
  const over = secs > planned;
  const warm = !over && secs >= planned * 0.85;
  const color = over ? CK.danger : warm ? CK.warn : CK.ok;
  const share = Math.min(1, planned > 0 ? secs / planned : 1);
  return (
    <div style={{ background: over ? 'rgba(163,65,47,0.08)' : warm ? 'rgba(182,135,31,0.1)' : 'rgba(61,122,82,0.08)', borderRadius: 14, padding: '10px 12px' }}>
      <div className="flex items-center flex-wrap" style={{ gap: '4px 10px', color }}>
        <Timer size={18} strokeWidth={1.6} aria-hidden />
        {inProgress ? (
          <>
            <b role="timer" aria-label={`Meeting ${paused ? 'paused at' : 'running for'} ${clockText(secs)}`} style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clockText(secs)}</b>
            <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>of {clockText(planned)}</span>
            {over && <span style={{ fontSize: 13, fontWeight: 800 }}>{clockText(secs - planned)} over</span>}
            {paused && <span className="inline-flex items-center" style={{ gap: 4, fontSize: 13, fontWeight: 800, color: CK.warn }}><Pause size={13} strokeWidth={1.6} aria-hidden />Paused</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>Lasted</span>
            <b style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clockText(secs)}</b>
            <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>planned {clockText(planned)}</span>
          </>
        )}
      </div>
      <div aria-hidden style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(27,56,40,0.1)', overflow: 'hidden' }}>
        <div style={{ width: `${share * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 300ms linear' }} />
      </div>
    </div>
  );
}

/** Who is in the room: overlapping portraits with the names. */
export function InTheRoom({ m, people, cabinets }: { m: Meeting; people: Map<string, Person>; cabinets: Cabinet[] }) {
  const ids = m.character_ids.slice(0, 6);
  return (
    <div className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
      <AvatarStack ids={ids} people={people} cabinets={cabinets} size={36} />
      <div className="min-w-0">
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: CK.red }}>In the room</p>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></p>
      </div>
    </div>
  );
}

/** Start / Pause / Resume / Stop (and a small reset) for staff and chairs, on an approved meeting. */
export function MeetingClockControls({ m, refx, onChanged }: { m: Meeting; refx: CrisisRef; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const inProgress = meetingInProgress(m);
  const paused = meetingPaused(m);
  const act = async (action: MeetingClockAction, ok: string) => {
    setBusy(true);
    const pressedAt = serverNow();
    try { await meetingClock(refx, m.id, action); holdClockAction(m, action, pressedAt); notifyOk(ok, 'crisis-meeting-clock'); onChanged?.(); } catch (e) {
      notifyErr(crisisError(e, 'Could not change the meeting clock.'), 'crisis-meeting-clock');
    } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
      {inProgress ? (
        <>
          {paused
            ? <Btn tone="green" size="sm" disabled={busy} icon={<Play size={14} strokeWidth={1.6} aria-hidden />} onClick={() => act('resume', 'Meeting resumed')}>Resume</Btn>
            : <Btn tone="ghost" size="sm" disabled={busy} icon={<Pause size={14} strokeWidth={1.6} aria-hidden />} onClick={() => act('pause', 'Meeting paused')}>Pause</Btn>}
          <Btn tone="red" size="sm" disabled={busy} icon={<Square size={14} strokeWidth={1.6} aria-hidden />} onClick={() => act('stop', 'Meeting stopped')}>Stop meeting</Btn>
        </>
      ) : <Btn tone="green" size="sm" disabled={busy} icon={<Play size={14} strokeWidth={1.6} aria-hidden />} onClick={() => act('start', 'Meeting started')}>Start meeting</Btn>}
      {m.started_at && (
        <Btn tone="ghost" size="sm" disabled={busy} icon={<RotateCcw size={13} strokeWidth={1.6} aria-hidden />} onClick={() => act('reset', 'Clock reset')}>Reset</Btn>
      )}
    </div>
  );
}
