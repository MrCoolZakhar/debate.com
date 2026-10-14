/**
 * The ONE rule for "this role's set-up needs fixing" (13 Oct 2026, owner: "flag
 * it with a 1 on Settings, a 1 on the Applications category, a 1 in the
 * application where the problem exists, and a 1 in whatever subcategory it
 * happened on").
 *
 * Only things the site lets people save today that must not be left that way:
 *   dates   a closing date with no opening date
 *   prices  a price-by-date stage missing its start or end date
 * An opening date with no closing date is NOT a problem: the database trigger
 * trg_role_config_autoclose fills the closing date.
 *
 * Read by the manage sidebar (Settings), the Settings tab strip
 * (Applications), the role row and the role pop-up (rail and section cards).
 * A blank stage PRICE is never stored (the pop-up refuses to save it), so it is
 * a flag of the open pop-up only and never counted here.
 */

export type RoleProblemSection = 'dates' | 'prices';

export interface RoleSetupProblem {
  section: RoleProblemSection;
  /** Stable per problem: 'open-date', or 'stage-dates:<index>'. */
  key: string;
  message: string;
}

/** The columns the rule reads, so any row shape with them fits. */
export interface RoleProblemInput {
  applications_open_at?: string | null;
  applications_close_at?: string | null;
  fee_phases?: { start_date?: string | null; end_date?: string | null }[] | null;
}

export const OPEN_DATE_MESSAGE = 'Add an opening date';
export const STAGE_DATES_MESSAGE = 'Give every price stage its dates';
/** The pop-up's own flag for a stage price left blank (never stored). */
export const STAGE_PRICE_MESSAGE = 'Add a price for this stage';

export function roleSetupProblems(cfg: RoleProblemInput | null | undefined): RoleSetupProblem[] {
  if (!cfg) return [];
  const out: RoleSetupProblem[] = [];
  if (cfg.applications_close_at && !cfg.applications_open_at) {
    out.push({ section: 'dates', key: 'open-date', message: OPEN_DATE_MESSAGE });
  }
  (cfg.fee_phases ?? []).forEach((p, i) => {
    if (!p || !p.start_date || !p.end_date) {
      out.push({ section: 'prices', key: `stage-dates:${i}`, message: STAGE_DATES_MESSAGE });
    }
  });
  return out;
}

/** Problems in one section of one role. */
export function sectionProblemCount(cfg: RoleProblemInput | null | undefined, section: RoleProblemSection): number {
  return roleSetupProblems(cfg).filter(p => p.section === section).length;
}

/**
 * The total over the roles the Applications tab lists. A role with a problem
 * has a date or a price stage, so it is always set up and listed, unless it was
 * taken off with "Remove this role" on this browser and is switched off.
 */
export function listedProblemCount(
  configs: (RoleProblemInput & { role: string; is_enabled?: boolean | null })[],
  removedRoles: readonly string[] = [],
): number {
  let n = 0;
  for (const c of configs) {
    if (removedRoles.includes(c.role) && !c.is_enabled) continue;
    n += roleSetupProblems(c).length;
  }
  return n;
}

/** "1 thing to fix" / "3 things to fix". */
export function fixLabel(n: number): string {
  return `${n} ${n === 1 ? 'thing' : 'things'} to fix`;
}

/** The badge's text: 9+ past nine. */
export function fixBadgeText(n: number): string {
  return n > 9 ? '9+' : String(n);
}

/** Fired after every role save, so the manage sidebar re-reads its count. */
export const SETTINGS_FLAGS_EVENT = 'gv-settings-flags-changed';

export function notifySettingsFlagsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_FLAGS_EVENT));
}
