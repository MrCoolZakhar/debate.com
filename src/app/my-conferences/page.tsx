'use client';

// /my-conferences moved to /account/conferences. This is a CLIENT redirect on
// purpose: old emails and bookmarks link /my-conferences?tab=all#drafts, and a
// server redirect never sees the hash. The query string and the hash both ride
// along, so every old link lands on the same tab and the same anchor.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/Loader';

export default function MyConferencesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account/conferences' + window.location.search + window.location.hash);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
      <Loader size={72} label="Loading your conferences" />
    </div>
  );
}
