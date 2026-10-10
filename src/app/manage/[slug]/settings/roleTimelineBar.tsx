'use client';

/**
 * The role's application window drawn as one horizontal bar, with each dated
 * price as a segment of it (roleTimeline.ts: the window and the prices are
 * ONE timeline). A marker shows today. The legend under the bar carries the
 * words, so nothing has to fit inside a narrow segment on a phone.
 *
 * Read only: it draws what is stored and never writes.
 */

import type { FeePhase } from '@/lib/finance';
import { startOfDayIso, endOfDayIso } from '@/lib/applicationWindow';
import { F, INK, INK_SOFT, FOREST, AMBER, moneyText, shortDate, dateAndTime, dayRange, roleHasPrice, type RoleSetupConfig } from './panelKit';

const DAY = 86_400_000;
const SEGMENT_COLOURS = ['#1B3828', '#3D7A52', '#2A5A3C', '#6E9A7C', '#24503A', '#8DB39A'];
const CURRENT = '#D9B65A';

/** Price days are days in the conference's time zone (UTC when none is
 *  stored), exactly as the database reads them (roleTimeline.ts). */
function dayStart(d: string, tz: string | null): number {
  return new Date(startOfDayIso(d, tz)).getTime();
}
function dayEnd(d: string, tz: string | null): number {
  return new Date(endOfDayIso(d, tz)).getTime() + 60_000;
}
/** A gap shorter than this is minute rounding at a day's edge, not a gap. */
const EDGE = 10 * 60_000;

interface Segment {
  from: number;
  to: number;
  name: string;
  dates: string;
  price: string;
}

export function RoleTimelineBar({ config, now, fallbackCurrency, timeZone, compact = false }: {
  config: RoleSetupConfig;
  now: number;
  fallbackCurrency: string;
  /** conferences.timezone; null means UTC. */
  timeZone: string | null;
  compact?: boolean;
}) {
  const tz = timeZone;
  const currency = config.fee_currency || fallbackCurrency || 'USD';
  const priced = roleHasPrice(config.role);
  const phases: FeePhase[] = priced
    ? [...(config.fee_phases ?? [])].filter(p => p.start_date && p.end_date).sort((a, b) => a.start_date.localeCompare(b.start_date))
    : [];

  const openMs = config.applications_open_at ? new Date(config.applications_open_at).getTime()
    : phases[0] ? dayStart(phases[0].start_date, tz) : null;
  const closeMs = config.applications_close_at ? new Date(config.applications_close_at).getTime()
    : phases.length ? dayEnd(phases[phases.length - 1].end_date, tz) : null;

  if (openMs === null && closeMs === null) {
    return (
      <p style={{ fontFamily: F, fontSize: 14, color: INK_SOFT, lineHeight: 1.5 }}>
        No dates yet. It opens the moment you switch it on and stays open until you switch it off.
      </p>
    );
  }

  const start = openMs ?? Math.min(now, (closeMs as number) - 7 * DAY);
  const openEnded = closeMs === null;
  const end = closeMs ?? Math.max(start + 30 * DAY, now + 7 * DAY);
  const span = Math.max(end - start, DAY);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - start) / span) * 100));

  const segments: Segment[] = [];
  if (phases.length === 0) {
    segments.push({
      from: start, to: end,
      name: priced ? 'One price' : 'Applications',
      dates: '',
      price: priced ? moneyText(config.fee_amount, currency) : '',
    });
  } else {
    const first = dayStart(phases[0].start_date, tz);
    if (first > start + EDGE) {
      segments.push({ from: start, to: first, name: 'Before the first price', dates: '', price: moneyText(config.fee_amount, currency) });
    }
    for (const p of phases) {
      segments.push({
        from: Math.max(start, dayStart(p.start_date, tz)),
        to: Math.min(end, dayEnd(p.end_date, tz)),
        name: p.label?.trim() || 'Price',
        dates: dayRange(p.start_date, p.end_date, now),
        price: moneyText(p.amount, currency),
      });
    }
    const last = dayEnd(phases[phases.length - 1].end_date, tz);
    if (last < end - EDGE) {
      segments.push({ from: last, to: end, name: 'After the last price', dates: '', price: moneyText(config.fee_amount, currency) });
    }
  }

  const todayIn = now >= start && now <= end;
  const before = now < start;
  const daysTo = Math.ceil((start - now) / DAY);
  const status = before
    ? `Opens in ${daysTo} ${daysTo === 1 ? 'day' : 'days'}`
    : !openEnded && now > end ? 'The window has closed' : null;

  const startLabel = config.applications_open_at ? dateAndTime(config.applications_open_at, now)
    : phases[0] ? shortDate(phases[0].start_date, now) : 'When you switch it on';
  const endLabel = openEnded ? 'Until you switch it off'
    : config.applications_close_at ? dateAndTime(config.applications_close_at, now)
    : shortDate(phases[phases.length - 1].end_date, now);
  const aria = `Applications ${openMs !== null ? `open ${startLabel}` : 'open when switched on'}, ${openEnded ? 'with no closing date' : `close ${endLabel}`}. ${segments.filter(s => s.price).map(s => `${s.name}: ${s.price}`).join(', ')}`;

  return (
    <div style={{ fontFamily: F }}>
      {status && (
        <p className="mb-2" style={{ fontSize: 13.5, fontWeight: 600, color: before ? AMBER : INK_SOFT }}>{status}</p>
      )}
      <div className="relative" style={{ paddingTop: todayIn ? 22 : 0 }}>
        <div
          role="img"
          aria-label={aria}
          className="relative w-full overflow-hidden"
          style={{
            height: compact ? 12 : 16, borderRadius: 999, backgroundColor: '#EDE7D8',
            // An open-ended window fades out instead of pretending to end.
            WebkitMaskImage: openEnded ? 'linear-gradient(90deg, #000 80%, transparent)' : undefined,
            maskImage: openEnded ? 'linear-gradient(90deg, #000 80%, transparent)' : undefined,
          }}
        >
          {segments.map((s, i) => {
            const current = now >= s.from && now < s.to;
            return (
              <span
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${pct(s.from)}%`, width: `${Math.max(0.6, pct(s.to) - pct(s.from))}%`,
                  backgroundColor: current && segments.length > 1 ? CURRENT : SEGMENT_COLOURS[i % SEGMENT_COLOURS.length],
                  boxShadow: i > 0 ? 'inset 2px 0 0 #FFFFFF' : undefined,
                }}
              />
            );
          })}
        </div>
        {todayIn && (
          <span
            aria-hidden
            className="absolute flex flex-col items-center"
            style={{ top: 0, left: `${pct(now)}%`, transform: 'translateX(-50%)' }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: INK, lineHeight: 1, whiteSpace: 'nowrap' }}>Today</span>
            <span style={{ width: 2, height: compact ? 24 : 28, marginTop: 4, backgroundColor: INK, borderRadius: 2 }} />
          </span>
        )}
      </div>
      <div className="flex justify-between gap-3 mt-2" style={{ fontSize: 12.5, color: INK_SOFT }}>
        <span style={{ overflowWrap: 'anywhere' }}>{startLabel}</span>
        <span className="text-right" style={{ overflowWrap: 'anywhere' }}>{endLabel}</span>
      </div>

      {!compact && segments.some(s => s.price) && (
        <ul className="mt-3 flex flex-col gap-1.5" style={{ fontSize: 13.5, color: INK }}>
          {segments.map((s, i) => {
            const current = now >= s.from && now < s.to;
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="flex-shrink-0"
                  style={{ width: 12, height: 12, borderRadius: 4, marginTop: 3, backgroundColor: current && segments.length > 1 ? CURRENT : SEGMENT_COLOURS[i % SEGMENT_COLOURS.length] }}
                />
                <span className="min-w-0" style={{ lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  <b style={{ fontWeight: 700 }}>{s.price}</b>
                  <span style={{ color: INK_SOFT }}>
                    {' · '}{s.name}{s.dates ? `, ${s.dates}` : ''}
                  </span>
                  {current && segments.length > 1 && (
                    <span style={{ color: FOREST, fontWeight: 600 }}>{' · '}Today</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
