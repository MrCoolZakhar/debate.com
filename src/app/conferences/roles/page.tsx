import { permanentRedirect } from 'next/navigation';

// The roles board became the Job Board at /jobs (19 Oct 2026). Every old link
// lands there. The old board's client was deleted with the legacy job tables.
export default function ConferencesRolesPage() {
  permanentRedirect('/jobs');
}
