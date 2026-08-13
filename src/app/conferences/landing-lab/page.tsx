import { Suspense } from 'react';
import LandingLabClient from './LandingLabClient';
import Loader from '@/components/Loader';

export default function LandingLabPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#EDE7D8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader size={72} label="Loading" />
        </div>
      }
    >
      <LandingLabClient />
    </Suspense>
  );
}
