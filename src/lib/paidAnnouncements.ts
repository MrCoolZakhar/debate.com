/**
 * Paid announcements to Gavelling users (draft feature, 9 Oct 2026; reworked
 * 11 Oct 2026 as the "Marketing" button in Communications).
 *
 * An organiser pays conference credits to email one announcement to the
 * Gavelling delegates in their conference's CITY, their conference's COUNTRY,
 * or the WORLD, at a flat price per choice. The place is never chosen by the
 * client: the database reads it from the conference row. Submitting takes the
 * credits and emails the team inbox; every announcement is reviewed by a
 * platform admin in /admin before it sends. The organiser never sees how many
 * people a choice reaches (owner, 11 Oct 2026); admins do. The database contract is
 * `scratch-paid-announcements.sql` at the repo root (NOT applied yet): until
 * it is, every read here answers `missing` and the UI shows "Coming soon".
 * Prices live only in the database (`paid_announcement_prices`); nothing here
 * types a price.
 */

import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type AnnouncementScope = 'city' | 'country' | 'world';
export type AnnouncementStatus = 'in_review' | 'rejected' | 'cancelled' | 'sending' | 'paused' | 'sent';

export const ANNOUNCEMENT_SCOPES: AnnouncementScope[] = ['city', 'country', 'world'];

export interface AnnouncementOption {
  scope: AnnouncementScope;
  /** Flat price in credits, from the price table. */
  credits: number;
  /**
   * Whether anyone can get one there today (true / false), or null when the
   * place is not set. The database never hands the organiser a NUMBER (owner,
   * 11 Oct 2026: no reach counts in the organiser UI).
   */
  hasPeople: boolean | null;
  available: boolean;
  /** Why it is not available (a sentence from the database). */
  reason: string | null;
}

export interface AnnouncementTargets {
  city: string | null;
  country: string | null;
  cap_days: number;
  options: AnnouncementOption[];
  conference_credits: number;
  your_credits: number;
}

export interface AnnouncementItem {
  id: string;
  scope: AnnouncementScope;
  target: string | null;
  target_country: string | null;
  heading: string;
  body: string;
  button_label: string;
  button_url: string | null;
  status: AnnouncementStatus;
  reject_reason: string | null;
  credits: number;
  created_at: string;
  reviewed_at: string | null;
  finished_at: string | null;
  /** People who opened the button's page. */
  clicked: number;
}

/** Admins see the counts the organiser never does. */
export interface AdminAnnouncementItem extends AnnouncementItem {
  quoted_reach: number;
  reached: number;
  conference_id: string;
  conference: string;
  acronym: string | null;
  slug: string;
  preview_html: string | null;
}

export type Answer<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'missing' }
  | { kind: 'refused'; message: string; field?: string }
  | { kind: 'error' };

/** Who an announcement went to, in words ("delegates in Nairobi, Kenya"). */
export function placeName(scope: AnnouncementScope | string, target: string | null, targetCountry?: string | null): string {
  if (scope === 'world') return 'the whole world';
  if (scope === 'city') return `delegates in ${[target, targetCountry].filter(Boolean).join(', ')}`;
  if (scope === 'country') return `delegates in ${target ?? ''}`;
  return target ?? '';
}

/** The big title of each choice. */
export function scopeTitle(scope: AnnouncementScope, city: string | null, country: string | null): string {
  if (scope === 'city') return city ? `Delegates in ${city}` : 'Delegates in your city';
  if (scope === 'country') return country ? `Delegates in ${country}` : 'Delegates in your country';
  return 'The whole world';
}

/**
 * One clear line under each choice: who counts. The database rule
 * (`_paid_announcement_people`): the cities and countries of conferences the
 * person was accepted to or seated at on Gavelling, plus the conferences on
 * their public MUN CV; for a country also their nationality.
 */
export function whoCounts(scope: AnnouncementScope, city: string | null, country: string | null): string {
  if (scope === 'city') return `Delegates who have been to a conference in ${city || 'your city'}, on Gavelling or on their MUN CV`;
  if (scope === 'country') {
    const c = country || 'your country';
    return `Delegates who have been to a conference in ${c}, or are from ${c}`;
  }
  return 'Every Gavelling delegate who gets announcements';
}

export function statusWords(s: AnnouncementStatus): string {
  switch (s) {
    case 'in_review': return 'Waiting for review';
    case 'rejected': return 'Not approved';
    case 'cancelled': return 'Cancelled';
    case 'sending': return 'Sending';
    case 'paused': return 'Paused';
    case 'sent': return 'Sent';
  }
}

/** The one link a button may open: a page of this conference on Gavelling. */
export function conferencePageUrl(slug: string): string {
  return `https://gavelling.com/conferences/${slug}`;
}

/**
 * Normalise what the organiser typed into a link, or null when it is not a
 * page of THIS conference on Gavelling. The database checks the same rule
 * (`_paid_announcement_url_problem`); this only answers early.
 */
export function normaliseButtonUrl(input: string, slug: string): string | null {
  let t = input.trim();
  if (!t) return conferencePageUrl(slug);
  t = t.replace(/^http:\/\//i, 'https://').replace(/^(https:\/\/)?www\./i, '$1');
  if (!/^https:\/\//i.test(t)) t = `https://${t}`;
  const prefix = conferencePageUrl(slug);
  if (t.toLowerCase().startsWith(prefix)) t = prefix + t.slice(prefix.length);
  if (t !== prefix && !t.startsWith(`${prefix}/`)) return null;
  const rest = t.slice(prefix.length);
  if (rest && !/^(\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*\/?$/.test(rest)) return null;
  return t;
}

/** The database does not have the function yet (the SQL is not applied). */
export function isMissingFunction(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? '');
}

async function call<T>(fn: string, args: Record<string, unknown>, pick: (d: Record<string, unknown>) => T): Promise<Answer<T>> {
  const client = await getFreshAuthedClient();
  if (!client) return { kind: 'error' };
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) return isMissingFunction(error) ? { kind: 'missing' } : { kind: 'error' };
    const d = (data ?? {}) as Record<string, unknown>;
    if (d.ok === false) {
      return { kind: 'refused', message: typeof d.message === 'string' ? d.message : 'That could not be done.', field: typeof d.field === 'string' ? d.field : undefined };
    }
    return { kind: 'ok', data: pick(d) };
  } catch {
    return { kind: 'error' };
  }
}

export function loadAnnouncementTargets(conferenceId: string) {
  return call<AnnouncementTargets>('paid_announcement_targets', { p_conf: conferenceId }, d => ({
    city: (d.city as string | null) ?? null,
    country: (d.country as string | null) ?? null,
    cap_days: Number(d.cap_days ?? 14),
    options: ((d.options as Record<string, unknown>[] | null) ?? [])
      .filter(o => ANNOUNCEMENT_SCOPES.includes(o.scope as AnnouncementScope))
      .map(o => ({
        scope: o.scope as AnnouncementScope,
        credits: Number(o.credits ?? 0),
        hasPeople: typeof o.has_people === 'boolean' ? o.has_people : null,
        available: o.available !== false,
        reason: typeof o.reason === 'string' ? o.reason : null,
      })),
    conference_credits: Number(d.conference_credits ?? 0),
    your_credits: Number(d.your_credits ?? 0),
  }));
}

export function loadMyAnnouncements(conferenceId: string) {
  return call<AnnouncementItem[]>('my_paid_announcements', { p_conf: conferenceId }, d => (d.items as AnnouncementItem[] | null) ?? []);
}

export function cancelAnnouncement(id: string) {
  return call<string>('cancel_paid_announcement', { p_id: id }, d => String(d.message ?? 'Cancelled.'));
}

/** Admin: the review queue (platform admins only, enforced by the function). */
export async function loadAdminAnnouncements(status: AnnouncementStatus | null): Promise<Answer<AdminAnnouncementItem[]>> {
  const client = await getFreshAuthedClient();
  if (!client) return { kind: 'error' };
  const { data, error } = await client.rpc('admin_paid_announcements', { p_status: status });
  if (error) return isMissingFunction(error) ? { kind: 'missing' } : { kind: 'error' };
  return { kind: 'ok', data: (data as AdminAnnouncementItem[] | null) ?? [] };
}

export function reviewAnnouncement(id: string, approve: boolean, reason: string | null) {
  return call<string>('admin_review_paid_announcement', { p_id: id, p_approve: approve, p_reason: reason }, d => String(d.message ?? 'Done.'));
}
