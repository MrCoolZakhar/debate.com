import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import CreditsPricingClient from './CreditsPricingClient';

export const metadata: Metadata = pageMetadata({
  title: 'Credits',
  description:
    'A Gavelling credit is one conference application for one dollar. Your first credit is free, bundles cost less a credit, and a rejected or withdrawn application returns it.',
  path: '/pricing/credits',
  ogTitle: 'Gavelling credits: one credit, one application',
});

export default function CreditsPricingPage() {
  return <CreditsPricingClient />;
}
