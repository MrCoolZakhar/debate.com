// Chair names and seat names must never be equal (incident RAAGKK, 10 Oct 2026).
// Chat identifies a chair by NAME (src/lib/chatConversations.ts), so a chair called
// "Backroomer 2" in a room that also has a seat "Backroomer 2" made that seat vanish from
// every delegate's chat list. These helpers are the one client-side rule for it.

export function normSeatName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/** Set of normalised seat names (delegate countries) in a room. Build once per call. */
export function seatNameSet(seats: Iterable<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const s of seats) { const n = normSeatName(s); if (n) out.add(n); }
  return out;
}

/** Names the chat uses as keys or markers: never a chair name. */
export function isReservedChairName(name: string): boolean {
  const n = normSeatName(name);
  return n === 'chairs' || n === 'everyone' || n.startsWith('__') || n.startsWith('group:');
}

export type ChairNameProblem = 'seat' | 'reserved' | null;

/** Why a NEW chair name typed by a person cannot be used, or null when it can. */
export function chairNameProblem(name: string, seats: Iterable<string | null | undefined>): ChairNameProblem {
  if (isReservedChairName(name)) return 'reserved';
  return seatNameSet(seats).has(normSeatName(name)) ? 'seat' : null;
}

/**
 * For names nobody typed (a profile display name): if it equals a seat or a reserved word,
 * append " (chair)", then " (chair 2)", ... until it is free. Deterministic, so the same
 * person always gets the same dais name in the same room.
 */
export function safeChairName(name: string, seats: Iterable<string | null | undefined>): string {
  const base = name.trim();
  const set = seatNameSet(seats);
  const bad = (n: string) => isReservedChairName(n) || set.has(normSeatName(n));
  if (!bad(base)) return base;
  let candidate = `${base} (chair)`;
  for (let i = 2; bad(candidate) && i < 50; i++) candidate = `${base} (chair ${i})`;
  return candidate;
}

/** Chair names that are not also a seat: delegations win (chat defence in depth). */
export function chairNamesExcludingSeats(chairNames: string[], seats: Iterable<string | null | undefined> | undefined): string[] {
  if (!seats) return chairNames;
  const set = seatNameSet(seats);
  if (set.size === 0) return chairNames;
  return chairNames.filter((c) => !set.has(normSeatName(c)));
}
