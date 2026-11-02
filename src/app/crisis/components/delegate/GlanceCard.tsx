'use client';
// Gavelling Crisis: the delegate's "quick glance" card, beside the speakers list. Three big, readable facts and nothing else:
// the in-world date and time, whether directives are open or paused (for the whole crisis or for this cabinet, with the pause note),
// and the cooldown left before the next directive can be sent, if there is one.

import { useEffect, useState } from 'react';
import { CalendarClock, PauseCircle, PlayCircle, Timer } from 'lucide-react';
import { Card, CK } from '../../crisisKit';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The scenario date as a big time and a small date ("14:00" over "Mon 3 Nov 2026"), read like scenarioLabel does. */
function scenarioParts(iso: string | null | undefined): { time: string; date: string } | null {
  if (!iso) return null;
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  if (!y) return null;
  const when = new Date(Date.UTC(y, (m || 1) - 1, day || 1));
  return { time: (t ?? '').slice(0, 5), date: `${DOW[when.getUTCDay()]} ${day} ${MON[when.getUTCMonth()]} ${y}` };
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function GlanceCard({ scenarioAt, crisisOpen, cabinetOpen, pausedNote, cooldownUntil }: {
  scenarioAt: string | null;
  /** Directives are open for the whole crisis. */
  crisisOpen: boolean;
  /** Directives are open for this delegate's cabinet. */
  cabinetOpen: boolean;
  pausedNote: string | null;
  /** When the cooldown before the next directive ends (ms), or null. */
  cooldownUntil: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (cooldownUntil === null) return undefined;
    const tick = () => setNow(Date.now());
    const t0 = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 500);
    return () => { window.clearTimeout(t0); window.clearInterval(id); };
  }, [cooldownUntil]);
  const left = cooldownUntil === null ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const when = scenarioParts(scenarioAt);
  const open = crisisOpen && cabinetOpen;
  const scope = !crisisOpen ? 'Paused for everyone' : 'Paused for your cabinet';

  return (
    <Card style={{ padding: '10px 12px 12px', height: '100%' }}>
      <section aria-label="At a glance" className="grid" style={{ gap: 10 }}>
        <div>
          <p className="flex items-center" style={{ margin: 0, gap: 5, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
            <CalendarClock size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />In the crisis now
          </p>
          {when ? (
            <>
              <b style={{ display: 'block', marginTop: 1, fontSize: 26, lineHeight: 1.1, fontWeight: 800, color: CK.ink, fontVariantNumeric: 'tabular-nums' }}>{when.time || when.date}</b>
              {when.time && <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>{when.date}</span>}
            </>
          ) : (
            <b style={{ display: 'block', marginTop: 1, fontSize: 16, fontWeight: 800, color: CK.inkSoft }}>Not set</b>
          )}
        </div>
        <div style={{ paddingTop: 9, boxShadow: `inset 0 1px 0 ${CK.hair}` }}>
          <p className="flex items-center" style={{ margin: 0, gap: 5, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>Directives</p>
          <b className="flex items-center" style={{ marginTop: 1, gap: 6, fontSize: 21, lineHeight: 1.15, fontWeight: 800, color: open ? CK.ok : CK.goldDeep }}>
            {open ? <PlayCircle size={22} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} /> : <PauseCircle size={22} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />}
            {open ? 'Open' : 'Paused'}
          </b>
          {!open && <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>{scope}</span>}
          {!open && pausedNote && <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{pausedNote}</span>}
        </div>
        {left > 0 && (
          <div style={{ paddingTop: 9, boxShadow: `inset 0 1px 0 ${CK.hair}` }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>Next directive in</p>
            <b className="flex items-center" style={{ marginTop: 1, gap: 6, fontSize: 21, lineHeight: 1.15, fontWeight: 800, color: CK.red, fontVariantNumeric: 'tabular-nums' }}>
              <Timer size={20} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />{clock(left)}
            </b>
          </div>
        )}
      </section>
    </Card>
  );
}
