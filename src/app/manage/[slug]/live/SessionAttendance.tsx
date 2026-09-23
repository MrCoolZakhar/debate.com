'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Attendance for one committee, in the session roll-call look (23 Sep 2026).
//
// Owner: "redesign the attendance page. It might be important to show when they
// were marked what throughout the conference."
//
// THE ROLL. The chair's full-screen roll call, read only: a forest card, round
// flags, the A / P / PV control drawn as a static readout, Present rows tinted
// green and Present-and-Voting gold, absent rows clear, observers marked by the
// gold megaphone with the word under it. Counts are plain typography (CLAUDE.md
// §8: no count pills).
//
// WHEN THEY WERE MARKED WHAT. `delegates` holds only the current status, so the
// history comes from `delegate_status_log` (migration `delegate_status_log`,
// 23 Sep 2026): an AFTER INSERT / UPDATE OF status, is_observer trigger writes a
// row for every change, and a `baseline` row recorded every seat's status the
// moment it shipped. Read through `delegate_status_history(p_committee)`,
// SECURITY DEFINER, which answers only the conference's organisers (and platform
// admins) and the session's chairs. Nothing before the trigger can be recovered,
// and the screen says so: "Recorded from 23 Sep 2026".
//
// Each delegation gets a strip of its changes (Present 09:02, PV 11:40, Absent
// 13:15 …) and the time it has been in the room; the foot summarises each day of
// the conference (peak present, roll calls taken, changes).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { Megaphone, RefreshCw, History as HistoryIcon } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SOFT, RED } from './tokens';

type Status = 'absent' | 'present' | 'present-voting';

interface LogRow {
  delegateId: string;
  country: string;
  status: Status;
  isObserver: boolean;
  kind: 'baseline' | 'insert' | 'update';
  at: string;
}

export interface AttendanceSeat {
  country: string;
  status: string;
  isObserver: boolean;
  logoUrl?: string | null;
}

const RECORDED_FROM = '23 Sep 2026';
const INK_ON_FOREST = '#EDE7D8';
const GOLD = '#EED98A';

const STATUS_WORD: Record<Status, string> = { absent: 'Absent', present: 'Present', 'present-voting': 'Present and voting' };
const STATUS_SHORT: Record<Status, string> = { absent: 'A', present: 'P', 'present-voting': 'PV' };
const asStatus = (s: string): Status => (s === 'present' || s === 'present-voting' ? s : 'absent');

/** The chair's A / P / PV slider, drawn as a readout: same track, same thumb colours. */
function StatusReadout({ status, isObserver }: { status: Status; isObserver: boolean }) {
  const segs: Status[] = isObserver ? ['absent', 'present'] : ['absent', 'present', 'present-voting'];
  const on = isObserver && status === 'present-voting' ? 'present' : status;
  const seg = 36;
  const h = 32;
  const inner = seg * segs.length - 3;
  const cell = inner / segs.length;
  const idx = segs.indexOf(on);
  const thumb = on === 'absent' ? '#8B2020' : on === 'present' ? '#3D7A52' : '#B6871F';
  return (
    <span role="img" aria-label={STATUS_WORD[on]} title={STATUS_WORD[on]}
      className="relative rounded-full shrink-0 inline-block"
      style={{ width: seg * segs.length, height: h, backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}>
      <span className="absolute rounded-full shadow-sm" style={{ top: (h - 3 - 26) / 2, width: 30, height: 26, insetInlineStart: idx * cell + (cell - 30) / 2, backgroundColor: thumb }} />
      <span className="absolute inset-0 grid items-center" style={{ gridTemplateColumns: `repeat(${segs.length}, 1fr)` }} aria-hidden>
        {segs.map((s) => (
          <span key={s} className="text-center relative text-[11px] font-extrabold" style={{ color: s === on ? '#FFFFFF' : 'rgba(255,255,255,0.4)' }}>{STATUS_SHORT[s]}</span>
        ))}
      </span>
    </span>
  );
}

const hm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const dayLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

/** Collapse a delegation's rows into the moments its state actually changed. */
function changesOf(rows: LogRow[]): LogRow[] {
  const out: LogRow[] = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.status === r.status && prev.isObserver === r.isObserver) continue;
    out.push(r);
  }
  return out;
}

/** Time in the room (not absent) since recording began, up to `until`. */
function presentMs(changes: LogRow[], until: number): number {
  let total = 0;
  changes.forEach((c, i) => {
    if (c.status === 'absent') return;
    const start = new Date(c.at).getTime();
    const end = i + 1 < changes.length ? new Date(changes[i + 1].at).getTime() : until;
    total += Math.max(0, end - start);
  });
  return total;
}

export function SessionAttendance({ sessionId, seats, endedAt = null }: {
  /** `committees.id` of the live session. */
  sessionId: string | null;
  /** The roster as it stands now (the page's polled read). */
  seats: AttendanceSeat[];
  endedAt?: string | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [logError, setLogError] = useState('');
  const [reload, setReload] = useState(0);
  // When the log was read: "in the room" for a seat still present runs up to here.
  const [readAt, setReadAt] = useState(0);

  // The roster changes whenever the page's poll sees a status move; the log follows it.
  const rosterSig = seats.map((s) => `${s.country}:${s.status}:${s.isObserver ? 1 : 0}`).join('|');
  useEffect(() => {
    if (!sessionId || !token) return;
    let alive = true;
    void (async () => {
      const { data, error } = await getAuthedClient(token).rpc('delegate_status_history', { p_committee: sessionId });
      if (!alive) return;
      const res = data as { ok?: boolean; rows?: Record<string, unknown>[] } | null;
      if (error || !res?.ok) {
        if (error) console.error('[SessionAttendance] history read failed:', error);
        setLogError(res && res.ok === false ? "You don't have access to this committee's attendance history." : "Couldn't load the attendance history. Try again in a moment.");
        return;
      }
      setLogError('');
      setReadAt(Date.now());
      setLog((res.rows ?? []).map((r) => ({
        delegateId: String(r.delegate_id ?? ''),
        country: String(r.country ?? ''),
        status: asStatus(String(r.status ?? 'absent')),
        isObserver: !!r.is_observer,
        kind: (r.kind as LogRow['kind']) ?? 'update',
        at: String(r.at ?? ''),
      })));
    })();
    return () => { alive = false; };
    // Re-read when the roster moves or the reader asks.
  }, [sessionId, token, rosterSig, reload]);

  const now = endedAt ? new Date(endedAt).getTime() : readAt;

  const byCountry = useMemo(() => {
    const m = new Map<string, LogRow[]>();
    for (const r of log ?? []) {
      const k = r.country.trim().toLowerCase();
      const list = m.get(k);
      if (list) list.push(r); else m.set(k, [r]);
    }
    return m;
  }, [log]);

  const roster = [...seats].sort((a, b) => a.country.localeCompare(b.country));
  const body = seats.filter((s) => !s.isObserver);
  const present = body.filter((s) => s.status !== 'absent').length;
  const pv = body.filter((s) => s.status === 'present-voting').length;
  const observers = seats.length - body.length;

  // Per day: peak present in the voting body, roll calls (3+ seats changed within a minute), changes.
  const days = useMemo(() => {
    if (!log || !log.length) return [];
    const state = new Map<string, { status: Status; obs: boolean }>();
    const out = new Map<string, { peak: number; changes: number; rollCalls: number; first: string; last: string }>();
    let clusterStart = 0; let clusterCount = 0; let clusterCounted = false;
    for (const r of [...log].sort((a, b) => a.at.localeCompare(b.at))) {
      state.set(r.country.trim().toLowerCase(), { status: r.status, obs: r.isObserver });
      if (r.kind === 'baseline') continue;
      const key = dayKey(r.at);
      const d = out.get(key) ?? { peak: 0, changes: 0, rollCalls: 0, first: r.at, last: r.at };
      d.changes += 1; d.last = r.at;
      const t = new Date(r.at).getTime();
      if (t - clusterStart > 60_000) { clusterStart = t; clusterCount = 0; clusterCounted = false; }
      clusterCount += 1;
      if (clusterCount >= 3 && !clusterCounted) { d.rollCalls += 1; clusterCounted = true; }
      let p = 0;
      for (const v of state.values()) if (!v.obs && v.status !== 'absent') p += 1;
      d.peak = Math.max(d.peak, p);
      out.set(key, d);
    }
    return [...out.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [log]);

  return (
    <div style={{ fontFamily: OUTFIT }}>
      {/* The figures, as plain type. */}
      <div className="flex items-end gap-x-7 gap-y-2 flex-wrap mb-4">
        <Figure n={`${present}/${body.length}`} label="present" />
        <Figure n={String(pv)} label="present and voting" />
        <Figure n={String(body.length - present)} label="absent" />
        {observers > 0 && <Figure n={String(observers)} label={observers === 1 ? 'observer' : 'observers'} />}
        <span className="ms-auto inline-flex items-center gap-1.5 text-[12px]" style={{ color: SOFT }}>
          <HistoryIcon size={13} strokeWidth={2.2} aria-hidden />
          Recorded from {RECORDED_FROM}
          <button type="button" onClick={() => setReload((n) => n + 1)} aria-label="Refresh the history" title="Refresh the history"
            className="ms-1 w-7 h-7 rounded-full inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{ color: NEU.forest, backgroundColor: 'rgba(27,56,40,0.06)' }}>
            <RefreshCw size={13} strokeWidth={2.4} />
          </button>
        </span>
      </div>

      {logError && (
        <p className="text-xs mb-3" style={{ color: RED, backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px' }}>{logError}</p>
      )}

      {/* The roll, in the chair's roll-call card. */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: NEU.forest, boxShadow: '0 0 0 1.5px #3D7A52, 0 10px 28px rgba(27,56,40,0.18)' }}>
        {roster.length === 0 ? (
          <p className="text-sm p-6 text-center" style={{ color: 'rgba(237,231,216,0.7)' }}>No delegations on the roster yet.</p>
        ) : roster.map((s) => {
          const st = asStatus(s.status);
          const rows = byCountry.get(s.country.trim().toLowerCase()) ?? [];
          const changes = changesOf(rows);
          const shown = changes.slice(-8);
          const hidden = changes.length - shown.length;
          const tint = st === 'absent' ? 'transparent' : st === 'present' || s.isObserver ? 'rgba(61,122,82,0.26)' : 'rgba(182,135,31,0.20)';
          const inRoom = log ? presentMs(changes, now) : 0;
          let lastDay = '';
          return (
            <div key={s.country} className="px-4 py-3" style={{ backgroundColor: tint, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 min-h-[48px]">
                <span className="shrink-0 rounded-full" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.25), 0 4px 10px rgba(0,0,0,0.18)' }}>
                  <SeatCircleFlag country={s.country} logoUrl={s.logoUrl ?? null} size={44} decorative fallback="initials" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-bold truncate" style={{ color: INK_ON_FOREST }}>{getCountryDisplayName(s.country, 'en')}</p>
                  {log && changes.length > 0 && (
                    <p className="text-[12px] truncate" style={{ color: 'rgba(237,231,216,0.62)' }}>
                      In the room {fmtDuration(inRoom)} since recording began
                    </p>
                  )}
                </div>
                <span className="shrink-0 relative flex flex-col items-center" style={{ width: 56 }}>
                  {s.isObserver && (
                    <>
                      <span role="img" aria-label="Observer" title="Observer" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: GOLD, color: NEU.forest }}>
                        <Megaphone size={15} strokeWidth={2.4} aria-hidden />
                      </span>
                      <span aria-hidden className="uppercase text-[9px] font-extrabold mt-0.5" style={{ color: GOLD, letterSpacing: '0.03em' }}>Observer</span>
                    </>
                  )}
                </span>
                <span className="shrink-0 flex justify-start" style={{ width: 108 }}>
                  <StatusReadout status={st} isObserver={s.isObserver} />
                </span>
              </div>
              {/* When it was marked what. */}
              {log && (
                <ol className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-2 ps-[56px]" aria-label={`Status changes for ${getCountryDisplayName(s.country, 'en')}`}>
                  {hidden > 0 && <li className="text-[11.5px]" style={{ color: 'rgba(237,231,216,0.55)' }}>{hidden} earlier ·</li>}
                  {shown.length === 0 && <li className="text-[11.5px]" style={{ color: 'rgba(237,231,216,0.55)' }}>No changes recorded yet</li>}
                  {shown.map((c, i) => {
                    const d = dayKey(c.at);
                    const newDay = d !== lastDay;
                    lastDay = d;
                    const color = c.status === 'absent' ? '#F2B8B0' : c.status === 'present' || c.isObserver ? '#A9D9B8' : GOLD;
                    return (
                      <li key={`${c.at}-${i}`} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'rgba(237,231,216,0.85)' }}>
                        {i > 0 && <span aria-hidden style={{ color: 'rgba(237,231,216,0.35)' }}>→</span>}
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                        <span className="font-semibold" style={{ color }}>
                          {c.kind === 'baseline' ? `${STATUS_WORD[c.status]} when recording began` : c.kind === 'insert' ? `Added, ${STATUS_WORD[c.status].toLowerCase()}` : STATUS_WORD[c.status]}
                          {c.isObserver && ' (observer)'}
                        </span>
                        <span className="tabular-nums">{newDay ? `${dayLabel(d)} ` : ''}{hm(c.at)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {/* Per day of the conference. */}
      {days.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-semibold mb-2" style={{ color: NEU.ink }}>Day by day</p>
          <div className="flex flex-col gap-1.5">
            {days.map(([key, d]) => (
              <div key={key} className="flex items-baseline gap-x-5 gap-y-1 flex-wrap rounded-xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
                <span className="text-[13.5px] font-semibold" style={{ color: NEU.ink, minWidth: 110 }}>{dayLabel(key)}</span>
                <span className="text-[12.5px] tabular-nums" style={{ color: SOFT }}>{hm(d.first)} to {hm(d.last)}</span>
                <span className="text-[12.5px]" style={{ color: SOFT }}><strong className="tabular-nums" style={{ color: NEU.ink }}>{d.peak}</strong> present at most</span>
                <span className="text-[12.5px]" style={{ color: SOFT }}><strong className="tabular-nums" style={{ color: NEU.ink }}>{d.rollCalls}</strong> {d.rollCalls === 1 ? 'roll call' : 'roll calls'}</span>
                <span className="text-[12.5px]" style={{ color: SOFT }}><strong className="tabular-nums" style={{ color: NEU.ink }}>{d.changes}</strong> {d.changes === 1 ? 'change' : 'changes'}</span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: SOFT }}>A roll call is three or more delegations marked within one minute. Observers are not counted as present.</p>
        </div>
      )}
      {log && days.length === 0 && (
        <p className="text-[12.5px] mt-3" style={{ color: SOFT }}>
          No status has changed since recording began. The strip under each delegation fills in as the chairs take roll.
        </p>
      )}
    </div>
  );
}

function Figure({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-bold tabular-nums" style={{ fontSize: 26, color: NEU.ink, lineHeight: 1 }}>{n}</span>
      <span className="text-[13px]" style={{ color: SOFT }}>{label}</span>
    </span>
  );
}
