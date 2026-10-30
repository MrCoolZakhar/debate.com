'use client';
// Gavelling Crisis: the previous / next buttons and the place in the queue ("3 of 12") in the top band of an
// opened directive. Shown only when the caller passed a queue to move through.

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DirectiveNav({ index, total, onPrev, onNext }: { index: number; total: number; onPrev: () => void; onNext: () => void }) {
  if (total < 2) return null;
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

export default DirectiveNav;
