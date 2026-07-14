'use client';

// My Conferences, rendered INSIDE the /account layout shell (sidebar + chrome).
// MyConferencesClient already wraps its inner view in Suspense (it reads
// useSearchParams for ?tab= routing), so no extra Suspense boundary is needed.

import MyConferencesClient from '@/app/my-conferences/MyConferencesClient';

export default function AccountConferencesPage() {
  return <MyConferencesClient embedded />;
}
