/**
 * applyDraft.ts — server-side autosave for the conference apply flow.
 *
 * WHY THIS EXISTS
 * The apply flow used to snapshot itself into localStorage under
 * `gavelling-apply-resume:${slug}:${role}` purely so a "buy credits" Stripe
 * round trip could come back to Overview. That key had three problems:
 *
 *   1. It was NOT user-scoped. Two applicants on one shared library machine
 *      inherited each other's answers — the same class of bug AGENTS.md
 *      documents for chat read counts ("NEVER go back to a key without the
 *      reader identity in it", chatReadKey.ts:33).
 *   2. It expired after two hours and died with the browser profile, so a
 *      half-finished application was never really recoverable.
 *   3. It only ever fired on the way to checkout. Closing the tab mid-apply
 *      lost everything.
 *
 * Drafts now live in `public.application_drafts`, keyed (conference, user,
 * role), written through the SECURITY DEFINER `save_application_draft` RPC
 * which forces `user_id` from `auth.uid()`. Nothing here trusts the client
 * for identity.
 *
 * CONCURRENCY
 * `revision` is an optimistic-concurrency counter owned by the DB. Every
 * successful save returns the new revision; the next save must present it.
 * A save presenting a stale revision comes back `{ok:false, conflict:true}`
 * and the caller MUST stop autosaving rather than retry with the fresh
 * revision — retrying is last-write-wins, which silently eats whatever the
 * other tab typed with nothing on screen to notice it by.
 *
 * WHAT IS DELIBERATELY NOT STORED
 * `appliedVoucher`. A voucher can expire, be revoked, or hit its redemption
 * cap between the save and the applicant coming back; restoring the resolved
 * discount object would show them money that evaporates at submit. Only the
 * raw `voucherCode` is kept, and validation re-runs on resume.
 * `dobInput` is likewise absent — it writes straight through to `profiles`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomAnswers } from '@/lib/customQuestions';

/** Mirrors the apply flow's own `Preference` (structurally identical). */
export interface DraftPreference {
  committeeId: string;
  committeeName: string;
  countryCode: string;
  countryName: string;
}

/**
 * Everything the apply flow restores. This is the `answers` jsonb column.
 *
 * Every field here is an answer the applicant typed or chose. Transient UI
 * state (loading/submitting flags, dropdown open state, suggestion lists,
 * drag indices, per-field error strings, the resolved voucher) is NOT here
 * on purpose — restoring it would resurrect a spinner or an error message
 * that has nothing to do with the applicant's current session.
 */
export interface ApplyDraftAnswers {
  isIndependent: boolean;
  societyInput: string;
  selectedSocietyId: string | null;
  /** Delegation invite: the resolved society, so an invited applicant who
   *  resumes without the ?delegationInvite param keeps their bypass. */
  invitedSocietyId: string | null;
  inviteSocietyName: string | null;
  /** The invite token itself, so the link's effect survives losing the URL. */
  delegationInviteToken: string | null;
  willPledgeSpots: boolean | null;
  spotsPledged: number | '';
  willPledgeAdvisors: boolean | null;
  advisorsPledged: number | '';
  preferences: DraftPreference[];
  experienceLevel: string;
  customAnswers: CustomAnswers;
  /** Which section page of the Questions step they were on. */
  questionPage: number;
  /** Raw code only — never the resolved discount (see file header). */
  voucherCode: string;
}

export interface ApplyDraftRow {
  answers: ApplyDraftAnswers;
  step: number;
  revision: number;
  discardToken: string;
  /** The tab that last wrote this row (see `saveApplyDraftOnTeardown`). */
  clientId: string | null;
}

/** What `save_application_draft` returns, normalised. */
export type SaveDraftResult =
  | { ok: true; revision: number; created: boolean }
  | { ok: false; conflict: true; revision: number }
  | { ok: false; conflict?: false; reason: string };

/** A fresh id per tab, so the DB can tell which tab last wrote a draft. */
export function newDraftClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through to the manual form */ }
  // RFC 4122 v4 shape, good enough for a uuid column on a non-security field.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * THE CREATION GATE.
 *
 * "It always saves" taken literally means merely OPENING /apply writes a row,
 * and three days later the applicant gets a reminder email about an
 * application they never started. So draft *creation* is gated on the
 * applicant having actually put something in.
 *
 * Once a draft exists it saves unconditionally — including back to empty, so
 * clearing an answer is a real, persisted act. ONLY creation is gated.
 */
export function draftHasContent(answers: ApplyDraftAnswers, step: number): boolean {
  if (step > 1) return true;
  if (answers.selectedSocietyId !== null) return true;
  if (answers.societyInput.trim() !== '') return true;
  if (answers.preferences.length > 0) return true;
  if (answers.willPledgeSpots !== null) return true;
  if (answers.willPledgeAdvisors !== null) return true;
  for (const value of Object.values(answers.customAnswers ?? {})) {
    if (customAnswerFilled(value)) return true;
  }
  return false;
}

/** An answer counts as entered if it is a non-blank scalar or a non-empty list. */
function customAnswerFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return true;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return false;
}

/**
 * A stable string identity for a draft, used to skip saves that would write
 * byte-identical content (every render recomputes the payload, and a step
 * flush plus a debounce flush would otherwise both write the same thing).
 *
 * Object keys are sorted, because Postgres `jsonb` re-orders keys on the way
 * in: a draft read back from the DB would otherwise never fingerprint equal
 * to the same draft held in memory, and simply resuming would burn a
 * revision — handing a spurious conflict to a second, untouched tab.
 *
 * Arrays keep their order: `preferences` IS its order.
 */
export function fingerprintDraft(answers: ApplyDraftAnswers, step: number): string {
  return `${step}|${stableStringify(answers as unknown)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Read this user's draft for (conference, role). Straight select — the
 * "Users manage own drafts" RLS policy already scopes it to auth.uid(); the
 * explicit user_id filter is belt-and-braces, not the security boundary.
 *
 * Returns null when there is no draft, and on any error: a failed read must
 * degrade to "start fresh", never to a broken flow.
 */
export async function loadApplyDraft(
  client: SupabaseClient,
  conferenceId: string,
  userId: string,
  role: string,
): Promise<ApplyDraftRow | null> {
  const { data, error } = await client
    .from('application_drafts')
    .select('answers, step, revision, discard_token, client_id')
    .eq('conference_id', conferenceId)
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    answers: Partial<ApplyDraftAnswers> | null;
    step: number | null;
    revision: number | string | null;
    discard_token: string;
    client_id: string | null;
  };
  if (!row.answers || typeof row.answers !== 'object') return null;

  return {
    answers: normalizeAnswers(row.answers),
    step: Number(row.step ?? 1) || 1,
    revision: Number(row.revision ?? 0) || 0,
    discardToken: row.discard_token,
    clientId: row.client_id,
  };
}

/**
 * Fill in anything a draft written by an older build is missing. A draft is
 * read back into React state setters, so a missing field would set `undefined`
 * on a controlled input and flip it to uncontrolled mid-flow.
 */
export function normalizeAnswers(raw: Partial<ApplyDraftAnswers>): ApplyDraftAnswers {
  return {
    isIndependent: raw.isIndependent ?? false,
    societyInput: raw.societyInput ?? '',
    selectedSocietyId: raw.selectedSocietyId ?? null,
    invitedSocietyId: raw.invitedSocietyId ?? null,
    inviteSocietyName: raw.inviteSocietyName ?? null,
    delegationInviteToken: raw.delegationInviteToken ?? null,
    willPledgeSpots: raw.willPledgeSpots ?? null,
    spotsPledged: raw.spotsPledged ?? '',
    willPledgeAdvisors: raw.willPledgeAdvisors ?? null,
    advisorsPledged: raw.advisorsPledged ?? '',
    preferences: Array.isArray(raw.preferences) ? raw.preferences : [],
    experienceLevel: raw.experienceLevel ?? '',
    customAnswers: (raw.customAnswers ?? {}) as CustomAnswers,
    questionPage: typeof raw.questionPage === 'number' ? raw.questionPage : 0,
    voucherCode: raw.voucherCode ?? '',
  };
}

/**
 * Upsert the draft. `revision` is the one this tab last saw — pass 0 when no
 * draft exists yet (the RPC inserts and ignores the revision in that case).
 *
 * NEVER await this on the UI path: AGENTS.md RULE 5, a save must not be able
 * to delay a keystroke or a step transition.
 */
export async function saveApplyDraft(
  client: SupabaseClient,
  args: {
    conferenceId: string;
    role: string;
    answers: ApplyDraftAnswers;
    step: number;
    revision: number;
    clientId: string;
  },
): Promise<SaveDraftResult> {
  const { data, error } = await client.rpc('save_application_draft', {
    p_conference_id: args.conferenceId,
    p_role: args.role,
    p_answers: args.answers as unknown as Record<string, unknown>,
    p_step: args.step,
    p_revision: args.revision,
    p_client_id: args.clientId,
  });

  if (error) return { ok: false, reason: error.message || 'network' };
  const res = data as {
    ok?: boolean; conflict?: boolean; revision?: number | string;
    reason?: string; created?: boolean;
  } | null;
  if (!res) return { ok: false, reason: 'no_response' };
  if (res.ok) {
    return { ok: true, revision: Number(res.revision ?? 0), created: !!res.created };
  }
  if (res.conflict) {
    return { ok: false, conflict: true, revision: Number(res.revision ?? 0) };
  }
  return { ok: false, reason: res.reason ?? 'unknown' };
}

// PostgREST endpoint used only by the teardown save below. Same fallback
// literals as src/app/api/emails/queue-participant/route.ts — the publishable
// key is public by design, RLS is what protects the row.
const REST_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://luruhkwrgisytejswlas.supabase.co';
const REST_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV';

/**
 * Save during page teardown (`pagehide`), where an ordinary request loses the
 * race against the browser destroying the document — measured: closing the tab
 * immediately after a keystroke dropped it entirely. `keepalive: true` lets
 * the request outlive the page, which supabase-js gives no way to ask for, so
 * this posts to the RPC endpoint directly.
 *
 * Deliberately returns nothing: there is no page left to show a conflict on,
 * and no way to read the new revision. The caller MUST therefore mark its
 * revision unknown and re-sync before its next ordinary save (the page can
 * come back — bfcache restores it after pagehide) — see `resyncDraftRevision`.
 */
export function saveApplyDraftOnTeardown(
  accessToken: string,
  args: {
    conferenceId: string; role: string; answers: ApplyDraftAnswers;
    step: number; revision: number; clientId: string;
  },
): void {
  try {
    void fetch(`${REST_URL}/rest/v1/rpc/save_application_draft`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: REST_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        p_conference_id: args.conferenceId,
        p_role: args.role,
        p_answers: args.answers,
        p_step: args.step,
        p_revision: args.revision,
        p_client_id: args.clientId,
      }),
    }).catch(() => { /* the page is going away; nothing to surface it on */ });
  } catch { /* never throw during teardown */ }
}

/**
 * Re-read the revision after a blind teardown save, so this tab can carry on
 * saving if the page comes back.
 *
 * Adopting a revision we did not observe would be last-write-wins — UNLESS the
 * row still names THIS tab as its last writer, in which case the write we are
 * catching up with was our own. If another tab has written since, that is a
 * genuine conflict and it is reported as one.
 */
export async function resyncDraftRevision(
  client: SupabaseClient,
  args: { conferenceId: string; userId: string; role: string; clientId: string },
): Promise<{ status: 'ok'; revision: number } | { status: 'conflict' } | { status: 'gone' } | { status: 'error' }> {
  const { data, error } = await client
    .from('application_drafts')
    .select('revision, client_id')
    .eq('conference_id', args.conferenceId)
    .eq('user_id', args.userId)
    .eq('role', args.role)
    .maybeSingle();

  if (error) return { status: 'error' };
  if (!data) return { status: 'gone' };
  const row = data as { revision: number | string; client_id: string | null };
  if (row.client_id && row.client_id !== args.clientId) return { status: 'conflict' };
  return { status: 'ok', revision: Number(row.revision ?? 0) || 0 };
}

/**
 * Delete the draft. Called once the application it was a draft OF exists (or
 * has been withdrawn) — leaving the row behind would show the organiser a
 * "still deciding" draft for somebody who has already applied, and would keep
 * the reminder job emailing them.
 *
 * `discard_application_draft` takes the row's own discard_token (the same
 * token the reminder emails' one-click discard link carries) and additionally
 * requires ownership, so a leaked token destroys nothing. When the token isn't
 * already in hand we look it up first.
 */
export async function discardApplyDraft(
  client: SupabaseClient,
  args: { conferenceId: string; userId: string; role: string; token?: string | null },
): Promise<boolean> {
  let token = args.token ?? null;
  if (!token) {
    const { data } = await client
      .from('application_drafts')
      .select('discard_token')
      .eq('conference_id', args.conferenceId)
      .eq('user_id', args.userId)
      .eq('role', args.role)
      .maybeSingle();
    token = (data as { discard_token: string } | null)?.discard_token ?? null;
  }
  if (!token) return true; // nothing to discard
  const { data, error } = await client.rpc('discard_application_draft', { p_token: token });
  if (error) return false;
  return !!(data as { ok?: boolean } | null)?.ok;
}
