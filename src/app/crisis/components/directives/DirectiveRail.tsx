'use client';
// Gavelling Crisis: the rail of the one-by-one directive reader. The directive in front is read big in
// the pop-up; the other directives of the same queue wait here on the right, smaller and a little
// blurred, like a stack, and the nearer to the front the sharper. Clicking one brings it to the front.
// Presentation only: it reads the queue it is given and writes nothing.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dirNumber } from '@/lib/crisis/format';
import type { Directive } from '@/lib/crisis/types';
import { Avatar, CK } from '../../crisisKit';
import { NumberBadge, shortName } from './directiveParts';
import { authorName, type Names } from './directiveKit';

/** The previous / next buttons and the place in the queue, for the pop-up's top band. */
export function DirectiveNav({ index, total, onPrev, onNext }: { index: number; total: number; onPrev: () => void; onNext: () => void }) {
  if (total < 2 && !(total === 1 && index < 0)) return null;
  const btn = {
    width: 32, height: 32, borderRadius: '50%', border: 0, background: 'rgba(255,244,230,0.18)', color: '#FFF4E6', flex: 'none', cursor: 'pointer',
  } as const;
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }} role="group" aria-label="Move between directives">
      <button type="button" onClick={onPrev} aria-label="Previous directive" title="Previous directive (left arrow)"
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.94] transition-transform" style={btn}>
        <ChevronLeft size={18} strokeWidth={1.6} />
      </button>
      {index >= 0 && (
        <span style={{ fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,244,230,0.92)', whiteSpace: 'nowrap' }}>{index + 1} of {total}</span>
      )}
      <button type="button" onClick={onNext} aria-label="Next directive" title="Next directive (right arrow)"
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.94] transition-transform" style={btn}>
        <ChevronRight size={18} strokeWidth={1.6} />
      </button>
    </span>
  );
}

export default function DirectiveRail({ items, names, onPick }: { items: Directive[]; names: Names; onPick: (d: Directive) => void }) {
  if (items.length === 0) return null;
  return (
    <nav className="dp-rail" aria-label="Other directives in this queue">
      <p style={{ margin: '0 4px 8px', fontSize: 12.5, fontWeight: 800, color: 'rgba(255,244,230,0.92)' }}>Up next</p>
      <ul className="dp-rail-list" style={{ listStyle: 'none', margin: 0, padding: '10px 2px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((d, i) => {
          const who = authorName(d, names);
          const ch = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
          const cab = d.cabinet_id ? names.cabinets.get(d.cabinet_id) : undefined;
          const depth = Math.min(i, 5);
          return (
            <li key={d.id} style={{ position: 'relative' }}>
              <NumberBadge n={dirNumber(d)} color={cab?.color ?? CK.red} style={{ position: 'absolute', zIndex: 2, top: -9, left: 10 }} />
              <button
                type="button"
                onClick={() => onPick(d)}
                aria-label={`Read directive No. ${dirNumber(d)}: ${d.title}`}
                className="dp-rail-card focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ ['--blur' as string]: `${(1 + depth * 0.4).toFixed(1)}px`, ['--fade' as string]: String(Math.max(0.55, 0.9 - depth * 0.07)) }}
              >
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, lineHeight: 1.25, color: CK.ink, overflowWrap: 'anywhere', textAlign: 'left' }}>{d.title}</span>
                <span className="flex items-center" style={{ gap: 6, marginTop: 7 }}>
                  <Avatar name={who} src={ch?.picture_url} size={22} color={cab?.color ?? CK.red} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: CK.inkSoft, overflowWrap: 'anywhere', textAlign: 'left', minWidth: 0 }}>{shortName(who)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
