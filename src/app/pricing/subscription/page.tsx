import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import SubscriptionPricingClient from './SubscriptionPricingClient';

export const metadata: Metadata = pageMetadata({
  title: 'Subscription',
  description:
    'Gavelling Unlimited covers every conference application you make while it is active: 3 US dollars a month or 30 a year, renewing until you cancel.',
  path: '/pricing/subscription',
  ogTitle: 'Gavelling Unlimited: apply to every conference',
});

export default function SubscriptionPricingPage() {
  return <SubscriptionPricingClient />;
}
