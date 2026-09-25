/**
 * Which routes belong to Gavelling Sessions (the free, anonymous committee
 * runtime). Only these honour the stored language preference and show a
 * language picker; every conferences-side surface renders English (owner,
 * 18 Sep 2026: "remove the languages feature in Gavelling Conferences, just
 * in sessions"). The preference itself is never wiped.
 */
// /create itself is the site's chooser page (a committee or a conference,
// 25 Sep 2026); the session creator lives at /create/sessions.
const SESSION_PREFIXES = ['/create/sessions', '/join', '/chair', '/delegate', '/advisor', '/voting', '/sessions'];

export function isSessionsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SESSION_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
