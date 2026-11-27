import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import CreditsUnlimitedClient from './CreditsUnlimitedClient';

// ── Credits and Unlimited (/store/credits, prompt 86) ───────────────────────
// The bundles, Gavelling Unlimited (?plan=unlimited scrolls to it; ?renew=once
// opens the one-time-year Unlimited pop-up) and the questions, in the black
// Store shell.

export const metadata: Metadata = pageMetadata({
  title: 'Credits and Unlimited',
  description: 'Gavelling credits and Gavelling Unlimited: one credit is one conference application, bigger bundles cost less a credit, and Unlimited covers every application while it is active.',
  path: '/store/credits',
});

export default function StoreCreditsPage() {
  return <CreditsUnlimitedClient />;
}
