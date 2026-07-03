// ── Age helpers ─────────────────────────────────────────────────────────────
// Age is always DERIVED from profiles.date_of_birth — never stored.

/**
 * Whole years between a date of birth and a reference date (defaults to today).
 * Accepts 'YYYY-MM-DD' strings for both. Returns null for missing/invalid input.
 */
export function ageAt(dateOfBirth: string | null | undefined, at?: string | Date): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth + (dateOfBirth.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(dob.getTime())) return null;
  const ref = at
    ? (typeof at === 'string' ? new Date(at + (at.length === 10 ? 'T00:00:00' : '')) : at)
    : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}
