// ── Nationality + date of birth carried through Google sign-up ─────────────────
//
// Google OAuth creates the auth user and its profiles row before we can ask
// anything, and people who then abandoned /auth/onboarding stayed blank for
// good (13 of 520 September signups, every one of them Google). So the sign-up
// page asks both BEFORE "Sign up with Google" and parks the confirmed answers
// here for the round trip.
//
// Why a cookie and not sessionStorage: the first thing that runs after Google
// is /auth/callback, a SERVER route, and it is the one place every OAuth return
// passes through. A first-party cookie reaches it (SameSite=Lax is sent on the
// top-level redirect back from Google); web storage would not. The cookie is
// not HttpOnly because the page sets it, and /auth/onboarding reads it as a
// fallback if the callback's write did not land.
//
// Rules, all enforced in `pendingBasicsFor` so the server and the client
// fallback apply the same ones:
//   • validated again on the way out (a real country from our list, age 13..120)
//   • only for an account CREATED AFTER the answers were given (60 s of clock
//     slack), so a returning user who pressed the sign-up button, or someone
//     else signing in on a shared computer, never inherits them
//   • 30-minute lifetime, cleared as soon as it has been used or refused
//   • callers only ever fill EMPTY columns

import { ageAt } from '@/lib/age';
import { getCountryByName } from '@/lib/countries';

export const PENDING_BASICS_COOKIE = 'gv_pending_basics';
export const PENDING_BASICS_TTL_S = 30 * 60;

export type PendingBasics = { nationality: string; dateOfBirth: string };

/** The same checks the e-mail sign-up form and the onboarding basics screen
 *  run. Returns the canonical country name, or the message to show. */
export function validateBasics(
  nationalityInput: string,
  dateOfBirth: string,
): { ok: true; value: PendingBasics } | { ok: false; error: string } {
  const country = getCountryByName(nationalityInput);
  if (!country) return { ok: false, error: 'Please choose your nationality from the list.' };
  if (!dateOfBirth) return { ok: false, error: 'Please enter your date of birth.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { ok: false, error: 'That date of birth does not look right. Please double-check it.' };
  }
  const age = ageAt(dateOfBirth);
  if (age === null || age < 0 || age > 120) {
    return { ok: false, error: 'That date of birth does not look right. Please double-check it.' };
  }
  if (age < 13) return { ok: false, error: 'You need to be at least 13 years old to create a Gavelling account.' };
  return { ok: true, value: { nationality: country.name, dateOfBirth } };
}

/** Parse a raw cookie value and decide whether it may be applied to an
 *  account created at `userCreatedAt`. Null = do not use it (and clear it). */
export function pendingBasicsFor(
  raw: string | null | undefined,
  userCreatedAt: string | null | undefined,
  now: number = Date.now(),
): PendingBasics | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const { n, d, t } = parsed as { n?: unknown; d?: unknown; t?: unknown };
  if (typeof n !== 'string' || typeof d !== 'string' || typeof t !== 'number') return null;
  if (now - t > PENDING_BASICS_TTL_S * 1000 || t - now > 60_000) return null;
  const created = userCreatedAt ? Date.parse(userCreatedAt) : NaN;
  if (!Number.isFinite(created) || created < t - 60_000) return null;
  const v = validateBasics(n, d);
  return v.ok ? v.value : null;
}

// ── Browser side ──────────────────────────────────────────────────────────────

function cookieAttrs(maxAge: number): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/** Park validated answers for the OAuth round trip. */
export function stashPendingBasics(value: PendingBasics): void {
  if (typeof document === 'undefined') return;
  const payload = encodeURIComponent(JSON.stringify({ n: value.nationality, d: value.dateOfBirth, t: Date.now() }));
  document.cookie = `${PENDING_BASICS_COOKIE}=${payload}${cookieAttrs(PENDING_BASICS_TTL_S)}`;
}

export function readPendingBasicsCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${PENDING_BASICS_COOKIE}=`));
  return hit ? hit.slice(PENDING_BASICS_COOKIE.length + 1) : null;
}

export function clearPendingBasics(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${PENDING_BASICS_COOKIE}=${cookieAttrs(0)}`;
}
