// Chair TITLES: how a chair is labelled on the public conference page and in
// the organiser tools. Display only. A title grants no permission anywhere:
// every chair of a committee has exactly the same access, and the session
// gavel (Moderator / Commenter) is a separate, live thing that titles never
// touch.
//
// Storage (migration `chair_display_titles`):
//   - conference_chair_invites.title  (nullable; copied onto the dais on accept)
//   - conference_committees.chair_titles  jsonb {user_id: key}
//   - conference_committees.display_chairs[].title  (trigger-derived, public)
// The keys below must match `is_chair_title()` in the database.

export const CHAIR_TITLES = [
  { key: 'chair', label: 'Chair' },
  { key: 'vice-chair', label: 'Vice Chair' },
  { key: 'co-chair', label: 'Co-Chair' },
  { key: 'rapporteur', label: 'Rapporteur' },
] as const;

export type ChairTitle = (typeof CHAIR_TITLES)[number]['key'];

export function isChairTitle(v: unknown): v is ChairTitle {
  return typeof v === 'string' && CHAIR_TITLES.some(t => t.key === v);
}

/** The label for a stored title, or null when none is set (or it is unknown). */
export function chairTitleLabel(v: unknown): string | null {
  return CHAIR_TITLES.find(t => t.key === v)?.label ?? null;
}

/** Options for a <select>: "No title" first, then every title. */
export const CHAIR_TITLE_OPTIONS: { value: '' | ChairTitle; label: string }[] = [
  { value: '', label: 'No title' },
  ...CHAIR_TITLES.map(t => ({ value: t.key, label: t.label })),
];
