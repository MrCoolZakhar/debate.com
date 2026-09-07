// "Explore emails" set-up item: the localStorage half.
//
// The item asks "have you had a look at what the email system can do?", not
// "have you enabled an email?". It is recorded in two places by the
// communications page (src/app/manage/[slug]/communications/page.tsx):
//
//   1. here, in localStorage, per conference, per browser, so the dashboard
//      ticks the item instantly on the way back, and
//   2. on the server, as `conferences.emails_explored_at`, stamped once (only
//      while still null) through the authed client.
//
// The server column is what `public.conference_setup_status(uuid)` (the
// `send-setup-nudges` edge function) and the verification mark read. This
// file stays for the instant tick and for browsers whose stamp has not been
// refetched yet; it is never the source of truth for the checkmark.

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
