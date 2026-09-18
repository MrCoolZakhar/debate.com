// friendlyError.ts — turns a caught error into a sentence a user can act on.
//
// Nothing caught anywhere in the app should ever put a raw Postgres,
// PostgREST, Storage, Stripe or network error string in front of a user.
// Route every one of them through friendlyError(error, fallback) instead.
// See CLAUDE.md's "Errors are written for people, never for engineers" rule.
//
// CONSTRAINT_MESSAGES is the plain-English twin of the database's CHECK
// constraint names. When a migration adds a CHECK a user can reach, add its
// sentence here in the same change — a name with no sentence here falls
// through to the generic "one of the values isn't allowed" message, which is
// safe but says nothing about which value or why.

/** A database CHECK a user can plausibly trigger, and the sentence for it.
 *  Keep this list matched to the live schema: a name that no longer exists
 *  is harmless dead weight, but a CHECK with no entry here is a raw
 *  constraint name away from reaching a user. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  conferences_tbd_not_public: "Add your conference dates before publishing. A conference with dates to be decided stays private.",
  conferences_external_payment_url_https: "Payment links must start with https://",
  conferences_external_payment_note_len: "The payment note can be at most 500 characters.",
  conferences_age_range_check: "Ages must be between 5 and 120, and the minimum can't be above the maximum.",
  conferences_min_age_check: "The minimum age must be between 10 and 99.",
  conferences_expected_delegates_check: "Expected delegates must be at least 1.",
  conferences_theme_shape: "That colour isn't valid. Pick a colour and try again.",
  conferences_theme_draft_shape: "That colour isn't valid. Pick a colour and try again.",
  conference_partners_company_url_https: "The partner website must start with https://",
  conference_partners_one_shape: "A company partner needs a name.",
  conference_partners_check: "A conference can't partner with itself.",
  arc_submission_message_len: "The message after submitting must be between 1 and 280 characters.",
  arc_submission_link_label_len: "The button label must be between 1 and 40 characters.",
  arc_submission_link_url_https: "The button link must start with https://",
  arc_submission_link_shape: "Add a message, a button label and a link together, or leave all three empty.",
  application_role_configs_collect_mun_experience_role_check: "MUN experience can only be collected for chairs and secretariat.",
};

/** By SQLSTATE code, when the message itself gives nothing more specific to
 *  say (no named constraint, not one of our own trigger messages). */
const CODE_MESSAGES: Record<string, string> = {
  '23505': 'That already exists.',
  '23503': "This is linked to something else, so it can't be changed right now.",
  '23502': 'A required field is empty. Please fill it in and try again.',
  '23514': "One of the values isn't allowed. Please check the form and try again.",
  '22001': 'One of the fields is too long.',
  '22P02': "One of the values isn't in the right format.",
  '22007': "One of the values isn't in the right format.",
  '22008': "One of the values isn't in the right format.",
};

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

/** Loose shape covering PostgrestError, StorageError, FunctionsHttpError and
 *  a plain Error — every property optional, read defensively. */
interface ErrorLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null;
}

/** Best-effort message extraction. Never throws: an error shaped nothing
 *  like we expect just yields an empty string, which falls through to the
 *  fallback exactly like a missing error would. */
function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isErrorLike(error) && typeof error.message === 'string') return error.message;
  try {
    return String(error ?? '');
  } catch {
    return '';
  }
}

function extractCode(error: unknown): string {
  if (isErrorLike(error) && typeof error.code === 'string') return error.code;
  return '';
}

/** True when a message is written for an engineer rather than a person —
 *  the giveaway phrases Postgres/PostgREST actually use. Our own trigger
 *  messages (RAISE EXCEPTION, code P0001) are the one place we trust the
 *  message as-is, but only once it clears this check. */
function looksTechnical(msg: string): boolean {
  return /relation "|constraint|violates|column "|function |syntax|null value|uuid|jsonb|PGRST|duplicate key/i.test(msg);
}

export function friendlyError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  // eslint-disable-next-line no-console
  console.error('[friendlyError]', error);

  const message = extractMessage(error);
  const code = extractCode(error);

  // a. Named constraint, wherever it shows up in the message.
  const constraintMatch = message.match(/constraint "([^"]+)"/);
  if (constraintMatch) {
    const known = CONSTRAINT_MESSAGES[constraintMatch[1]];
    if (known) return known;
  }

  // b. Network.
  if (/Failed to fetch|NetworkError|Load failed/.test(message)) {
    return "We couldn't reach Gavelling. Check your connection and try again.";
  }

  // c. Session.
  if (code === 'PGRST301' || /JWT/.test(message)) {
    return 'Your session has expired. Please refresh the page and sign in again.';
  }

  // d. Permission.
  if (code === '42501' || /row-level security/.test(message)) {
    return "You don't have permission to do that. If you think you should, ask the conference owner.";
  }

  // e. By SQLSTATE.
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // f. Our own trigger messages: written for people already, but only trust
  // them once they clear looksTechnical — a RAISE EXCEPTION can still quote
  // a relation or column name back at the user.
  if (code === 'P0001' && message && !looksTechnical(message)) {
    return message;
  }

  // g. Nothing safe to say more specifically.
  return fallback;
}
