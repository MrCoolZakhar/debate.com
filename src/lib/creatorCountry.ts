// The country a standalone session is created from, for the staff board's
// origin figures (committees.creator_country, owner 21 Oct 2026).
//
// The ONLY source is our own /api/geo, which reads Vercel's edge header
// (x-vercel-ip-country). No third-party lookup, no IP and no city stored: just
// the ISO 3166-1 alpha-2 code, uppercase. In local dev the header is absent and
// the answer is null, so the room is created without an origin.
//
// /create/sessions starts the request when the page opens
// (`prefetchCreatorCountry`), so by the time someone presses Start it has long
// answered. `createCommittee` waits for it at most CREATOR_COUNTRY_WAIT_MS and
// otherwise inserts without it: creation is never blocked by this.

export const CREATOR_COUNTRY_WAIT_MS = 1500;

let pending: Promise<string | null> | null = null;

/** Start (once per page load) the /api/geo read. Never throws. */
export function prefetchCreatorCountry(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (pending) return pending;
  pending = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch('/api/geo', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      const cc = typeof data?.countryCode === 'string' ? data.countryCode.trim().toUpperCase() : '';
      // Two letters only; 'XX' would mean unknown.
      return /^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? cc : null;
    } catch {
      return null;
    }
  })();
  return pending;
}

/** The creator's country if it is known within `ms`, else null. Never throws. */
export function creatorCountryWithin(ms = CREATOR_COUNTRY_WAIT_MS): Promise<string | null> {
  return Promise.race([
    prefetchCreatorCountry(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
