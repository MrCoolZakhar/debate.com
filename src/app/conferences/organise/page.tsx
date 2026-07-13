import { redirect } from 'next/navigation';

// The old "Your conferences" page is superseded by /my-conferences.
// Server-side redirect keeps old links and bookmarks working.
export default function ConferencesOrganisePage() {
  redirect('/my-conferences');
}
