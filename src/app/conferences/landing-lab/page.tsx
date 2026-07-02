import { Suspense } from 'react';
import LandingLabClient from './LandingLabClient';

export default function LandingLabPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }} />}>
      <LandingLabClient />
    </Suspense>
  );
}
