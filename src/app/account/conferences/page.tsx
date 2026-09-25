'use client';

// My Conferences, rendered INSIDE the /account layout shell (sidebar + chrome).
// MyConferencesClient already wraps its inner view in Suspense (it reads
// useSearchParams for ?tab= routing), so no extra Suspense boundary is needed.
// The old /my-conferences address forwards here with its query and hash intact.

import MyConferencesClient from './MyConferencesClient';

export default function AccountConferencesPage() {
  return <MyConferencesClient embedded />;
}
