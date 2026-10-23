// ── A seat's party, carried into its live room (custom committees) ──────────
//
// Owner, 23 Oct 2026: party membership disappeared in custom-committee rooms. Most
// groups have a colour and a short name but no crest, so their seats showed initials.
// The room now carries each seat's group colour and short name on `delegates`
// (`group_color`, `group_short`, scratch-press-and-parties.sql section K1), seeded by
// `start_my_chair_session` and kept in step here by the committee editor.
//
// The columns may not exist yet. Every write here is a SEPARATE best-effort update,
// never part of the seat insert, so a database without them loses nothing: the
// update answers 42703 / PGRST204 and is skipped silently.

import type { SlotGroup } from './slotGroups';
import type { sessionClient } from './sessionClient';

export interface SeatGroupFacts { color: string | null; short: string | null }

const HEX = /^#[0-9a-f]{6}$/i;

/** What the room shows for a seat's party: null when it has none (or is not a custom seat). */
export function resolveSeatGroup(
  r: { groupId?: string | null },
  gs: SlotGroup[],
  isCustom: boolean,
): SeatGroupFacts | null {
  if (!isCustom || !r.groupId) return null;
  const g = gs.find((x) => x.id === r.groupId);
  if (!g) return null;
  const color = g.color && HEX.test(g.color.trim()) ? g.color.trim() : null;
  const short = (g.short_name ?? '').trim().slice(0, 12) || null;
  return color || short ? { color, short } : null;
}

const sameGroup = (a: SeatGroupFacts | null, b: SeatGroupFacts | null) =>
  (a?.color ?? null) === (b?.color ?? null) && (a?.short ?? null) === (b?.short ?? null);

/** Seats whose party (as the room shows it) differs between two snapshots. */
export function seatsWithMovedGroup<R extends { name: string; groupId?: string | null }>(
  before: Map<string, R>, after: R[], baseGroups: SlotGroup[], groups: SlotGroup[], isCustom: boolean,
): R[] {
  return after.filter((r) => {
    const b = before.get(r.name);
    const was = b ? resolveSeatGroup(b, baseGroups, isCustom) : null;
    return !sameGroup(was, resolveSeatGroup(r, groups, isCustom));
  });
}

function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return e.code === '42703' || e.code === 'PGRST204' || /group_(color|short)/i.test(e.message ?? '');
}

/**
 * Writes each seat's party onto the room, one update per (colour, short name).
 * 'missing' when the columns do not exist yet (nothing to do), 'failed' on a refusal.
 */
export async function syncSeatGroupsToRoom(
  client: ReturnType<typeof sessionClient>,
  sessionId: string,
  seats: { name: string; group: SeatGroupFacts | null }[],
): Promise<'ok' | 'missing' | 'failed'> {
  const byGroup = new Map<string, { group: SeatGroupFacts | null; names: string[] }>();
  for (const s of seats) {
    const k = `${s.group?.color ?? ''}|${s.group?.short ?? ''}`;
    const e = byGroup.get(k);
    if (e) e.names.push(s.name); else byGroup.set(k, { group: s.group, names: [s.name] });
  }
  let out: 'ok' | 'failed' = 'ok';
  for (const { group, names } of byGroup.values()) {
    if (names.length === 0) continue;
    const { error } = await client.from('delegates')
      .update({ group_color: group?.color ?? null, group_short: group?.short ?? null })
      .eq('committee_id', sessionId)
      .in('country', names);
    if (isMissingColumn(error)) return 'missing';
    if (error) { console.error('[seat-groups]', error); out = 'failed'; }
  }
  return out;
}
