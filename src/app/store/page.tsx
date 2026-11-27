import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import StoreClient from './StoreClient';

export const metadata: Metadata = pageMetadata({
  title: { absolute: 'Gavelling Store' },
  description: 'Credits, Unlimited, spotlights and everything else you can buy on Gavelling.',
  path: '/store',
});

export default function StorePage() {
  return <StoreClient />;
}
