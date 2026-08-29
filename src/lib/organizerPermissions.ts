// Single source of truth for what an organizer on a conference team is allowed
// to do, and for the three privilege bundles the Settings → Organizers tab
// offers. The section list and its icons deliberately mirror the manage
// sidebar (`src/app/manage/[slug]/layout.tsx`) one-for-one, so a permission
// chip is recognisable as the page it unlocks rather than as a bare word.
//
// WHERE EACH THING IS ENFORCED — read this before adding a bundle:
//
//   permissions.<section>            UI ONLY. `sectionBlocked` in the manage
//                                    layout hides the page. No RLS policy in
//                                    the database reads `permissions` for
//                                    section access, so this is navigation, not
//                                    a security boundary. Pre-existing.
//   permissions.team                 DATABASE. `can_manage_team(conf_id)` backs
//                                    the `Team managers manage team` policy on
//                                    conference_organizers.
//   permissions.financials_readonly  DATABASE. `can_write_financials(conf_id)`
//                                    backs the write policies on addons,
//                                    vouchers and application_surcharges, the
//                                    column guards on conferences and
//                                    application_role_configs, and the
//                                    mark_invoice_paid / mark_invoice_unpaid /
//                                    review_payment_batch RPCs.
//
// That asymmetry is why the ADMIN bundle promises exactly one thing about
// financials ("can see them, cannot change them") and nothing more.

import {
  Building2, Users, MapPin, FileText, Mail, CreditCard,
  Settings, Briefcase, Upload, type LucideIcon,
} from 'lucide-react';

export type PermissionMap = Record<string, boolean>;

export interface OrganizerSection {
  /** Key stored in conference_organizers.permissions. */
  key: string;
  label: string;
  /** The exact lucide icon the manage sidebar uses for this section. */
  icon: LucideIcon;
  /** One line, shown on hover. */
  blurb: string;
}

/** Mirrors SECTION_PERMS + NAV_SECTIONS in `manage/[slug]/layout.tsx`. */
export const ORGANIZER_SECTIONS: OrganizerSection[] = [
  { key: 'committees',    label: 'Committees',   icon: Building2,  blurb: 'Create committees, edit topics and seats, open the live scoreboard.' },
  { key: 'applications',  label: 'Applications', icon: Users,      blurb: 'Read, accept and reject delegate and chair applications.' },
  { key: 'assignment',    label: 'Assignment',   icon: MapPin,     blurb: 'Allocate accepted applicants to committees and country seats.' },
  { key: 'documents',     label: 'Documents',    icon: FileText,   blurb: 'Study guides, position papers and their release schedule.' },
  { key: 'email_builder', label: 'Email',        icon: Mail,       blurb: 'Compose and send conference emails from the builder.' },
  { key: 'financials',    label: 'Financials',   icon: CreditCard, blurb: 'Fees, add-ons, vouchers, invoices, payouts and financial aid.' },
  { key: 'job_board',     label: 'Job Board',    icon: Briefcase,  blurb: 'Post and manage secretariat and staff openings.' },
  { key: 'import',        label: 'Import',       icon: Upload,     blurb: 'Bulk-import delegates and send them claim links.' },
  { key: 'settings',      label: 'Settings',     icon: Settings,   blurb: 'Conference identity, application windows, privacy and this team page.' },
];

export const SECTION_KEYS = ORGANIZER_SECTIONS.map(s => s.key);

/** Capabilities that are not a page, and are enforced in the database. */
export const TEAM_KEY = 'team';
export const FINANCIALS_READONLY_KEY = 'financials_readonly';

export type BundleId = 'super_admin' | 'admin' | 'custom';

export interface Bundle {
  id: BundleId;
  label: string;
  /** What the bundle actually does, phrased so it stays true. */
  summary: string;
  /** The honest caveat, or null when there is nothing to warn about. */
  caveat: string | null;
}

export const BUNDLES: Bundle[] = [
  {
    id: 'super_admin',
    label: 'Super admin',
    summary: 'Every page, every action, including money and the team itself.',
    caveat: 'The only thing they cannot do is remove the owner.',
  },
  {
    id: 'admin',
    label: 'Admin',
    summary: 'Every page. Sees financials in full but cannot change any of them.',
    caveat: null,
  },
  {
    id: 'custom',
    label: 'Custom',
    summary: 'Only the pages you pick for them.',
    caveat: null,
  },
];

/** SUPER ADMIN — every section, plus team management, plus money. */
export function superAdminPermissions(): PermissionMap {
  const p: PermissionMap = {};
  for (const k of SECTION_KEYS) p[k] = true;
  p[TEAM_KEY] = true;
  return p;
}

/** ADMIN — every section, money is read-only. */
export function adminPermissions(): PermissionMap {
  const p: PermissionMap = {};
  for (const k of SECTION_KEYS) p[k] = true;
  p[FINANCIALS_READONLY_KEY] = true;
  return p;
}

export function bundlePermissions(id: BundleId, custom?: PermissionMap): PermissionMap {
  if (id === 'super_admin') return superAdminPermissions();
  if (id === 'admin') return adminPermissions();
  // Moving someone TO custom keeps the pages they already had but drops the two
  // bundle-defining capabilities. Without this, demoting an admin would leave
  // financials_readonly in place, detectBundle() would still say "admin", and
  // the chip would appear not to have changed at all.
  const next = { ...(custom ?? {}) };
  delete next[TEAM_KEY];
  delete next[FINANCIALS_READONLY_KEY];
  return next;
}

/** Which bundle a stored permission blob corresponds to, for display. */
export function detectBundle(p: PermissionMap | undefined): BundleId {
  const perms = p ?? {};
  const allSections = SECTION_KEYS.every(k => perms[k] === true);
  if (allSections && perms[TEAM_KEY] === true) return 'super_admin';
  if (allSections && perms[FINANCIALS_READONLY_KEY] === true) return 'admin';
  return 'custom';
}

export function bundleLabel(id: BundleId): string {
  return BUNDLES.find(b => b.id === id)?.label ?? 'Custom';
}

/** How many sections a member can actually open. */
export function grantedSectionCount(p: PermissionMap | undefined): number {
  const perms = p ?? {};
  return SECTION_KEYS.filter(k => perms[k] === true).length;
}

export function canManageTeam(p: PermissionMap | undefined): boolean {
  return (p ?? {})[TEAM_KEY] === true;
}

export function financialsAreReadOnly(p: PermissionMap | undefined): boolean {
  const perms = p ?? {};
  if (perms[TEAM_KEY] === true) return false;
  return perms[FINANCIALS_READONLY_KEY] === true;
}
