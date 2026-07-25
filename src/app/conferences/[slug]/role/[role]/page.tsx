// Participant view with a specific role active. Signed out, renders the
// sign-in state with next pointing back to this exact URL. Signed in but not
// holding this role, ConferenceDetailClient falls back to the viewer's
// default role via router.replace.
import ConferenceDetailClient from '../../ConferenceDetailClient';

export default async function ConferenceRolePage({ params }: { params: Promise<{ slug: string; role: string }> }) {
  const { role } = await params;
  return <ConferenceDetailClient initialView="participant" initialRole={role} />;
}
