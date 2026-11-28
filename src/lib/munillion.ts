'use client';

// ── MUNillion: the daily MUN trivia game at /games ──────────────────────────
//
// Every read and write goes through the munillion_* SECURITY DEFINER functions
// (scratch-munillion.sql, applied 26 Nov 2026). The browser keeps one random
// token so a signed-out player keeps their streak; signing in moves those
// plays onto the account (the database does it inside munillion_today and
// munillion_history). Answers and scores are preset by Gavelling; only the
// MUN conference question is dynamic.

import { supabase } from '@/lib/supabase';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type TierValue = 0 | 10 | 30 | 60 | 85 | 100;

export interface TierMeta {
  value: TierValue;
  name: string;
  /** One plain line under the name. No full stop (captions never end in one). */
  line: string;
}

export const TIERS: Record<TierValue, TierMeta> = {
  100: { value: 100, name: 'The Gavel', line: 'Only one answer on the list wins The Gavel, and you found it' },
  85: { value: 85, name: 'Best Delegate', line: 'A very niche pick' },
  60: { value: 60, name: 'Outstanding Delegate', line: 'A strong pick most people miss' },
  30: { value: 30, name: 'Honourable Mention', line: 'A solid answer plenty of people give' },
  10: { value: 10, name: 'Participation Certificate', line: 'The answer everyone gives' },
  0: { value: 0, name: 'Absent', line: 'Nothing counted this time' },
};

export const TIER_ORDER: TierValue[] = [100, 85, 60, 30, 10, 0];

export function tierMeta(t: number | null | undefined): TierMeta {
  return TIERS[(t ?? 0) as TierValue] ?? TIERS[0];
}

export const MAX_POINTS = 700;

// ── Shapes returned by the database ─────────────────────────────────────────

export type QuestionKind = 'list' | 'number' | 'conference';

export interface MunQuestion {
  position: number;
  prompt: string;
  hint: string | null;
  kind: QuestionKind;
  seconds: number;
}

export interface MunPlayAnswer {
  position: number;
  tier: number | null;
  typed: string | null;
  label: string | null;
  sub: string | null;
  slug: string | null;
  seconds_left: number | null;
}

export interface MunToday {
  ok: boolean;
  server_now: string;
  game: { number: number; date: string; preview: boolean } | null;
  questions?: MunQuestion[];
  play?: { total: number; finished: boolean; answers: MunPlayAnswer[] } | null;
  streak: number;
  signed_in?: boolean;
}

/** Where a question's answers come from, shown as an "i" once the question is over. */
export interface MunSource { note: string; url: string | null }

export interface MunAnswerResult {
  ok: boolean;
  reason?: string;
  /** 'suggest': a near miss. `suggestion` is the answer the game thinks you meant; submitting it confirms. */
  status?: 'correct' | 'unknown' | 'suggest' | 'late' | 'done' | 'skipped';
  suggestion?: string;
  /** On the conference question: what was typed is not a conference on Gavelling (offer to add it). */
  not_listed?: boolean;
  tier?: number;
  label?: string | null;
  sub?: string | null;
  slug?: string | null;
  total?: number;
  finished?: boolean;
  attempts_left?: number;
  source?: MunSource | null;
  /** The country of the answer (a president's country, a conference's host), for its flag. */
  country?: string | null;
  /** reason 'explained': a known wrong answer, with why ("Waterloo was a battle, not a war"). */
  message?: string;
  /** reason 'wrong_country': a real conference, in a country that doesn't count on this question. */
  conference?: { label: string; country: string | null };
}

export interface MunOpenResult {
  ok: boolean;
  reason?: string;
  answered?: boolean;
  tier?: number | null;
  seconds_left?: number;
}

export interface MunRevealAnswer { answer: string; note: string | null; slug: string | null; tier?: number; country?: string | null }

export interface MunRevealQuestion {
  position: number;
  prompt: string;
  kind: QuestionKind;
  default_tier: number | null;
  number_max: number | null;
  mine: { typed: string | null; label: string | null; sub: string | null; slug: string | null; tier: number | null; country?: string | null } | null;
  gavel: MunRevealAnswer | null;
  source?: MunSource | null;
  /** Conference question: names this player typed that aren't on Gavelling (for "Add <name>"). */
  missed?: string[];
  /** Every answer, best tier first (the conference question lists every conference on Gavelling). */
  answers: (MunRevealAnswer & { tier: number })[];
}

export interface MunReveal {
  ok: boolean;
  reason?: string;
  game?: { number: number; date: string };
  total?: number;
  questions?: MunRevealQuestion[];
}

export interface MunHistoryPlay {
  number: number;
  date: string;
  total: number;
  finished: boolean;
  answers: { position: number; prompt: string; typed: string | null; label: string | null; sub: string | null; slug: string | null; tier: number | null }[];
}

export interface MunHistory {
  ok: boolean;
  streak: number;
  best?: number;
  played?: number;
  plays: MunHistoryPlay[];
}

// ── The browser token ───────────────────────────────────────────────────────

const TOKEN_KEY = 'gavelling-munillion-token';
let memoryToken: string | null = null;

function newToken(): string {
  try {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
}

/** The random id this browser plays under while signed out (never sent raw to a table: the database hashes it). */
export function munillionToken(): string {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && stored.length >= 16) return stored;
    const t = newToken();
    localStorage.setItem(TOKEN_KEY, t);
    return t;
  } catch {
    if (!memoryToken) memoryToken = newToken();
    return memoryToken;
  }
}

// ── Calls ───────────────────────────────────────────────────────────────────

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // The signed-in client is read fresh at call time (CLAUDE.md, Auth clients);
  // signed out, the anon client plays under the browser token.
  const authed = await getFreshAuthedClient().catch(() => null);
  const client = authed ?? supabase;
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export function munToday(preview = false) {
  return rpc<MunToday>('munillion_today', { p_token: munillionToken(), p_preview: preview });
}
export function munOpen(position: number, preview = false) {
  return rpc<MunOpenResult>('munillion_open', { p_token: munillionToken(), p_position: position, p_preview: preview });
}
export function munAnswer(position: number, typed: string, preview = false) {
  return rpc<MunAnswerResult>('munillion_answer', { p_token: munillionToken(), p_position: position, p_typed: typed, p_preview: preview });
}
export function munSkip(position: number, preview = false) {
  return rpc<MunAnswerResult>('munillion_skip', { p_token: munillionToken(), p_position: position, p_preview: preview });
}
export function munReveal(preview = false) {
  return rpc<MunReveal>('munillion_reveal', { p_token: munillionToken(), p_preview: preview });
}
/** Clears this player's own play of an unpublished game, so the preview can be tried again. */
export function munResetPreview() {
  return rpc<{ ok: boolean; reason?: string }>('munillion_reset_preview_play', { p_token: munillionToken() });
}
export function munHistory() {
  return rpc<MunHistory>('munillion_history', { p_token: munillionToken() });
}

/** Records that a player wants a conference listed ('now' / 'later' from the pop-up, 'reveal' from the end screen, 'dismiss'). */
export function munConfAdd(typed: string, choice: 'now' | 'later' | 'dismiss' | 'reveal') {
  return rpc<{ ok: boolean }>('munillion_conf_add', { p_token: munillionToken(), p_typed: typed, p_choice: choice });
}

/** Where the plus button sends people: listing a conference on Gavelling. */
export const ADD_CONFERENCE_HREF = '/conferences/new';

export function conferenceHref(slug: string): string {
  return `/conferences/${encodeURIComponent(slug)}`;
}

/** The plain-text result people paste into a chat. */
export function shareText(number: number, total: number, tiers: (number | null)[]): string {
  return [
    `MUNillion #${number}`,
    `${total} points`,
    tiers.map((t) => String(t ?? 0)).join(' '),
    'gavelling.com/games',
  ].join('\n');
}
