/**
 * Per-reader chair-console sidebar width.
 *
 * WHY THE KEY CARRIES AN IDENTITY
 * This deliberately copies the shape of `src/lib/chatReadKey.ts`. That module
 * exists because a shared, identity-free key (`chat-read-${code}`) let two
 * chairs sharing one dais laptop overwrite each other's state. A sidebar width
 * has exactly the same hazard and exactly the same fix: the co-chair who likes
 * the roster narrow must not silently resize it for the head chair sitting
 * beside them on the same browser.
 *
 * WHY IT IS *NOT* KEYED BY COMMITTEE CODE
 * Unlike read counts — which are meaningless outside one committee's message
 * history — a width is a preference about this person's eyes and this person's
 * screen. Keying it per committee would make a chair re-drag the divider in
 * every new session. So the key is `role:identity` only, and the preference
 * follows the chair from committee to committee.
 *
 * There is no legacy key to migrate: nothing has ever persisted this before.
 *
 * ── The clamp ─────────────────────────────────────────────────────────────
 * MIN is derived, not guessed. The narrowest useful sidebar is the one where a
 * roster row still fits its flag at full size, and it is measured from the
 * real CSS of that row (RollCallPanel.tsx):
 *
 *   list container  px-2                              16
 *   row             px-3                              24
 *   FlagCircle      size="sm" → w-9                   36   ← the flag itself
 *   gap-2.5                                           10
 *   country name    minimum legible run                64
 *   gap-2.5                                           10
 *   observer toggle p-1 + 15px Megaphone              23
 *   gap-2.5                                           10
 *   StatusSlider    w-[90px] + 1.5px borders          93
 *                                                   ────
 *                                                    286  → MIN 288
 *
 * At 288 the flag disc is still its full 36px (the flag image is 85% of that,
 * ~31px) — legible, not shrunk. Below it the disc is the first thing the row
 * would have to give up, which is exactly the floor the owner asked for.
 *
 * MAX is DEFAULT x 1.2 ("only about 20% larger"), rounded to a whole pixel.
 */

export const SIDEBAR_DEFAULT_WIDTH = 352; // the historical w-[22rem]
export const SIDEBAR_MIN_WIDTH = 288;
export const SIDEBAR_MAX_WIDTH = Math.round(SIDEBAR_DEFAULT_WIDTH * 1.2); // 422

/**
 * Collapsed: the sidebar folds to a floating column of round flags (the queue in order)
 * under the committee emblem, with no panel behind it. This is its layout width.
 */
export const SIDEBAR_RAIL_WIDTH = 64;

/**
 * Dragging the divider narrower than MIN previews the fold (the panel slides away under
 * the pointer); released below this width it collapses, above it it snaps back to MIN.
 * Dragging out from the collapsed column past it expands. Halfway between the rail and MIN.
 */
export const SIDEBAR_COLLAPSE_AT = Math.round((SIDEBAR_RAIL_WIDTH + SIDEBAR_MIN_WIDTH) / 2); // 176

/** Collapse / expand animation length. Reduced motion = instant. */
export const SIDEBAR_ANIM_MS = 240;

/** Arrow-key step on the focused separator. */
export const SIDEBAR_KEY_STEP = 16;

export type SidebarReaderRole = 'chair' | 'delegate';

export interface SidebarReader {
  role: SidebarReaderRole;
  /** myChairName for a chair, country for a delegate. May be empty. */
  identity: string | null | undefined;
}

/** Readers with no identity yet (chair joined without ?chairName=) share one bucket. */
const ANONYMOUS = '~anon';

export function clampSidebarWidth(px: number): number {
  if (!Number.isFinite(px)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(px)));
}

/**
 * Role is part of the key for the same reason it is in the chat-read key: a
 * chair may legitimately be named "France" while a delegate represents France.
 */
export function sidebarWidthStorageKey(reader: SidebarReader): string {
  const identity = (reader.identity ?? '').trim();
  return `gavelling-sidebar-width-${reader.role}:${identity || ANONYMOUS}`;
}

export function loadSidebarWidth(reader: SidebarReader): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sidebarWidthStorageKey(reader));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clampSidebarWidth(n) : null;
  } catch {
    return null;
  }
}

export function saveSidebarWidth(reader: SidebarReader, width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(sidebarWidthStorageKey(reader), String(clampSidebarWidth(width)));
  } catch {}
}

// ── Collapsed ────────────────────────────────────────────────────────────────
// Whether the chair folded the sidebar away to its slim rail. Same reader key shape as
// the width, for the same reason: two chairs on one dais laptop keep their own layout.

export function sidebarCollapsedStorageKey(reader: SidebarReader): string {
  const identity = (reader.identity ?? '').trim();
  return `gavelling-sidebar-collapsed-${reader.role}:${identity || ANONYMOUS}`;
}

export function loadSidebarCollapsed(reader: SidebarReader): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sidebarCollapsedStorageKey(reader));
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

export function saveSidebarCollapsed(reader: SidebarReader, collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(sidebarCollapsedStorageKey(reader), collapsed ? '1' : '0');
  } catch {}
}
