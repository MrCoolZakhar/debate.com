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
  conference_committees_topics_check: "A committee can have at most 3 topics.",
  conference_committees_total_slots_check: "A committee needs at least one seat.",
  email_templates_recurring_interval_floor: "Reminders can be sent every 3 to 60 days.",
  email_templates_recurring_max_sends_range: "Reminders can be sent between 1 and 10 times.",
  vouchers_amount_check: "A voucher needs an amount above zero.",
  vouchers_percent_range: "A percentage voucher must be between 1 and 100.",
  applications_aid_requested_amount_nonneg: "The amount you request can't be negative.",
  financial_aid_requests_requested_amount_check: "The amount you request can't be negative.",
  // enforce_role_config_timeline(): the application window and the fee
  // phases are one timeline (see src/lib/roleTimeline.ts for the rules).
  arc_timeline_phase_dates: "Each price needs a start date on or before its end date.",
  arc_timeline_phases_overlap: "Two prices cover the same day. Start each price the day after the previous one ends.",
  arc_timeline_phases_gap: "There is a gap between two prices. Start each price the day after the previous one ends, so every day has one price.",
  arc_timeline_open_after_first_price: "Applications would open after your first price has ended. Pick an earlier opening date, or remove that price.",
  arc_timeline_close_before_last_price: "Applications would close before your last price starts. Pick a later closing date, or remove that price.",
  arc_timeline_open_before_close: "Applications must open before they close. Move one of the two dates.",
  arc_timeline_after_conference: "Applications can't close after the conference ends. Move the closing date, or the last price's end date, to the conference's last day or earlier.",
};

/** Supabase Auth (GoTrue) errors, matched by code first and by message text
 *  second for older clients that send no code at all. */
const AUTH_MESSAGES: { codes: string[]; pattern?: RegExp; message: string }[] = [
  { codes: ['invalid_credentials'], pattern: /Invalid login credentials/, message: "That email and password don't match. Check them and try again, or reset your password." },
  { codes: ['user_already_exists', 'email_exists'], pattern: /already registered/, message: 'An account with this email already exists. Sign in instead.' },
  { codes: ['weak_password'], pattern: /Password should be/, message: 'That password is too weak. Use at least 8 characters.' },
  { codes: ['over_email_send_rate_limit', 'over_request_rate_limit'], pattern: /rate limit|security purposes/, message: 'That is a few too many in a row. Wait a minute or two and try again.' },
  { codes: ['same_password'], pattern: /should be different/, message: 'Your new password must be different from your current one.' },
  { codes: ['email_address_invalid'], pattern: /Unable to validate email address/, message: "That email address doesn't look right. Check it and try again." },
  { codes: ['otp_expired'], message: 'That code has expired. Ask for a new one and try again.' },
  { codes: ['signup_disabled'], message: 'New sign-ups are paused right now. Please try again later.' },
  { codes: ['provider_disabled'], message: "That sign-in option isn't available right now. Try email and password instead." },
  { codes: ['session_not_found', 'refresh_token_not_found'], message: 'Your session has expired. Please refresh the page and sign in again.' },
];

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

/** By the HINT our own triggers attach to a refusal (RAISE ... USING hint),
 *  for the refusals a person reaches in the normal course of things and
 *  deserves a better sentence than the trigger's own message. */
const HINT_MESSAGES: Record<string, string> = {
  // guard_application_write(): the role's application window.
  role_closed: "Applications for this role have closed, so this application can't be sent. Your answers are saved. Contact the organising team if you think this is a mistake.",
  role_not_open: "Applications for this role haven't opened yet. Your answers are saved, so you can send them once applications open.",
};

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

/** Marks an error whose message we wrote ourselves, for a person, at the
 *  point it was thrown. friendlyError passes it through untouched rather
 *  than running it through the generic resolution below, which exists to
 *  translate a message nobody wrote for a person in the first place. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** The plain sentence for a named CHECK (or a trigger rule raised under a
 *  constraint name), for UI that checks the rule itself before saving. */
export function constraintMessage(name: string): string | null {
  return CONSTRAINT_MESSAGES[name] ?? null;
}

/** For a message that already came back as plain text from our OWN edge
 *  function or RPC result (not a caught error object). Usually written for
 *  a person already, but a Stripe or Postgres string can still leak through
 *  one of those. Returns the message as-is when it is a short, human-looking
 *  string, otherwise the fallback (and logs the raw message so it is not
 *  lost). */
export function plainOrFallback(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.length > 0 && message.length <= 240 && !looksTechnical(message)) {
    return message;
  }
  // eslint-disable-next-line no-console
  console.error('[plainOrFallback]', message);
  return fallback;
}

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

  // A message we wrote ourselves, for a person, at the point it was thrown.
  // Nothing generic below can improve on it.
  if (error instanceof UserFacingError) return error.message;

  const message = extractMessage(error);
  const code = extractCode(error);

  // a. Named constraint, wherever it shows up in the message.
  const constraintMatch = message.match(/constraint "([^"]+)"/);
  if (constraintMatch) {
    const known = CONSTRAINT_MESSAGES[constraintMatch[1]];
    if (known) return known;
  }

  // a2. Supabase Auth (GoTrue) errors: code first, then message text for
  // older clients that send no code at all.
  for (const entry of AUTH_MESSAGES) {
    if (code && entry.codes.includes(code)) return entry.message;
    if (entry.pattern && entry.pattern.test(message)) return entry.message;
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

  // d2. Our own payment-gate triggers raise a plain sentence under SQLSTATE
  // 23514 (check_violation) with no named constraint — e.g. "Applications
  // cannot open yet. Choose how you get paid first..." Trust it once it
  // clears looksTechnical. A genuine CHECK violation always says "violates
  // check constraint", which looksTechnical already catches, so those still
  // fall through to the generic sentence below.
  if (code === '23514' && !constraintMatch && !looksTechnical(message)) {
    return message;
  }

  // e. By SQLSTATE.
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // e2. Our own trigger refusals, by hint.
  const hint = isErrorLike(error) && typeof error.hint === 'string' ? error.hint : '';
  if (hint && HINT_MESSAGES[hint]) return HINT_MESSAGES[hint];

  // f. Our own trigger messages: written for people already, but only trust
  // them once they clear looksTechnical — a RAISE EXCEPTION can still quote
  // a relation or column name back at the user.
  if (code === 'P0001' && message && !looksTechnical(message)) {
    return message;
  }

  // g. Nothing safe to say more specifically.
  return fallback;
}
