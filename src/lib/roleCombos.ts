// One accepted role per person (owner, 16 Nov 2026; WorldMUN). Anyone may
// APPLY for another role while holding one. A person is ACCEPTED in only one
// role that does not combine: accepting the new role goes through
// accept_role_swap_check and accept_role_swap, which remove the old role
// completely (allocation, delegation, dais, team access, the old application)
// in one transaction. Team roles combine with each other; participant roles
// combine with nothing. The database is the truth; this mirrors it for what
// the pages show.

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

const TITLE: Record<string, string> = {
  delegate: 'Delegate', 'head-delegate': 'Head Delegate', 'faculty-advisor': 'Faculty Advisor',
  observer: 'Observer', chair: 'Chair', secretariat: 'Secretariat', staff: 'Staff',
};

/** "Delegate", "Head Delegate": a role's name as a title word. */
export function roleTitle(role: string): string {
  return TITLE[role] ?? role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** "You are a {Role} here. If you are accepted as {New role}, your {Role} place is removed." */
export function heldRoleSwapLine(held: string, applying: string): string {
  const h = roleTitle(held);
  const line = `You are ${/^[aeiou]/i.test(h) ? 'an' : 'a'} ${h} here. If you are accepted as ${roleTitle(applying)}, your ${h} place is removed.`;
  // A secretariat or staff member also leaves the organising team.
  return held === 'secretariat' || held === 'staff' ? `${line} You also lose your access to the organising team.` : line;
}
