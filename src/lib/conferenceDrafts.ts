/**
 * conferenceDrafts.ts: server-side drafts for the conference creation wizard
 * (/conferences/new), 12 Oct 2026.
 *
 * Owner: progress is saved as the organiser goes, so leaving or reloading
 * never loses it. The SQL is applied (migration `conference_drafts`); if it
 * ever went missing every call here answers `missing`, and the wizard behaves
 * as it did before drafts (signed-out visitors are sent to sign in).
 *
 * SIGNED OUT (owner, 19 Oct 2026: no email step any more). A visitor who is
 * not signed in is never asked for an email, and `save_conference_draft`
 * refuses to mint a server draft without one, so their answers live in THIS
 * browser only (`localStorage gavelling-conference-draft-local`, the
 * `LocalDraft` helpers below) until they sign in to publish. Signing in turns
 * them into an ordinary server draft owned by the account. A browser that
 * already holds a server token (an older email draft, or a `?draft=` link)
 * keeps saving to it by the token alone, never with an email.
 *
 * WHAT IDENTIFIES A DRAFT
 * A random 64-hex token minted by the server on the first save and kept in this
 * browser (`localStorage gavelling-conference-draft`). The reminder emails link
 * to `/conferences/new?draft=<token>`. A draft becomes an account's only by
 * that token (a signed-in save or load) or by the account's VERIFIED email
 * (`claim_conference_drafts`), never by a typed email alone. A claimed draft
 * opened by anyone else answers `sign_in` / `not_yours` and never its answers.
 *
 * Every RPC goes through `supabaseAuthClient`, which carries the signed-in
 * session when there is one and is anonymous otherwise.
 */

import { supabaseAuthClient } from '@/lib/supabase-auth';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const CONFERENCE_DRAFT_TOKEN_KEY = 'gavelling-conference-draft';
const PENDING_CREATE_KEY = 'gavelling-conference-draft-create';
const LOCAL_DRAFT_KEY = 'gavelling-conference-draft-local';
/** The pending-create marker for a draft that lives only in this browser. */
export const LOCAL_PENDING_CREATE = 'local';
/** A signed-out draft older than this is not offered again. */
const LOCAL_DRAFT_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function isDraftToken(v: string | null | undefined): v is string {
  return !!v && TOKEN_RE.test(v);
}

// ── Browser token ────────────────────────────────────────────────────────────

export function readLocalDraftToken(): string | null {
  try {
    const v = localStorage.getItem(CONFERENCE_DRAFT_TOKEN_KEY);
    return isDraftToken(v) ? v : null;
  } catch { return null; }
}

export function writeLocalDraftToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(CONFERENCE_DRAFT_TOKEN_KEY, token);
    else localStorage.removeItem(CONFERENCE_DRAFT_TOKEN_KEY);
  } catch { /* storage blocked: the draft still lives on the server */ }
}

// ── Signed-out draft, this browser only ──────────────────────────────────────

export interface LocalDraft { data: Record<string, unknown>; step: number; savedAt: number }

export function readLocalDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LocalDraft>;
    if (!v || typeof v !== 'object' || !v.data || typeof v.data !== 'object' || Array.isArray(v.data)) return null;
    const savedAt = typeof v.savedAt === 'number' ? v.savedAt : 0;
    if (Date.now() - savedAt > LOCAL_DRAFT_MAX_AGE_MS) { localStorage.removeItem(LOCAL_DRAFT_KEY); return null; }
    return { data: v.data as Record<string, unknown>, step: typeof v.step === 'number' ? v.step : 1, savedAt };
  } catch { return null; }
}

/** False when the browser refused (private mode, storage full or blocked). */
export function writeLocalDraft(data: Record<string, unknown>, step: number): boolean {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ data, step, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function clearLocalDraft(): void {
  try { localStorage.removeItem(LOCAL_DRAFT_KEY); } catch { /* ignore */ }
}

/** "Create once signed in": survives the Google round trip in this tab. The
 *  value is the draft's token, or LOCAL_PENDING_CREATE for a browser-only one. */
export function setPendingCreate(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(PENDING_CREATE_KEY, token);
    else sessionStorage.removeItem(PENDING_CREATE_KEY);
  } catch { /* ignore */ }
}

export function readPendingCreate(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_CREATE_KEY);
    return isDraftToken(v) || v === LOCAL_PENDING_CREATE ? v : null;
  } catch { return null; }
}

// ── RPC plumbing ─────────────────────────────────────────────────────────────

export type RpcAnswer<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'missing' }     // the SQL is not applied: behave as before
  | { kind: 'error' };      // network or server failure: try again later

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') return true;
  return /could not find the function/i.test(error.message ?? '');
}

async function call<T>(name: string, args: Record<string, unknown>): Promise<RpcAnswer<T>> {
  try {
    const { data, error } = await supabaseAuthClient.rpc(name, args);
    if (error) return isMissing(error) ? { kind: 'missing' } : { kind: 'error' };
    return { kind: 'ok', data: data as T };
  } catch {
    return { kind: 'error' };
  }
}

// ── Availability ─────────────────────────────────────────────────────────────

let availability: Promise<boolean> | null = null;

/**
 * Whether the drafts SQL exists. One probe per page load: a load of a token
 * that cannot exist. Only a definite "the function is there" counts; a network
 * failure answers false so the wizard falls back to today's sign-in gate.
 */
export function conferenceDraftsAvailable(): Promise<boolean> {
  if (!availability) {
    availability = call<unknown>('load_conference_draft', { p_token: '0'.repeat(64) })
      .then((a) => a.kind === 'ok');
    // A failed probe may be retried on the next page load, never pinned.
    void availability.then((ok) => { if (!ok) availability = null; });
  }
  return availability;
}

// ── Calls ────────────────────────────────────────────────────────────────────

export interface DraftRefusal {
  ok: false;
  reason: string;
  message?: string;
  email_masked?: string | null;
  slug?: string | null;
}

export type SaveDraftAnswer =
  | { ok: true; token: string; created: boolean; updated_at: string }
  | DraftRefusal;

/** The client never sends an email: a signed-in save takes the account's
 *  address on the server, a signed-out save needs a token (see the header). */
export function saveConferenceDraft(
  token: string | null, data: Record<string, unknown>, step: number,
): Promise<RpcAnswer<SaveDraftAnswer>> {
  return call<SaveDraftAnswer>('save_conference_draft', {
    p_token: token, p_email: null, p_data: data, p_step: step,
  });
}

export type LoadDraftAnswer =
  | { ok: true; token: string; email: string | null; data: Record<string, unknown>; step: number; updated_at: string; claimed: boolean }
  | DraftRefusal;

export function loadConferenceDraft(token: string): Promise<RpcAnswer<LoadDraftAnswer>> {
  return call<LoadDraftAnswer>('load_conference_draft', { p_token: token });
}

export function stopConferenceDraftReminders(token: string): Promise<RpcAnswer<{ ok: boolean; already?: boolean }>> {
  return call('stop_conference_draft_reminders', { p_token: token });
}

export function deleteConferenceDraft(token: string): Promise<RpcAnswer<{ ok: boolean; reason?: string; message?: string }>> {
  return call('delete_conference_draft', { p_token: token });
}

export function finishConferenceDraft(token: string, conferenceId: string): Promise<RpcAnswer<{ ok: boolean }>> {
  return call('finish_conference_draft', { p_token: token, p_conference_id: conferenceId });
}

export function claimConferenceDrafts(): Promise<RpcAnswer<{ ok: boolean; claimed?: number }>> {
  return call('claim_conference_drafts', {});
}

export interface MyConferenceDraft {
  token: string;
  full_name: string | null;
  acronym: string | null;
  logo_url: string | null;
  step: number;
  updated_at: string;
  created_at: string;
}

export async function myConferenceDrafts(): Promise<RpcAnswer<MyConferenceDraft[]>> {
  const a = await call<MyConferenceDraft[] | null>('my_conference_drafts', {});
  if (a.kind !== 'ok') return a;
  return { kind: 'ok', data: Array.isArray(a.data) ? a.data : [] };
}

/** Where "Finish listing" goes. */
export function conferenceDraftHref(token: string): string {
  return `/conferences/new?draft=${token}`;
}

/**
 * The last save when the page is going away (pagehide). supabase-js does not
 * use keepalive, so a normal RPC would be cancelled with the page. Best effort:
 * a keepalive body is capped at 64 KB by browsers, so a bigger draft is left to
 * the debounced save that ran at most a second earlier.
 */
export function saveConferenceDraftKeepalive(
  token: string, data: Record<string, unknown>, step: number, accessToken: string | null,
): void {
  try {
    const body = JSON.stringify({ p_token: token, p_email: null, p_data: data, p_step: step });
    if (body.length > 60_000) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/save_conference_draft`, {
      method: 'POST', headers, body, keepalive: true,
    }).catch(() => {});
  } catch { /* old browser */ }
}

/** Stable string identity of a draft (keys sorted, as jsonb reorders them). */
export function fingerprintConferenceDraft(data: unknown, step: number): string {
  return `${step}|${stable(data)}`;
}

function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}
