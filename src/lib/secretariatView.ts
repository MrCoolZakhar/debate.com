// ── The secretariat's silent view of a chair room ───────────────────────────
//
// Owner, 23 Oct 2026: the conference's organisers can enter any chair room of their
// conference "with no warning and silently". The live wall opens
// `/chair/<CODE>?secretariat=1`: no chair name, so the room's chair_names, presence,
// chat chair list and gavel never see it; the chair page forces it to a read-only
// Commenter (src/app/chair/[code]/page.tsx, `silentViewer`). Access is the ordinary
// conference check (an organiser of THIS conference passes useSessionAccess as
// 'organizer'); nothing here grants anything, and like isViewOnly it is a UI gate.

export const SECRETARIAT_VIEW_PARAM = 'secretariat';

/** The chair room of `code`, opened silently as the secretariat. */
export function secretariatRoomHref(code: string): string {
  return `/chair/${encodeURIComponent(code.toUpperCase())}?${SECRETARIAT_VIEW_PARAM}=1`;
}
