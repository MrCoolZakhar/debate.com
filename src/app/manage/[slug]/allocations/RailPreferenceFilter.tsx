'use client';

// The unassigned rail's committee filter (owner, 21 Oct 2026): with twenty
// committees the organiser fills one room at a time, so the rail can narrow to
// the people who asked for that room. "Asked for" = any of their preferences
// names the committee; "No preference" is everyone who gave none.

import GSelect, { type GSelectOption } from '@/components/GSelect';

export type RailFilter = 'all' | 'none' | `c:${string}`;

interface PrefLike { conference_committee_id: string | null | undefined }

export function matchesRailFilter(prefs: readonly PrefLike[] | null | undefined, filter: RailFilter): boolean {
  if (filter === 'all') return true;
  const list = prefs ?? [];
  if (filter === 'none') return list.length === 0;
  const id = filter.slice(2);
  return list.some(p => p.conference_committee_id === id);
}

export function RailPreferenceFilter({
  value, onChange, committees,
}: {
  value: RailFilter;
  onChange: (v: RailFilter) => void;
  /** Already in the board's display order; `label` is the short name. */
  committees: { id: string; label: string; full: string }[];
}) {
  // Every committee is offered. Two committees can share a short name (a live
  // conference has "GA/UNGA" for both UN General Assembly and Junior General
  // Assembly): the list shows each full name under its short one, and once one
  // of those is picked its full name sits under the field too (CLAUDE.md
  // design rule 11: two rows, never an ellipsis).
  const labelCount = new Map<string, number>();
  for (const c of committees) labelCount.set(c.label, (labelCount.get(c.label) ?? 0) + 1);
  const options: GSelectOption<RailFilter>[] = [
    { value: 'all', label: 'Every committee' },
    ...committees.map(c => ({ value: `c:${c.id}` as RailFilter, label: `Asked for ${c.label}`, hint: c.full !== c.label ? c.full : undefined })),
    { value: 'none', label: 'No preference given' },
  ];
  const picked = value.startsWith('c:') ? committees.find(c => `c:${c.id}` === value) : undefined;
  const pickedShared = !!picked && (labelCount.get(picked.label) ?? 0) > 1 && picked.full !== picked.label;
  return (
    <div className="flex flex-col gap-1">
      <GSelect<RailFilter>
        value={value}
        onChange={onChange}
        options={options}
        size="sm"
        searchable={committees.length > 8}
        searchPlaceholder="Find a committee"
        aria-label="Filter by committee preference"
        className="w-full"
      />
      {pickedShared && (
        <p className="[overflow-wrap:anywhere]" style={{ margin: 0, padding: '0 4px', fontFamily: 'var(--font-brand), sans-serif', fontSize: 12, lineHeight: 1.4, color: '#5A4E42' }}>
          {picked.full}
        </p>
      )}
    </div>
  );
}
