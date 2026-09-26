'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Attendance for one committee: who is in the room and who is not, and when
// they were in it (owner, 26 Sep 2026: "it should just be a quick display of
// who is in the room and who's not, as well as when they were in the room").
// Two white lists, In the room and Not here, each delegation with a round flag,
// "Since 09:02" / "Left 13:15", its total time, and a thin bar of the spans it
// was present over the recorded period (hover for the times).
//
// The history comes from `delegate_status_log` via
// `delegate_status_history(p_committee)` (organisers and the session's chairs
// only). Nothing before 23 Sep 2026 was recorded.
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

const asStatus = (s: string): Status => (s === 'present' || s === 'present-voting' ? s : 'absent');

const hm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
  const inRoom = roster.filter((s) => s.status !== 'absent');
  const away = roster.filter((s) => s.status === 'absent');

  // The span the bars cover: from the first recorded change to now (or the end).
  const spanStart = useMemo(() => {
    let min = Infinity;
    for (const r of log ?? []) { const t = new Date(r.at).getTime(); if (t < min) min = t; }
    return Number.isFinite(min) ? min : 0;
  }, [log]);
  const spanEnd = Math.max(now, spanStart + 60_000);

  const rowFor = (s: AttendanceSeat) => {
    const changes = changesOf(byCountry.get(s.country.trim().toLowerCase()) ?? []);
    const st = asStatus(s.status);
    const last = changes[changes.length - 1];
    // Presence intervals for the bar and the tooltip.
    const spans: Array<{ from: number; to: number }> = [];
    changes.forEach((c, i) => {
      if (c.status === 'absent') return;
      const from = new Date(c.at).getTime();
      const to = i + 1 < changes.length ? new Date(changes[i + 1].at).getTime() : spanEnd;
      if (to > from) spans.push({ from, to });
    });
    const merged: Array<{ from: number; to: number }> = [];
    for (const sp of spans) {
      const prev = merged[merged.length - 1];
      if (prev && sp.from <= prev.to + 1000) prev.to = Math.max(prev.to, sp.to); else merged.push({ ...sp });
    }
    let when = '';
    if (!log) when = '';
    else if (st !== 'absent') when = last && last.kind !== 'baseline' ? `Since ${hm(last.at)}` : 'In the room';
    else if (merged.length) when = `Left ${hm(new Date(merged[merged.length - 1].to).toISOString())}`;
    else when = 'Not in the room yet';
    const total = log ? presentMs(changes, spanEnd) : 0;
    const tip = merged.length
      ? merged.map((m) => `${hm(new Date(m.from).toISOString())} to ${m.to >= spanEnd - 1000 && st !== 'absent' ? 'now' : hm(new Date(m.to).toISOString())}`).join(', ')
      : 'Not in the room since recording began';
    return (
      <li key={s.country} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(27,56,40,0.07)' }}>
        <SeatCircleFlag country={s.country} logoUrl={s.logoUrl ?? null} size={30} decorative fallback="initials" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]" style={{ color: NEU.ink }}>
            {getCountryDisplayName(s.country, 'en')}
            {s.isObserver && (
              <span role="img" aria-label="Observer" title="Observer" className="inline-flex align-middle ms-1.5" style={{ color: '#8A6414' }}>
                <Megaphone size={13} strokeWidth={2.4} aria-hidden />
              </span>
            )}
            {st === 'present-voting' && !s.isObserver && <span className="ms-1.5 text-[12px] font-semibold" style={{ color: '#8A6414' }}>voting</span>}
          </p>
          {/* When they were in the room, as a bar over the recorded span. */}
          {log && spanStart > 0 && (
            <div className="relative mt-1.5 h-[6px] rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} title={tip} aria-label={`In the room: ${tip}`} role="img">
              {merged.map((m, i) => (
                <span key={i} className="absolute top-0 bottom-0 rounded-full" style={{
                  left: `${((m.from - spanStart) / (spanEnd - spanStart)) * 100}%`,
                  width: `${Math.max(1.2, ((m.to - m.from) / (spanEnd - spanStart)) * 100)}%`,
                  backgroundColor: '#3D7A52',
                }} />
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right" style={{ minWidth: 92 }}>
          <p className="text-[12.5px] font-semibold tabular-nums" style={{ color: st === 'absent' ? SOFT : NEU.forest }}>{when}</p>
          {log && total > 0 && <p className="text-[11.5px] tabular-nums" style={{ color: SOFT }}>{fmtDuration(total)} in total</p>}
        </div>
      </li>
    );
  };

  return (
    <div style={{ fontFamily: OUTFIT }}>
      {/* Who is here, as plain big numbers. */}
      <div className="flex items-baseline gap-x-6 gap-y-2 flex-wrap mb-4">
        <Figure n={String(inRoom.length)} label="in the room" />
        <Figure n={String(away.length)} label="not here" />
        <button type="button" onClick={() => setReload((n) => n + 1)} aria-label="Refresh" title="Refresh"
          className="ms-auto w-8 h-8 rounded-full inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ color: NEU.forest, backgroundColor: 'rgba(27,56,40,0.06)' }}>
          <RefreshCw size={14} strokeWidth={2.4} />
        </button>
      </div>

      {logError && (
        <p className="text-xs mb-3" style={{ color: RED, backgroundColor: 'rgba(139,32,32,0.06)', borderRadius: 10, padding: '8px 12px' }}>{logError}</p>
      )}

      {roster.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: SOFT }}>No delegations on the roster yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-2xl bg-white px-4 pt-3 pb-1" style={{ boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 10px 26px rgba(27,56,40,0.08)' }} aria-labelledby="att-in">
            <h3 id="att-in" className="text-[14px] font-bold mb-1" style={{ color: NEU.forest }}>In the room</h3>
            {inRoom.length ? <ul>{inRoom.map(rowFor)}</ul> : <p className="text-[13px] py-3" style={{ color: SOFT }}>Nobody is in the room</p>}
          </section>
          <section className="rounded-2xl bg-white px-4 pt-3 pb-1" style={{ boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 10px 26px rgba(27,56,40,0.08)' }} aria-labelledby="att-out">
            <h3 id="att-out" className="text-[14px] font-bold mb-1" style={{ color: SOFT }}>Not here</h3>
            {away.length ? <ul>{away.map(rowFor)}</ul> : <p className="text-[13px] py-3" style={{ color: SOFT }}>Everyone is here</p>}
          </section>
        </div>
      )}
      <p className="text-[11.5px] mt-3 inline-flex items-center gap-1.5" style={{ color: SOFT }}>
        <HistoryIcon size={12} strokeWidth={2.2} aria-hidden /> Bars show when each delegation was in the room, recorded from {RECORDED_FROM}
      </p>
    </div>
  );
}

function Figure({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-extrabold tabular-nums" style={{ fontSize: 34, color: NEU.forest, lineHeight: 1, letterSpacing: '-0.02em' }}>{n}</span>
      <span className="text-[15px] font-semibold" style={{ color: SOFT }}>{label}</span>
    </span>
  );
}
