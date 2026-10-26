'use client';
// History now lives as a tab inside the Map page: send old links there.
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const params = useParams<{ conference: string; crisis: string }>();
  const conf = params?.conference ?? '';
  const crisis = params?.crisis ?? '';
  useEffect(() => {
    if (conf && crisis) router.replace(`/crisis/${conf}/${crisis}/map?tab=history`);
  }, [router, conf, crisis]);
  return null;
}
