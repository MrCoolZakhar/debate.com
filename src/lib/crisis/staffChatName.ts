// Gavelling Crisis: the one chair-like name the crisis staff (Crisis Director, assistants, backroomers) chat under in a
// cabinet's committee room. It is added to the room's chair_names, so delegates' messages to the dais reach the staff.
// Command's "no chair" checks and the room card ignore it: it is not a presiding chair.

export const CRISIS_TEAM_NAME = 'Crisis Team';

/** True for "Crisis Team" and the "Crisis Team (chair)" form safeChairName gives it when a seat already has the name. */
export const isCrisisTeamName = (name: string | null | undefined): boolean => (name ?? '').trim().toLowerCase().startsWith('crisis team');
