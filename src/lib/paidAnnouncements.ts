/**
 * Paid announcements to Gavelling users (draft feature, 9 Oct 2026).
 *
 * An organiser pays conference credits to email one announcement to the
 * Gavelling users in a country, a continent or the world. Every one is
 * reviewed by a platform admin before it sends. The database contract is
 * `scratch-paid-announcements.sql` at the repo root (NOT applied yet): until
 * it is, every read here answers `missing` and the UI shows "Coming soon".
 * Prices live only in the database (`paid_announcement_prices`); nothing here
 * types a price.
 */

import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type AnnouncementScope = 'country' | 'continent' | 'world';
export type AnnouncementStatus = 'in_review' | 'rejected' | 'cancelled' | 'sending' | 'paused' | 'sent';

export interface AnnouncementPrice {
  scope: AnnouncementScope;
  per_hundred: number;
  min_credits: number;
  max_credits: number | null;
  label: string;
}

export interface AnnouncementTargets {
  home_country: string | null;
  home_continent: string | null;
  cap_days: number;
  prices: AnnouncementPrice[];
  continents: string[];
  countries: string[];
}

export interface AnnouncementQuote {
  scope: AnnouncementScope;
  target: string | null;
  reach: number;
  credits: number;
  conference_credits: number;
  your_credits: number;
  cap_days: number;
}

export interface AnnouncementItem {
  id: string;
  scope: AnnouncementScope;
  target: string | null;
  heading: string;
  body: string;
  button_label: string;
  status: AnnouncementStatus;
  reject_reason: string | null;
  credits: number;
  quoted_reach: number;
  created_at: string;
  reviewed_at: string | null;
  finished_at: string | null;
  reached: number;
  clicked: number;
}

export interface AdminAnnouncementItem extends AnnouncementItem {
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

export const CONTINENT_NAMES: Record<string, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};

export function placeName(scope: AnnouncementScope, target: string | null): string {
  if (scope === 'world') return 'the whole world';
  if (scope === 'continent') return CONTINENT_NAMES[target ?? ''] ?? target ?? '';
  return target ?? '';
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
    home_country: (d.home_country as string | null) ?? null,
    home_continent: (d.home_continent as string | null) ?? null,
    cap_days: Number(d.cap_days ?? 14),
    prices: (d.prices as AnnouncementPrice[] | null) ?? [],
    continents: ((d.continents as string[] | null) ?? []).slice().sort((a, b) => (CONTINENT_NAMES[a] ?? a).localeCompare(CONTINENT_NAMES[b] ?? b)),
    countries: (d.countries as string[] | null) ?? [],
  }));
}

export function quoteAnnouncement(conferenceId: string, scope: AnnouncementScope, target: string | null) {
  return call<AnnouncementQuote>('paid_announcement_quote', { p_conf: conferenceId, p_scope: scope, p_target: target }, d => ({
    scope, target,
    reach: Number(d.reach ?? 0),
    credits: Number(d.credits ?? 0),
    conference_credits: Number(d.conference_credits ?? 0),
    your_credits: Number(d.your_credits ?? 0),
    cap_days: Number(d.cap_days ?? 14),
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
