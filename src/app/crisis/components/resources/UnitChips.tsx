'use client';
// Gavelling Crisis: quick picks for a resource's measure (the unit it is counted in). Typing any other measure still works.

import { CK } from '../../crisisKit';

const COMMON = ['ships', 'troops', 'tonnes', '$bn', '%'] as const;

export function UnitChips({ value, onPick }: { value: string; onPick: (unit: string) => void }) {
  return (
    <span className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
      {COMMON.map((u) => {
        const on = value.trim() === u;
        return (
          <button
            key={u}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? '' : u)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
            style={{
              border: 0, cursor: 'pointer', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, fontFamily: CK.font,
              background: on ? CK.greenBtn : CK.well, color: on ? '#fff' : CK.inkSoft,
            }}
          >
            {u}
          </button>
        );
      })}
    </span>
  );
}
