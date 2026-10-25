'use client';
// Gavelling Crisis: the status that matters, always in view. The red gradient strip of the Crisis Director,
// for the delegate: who they are (picture and name), the in-world date and time, and whether directives
// are open or paused (with the pause note). Sticky under the top bar.

import { CalendarClock, PauseCircle, PlayCircle } from 'lucide-react';
import type { Character, Crisis } from '@/lib/crisis/types';
import { Avatar, CK, scenarioLabel } from '../../crisisKit';

export default function StatusStrip({ crisis, me, color }: { crisis: Crisis; me: Pick<Character, 'name' | 'title' | 'picture_url'> | null; color: string }) {
  const open = crisis.directives_open;
  return (
    <div
      role="group"
      aria-label="Crisis status"
      className="sticky"
      style={{
        top: 60, zIndex: 20, marginBottom: 14, background: CK.redGrad, color: '#FFF4E6', borderRadius: 20, boxShadow: CK.redShadow,
        padding: '10px 16px', fontFamily: CK.font,
      }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: '8px 22px' }}>
        <div className="flex items-center min-w-0" style={{ gap: 10, flex: '1 1 220px' }}>
          {me && <Avatar name={me.name} src={me.picture_url} size={34} color={color} style={{ boxShadow: `0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px ${color}` }} />}
          <div className="min-w-0">
            <b style={{ display: 'block', fontSize: 16, lineHeight: 1.2, fontWeight: 800, overflowWrap: 'anywhere' }}>{me?.name ?? crisis.name}</b>
            {me?.title && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,232,214,0.78)', overflowWrap: 'anywhere' }}>{me.title}</span>}
          </div>
        </div>
        <span className="inline-flex items-center" style={{ gap: 7, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          <CalendarClock size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, color: CK.gold }} />
          {scenarioLabel(crisis.scenario_at)}
        </span>
        <span className="inline-flex items-center" style={{ gap: 7, fontSize: 15, fontWeight: 800 }}>
          {open
            ? <PlayCircle size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, color: '#6BCB8B' }} />
            : <PauseCircle size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, color: CK.gold }} />}
          {open ? 'Directives are open' : 'Directives are paused'}
        </span>
      </div>
      {!open && crisis.directives_paused_note && (
        <p style={{ margin: '6px 0 0', fontSize: 13.5, fontWeight: 600, color: CK.gold, overflowWrap: 'anywhere' }}>{crisis.directives_paused_note}</p>
      )}
    </div>
  );
}
