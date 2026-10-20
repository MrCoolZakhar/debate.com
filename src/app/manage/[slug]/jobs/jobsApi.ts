// ── The organizer Job Board: typed wrappers over the job_* organizer RPCs ───
//
// docs/conferences/job-board.md. Every call reads a fresh token at call time
// (getFreshAuthedClient). Every refusal comes back as
// { ok:false, field?, code?, message } with a sentence written for people;
// a transport error is turned into a plain sentence here, never shown raw.
// Prices are never typed in the client: they come from the panel's `prices`
// or from job_promote_quote.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import type { JobCard, JobKind, JobOffers, JobRole } from '@/lib/jobBoard';

export type ShownState = 'draft' | 'live' | 'closed' | 'hidden';
export type MyMode = 'off' | 'each' | 'digest';

export interface OrgQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'choice' | 'text';
  options: string[];
  ideal: string | null;
  essential: boolean;
}

export interface OrgListing extends JobCard {
  status: string;
  shown: ShownState;
  closed_reason: string | null;
  hidden_note: string | null;
  views: number;
  clicks: number;
  applicants: number;
  promotion: { starts_on: string; ends_on: string; with_homepage: boolean; days: number } | null;
  description: string | null;
  questions: OrgQuestion[];
  auto_reject: boolean;
  deadline: string | null;
  outside_url: string | null;
  poster_user_id: string | null;
  charged_credits: number;
  locked: boolean;
  fix_available: boolean;
}

export interface PanelRole { role: JobRole; enabled: boolean; opens_at: string | null; closes_at: string | null }
export interface PanelOrganizer { user_id: string; name: string | null; avatar_url: string | null; title: string | null }
export interface PanelPrices { promo_7: number; promo_14: number; promo_28: number; homepage_extra: number; outside_listing: number }

export interface JobPanel {
  ok: true;
  listings: OrgListing[];
  settings: { emails_on: boolean; my_mode: MyMode };
  roles: PanelRole[];
  committees: { id: string; name: string; abbreviation: string | null }[];
  organizers: PanelOrganizer[];
  prices: PanelPrices;
  can_promote: boolean;
  conference_credits: number;
  your_credits: number;
}

/** Every refusal shape the organizer RPCs answer with. */
export interface Refusal {
  ok: false;
  message: string;
  field?: string;
  code?: string;
  need_credits?: number;
  credits?: number;
  conference_credits?: number;
  your_credits?: number;
  taken_days?: string[];
}

const SIGNIN = 'Your session has ended. Sign in again to continue.';

async function call<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<({ ok: true } & T) | Refusal> {
  try {
    const client = await getFreshAuthedClient();
    if (!client) return { ok: false, message: SIGNIN };
    const { data, error } = await client.rpc(fn, args);
    if (error) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as ({ ok?: boolean; message?: string } & Record<string, unknown>) | null;
    if (!d || typeof d !== 'object') return { ok: false, message: fallback };
    if (d.ok !== true) return { ...(d as object), ok: false, message: typeof d.message === 'string' && d.message ? d.message : fallback } as Refusal;
    return d as { ok: true } & T;
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export function readPanel(confId: string) {
  return call<Omit<JobPanel, 'ok'>>('job_conference_panel', { p_conf: confId }, 'We could not load your Job Board. Try again in a moment.')
    .then((r) => {
      if (!r.ok) return r;
      return {
        ...r,
        listings: Array.isArray(r.listings) ? r.listings.map((l) => ({ ...l, questions: Array.isArray(l.questions) ? l.questions : [] })) : [],
        roles: Array.isArray(r.roles) ? r.roles : [],
        committees: Array.isArray(r.committees) ? r.committees : [],
        organizers: Array.isArray(r.organizers) ? r.organizers : [],
      } as JobPanel;
    });
}

/** The keys job_listing_save takes. Send only the keys that changed. */
export interface ListingPatch {
  id?: string;
  conference_id?: string;
  kind?: Exclude<JobKind, 'premium'>;
  role?: JobRole;
  committee_id?: string | null;
  title?: string;
  description?: string;
  offers?: JobOffers;
  questions?: OrgQuestion[];
  auto_reject?: boolean;
  deadline?: string | null;
  outside_url?: string | null;
  poster_user_id?: string | null;
}

export function saveListing(p: ListingPatch) {
  return call<{ id: string; fix_used?: boolean; message?: string }>('job_listing_save', { p }, 'We could not save this listing. Try again.');
}

export function publishListing(id: string, topUp = false, confirmDeadline = false) {
  return call<{ charged?: number; message?: string }>('job_listing_publish', { p_id: id, p_top_up: topUp, p_confirm_deadline: confirmDeadline }, 'We could not publish this listing. Try again.');
}

export function closeListing(id: string) {
  return call<{ deleted?: boolean; message?: string }>('job_listing_close', { p_id: id }, 'We could not close this listing. Try again.');
}

/** A short draft built from the conference page; null when it could not be read. */
export async function draftDescription(confId: string, role: JobRole, committeeId: string | null): Promise<string | null> {
  try {
    const client = await getFreshAuthedClient();
    if (!client) return null;
    const { data, error } = await client.rpc('job_draft_description', { p_conf: confId, p_role: role, p_committee: committeeId });
    if (error || typeof data !== 'string') return null;
    return data;
  } catch { return null; }
}

export interface DigestLine {
  listing_id: string;
  title: string;
  role: JobRole;
  yesterday: number;
  today: number;
  week: number;
  link: 'applications' | 'team';
}
export function readDigest(confId: string) {
  return call<{ lines: DigestLine[]; views_week: number; clicks_week: number }>('job_digest', { p_conf: confId }, 'We could not load this week’s applicants.')
    .then((r) => (r.ok ? { ...r, lines: Array.isArray(r.lines) ? r.lines : [], views_week: Number(r.views_week ?? 0), clicks_week: Number(r.clicks_week ?? 0) } : r));
}

export function setJobSettings(confId: string, emailsOn: boolean | null, mode: MyMode | null) {
  return call<{ emails_on: boolean; my_mode: MyMode }>('job_settings_set', { p_conf: confId, p_emails_on: emailsOn, p_mode: mode }, 'We could not save your email choice. Try again.');
}

export interface PromoteOption { days: 7 | 14 | 28; credits: number; homepage_full_days: string[] }
export interface PromoteQuote { closes_at: string | null; homepage_extra: number; active: unknown; options: PromoteOption[] }
export function promoteQuote(id: string) {
  return call<PromoteQuote>('job_promote_quote', { p_id: id }, 'We could not read the promotion prices. Try again.')
    .then((r) => (r.ok ? { ...r, options: Array.isArray(r.options) ? r.options.map((o) => ({ ...o, homepage_full_days: Array.isArray(o.homepage_full_days) ? o.homepage_full_days : [] })) : [] } : r));
}

export function promoteListing(id: string, days: 7 | 14 | 28, homepage: boolean, topUp = false) {
  return call<{ credits?: number; ends_on?: string; message?: string }>('job_promote', { p_id: id, p_days: days, p_homepage: homepage, p_top_up: topUp }, 'We could not promote this listing. Try again.');
}

// ── Words ─────────────────────────────────────────────────────────────────

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** "26 Oct" (and the year when it is not this year). */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ROLE_PLURAL: Record<JobRole, string> = { chair: 'chairs', secretariat: 'secretariat', staff: 'staff' };
