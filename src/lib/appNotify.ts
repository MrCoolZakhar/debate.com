'use client';

// ── appNotify ──────────────────────────────────────────────────────────────
//
// Two-line front door onto the notification store for the ORGANISER surfaces
// (/manage and friends), where the thing being reported is almost always the
// outcome of an action the organiser just took.
//
// It exists so a page that used to do
//
//     setActionError("Couldn't save, the change was reverted.")
//
// and render a full-width amber strip above its own content can instead do
//
//     notifyErr("Couldn't save, the change was reverted.")
//
// and get the corner card the live committee session uses — same store, same
// renderer, same swipe and TTL rules. The bars those calls replaced pushed the
// work down the page to report on it and then took the space back, which is
// exactly the shape of thing a toast is for.
//
// ── What these are NOT for ─────────────────────────────────────────────────
//
// A fact that stays true while the organiser works is not an outcome, and a
// card that leaves after eight seconds is the wrong home for it. Leave the
// following where they are, in the page:
//   • permission and mode explainers ("View only.", "SECTION RESTRICTED")
//   • setup gates ("Applications stay closed until this is finished")
//   • a validation message that belongs beside the field it is about
//   • a load failure that is still failing and retrying
// The rule of thumb: if re-reading it a minute later would still tell the
// organiser something true and useful, it is not a notification.
//
// ── Keys ───────────────────────────────────────────────────────────────────
//
// The store keeps ONE live card per key (rule 1 in `sessionNotifications`).
// The default keys below are per-surface, not per-message, on purpose: a page's
// action error should REPLACE the previous one rather than stack a column of
// near-identical failures, which is precisely what the single `actionError`
// string these calls replaced did. Pass an explicit `key` when two outcomes on
// one page genuinely need to coexist.

import { notify, dismiss } from './sessionNotifications';

/** Errors sit longer — they are usually the only record of what went wrong. */
const ERR_TTL_MS = 9_000;
const OK_TTL_MS = 5_000;

const errKey = (scope: string) => `app-err:${scope}`;
const okKey = (scope: string) => `app-ok:${scope}`;

/**
 * Something the organiser tried did not work.
 *
 * `message` IS the title — these strings ("Couldn't save, the change was
 * reverted.") are already whole sentences that say what happened, and wrapping
 * them in a generic "Something went wrong" heading would only add a line.
 */
export function notifyErr(message: string, scope = 'action'): void {
  if (!message) return;
  notify({ key: errKey(scope), kind: 'info', level: 'error', title: message, ttlMs: ERR_TTL_MS });
}

/** Something the organiser did worked, and is worth confirming. */
export function notifyOk(message: string, scope = 'action'): void {
  if (!message) return;
  notify({ key: okKey(scope), kind: 'info', level: 'ok', title: message, ttlMs: OK_TTL_MS });
}

/**
 * Clear a scope's error card early.
 *
 * The bars these replaced were cleared by `setActionError('')` at the START of
 * the next attempt, so a stale failure never sat over a retry in progress.
 * Call this in the same place for the same reason; the TTL handles the rest.
 */
export function clearErr(scope = 'action'): void {
  dismiss(errKey(scope));
}

/** The success counterpart, for pages whose old code cleared a flash by hand. */
export function clearOk(scope = 'action'): void {
  dismiss(okKey(scope));
}
