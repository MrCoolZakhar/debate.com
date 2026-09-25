import { redirect } from 'next/navigation';

// The old "Your conferences" page is superseded by /account/conferences.
// Server-side redirect keeps old links and bookmarks working.
export default function ConferencesOrganisePage() {
  redirect('/account/conferences');
}
