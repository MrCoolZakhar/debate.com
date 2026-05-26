import { Suspense } from 'react';
import ConferencesExploreClient from './ConferencesExploreClient';

export default function ConferencesExplorePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }} />}>
      <ConferencesExploreClient />
    </Suspense>
  );
}
