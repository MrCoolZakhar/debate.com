// Role resolver: the stable target for any link that cannot know the
// viewer's role at this conference ahead of time (emails, /my-conferences,
// cross-page "back" fallbacks). ConferenceDetailClient determines the
// viewer's default role once their applications are loaded and
// router.replaces to /role/[thatRole]; signed out, it shows the participant
// sign-in state with next pointing back to this exact URL.
import ConferenceDetailClient from '../ConferenceDetailClient';

export default function ConferenceRoleResolverPage() {
  return <ConferenceDetailClient initialView="participant" initialRole={null} />;
}
