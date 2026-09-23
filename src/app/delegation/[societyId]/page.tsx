import { Suspense } from 'react';
import DelegationPortalClient from './DelegationPortalClient';

export default function DelegationPortalPage() {
  // The portal reads ?tab= through useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <DelegationPortalClient />
    </Suspense>
  );
}
