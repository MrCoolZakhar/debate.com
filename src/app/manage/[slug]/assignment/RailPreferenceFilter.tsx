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
  const options: GSelectOption<RailFilter>[] = [
    { value: 'all', label: 'Every committee' },
    ...committees.map(c => ({ value: `c:${c.id}` as RailFilter, label: `Asked for ${c.label}`, hint: c.full !== c.label ? c.full : undefined })),
    { value: 'none', label: 'No preference given' },
  ];
  return (
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
  );
}
