// ── The Job Board: typed wrappers over the job_* RPCs ───────────────────────
//
// The server is the truth (docs/conferences/job-board.md). Reads that need no
// sign-in go through the anon client, or through the signed-in client when
// there is a session, so the answer carries the viewer's own state (saved,
// mine, their own listings). Writes always use getFreshAuthedClient(), read at
// call time. Every refusal comes back as { ok:false, message } with a sentence
// written for people; a transport error is turned into a plain sentence here,
// never shown raw.

import { supabase } from '@/lib/supabase';
import { getFreshAuthedClient, supabaseAuthClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';

export type JobRole = 'chair' | 'secretariat' | 'staff';
export type JobKind = 'gavelling' | 'outside' | 'premium';
export type JobRegion = 'north-america' | 'south-america' | 'europe' | 'africa' | 'asia' | 'oceania';
export type JobOffer = 'paid' | 'accommodation' | 'travel' | 'certificate' | 'letter';

export interface JobFilters {
  roles?: JobRole[];
  countries?: string[];
  regions?: JobRegion[];
  from?: string;
  to?: string;
  level?: 'school' | 'university';
  format?: 'in-person' | 'online' | 'hybrid';
  offers?: JobOffer[];
  deadline_days?: number;
  under10?: boolean;
  q?: string;
  /** One conference's listings (the Hiring mark on Explore links here). */
  conference_id?: string;
}

export interface JobOffers {
  paid: boolean;
  paid_amount: string | null;
  accommodation: boolean;
  travel: boolean;
  certificate: boolean;
  letter: boolean;
}

export interface JobConference {
  id: string;
  /** Null for a standalone listing (no Gavelling conference page). */
  slug: string | null;
  short: string | null;
  name: string | null;
  logo_url: string | null;
  verified: boolean;
  city: string | null;
  country: string | null;
  format: string | null;
  level: string | null;
  start_date: string | null;
  end_date: string | null;
  theme: unknown;
  /** Standalone listings only. */
  website: string | null;
}

export interface JobCard {
  id: string;
  kind: JobKind;
  title: string;
  role: JobRole;
  committee: string | null;
  committee_id: string | null;
  offers: JobOffers | null;
  promoted: boolean;
  premium: boolean;
  standalone: boolean;
  closes_at: string | null;
  /** A ready-made line ("Closes in 5 days"), or null. */
  urgency: string | null;
  published_at: string | null;
  conference: JobConference;
}

export interface JobBoardPage { total: number; items: JobCard[]; live: boolean }

export type JobMineStatus = 'started' | 'stopped' | 'submitted' | 'accepted' | 'rejected';

export interface JobListingDetail extends JobCard {
  description: string | null;
  questions_count: number;
  outside_url: string | null;
  premium_apply: string | null;
  status: string | null;
  open: boolean;
  hidden: boolean;
}

export interface JobListingResult {
  ok: true;
  listing: JobListingDetail;
  poster: { name: string | null; avatar_url: string | null; title: string | null } | null;
  conference_about: { slug: string | null; name: string | null; about: string | null } | null;
  saved: boolean;
  mine: { status: JobMineStatus; application_id: string | null; pick_rank: number | null; applied_at?: string | null } | null;
  can_edit: boolean;
  premium_locked: boolean;
  unlimited: boolean;
  insights: unknown;
  insights_locked: boolean;
}

export type JobQuestionType = 'yesno' | 'choice' | 'text';
export interface JobQuestion { id: string; text: string; type: JobQuestionType; options: string[] }

export type JobScreeningResult =
  | {
    ok: true;
    kind: JobKind;
    role: JobRole;
    title: string;
    questions: JobQuestion[];
    existing_application: { id: string; status: string } | null;
    conference: { slug: string | null; short: string | null };
  }
  | { ok: false; code?: 'signin' | 'outside' | 'unlimited' | 'stopped' | string; message: string };

export type JobSubmitResult =
  | { ok: false; field?: string; stopped?: boolean; message: string }
  | { ok: true; next: 'continue'; continue_url: string; role: JobRole; committee_id: string | null }
  | { ok: true; next: 'added'; application_id: string; message: string }
  | { ok: true; next: 'done'; message: string };

export type JobMyStatus = 'submitted' | 'accepted' | 'rejected' | 'not_finished';
export interface JobMySaved extends JobCard { open: boolean }
export interface JobMyApplication extends JobCard {
  applied_at: string | null;
  application_id: string | null;
  pick_rank: number | null;
  status: JobMyStatus;
}
export interface JobMyResult {
  ok: true;
  saved: JobMySaved[];
  applications: JobMyApplication[];
  listings: unknown[];
  unlimited: boolean;
}

type Fail = { ok: false; message: string };

const READ_FAIL = 'We could not load the job board. Check your connection and try again.';

/** The signed-in client when there is a session, else the anon client. */
async function readClient() {
  if (typeof window === 'undefined') return supabase;
  try {
    const { data: { session } } = await supabaseAuthClient.auth.getSession();
    if (session) return (await getFreshAuthedClient()) ?? supabase;
  } catch { /* fall through to anon */ }
  return supabase;
}

/** Drops empty filters so the server sees only what was chosen. */
export function cleanFilters(f: JobFilters): JobFilters {
  const out: JobFilters = {};
  if (f.roles?.length) out.roles = f.roles;
  if (f.countries?.length) out.countries = f.countries;
  if (f.regions?.length) out.regions = f.regions;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.level) out.level = f.level;
  if (f.format) out.format = f.format;
  if (f.offers?.length) out.offers = f.offers;
  if (f.deadline_days) out.deadline_days = f.deadline_days;
  if (f.under10) out.under10 = true;
  if (f.q?.trim()) out.q = f.q.trim();
  if (f.conference_id) out.conference_id = f.conference_id;
  return out;
}

export async function fetchJobBoard(filters: JobFilters, limit = 30, offset = 0): Promise<JobBoardPage | Fail> {
  try {
    const client = await readClient();
    const { data, error } = await client.rpc('job_board', { p_filters: cleanFilters(filters), p_limit: limit, p_offset: offset });
    if (error || !data) return { ok: false, message: friendlyError(error, READ_FAIL) };
    const d = data as Partial<JobBoardPage>;
    return { total: Number(d.total ?? 0), items: Array.isArray(d.items) ? d.items : [], live: !!d.live };
  } catch (e) {
    return { ok: false, message: friendlyError(e, READ_FAIL) };
  }
}

export async function fetchJobListing(id: string): Promise<JobListingResult | Fail> {
  const fallback = 'We could not open this listing. Try again in a moment.';
  try {
    const client = await readClient();
    const { data, error } = await client.rpc('job_listing_get', { p_id: id });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as { ok?: boolean; message?: string };
    if (!d.ok) return { ok: false, message: d.message || fallback };
    return data as JobListingResult;
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

const VIEWED_KEY = 'gavelling-job-viewed';

/** One 'view' per listing per browser session; a 'click' every time. Best effort. */
export function recordJobEvent(id: string, kind: 'view' | 'click'): void {
  if (typeof window === 'undefined') return;
  if (kind === 'view') {
    try {
      const seen = JSON.parse(window.sessionStorage.getItem(VIEWED_KEY) || '[]') as string[];
      if (seen.includes(id)) return;
      seen.push(id);
      window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify(seen.slice(-500)));
    } catch { /* storage off: still count once per page load */ }
  }
  void (async () => {
    try {
      const client = await readClient();
      await client.rpc('job_record_event', { p_id: id, p_kind: kind });
    } catch { /* counting never blocks anything */ }
  })();
}

async function authed(): Promise<NonNullable<Awaited<ReturnType<typeof getFreshAuthedClient>>> | null> {
  try { return await getFreshAuthedClient(); } catch { return null; }
}

const SIGNIN = 'Sign in to continue.';

export async function saveJob(id: string, on: boolean): Promise<{ ok: true; saved: boolean } | Fail> {
  const fallback = on ? 'We could not save this listing. Try again.' : 'We could not remove this listing from Saved. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_save', { p_id: id, p_on: on });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as { ok?: boolean; saved?: boolean; message?: string };
    if (!d.ok) return { ok: false, message: d.message || fallback };
    return { ok: true, saved: !!d.saved };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export async function fetchJobScreening(id: string): Promise<JobScreeningResult> {
  const fallback = 'We could not load the questions for this role. Try again.';
  const client = await authed();
  if (!client) return { ok: false, code: 'signin', message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_screening', { p_id: id });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as JobScreeningResult;
    if (!d.ok) return { ...d, message: d.message || fallback };
    return { ...d, questions: Array.isArray(d.questions) ? d.questions : [] };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export async function submitJobScreening(id: string, answers: { id: string; answer: string }[]): Promise<JobSubmitResult> {
  const fallback = 'We could not send your answers. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_submit_screening', { p_id: id, p_answers: answers });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as JobSubmitResult;
    if (!d.ok) return { ...d, message: d.message || fallback };
    if (d.next !== 'continue' && d.next !== 'added' && d.next !== 'done') return { ok: false, message: fallback };
    return d;
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export async function fetchJobMy(): Promise<JobMyResult | Fail> {
  const fallback = 'We could not load your saved roles and applications. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_my');
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as Partial<JobMyResult> & { ok?: boolean; message?: string };
    if (!d.ok) return { ok: false, message: d.message || fallback };
    return {
      ok: true,
      saved: Array.isArray(d.saved) ? d.saved : [],
      applications: Array.isArray(d.applications) ? d.applications : [],
      listings: Array.isArray(d.listings) ? d.listings : [],
      unlimited: !!d.unlimited,
    };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

// ── Words shared by the board, the card and the apply flow ──────────────────

export const JOB_ROLE_LABEL: Record<JobRole, string> = {
  chair: 'Chair',
  secretariat: 'Secretariat',
  staff: 'Staff',
};

export const JOB_OFFER_LABEL: Record<JobOffer, string> = {
  paid: 'Paid',
  accommodation: 'Accommodation',
  travel: 'Travel',
  certificate: 'Certificate',
  letter: 'Letter of recommendation',
};

export const JOB_OFFER_ORDER: JobOffer[] = ['paid', 'accommodation', 'travel', 'certificate', 'letter'];

/** The offer chips a card shows, in order. Paid carries its amount when given. */
export function jobOfferChips(offers: JobOffers | null | undefined): { key: JobOffer; label: string }[] {
  if (!offers) return [];
  return JOB_OFFER_ORDER.filter((k) => !!offers[k]).map((k) => ({
    key: k,
    label: k === 'paid' && offers.paid_amount ? `Paid · ${offers.paid_amount}` : JOB_OFFER_LABEL[k],
  }));
}

/** The path that continues a started application for a listing. */
export function jobContinuePath(slug: string, role: JobRole, listingId: string): string {
  return `/conferences/${encodeURIComponent(slug)}/apply?role=${encodeURIComponent(role)}&listing=${encodeURIComponent(listingId)}`;
}

/** True when the listing applies on another site (no Gavelling form). */
export function jobAppliesOutside(l: { kind: JobKind; premium_apply?: string | null }): boolean {
  return l.kind === 'outside' || (l.kind === 'premium' && l.premium_apply === 'link');
}

// ── Prompt 4: the homepage section, Join the Team and the Hiring mark ───────
// All three are anon and authenticated reads. A failed read is an empty
// answer: these placements simply do not render.

/** Up to 6 cards, already in the owner's order. Never re-sort. Server-safe (anon client). */
export async function fetchJobHomepage(): Promise<JobCard[]> {
  try {
    const { data, error } = await supabase.rpc('job_homepage');
    if (error || !Array.isArray(data)) return [];
    return (data as JobCard[]).slice(0, 6);
  } catch { return []; }
}

/** This conference's live listings, promoted first, then newest. */
export async function fetchConferenceListings(conferenceId: string): Promise<JobCard[]> {
  try {
    const client = await readClient();
    const { data, error } = await client.rpc('job_conference_listings', { p_conf: conferenceId });
    if (error || !data) return [];
    const list = Array.isArray(data) ? data : (data as { items?: unknown }).items;
    return Array.isArray(list) ? (list as JobCard[]) : [];
  } catch { return []; }
}

/** Conferences with at least one live promoted listing. */
export async function fetchHiringConferences(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase.rpc('job_hiring_conferences');
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as string[]).filter((x) => typeof x === 'string'));
  } catch { return new Set(); }
}

// ── Prompt 5: standalone listings, Unlimited perks, signed-out apply ────────

/** How a listing turns views into applications (prompt 10). started = began
 *  applying through the listing; screened_out = stopped by an Essential
 *  question; submitted = finished applications. */
export interface JobFunnel {
  views: number;
  clicks: number;
  started: number;
  screened_out: number;
  submitted: number;
  views_7d: number;
  clicks_7d: number;
}

/** A standalone listing as job_my() returns it (Your Listings). */
export interface JobMyListing extends JobCard {
  status: string;
  shown: 'draft' | 'live' | 'closed' | 'hidden';
  hidden_note: string | null;
  views: number;
  clicks: number;
  promotion: { starts_on: string; ends_on: string; with_homepage: boolean; days: number } | null;
  description: string | null;
  deadline: string | null;
  outside_url: string | null;
  charged_credits: number;
  locked: boolean;
  fix_available: boolean;
  funnel?: JobFunnel | null;
}

/** A price from job_prices (readable by anyone), e.g. 'outside_listing'. Null when it cannot be read. */
export async function fetchJobPrice(key: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.from('job_prices').select('credits').eq('key', key).maybeSingle();
    if (error || !data) return null;
    const n = Number((data as { credits: unknown }).credits);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

export interface JobAlert { id: string; name: string; filters: JobFilters; active: boolean; last_sent_at: string | null }

export async function fetchMyAlerts(): Promise<JobAlert[] | Fail> {
  const fallback = 'We could not load your alerts. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_alerts_mine');
    if (error) return { ok: false, message: friendlyError(error, fallback) };
    const list = Array.isArray(data) ? data : (data as { alerts?: unknown } | null)?.alerts;
    return Array.isArray(list) ? (list as JobAlert[]) : [];
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

/** Saves the current filters as an alert (Unlimited only: code 'unlimited' otherwise; at most 10). */
export async function saveJobAlert(id: string | null, name: string, filters: JobFilters): Promise<{ ok: true; id?: string } | (Fail & { code?: string })> {
  const fallback = 'We could not save this alert. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN, code: 'signin' };
  try {
    const { data, error } = await client.rpc('job_alert_save', { p_id: id, p_name: name, p_filters: cleanFilters(filters) });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as { ok?: boolean; id?: string; code?: string; message?: string };
    if (!d.ok) return { ok: false, code: d.code, message: d.message || fallback };
    return { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export async function removeJobAlert(id: string): Promise<{ ok: true } | Fail> {
  const fallback = 'We could not remove this alert. Try again.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN };
  try {
    const { data, error } = await client.rpc('job_alert_remove', { p_id: id });
    if (error) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as { ok?: boolean; message?: string } | null;
    if (d && d.ok === false) return { ok: false, message: d.message || fallback };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

// ── Signed-out apply (PART E) ──

/** The questions for anyone, signed in or not. Not ok: code 'outside', code 'signin' (premium), or a message. */
export async function fetchJobScreeningPublic(id: string): Promise<JobScreeningResult> {
  const fallback = 'We could not load the questions for this role. Try again.';
  try {
    const client = await readClient();
    const { data, error } = await client.rpc('job_screening_public', { p_id: id });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as JobScreeningResult;
    if (!d.ok) return { ...d, message: d.message || fallback };
    return { ...d, questions: Array.isArray(d.questions) ? d.questions : [], existing_application: null };
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export type JobCheckResult =
  | { ok: false; field?: string; stopped?: boolean; message: string }
  | { ok: true; next: 'continue'; continue_url: string; role: JobRole; committee_id: string | null };

/** Checks the answers and saves NOTHING. */
export async function checkJobScreening(id: string, answers: { id: string; answer: string }[]): Promise<JobCheckResult> {
  const fallback = 'We could not check your answers. Try again.';
  try {
    const client = await readClient();
    const { data, error } = await client.rpc('job_check_screening', { p_id: id, p_answers: answers });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as JobCheckResult;
    if (!d.ok) return { ...d, message: d.message || fallback };
    if (d.next !== 'continue' || typeof d.continue_url !== 'string') return { ok: false, message: fallback };
    return d;
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

export type JobClaimResult =
  | { ok: true; application_id?: string; pick_rank?: number; message?: string; unchanged?: boolean }
  | { ok: false; stopped?: boolean; field?: string; code?: string; message: string };

/** Signed in, once they have an application for the listing's role: saves the answers and adds the listing as the next pick (no email). */
export async function claimJobScreening(id: string, answers: { id: string; answer: string }[]): Promise<JobClaimResult> {
  const fallback = 'We could not add this listing to your application.';
  const client = await authed();
  if (!client) return { ok: false, message: SIGNIN, code: 'signin' };
  try {
    const { data, error } = await client.rpc('job_claim_screening', { p_id: id, p_answers: answers });
    if (error || !data) return { ok: false, message: friendlyError(error, fallback) };
    const d = data as JobClaimResult;
    if (!d.ok) return { ...d, message: d.message || fallback };
    return d;
  } catch (e) {
    return { ok: false, message: friendlyError(e, fallback) };
  }
}

// Answers given signed out, kept on this device for 14 days under the listing id.
const STORED_PREFIX = 'gavelling-job-answers:';
const STORED_DAYS = 14;

export function storeJobAnswers(listingId: string, answers: { id: string; answer: string }[]): void {
  try {
    window.localStorage.setItem(STORED_PREFIX + listingId, JSON.stringify({ at: Date.now(), answers }));
  } catch { /* storage blocked: carry on without it */ }
}

export function readJobAnswers(listingId: string): { id: string; answer: string }[] | null {
  try {
    const raw = window.localStorage.getItem(STORED_PREFIX + listingId);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: number; answers?: unknown };
    if (!v || typeof v.at !== 'number' || Date.now() - v.at > STORED_DAYS * 86400000 || !Array.isArray(v.answers)) {
      window.localStorage.removeItem(STORED_PREFIX + listingId);
      return null;
    }
    return v.answers as { id: string; answer: string }[];
  } catch { return null; }
}

export function clearJobAnswers(listingId: string): void {
  try { window.localStorage.removeItem(STORED_PREFIX + listingId); } catch { /* nothing to clear */ }
}
