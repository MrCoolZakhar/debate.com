// Several roles per person (owner, 9 Nov 2026; YCMUN). A person may apply to
// several roles at one conference; accepting one drops their other
// applications under review (the database: guard_application_write, triggers
// aa_one_role_guard and zz_one_role_drop_others). Team roles combine with each
// other; participant roles combine with nothing. The database is the truth;
// this mirrors it for what the pages show.

export const TEAM_ROLES_COMBINE = new Set(['chair', 'secretariat', 'staff']);
/** Roles that take a Gavelling credit (one per person per conference). */
export const CHARGED_ROLES = new Set(['delegate', 'head-delegate', 'faculty-advisor', 'observer']);
/** An application that holds the role (accepted onwards). */
export const HOLDING_STATUSES = new Set(['accepted', 'assigned', 'checked-in']);
/** An application that is live (under review or holding). */
export const LIVE_STATUSES = new Set(['submitted', 'accepted', 'assigned', 'checked-in']);

/** Can one person hold both roles at one conference? */
export function rolesCombine(a: string, b: string): boolean {
  return TEAM_ROLES_COMBINE.has(a) && TEAM_ROLES_COMBINE.has(b);
}

const WORD: Record<string, string> = {
  delegate: 'delegate', 'head-delegate': 'head delegate', 'faculty-advisor': 'faculty advisor',
  observer: 'observer', chair: 'chair', secretariat: 'secretariat member', staff: 'staff member',
};

/** "a delegate", "an observer", for sentences. */
export function roleWithArticle(role: string): string {
  const w = WORD[role] ?? role.replace(/-/g, ' ');
  return `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
}
