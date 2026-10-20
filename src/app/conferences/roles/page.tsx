import { permanentRedirect } from 'next/navigation';

// The roles board became the Job Board at /jobs (19 Oct 2026). Every old link
// lands there. ConferencesRolesClient.tsx stays in the folder, unused.
export default function ConferencesRolesPage() {
  permanentRedirect('/jobs');
}
