'use client';

// Choosing a chair's display title (src/lib/chairTitles.ts). Two shapes:
//  - ChairTitleChips: a small optional choice in an invite form.
//  - ChairTitleSelect: a compact select beside a chair row in an editor.
// Titles are labels only; nothing here grants or checks a permission.

import { CHAIR_TITLE_OPTIONS, type ChairTitle } from '@/lib/chairTitles';

const FONT = "'Outfit', sans-serif";

export function ChairTitleChips({
  value,
  onChange,
  disabled,
}: {
  value: ChairTitle | null;
  onChange: (v: ChairTitle | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Title on the dais (optional)" className="flex flex-wrap gap-1.5">
      {CHAIR_TITLE_OPTIONS.map(o => {
        const on = (value ?? '') === o.value;
        return (
          <button
            key={o.value || 'none'}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value || null)}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{
              fontFamily: FONT,
              backgroundColor: on ? '#1B3828' : 'rgba(237,231,216,0.5)',
              color: on ? '#EED98A' : '#4A3F33',
              boxShadow: on ? 'none' : 'inset 0 0 0 1px #DDD4C0',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChairTitleSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string | null | undefined;
  onChange: (v: ChairTitle | null) => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Title for Ana Pérez". */
  label: string;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange((e.target.value || null) as ChairTitle | null)}
      onClick={e => e.stopPropagation()}
      className="rounded-md px-1.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
      style={{
        fontFamily: FONT,
        color: value ? '#1B3828' : '#6B5F52',
        backgroundColor: 'rgba(237,231,216,0.5)',
        border: '1px solid #DDD4C0',
        cursor: disabled ? 'default' : 'pointer',
        maxWidth: 118,
      }}
    >
      {CHAIR_TITLE_OPTIONS.map(o => (
        <option key={o.value || 'none'} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
