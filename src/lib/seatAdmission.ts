/**
 * Seat admission: "Join without approval: Blocked" means EVERY join waits for a chair
 * (owner, 17 Oct 2026: "this should be everytime they try to join"). It used to gate only
 * an ABSENT delegation, so a phone taking a seat roll call had already marked Present
 * walked straight in.
 *
 * What a "join" is: this tab opening the delegate page for a seat, from the join page, a
 * live-room link or a typed URL. A RELOAD of the delegate page itself is not a new join, so
 * an approved phone that reloads stays in. The approval for this tab and seat is kept in
 * sessionStorage, and the page throws it away on any load that was not a reload of the
 * delegate page (`isReloadOfThisPage`).
 *
 * The request is the existing `join-request` motion, inserted with an id chosen here so this
 * device can follow ITS request. The chair answers by setting the row's status to
 * 'approved' or 'denied' (every motion read filters on status 'pending', so the row leaves
 * every list at once). A row that is simply gone was answered by an older chair bundle or by
 * Roll Call: the delegation's attendance then decides (present = approved).
 *
 * Client only, no schema change: `motions.status` is free text and the chair already holds
 * UPDATE on motions (sess_upd). Like every session gate this is a courtesy, not a security
 * boundary: session writes are still checked only against the session code.
 */

export type AdmissionRecord =
  | { state: 'admitted'; at: number }
  | { state: 'pending'; id: string; desired: 'present' | 'present-voting'; at: number };

const PREFIX = 'gavelling-seat-admission:';

function key(code: string, country: string): string {
  return `${PREFIX}${code.toUpperCase()}:${country.trim().toLowerCase()}`;
}

export function readAdmission(code: string, country: string): AdmissionRecord | null {
  if (typeof window === 'undefined' || !country) return null;
  try {
    const raw = window.sessionStorage.getItem(key(code, country));
    if (!raw) return null;
    const v = JSON.parse(raw) as AdmissionRecord;
    if (v?.state === 'admitted') return v;
    if (v?.state === 'pending' && typeof v.id === 'string') return v;
    return null;
  } catch { return null; }
}

export function writeAdmission(code: string, country: string, rec: AdmissionRecord): void {
  if (typeof window === 'undefined' || !country) return;
  try { window.sessionStorage.setItem(key(code, country), JSON.stringify(rec)); } catch { /* private mode */ }
}

export function clearAdmission(code: string, country: string): void {
  if (typeof window === 'undefined' || !country) return;
  try { window.sessionStorage.removeItem(key(code, country)); } catch { /* private mode */ }
}

/** True when the document was loaded by reloading THIS page (the delegate URL). A client
 *  navigation from /join or a live-room link reports the original document's entry, whose
 *  path is not this one, and a fresh open reports 'navigate': both are a new join. */
export function isReloadOfThisPage(): boolean {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav || nav.type !== 'reload') return false;
    return new URL(nav.name).pathname === window.location.pathname;
  } catch { return false; }
}

/** The admission this mount starts with: kept only across a reload of this page. */
export function initialAdmission(code: string, country: string): AdmissionRecord | null {
  if (!country) return null;
  if (!isReloadOfThisPage()) { clearAdmission(code, country); return null; }
  return readAdmission(code, country);
}

export function newRequestId(): string {
  try { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID(); } catch { /* fall through */ }
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}
