import { redirect } from 'next/navigation';

// /pricing has no page of its own: the section opens on Credits.
export default function PricingIndex() {
  redirect('/pricing/credits');
}
