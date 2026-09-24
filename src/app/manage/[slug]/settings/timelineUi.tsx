'use client';

// timelineUi.tsx — the organiser side of "the application window and the fee
// phases are one timeline" (src/lib/roleTimeline.ts, and the database trigger
// enforce_role_config_timeline). Mounted by settings/page.tsx beside the
// role's window and its fee phases.
//
// Two pieces:
//   - timelineNotice(): the one line that says what moved after an edit
//     ("Applications now close 23 Sep at 23:59 UTC, when the Late price ends").
//   - TimelineWarning: a role saved before the rule existed can still disagree
//     with itself (MUNBU WS: the Late price ran to 23 Sep, applications closed
//     on the 22nd). It says so in plain words and offers the one-click fix.
//     Nothing is changed until the organiser presses it.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { FeePhase } from '@/lib/finance';
import { dayInZone, endOfDayIso, startOfDayIso, formatDay, ordinalDay } from '@/lib/applicationWindow';
import { normaliseRoleTimeline, lineUpPhases, type TimelineContext, type TimelineInput, type TimelineResult } from '@/lib/roleTimeline';
import { constraintMessage } from '@/lib/friendlyError';

const OUTFIT = "var(--font-brand), sans-serif";

/** conferences.timezone (null for every conference today, which means UTC).
 *  Not on the manage layout's conference columns, so read here once. */
export function useConferenceTimezone(conferenceId: string | null | undefined): string | null {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => {
    if (!conferenceId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('conferences').select('timezone').eq('id', conferenceId).maybeSingle();
      if (!cancelled) setTz(((data as { timezone?: string | null } | null)?.timezone) || null);
    })();
    return () => { cancelled = true; };
  }, [conferenceId]);
  return tz;
}

/** "23:59 UTC" / "23:59 Europe/Istanbul time" for the one-line notices. */
function zoneWords(tz: string | null): string {
  return tz ? `${tz} time` : 'UTC';
}

function priceName(p: FeePhase | null, fallback: 'first price' | 'last price' = 'last price'): string {
  return p?.label?.trim() ? `${p.label.trim()} price` : fallback;
}

/** One line for what the timeline rule moved, or '' when nothing moved. */
export function timelineNotice(result: TimelineResult, ctx: TimelineContext): string {
  if (!result.ok || result.changes.length === 0) return '';
  const tz = ctx.timeZone;
  const parts: string[] = [];
  if (result.changes.includes('close') && result.applications_close_at && result.last) {
    parts.push(`Applications now close ${formatDay(dayInZone(result.applications_close_at, tz))} at 23:59 ${zoneWords(tz)}, when the ${priceName(result.last)} ends.`);
  }
  if (result.changes.includes('open') && result.applications_open_at && result.first) {
    parts.push(`Applications now open ${formatDay(dayInZone(result.applications_open_at, tz))} at 00:00 ${zoneWords(tz)}, when the ${priceName(result.first, 'first price')} starts.`);
  }
  if (result.changes.includes('last_end') && result.last) {
    parts.push(`The ${priceName(result.last)} now ends ${formatDay(result.last.end_date)}, when applications close.`);
  }
  if (result.changes.includes('first_start') && result.first) {
    parts.push(`The ${priceName(result.first, 'first price')} now starts ${formatDay(result.first.start_date)}, when applications open.`);
  }
  return parts.join(' ');
}

export function TimelineNotice({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p
      role="status"
      className="text-xs rounded-lg px-3 py-2 mt-2"
      style={{ color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.18)', fontFamily: OUTFIT, lineHeight: 1.55 }}
    >
      {text}
    </p>
  );
}

/**
 * Shown when the role as it is stored breaks the timeline rule. `onFix` is
 * given the patch to save (the page routes it through its own save, so the
 * optimistic update, the rollback and the notice all apply).
 */
export function TimelineWarning({ config, roleLabel, ctx, onFix, busy }: {
  config: TimelineInput;
  roleLabel: string;
  ctx: TimelineContext;
  onFix: (patch: Partial<TimelineInput>) => void;
  busy?: boolean;
}) {
  const tz = ctx.timeZone;
  const res = normaliseRoleTimeline(config, { phases: true, open: true, close: true }, ctx);

  let text = '';
  let action: { label: string; note?: string; patch: Partial<TimelineInput> } | null = null;

  if (!res.ok) {
    text = constraintMessage(res.rule) ?? 'The application dates and the prices disagree.';
    if (res.rule === 'arc_timeline_phases_overlap' || res.rule === 'arc_timeline_phases_gap') {
      const lined = lineUpPhases(config.fee_phases ?? []);
      if (lined) {
        action = {
          label: 'Line the prices up',
          note: 'Each price will start the day after the previous one ends. Nothing else changes.',
          patch: { fee_phases: lined },
        };
      }
    }
  } else if (res.changes.length > 0 && res.last && res.first) {
    const closeDay = config.applications_close_at ? dayInZone(config.applications_close_at, tz) : null;
    const openDay = config.applications_open_at ? dayInZone(config.applications_open_at, tz) : null;
    const lastEnd = res.last.end_date;
    const firstStart = res.first.start_date;
    const who = roleLabel.toLowerCase().replace(/-/g, ' ');
    if (res.changes.includes('close')) {
      if (closeDay && lastEnd > closeDay) {
        text = `Your ${priceName(res.last)} runs to ${formatDay(lastEnd)} but applications close on ${formatDay(closeDay)}. ${plural(who)} cannot apply after the ${ordinalDay(closeDay)}.`;
      } else if (closeDay) {
        text = `Applications close on ${formatDay(closeDay)} but your ${priceName(res.last)} ends on ${formatDay(lastEnd)}. After that day no price covers the dates in between.`;
      } else {
        text = `Your prices end on ${formatDay(lastEnd)} but applications have no closing date.`;
      }
      action = {
        label: 'Close applications when the last price ends',
        note: `Sets the closing time to 23:59 ${zoneWords(tz)} on ${formatDay(lastEnd)}${tz ? '' : ', because no timezone is set for this conference'}.`,
        patch: { applications_close_at: endOfDayIso(lastEnd, tz) },
      };
    } else if (res.changes.includes('open')) {
      text = openDay
        ? `Applications open on ${formatDay(openDay)} but your first price starts on ${formatDay(firstStart)}.`
        : `Your first price starts on ${formatDay(firstStart)} but applications have no opening date.`;
      action = {
        label: 'Open applications when the first price starts',
        note: `Sets the opening time to 00:00 ${zoneWords(tz)} on ${formatDay(firstStart)}.`,
        patch: { applications_open_at: startOfDayIso(firstStart, tz) },
      };
    }
  }

  if (!text) return null;
  return (
    <div
      role="alert"
      className="rounded-lg px-3 py-2.5 mt-2"
      style={{ backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: OUTFIT }}
    >
      <p className="text-xs" style={{ color: '#8B2020', lineHeight: 1.55, textWrap: 'pretty' }}>{text}</p>
      {action && (
        <div className="mt-2 flex flex-wrap items-center" style={{ gap: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onFix(action!.patch)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: OUTFIT }}
          >
            {action.label}
          </button>
          {action.note && (
            <span className="text-[11px]" style={{ color: '#5A4E42', lineHeight: 1.5 }}>{action.note}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** "Delegates", "Head delegates", "Staff", "Secretariat members". */
function plural(role: string): string {
  const w = role === 'staff' ? 'staff' : role === 'secretariat' ? 'secretariat members' : `${role}s`;
  return w[0].toUpperCase() + w.slice(1);
}
