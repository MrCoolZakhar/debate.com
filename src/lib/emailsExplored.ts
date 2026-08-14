// "Explore emails" set-up item — DELIBERATELY CLIENT-LOCAL.
//
// The dashboard's set-up priorities checklist is otherwise a pure function of
// the database, and is mirrored server-side by the Postgres function
// `public.conference_setup_status(uuid)` (consumed by the `send-setup-nudges`
// edge function that emails organisers their outstanding items).
//
// This item is the one exception: it does not ask "have you enabled an email?",
// it asks "have you had a look at what the email system can do?". There is no
// DB flag for that, and adding one would mean writing to the conferences row on
// a mere page view. So it lives in localStorage, per conference, per browser.
//
// CONSEQUENCE — the nudge email CANNOT see this. `conference_setup_status`
// keeps the emails item on its old `enabled_email_count > 0` condition, so an
// organiser who has explored emails but enabled none will still see the item
// ticked on the dashboard while the nudge email still lists it. That
// divergence is intentional; do not try to "fix" it by writing this flag to the
// database without an explicit decision to persist it server-side.

const PREFIX = 'gv-emails-explored-';

function key(conferenceId: string) {
  return `${PREFIX}${conferenceId}`;
}

/** Record that this organiser has looked at the communications page. */
export function markEmailsExplored(conferenceId: string): void {
  if (typeof window === 'undefined' || !conferenceId) return;
  try {
    window.localStorage.setItem(key(conferenceId), '1');
  } catch {
    // Private mode / quota — the item simply stays pending.
  }
}

/**
 * Has this browser visited the communications page for this conference?
 * Must only be called from an effect — reading localStorage during render
 * would desync the server-rendered HTML.
 */
export function hasExploredEmails(conferenceId: string): boolean {
  if (typeof window === 'undefined' || !conferenceId) return false;
  try {
    return window.localStorage.getItem(key(conferenceId)) === '1';
  } catch {
    return false;
  }
}
