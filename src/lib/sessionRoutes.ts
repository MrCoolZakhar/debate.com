/**
 * Which routes belong to Gavelling Sessions (the free, anonymous committee
 * runtime). Only these honour the stored language preference and show a
 * language picker; every conferences-side surface renders English (owner,
 * 18 Sep 2026: "remove the languages feature in Gavelling Conferences, just
 * in sessions"). The preference itself is never wiped.
 */
const SESSION_PREFIXES = ['/create', '/join', '/chair', '/delegate', '/advisor', '/voting', '/sessions'];

export function isSessionsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SESSION_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
