// Delegate reviews tab, its own route so it's a real, shareable, deep-linkable URL.
import ConferenceDetailClient from '../ConferenceDetailClient';

export default function ConferenceReviewsPage() {
  return <ConferenceDetailClient initialView="reviews" />;
}
